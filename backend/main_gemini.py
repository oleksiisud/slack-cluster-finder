import os
import json
from typing import List, Dict, Any
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity
import google.generativeai as genai
from slack_oauth import router as slack_oauth_router

# Setup
app = FastAPI(
    title="Chat Message Clustering API",
    description="AI-powered clustering service for chat messages",
    version="0.0.1"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Slack OAuth router
app.include_router(slack_oauth_router)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class MessageInput(BaseModel):
    text: str
    channel: str
    user: str
    timestamp: str
    link: str

class ClusterRequest(BaseModel):
    messages: List[MessageInput]
    sensitivity: float = 0.5  # 0.0 to 1.0 (distance threshold)

def get_embeddings(texts: List[str]) -> np.ndarray:
    """
    Batch fetch embeddings from Gemini.
    """
    # In production, batch this in groups of 100 to avoid limits
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=texts,
        task_type="clustering",
    )
    return np.array(result['embedding'])

def generate_cluster_label(messages: List[str]) -> str:
    """
    Uses Gemini to generate a short 3-5 word title for a group of messages.
    """
    prompt = f"Summarize these related chat messages into a specific 3-5 word topic title:\n{messages[:10]}"
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content(prompt)
    return response.text.strip()

@app.post("/process-clustering")
async def process_clustering(request: ClusterRequest):
    """
    Takes raw messages, time-groups them, embeds them, and clusters them.
    Returns a graph-ready JSON structure.
    """
    raw_msgs = request.messages
    if not raw_msgs:
        return {"nodes": [], "links": []}

    # 1. Pre-processing: Time Window Grouping
    # We group messages if they are same channel, same user, < 5 min apart
    # This reduces the number of nodes the LLM has to process
    grouped_messages = []
    current_group = [raw_msgs[0]]
    
    for i in range(1, len(raw_msgs)):
        prev = raw_msgs[i-1]
        curr = raw_msgs[i]
        
        # Parse ISO timestamps
        t_prev = datetime.fromisoformat(prev.timestamp.replace('Z', '+00:00'))
        t_curr = datetime.fromisoformat(curr.timestamp.replace('Z', '+00:00'))
        
        time_diff = (t_curr - t_prev).total_seconds()
        
        if curr.channel == prev.channel and time_diff < 300: # 5 mins
            current_group.append(curr)
        else:
            # Seal the group
            grouped_messages.append(current_group)
            current_group = [curr]
    grouped_messages.append(current_group)

    # 2. Prepare text for embedding (join messages in group)
    group_texts = [" ".join([m.text for m in g]) for g in grouped_messages]
    
    # 3. Get Embeddings
    try:
        embeddings = get_embeddings(group_texts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

    # 4. Deterministic Hierarchical Clustering
    # AgglomerativeClustering is deterministic. 
    # Distance threshold determines how "tight" the clusters are.
    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=1.0 - request.sensitivity, # Convert similarity to distance
        metric='cosine',
        linkage='average'
    )
    labels = clustering.fit_predict(embeddings)

    # 5. Build Graph Structure
    clusters = {}
    nodes = []
    links = []

    # Organize by cluster label
    for idx, label in enumerate(labels):
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(idx)

    # Process each cluster to create Parent Nodes
    for label_id, group_indices in clusters.items():
        # Get texts for this cluster to generate a title
        cluster_texts = [group_texts[i] for i in group_indices]
        
        # AI Label Generation
        topic_title = generate_cluster_label(cluster_texts)
        
        # Create Parent Node (The Topic)
        parent_id = f"cluster_{label_id}"
        nodes.append({
            "id": parent_id,
            "name": topic_title,
            "type": "cluster",
            "val": len(group_indices) * 2 # Size based on message count
        })

        # Create Child Nodes (The specific message threads)
        for idx in group_indices:
            msg_group = grouped_messages[idx]
            node_id = f"msg_{idx}"
            
            nodes.append({
                "id": node_id,
                "name": msg_group[0].text[:50] + "...", # Preview
                "full_text": "\n".join([m.text for m in msg_group]),
                "link": msg_group[0].link,
                "type": "message",
                "val": 1,
                "parent": parent_id
            })
            
            # Link Child to Parent
            links.append({
                "source": parent_id,
                "target": node_id
            })

    return {
        "nodes": nodes,
        "links": links,
        "meta": {"total_clusters": len(clusters)}
    }