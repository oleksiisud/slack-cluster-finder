"""
Clustering service using hierarchical clustering
"""
import numpy as np
from typing import List, Dict, Tuple, Optional
from sklearn.cluster import AgglomerativeClustering
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from scipy.spatial.distance import pdist, squareform
import logging
from config import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ClusteringService:
    """Service for hierarchical clustering of message embeddings"""
    
    def __init__(
        self,
        distance_threshold: Optional[float] = None,
        min_cluster_size: Optional[int] = None,
        random_seed: Optional[int] = None
    ):
        """
        Initialize clustering service
        
        Args:
            distance_threshold: Distance threshold for hierarchical clustering
            min_cluster_size: Minimum number of messages per cluster
            random_seed: Random seed for reproducibility
        """
        self.distance_threshold = distance_threshold or config.DISTANCE_THRESHOLD
        self.min_cluster_size = min_cluster_size or config.MIN_CLUSTER_SIZE
        self.random_seed = random_seed or config.RANDOM_SEED
        
        # Set random seed for reproducibility
        np.random.seed(self.random_seed)
        
        logger.info(f"Clustering service initialized with distance_threshold={self.distance_threshold}, "
                   f"min_cluster_size={self.min_cluster_size}")
    
    def cluster_messages(
        self,
        embeddings: np.ndarray,
        message_ids: List[str]
    ) -> Tuple[List[int], Dict[int, List[int]], np.ndarray]:
        """
        Perform hierarchical clustering on embeddings
        
        Args:
            embeddings: Matrix of embeddings (n_messages, embedding_dim)
            message_ids: List of message IDs corresponding to embeddings
            
        Returns:
            Tuple of (cluster_labels, cluster_to_messages, linkage_matrix)
        """
        n_messages = len(embeddings)
        
        if n_messages < 2:
            logger.warning("Too few messages for clustering")
            return [0] * n_messages, {0: list(range(n_messages))}, None
        
        logger.info(f"Clustering {n_messages} messages")
        
        # Compute distance matrix (using cosine distance)
        # Since embeddings are normalized, cosine distance = 1 - dot product
        distances = 1 - np.dot(embeddings, embeddings.T)
        np.fill_diagonal(distances, 0)  # Ensure diagonal is 0
        
        # Convert to condensed distance matrix for scipy
        condensed_distances = squareform(distances, checks=False)
        
        # Perform hierarchical clustering using ward linkage
        # Ward minimizes variance within clusters - good for text clustering
        linkage_matrix = linkage(
            condensed_distances,
            method='ward',
            optimal_ordering=False  # Disable for determinism
        )
        
        # Form flat clusters using distance threshold
        cluster_labels = fcluster(
            linkage_matrix,
            t=self.distance_threshold,
            criterion='distance'
        )
        
        # Convert to 0-indexed
        cluster_labels = cluster_labels - 1
        
        # Group messages by cluster
        cluster_to_messages = {}
        for idx, cluster_id in enumerate(cluster_labels):
            if cluster_id not in cluster_to_messages:
                cluster_to_messages[cluster_id] = []
            cluster_to_messages[cluster_id].append(idx)
        
        # Filter small clusters
        cluster_labels, cluster_to_messages = self._filter_small_clusters(
            cluster_labels,
            cluster_to_messages,
            n_messages
        )
        
        logger.info(f"Created {len(cluster_to_messages)} clusters")
        
        return cluster_labels.tolist(), cluster_to_messages, linkage_matrix
    
    def _filter_small_clusters(
        self,
        cluster_labels: np.ndarray,
        cluster_to_messages: Dict[int, List[int]],
        n_messages: int
    ) -> Tuple[np.ndarray, Dict[int, List[int]]]:
        """
        Filter out clusters that are too small
        
        Args:
            cluster_labels: Array of cluster labels
            cluster_to_messages: Mapping of cluster IDs to message indices
            n_messages: Total number of messages
            
        Returns:
            Filtered cluster_labels and cluster_to_messages
        """
        # Find clusters that meet minimum size
        valid_clusters = {
            cluster_id: messages
            for cluster_id, messages in cluster_to_messages.items()
            if len(messages) >= self.min_cluster_size
        }
        
        if not valid_clusters:
            # If no valid clusters, create one cluster with all messages
            logger.warning("No clusters meet minimum size requirement, creating single cluster")
            return np.zeros(n_messages, dtype=int), {0: list(range(n_messages))}
        
        # Create a mapping from old cluster IDs to new ones
        old_to_new = {old_id: new_id for new_id, old_id in enumerate(sorted(valid_clusters.keys()))}
        
        # Reassign labels
        new_labels = np.full(n_messages, -1, dtype=int)
        new_cluster_to_messages = {}
        
        for old_id, new_id in old_to_new.items():
            messages = cluster_to_messages[old_id]
            new_cluster_to_messages[new_id] = messages
            for msg_idx in messages:
                new_labels[msg_idx] = new_id
        
        # Assign unclustered messages (from small clusters) to nearest valid cluster
        unclustered_mask = new_labels == -1
        if np.any(unclustered_mask):
            logger.info(f"Reassigning {np.sum(unclustered_mask)} messages from small clusters")
            # For simplicity, assign to cluster 0 (could be improved with nearest neighbor)
            new_labels[unclustered_mask] = 0
            unclustered_indices = np.where(unclustered_mask)[0].tolist()
            new_cluster_to_messages[0].extend(unclustered_indices)
        
        return new_labels, new_cluster_to_messages
    
    def compute_cluster_centroids(
        self,
        embeddings: np.ndarray,
        cluster_to_messages: Dict[int, List[int]]
    ) -> Dict[int, np.ndarray]:
        """
        Compute centroid for each cluster
        
        Args:
            embeddings: Matrix of embeddings
            cluster_to_messages: Mapping of cluster IDs to message indices
            
        Returns:
            Dictionary mapping cluster IDs to centroid vectors
        """
        centroids = {}
        for cluster_id, message_indices in cluster_to_messages.items():
            cluster_embeddings = embeddings[message_indices]
            centroid = np.mean(cluster_embeddings, axis=0)
            # Normalize centroid
            centroid = centroid / np.linalg.norm(centroid)
            centroids[cluster_id] = centroid
        
        return centroids
    
    def build_hierarchy(
        self,
        linkage_matrix: np.ndarray,
        cluster_to_messages: Dict[int, List[int]],
        max_depth: int = 3
    ) -> Dict[int, Optional[int]]:
        """
        Build hierarchical structure from linkage matrix
        
        Args:
            linkage_matrix: Linkage matrix from hierarchical clustering
            cluster_to_messages: Mapping of cluster IDs to message indices
            max_depth: Maximum depth of hierarchy
            
        Returns:
            Dictionary mapping cluster IDs to parent cluster IDs
        """
        # For now, return flat hierarchy (no parents)
        # Can be extended to build multi-level hierarchy
        return {cluster_id: None for cluster_id in cluster_to_messages.keys()}
    
    def get_representative_messages(
        self,
        embeddings: np.ndarray,
        cluster_messages: List[int],
        centroid: np.ndarray,
        top_k: int = 5
    ) -> List[int]:
        """
        Get the most representative messages for a cluster
        
        Args:
            embeddings: Matrix of all embeddings
            cluster_messages: Indices of messages in this cluster
            centroid: Cluster centroid
            top_k: Number of representative messages to return
            
        Returns:
            List of message indices closest to centroid
        """
        if len(cluster_messages) <= top_k:
            return cluster_messages
        
        cluster_embeddings = embeddings[cluster_messages]
        similarities = np.dot(cluster_embeddings, centroid)
        
        top_k_local = np.argsort(similarities)[-top_k:][::-1]
        return [cluster_messages[i] for i in top_k_local]


# Global instance
_clustering_service: Optional[ClusteringService] = None


def get_clustering_service() -> ClusteringService:
    """Get or create the global clustering service instance"""
    global _clustering_service
    if _clustering_service is None:
        _clustering_service = ClusteringService()
    return _clustering_service

