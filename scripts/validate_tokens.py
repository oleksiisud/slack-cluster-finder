#!/usr/bin/env python3
"""Validate Slack and Discord tokens non-destructively.

This script loads environment variables from a local `.env` (if present)
and performs the same lightweight checks used earlier:
- Slack: calls `auth.test` with the bot token
- Slack app token: checks prefix `xapp-`
- Discord: GET /users/@me with the bot token

It prints short, human-readable results and never echoes tokens.
"""
import os
import json
import sys
import ssl
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

try:
    # optional, but commonly installed in this project
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    # no dotenv installed or failed to load; fall back to environment only
    pass


def http_request(url: str, method: str = "GET", headers: Optional[Dict[str, str]] = None, data: Optional[bytes] = None, timeout: int = 10):
    req = urllib.request.Request(url, data=data, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = resp.read()
            try:
                return resp.getcode(), json.loads(body.decode())
            except Exception:
                return resp.getcode(), body.decode(errors="replace")
    except urllib.error.HTTPError as he:
        try:
            body = he.read().decode()
            return he.code, json.loads(body)
        except Exception:
            return he.code, str(he)
    except Exception as e:
        return None, str(e)


def check_slack(bot_token: Optional[str], app_token: Optional[str]):
    print("Slack token checks:")
    if not bot_token:
        print("  - SLACK_BOT_TOKEN: MISSING in environment")
    else:
        code, resp = http_request(
            "https://slack.com/api/auth.test",
            method="POST",
            headers={"Authorization": f"Bearer {bot_token}"},
        )
        if code is None:
            print(f"  - SLACK_BOT_TOKEN: request failed: {resp}")
        else:
            # resp is a dict usually
            if isinstance(resp, dict) and resp.get("ok"):
                # Accept both classic bot tokens (xoxb-) and new granular tokens (xoxe-)
                prefix = (bot_token or '')[:5]
                print(f"  - SLACK_BOT_TOKEN: OK (token prefix: {prefix}; bot user id: {resp.get('user_id')})")
            else:
                err = resp.get("error") if isinstance(resp, dict) else resp
                print(f"  - SLACK_BOT_TOKEN: NOT AUTHORIZED ({err})")

    if not app_token:
        print("  - SLACK_APP_TOKEN: MISSING in environment")
    else:
        if app_token.startswith("xapp-"):
            print("  - SLACK_APP_TOKEN: looks like an app-level token (prefix xapp-)")
        else:
            print("  - SLACK_APP_TOKEN: does NOT look like an app-level token (expected prefix xapp-). Socket Mode will fail with not_allowed_token_type if this is a bot token.")


def check_discord(bot_token: Optional[str]):
    print("Discord token checks:")
    if not bot_token:
        print("  - DISCORD_BOT_TOKEN: MISSING in environment")
        return

    code, resp = http_request(
        "https://discord.com/api/v10/users/@me",
        method="GET",
        headers={"Authorization": f"Bot {bot_token}"},
    )
    if code is None:
        print(f"  - DISCORD_BOT_TOKEN: request failed: {resp}")
    else:
        if code == 200 and isinstance(resp, dict) and resp.get("id"):
            print(f"  - DISCORD_BOT_TOKEN: OK (bot id: {resp.get('id')}, username: {resp.get('username')})")
        elif code == 401:
            print("  - DISCORD_BOT_TOKEN: UNAUTHORIZED (401) — token invalid or revoked")
        else:
            print(f"  - DISCORD_BOT_TOKEN: unexpected response {code}: {resp}")


def check_apps_connections_open(app_token: Optional[str]):
    if not app_token:
        print("Slack apps.connections.open: SLACK_APP_TOKEN missing — cannot test Socket Mode")
        return
    print("Slack apps.connections.open: calling apps.connections.open (will not print token)")
    code, resp = http_request(
        "https://slack.com/api/apps.connections.open",
        method="POST",
        headers={"Authorization": f"Bearer {app_token}"},
    )
    if code is None:
        print(f"  - request failed: {resp}")
    else:
        print(f"  - status: {code}")
        # print the body safely
        try:
            print(json.dumps(resp, indent=2))
        except Exception:
            print(resp)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Validate Slack and Discord tokens")
    parser.add_argument("--verbose", "-v", action="store_true", help="Run additional checks, including apps.connections.open for SLACK_APP_TOKEN")
    args = parser.parse_args()

    slack_bot = os.environ.get("SLACK_BOT_TOKEN")
    slack_app = os.environ.get("SLACK_APP_TOKEN")
    discord_bot = os.environ.get("DISCORD_BOT_TOKEN")

    check_slack(slack_bot, slack_app)
    print("")
    check_discord(discord_bot)

    if args.verbose:
        print("")
        check_apps_connections_open(slack_app)


if __name__ == "__main__":
    main()
