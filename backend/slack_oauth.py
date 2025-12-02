"""
Slack OAuth integration for backend
"""
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from slack_sdk import WebClient
from slack_sdk.oauth import AuthorizeUrlGenerator
from slack_sdk.errors import SlackApiError
import httpx

router = APIRouter(prefix="/slack/oauth", tags=["slack-oauth"])

SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET")

class OAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: str

@router.post("/callback")
async def slack_oauth_callback(request: OAuthCallbackRequest):
    """
    Exchange authorization code for access token
    """
    if not SLACK_CLIENT_ID or not SLACK_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Slack OAuth credentials not configured"
        )
    
    try:
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://slack.com/api/oauth.v2.access",
                data={
                    "client_id": SLACK_CLIENT_ID,
                    "client_secret": SLACK_CLIENT_SECRET,
                    "code": request.code,
                    "redirect_uri": request.redirect_uri,
                }
            )
            
            data = response.json()
            
            if not data.get("ok"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Slack OAuth error: {data.get('error', 'Unknown error')}"
                )
            
            return {
                "access_token": data["access_token"],
                "token_type": data.get("token_type", "bot"),
                "scope": data.get("scope", ""),
                "bot_user_id": data.get("bot_user_id"),
                "team": data.get("team", {}),
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to exchange code for token: {str(e)}"
        )

@router.get("/authorize-url")
async def get_authorize_url(redirect_uri: str):
    """
    Generate Slack OAuth authorization URL
    """
    if not SLACK_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Slack OAuth credentials not configured"
        )
    
    scopes = [
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "mpim:history",
        "mpim:read",
        "users:read",
        "team:read",
    ]
    
    generator = AuthorizeUrlGenerator(
        client_id=SLACK_CLIENT_ID,
        scopes=scopes,
        redirect_uri=redirect_uri,
    )
    
    url = generator.generate()
    
    return {"authorize_url": url}

