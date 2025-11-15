#!/usr/bin/env python3
"""Small storage helpers: NDJSON writer and SQLite upsert helper."""
import os
import json
import sqlite3
from typing import Optional


def append_ndjson(out_path: str, record: dict):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def ensure_db(path: str = "out/messages.db") -> sqlite3.Connection:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    con = sqlite3.connect(path)
    cur = con.cursor()
    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      workspace_or_guild TEXT,
      channel_id TEXT,
      message_id TEXT,
      user_id TEXT,
      username TEXT,
      ts TEXT,
      text TEXT,
      attachments_json TEXT,
      reactions_json TEXT,
      raw_json TEXT,
      ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(platform, channel_id, message_id)
    )
    """
    )
    con.commit()
    return con


def upsert_message(con: sqlite3.Connection, record: dict):
    cur = con.cursor()
    cur.execute(
        """
    INSERT OR IGNORE INTO messages (platform, workspace_or_guild, channel_id, message_id, user_id, username, ts, text, attachments_json, reactions_json, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            record.get("platform"),
            record.get("workspace_or_guild"),
            record.get("channel_id"),
            record.get("message_id"),
            record.get("user_id"),
            record.get("username"),
            record.get("ts"),
            record.get("text"),
            json.dumps(record.get("attachments") or []),
            json.dumps(record.get("reactions") or {}),
            json.dumps(record.get("raw") or {}),
        ),
    )
    con.commit()
