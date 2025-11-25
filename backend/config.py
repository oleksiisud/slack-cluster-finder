"""
Configuration settings for the clustering service
"""
import os
from typing import Optional

class Config:
    """Application configuration"""
    
    # API Keys
    HF_TOKEN = os.getenv("HF_TOKEN", "")  # Hugging Face API token
    
    # Model configurations
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    LLM_MODEL = os.getenv("LLM_MODEL", "meta-llama/Llama-3.2-3B-Instruct")
    
    # Clustering parameters
    # Higher MIN_CLUSTER_SIZE = fewer, more meaningful clusters
    MIN_CLUSTER_SIZE = int(os.getenv("MIN_CLUSTER_SIZE", "3"))
    # Lower MAX_CLUSTERS = fewer overall clusters
    MAX_CLUSTERS = int(os.getenv("MAX_CLUSTERS", "15"))
    # Higher DISTANCE_THRESHOLD = fewer, larger clusters (groups more similar messages together)
    DISTANCE_THRESHOLD = float(os.getenv("DISTANCE_THRESHOLD", "1.5"))
    
    # Server configuration
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))
    
    # CORS settings
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    
    # Cache settings
    ENABLE_CACHE = os.getenv("ENABLE_CACHE", "true").lower() == "true"
    CACHE_DIR = os.getenv("CACHE_DIR", "./cache")
    
    # Processing
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", "32"))
    MAX_WORKERS = int(os.getenv("MAX_WORKERS", "4"))
    
    # Random seed for deterministic clustering
    RANDOM_SEED = int(os.getenv("RANDOM_SEED", "42"))

config = Config()

