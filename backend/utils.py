"""Utility helpers for hashing and metadata extraction."""
from __future__ import annotations

import hashlib
from typing import Any, Dict


def hash_user_id(user_id: str) -> str:
    """Return a SHA-256 hash of the provided user id.

    Args:
        user_id: The original user identifier (string).

    Returns:
        Hexadecimal SHA-256 digest as a string.
    """
    if user_id is None:
        return ""
    h = hashlib.sha256()
    h.update(user_id.encode("utf-8"))
    return h.hexdigest()


def extract_metadata_from_discord(message: Any) -> Dict[str, Any]:
    """Extract lightweight metadata from a discord.Message object.

    Args:
        message: discord.Message-like object.

    Returns:
        A dict with counts and thread/reaction data.
    """
    try:
        attachments = [a.url for a in getattr(message, "attachments", [])]
        reactions = [str(r.emoji) for r in getattr(message, "reactions", [])]
        thread_parent = None
        if getattr(message, "reference", None):
            thread_parent = getattr(message.reference, "message_id", None)
        return {
            "attachments_count": len(attachments),
            "attachments": attachments,
            "reactions": reactions,
            "thread_parent": thread_parent,
        }
    except Exception:
        return {"attachments_count": 0, "attachments": [], "reactions": [], "thread_parent": None}


def extract_metadata_from_slack(event: Dict[str, Any]) -> Dict[str, Any]:
    """Extract metadata from a Slack event payload.

    Args:
        event: The Slack message event dict.

    Returns:
        Dict containing attachments count, thread info and reactions if present.
    """
    attachments = event.get("files", []) or []
    reactions = []
    if "reactions" in event:
        reactions = [r.get("name") for r in event.get("reactions", [])]
    thread_ts = event.get("thread_ts")
    return {
        "attachments_count": len(attachments),
        "attachments": [f.get("url_private") for f in attachments if isinstance(f, dict)],
        "reactions": reactions,
        "thread_parent": thread_ts,
    }
