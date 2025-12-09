"""
Label generation using Google Gemini
"""
import google.generativeai as genai
import os
import time
from functools import wraps
from typing import List
import logging
import threading

logger = logging.getLogger(__name__)

def rate_limit(max_per_minute=15):
    """Thread-safe rate limiter for Gemini free tier"""
    min_interval = 60.0 / max_per_minute
    last_called = [0.0]
    lock = threading.Lock()
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            with lock:
                elapsed = time.monotonic() - last_called[0]
                left_to_wait = min_interval - elapsed
                if left_to_wait > 0:
                    time.sleep(left_to_wait)
                last_called[0] = time.monotonic()
            # Execute function outside the lock to avoid blocking other calls
            return func(*args, **kwargs)
        return wrapper
    return decorator

class GeminiLabelService:
    """Free label generation via Gemini API"""
    
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        self.model_name = "gemini-1.5-flash"
        logger.info("Gemini label service initialized")
    
    @rate_limit(max_per_minute=15)
    def generate_cluster_label(
        self,
        messages: List[str],
        max_messages: int = 30,
        max_length: int = 60
    ) -> str:
        """Generate a descriptive label for a cluster"""
        if not messages:
            return "Empty Cluster"
        
        selected = messages[:max_messages]
        # Allow slightly longer context per message
        messages_text = "\n".join([f"- {msg[:200]}" for msg in selected])
        
        prompt = f"""Analyze these chat messages from a team collaboration channel.
Identify the main project, specific technical issue, or key activity being discussed.
Create a descriptive, specific title (4-8 words) that clearly distinguishes this topic.
Avoid generic phrases like "Team Discussion" or "Project Update".

Messages:
{messages_text}

Specific Topic Title:"""
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=30,
                    temperature=0.4,  # Lower temperature for more focused results
                )
            )
            
            label = response.text.strip()
            label = self._clean_label(label)
            return label
            
        except Exception as e:
            logger.exception(f"Label generation failed")
            return self._fallback_label(selected)
    
    @rate_limit(max_per_minute=15)
    def generate_tags(
        self,
        messages: List[str],
        max_messages: int = 10,
        num_tags: int = 3
    ) -> List[str]:
        """Generate topic tags for a cluster"""
        if not messages:
            return []
        
        selected = messages[:max_messages]
        messages_text = "\n".join([f"- {msg[:150]}" for msg in selected])
        
        prompt = f"""Generate {num_tags} specific topic keywords for these messages.
Use concrete terms, comma-separated.

Messages:
{messages_text}

Keywords:"""
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=50,
                    temperature=0.7,
                )
            )
            
            tags_text = response.text.strip()
            tags = [tag.strip().lower() for tag in tags_text.split(",")]
            return [self._clean_tag(tag) for tag in tags if tag][:num_tags]
            
        except Exception as e:
            logger.exception(f"Tag generation failed")
            return self._fallback_tags(selected, num_tags)
    
    def _clean_label(self, label: str) -> str:
        """Clean and format label"""
        # Remove common prefixes/suffixes from LLM output
        prefixes = ["Title:", "Label:", "Topic:", "Subject:", "The topic is", "Discussion about"]
        for prefix in prefixes:
            if label.lower().startswith(prefix.lower()):
                label = label[len(prefix):].strip()
        
        # Remove quotes if present
        label = label.strip('"\'')
        
        # Capitalize first letter
        if label and not label[0].isupper():
            label = label[0].upper() + label[1:]
            
        return label[:60] if label else "General Discussion"
    
    def _clean_tag(self, tag: str) -> str:
        """Clean a tag"""
        tag = "".join(c if c.isalnum() or c in ["-", " "] else "" for c in tag)
        return "-".join(tag.strip().split())
    
    def _fallback_label(self, messages: List[str]) -> str:
        """Simple fallback if API fails"""
        if not messages:
            return "General Discussion"
        
        # Try to use the beginning of the first substantial message
        for msg in messages:
            if len(msg) > 20:
                # Find first sentence or up to 50 chars
                end = msg.find('.')
                if end > 0:
                    candidate = msg[:end+1]
                else:
                    candidate = msg
                
                if len(candidate) > 60:
                    candidate = candidate[:60].rsplit(' ', 1)[0] + "..."
                
                return candidate
        
        # Fallback to word counter if all messages are tiny
        from collections import Counter
        words = []
        for msg in messages:
            words.extend(msg.lower().split())
        
        stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "is", "are", "of", "with"}
        words = [w for w in words if w not in stopwords and len(w) > 3]
        
        if not words:
            return "General Discussion"
        
        common = Counter(words).most_common(2)
        return " & ".join([word.capitalize() for word, _ in common])
    
    def _fallback_tags(self, messages: List[str], num_tags: int) -> List[str]:
        """Simple fallback tags"""
        from collections import Counter
        words = []
        for msg in messages:
            words.extend(msg.lower().split())
        
        stopwords = {"the", "a", "an", "and", "or", "but"}
        words = [w for w in words if w not in stopwords and len(w) > 3]
        
        common = Counter(words).most_common(num_tags)
        return [word for word, _ in common]


# Module-level singleton
_label_service = None
_service_lock = threading.Lock()

def get_label_service():
    """Get or create singleton label service instance"""
    global _label_service
    if _label_service is None:
        with _service_lock:
            # Double-check locking pattern
            if _label_service is None:
                _label_service = GeminiLabelService()
    return _label_service