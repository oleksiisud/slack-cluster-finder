"""
Label generation using Google Gemini
"""
import google.generativeai as genai
import os
import time
from functools import wraps
from typing import List
import logging

logger = logging.getLogger(__name__)

def rate_limit(max_per_minute=15):
    """Simple rate limiter for Gemini free tier"""
    min_interval = 60.0 / max_per_minute
    last_called = [0.0]
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.time() - last_called[0]
            left_to_wait = min_interval - elapsed
            if left_to_wait > 0:
                time.sleep(left_to_wait)
            ret = func(*args, **kwargs)
            last_called[0] = time.time()
            return ret
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
        max_messages: int = 10,
        max_length: int = 50
    ) -> str:
        """Generate a descriptive label for a cluster"""
        if not messages:
            return "Empty Cluster"
        
        selected = messages[:max_messages]
        messages_text = "\n".join([f"- {msg[:150]}" for msg in selected])
        
        prompt = f"""Analyze these chat messages and create a clear, descriptive topic label in 3-6 words.
Be specific and concise.

Messages:
{messages_text}

Topic label (3-6 words):"""
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=20,
                    temperature=0.7,
                )
            )
            
            label = response.text.strip()
            label = self._clean_label(label)
            return label
            
        except Exception as e:
            logger.error(f"Label generation failed: {e}")
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
            logger.error(f"Tag generation failed: {e}")
            return self._fallback_tags(selected, num_tags)
    
    def _clean_label(self, label: str) -> str:
        """Clean and format label"""
        label = label.replace("Topic:", "").replace("topic:", "").strip()
        if label and not label[0].isupper():
            label = label[0].upper() + label[1:]
        return label[:50] if label else "General Discussion"
    
    def _clean_tag(self, tag: str) -> str:
        """Clean a tag"""
        tag = "".join(c if c.isalnum() or c in ["-", " "] else "" for c in tag)
        return "-".join(tag.strip().split())
    
    def _fallback_label(self, messages: List[str]) -> str:
        """Simple fallback if API fails"""
        from collections import Counter
        words = []
        for msg in messages:
            words.extend(msg.lower().split())
        
        stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for"}
        words = [w for w in words if w not in stopwords and len(w) > 3]
        
        if not words:
            return "General Discussion"
        
        common = Counter(words).most_common(3)
        return " ".join([word.capitalize() for word, _ in common])
    
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


def get_label_service():
    """Factory function"""
    return GeminiLabelService()