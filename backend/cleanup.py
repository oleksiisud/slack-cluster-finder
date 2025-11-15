"""Scheduled cleanup job for data retention enforcement."""
from __future__ import annotations

import logging
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler

from .database import cleanup_old_messages

LOGGER = logging.getLogger("cleanup")


def run_cleanup_once(days: int = 90) -> int:
    """Run the retention cleanup once and return number of deleted rows.

    Args:
        days: retention window in days
    Returns:
        Number of messages cleaned up.
    """
    try:
        count = cleanup_old_messages(days=days)
        LOGGER.info("Cleanup removed %s messages older than %s days", count, days)
        return count
    except Exception as e:
        LOGGER.exception("Cleanup failed: %s", e)
        return 0


def schedule_cleanup(hour_interval: int = 24) -> BackgroundScheduler:
    """Schedule cleanup to run periodically.

    Args:
        hour_interval: run frequency in hours

    Returns:
        The scheduler instance (already started).
    """
    scheduler = BackgroundScheduler()
    scheduler.add_job(lambda: run_cleanup_once(90), "interval", hours=hour_interval)
    scheduler.start()
    LOGGER.info("Scheduled cleanup every %s hours", hour_interval)
    return scheduler


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, filename="logs/cleanup.log", filemode="a")
    run_cleanup_once(90)
