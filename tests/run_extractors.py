"""Run both extractors in mock mode and do a simple validation check."""
import os
import json
import subprocess
import sys


def run_cmd(cmd):
    print("Running:", " ".join(cmd))
    res = subprocess.run(cmd, check=False)
    return res.returncode


def count_lines(path):
    if not os.path.exists(path):
        return 0
    with open(path, "r", encoding="utf-8") as f:
        return sum(1 for _ in f)


def main():
    out_dir = "out"
    os.makedirs(out_dir, exist_ok=True)
    slack_out = os.path.join(out_dir, "slack_messages.ndjson")
    disc_out = os.path.join(out_dir, "discord_messages.ndjson")
    # remove old outputs
    for p in [slack_out, disc_out]:
        try:
            os.remove(p)
        except FileNotFoundError:
            pass

    rc = run_cmd([sys.executable, "tools/slack_extract.py", "--mode", "mock", "--mock-path", "tests/mock/slack_export.json", "--out", slack_out])
    if rc != 0:
        raise SystemExit("slack extractor failed")
    rc = run_cmd([sys.executable, "tools/discord_extract.py", "--mode", "mock", "--mock-path", "tests/mock/discord_export.json", "--out", disc_out])
    if rc != 0:
        raise SystemExit("discord extractor failed")

    s_count = count_lines(slack_out)
    d_count = count_lines(disc_out)
    print(f"Slack lines: {s_count}, Discord lines: {d_count}")
    if s_count < 1 or d_count < 1:
        raise SystemExit("Validation failed: expected at least 1 record from each extractor")
    print("Mock extraction validation passed")


if __name__ == "__main__":
    main()
