/**
 * Transform clustering API output to D3 graph format
 * Converts ClusteringOutput {messages, clusters} to {nodes, links}
 */

/**
 * Transform clustering data to D3 graph format
 * @param {Object} clusteringData - Output from clustering API
 * @returns {Object} Graph data with nodes and links
 */
export const transformClusteringToGraph = (clusteringData) => {
  if (!clusteringData) return null;
  
  // If already in graph format, return as-is
  if (clusteringData.nodes && clusteringData.links) {
    return clusteringData;
  }
  
  // If empty or invalid, return null
  if (!clusteringData.clusters || !Array.isArray(clusteringData.clusters)) {
    return null;
  }
  
  const nodes = [];
  const links = [];
  const clusterIdToNode = new Map();
  
  // Precompute message lookup by cluster_id for O(1) access
  const messagesByCluster = new Map();
  if (clusteringData.messages && Array.isArray(clusteringData.messages)) {
    clusteringData.messages.forEach(msg => {
      if (msg.cluster_id) {
        if (!messagesByCluster.has(msg.cluster_id)) {
          messagesByCluster.set(msg.cluster_id, []);
        }
        messagesByCluster.get(msg.cluster_id).push(msg);
      }
    });
  }
  
  // Create cluster nodes (Level 1 and Level 2)
  clusteringData.clusters.forEach(cluster => {
    const node = {
      id: cluster.cluster_id,
      name: cluster.label || 'Unnamed Cluster',
      type: 'cluster',
      val: cluster.size || 10,
      tags: cluster.tags || [],
      level: cluster.level || 1,
      radius: cluster.radius || 120,
      // Store messages for this cluster for later access
      messages: messagesByCluster.get(cluster.cluster_id) || []
    };
    
    nodes.push(node);
    clusterIdToNode.set(cluster.cluster_id, node);
    
    // Create links to parent clusters (hierarchical)
    if (cluster.parent_cluster_id) {
      links.push({
        source: cluster.parent_cluster_id,
        target: cluster.cluster_id
      });
    }
  });
  
  // Create message nodes as small dots inside conversation clusters (Level 1 only)
  if (clusteringData.messages && Array.isArray(clusteringData.messages)) {
    clusteringData.messages.forEach(message => {
      // Only create message nodes for Level 1 conversation clusters
      const parentCluster = clusterIdToNode.get(message.cluster_id);
      if (parentCluster && parentCluster.level === 1 && message.message_id) {
        const messageNode = {
          id: message.message_id,
          name: message.text?.substring(0, 100) || 'Message',
          type: 'message',
          val: 3,  // Small size
          user: message.user,
          timestamp: message.timestamp,
          text: message.text,
          channel: message.channel,
          tags: message.tags || [],
          parent: message.cluster_id,
          level: 0  // Messages are innermost level
        };
        
        nodes.push(messageNode);
        
        // Link message to its conversation cluster (cluster_id is already validated above)
        links.push({
          source: message.cluster_id,
          target: messageNode.id
        });
      }
    });
  }
  
  return { nodes, links, metadata: clusteringData.metadata };
};

/**
 * Validate graph data structure
 * @param {Object} data - Graph data to validate
 * @returns {boolean} True if valid
 */
export const isValidGraphData = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.nodes)) return false;
  if (!Array.isArray(data.links)) return false;
  if (data.nodes.length === 0) return false;
  return true;
};

