"""
Label generation service using Hugging Face Inference API
"""
import os
from typing import List, Optional
import logging
from huggingface_hub import InferenceClient
from config import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LabelGenerationService:
    """Service for generating human-readable labels for clusters using HF Inference API"""
    
    def __init__(self, model_name: Optional[str] = None):
        """
        Initialize label generation service
        
        Args:
            model_name: Name of the HuggingFace model to use
        """
        self.model_name = model_name or config.LLM_MODEL
        self.api_key = config.HF_TOKEN
        
        if not self.api_key:
            logger.warning("HF_TOKEN not set! Label generation will use fallback methods.")
            self.client = None
        else:
            logger.info(f"Initializing HuggingFace Inference API client for model: {self.model_name}")
            self.client = InferenceClient(api_key=self.api_key)
            logger.info("Label generation service initialized successfully")
    
    def generate_cluster_label(
        self,
        messages: List[str],
        max_messages: int = 10,
        max_length: int = 50
    ) -> str:
        """
        Generate a descriptive label for a cluster of messages
        
        Args:
            messages: List of message texts in the cluster
            max_messages: Maximum number of messages to include in prompt
            max_length: Maximum length of generated label
            
        Returns:
            Generated label string
        """
        if not messages:
            return "Empty Cluster"
        
        # Select representative messages
        selected_messages = messages[:max_messages]
        
        # If no API client, use fallback
        if not self.client:
            logger.info("No API client available, using fallback label generation")
            return self._fallback_label(selected_messages)
        
        # Create prompt for label generation
        prompt = self._create_label_prompt(selected_messages)
        
        try:
            # Call HuggingFace Inference API
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=max_length,
                temperature=0.7,
            )
            
            label = response.choices[0].message.content.strip()
            
            # Clean up label
            label = self._clean_label(label)
            
            return label
        
        except Exception as e:
            logger.error(f"Error generating label via API: {e}")
            logger.info("Falling back to frequency-based labeling")
            return self._fallback_label(selected_messages)
    
    def generate_tags(
        self,
        messages: List[str],
        max_messages: int = 10,
        num_tags: int = 3
    ) -> List[str]:
        """
        Generate topic tags for a cluster
        
        Args:
            messages: List of message texts in the cluster
            max_messages: Maximum number of messages to include
            num_tags: Number of tags to generate
            
        Returns:
            List of generated tags
        """
        if not messages:
            return []
        
        selected_messages = messages[:max_messages]
        
        # If no API client, use fallback
        if not self.client:
            return self._fallback_tags(selected_messages, num_tags)
        
        # Create prompt for tag generation
        prompt = self._create_tags_prompt(selected_messages, num_tags)
        
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=100,
                temperature=0.7,
            )
            
            tags_text = response.choices[0].message.content.strip()
            
            # Parse tags from output
            tags = self._parse_tags(tags_text)
            
            return tags[:num_tags]
        
        except Exception as e:
            logger.error(f"Error generating tags via API: {e}")
            return self._fallback_tags(selected_messages, num_tags)
    
    def _create_label_prompt(self, messages: List[str]) -> str:
        """Create prompt for label generation"""
        messages_text = "\n".join([f"- {msg[:100]}" for msg in messages])
        
        prompt = f"""Summarize the main topic of these chat messages in 3-5 words:

{messages_text}

Topic:"""
        
        return prompt
    
    def _create_tags_prompt(self, messages: List[str], num_tags: int) -> str:
        """Create prompt for tag generation"""
        messages_text = "\n".join([f"- {msg[:100]}" for msg in messages])
        
        prompt = f"""Generate {num_tags} topic keywords (comma-separated) for these chat messages:

{messages_text}

Keywords:"""
        
        return prompt
    
    def _clean_label(self, label: str) -> str:
        """Clean and format generated label"""
        # Remove common artifacts
        label = label.replace("Topic:", "").replace("topic:", "")
        label = label.strip()
        
        # Capitalize first letter
        if label:
            label = label[0].upper() + label[1:]
        
        # Truncate if too long
        if len(label) > 50:
            label = label[:47] + "..."
        
        return label or "General Discussion"
    
    def _parse_tags(self, tags_text: str) -> List[str]:
        """Parse tags from generated text"""
        # Remove common prefixes
        tags_text = tags_text.replace("Keywords:", "").replace("keywords:", "")
        tags_text = tags_text.strip()
        
        # Split by comma or newline
        tags = [tag.strip().lower() for tag in tags_text.replace("\n", ",").split(",")]
        
        # Filter empty tags and clean
        tags = [self._clean_tag(tag) for tag in tags if tag]
        
        return [tag for tag in tags if tag]
    
    def _clean_tag(self, tag: str) -> str:
        """Clean a single tag"""
        # Remove special characters, keep alphanumeric and hyphens
        tag = "".join(c if c.isalnum() or c in ["-", " "] else "" for c in tag)
        tag = tag.strip()
        
        # Replace spaces with hyphens
        tag = "-".join(tag.split())
        
        return tag
    
    def _fallback_label(self, messages: List[str]) -> str:
        """Generate fallback label using simple heuristics"""
        # Use most common words
        from collections import Counter
        
        words = []
        for msg in messages:
            words.extend(msg.lower().split())
        
        # Filter stopwords (basic list)
        stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", 
                    "of", "with", "is", "are", "was", "were", "be", "been", "have", "has", 
                    "had", "do", "does", "did", "will", "would", "could", "should"}
        
        words = [w for w in words if w not in stopwords and len(w) > 2]
        
        if not words:
            return "General Discussion"
        
        common_words = Counter(words).most_common(3)
        label = " ".join([word for word, _ in common_words])
        
        return label.title() or "General Discussion"
    
    def _fallback_tags(self, messages: List[str], num_tags: int) -> List[str]:
        """Generate fallback tags using simple heuristics"""
        from collections import Counter
        
        words = []
        for msg in messages:
            words.extend(msg.lower().split())
        
        # Filter stopwords
        stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
                    "of", "with", "is", "are", "was", "were", "be", "been", "have", "has",
                    "had", "do", "does", "did", "will", "would", "could", "should"}
        
        words = [w for w in words if w not in stopwords and len(w) > 3]
        
        if not words:
            return ["general"]
        
        common_words = Counter(words).most_common(num_tags * 2)
        tags = [self._clean_tag(word) for word, _ in common_words]
        
        return [tag for tag in tags if tag][:num_tags]


# Global instance
_label_service: Optional[LabelGenerationService] = None


def get_label_service() -> LabelGenerationService:
    """Get or create the global label generation service instance"""
    global _label_service
    if _label_service is None:
        _label_service = LabelGenerationService()
    return _label_service

