## Security: exposed secrets handling

If you find real tokens or secrets committed to this repository (for example in `.env.example`), follow these steps immediately.

1) Rotate the tokens in their provider portals
   - Slack: go to your App in https://api.slack.com/apps -> OAuth & Permissions, click **Revoke Tokens** / regenerate the Bot token and App-level token.
   - Discord: go to Developer Portal -> Applications -> your app -> Bot -> click **Regenerate** to rotate the token.

2) Remove the secret from the current branch and commit the fix
   - Edit the file(s) to remove the secret(s) (replace with placeholders). Then commit and push.

3) Purge the secret from git history (choose one approach)

Option A — BFG Repo-Cleaner (recommended for ease):

```bash
# 1. Make a backup clone
git clone --mirror git@github.com:yourorg/yourrepo.git repo-backup.git

# 2. Run BFG to remove the secrets (example removes any line that contains the string 'xoxb-' or your token pattern)
bfg --delete-lines "xoxb-" --delete-lines "xapp-" --delete-lines "DISCORD_BOT_TOKEN"

# 3. Push the cleaned repo
cd repo-backup.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

Option B — git filter-repo (more powerful/flexible):

```bash
# Install git-filter-repo (follow instructions for your OS)
# Example usage to remove a file or match:
git filter-repo --invert-paths --paths .env.example
# or to replace tokens by regex
git filter-repo --replace-text replacements.txt
```

Notes about history rewriting
- Rewriting history is destructive. Coordinate with your team. All collaborators must re-clone or reset their local clones.
- After rewrite, rotate any tokens anyway since they may have leaked.

4) Prevent future commits
   - Add `.env` to `.gitignore` (already present).
   - Add a pre-commit hook or use `pre-commit` with `detect-secrets` to block secrets.

Example pre-commit (quick):

```bash
pip install pre-commit detect-secrets
pre-commit install
# Add .pre-commit-config.yaml with detect-secrets hook
```

If you want, I can:
- Make the `.env.example` safe (I already removed secrets in this branch).
- Add a short `.pre-commit-config.yaml` with `detect-secrets` and install instructions.
- Prepare the BFG or filter-repo command sequence for you with exact patterns to remove.
