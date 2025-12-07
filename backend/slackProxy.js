const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 5000; // Changed port to avoid conflict with frontend

// Configure CORS to allow requests from the frontend
const corsOptions = {
  origin: 'http://localhost:5173', // Replace with your frontend's origin
  methods: ['GET', 'POST', 'OPTIONS'], // Allow specific HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
};

// Apply CORS middleware globally
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());

app.post('/api/slack/messages', async (req, res) => {
  const { slackToken, channelId } = req.body;

  if (!slackToken || !channelId) {
    return res.status(400).json({ error: 'Slack token and channel ID are required.' });
  }

  try {
    const response = await axios.get('https://slack.com/api/conversations.history', {
      headers: {
        Authorization: `Bearer ${slackToken}`,
      },
      params: {
        channel: channelId,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Slack messages:', error.message);
    res.status(500).json({ error: 'Failed to fetch Slack messages.' });
  }
});

app.listen(PORT, () => {
  console.log(`Slack Proxy running on http://localhost:${PORT}`);
});
