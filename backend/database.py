"""Database operations for Supabase (Postgres) using supabase-py.

This module centralizes all DB interactions and includes retry logic.
"""
from __future__ import annotations


import json
import os
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from tenacity import retry, stop_after_attempt, wait_exponential
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

try:
    from supabase import create_client, Client
except Exception:  # pragma: no cover - supabase client may not be installed in test env
    create_client = None  # type: ignore

LOGGER = logging.getLogger("backend.database")

_client: Optional[Client] = None


def get_client() -> Optional[Any]:
    """Return a cached Supabase client instance or None if not configured.

    This function no longer raises when credentials are missing; callers should
    handle a None return value (no-op behavior is used elsewhere in this module).
    """
    global _client
    if _client is not None:
        return _client
    if not SUPABASE_URL or not SUPABASE_KEY:
        LOGGER.warning("Supabase credentials not set in environment; DB operations will be no-ops")
        return None
    if create_client is None:
        LOGGER.warning("supabase package not installed; DB operations will be no-ops")
        return None
    _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def insert_channel_if_not_exists(channel_id: str, name: str, platform: str) -> None:
    """Ensure the `channels` table has a row for this channel.

    Args:
        channel_id: channel identifier
        name: channel name
        platform: 'discord' or 'slack'
    """
    client = get_client()
    if client is None:
        LOGGER.info("Skipping insert_channel_if_not_exists: no supabase client configured")
        return
    try:
        # Upsert using PostgREST (Supabase) insert with on_conflict
        payload = {"id": channel_id, "name": name, "platform": platform, "created_at": datetime.utcnow().isoformat()}
        client.table("channels").insert(payload).execute()
    except Exception:
        # best-effort, ignore if insertion fails (channel may already exist)
        LOGGER.exception("Failed to insert channel %s", channel_id)
        return


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def insert_message(channel_id: str, user_hash: str, content: str, timestamp: str, metadata: Dict[str, Any]) -> None:
    """Insert a message record into Supabase `messages` table.

    Args:
        channel_id: Channel identifier
        user_hash: Hashed user id
        content: Message text
        timestamp: ISO-formatted timestamp
        metadata: JSON-serializable metadata
    """
    client = get_client()
    if client is None:
        LOGGER.info("Skipping insert_message: no supabase client configured")
        return
    try:
        payload = {
            "channel_id": channel_id,
            "user_id_hash": user_hash,
            "content": content,
            "timestamp": timestamp,
            "metadata": json.dumps(metadata),
        }
        client.table("messages").insert(payload).execute()
    except Exception:
        LOGGER.exception("Failed to insert message into channel %s", channel_id)
        raise


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def get_user_messages(user_hash: str) -> List[Dict[str, Any]]:
    """Return all messages for a given hashed user id.

    Args:
        user_hash: hashed user id

    Returns:
        List of message dicts
    """
    client = get_client()
    if client is None:
        LOGGER.info("get_user_messages: no supabase client configured")
        return []
    res = client.table("messages").select("*").eq("user_id_hash", user_hash).execute()
    return res.data or []


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def delete_user_messages(user_hash: str) -> int:
    """Archive and delete messages for a user. Returns number of deleted rows.

    Args:
        user_hash: hashed user id
    """
    client = get_client()
    if client is None:
        LOGGER.info("delete_user_messages: no supabase client configured")
        return 0
    # fetch rows to archive
    rows = client.table("messages").select("*").eq("user_id_hash", user_hash).execute().data or []
    if rows:
        # archive into a messages_archive table
        try:
            for r in rows:
                r.pop("id", None)
            client.table("messages_archive").insert(rows).execute()
        except Exception:
            LOGGER.exception("Failed to archive rows for user %s", user_hash)
        # delete original rows
        client.table("messages").delete().eq("user_id_hash", user_hash).execute()
        return len(rows)
    return 0


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def export_user_data(user_hash: str) -> List[Dict[str, Any]]:
    """Return user's messages as Python objects for export.

    Args:
        user_hash: hashed user id

    Returns:
        List of message dicts
    """
    rows = get_user_messages(user_hash)
    return rows


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def cleanup_old_messages(days: int = 90) -> int:
    """Archive and delete messages older than `days` days. Returns number deleted.

    Args:
        days: Retention window in days
    """
    client = get_client()
    if client is None:
        LOGGER.info("cleanup_old_messages: no supabase client configured")
        return 0
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    # fetch rows to archive
    rows = client.table("messages").select("*").lt("timestamp", cutoff).execute().data or []
    if rows:
        try:
            for r in rows:
                r.pop("id", None)
            client.table("messages_archive").insert(rows).execute()
        except Exception:
            LOGGER.exception("Failed to archive old messages")
        # delete
        client.table("messages").delete().lt("timestamp", cutoff).execute()
        return len(rows)
    return 0


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def get_retention_status() -> Dict[str, Any]:
    """Return a simple retention status summary.

    Returns:
        Dict with counts total and older-than-retention
    """
    client = get_client()
    if client is None:
        LOGGER.info("get_retention_status: no supabase client configured")
        return {"total": 0, "older_than_90_days": 0}
    total = client.table("messages").select("id", count="exact").execute()
    total_count = total.count if getattr(total, "count", None) is not None else (len(total.data) if total.data else 0)
    cutoff = (datetime.utcnow() - timedelta(days=90)).isoformat()
    old = client.table("messages").select("id").lt("timestamp", cutoff).execute().data or []
    return {"total": total_count, "older_than_90_days": len(old)}
