/**
 * API service for interacting with the clustering backend
 */
import axios from 'axios';


console.log("API_BASE_URL =", import.meta.env.VITE_API_BASE_URL);
console.log("GEMINI_API_BASE_URL =", import.meta.env.VITE_GEMINI_API_BASE_URL);


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const GEMINI_API_BASE_URL = import.meta.env.VITE_GEMINI_API_BASE_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes for large clustering jobs
});

const geminiApi = axios.create({
  baseURL: GEMINI_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000,
});

/**
 * Check if the Gemini API backend is available
 * @returns {Promise<boolean>} True if backend is running
 */
export const checkGeminiApiHealth = async () => {
  try {
    console.log(`Checking Gemini API health at ${GEMINI_API_BASE_URL}/health`);
    const response = await geminiApi.get('/health', { timeout: 5000 });
    console.log('Health check response:', response.data);
    return response.status === 200;
  } catch (error) {
    console.warn('Gemini API health check failed:', error.message);
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error(`Cannot connect to ${GEMINI_API_BASE_URL}. Is the server running?`);
    }
    return false;
  }
};

/**
 * Check Gemini API key status and quota
 * @returns {Promise<Object>} API status information
 */
export const checkGeminiApiStatus = async () => {
  try {
    console.log(`Checking Gemini API status at ${GEMINI_API_BASE_URL}/api-status`);
    const response = await geminiApi.get('/api-status', { timeout: 10000 });
    console.log('API status response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Gemini API status check failed:', error);
    return {
      status: 'error',
      message: error.message || 'Failed to check API status',
      test_successful: false
    };
  }
};

/**
 * Cluster messages
 * @param {Array} messages - Array of message objects
 * @param {boolean} forceRecluster - Force re-clustering
 * @param {number} distanceThreshold - Distance threshold
 * @param {number} minClusterSize - Minimum cluster size
 * @returns {Promise} Clustering result
 */
export const clusterMessages = async (
  messages,
  forceRecluster = false,
  distanceThreshold = null,
  minClusterSize = null
) => {
  const response = await api.post('/cluster', {
    messages,
    force_recluster: forceRecluster,
    distance_threshold: distanceThreshold,
    min_cluster_size: minClusterSize,
  });
  return response.data;
};

/**
 * Start async clustering job
 * @param {Array} messages - Array of message objects
 * @param {boolean} forceRecluster - Force re-clustering
 * @returns {Promise} Job ID
 */
export const clusterMessagesAsync = async (messages, forceRecluster = false) => {
  const response = await api.post('/cluster/async', {
    messages,
    force_recluster: forceRecluster,
  });
  return response.data;
};

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @returns {Promise} Job status
 */
export const getJobStatus = async (jobId) => {
  const response = await api.get(`/cluster/status/${jobId}`);
  return response.data;
};

/**
 * Get job result
 * @param {string} jobId - Job ID
 * @returns {Promise} Clustering result
 */
export const getJobResult = async (jobId) => {
  const response = await api.get(`/cluster/result/${jobId}`);
  return response.data;
};

/**
 * Get models info
 * @returns {Promise} Models information
 */
export const getModelsInfo = async () => {
  const response = await api.get('/models/info');
  return response.data;
};

/**
 * Clear cache
 * @returns {Promise} Clear cache result
 */
export const clearCache = async () => {
  const response = await api.post('/cache/clear');
  return response.data;
};

/**
 * Health check
 * @returns {Promise} Health status
 */
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

/**
 * Test Slack connection
 * @param {string} userToken - Slack user token
 * @returns {Promise} Connection test result
 */
export const testSlackConnection = async (userToken) => {
  const response = await api.post('/slack/test', {
    user_token: userToken,
  });
  return response.data;
};

/**
 * Fetch messages from Slack
 * @param {string} userToken - Slack user token
 * @param {boolean} includePublic - Include public channels
 * @param {boolean} includePrivate - Include private channels
 * @param {boolean} includeDms - Include direct messages
 * @param {boolean} includePermalinks - Include message permalinks
 * @returns {Promise} List of messages
 */
export const fetchSlackMessages = async (
  userToken,
  includePublic = true,
  includePrivate = true,
  includeDms = false,
  includePermalinks = false
) => {
  const response = await api.post('/slack/fetch', {
    user_token: userToken,
    include_public: includePublic,
    include_private: includePrivate,
    include_dms: includeDms,
    include_permalinks: includePermalinks,
  });
  return response.data;
};

/**
 * Process clustering using Gemini embeddings
 * @param {Array} messages - Array of message objects with text, channel, user, timestamp, link
 * @param {number} sensitivity - Clustering sensitivity (0.0 to 1.0)
 * @returns {Promise} Graph data with nodes and links
 */
export const processClusteringGemini = async (messages, sensitivity = 0.5) => {
  try {
    console.log(`Calling Gemini API at ${GEMINI_API_BASE_URL}/process-clustering`);
    console.log(`Sending ${messages.length} messages`);
    
    const response = await geminiApi.post('/process-clustering', {
      messages,
      sensitivity,
    });
    
    console.log('Gemini API response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Gemini API error:', error);
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error(`Cannot connect to clustering service at ${GEMINI_API_BASE_URL}. Please make sure the backend server is running.`);
    }
    throw error;
  }
};

export default api;

