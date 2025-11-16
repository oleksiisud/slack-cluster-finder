"""
Embedding generation service using Sentence Transformers
"""
import torch
import numpy as np
from typing import List, Optional
from sentence_transformers import SentenceTransformer
from config import config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating embeddings from text"""
    
    def __init__(self, model_name: Optional[str] = None):
        """
        Initialize the embedding service
        
        Args:
            model_name: Name of the sentence transformer model to use
        """
        self.model_name = model_name or config.EMBEDDING_MODEL
        logger.info(f"Loading embedding model: {self.model_name}")
        
        # Load model with deterministic settings
        torch.manual_seed(config.RANDOM_SEED)
        np.random.seed(config.RANDOM_SEED)
        
        self.model = SentenceTransformer(self.model_name)
        self.model.eval()  # Set to evaluation mode
        
        # Set deterministic behavior
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
        
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        logger.info(f"Model loaded. Embedding dimension: {self.embedding_dim}")
    
    def encode_messages(
        self, 
        texts: List[str], 
        batch_size: Optional[int] = None,
        show_progress: bool = False
    ) -> np.ndarray:
        """
        Generate embeddings for a list of texts
        
        Args:
            texts: List of text strings to embed
            batch_size: Batch size for processing
            show_progress: Whether to show progress bar
            
        Returns:
            numpy array of embeddings with shape (len(texts), embedding_dim)
        """
        if not texts:
            return np.array([])
        
        batch_size = batch_size or config.BATCH_SIZE
        
        logger.info(f"Encoding {len(texts)} messages with batch size {batch_size}")
        
        # Ensure deterministic encoding
        with torch.no_grad():
            embeddings = self.model.encode(
                texts,
                batch_size=batch_size,
                show_progress_bar=show_progress,
                convert_to_numpy=True,
                normalize_embeddings=True  # Normalize for cosine similarity
            )
        
        logger.info(f"Generated embeddings with shape {embeddings.shape}")
        return embeddings
    
    def encode_single(self, text: str) -> np.ndarray:
        """
        Generate embedding for a single text
        
        Args:
            text: Text string to embed
            
        Returns:
            numpy array embedding
        """
        with torch.no_grad():
            embedding = self.model.encode(
                text,
                convert_to_numpy=True,
                normalize_embeddings=True
            )
        return embedding
    
    def compute_similarity(
        self, 
        embedding1: np.ndarray, 
        embedding2: np.ndarray
    ) -> float:
        """
        Compute cosine similarity between two embeddings
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Cosine similarity score
        """
        return float(np.dot(embedding1, embedding2))
    
    def find_similar(
        self, 
        query_embedding: np.ndarray,
        corpus_embeddings: np.ndarray,
        top_k: int = 10
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Find most similar embeddings in corpus
        
        Args:
            query_embedding: Query embedding vector
            corpus_embeddings: Matrix of corpus embeddings
            top_k: Number of results to return
            
        Returns:
            Tuple of (scores, indices) for top k results
        """
        # Compute cosine similarities
        similarities = np.dot(corpus_embeddings, query_embedding)
        
        # Get top k indices
        top_k = min(top_k, len(similarities))
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        top_scores = similarities[top_indices]
        
        return top_scores, top_indices


# Global instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the global embedding service instance"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service

