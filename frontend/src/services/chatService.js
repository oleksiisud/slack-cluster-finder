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
export const createChat = async ({ title, source, config = {}, access_token = null }) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Build the chat object - only include access_token if provided
  const chatData = {
    user_id: user.id,
    title,
    source,
    config,
    messages: [],
    clustering_data: {}
  };
  
  // Only add access_token if it's provided (for Slack OAuth flows)
  // For JSON uploads, this will be null/undefined which is fine
  if (access_token !== null && access_token !== undefined) {
    chatData.access_token = access_token;
  }

  const { data, error } = await supabase
    .from('user_chats')
    .insert([chatData])
    .select()
    .single();

  if (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
  
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
// export const deleteChat = async (chatId) => {
//   const { error } = await supabase
//     .from('user_chats')
//     .delete()
//     .eq('id', chatId);
//     .eq("user_id", user.id);

//   if (error) throw error;
// };

export const deleteChat = async (chatId) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("user_chats")
    .delete()
    .eq("id", chatId)
    .eq("user_id", user.id); 

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
  console.log("saveChatClusteringData called with:", {
    chatId,
    hasNodes: !!clusteringData?.nodes,
    nodeCount: clusteringData?.nodes?.length,
    hasLinks: !!clusteringData?.links,
    linkCount: clusteringData?.links?.length
  });
  
  const result = await updateChat(chatId, { clustering_data: clusteringData });
  
  console.log("saveChatClusteringData result:", {
    success: !!result,
    hasClusteringData: !!result?.clustering_data,
    clusteringDataType: typeof result?.clustering_data
  });
  
  return result;
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

