"""
FastAPI backend for the clustering service
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Optional
from supabase_job_storage import get_job_storage
import logging
import uuid

from models import (
    ClusteringRequest, ClusteringOutput, ClusteringStatus,
    SearchRequest, SearchResult, MessageWithTags,
    SlackFetchRequest, SlackTestRequest, SlackTestResponse, 
    DiscordFetchRequest, DiscordTestRequest, DiscordTestResponse,
    Message
)
from cluster_orchestrator import get_orchestrator
from slack_service import SlackService
from discord_service import DiscordService
from config import config
from slack_oauth import router as slack_oauth_router
from discord_oauth import router as discord_oauth_router
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

# Include OAuth routers
app.include_router(slack_oauth_router)
app.include_router(discord_oauth_router)

# Job storage (in production, use Redis or database)
#jobs: Dict[str, ClusteringStatus] = {}
#results: Dict[str, ClusteringOutput] = {}
storage = get_job_storage()

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
        # Validate the embedding result
        if test_embedding is None or len(test_embedding) == 0:
            raise ValueError("Embedding service returned empty result")
        logger.info("Services ready!")
    except (ValueError, RuntimeError, ConnectionError) as e:
        logger.warning(f"Warmup failed ({type(e).__name__}): {e}")
    except Exception as e:
        logger.warning(f"Warmup failed with unexpected error ({type(e).__name__}): {e}")
    storage.cleanup_old_jobs()

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
    # jobs[job_id] = ClusteringStatus(
    #     status="processing",
    #     progress=0.0,
    #     message="Starting clustering job",
    #     job_id=job_id
    # )
    storage.create_job(
        job_id=job_id,
        status="processing",
        progress=0.0,
        message="Starting clustering job",
        distance_threshold=request.distance_threshold,
        min_cluster_size=request.min_cluster_size,
        force_recluster=request.force_recluster
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
        # jobs[job_id].message = "Processing messages..."
        # jobs[job_id].progress = 10.0
        storage.update_job_status(
            job_id=job_id,
            message="Processing messages...",
            progress=10.0
        )
        
        orchestrator = get_orchestrator()
        
        # jobs[job_id].message = "Generating embeddings..."
        # jobs[job_id].progress = 30.0
        storage.update_job_status(
            job_id=job_id,
            message="Generating embeddings...",
            progress=30.0
        )
        
        result = orchestrator.process_messages(
            messages=request.messages,
            force_recluster=request.force_recluster,
            distance_threshold=request.distance_threshold,
            min_cluster_size=request.min_cluster_size
        )
        
        # jobs[job_id].message = "Clustering complete"
        # jobs[job_id].progress = 100.0
        #jobs[job_id].status = "completed"
        #results[job_id] = result
        storage.save_result(job_id, result.dict())
        storage.update_job_status(
            job_id=job_id,
            message="Clustering complete",
            progress=100.0,
            status="completed"
        )
        
    except Exception as e:
        logger.error(f"Error in background job {job_id}: {e}", exc_info=True)
        # jobs[job_id].status = "error"
        # jobs[job_id].message = str(e)
        storage.update_job_status(
            job_id=job_id,
            message=str(e),
            status="error"
        )


@app.get("/cluster/status/{job_id}", response_model=ClusteringStatus)
async def get_job_status(job_id: str):
    """Get status of a clustering job"""
    # if job_id not in jobs:
    job_data = storage.get_job(job_id)
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    
    # return jobs[job_id]
    job_data = storage.get_job(job_id)
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    return ClusteringStatus(**job_data)


@app.get("/cluster/result/{job_id}", response_model=ClusteringOutput)
async def get_job_result(job_id: str):
    """Get result of a completed clustering job"""
    # if job_id not in jobs:
    job_data = storage.get_job(job_id)
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    
    # if jobs[job_id].status != "completed":
    if job_data["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed. Current status: {job_data["status"]}"
        )
    
    # if job_id not in results:
    #    raise HTTPException(status_code=404, detail="Result not found")
    # return results[job_id]
    result_data = storage.get_result(job_id)
    if not result_data:
        raise HTTPException(status_code=404, detail="Result not found or expired")
    return ClusteringOutput(**result_data)


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
        orchestrator = get_orchestrator()
        
        # If messages are provided in request (not ideal but works for small batches)
        # In a real app, we'd use a job_id or session_id to retrieve stored messages
        if not request.messages_with_tags:
             # Fallback: check if we have a recent result in memory (simple stateful approach)
             # This is a hack for the demo; in prod use a DB
             
            #  if results:
            #      last_job_id = list(results.keys())[-1]
            #      request.messages_with_tags = results[last_job_id].messages
             recent_jobs = storage.get_recent_jobs(limit=1)
             if recent_jobs:
                result_data = storage.get_result(recent_jobs[0]["job_id"])
                if result_data:
                    request.messages_with_tags = [
                        MessageWithTags(**msg) for msg in result_data.get("messages", [])
                    ]
             else:
                raise HTTPException(
                    status_code=400, 
                    detail="No context provided for search. Please run clustering first."
                )

        results_tuples = orchestrator.search_messages(
            query=request.query,
            messages_with_tags=request.messages_with_tags,
            filter_tags=request.filter_tags,
            filter_clusters=request.filter_clusters,
            top_k=request.top_k
        )
        
        # Convert tuples to SearchResult objects
        search_results = [
            SearchResult(
                message=msg,
                score=score
            )
            for msg, score in results_tuples
        ]
        
        return search_results
    
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


@app.post("/admin/cleanup-jobs")
async def cleanup_old_jobs():
    """Manually trigger cleanup of old jobs (>48 hours)"""
    deleted_count = storage.cleanup_old_jobs()
    return {
        "status": "success",
        "deleted_jobs": deleted_count,
        "message": f"Cleaned up {deleted_count} old jobs"
    }


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

