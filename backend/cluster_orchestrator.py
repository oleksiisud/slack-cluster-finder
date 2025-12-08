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
#from label_generation_service import get_label_service
from gemini_label_service import get_label_service
from hierarchical_clustering_service import get_hierarchical_service
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
        self.hierarchical_service = get_hierarchical_service()
        
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
        
        # Step 3: Create hierarchical clusters
        logger.info("Step 2/4: Creating hierarchical clusters...")
        message_ids = [msg.message_id for msg in messages]
        hierarchy = self.hierarchical_service.create_hierarchy(embeddings, message_ids, messages)
        
        # Step 4: Generate labels and tags for all levels
        logger.info("Step 3/4: Generating labels and tags...")
        cluster_infos = self._generate_hierarchical_cluster_info(
            messages, hierarchy, embeddings
        )
        
        # Step 5: Create output
        logger.info("Step 4/4: Creating output...")
        messages_with_tags = self._create_hierarchical_tagged_messages(
            messages, hierarchy, cluster_infos
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
                "distance_threshold": self.clustering_service.distance_threshold,
                "min_cluster_size": self.clustering_service.min_cluster_size
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
    
    def _generate_hierarchical_cluster_info(
        self,
        messages: List[Message],
        hierarchy: Dict,
        embeddings: np.ndarray
    ) -> List[ClusterInfo]:
        """
        Generate cluster information for hierarchical structure
        
        NEW STRUCTURE:
        Level 1: Conversations (grouped by channel + time)
        Level 2: Topic clusters (semantic similarity of conversations)
        """
        cluster_infos = []
        
        # Generate info for TOPIC CLUSTERS (Level 2 - main_clusters)
        for topic_id, topic_cluster in hierarchy['main_clusters'].items():
            message_indices = topic_cluster['message_indices']
            
            # Use MORE messages for better topic labels (up to 30)
            representative_texts = [messages[i].text for i in message_indices[:30]]
            
            # Generate topic label and tags
            label = self.label_service.generate_cluster_label(representative_texts)
            tags = self.label_service.generate_tags(representative_texts, num_tags=5)
            
            cluster_info = ClusterInfo(
                cluster_id=topic_id,
                label=label,
                tags=tags,
                message_ids=[messages[i].message_id for i in message_indices],
                size=len(message_indices),
                centroid=topic_cluster['centroid'].tolist(),
                parent_cluster_id=None,
                child_cluster_ids=topic_cluster['child_ids'],
                level=2,  # Topics are Level 2
                radius=150.0
            )
            cluster_infos.append(cluster_info)
        
        # Generate info for CONVERSATIONS (Level 1 - sub_clusters)
        for conversation in hierarchy['sub_clusters']:
            message_indices = conversation['message_indices']
            
            # Use ALL messages in the conversation for context
            conversation_texts = [messages[i].text for i in message_indices]
            
            # Generate conversation label (shorter, more specific)
            if len(conversation_texts) <= 3:
                # For short conversations, use the first message as label
                first_msg = conversation_texts[0]
                if len(first_msg) > 60:
                    truncated = first_msg[:60]
                    # Try to break at word boundary
                    last_space = truncated.rfind(' ')
                    if last_space > 0:
                        truncated = truncated[:last_space]
                    label = truncated.strip() + "..."
                else:
                    label = first_msg
            else:
                # For longer conversations, generate a summary label
                label = self.label_service.generate_cluster_label(conversation_texts[:10])
            
            # Get channel info (store in metadata, not in label)
            channel = messages[message_indices[0]].channel if message_indices else "unknown"
            
            cluster_info = ClusterInfo(
                cluster_id=conversation['id'],
                label=label,
                tags=[channel] if channel and channel != "unknown" else [],  # Store channel as a tag instead
                message_ids=[messages[i].message_id for i in message_indices],
                size=len(message_indices),
                centroid=conversation['centroid'].tolist(),
                parent_cluster_id=conversation.get('parent_id'),
                child_cluster_ids=[],
                level=1,  # Conversations are Level 1
                radius=300.0
            )
            cluster_infos.append(cluster_info)
        
        return cluster_infos
    
    def _generate_cluster_info(
        self,
        messages: List[Message],
        cluster_to_messages: Dict[int, List[int]],
        centroids: Dict[int, np.ndarray],
        embeddings: np.ndarray
    ) -> List[ClusterInfo]:
        """Generate cluster information including labels and tags (legacy method)"""
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
                child_cluster_ids=[],
                level=0,
                radius=0.0
            )
            
            cluster_infos.append(cluster_info)
        
        return cluster_infos
    
    def _create_hierarchical_tagged_messages(
        self,
        messages: List[Message],
        hierarchy: Dict,
        cluster_infos: List[ClusterInfo]
    ) -> List[MessageWithTags]:
        """Create output messages with tags for hierarchical structure"""
        # Build mapping from message index to sub-cluster
        msg_to_sub_cluster = hierarchy['message_to_sub_cluster']
        
        # Build cluster ID to tags mapping (use main cluster tags)
        main_cluster_tags = {
            info.cluster_id: info.tags
            for info in cluster_infos
            if info.level == 1
        }
        
        # Build sub-cluster to main cluster mapping
        sub_to_main = {}
        for main_id, main_cluster in hierarchy['main_clusters'].items():
            for child_id in main_cluster['child_ids']:
                sub_to_main[child_id] = main_id
        
        messages_with_tags = []
        for i, msg in enumerate(messages):
            # Get sub-cluster and main cluster
            sub_cluster_id = msg_to_sub_cluster.get(i)
            main_cluster_id = sub_to_main.get(sub_cluster_id) if sub_cluster_id else None
            
            # Use main cluster tags
            tags = main_cluster_tags.get(main_cluster_id, [])
            
            # Messages belong to their sub-cluster (not individual message nodes)
            tagged_msg = MessageWithTags(
                text=msg.text,
                channel=msg.channel,
                user=msg.user,
                timestamp=msg.timestamp,
                message_id=msg.message_id,
                tags=tags,
                cluster_id=sub_cluster_id  # Point to sub-cluster instead
            )
            messages_with_tags.append(tagged_msg)
        
        return messages_with_tags
    
    def _create_tagged_messages(
        self,
        messages: List[Message],
        cluster_labels: List[int],
        cluster_infos: List[ClusterInfo]
    ) -> List[MessageWithTags]:
        """Create output messages with tags (legacy method)"""
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

