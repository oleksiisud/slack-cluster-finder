/**
 * Discord OAuth integration service
 */
import { supabase } from '../supabaseClient';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const DISCORD_REDIRECT_URI = import.meta.env.VITE_DISCORD_REDIRECT_URI || `${window.location.origin}/discord/callback`;

/**
 * Discord OAuth scopes needed for message access
 */
const DISCORD_SCOPES = [
  'identify',
  'guilds',
  'guilds.members.read',
  'messages.read'
].join('%20');

/**
 * Initiate Discord OAuth flow
 */
export const initiateDiscordAuth = () => {
  const state = generateState();
  sessionStorage.setItem('discord_oauth_state', state);
  
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${DISCORD_SCOPES}&state=${state}`;
  
  window.location.href = authUrl;
};

/**
 * Handle Discord OAuth callback
 * @param {string} code - Authorization code from Discord
 * @param {string} state - State parameter for CSRF protection
 * @returns {Promise} Token exchange result
 */
export const handleDiscordCallback = async (code, state) => {
  const savedState = sessionStorage.getItem('discord_oauth_state');
  
  if (state !== savedState) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }
  
  sessionStorage.removeItem('discord_oauth_state');
  
  // Exchange code for token via backend
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/discord/oauth/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, redirect_uri: DISCORD_REDIRECT_URI }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }
  
  const data = await response.json();
  
  // Store token in Supabase for the current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    await saveDiscordToken(user.id, data);
  }
  
  return data;
};

/**
 * Save Discord token to Supabase
 * @param {string} userId - User ID
 * @param {Object} tokenData - Token data from Discord
 */
export const saveDiscordToken = async (userId, tokenData) => {
  const { error } = await supabase
    .from('discord_tokens')
    .upsert({
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      scope: tokenData.scope,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id'
    });
  
  if (error) throw error;
};

/**
 * Get Discord token for current user
 * @returns {Promise} Discord token data
 */
export const getDiscordToken = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');
  
  const { data, error } = await supabase
    .from('discord_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  if (error) throw error;
  
  return data;
};

/**
 * Delete Discord token for current user
 */
export const deleteDiscordToken = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');
  
  const { error } = await supabase
    .from('discord_tokens')
    .delete()
    .eq('user_id', user.id);
  
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
  initiateDiscordAuth,
  handleDiscordCallback,
  saveDiscordToken,
  getDiscordToken,
  deleteDiscordToken,
};
