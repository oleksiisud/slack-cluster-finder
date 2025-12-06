# main_gemini.py
import os
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import hdbscan
import umap
import google.generativeai as genai

# Load env
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

app = FastAPI(
    title="Chat Message Clustering API (Semantic)",
    version="0.3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or explicit list
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("[WARNING] GEMINI_API_KEY not set — embeddings will fail")

# Threshold for small vs large JSON
SMALL_JSON_LIMIT = 300

# Models
class MessageInput(BaseModel):
    text: str
    channel: str = ""
    user: str = ""
    timestamp: str = ""
    link: str = ""

class ClusterRequest(BaseModel):
    messages: List[MessageInput]
    sensitivity: float = 0.5  # 0=coarse, 1=fine

# --- Utility functions ---

def get_embeddings(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 0))
    try:
        res = genai.embed_content(
            model="models/text-embedding-004",
            content=texts,
            task_type="clustering"
        )
        emb = np.array(res['embedding'])
        return emb
    except Exception as e:
        print("Error embedding:", e)
        raise

def generate_cluster_label(messages: List[str]) -> str:
    if not messages:
        return "Media / Empty Messages"
    try:
        sample = messages[:20]
        prompt = f"""Below are chat messages. Summarize the main topic in 3–6 words ONLY:

Messages:
{chr(10).join(['- ' + m.replace('\\n',' ')[:300] for m in sample])}
"""
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        title = resp.text.strip().strip('"').strip("'")
        if len(title) < 2 or title.lower() in {"topic", "discussion", "messages", "chat"}:
            raise ValueError("Bad title from LLM")
        return title
    except Exception:
        # Fallback: top 3 keywords
        all_text = " ".join(messages).lower()
        words = [w for w in all_text.split() if len(w) > 3]
        freq: Dict[str, int] = {}
        for w in words:
            freq[w] = freq.get(w, 0) + 1
        keywords = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)
        top = [kw for kw, _ in keywords[:3]]
        title = " ".join([w.capitalize() for w in top]) or "Discussion"
        return title

def build_graph(clusters: Dict[int, List[int]], raw_messages: List[MessageInput], texts: List[str]) -> Dict:
    nodes, links = [], []
    for lbl, members in clusters.items():
        member_texts = [texts[i] for i in members if texts[i]]
        title = generate_cluster_label(member_texts)
        parent_id = f"cluster_{lbl}"
        nodes.append({
            "id": parent_id,
            "name": title,
            "type": "cluster",
            "val": len(members)
        })
        for orig_idx in members:
            msg = raw_messages[orig_idx]
            mid = f"msg_{orig_idx}"
            nodes.append({
                "id": mid,
                "name": (msg.text or "")[:100],
                "full_text": msg.text or "",
                "link": msg.link or "",
                "type": "message",
                "parent": parent_id,
                "val": 1
            })
            links.append({"source": parent_id, "target": mid})
    return {"nodes": nodes, "links": links, "meta": {"clusters": len(clusters)}}

# --- Small JSON clustering ---
def cluster_small(messages: List[MessageInput], sensitivity: float):
    texts = [m.text.strip() if m.text else "" for m in messages]
    nonempty_idx = [i for i, t in enumerate(texts) if t]
    if not nonempty_idx:
        return build_graph({0: list(range(len(messages)))}, messages, texts)
    
    embeddings = get_embeddings([texts[i] for i in nonempty_idx])
    # Use HDBSCAN for smaller sets
    clusterer = hdbscan.HDBSCAN(min_cluster_size=2, metric='euclidean')
    labels = clusterer.fit_predict(embeddings)
    clusters: Dict[int, List[int]] = {}
    for local_idx, lbl in enumerate(labels):
        orig_idx = nonempty_idx[local_idx]
        clusters.setdefault(int(lbl), []).append(orig_idx)
    # add empty messages
    empties = [i for i, t in enumerate(texts) if not t]
    if empties:
        clusters.setdefault(-1, []).extend(empties)
    return build_graph(clusters, messages, texts)

# --- Large JSON clustering ---
def cluster_large(messages: List[MessageInput], sensitivity: float):
    texts = [m.text.strip() if m.text else "" for m in messages]
    nonempty_idx = [i for i, t in enumerate(texts) if t]
    if not nonempty_idx:
        return build_graph({0: list(range(len(messages)))}, messages, texts)
    
    # Embeddings
    embeddings = get_embeddings([texts[i] for i in nonempty_idx])
    # UMAP dimensionality reduction
    reducer = umap.UMAP(n_neighbors=15, min_dist=0.0, n_components=5, metric='cosine')
    reduced = reducer.fit_transform(embeddings)
    
    # HDBSCAN clustering on reduced space
    clusterer = hdbscan.HDBSCAN(min_cluster_size=5, metric='euclidean')
    labels = clusterer.fit_predict(reduced)
    clusters: Dict[int, List[int]] = {}
    for local_idx, lbl in enumerate(labels):
        orig_idx = nonempty_idx[local_idx]
        clusters.setdefault(int(lbl), []).append(orig_idx)
    # assign empty/media messages
    empties = [i for i, t in enumerate(texts) if not t]
    if empties:
        clusters.setdefault(-1, []).extend(empties)
    return build_graph(clusters, messages, texts)

# --- Endpoint ---
@app.post("/process-clustering")
async def process_clustering(request: ClusterRequest):
    messages = request.messages or []
    if not messages:
        return {"nodes": [], "links": [], "meta": {"clusters": 0}}
    
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    
    if len(messages) <= SMALL_JSON_LIMIT:
        return cluster_small(messages, request.sensitivity)
    else:
        return cluster_large(messages, request.sensitivity)
