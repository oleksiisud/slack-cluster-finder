"""
Data models for the clustering service
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class Message(BaseModel):
    """Input message model"""
    text: str = Field(..., description="The message content")
    channel: str = Field(..., description="Channel identifier")
    user: str = Field(..., description="User identifier")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    message_id: Optional[str] = Field(None, description="Optional unique message ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Has anyone used pandas for data analysis?",
                "channel": "general",
                "user": "user_123",
                "timestamp": "2025-11-14T17:00:00Z"
            }
        }

class MessageWithTags(BaseModel):
    """Output message model with generated tags"""
    text: str
    channel: str
    user: str
    timestamp: str
    message_id: str
    tags: List[str] = Field(default_factory=list, description="Generated topic tags")
    cluster_id: Optional[str] = Field(None, description="Assigned cluster ID")
    embedding: Optional[List[float]] = Field(None, description="Message embedding vector (optional)")

class ClusterInfo(BaseModel):
    """Information about a single cluster"""
    cluster_id: str = Field(..., description="Unique cluster identifier")
    label: str = Field(..., description="Human-readable cluster label")
    tags: List[str] = Field(default_factory=list, description="Topic tags in this cluster")
    message_ids: List[str] = Field(default_factory=list, description="IDs of messages in this cluster")
    size: int = Field(..., description="Number of messages in cluster")
    centroid: Optional[List[float]] = Field(None, description="Cluster centroid in embedding space")
    parent_cluster_id: Optional[str] = Field(None, description="Parent cluster for hierarchical structure")
    child_cluster_ids: List[str] = Field(default_factory=list, description="Child clusters")

class ClusteringOutput(BaseModel):
    """Complete clustering output"""
    messages: List[MessageWithTags] = Field(..., description="Messages with tags")
    clusters: List[ClusterInfo] = Field(..., description="Cluster information")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata about the clustering run")

class ClusteringRequest(BaseModel):
    """Request model for clustering operation"""
    messages: List[Message] = Field(..., description="List of messages to cluster")
    force_recluster: bool = Field(False, description="Force re-clustering even if cached")
    distance_threshold: Optional[float] = Field(None, description="Override default distance threshold")
    min_cluster_size: Optional[int] = Field(None, description="Override minimum cluster size")

class ClusteringStatus(BaseModel):
    """Status of a clustering operation"""
    status: str = Field(..., description="Status: processing, completed, error")
    progress: float = Field(0.0, description="Progress percentage (0-100)")
    message: str = Field("", description="Status message")
    job_id: Optional[str] = Field(None, description="Job identifier")

class SearchRequest(BaseModel):
    """Request model for searching messages"""
    query: str = Field(..., description="Search query")
    top_k: int = Field(10, description="Number of results to return")
    filter_tags: Optional[List[str]] = Field(None, description="Filter by specific tags")
    filter_clusters: Optional[List[str]] = Field(None, description="Filter by specific clusters")

class SearchResult(BaseModel):
    """Single search result"""
    message: MessageWithTags
    similarity_score: float = Field(..., description="Similarity score to query")
    rank: int = Field(..., description="Result rank")
