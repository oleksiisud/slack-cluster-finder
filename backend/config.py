"""
Configuration settings for the clustering service
"""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration"""
    
    # API Keys
    HF_TOKEN = os.getenv("HF_TOKEN", "")  # Hugging Face API token
    
    # Model configurations
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    LLM_MODEL = os.getenv("LLM_MODEL", "meta-llama/Llama-3.2-3B-Instruct")
    
    # Clustering parameters
    MIN_CLUSTER_SIZE = int(os.getenv("MIN_CLUSTER_SIZE", "2"))
    MAX_CLUSTERS = int(os.getenv("MAX_CLUSTERS", "50"))
    DISTANCE_THRESHOLD = float(os.getenv("DISTANCE_THRESHOLD", "1.0"))
    
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
    
    # Slack OAuth configuration
    SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID", "")
    SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET", "")
    SLACK_REDIRECT_URI = os.getenv("SLACK_REDIRECT_URI", "http://localhost:5173/slack/callback")
    SLACK_OAUTH_SCOPES = os.getenv("SLACK_OAUTH_SCOPES", "channels:read,channels:history,groups:read,groups:history,users:read,team:read")

config = Config()

