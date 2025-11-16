"""
Main orchestrator for the clustering pipeline
"""
import numpy as np
import hashlib
import json
import os
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import logging

from models import (
    Message, MessageWithTags, ClusterInfo, ClusteringOutput
)
from embedding_service import get_embedding_service
from clustering_service import get_clustering_service
from label_generation_service import get_label_service
from config import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ClusterOrchestrator:
    """Orchestrates the complete clustering pipeline"""
    
    def __init__(self):
        """Initialize the orchestrator"""
        self.embedding_service = get_embedding_service()
        self.clustering_service = get_clustering_service()
        self.label_service = get_label_service()
        
        # Create cache directory if it doesn't exist
        if config.ENABLE_CACHE:
            os.makedirs(config.CACHE_DIR, exist_ok=True)
    
    def process_messages(
        self,
        messages: List[Message],
        force_recluster: bool = False,
        distance_threshold: Optional[float] = None,
        min_cluster_size: Optional[int] = None
    ) -> ClusteringOutput:
        """
        Complete pipeline: embed, cluster, and label messages
        
        Args:
            messages: List of input messages
            force_recluster: Force re-clustering even if cached
            distance_threshold: Override default distance threshold
            min_cluster_size: Override minimum cluster size
            
        Returns:
            ClusteringOutput with tagged messages and cluster info
        """
        start_time = datetime.now()
        
        logger.info(f"Processing {len(messages)} messages")
        
        # Generate cache key
        cache_key = self._generate_cache_key(messages, distance_threshold, min_cluster_size)
        
        # Check cache if enabled
        if config.ENABLE_CACHE and not force_recluster:
            cached_result = self._load_from_cache(cache_key)
            if cached_result:
                logger.info("Returning cached result")
                return cached_result
        
        # Step 1: Generate message IDs if not present
        messages = self._ensure_message_ids(messages)
        
        # Step 2: Generate embeddings
        logger.info("Step 1/4: Generating embeddings...")
        texts = [msg.text for msg in messages]
        embeddings = self.embedding_service.encode_messages(texts, show_progress=True)
        
        # Step 3: Cluster messages
        logger.info("Step 2/4: Clustering messages...")
        if distance_threshold or min_cluster_size:
            clustering_service = get_clustering_service()
            clustering_service.distance_threshold = distance_threshold or config.DISTANCE_THRESHOLD
            clustering_service.min_cluster_size = min_cluster_size or config.MIN_CLUSTER_SIZE
        else:
            clustering_service = self.clustering_service
        
        message_ids = [msg.message_id for msg in messages]
        cluster_labels, cluster_to_messages, linkage_matrix = clustering_service.cluster_messages(
            embeddings, message_ids
        )
        
        # Step 4: Compute cluster centroids
        logger.info("Step 3/4: Computing cluster centroids...")
        centroids = clustering_service.compute_cluster_centroids(embeddings, cluster_to_messages)
        
        # Step 5: Generate labels and tags
        logger.info("Step 4/4: Generating labels and tags...")
        cluster_infos = self._generate_cluster_info(
            messages, cluster_to_messages, centroids, embeddings
        )
        
        # Step 6: Create output
        messages_with_tags = self._create_tagged_messages(
            messages, cluster_labels, cluster_infos
        )
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Create metadata
        metadata = {
            "processing_time_seconds": processing_time,
            "total_messages": len(messages),
            "total_clusters": len(cluster_infos),
            "timestamp": datetime.now().isoformat(),
            "model_info": {
                "embedding_model": self.embedding_service.model_name,
                "llm_model": self.label_service.model_name
            },
            "clustering_params": {
                "distance_threshold": clustering_service.distance_threshold,
                "min_cluster_size": clustering_service.min_cluster_size
            }
        }
        
        result = ClusteringOutput(
            messages=messages_with_tags,
            clusters=cluster_infos,
            metadata=metadata
        )
        
        # Save to cache
        if config.ENABLE_CACHE:
            self._save_to_cache(cache_key, result)
        
        logger.info(f"Clustering complete in {processing_time:.2f}s. Created {len(cluster_infos)} clusters.")
        
        return result
    
    def _ensure_message_ids(self, messages: List[Message]) -> List[Message]:
        """Ensure all messages have unique IDs"""
        for i, msg in enumerate(messages):
            if not msg.message_id:
                # Generate ID from content hash
                msg_hash = hashlib.md5(
                    f"{msg.text}_{msg.user}_{msg.timestamp}_{i}".encode()
                ).hexdigest()[:12]
                msg.message_id = f"msg_{msg_hash}"
        return messages
    
    def _generate_cluster_info(
        self,
        messages: List[Message],
        cluster_to_messages: Dict[int, List[int]],
        centroids: Dict[int, np.ndarray],
        embeddings: np.ndarray
    ) -> List[ClusterInfo]:
        """Generate cluster information including labels and tags"""
        cluster_infos = []
        
        for cluster_id in sorted(cluster_to_messages.keys()):
            message_indices = cluster_to_messages[cluster_id]
            
            # Get messages in this cluster
            cluster_messages = [messages[i] for i in message_indices]
            cluster_texts = [msg.text for msg in cluster_messages]
            
            # Get representative messages for label generation
            representative_indices = self.clustering_service.get_representative_messages(
                embeddings, message_indices, centroids[cluster_id], top_k=10
            )
            representative_texts = [messages[i].text for i in representative_indices]
            
            # Generate label
            label = self.label_service.generate_cluster_label(representative_texts)
            
            # Generate tags
            tags = self.label_service.generate_tags(representative_texts, num_tags=5)
            
            # Create cluster info
            cluster_info = ClusterInfo(
                cluster_id=f"cluster_{cluster_id}",
                label=label,
                tags=tags,
                message_ids=[messages[i].message_id for i in message_indices],
                size=len(message_indices),
                centroid=centroids[cluster_id].tolist(),
                parent_cluster_id=None,
                child_cluster_ids=[]
            )
            
            cluster_infos.append(cluster_info)
        
        return cluster_infos
    
    def _create_tagged_messages(
        self,
        messages: List[Message],
        cluster_labels: List[int],
        cluster_infos: List[ClusterInfo]
    ) -> List[MessageWithTags]:
        """Create output messages with tags"""
        # Build cluster ID to tags mapping
        cluster_tags = {
            info.cluster_id: info.tags
            for info in cluster_infos
        }
        
        messages_with_tags = []
        for i, msg in enumerate(messages):
            cluster_id = f"cluster_{cluster_labels[i]}"
            tags = cluster_tags.get(cluster_id, [])
            
            tagged_msg = MessageWithTags(
                text=msg.text,
                channel=msg.channel,
                user=msg.user,
                timestamp=msg.timestamp,
                message_id=msg.message_id,
                tags=tags,
                cluster_id=cluster_id
            )
            messages_with_tags.append(tagged_msg)
        
        return messages_with_tags
    
    def _generate_cache_key(
        self,
        messages: List[Message],
        distance_threshold: Optional[float],
        min_cluster_size: Optional[int]
    ) -> str:
        """Generate cache key from messages and parameters"""
        # Create a hash of all message texts + parameters
        content = "".join([msg.text for msg in messages])
        params = f"{distance_threshold}_{min_cluster_size}"
        combined = content + params
        
        cache_key = hashlib.md5(combined.encode()).hexdigest()
        return cache_key
    
    def _save_to_cache(self, cache_key: str, result: ClusteringOutput) -> None:
        """Save clustering result to cache"""
        try:
            cache_path = os.path.join(config.CACHE_DIR, f"{cache_key}.json")
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(result.model_dump(), f, ensure_ascii=False, indent=2)
            logger.info(f"Saved result to cache: {cache_key}")
        except Exception as e:
            logger.error(f"Failed to save to cache: {e}")
    
    def _load_from_cache(self, cache_key: str) -> Optional[ClusteringOutput]:
        """Load clustering result from cache"""
        try:
            cache_path = os.path.join(config.CACHE_DIR, f"{cache_key}.json")
            if os.path.exists(cache_path):
                with open(cache_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return ClusteringOutput(**data)
        except Exception as e:
            logger.error(f"Failed to load from cache: {e}")
        return None
    
    def search_messages(
        self,
        query: str,
        messages_with_tags: List[MessageWithTags],
        embeddings: Optional[np.ndarray] = None,
        top_k: int = 10,
        filter_tags: Optional[List[str]] = None,
        filter_clusters: Optional[List[str]] = None
    ) -> List[Tuple[MessageWithTags, float]]:
        """
        Search messages by semantic similarity
        
        Args:
            query: Search query
            messages_with_tags: List of messages to search
            embeddings: Pre-computed embeddings (optional, will compute if not provided)
            top_k: Number of results
            filter_tags: Filter by tags
            filter_clusters: Filter by cluster IDs
            
        Returns:
            List of (message, similarity_score) tuples
        """
        # Generate query embedding
        query_embedding = self.embedding_service.encode_single(query)
        
        # Filter messages if needed
        filtered_messages = messages_with_tags
        if filter_tags:
            filtered_messages = [
                msg for msg in filtered_messages
                if any(tag in msg.tags for tag in filter_tags)
            ]
        if filter_clusters:
            filtered_messages = [
                msg for msg in filtered_messages
                if msg.cluster_id in filter_clusters
            ]
        
        if not filtered_messages:
            return []
        
        # Generate embeddings if not provided
        if embeddings is None:
            texts = [msg.text for msg in filtered_messages]
            embeddings = self.embedding_service.encode_messages(texts)
        
        # Find similar messages
        scores, indices = self.embedding_service.find_similar(
            query_embedding, embeddings, top_k=min(top_k, len(filtered_messages))
        )
        
        # Create results
        results = [
            (filtered_messages[idx], float(score))
            for idx, score in zip(indices, scores)
        ]
        
        return results


# Global instance
_orchestrator: Optional[ClusterOrchestrator] = None


def get_orchestrator() -> ClusterOrchestrator:
    """Get or create the global orchestrator instance"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = ClusterOrchestrator()
    return _orchestrator

