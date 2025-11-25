from __future__ import annotations

import os
import hmac
import hashlib
import time
import json
from typing import Any, Dict

from fastapi import FastAPI, Request, Header, HTTPException
from pydantic import BaseModel

from . import database

app = FastAPI()

SLACK_SIGNING_SECRET = os.getenv("SLACK_SIGNING_SECRET", "")
FORWARD_SECRET = os.getenv("FORWARD_SECRET", "")
HASH_SALT = os.getenv("HASH_SALT", "dev-salt")


def verify_slack_signature(body: bytes, timestamp: str, signature: str) -> bool:
    # Prevent replay attacks
    try:
        ts = int(timestamp)
    except Exception:
        return False
    if abs(time.time() - ts) > 60 * 5:
        return False
    basestring = b"v0:" + timestamp.encode("utf-8") + b":" + body
    computed = "v0=" + hmac.new(SLACK_SIGNING_SECRET.encode("utf-8"), basestring, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)


def hash_user(user_id: str) -> str:
    h = hashlib.sha256()
    h.update(HASH_SALT.encode("utf-8"))
    h.update(user_id.encode("utf-8"))
    return h.hexdigest()


class DiscordPayload(BaseModel):
    platform: str
    channel_id: str
    user_id: str
    content: str
    timestamp: str
    raw: Dict[str, Any]


@app.post("/webhook/slack")
async def slack_webhook(request: Request, x_slack_request_timestamp: str = Header(None), x_slack_signature: str = Header(None)):
    body = await request.body()
    if not SLACK_SIGNING_SECRET:
        raise HTTPException(status_code=500, detail="SLACK_SIGNING_SECRET not configured")
    if not verify_slack_signature(body, x_slack_request_timestamp or "0", x_slack_signature or ""):
        raise HTTPException(status_code=401, detail="Invalid Slack signature")
    payload = await request.json()
    # URL verification challenge
    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}

    event = payload.get("event", {})
    if event.get("type") != "message":
        return {"ok": True}

    # ignore bot messages
    if event.get("subtype") == "bot_message" or event.get("bot_id"):
        return {"ok": True}

    user = event.get("user")
    user_hash = hash_user(user) if user else None
    channel = event.get("channel")
    ts = event.get("ts")
    text = event.get("text", "")

    metadata = {"raw": event}
    # best-effort insert into Supabase via backend.database
    try:
        database.insert_message(channel_id=channel, user_hash=user_hash, content=text, timestamp=ts, metadata=metadata)
    except Exception:
        # swallow to avoid blocking Slack retries; log on server side if desired
        pass

    # append raw backup
    try:
        os.makedirs("out", exist_ok=True)
        with open("out/slack_webhooks.ndjson", "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"platform": "slack", "channel_id": channel, "ts": ts, "user_hash": user_hash, "text": text, "raw": event}, ensure_ascii=False) + "\n")
    except Exception:
        pass

    return {"ok": True}


@app.post("/webhook/discord")
async def discord_webhook(payload: DiscordPayload, x_forward_secret: str = Header(None)):
    if FORWARD_SECRET:
        if not x_forward_secret or not hmac.compare_digest(FORWARD_SECRET, x_forward_secret):
            raise HTTPException(status_code=401, detail="Invalid forward secret")

    user_hash = hash_user(payload.user_id) if payload.user_id else None

    try:
        database.insert_message(channel_id=payload.channel_id, user_hash=user_hash, content=payload.content, timestamp=payload.timestamp, metadata={"raw": payload.raw})
    except Exception:
        pass

    try:
        os.makedirs("out", exist_ok=True)
        with open("out/discord_webhooks.ndjson", "a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload.dict(), ensure_ascii=False) + "\n")
    except Exception:
        pass

    return {"ok": True}
