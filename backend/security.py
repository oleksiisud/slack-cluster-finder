"""
Security utilities for bot authentication and token management
"""
import os
import json
import base64
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class TokenManager:
    """Secure token management with encryption and rotation"""
    
    def __init__(self):
        self.encryption_key = self._get_or_create_key()
        self.fernet = Fernet(self.encryption_key)
    
    def _get_or_create_key(self) -> bytes:
        """Get encryption key from environment or create new one"""
        key = os.getenv("ENCRYPTION_KEY")
        if not key:
            logger.warning("No ENCRYPTION_KEY found, generating new one")
            return Fernet.generate_key()
        return base64.urlsafe_b64decode(key.encode())
    
    def encrypt_token(self, token: str) -> str:
        """Encrypt sensitive tokens"""
        return self.fernet.encrypt(token.encode()).decode()
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt tokens for use"""
        return self.fernet.decrypt(encrypted_token.encode()).decode()

class RateLimiter:
    """Token-aware rate limiting"""
    
    def __init__(self):
        self.requests = {}
    
    def can_make_request(self, token_hash: str, endpoint: str) -> bool:
        """Check if request can be made based on rate limits"""
        key = f"{token_hash}:{endpoint}"
        now = datetime.now()
        
        if key not in self.requests:
            self.requests[key] = []
        
        # Clean old requests (last hour)
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if now - req_time < timedelta(hours=1)
        ]
        
        # Check limits based on endpoint
        limits = {
            "slack:messages": 100,  # per hour
            "discord:messages": 50,
            "slack:channels": 20,
            "discord:channels": 20
        }
        
        limit = limits.get(endpoint, 10)
        return len(self.requests[key]) < limit
    
    def record_request(self, token_hash: str, endpoint: str):
        """Record a request"""
        key = f"{token_hash}:{endpoint}"
        if key not in self.requests:
            self.requests[key] = []
        self.requests[key].append(datetime.now())

class PermissionValidator:
    """Validate bot permissions and scopes"""
    
    @staticmethod
    def validate_slack_permissions(client, required_scopes: list) -> Dict[str, Any]:
        """Validate Slack bot has required permissions"""
        try:
            auth_info = client.auth_test()
            # Check bot permissions
            bot_info = client.bots_info(bot=auth_info.get('bot_id'))
            
            return {
                'valid': True,
                'scopes': auth_info.get('response_metadata', {}).get('scopes', []),
                'missing_scopes': [],
                'bot_info': bot_info
            }
        except Exception as e:
            logger.error(f"Permission validation failed: {e}")
            return {'valid': False, 'error': str(e)}
    
    @staticmethod
    def validate_discord_permissions(client, guild_id: str, required_perms: list) -> Dict[str, Any]:
        """Validate Discord bot permissions in guild"""
        try:
            guild = client.get_guild(int(guild_id))
            bot_member = guild.get_member(client.user.id)
            
            missing_perms = []
            for perm in required_perms:
                if not getattr(bot_member.guild_permissions, perm, False):
                    missing_perms.append(perm)
            
            return {
                'valid': len(missing_perms) == 0,
                'permissions': bot_member.guild_permissions,
                'missing_permissions': missing_perms
            }
        except Exception as e:
            logger.error(f"Discord permission validation failed: {e}")
            return {'valid': False, 'error': str(e)}