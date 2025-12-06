"""
Hierarchical clustering service for creating multi-level cluster structure
"""
import numpy as np
from typing import List, Dict, Tuple
from sklearn.cluster import AgglomerativeClustering
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HierarchicalClusteringService:
    """Creates hierarchical cluster structure for radial graph layout"""
    
    def __init__(
        self,
        main_cluster_threshold: float = 1.2,  # Lower = fewer main clusters
        sub_cluster_threshold: float = 0.6,   # For splitting main clusters
        min_main_cluster_size: int = 5,
        min_sub_cluster_size: int = 3,
        max_messages_per_sub_cluster: int = 15
    ):
        """
        Initialize hierarchical clustering service
        
        Args:
            main_cluster_threshold: Distance threshold for main clusters
            sub_cluster_threshold: Distance threshold for sub-clusters
            min_main_cluster_size: Minimum messages in main cluster
            min_sub_cluster_size: Minimum messages in sub-cluster
            max_messages_per_sub_cluster: Max messages before splitting into sub-clusters
        """
        self.main_cluster_threshold = main_cluster_threshold
        self.sub_cluster_threshold = sub_cluster_threshold
        self.min_main_cluster_size = min_main_cluster_size
        self.min_sub_cluster_size = min_sub_cluster_size
        self.max_messages_per_sub_cluster = max_messages_per_sub_cluster
        
        logger.info(f"Hierarchical clustering initialized with main_threshold={main_cluster_threshold}, "
                   f"sub_threshold={sub_cluster_threshold}")
    
    def create_hierarchy(
        self,
        embeddings: np.ndarray,
        message_ids: List[str]
    ) -> Dict[str, any]:
        """
        Create hierarchical cluster structure
        
        Returns:
            Dict with:
                - main_clusters: List of main cluster info
                - sub_clusters: List of sub-cluster info
                - message_clusters: List of individual message info
                - hierarchy_map: Mapping of parent-child relationships
        """
        n_messages = len(embeddings)
        logger.info(f"Creating hierarchy for {n_messages} messages")
        
        # Step 1: Create main clusters (Level 1)
        main_clusters, main_labels = self._create_main_clusters(embeddings, message_ids)
        logger.info(f"Created {len(main_clusters)} main clusters")
        
        # Step 2: Create sub-clusters within each main cluster (Level 2)
        sub_clusters = []
        message_to_sub_cluster = {}
        
        for main_id, main_cluster in main_clusters.items():
            main_msg_indices = main_cluster['message_indices']
            
            # If main cluster is small enough, don't split into sub-clusters
            if len(main_msg_indices) <= self.max_messages_per_sub_cluster:
                # Create single sub-cluster
                sub_id = f"{main_id}_sub_0"
                sub_cluster = {
                    'id': sub_id,
                    'parent_id': main_id,
                    'message_indices': main_msg_indices,
                    'message_ids': [message_ids[i] for i in main_msg_indices],
                    'centroid': main_cluster['centroid'],
                    'level': 2,
                    'radius': 300.0  # Fixed radius for sub-clusters
                }
                sub_clusters.append(sub_cluster)
                main_cluster['child_ids'] = [sub_id]
                
                # Map messages to sub-cluster
                for idx in main_msg_indices:
                    message_to_sub_cluster[idx] = sub_id
            else:
                # Split into sub-clusters
                main_embeddings = embeddings[main_msg_indices]
                sub_cluster_labels = self._cluster_level(
                    main_embeddings,
                    self.sub_cluster_threshold,
                    self.min_sub_cluster_size
                )
                
                # Group messages by sub-cluster
                sub_cluster_groups = {}
                for local_idx, sub_label in enumerate(sub_cluster_labels):
                    global_idx = main_msg_indices[local_idx]
                    if sub_label not in sub_cluster_groups:
                        sub_cluster_groups[sub_label] = []
                    sub_cluster_groups[sub_label].append(global_idx)
                
                # Create sub-cluster objects
                child_ids = []
                for sub_label, sub_msg_indices in sub_cluster_groups.items():
                    sub_id = f"{main_id}_sub_{sub_label}"
                    
                    # Calculate centroid
                    sub_embeddings = embeddings[sub_msg_indices]
                    centroid = np.mean(sub_embeddings, axis=0)
                    centroid = centroid / np.linalg.norm(centroid)
                    
                    sub_cluster = {
                        'id': sub_id,
                        'parent_id': main_id,
                        'message_indices': sub_msg_indices,
                        'message_ids': [message_ids[i] for i in sub_msg_indices],
                        'centroid': centroid,
                        'level': 2,
                        'radius': 300.0
                    }
                    sub_clusters.append(sub_cluster)
                    child_ids.append(sub_id)
                    
                    # Map messages to sub-cluster
                    for idx in sub_msg_indices:
                        message_to_sub_cluster[idx] = sub_id
                
                main_cluster['child_ids'] = child_ids
                
                logger.info(f"Split {main_id} into {len(child_ids)} sub-clusters")
        
        # Step 3: Create message nodes (Level 3)
        message_nodes = []
        for i, msg_id in enumerate(message_ids):
            sub_cluster_id = message_to_sub_cluster.get(i)
            if sub_cluster_id:
                message_nodes.append({
                    'id': f"msg_{msg_id}",
                    'message_id': msg_id,
                    'message_index': i,
                    'parent_id': sub_cluster_id,
                    'embedding': embeddings[i],
                    'level': 3,
                    'radius': 450.0  # Fixed radius for messages
                })
        
        logger.info(f"Created {len(sub_clusters)} sub-clusters and {len(message_nodes)} message nodes")
        
        return {
            'main_clusters': main_clusters,
            'sub_clusters': sub_clusters,
            'message_nodes': message_nodes,
            'main_labels': main_labels,
            'message_to_sub_cluster': message_to_sub_cluster
        }
    
    def _create_main_clusters(
        self,
        embeddings: np.ndarray,
        message_ids: List[str]
    ) -> Tuple[Dict, List[int]]:
        """Create top-level main clusters"""
        labels = self._cluster_level(
            embeddings,
            self.main_cluster_threshold,
            self.min_main_cluster_size
        )
        
        # Group messages by cluster
        cluster_groups = {}
        for idx, label in enumerate(labels):
            if label not in cluster_groups:
                cluster_groups[label] = []
            cluster_groups[label].append(idx)
        
        # Create cluster objects
        clusters = {}
        for cluster_id, message_indices in cluster_groups.items():
            # Calculate centroid
            cluster_embeddings = embeddings[message_indices]
            centroid = np.mean(cluster_embeddings, axis=0)
            centroid = centroid / np.linalg.norm(centroid)
            
            main_id = f"main_{cluster_id}"
            clusters[main_id] = {
                'id': main_id,
                'parent_id': None,
                'message_indices': message_indices,
                'message_ids': [message_ids[i] for i in message_indices],
                'centroid': centroid,
                'child_ids': [],
                'level': 1,
                'radius': 150.0  # Fixed radius for main clusters
            }
        
        return clusters, labels
    
    def _cluster_level(
        self,
        embeddings: np.ndarray,
        threshold: float,
        min_size: int
    ) -> List[int]:
        """Cluster at a specific level using distance threshold"""
        n = len(embeddings)
        
        if n < 2:
            return [0] * n
        
        # Compute distance matrix
        distances = 1 - np.dot(embeddings, embeddings.T)
        np.fill_diagonal(distances, 0)
        
        # Use agglomerative clustering
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=threshold,
            linkage='ward',
            metric='euclidean'
        )
        
        # Convert to appropriate format for ward linkage
        from scipy.spatial.distance import squareform
        condensed_distances = squareform(distances, checks=False)
        
        try:
            labels = clustering.fit_predict(embeddings)
        except Exception as e:
            logger.warning(f"Clustering failed: {e}, using single cluster")
            return [0] * n
        
        # Filter small clusters
        labels = self._filter_small_clusters(labels, min_size, n)
        
        return labels.tolist()
    
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


# Global instance
_hierarchical_service = None


def get_hierarchical_service() -> HierarchicalClusteringService:
    """Get or create the global hierarchical clustering service"""
    global _hierarchical_service
    if _hierarchical_service is None:
        _hierarchical_service = HierarchicalClusteringService()
    return _hierarchical_service

