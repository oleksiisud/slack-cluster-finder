"""
Supabase-based job storage for clustering jobs.
Prevents memory leaks by storing jobs in PostgreSQL instead of in-memory dictionaries.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from uuid import UUID

from tenacity import retry, stop_after_attempt, wait_exponential
from pydantic import BaseModel

from database import get_client

logger = logging.getLogger(__name__)


class SupabaseJobStorage:
    """
    Manages clustering job storage in Supabase (PostgreSQL).
    
    Features:
    - Persistent storage (survives server restarts)
    - Automatic cleanup of old jobs
    - Supports multiple servers
    - Transaction safety
    """
    
    def __init__(self, retention_hours: int = 48):
        """
        Initialize Supabase job storage.
        
        Args:
            retention_hours: How long to keep jobs before cleanup (default 48 hours)
        """
        self.client = get_client()
        self.retention_hours = retention_hours
        
        if self.client is None:
            logger.warning("Supabase client not configured. Job storage will fail.")
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def create_job(
        self,
        job_id: str,
        status: str = "processing",
        progress: float = 0.0,
        message: str = "",
        user_id: Optional[str] = None,
        distance_threshold: Optional[float] = None,
        min_cluster_size: Optional[int] = None,
        force_recluster: bool = False
    ) -> bool:
        """Create a new clustering job in the database."""
        if self.client is None:
            return False
        
        try:
            payload = {
                "job_id": job_id,
                "status": status,
                "progress": progress,
                "message": message,
                "user_id": user_id,
                "distance_threshold": distance_threshold,
                "min_cluster_size": min_cluster_size,
                "force_recluster": force_recluster
            }
            
            response = self.client.table("clustering_jobs").insert(payload).execute()
            logger.info(f"Created job {job_id} in database")
            return True
        except Exception as e:
            logger.error(f"Failed to create job {job_id}: {e}")
            return False
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def update_job_status(
        self,
        job_id: str,
        status: Optional[str] = None,
        progress: Optional[float] = None,
        message: Optional[str] = None
    ) -> bool:
        """Update job status, progress, or message."""
        if self.client is None:
            return False
        
        try:
            updates: Dict[str, Any] = {}
            if status is not None:
                updates["status"] = status
                if status == "completed":
                    updates["completed_at"] = datetime.utcnow().isoformat()
            if progress is not None:
                updates["progress"] = progress
            if message is not None:
                updates["message"] = message
            
            if not updates:
                return True
            
            response = self.client.table("clustering_jobs")\
                .update(updates)\
                .eq("job_id", job_id)\
                .execute()
            
            return True
        except Exception as e:
            logger.error(f"Failed to update job {job_id}: {e}")
            return False
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job by ID."""
        if self.client is None:
            return None
        
        try:
            response = self.client.table("clustering_jobs")\
                .select("*")\
                .eq("job_id", job_id)\
                .execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Failed to get job {job_id}: {e}")
            return None
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def save_result(self, job_id: str, result_data: Dict[str, Any]) -> bool:
        """Save clustering result for a job."""
        if self.client is None:
            return False
        
        try:
            payload = {
                "job_id": job_id,
                "result_data": result_data  # Supabase automatically handles JSONB
            }
            
            # Use upsert to handle both insert and update cases
            response = self.client.table("clustering_results")\
                .upsert(payload)\
                .execute()
            
            logger.info(f"Saved result for job {job_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to save result for job {job_id}: {e}")
            return False
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def get_result(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get clustering result by job ID."""
        if self.client is None:
            return None
        
        try:
            response = self.client.table("clustering_results")\
                .select("result_data")\
                .eq("job_id", job_id)\
                .execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]["result_data"]
            return None
        except Exception as e:
            logger.error(f"Failed to get result for job {job_id}: {e}")
            return None
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def cleanup_old_jobs(self, hours: Optional[int] = None) -> int:
        """
        Delete jobs older than specified hours.
        
        Args:
            hours: Retention period in hours (uses instance default if None)
            
        Returns:
            Number of jobs deleted
        """
        if self.client is None:
            return 0
        
        hours = hours or self.retention_hours
        
        try:
            # Call the PostgreSQL function
            response = self.client.rpc("cleanup_old_clustering_jobs", {
                "retention_hours": hours
            }).execute()
            
            deleted_count = response.data if response.data is not None else 0
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} old clustering jobs")
            
            return deleted_count
        except Exception as e:
            # Fallback: manual deletion if function doesn't exist
            logger.warning(f"RPC function not available, using manual cleanup: {e}")
            
            try:
                cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
                
                # Get jobs to delete
                old_jobs = self.client.table("clustering_jobs")\
                    .select("job_id")\
                    .lt("created_at", cutoff)\
                    .execute()
                
                job_ids = [job["job_id"] for job in (old_jobs.data or [])]
                
                if job_ids:
                    # Delete results first (due to foreign key)
                    self.client.table("clustering_results")\
                        .delete()\
                        .in_("job_id", job_ids)\
                        .execute()
                    
                    # Delete jobs
                    self.client.table("clustering_jobs")\
                        .delete()\
                        .in_("job_id", job_ids)\
                        .execute()
                    
                    logger.info(f"Manually cleaned up {len(job_ids)} old clustering jobs")
                    return len(job_ids)
                
                return 0
            except Exception as e2:
                logger.error(f"Manual cleanup also failed: {e2}")
                return 0
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def get_recent_jobs(self, limit: int = 10, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get recent jobs, optionally filtered by user.
        
        Args:
            limit: Maximum number of jobs to return
            user_id: Optional user ID to filter by
            
        Returns:
            List of job dictionaries
        """
        if self.client is None:
            return []
        
        try:
            query = self.client.table("clustering_jobs")\
                .select("*")\
                .order("created_at", desc=True)\
                .limit(limit)
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            response = query.execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get recent jobs: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Get storage statistics."""
        if self.client is None:
            return {
                "total_jobs": 0,
                "active_jobs": 0,
                "completed_jobs": 0,
                "error_jobs": 0,
                "storage_type": "supabase (not connected)"
            }
        
        try:
            # Count jobs by status
            all_jobs = self.client.table("clustering_jobs")\
                .select("status", count="exact")\
                .execute()
            
            total = all_jobs.count if hasattr(all_jobs, 'count') else len(all_jobs.data or [])
            
            active = self.client.table("clustering_jobs")\
                .select("job_id", count="exact")\
                .eq("status", "processing")\
                .execute()
            
            completed = self.client.table("clustering_jobs")\
                .select("job_id", count="exact")\
                .eq("status", "completed")\
                .execute()
            
            errors = self.client.table("clustering_jobs")\
                .select("job_id", count="exact")\
                .eq("status", "error")\
                .execute()
            
            return {
                "total_jobs": total,
                "active_jobs": len(active.data or []),
                "completed_jobs": len(completed.data or []),
                "error_jobs": len(errors.data or []),
                "storage_type": "supabase (postgresql)",
                "retention_hours": self.retention_hours
            }
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {
                "total_jobs": 0,
                "active_jobs": 0,
                "completed_jobs": 0,
                "error_jobs": 0,
                "storage_type": "supabase (error)",
                "error": str(e)
            }


# Global instance
_storage_instance: Optional[SupabaseJobStorage] = None


def get_job_storage() -> SupabaseJobStorage:
    """Get or create the global job storage instance."""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = SupabaseJobStorage()
    return _storage_instance

