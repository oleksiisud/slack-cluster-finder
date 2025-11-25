# Chat Message Clustering Backend

AI-powered clustering service for chat messages using Sentence Transformers and open-source LLMs.

## Features

- **Semantic Embeddings**: Uses Sentence Transformers (all-MiniLM-L6-v2) for high-quality message embeddings
- **Hierarchical Clustering**: Deterministic clustering algorithm with configurable parameters
- **Auto-Labeling**: Generates human-readable labels and tags using open-source LLMs (FLAN-T5)
- **Caching**: Smart caching system to avoid re-clustering identical datasets
- **Fast API**: RESTful API with async support for large datasets
- **100% Open Source**: No paid APIs, runs entirely on open-source models

## Installation

1. **Create a virtual environment**:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

## Quick Start

Start the server:
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## API Endpoints

### Clustering Endpoints

#### POST `/cluster`
Cluster messages and generate topic labels.

**Request body**:
```json
{
  "messages": [
    {
      "text": "Has anyone used pandas for data analysis?",
      "channel": "general",
      "user": "user_123",
      "timestamp": "2025-11-14T17:00:00Z"
    }
  ],
  "force_recluster": false,
  "distance_threshold": 1.0,
  "min_cluster_size": 2
}
```

**Response**:
```json
{
  "messages": [
    {
      "text": "...",
      "channel": "...",
      "user": "...",
      "timestamp": "...",
      "message_id": "msg_abc123",
      "tags": ["data-analysis", "pandas", "python"],
      "cluster_id": "cluster_0"
    }
  ],
  "clusters": [
    {
      "cluster_id": "cluster_0",
      "label": "Data Analysis with Pandas",
      "tags": ["data-analysis", "pandas", "python"],
      "message_ids": ["msg_abc123", ...],
      "size": 15,
      "centroid": [0.123, ...],
      "parent_cluster_id": null,
      "child_cluster_ids": []
    }
  ],
  "metadata": {
    "processing_time_seconds": 12.5,
    "total_messages": 100,
    "total_clusters": 8,
    "timestamp": "2025-11-15T10:30:00Z"
  }
}
```

### POST `/cluster/async`
Start clustering job in background (for large datasets).

### GET `/cluster/status/{job_id}`
Check status of background clustering job.

### GET `/cluster/result/{job_id}`
Get results of completed clustering job.

### GET `/models/info`
Get information about loaded models.

### POST `/cache/clear`
Clear the clustering cache.

### Slack Integration Endpoints

#### POST `/slack/test`
Test Slack API connection with a user token.

**Request body**:
```json
{
  "user_token": "xoxp-your-token-here"
}
```

**Response**:
```json
{
  "ok": true,
  "user": "john_doe",
  "team": "MyCompany",
  "user_id": "U123ABC",
  "error": null
}
```

#### POST `/slack/fetch`
Fetch messages directly from Slack workspace.

**Request body**:
```json
{
  "user_token": "xoxp-your-token-here",
  "include_public": true,
  "include_private": true,
  "include_dms": false,
  "include_permalinks": false
}
```

**Response**: Array of messages in standard format (same as `/cluster` input)

**Note**: See `SLACK_INTEGRATION_GUIDE.md` for detailed setup instructions.

## Configuration

Edit `.env` file or set environment variables:

- `EMBEDDING_MODEL`: Sentence Transformer model (default: `all-MiniLM-L6-v2`)
- `LLM_MODEL`: LLM for label generation (default: `google/flan-t5-base`)
- `MIN_CLUSTER_SIZE`: Minimum messages per cluster (default: 2)
- `DISTANCE_THRESHOLD`: Clustering distance threshold (default: 1.0)
- `RANDOM_SEED`: Seed for deterministic results (default: 42)

## Model Information

### Embedding Model: all-MiniLM-L6-v2
- **Size**: ~80MB
- **Dimension**: 384
- **Speed**: Very fast
- **Quality**: Good for general text

### LLM Model: google/flan-t5-base
- **Size**: ~900MB
- **Type**: Seq2Seq
- **Speed**: Fast
- **Quality**: Good for summarization and topic extraction

## Performance

- **Embedding**: ~1000 messages/second on CPU
- **Clustering**: O(n²) for hierarchical clustering
- **Label Generation**: ~2-3 seconds per cluster

For large datasets (>10k messages), use the async endpoint.

## Troubleshooting

**Out of memory**: Reduce `BATCH_SIZE` in `.env`

**Slow clustering**: Increase `DISTANCE_THRESHOLD` to create fewer, larger clusters

**Poor labels**: Try a different LLM model (e.g., `facebook/bart-base`)

## Architecture

```
FastAPI                       (REST API)
    │
Cluster Orchestrator          (Pipeline coordination)
    │
    ├──► Embedding Service    (Sentence Transformers)
    ├──► Clustering Service   (Scikit-learn)
    └──► Label Generation     (Transformers + LLM)
```

