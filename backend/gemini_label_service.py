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
        self.model = genai.GenerativeModel('gemini-2.0-flash-lite')
        self.model_name = "gemini-2.0-flash-lite"
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
        
        prompt = f"""Analyze these chat messages and generate {num_tags} specific, topical keywords that describe the main subjects discussed.

Requirements:
- Use concrete, meaningful terms (nouns or noun phrases)
- Each keyword should be 4+ characters
- Avoid common words like "yes", "no", "ok", "will", "have", "can"
- Avoid contractions like "I'll", "we're", "don't"
- Focus on topics, technologies, projects, or activities mentioned
- Separate keywords with commas only

Messages:
{messages_text}

Generate {num_tags} topical keywords (comma-separated):"""
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=50,
                    temperature=0.5,  # Lower temperature for more focused, consistent tags
                )
            )
            
            tags_text = response.text.strip()
            # Remove common prefixes that LLMs sometimes add
            for prefix in ["Keywords:", "Tags:", "Topics:", "Keywords are:", "Tags are:"]:
                if tags_text.lower().startswith(prefix.lower()):
                    tags_text = tags_text[len(prefix):].strip()
            
            # Split by comma, handle multiple separators
            tags = []
            for tag in tags_text.split(","):
                tag = tag.strip()
                if tag:
                    tags.append(tag)
            
            # Clean and validate tags
            cleaned_tags = []
            for tag in tags:
                cleaned = self._clean_tag(tag)
                if cleaned and self._is_valid_tag(cleaned):
                    cleaned_tags.append(cleaned)
            
            return cleaned_tags[:num_tags]
            
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
        """Clean a tag - remove special characters and normalize"""
        if not tag:
            return ""
        
        # Remove quotes and common artifacts
        tag = tag.strip('"\'.,;:!?()[]{}')
        
        # Remove special characters, keep alphanumeric, hyphens, and spaces
        tag = "".join(c if c.isalnum() or c in ["-", " "] else "" for c in tag)
        
        # Normalize whitespace and convert to lowercase
        tag = " ".join(tag.split())
        tag = tag.lower()
        
        # Replace spaces with hyphens for consistency
        tag = "-".join(tag.split())
        
        return tag.strip()
    
    def _is_valid_tag(self, tag: str) -> bool:
        """Validate that a tag is meaningful and topical"""
        if not tag or len(tag) < 4:
            return False
        
        # Common stopwords and contractions to filter out
        invalid_tags = {
            "yes", "no", "ok", "okay", "sure", "maybe", "well", "hmm", "hey", "hi", "bye",
            "ill", "im", "ive", "youre", "were", "theyre", "dont", "wont", "cant", "isnt",
            "will", "have", "has", "had", "can", "could", "should", "would", "might",
            "this", "that", "these", "those", "what", "when", "where", "who", "why", "how",
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
            "let", "lets", "go", "get", "got", "see", "say", "said", "think", "know", "make"
        }
        
        # Check if tag is in invalid list
        if tag.lower() in invalid_tags:
            return False
        
        # Check if tag is just a single common word (not a phrase)
        if "-" not in tag and tag.lower() in invalid_tags:
            return False
        
        # Must contain at least one letter
        if not any(c.isalpha() for c in tag):
            return False
        
        return True
    
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
        """Simple fallback tags with better filtering"""
        from collections import Counter
        import re
        
        words = []
        for msg in messages:
            # Extract words, handling contractions
            msg_words = re.findall(r'\b[a-z]{4,}\b', msg.lower())
            words.extend(msg_words)
        
        # Expanded stopwords list
        stopwords = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
            "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did",
            "will", "would", "could", "should", "might", "this", "that", "these", "those",
            "what", "when", "where", "who", "why", "how", "yes", "no", "ok", "okay", "sure",
            "well", "just", "very", "really", "more", "most", "some", "any", "all", "can",
            "let", "lets", "get", "got", "see", "say", "said", "think", "know", "make", "take"
        }
        
        # Filter stopwords and short words
        words = [w for w in words if w not in stopwords and len(w) >= 4]
        
        if not words:
            return []
        
        # Get most common words
        common = Counter(words).most_common(num_tags * 2)
        
        # Clean and validate tags
        tags = []
        for word, _ in common:
            cleaned = self._clean_tag(word)
            if cleaned and self._is_valid_tag(cleaned):
                tags.append(cleaned)
                if len(tags) >= num_tags:
                    break
        
        return tags


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