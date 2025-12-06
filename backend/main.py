"""
FastAPI backend for the clustering service
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from typing import Dict, Optional
import logging
import uuid
import httpx

from models import (
    ClusteringRequest, ClusteringOutput, ClusteringStatus,
    SearchRequest, SearchResult, MessageWithTags,
    SlackWorkspaceData
)
from cluster_orchestrator import get_orchestrator
from config import config
from slack_service import get_slack_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Chat Message Clustering API",
    description="AI-powered clustering service for chat messages",
    version="1.0.0"
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


# Slack OAuth endpoints
@app.get("/auth/slack")
async def slack_oauth_start():
    """Initiate Slack OAuth flow"""
    if not config.SLACK_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Slack OAuth not configured. Set SLACK_CLIENT_ID in environment."
        )
    
    from urllib.parse import urlencode
    
    # Build OAuth URL with proper encoding
    params = {
        "client_id": config.SLACK_CLIENT_ID,
        "scope": config.SLACK_OAUTH_SCOPES,
        "redirect_uri": config.SLACK_REDIRECT_URI
    }
    oauth_url = f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"
    
    return {"oauth_url": oauth_url}


@app.get("/auth/slack/callback")
async def slack_oauth_callback(code: str, error: Optional[str] = None):
    """Handle Slack OAuth callback"""
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    
    if not config.SLACK_CLIENT_ID or not config.SLACK_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Slack OAuth not configured"
        )
    
    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": config.SLACK_CLIENT_ID,
                "client_secret": config.SLACK_CLIENT_SECRET,
                "code": code,
                "redirect_uri": config.SLACK_REDIRECT_URI
            }
        )
        data = response.json()
    
    if not data.get("ok"):
        error_msg = f"Failed to exchange code: {data.get('error', 'Unknown error')}"
        logger.error(f"Slack OAuth error: {error_msg}")
        logger.error(f"Full Slack response: {data}")
        logger.error(f"Used redirect_uri: {config.SLACK_REDIRECT_URI}")
        raise HTTPException(
            status_code=400,
            detail=error_msg
        )
    
    # Return token and user info to frontend
    # In production, store this in database associated with user
    return {
        "access_token": data.get("authed_user", {}).get("access_token") or data.get("access_token"),
        "team_id": data.get("team", {}).get("id"),
        "team_name": data.get("team", {}).get("name"),
        "user_id": data.get("authed_user", {}).get("id")
    }


@app.get("/slack/workspaces", response_model=SlackWorkspaceData)
async def get_slack_workspaces(access_token: str):
    """Get Slack workspace data including channels and users"""
    if not access_token:
        raise HTTPException(
            status_code=400,
            detail="access_token query parameter required"
        )
    
    try:
        slack_service = get_slack_service(access_token)
        workspace_data = await slack_service.get_workspace_data()
        return workspace_data
    except Exception as e:
        logger.error(f"Error fetching workspace data: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch workspace data: {str(e)}"
        )


@app.post("/slack/extract")
async def extract_slack_messages(
    access_token: str,
    channel_ids: list[str],
    user_ids: Optional[list[str]] = None
):
    """Extract messages from selected Slack channels"""
    if not access_token:
        raise HTTPException(
            status_code=400,
            detail="access_token required"
        )
    
    if not channel_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one channel_id required"
        )
    
    try:
        slack_service = get_slack_service(access_token)
        
        all_messages = []
        for channel_id in channel_ids:
            messages = await slack_service.get_channel_messages(channel_id)
            
            # Filter by user if specified
            if user_ids:
                messages = [m for m in messages if m.get("user") in user_ids]
            
            all_messages.extend(messages)
        
        return {
            "status": "success",
            "message_count": len(all_messages),
            "messages": all_messages
        }
    
    except Exception as e:
        logger.error(f"Error extracting messages: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract messages: {str(e)}"
        )


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

