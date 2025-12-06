"""
Slack API integration service
Handles Slack API calls for workspaces, channels, users, and messages
"""
import os
import logging
from typing import Dict, List, Optional, Any
import httpx
from models import SlackWorkspace, SlackChannel, SlackUser, SlackWorkspaceData

logger = logging.getLogger(__name__)

class SlackService:
    """Service for interacting with Slack API"""
    
    BASE_URL = "https://slack.com/api"
    
    def __init__(self, access_token: str):
        """
        Initialize Slack service with user access token
        
        Args:
            access_token: Slack user OAuth access token
        """
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    
    async def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make a request to Slack API
        
        Args:
            endpoint: API endpoint (e.g., 'auth.test')
            params: Optional query parameters
            
        Returns:
            API response as dict
        """
        url = f"{self.BASE_URL}/{endpoint}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params or {})
            response.raise_for_status()
            data = response.json()
            
            if not data.get("ok"):
                error = data.get("error", "Unknown error")
                logger.error(f"Slack API error on {endpoint}: {error}")
                raise Exception(f"Slack API error: {error}")
            
            return data
    
    async def test_auth(self) -> Dict[str, Any]:
        """
        Test authentication and get user/workspace info
        
        Returns:
            Auth test response
        """
        return await self._make_request("auth.test")
    
    async def get_team_info(self) -> SlackWorkspace:
        """
        Get workspace/team information
        
        Returns:
            SlackWorkspace object
        """
        data = await self._make_request("team.info")
        team = data.get("team", {})
        
        return SlackWorkspace(
            id=team.get("id", ""),
            name=team.get("name", ""),
            domain=team.get("domain"),
            icon=team.get("icon")
        )
    
    async def get_channels(self, types: str = "public_channel,private_channel") -> List[SlackChannel]:
        """
        Get list of channels the user has access to
        
        Args:
            types: Comma-separated channel types (public_channel, private_channel)
            
        Returns:
            List of SlackChannel objects
        """
        channels = []
        cursor = None
        
        while True:
            params = {
                "types": types,
                "limit": 1000
            }
            if cursor:
                params["cursor"] = cursor
            
            data = await self._make_request("conversations.list", params)
            
            for channel_data in data.get("channels", []):
                channel = SlackChannel(
                    id=channel_data.get("id", ""),
                    name=channel_data.get("name", ""),
                    is_private=channel_data.get("is_private", False),
                    is_archived=channel_data.get("is_archived", False),
                    is_member=channel_data.get("is_member", False),
                    num_members=channel_data.get("num_members"),
                    topic=channel_data.get("topic", {}).get("value"),
                    purpose=channel_data.get("purpose", {}).get("value")
                )
                channels.append(channel)
            
            # Check for pagination
            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break
        
        return channels
    
    async def get_users(self) -> List[SlackUser]:
        """
        Get list of users in the workspace
        
        Returns:
            List of SlackUser objects
        """
        users = []
        cursor = None
        
        while True:
            params = {"limit": 1000}
            if cursor:
                params["cursor"] = cursor
            
            data = await self._make_request("users.list", params)
            
            for user_data in data.get("members", []):
                user = SlackUser(
                    id=user_data.get("id", ""),
                    name=user_data.get("name", ""),
                    real_name=user_data.get("real_name"),
                    is_bot=user_data.get("is_bot", False),
                    deleted=user_data.get("deleted", False),
                    profile=user_data.get("profile")
                )
                users.append(user)
            
            # Check for pagination
            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break
        
        return users
    
    async def get_workspace_data(self) -> SlackWorkspaceData:
        """
        Get complete workspace data including channels and users
        
        Returns:
            SlackWorkspaceData object
        """
        # Get all data in parallel
        workspace = await self.get_team_info()
        channels = await self.get_channels()
        users = await self.get_users()
        
        return SlackWorkspaceData(
            workspace=workspace,
            channels=channels,
            users=users
        )
    
    async def get_channel_messages(
        self, 
        channel_id: str, 
        limit: int = 1000,
        oldest: Optional[str] = None,
        latest: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get messages from a channel
        
        Args:
            channel_id: Channel ID
            limit: Maximum number of messages to retrieve
            oldest: Only messages after this timestamp
            latest: Only messages before this timestamp
            
        Returns:
            List of message dictionaries
        """
        messages = []
        cursor = None
        
        while len(messages) < limit:
            params = {
                "channel": channel_id,
                "limit": min(1000, limit - len(messages))
            }
            if cursor:
                params["cursor"] = cursor
            if oldest:
                params["oldest"] = oldest
            if latest:
                params["latest"] = latest
            
            data = await self._make_request("conversations.history", params)
            
            messages.extend(data.get("messages", []))
            
            # Check for pagination
            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor or not data.get("has_more"):
                break
        
        return messages[:limit]


def get_slack_service(access_token: str) -> SlackService:
    """
    Factory function to create a SlackService instance
    
    Args:
        access_token: Slack user OAuth access token
        
    Returns:
        SlackService instance
    """
    return SlackService(access_token)
