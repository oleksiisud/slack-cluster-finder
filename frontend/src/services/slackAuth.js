/**
 * Slack OAuth integration service
 */
import { supabase } from '../supabaseClient';

const SLACK_CLIENT_ID = import.meta.env.VITE_SLACK_CLIENT_ID;
const SLACK_REDIRECT_URI = import.meta.env.VITE_SLACK_REDIRECT_URI || `${window.location.origin}/slack/callback`;
console.log("Using redirect URI:", SLACK_REDIRECT_URI);

/**
 * Slack OAuth scopes needed for message access
 */
const SLACK_SCOPES = [
  'channels:history',
  'channels:read',
  'groups:history',
  'groups:read',
  'im:history',
  'im:read',
  'mpim:history',
  'mpim:read',
  'users:read',
  'team:read'
].join(',');

/**
 * Initiate Slack OAuth flow
 */
export const initiateSlackAuth = () => {
  const state = generateState();
  sessionStorage.setItem('slack_oauth_state', state);
  
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${SLACK_SCOPES}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}&state=${state}`;
  
  window.location.href = authUrl;
};

/**
 * Handle Slack OAuth callback
 * @param {string} code - Authorization code from Slack
 * @param {string} state - State parameter for CSRF protection
 * @returns {Promise} Token exchange result
 */
export const handleSlackCallback = async (code, state) => {
  const savedState = sessionStorage.getItem('slack_oauth_state');
  
  if (state !== savedState) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }
  
  sessionStorage.removeItem('slack_oauth_state');
  
  // Exchange code for token via backend
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/slack/oauth/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, redirect_uri: SLACK_REDIRECT_URI }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }
  
  const data = await response.json();
  
  // Store token in Supabase for the current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    await saveSlackToken(user.id, data);
  }
  
  return data;
};

/**
 * Save Slack token to Supabase
 * @param {string} userId - User ID
 * @param {Object} tokenData - Token data from Slack
 */
export const saveSlackToken = async (userId, tokenData) => {
  const { error } = await supabase
    .from('slack_tokens')
    .upsert({
      user_id: userId,
      access_token: tokenData.access_token,
      team_id: tokenData.team?.id,
      team_name: tokenData.team?.name,
      bot_user_id: tokenData.bot_user_id,
      scope: tokenData.scope,
      token_type: tokenData.token_type,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,team_id'
    });
  
  if (error) throw error;
};

/**
 * Get Slack token for current user
 * @param {string} teamId - Optional team ID to filter by
 * @returns {Promise} Slack token data
 */
export const getSlackToken = async (teamId = null) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');
  
  try {
    let query = supabase
      .from('slack_tokens')
      .select('*')
      .eq('user_id', user.id);
    
    if (teamId) {
      query = query.eq('team_id', teamId);
    }
    
    const { data, error } = await query.single();
    
    // If table doesn't exist or no token found, return null instead of throwing
    if (error) {
      // 404 or PGRST116 means no rows found (table might not exist or no token)
      if (error.code === 'PGRST116' || error.status === 404) {
        return null;
      }
      // For other errors, log but don't throw
      console.warn('Error fetching Slack token:', error.message);
      return null;
    }
    
    return data;
  } catch (err) {
    // Handle any unexpected errors gracefully
    console.warn('Error checking Slack token:', err.message);
    return null;
  }
};

/**
 * Delete Slack token for current user
 * @param {string} teamId - Team ID
 */
export const deleteSlackToken = async (teamId) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');
  
  const { error } = await supabase
    .from('slack_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('team_id', teamId);
  
  if (error) throw error;
};

/**
 * Generate random state for CSRF protection
 */
function generateState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export default {
  initiateSlackAuth,
  handleSlackCallback,
  saveSlackToken,
  getSlackToken,
  deleteSlackToken,
};

