"""
FastAPI backend for the clustering service
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Optional
import logging
import uuid

from models import (
    ClusteringRequest, ClusteringOutput, ClusteringStatus,
    SearchRequest, SearchResult, MessageWithTags,
    SlackFetchRequest, SlackTestRequest, SlackTestResponse, Message
)
from cluster_orchestrator import get_orchestrator
from slack_service import SlackService
from config import config
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Chat Message Clustering API",
    description="AI-powered clustering service for chat messages",
    version="0.2.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Job storage (in production, use Redis or database)
jobs: Dict[str, ClusteringStatus] = {}
results: Dict[str, ClusteringOutput] = {}

@app.on_event("startup")
async def startup_event():
    """Warm up services on startup"""
    logger.info("Warming up Gemini services...")
    try:
        # Initialize services
        orchestrator = get_orchestrator()
        # Quick test to warm up API connection
        test_embedding = orchestrator.embedding_service.encode_messages(
            ["test message"],
            show_progress=False
        )
        logger.info("Services ready!")
    except Exception as e:
        logger.warning(f"Warmup failed: {e}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Chat Message Clustering API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/cluster", response_model=ClusteringOutput)
async def cluster_messages(request: ClusteringRequest):
    """
    Cluster messages and generate topic labels
    
    Args:
        request: Clustering request with messages and parameters
        
    Returns:
        ClusteringOutput with tagged messages and cluster info
    """
    try:
        logger.info(f"Received clustering request for {len(request.messages)} messages")
        
        if len(request.messages) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 messages required for clustering"
            )
        
        # Get orchestrator and process messages
        orchestrator = get_orchestrator()
        result = orchestrator.process_messages(
            messages=request.messages,
            force_recluster=request.force_recluster,
            distance_threshold=request.distance_threshold,
            min_cluster_size=request.min_cluster_size
        )
        
        logger.info(f"Clustering completed. Generated {len(result.clusters)} clusters.")
        
        return result
    
    except Exception as e:
        logger.error(f"Error during clustering: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cluster/async")
async def cluster_messages_async(
    request: ClusteringRequest,
    background_tasks: BackgroundTasks
):
    """
    Start clustering job in background
    
    Args:
        request: Clustering request
        background_tasks: FastAPI background tasks
        
    Returns:
        Job ID for tracking progress
    """
    job_id = str(uuid.uuid4())
    
    # Initialize job status
    jobs[job_id] = ClusteringStatus(
        status="processing",
        progress=0.0,
        message="Starting clustering job",
        job_id=job_id
    )
    
    # Add background task
    background_tasks.add_task(
        process_clustering_job,
        job_id,
        request
    )
    
    return {"job_id": job_id, "status": "started"}


async def process_clustering_job(job_id: str, request: ClusteringRequest):
    """Background task for clustering"""
    try:
        jobs[job_id].message = "Processing messages..."
        jobs[job_id].progress = 10.0
        
        orchestrator = get_orchestrator()
        
        jobs[job_id].message = "Generating embeddings..."
        jobs[job_id].progress = 30.0
        
        result = orchestrator.process_messages(
            messages=request.messages,
            force_recluster=request.force_recluster,
            distance_threshold=request.distance_threshold,
            min_cluster_size=request.min_cluster_size
        )
        
        jobs[job_id].message = "Clustering complete"
        jobs[job_id].progress = 100.0
        jobs[job_id].status = "completed"
        
        results[job_id] = result
        
    except Exception as e:
        logger.error(f"Error in background job {job_id}: {e}", exc_info=True)
        jobs[job_id].status = "error"
        jobs[job_id].message = str(e)


@app.get("/cluster/status/{job_id}", response_model=ClusteringStatus)
async def get_job_status(job_id: str):
    """Get status of a clustering job"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return jobs[job_id]


@app.get("/cluster/result/{job_id}", response_model=ClusteringOutput)
async def get_job_result(job_id: str):
    """Get result of a completed clustering job"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if jobs[job_id].status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed. Current status: {jobs[job_id].status}"
        )
    
    if job_id not in results:
        raise HTTPException(status_code=404, detail="Result not found")
    
    return results[job_id]


@app.post("/search", response_model=list[SearchResult])
async def search_messages(request: SearchRequest):
    """
    Search messages by semantic similarity
    
    Args:
        request: Search request with query and filters
        
    Returns:
        List of search results
    """
    try:
        # This endpoint requires messages to be provided or stored
        # For now, return error - in production, integrate with database
        raise HTTPException(
            status_code=501,
            detail="Search endpoint requires integration with message storage"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/models/info")
async def get_models_info():
    """Get information about loaded models"""
    orchestrator = get_orchestrator()
    
    return {
        "embedding_model": {
            "name": orchestrator.embedding_service.model_name,
            "dimension": orchestrator.embedding_service.embedding_dim
        },
        "llm_model": {
            "name": orchestrator.label_service.model_name
        },
        "clustering_params": {
            "distance_threshold": config.DISTANCE_THRESHOLD,
            "min_cluster_size": config.MIN_CLUSTER_SIZE
        }
    }


@app.post("/cache/clear")
async def clear_cache():
    """Clear the clustering cache"""
    import os
    import shutil
    
    if os.path.exists(config.CACHE_DIR):
        shutil.rmtree(config.CACHE_DIR)
        os.makedirs(config.CACHE_DIR)
        return {"status": "success", "message": "Cache cleared"}
    
    return {"status": "success", "message": "Cache was already empty"}


@app.post("/slack/test", response_model=SlackTestResponse)
async def test_slack_connection(request: SlackTestRequest):
    """
    Test Slack API connection with provided token
    
    Args:
        request: Slack test request with user token
        
    Returns:
        Connection status and user info
    """
    try:
        slack_service = SlackService(request.user_token)
        result = slack_service.test_connection()
        return SlackTestResponse(**result)
    
    except Exception as e:
        logger.error(f"Error testing Slack connection: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/slack/fetch", response_model=list[Message])
async def fetch_slack_messages(request: SlackFetchRequest):
    """
    Fetch messages from Slack workspace
    
    Args:
        request: Slack fetch request with token and options
        
    Returns:
        List of messages in standard format
    """
    try:
        logger.info(f"Fetching Slack messages (public={request.include_public}, "
                   f"private={request.include_private}, dms={request.include_dms})")
        
        slack_service = SlackService(request.user_token)
        
        # Test connection first
        connection_test = slack_service.test_connection()
        if not connection_test.get('ok'):
            raise HTTPException(
                status_code=401,
                detail=f"Slack authentication failed: {connection_test.get('error')}"
            )
        
        # Fetch messages
        raw_messages = slack_service.fetch_all_messages(
            include_public=request.include_public,
            include_private=request.include_private,
            include_dms=request.include_dms,
            include_permalinks=request.include_permalinks
        )
        
        # Convert to Message format
        formatted_messages = []
        for msg in raw_messages:
            if not msg.get('text'):  # Skip empty messages
                continue
            
            try:
                formatted_msg = Message(
                    text=msg['text'],
                    channel=msg.get('channel_name', msg.get('channel_id', 'unknown')),
                    user=msg.get('user', 'unknown'),
                    timestamp=datetime.now().isoformat(),  # Use current time as placeholder
                    message_id=msg.get('message_link', None)
                )
                formatted_messages.append(formatted_msg)
            except Exception as e:
                logger.warning(f"Failed to format message: {e}")
                continue
        
        logger.info(f"Successfully formatted {len(formatted_messages)} messages")
        
        return formatted_messages
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Slack messages: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting server on {config.HOST}:{config.PORT}")
    
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
        log_level="info"
    )

