/**
 * API service for interacting with the clustering backend
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes for large clustering jobs
});

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

export default api;

