# Setting Up Gemini API Key

The clustering feature requires a Google Gemini API key to generate embeddings and cluster labels.

## Quick Setup

### Option 1: Using .env file (Recommended)

1. Create a `.env` file in the `backend` directory:
   ```bash
   cd backend
   echo 'GEMINI_API_KEY=your_api_key_here' > .env
   ```

2. Replace `your_api_key_here` with your actual API key

3. The `run_gemini.sh` script will automatically load it

### Option 2: Export in Terminal

```bash
export GEMINI_API_KEY=your_api_key_here
```

Then run the server:
```bash
cd backend
./run_gemini.sh
```

## Getting Your API Key

1. Go to: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and use it in one of the methods above

## Security Note

- Never commit your `.env` file to git
- The `.env` file is already in `.gitignore`
- Don't share your API key publicly

## Testing

After setting the key, restart the server and try clustering again. You should see:
```
✓ GEMINI_API_KEY is set (length: XX)
```

Instead of the error message.

