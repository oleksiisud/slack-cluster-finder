"""
Professional monitoring and error handling for bots
"""
import logging
import json
import traceback
from datetime import datetime
from typing import Any, Dict, Optional
from dataclasses import dataclass
from enum import Enum

class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium" 
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class BotError:
    timestamp: datetime
    platform: str
    error_type: str
    message: str
    severity: ErrorSeverity
    context: Dict[str, Any]
    traceback: Optional[str] = None

class BotMonitor:
    """Comprehensive monitoring for bot operations"""
    
    def __init__(self):
        self.errors = []
        self.metrics = {
            'messages_processed': 0,
            'api_calls_made': 0,
            'errors_count': 0,
            'uptime_start': datetime.now()
        }
        self.setup_logging()
    
    def setup_logging(self):
        """Configure structured logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('logs/bot_operations.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger('bot_monitor')
    
    def log_error(self, platform: str, error: Exception, context: Dict[str, Any] = None, severity: ErrorSeverity = ErrorSeverity.MEDIUM):
        """Log and track errors with context"""
        bot_error = BotError(
            timestamp=datetime.now(),
            platform=platform,
            error_type=type(error).__name__,
            message=str(error),
            severity=severity,
            context=context or {},
            traceback=traceback.format_exc()
        )
        
        self.errors.append(bot_error)
        self.metrics['errors_count'] += 1
        
        # Log based on severity
        if severity == ErrorSeverity.CRITICAL:
            self.logger.critical(f"[{platform}] CRITICAL ERROR: {error}", extra={'context': context})
        elif severity == ErrorSeverity.HIGH:
            self.logger.error(f"[{platform}] HIGH ERROR: {error}", extra={'context': context})
        else:
            self.logger.warning(f"[{platform}] {severity.value.upper()} ERROR: {error}", extra={'context': context})
        
        # Store to database for analysis
        self._store_error(bot_error)
    
    def _store_error(self, error: BotError):
        """Store error in database for analysis"""
        try:
            from . import database
            database.insert_bot_error(
                platform=error.platform,
                error_type=error.error_type,
                message=error.message,
                severity=error.severity.value,
                context=json.dumps(error.context),
                traceback=error.traceback,
                timestamp=error.timestamp.isoformat()
            )
        except Exception as e:
            self.logger.error(f"Failed to store error in database: {e}")
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get comprehensive health status"""
        recent_errors = [e for e in self.errors if (datetime.now() - e.timestamp).seconds < 3600]
        critical_errors = [e for e in recent_errors if e.severity == ErrorSeverity.CRITICAL]
        
        return {
            'status': 'critical' if critical_errors else 'healthy' if len(recent_errors) < 5 else 'degraded',
            'uptime_seconds': (datetime.now() - self.metrics['uptime_start']).total_seconds(),
            'messages_processed': self.metrics['messages_processed'],
            'api_calls_made': self.metrics['api_calls_made'],
            'total_errors': self.metrics['errors_count'],
            'recent_errors': len(recent_errors),
            'critical_errors': len(critical_errors)
        }

class RetryHandler:
    """Smart retry logic with exponential backoff"""
    
    @staticmethod
    async def with_retry(func, max_retries: int = 3, base_delay: float = 1.0, platform: str = "unknown"):
        """Execute function with exponential backoff retry"""
        for attempt in range(max_retries + 1):
            try:
                return await func()
            except Exception as e:
                if attempt == max_retries:
                    monitor.log_error(platform, e, {'attempts': attempt + 1}, ErrorSeverity.HIGH)
                    raise
                
                delay = base_delay * (2 ** attempt)
                monitor.logger.warning(f"[{platform}] Attempt {attempt + 1} failed, retrying in {delay}s: {e}")
                await asyncio.sleep(delay)

# Global monitor instance
monitor = BotMonitor()