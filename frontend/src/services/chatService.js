/**
 * Service for managing user chats in Supabase
 */
import { supabase } from '../supabaseClient';

/**
 * Get all chats for the current user
 * @returns {Promise<Array>} Array of user chats
 */
export const getUserChats = async () => {
  const { data, error } = await supabase
    .from('user_chats')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Get a single chat by ID
 * @param {string} chatId - Chat ID
 * @returns {Promise<Object>} Chat object
 */
export const getChatById = async (chatId) => {
  const { data, error } = await supabase
    .from('user_chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Create a new chat
 * @param {Object} chatData - Chat data
 * @returns {Promise<Object>} Created chat
 */
export const createChat = async ({ title, source, config = {} }) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_chats')
    .insert([
      {
        user_id: user.id,
        title,
        source,
        config,
        messages: [],
        clustering_data: {}
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Update a chat
 * @param {string} chatId - Chat ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated chat
 */
export const updateChat = async (chatId, updates) => {
  const { data, error } = await supabase
    .from('user_chats')
    .update(updates)
    .eq('id', chatId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<void>}
 */
export const deleteChat = async (chatId) => {
  const { error } = await supabase
    .from('user_chats')
    .delete()
    .eq('id', chatId);

  if (error) throw error;
};

/**
 * Save messages to a chat
 * @param {string} chatId - Chat ID
 * @param {Array} messages - Messages array
 * @returns {Promise<Object>} Updated chat
 */
export const saveChatMessages = async (chatId, messages) => {
  console.log(`Saving ${messages.length} messages to chat ${chatId}`);
  
  const result = await updateChat(chatId, { 
    messages,
    updated_at: new Date().toISOString()
  });
  
  console.log('Messages saved successfully');
  return result;
};

/**
 * Save clustering data to a chat
 * @param {string} chatId - Chat ID
 * @param {Object} clusteringData - Clustering data
 * @returns {Promise<Object>} Updated chat
 */
export const saveChatClusteringData = async (chatId, clusteringData) => {
  return updateChat(chatId, { clustering_data: clusteringData });
};

/**
 * Get settings for a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<Object>} Settings object
 */
export const getChatSettings = async (chatId) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('chat_id', chatId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data?.settings || {};
};

/**
 * Save settings for a chat
 * @param {string} chatId - Chat ID
 * @param {Object} settings - Settings object
 * @returns {Promise<Object>} Updated settings
 */
export const saveChatSettings = async (chatId, settings) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Try to update first
  const { data: existing } = await supabase
    .from('user_settings')
    .select('id')
    .eq('user_id', user.id)
    .eq('chat_id', chatId)
    .single();

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('user_settings')
      .update({ settings })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('user_settings')
      .insert([
        {
          user_id: user.id,
          chat_id: chatId,
          settings
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

export default {
  getUserChats,
  getChatById,
  createChat,
  updateChat,
  deleteChat,
  saveChatMessages,
  saveChatClusteringData,
  getChatSettings,
  saveChatSettings,
};

