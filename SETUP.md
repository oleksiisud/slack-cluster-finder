# Setup and run instructions

This document explains how to set up a local development environment for the extractors in this repository, how to obtain tokens, and how to run the mock and real extraction modes.

1) Create a virtual environment and install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2) Create a `.env` file from the example

```bash
cp .env.example .env
# Edit .env and paste your tokens (do not commit .env)
```

Fill the variables:
- `SLACK_BOT_TOKEN` (xoxb-...)
- `SLACK_APP_TOKEN` (xapp-..., required for Socket Mode)
- `DISCORD_BOT_TOKEN`

3) Run the mock extractors (no tokens required)

```bash
python3 tests/run_extractors.py
```

This will produce `out/slack_messages.ndjson` and `out/discord_messages.ndjson`.

4) Run against real APIs (after setting tokens in `.env`)

Slack (API mode):
```bash
python3 tools/slack_extract.py --mode api --token "$SLACK_BOT_TOKEN" --out out/slack_messages.ndjson
```

Discord (API mode):
```bash
python3 tools/discord_extract.py --mode api --token "$DISCORD_BOT_TOKEN" --out out/discord_messages.ndjson
```

Notes:
- The scripts auto-load `.env` (via `python-dotenv`). If you prefer, you can export env vars instead of using `.env`.
- For production ingestion, consider wiring `tools/storage.py` to persist into SQLite/Postgres and storing raw payloads in object storage.
