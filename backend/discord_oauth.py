"""
Discord OAuth integration for backend
"""
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import secrets

router = APIRouter(prefix="/discord/oauth", tags=["discord-oauth"])

DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET")

class OAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: str

@router.post("/callback")
async def discord_oauth_callback(request: OAuthCallbackRequest):
    """
    Exchange authorization code for access token
    """
    if not DISCORD_CLIENT_ID or not DISCORD_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Discord OAuth credentials not configured"
        )
    
    try:
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://discord.com/api/v10/oauth2/token",
                data={
                    "client_id": DISCORD_CLIENT_ID,
                    "client_secret": DISCORD_CLIENT_SECRET,
                    "grant_type": "authorization_code",
                    "code": request.code,
                    "redirect_uri": request.redirect_uri,
                }
            )
            
            data = response.json()
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Discord OAuth error: {data.get('error', 'Unknown error')}"
                )
            
            return {
                "access_token": data["access_token"],
                "token_type": data.get("token_type", "Bearer"),
                "expires_in": data.get("expires_in"),
                "refresh_token": data.get("refresh_token"),
                "scope": data.get("scope", ""),
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to exchange code for token: {str(e)}"
        )

@router.get("/authorize-url")
async def get_authorize_url(redirect_uri: str):
    """
    Generate Discord OAuth authorization URL
    """
    if not DISCORD_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Discord OAuth credentials not configured"
        )
    
    scopes = [
        "identify",
        "guilds",
        "guilds.members.read",
        "messages.read",
    ]
    
    # Generate a random state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    scope_string = "%20".join(scopes)
    url = f"https://discord.com/api/oauth2/authorize?client_id={DISCORD_CLIENT_ID}&redirect_uri={redirect_uri}&response_type=code&scope={scope_string}&state={state}"
    
    return {"authorize_url": url, "state": state}
