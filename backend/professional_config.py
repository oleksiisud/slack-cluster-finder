"""
Professional configuration management system for bot deployment
"""
import os
import json
import yaml
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from pathlib import Path
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class DatabaseConfig:
    """Database configuration settings"""
    url: str
    pool_size: int = 10
    max_overflow: int = 20
    pool_timeout: int = 30
    pool_recycle: int = 3600
    echo: bool = False

@dataclass
class SlackConfig:
    """Slack bot configuration"""
    bot_token: str
    app_token: str
    signing_secret: Optional[str] = None
    
    # Feature flags
    enable_message_content: bool = True
    enable_events: bool = True
    enable_commands: bool = True
    enable_reactions: bool = True
    enable_threads: bool = True
    enable_files: bool = True
    
    # Rate limiting
    max_requests_per_minute: int = 100
    max_concurrent_requests: int = 10
    
    # Data collection settings
    collect_user_profiles: bool = True
    collect_channel_metadata: bool = True
    collect_message_reactions: bool = True
    collect_thread_replies: bool = True
    collect_file_attachments: bool = False  # May require special permissions
    
    # Privacy settings
    hash_user_ids: bool = True
    store_message_content: bool = True
    redact_sensitive_data: bool = True
    
    # Required scopes
    required_scopes: List[str] = None
    
    def __post_init__(self):
        if self.required_scopes is None:
            self.required_scopes = [
                'channels:read', 'channels:history',
                'groups:read', 'groups:history',
                'im:read', 'im:history',
                'mpim:read', 'mpim:history',
                'chat:write', 'users:read', 'team:read',
                'reactions:read', 'files:read'
            ]

@dataclass
class DiscordConfig:
    """Discord bot configuration"""
    bot_token: str
    
    # Feature flags
    enable_message_content: bool = True
    enable_members_intent: bool = True
    enable_reactions: bool = True
    enable_voice_states: bool = False
    enable_typing: bool = False
    
    # Rate limiting
    max_requests_per_minute: int = 50
    max_concurrent_requests: int = 5
    
    # Data collection settings
    collect_user_profiles: bool = True
    collect_guild_metadata: bool = True
    collect_channel_metadata: bool = True
    collect_message_reactions: bool = True
    collect_voice_activity: bool = False
    collect_member_updates: bool = True
    
    # Privacy settings
    hash_user_ids: bool = True
    store_message_content: bool = True
    redact_sensitive_data: bool = True
    
    # Required permissions
    required_permissions: List[str] = None
    
    def __post_init__(self):
        if self.required_permissions is None:
            self.required_permissions = [
                'read_messages', 'read_message_history',
                'send_messages', 'embed_links',
                'use_slash_commands', 'view_channel'
            ]

@dataclass
class SecurityConfig:
    """Security configuration"""
    encryption_key: Optional[str] = None
    hash_salt: str = "default-salt"  # Should be changed in production
    
    # Token validation
    validate_tokens_on_startup: bool = True
    token_validation_timeout: int = 30
    
    # Request signing
    verify_webhook_signatures: bool = True
    webhook_secret: Optional[str] = None
    
    # Rate limiting
    enable_rate_limiting: bool = True
    rate_limit_storage: str = "memory"  # or "redis"
    
    # API security
    enable_cors: bool = True
    allowed_origins: List[str] = None
    
    def __post_init__(self):
        if self.allowed_origins is None:
            self.allowed_origins = ["http://localhost:3000", "http://localhost:5173"]

@dataclass
class MonitoringConfig:
    """Monitoring and logging configuration"""
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    log_file: Optional[str] = "logs/bot.log"
    log_max_bytes: int = 10 * 1024 * 1024  # 10MB
    log_backup_count: int = 5
    
    # Metrics collection
    enable_metrics: bool = True
    metrics_port: int = 9090
    metrics_endpoint: str = "/metrics"
    
    # Health checks
    enable_health_checks: bool = True
    health_check_interval: int = 300  # 5 minutes
    
    # Error tracking
    enable_error_tracking: bool = True
    max_errors_in_memory: int = 1000
    error_report_webhook: Optional[str] = None
    
    # Performance monitoring
    enable_performance_monitoring: bool = True
    slow_query_threshold: float = 1.0  # seconds

@dataclass
class CacheConfig:
    """Caching configuration"""
    enable_caching: bool = True
    cache_backend: str = "memory"  # or "redis"
    cache_ttl: int = 3600  # 1 hour
    max_cache_size: int = 10000
    
    # Redis settings (if using Redis backend)
    redis_url: Optional[str] = None
    redis_db: int = 0

@dataclass
class AnalyticsConfig:
    """Analytics configuration"""
    enable_analytics: bool = True
    
    # Data processing
    batch_size: int = 1000
    processing_interval: int = 300  # 5 minutes
    
    # Sentiment analysis
    enable_sentiment_analysis: bool = True
    sentiment_model: str = "textblob"  # or "vader", "transformers"
    
    # Content analysis
    enable_content_analysis: bool = True
    extract_keywords: bool = True
    analyze_toxicity: bool = False  # Requires additional setup
    
    # Reporting
    generate_daily_reports: bool = True
    generate_weekly_reports: bool = True
    report_retention_days: int = 90

@dataclass
class BotConfiguration:
    """Master bot configuration"""
    # Platform configs
    slack: Optional[SlackConfig] = None
    discord: Optional[DiscordConfig] = None
    
    # System configs
    database: DatabaseConfig = None
    security: SecurityConfig = None
    monitoring: MonitoringConfig = None
    cache: CacheConfig = None
    analytics: AnalyticsConfig = None
    
    # General settings
    environment: str = "development"
    debug: bool = False
    
    def __post_init__(self):
        # Set defaults if not provided
        if self.security is None:
            self.security = SecurityConfig()
        if self.monitoring is None:
            self.monitoring = MonitoringConfig()
        if self.cache is None:
            self.cache = CacheConfig()
        if self.analytics is None:
            self.analytics = AnalyticsConfig()

class ConfigurationManager:
    """Manages bot configuration from multiple sources"""
    
    def __init__(self, config_dir: str = "config"):
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(exist_ok=True)
        
    def load_configuration(self, environment: str = None) -> BotConfiguration:
        """Load configuration from environment and files"""
        if environment is None:
            environment = os.getenv("BOT_ENVIRONMENT", "development")
        
        # Start with base configuration
        config = self._create_base_config()
        
        # Load from environment variables
        config = self._load_from_environment(config)
        
        # Load from configuration file
        config_file = self.config_dir / f"{environment}.yaml"
        if config_file.exists():
            config = self._load_from_file(config, config_file)
        
        # Validate configuration
        self._validate_configuration(config)
        
        return config
    
    def _create_base_config(self) -> BotConfiguration:
        """Create base configuration with defaults"""
        return BotConfiguration(
            database=DatabaseConfig(
                url=os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/botdb")
            ),
            security=SecurityConfig(),
            monitoring=MonitoringConfig(),
            cache=CacheConfig(),
            analytics=AnalyticsConfig()
        )
    
    def _load_from_environment(self, config: BotConfiguration) -> BotConfiguration:
        """Load configuration from environment variables"""
        # Slack configuration
        slack_bot_token = os.getenv("SLACK_BOT_TOKEN")
        slack_app_token = os.getenv("SLACK_APP_TOKEN")
        if slack_bot_token and slack_app_token:
            config.slack = SlackConfig(
                bot_token=slack_bot_token,
                app_token=slack_app_token,
                signing_secret=os.getenv("SLACK_SIGNING_SECRET"),
                enable_message_content=os.getenv("SLACK_ENABLE_MESSAGE_CONTENT", "true").lower() == "true",
                hash_user_ids=os.getenv("SLACK_HASH_USER_IDS", "true").lower() == "true",
                collect_user_profiles=os.getenv("SLACK_COLLECT_USER_PROFILES", "true").lower() == "true"
            )
        
        # Discord configuration
        discord_bot_token = os.getenv("DISCORD_BOT_TOKEN")
        if discord_bot_token:
            config.discord = DiscordConfig(
                bot_token=discord_bot_token,
                enable_message_content=os.getenv("DISCORD_ENABLE_MESSAGE_CONTENT", "true").lower() == "true",
                enable_members_intent=os.getenv("DISCORD_ENABLE_MEMBERS", "true").lower() == "true",
                hash_user_ids=os.getenv("DISCORD_HASH_USER_IDS", "true").lower() == "true"
            )
        
        # Database configuration
        config.database.url = os.getenv("DATABASE_URL", config.database.url)
        config.database.pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
        config.database.echo = os.getenv("DB_ECHO", "false").lower() == "true"
        
        # Security configuration
        config.security.encryption_key = os.getenv("ENCRYPTION_KEY")
        config.security.hash_salt = os.getenv("HASH_SALT", config.security.hash_salt)
        config.security.webhook_secret = os.getenv("WEBHOOK_SECRET")
        
        # General settings
        config.environment = os.getenv("BOT_ENVIRONMENT", "development")
        config.debug = os.getenv("DEBUG", "false").lower() == "true"
        
        return config
    
    def _load_from_file(self, config: BotConfiguration, file_path: Path) -> BotConfiguration:
        """Load configuration from YAML file"""
        try:
            with open(file_path, 'r') as f:
                file_config = yaml.safe_load(f)
            
            # Merge file configuration with existing config
            config_dict = asdict(config)
            self._deep_merge(config_dict, file_config)
            
            # Reconstruct configuration object
            return self._dict_to_config(config_dict)
            
        except Exception as e:
            logger.warning(f"Failed to load config file {file_path}: {e}")
            return config
    
    def _dict_to_config(self, config_dict: Dict[str, Any]) -> BotConfiguration:
        """Convert dictionary back to configuration object"""
        # This is a simplified conversion - in practice you'd want more robust handling
        config = BotConfiguration()
        
        if "slack" in config_dict and config_dict["slack"]:
            config.slack = SlackConfig(**config_dict["slack"])
        
        if "discord" in config_dict and config_dict["discord"]:
            config.discord = DiscordConfig(**config_dict["discord"])
        
        if "database" in config_dict:
            config.database = DatabaseConfig(**config_dict["database"])
        
        if "security" in config_dict:
            config.security = SecurityConfig(**config_dict["security"])
        
        if "monitoring" in config_dict:
            config.monitoring = MonitoringConfig(**config_dict["monitoring"])
        
        if "cache" in config_dict:
            config.cache = CacheConfig(**config_dict["cache"])
        
        if "analytics" in config_dict:
            config.analytics = AnalyticsConfig(**config_dict["analytics"])
        
        config.environment = config_dict.get("environment", "development")
        config.debug = config_dict.get("debug", False)
        
        return config
    
    def _deep_merge(self, base_dict: Dict, update_dict: Dict):
        """Deep merge two dictionaries"""
        for key, value in update_dict.items():
            if key in base_dict and isinstance(base_dict[key], dict) and isinstance(value, dict):
                self._deep_merge(base_dict[key], value)
            else:
                base_dict[key] = value
    
    def _validate_configuration(self, config: BotConfiguration):
        """Validate configuration settings"""
        errors = []
        
        # Check that at least one platform is configured
        if not config.slack and not config.discord:
            errors.append("At least one platform (Slack or Discord) must be configured")
        
        # Validate database URL
        if not config.database.url:
            errors.append("Database URL is required")
        
        # Validate platform-specific settings
        if config.slack:
            if not config.slack.bot_token:
                errors.append("Slack bot token is required")
            if not config.slack.app_token:
                errors.append("Slack app token is required")
        
        if config.discord:
            if not config.discord.bot_token:
                errors.append("Discord bot token is required")
        
        if errors:
            raise ValueError("Configuration validation failed:\n" + "\n".join(f"- {error}" for error in errors))
    
    def save_configuration(self, config: BotConfiguration, environment: str = None):
        """Save configuration to file"""
        if environment is None:
            environment = config.environment
        
        config_file = self.config_dir / f"{environment}.yaml"
        
        # Convert to dictionary and remove sensitive data
        config_dict = asdict(config)
        config_dict = self._redact_sensitive_data(config_dict)
        
        with open(config_file, 'w') as f:
            yaml.dump(config_dict, f, default_flow_style=False, indent=2)
    
    def _redact_sensitive_data(self, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive data from configuration before saving"""
        sensitive_keys = [
            "bot_token", "app_token", "signing_secret", "webhook_secret",
            "encryption_key", "password", "secret", "key"
        ]
        
        def redact_recursive(d):
            if isinstance(d, dict):
                return {
                    k: "[REDACTED]" if any(sensitive in k.lower() for sensitive in sensitive_keys) else redact_recursive(v)
                    for k, v in d.items()
                }
            elif isinstance(d, list):
                return [redact_recursive(item) for item in d]
            else:
                return d
        
        return redact_recursive(config_dict)
    
    def create_example_config(self, file_path: str = None):
        """Create an example configuration file"""
        if file_path is None:
            file_path = self.config_dir / "example.yaml"
        
        example_config = {
            "environment": "production",
            "debug": False,
            "slack": {
                "enable_message_content": True,
                "collect_user_profiles": True,
                "hash_user_ids": True,
                "max_requests_per_minute": 100
            },
            "discord": {
                "enable_message_content": True,
                "enable_members_intent": True,
                "hash_user_ids": True,
                "max_requests_per_minute": 50
            },
            "database": {
                "pool_size": 20,
                "max_overflow": 30,
                "echo": False
            },
            "security": {
                "verify_webhook_signatures": True,
                "enable_rate_limiting": True,
                "allowed_origins": ["https://your-domain.com"]
            },
            "monitoring": {
                "log_level": "INFO",
                "enable_metrics": True,
                "enable_health_checks": True
            },
            "analytics": {
                "enable_sentiment_analysis": True,
                "generate_daily_reports": True,
                "report_retention_days": 90
            }
        }
        
        with open(file_path, 'w') as f:
            yaml.dump(example_config, f, default_flow_style=False, indent=2)
        
        print(f"Example configuration created at: {file_path}")

# Global configuration instance
config_manager = ConfigurationManager()
bot_config: Optional[BotConfiguration] = None

def load_bot_config(environment: str = None) -> BotConfiguration:
    """Load and return bot configuration"""
    global bot_config
    bot_config = config_manager.load_configuration(environment)
    return bot_config

def get_bot_config() -> BotConfiguration:
    """Get current bot configuration"""
    global bot_config
    if bot_config is None:
        bot_config = load_bot_config()
    return bot_config