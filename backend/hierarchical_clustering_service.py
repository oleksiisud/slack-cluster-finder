"""
Hierarchical clustering service for creating multi-level cluster structure
"""
import numpy as np
from typing import List, Dict, Tuple, Optional
from sklearn.cluster import AgglomerativeClustering
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HierarchicalClusteringService:
    """Creates hierarchical cluster structure for radial graph layout"""
    
    def __init__(
        self,
        max_clusters: int = 15,
        main_cluster_threshold: float = 1.2,  # Lower = fewer main clusters
        sub_cluster_threshold: float = 0.6,   # For splitting main clusters
        min_main_cluster_size: int = 5,
        min_sub_cluster_size: int = 3,
        max_messages_per_sub_cluster: int = 15
    ):
        """
        Initialize hierarchical clustering service
        
        Args:
            max_clusters: Maximum number of main clusters to create
            main_cluster_threshold: Distance threshold for main clusters
            sub_cluster_threshold: Distance threshold for sub-clusters
            min_main_cluster_size: Minimum messages in main cluster
            min_sub_cluster_size: Minimum messages in sub-cluster
            max_messages_per_sub_cluster: Max messages before splitting into sub-clusters
        """
        self.max_clusters = max_clusters
        self.main_cluster_threshold = main_cluster_threshold
        self.sub_cluster_threshold = sub_cluster_threshold
        self.min_main_cluster_size = min_main_cluster_size
        self.min_sub_cluster_size = min_sub_cluster_size
        self.max_messages_per_sub_cluster = max_messages_per_sub_cluster
        
        logger.info(f"Hierarchical clustering initialized with max_clusters={max_clusters}, "
                   f"main_threshold={main_cluster_threshold}, sub_threshold={sub_cluster_threshold}")
    
    def create_hierarchy(
        self,
        embeddings: np.ndarray,
        message_ids: List[str],
        messages: Optional[List] = None
    ) -> Dict[str, any]:
        """
        Create hierarchical cluster structure
        
        NEW APPROACH:
        Level 1: Conversations (grouped by channel + timestamp)
        Level 2: Topic clusters (semantic similarity of conversations)
        
        Returns:
            Dict with:
                - main_clusters: List of topic cluster info (Level 2)
                - sub_clusters: List of conversation info (Level 1)
                - hierarchy_map: Mapping of parent-child relationships
        """
        n_messages = len(embeddings)
        logger.info(f"Creating hierarchy for {n_messages} messages")
        
        # Step 1: Group messages into conversations FIRST (Level 1)
        if messages:
            conversation_groups = self._group_by_conversation(
                list(range(n_messages)), messages
            )
        else:
            # Fallback: treat each message as its own conversation
            conversation_groups = {i: [i] for i in range(n_messages)}
        
        logger.info(f"Grouped {n_messages} messages into {len(conversation_groups)} conversations")
        
        # Step 2: Create conversation objects (Level 1)
        conversations = []
        conversation_embeddings = []
        message_to_conversation = {}
        
        for conv_id, msg_indices in conversation_groups.items():
            conv_id_str = f"conv_{conv_id}"
            
            # Calculate conversation centroid (average of message embeddings)
            conv_emb = np.mean(embeddings[msg_indices], axis=0)
            conv_emb = conv_emb / np.linalg.norm(conv_emb)
            
            conversations.append({
                'id': conv_id_str,
                'message_indices': msg_indices,
                'message_ids': [message_ids[i] for i in msg_indices],
                'centroid': conv_emb,
                'level': 1
            })
            
            conversation_embeddings.append(conv_emb)
            
            # Map messages to conversation
            for idx in msg_indices:
                message_to_conversation[idx] = conv_id_str
        
        # Step 3: Cluster conversations by topic (Level 2)
        conversation_embeddings = np.array(conversation_embeddings)
        
        # Cluster conversations by semantic similarity
        if len(conversations) > 1:
            topic_labels = self._create_topic_clusters(conversation_embeddings, len(conversations))
        else:
            topic_labels = np.array([0])
        
        logger.info(f"Clustered {len(conversations)} conversations into {len(np.unique(topic_labels))} topic clusters")
        
        # Step 4: Group conversations by topic
        topic_clusters = {}
        for conv_idx, topic_id in enumerate(topic_labels):
            topic_id_str = f"topic_{topic_id}"
            if topic_id_str not in topic_clusters:
                topic_clusters[topic_id_str] = []
            topic_clusters[topic_id_str].append(conv_idx)
        
        # Create topic cluster objects
        main_clusters = {}
        for topic_id_str, conv_indices in topic_clusters.items():
            # Get all message indices for this topic
            all_msg_indices = []
            child_conv_ids = []
            for conv_idx in conv_indices:
                conv = conversations[conv_idx]
                all_msg_indices.extend(conv['message_indices'])
                child_conv_ids.append(conv['id'])
                # Update conversation parent
                conversations[conv_idx]['parent_id'] = topic_id_str
            
            # Calculate topic centroid
            topic_emb = np.mean(embeddings[all_msg_indices], axis=0)
            topic_emb = topic_emb / np.linalg.norm(topic_emb)
            
            main_clusters[topic_id_str] = {
                'id': topic_id_str,
                'parent_id': None,
                'message_indices': all_msg_indices,
                'message_ids': [message_ids[i] for i in all_msg_indices],
                'centroid': topic_emb,
                'child_ids': child_conv_ids,
                'level': 2,
                'radius': 150.0
            }
        
        logger.info(f"Created {len(main_clusters)} topic clusters containing {len(conversations)} conversations")
        
        return {
            'main_clusters': main_clusters,  # Topic clusters (Level 2)
            'sub_clusters': conversations,    # Conversations (Level 1)
            'message_to_sub_cluster': message_to_conversation
        }
    
    def _create_topic_clusters(
        self,
        conversation_embeddings: np.ndarray,
        n_conversations: int
    ) -> np.ndarray:
        """
        Cluster conversations by topic using semantic similarity.
        Returns cluster labels for each conversation as numpy array.
        
        Note: main_cluster_threshold (default 1.2) controls topic granularity.
        Lower values = fewer, broader topics; higher values = more, specific topics.
        """
        if n_conversations < 2:
            return np.array([0])
        
        # First, try with threshold-based clustering
        labels = self._cluster_level(
            conversation_embeddings,
            self.main_cluster_threshold,
            self.min_main_cluster_size
        )
        
        n_clusters = len(np.unique(labels))
        
        # If we have too many clusters, use n_clusters parameter instead
        if n_clusters > self.max_clusters:
            logger.info(f"Threshold produced {n_clusters} topic clusters, limiting to {self.max_clusters}")
            clustering = AgglomerativeClustering(
                n_clusters=self.max_clusters,
                linkage='ward'
            )
            labels = clustering.fit_predict(conversation_embeddings)
        
        return labels
    
    def _cluster_level(
        self,
        embeddings: np.ndarray,
        threshold: float,
        min_size: int
    ) -> np.ndarray:
        """Cluster at a specific level using distance threshold"""
        n = len(embeddings)
        
        if n < 2:
            return np.array([0] * n)
        
        # Use agglomerative clustering directly on embeddings
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=threshold,
            linkage='ward',
            metric='euclidean'
        )
        
        try:
            labels = clustering.fit_predict(embeddings)
        except Exception as e:
            logger.warning(f"Clustering failed: {e}, using single cluster")
            return np.array([0] * n)
        
        # Filter small clusters
        labels = self._filter_small_clusters(labels, min_size, n)
        
        return labels
    
    def _filter_small_clusters(
        self,
        labels: np.ndarray,
        min_size: int,
        n_messages: int
    ) -> np.ndarray:
        """Filter out clusters that are too small"""
        unique_labels = np.unique(labels)
        cluster_sizes = {label: np.sum(labels == label) for label in unique_labels}
        
        # Find valid clusters
        valid_clusters = {
            label for label, size in cluster_sizes.items()
            if size >= min_size
        }
        
        if not valid_clusters:
            # If no valid clusters, put all in one cluster
            return np.zeros(n_messages, dtype=int)
        
        # Reassign small clusters to nearest large cluster
        new_labels = np.copy(labels)
        for label in unique_labels:
            if label not in valid_clusters:
                # Assign to cluster 0 (or could use nearest neighbor)
                mask = labels == label
                new_labels[mask] = min(valid_clusters)
        
        # Renumber clusters to be continuous
        unique_new = sorted(np.unique(new_labels))
        label_map = {old: new for new, old in enumerate(unique_new)}
        final_labels = np.array([label_map[l] for l in new_labels])
        
        return final_labels
    
    def _group_by_conversation(
        self,
        message_indices: List[int],
        messages: List
    ) -> Dict[int, List[int]]:
        """
        Group messages into conversations based on channel and timestamp proximity.
        This prevents standalone responses/greetings from being separated.
        """
        from datetime import datetime
        
        # Sort messages by channel and timestamp
        msg_data = []
        for idx in message_indices:
            msg = messages[idx]
            try:
                # Parse timestamp
                if hasattr(msg, 'timestamp') and msg.timestamp:
                    ts = datetime.fromisoformat(msg.timestamp.replace('Z', '+00:00'))
                else:
                    ts = datetime.now()
            except:
                ts = datetime.now()
            
            channel = getattr(msg, 'channel', 'unknown')
            msg_data.append({
                'idx': idx,
                'channel': channel,
                'timestamp': ts,
                'text': getattr(msg, 'text', '')
            })
        
        # Sort by channel, then timestamp
        msg_data.sort(key=lambda x: (x['channel'], x['timestamp']))
        
        # Group into conversations (same channel, within time window)
        conversations = []
        current_conv = []
        current_channel = None
        last_timestamp = None
        time_gap_threshold = 3600  # 1 hour in seconds
        
        for msg in msg_data:
            # Start new conversation if channel changes or time gap is too large
            if (current_channel != msg['channel'] or 
                (last_timestamp and (msg['timestamp'] - last_timestamp).total_seconds() > time_gap_threshold)):
                if current_conv:
                    conversations.append(current_conv)
                current_conv = [msg['idx']]
                current_channel = msg['channel']
            else:
                current_conv.append(msg['idx'])
            
            last_timestamp = msg['timestamp']
        
        # Add last conversation
        if current_conv:
            conversations.append(current_conv)
        
        # Convert to dict format
        conversation_groups = {i: conv for i, conv in enumerate(conversations)}
        
        logger.info(f"Grouped {len(message_indices)} messages into {len(conversations)} conversations")
        
        return conversation_groups


# Global instance
_hierarchical_service = None


def get_hierarchical_service() -> HierarchicalClusteringService:
    """Get or create the global hierarchical clustering service"""
    global _hierarchical_service
    if _hierarchical_service is None:
        from config import config
        _hierarchical_service = HierarchicalClusteringService(
            max_clusters=config.MAX_CLUSTERS
        )
    return _hierarchical_service

