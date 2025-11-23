/**
 * Client-side cache manager using localStorage
 */

const CACHE_PREFIX = 'cluster_cache_';
const CACHE_METADATA_KEY = 'cluster_cache_metadata';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Generate cache key from messages
 * @param {Array} messages - Array of messages
 * @returns {string} Cache key
 */
const generateCacheKey = (messages) => {
  const content = messages.map(m => m.text).join('');
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${CACHE_PREFIX}${Math.abs(hash)}`;
};

/**
 * Save clustering result to cache
 * @param {Array} messages - Original messages
 * @param {Object} result - Clustering result
 */
export const saveToCacheStorage = (messages, result) => {
  try {
    const cacheKey = generateCacheKey(messages);
    const cacheEntry = {
      data: result,
      timestamp: Date.now(),
      messageCount: messages.length,
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    
    // Update metadata
    updateCacheMetadata(cacheKey, cacheEntry);
    
    console.log(`Saved to cache: ${cacheKey}`);
  } catch (error) {
    console.error('Failed to save to cache:', error);
    // If quota exceeded, clear old cache entries
    if (error.name === 'QuotaExceededError') {
      clearOldestCache();
      // Try again
      saveToCacheStorage(messages, result);
    }
  }
};

/**
 * Load clustering result from cache
 * @param {Array} messages - Original messages
 * @returns {Object|null} Cached result or null
 */
export const loadFromCacheStorage = (messages) => {
  try {
    const cacheKey = generateCacheKey(messages);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    const cacheEntry = JSON.parse(cached);
    
    // Check if cache is still valid
    const age = Date.now() - cacheEntry.timestamp;
    if (age > DEFAULT_TTL) {
      console.log('Cache expired, removing...');
      localStorage.removeItem(cacheKey);
      removeCacheMetadata(cacheKey);
      return null;
    }
    
    console.log(`Loaded from cache: ${cacheKey}`);
    return cacheEntry.data;
  } catch (error) {
    console.error('Failed to load from cache:', error);
    return null;
  }
};

/**
 * Clear specific cache entry
 * @param {string} cacheKey - Cache key to clear
 */
export const clearCacheEntry = (cacheKey) => {
  try {
    localStorage.removeItem(cacheKey);
    removeCacheMetadata(cacheKey);
    console.log(`Cleared cache: ${cacheKey}`);
  } catch (error) {
    console.error('Failed to clear cache entry:', error);
  }
};

/**
 * Clear all cluster cache
 */
export const clearAllCache = () => {
  try {
    const metadata = getCacheMetadata();
    
    Object.keys(metadata).forEach(key => {
      localStorage.removeItem(key);
    });
    
    localStorage.removeItem(CACHE_METADATA_KEY);
    console.log('Cleared all cluster cache');
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
};

/**
 * Get cache metadata
 * @returns {Object} Cache metadata
 */
const getCacheMetadata = () => {
  try {
    const metadata = localStorage.getItem(CACHE_METADATA_KEY);
    return metadata ? JSON.parse(metadata) : {};
  } catch (error) {
    return {};
  }
};

/**
 * Update cache metadata
 * @param {string} cacheKey - Cache key
 * @param {Object} entry - Cache entry
 */
const updateCacheMetadata = (cacheKey, entry) => {
  try {
    const metadata = getCacheMetadata();
    metadata[cacheKey] = {
      timestamp: entry.timestamp,
      messageCount: entry.messageCount,
    };
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Failed to update metadata:', error);
  }
};

/**
 * Remove from cache metadata
 * @param {string} cacheKey - Cache key
 */
const removeCacheMetadata = (cacheKey) => {
  try {
    const metadata = getCacheMetadata();
    delete metadata[cacheKey];
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Failed to remove metadata:', error);
  }
};

/**
 * Clear oldest cache entry
 */
const clearOldestCache = () => {
  try {
    const metadata = getCacheMetadata();
    const entries = Object.entries(metadata);
    
    if (entries.length === 0) {
      return;
    }
    
    // Find oldest entry
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const oldestKey = entries[0][0];
    
    clearCacheEntry(oldestKey);
    console.log(`Cleared oldest cache due to quota: ${oldestKey}`);
  } catch (error) {
    console.error('Failed to clear oldest cache:', error);
  }
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export const getCacheStats = () => {
  try {
    const metadata = getCacheMetadata();
    const entries = Object.entries(metadata);
    
    const totalEntries = entries.length;
    const totalMessages = entries.reduce((sum, [, entry]) => sum + entry.messageCount, 0);
    const oldestTimestamp = entries.length > 0
      ? Math.min(...entries.map(([, entry]) => entry.timestamp))
      : null;
    const newestTimestamp = entries.length > 0
      ? Math.max(...entries.map(([, entry]) => entry.timestamp))
      : null;
    
    return {
      totalEntries,
      totalMessages,
      oldestTimestamp: oldestTimestamp ? new Date(oldestTimestamp) : null,
      newestTimestamp: newestTimestamp ? new Date(newestTimestamp) : null,
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return {
      totalEntries: 0,
      totalMessages: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
    };
  }
};

export default {
  saveToCacheStorage,
  loadFromCacheStorage,
  clearCacheEntry,
  clearAllCache,
  getCacheStats,
};

