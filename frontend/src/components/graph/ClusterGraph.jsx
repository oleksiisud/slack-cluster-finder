/**
 * Network graph visualization for message clusters
 * Displays clusters as a constellation-like force-directed graph
 */
import React, { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import './ClusterGraph.css';

const ClusterGraph = ({ 
  clusteringData, 
  onClusterClick, 
  onMessageClick,
  searchQuery = '',
  selectedClusterId = null 
}) => {
  const graphRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      // Get the container element
      const container = graphRef.current?.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        setDimensions({
          width: rect.width - 20, // Account for padding
          height: rect.height - 20,
        });
      } else {
        // Fallback dimensions based on 2/3 of screen width
        const graphWidth = (window.innerWidth * 2/3) - 100;
        setDimensions({
          width: graphWidth,
          height: window.innerHeight - 300,
        });
      }
    };

    // Initial update with slight delay to ensure container is rendered
    setTimeout(updateDimensions, 100);
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Transform clustering data to graph format
  useEffect(() => {
    if (!clusteringData || !clusteringData.clusters) {
      setGraphData({ nodes: [], links: [] });
      return;
    }

    const { clusters, messages } = clusteringData;

    // Create nodes for each cluster
    const clusterNodes = clusters.map(cluster => ({
      id: cluster.cluster_id,
      label: cluster.label,
      tags: cluster.tags,
      size: cluster.size,
      type: 'cluster',
      val: Math.sqrt(cluster.size) * 3, // Visual size
      color: getClusterColor(cluster.cluster_id, clusters.length),
      messages: messages.filter(m => m.cluster_id === cluster.cluster_id),
    }));

    // Create nodes for individual messages (smaller, connected to clusters)
    const messageNodes = [];
    const links = [];

    // Filter messages based on search
    const filteredMessages = searchQuery
      ? messages.filter(m => 
          m.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : [];

    // If there's a search query, show matching messages
    if (searchQuery && filteredMessages.length > 0) {
      filteredMessages.forEach((msg, idx) => {
        const msgNodeId = `msg_${msg.message_id}`;
        messageNodes.push({
          id: msgNodeId,
          label: msg.text.substring(0, 30) + '...',
          type: 'message',
          val: 2,
          color: '#64B5F6',
          message: msg,
        });

        // Link message to its cluster
        links.push({
          source: msgNodeId,
          target: msg.cluster_id,
          distance: 50,
        });
      });
    }

    // Create links between related clusters (based on tag similarity)
    const clusterLinks = [];
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const cluster1 = clusters[i];
        const cluster2 = clusters[j];
        
        // Calculate tag overlap
        const commonTags = cluster1.tags.filter(tag => 
          cluster2.tags.includes(tag)
        );
        
        if (commonTags.length > 0) {
          clusterLinks.push({
            source: cluster1.cluster_id,
            target: cluster2.cluster_id,
            distance: 200,
            strength: commonTags.length * 0.1,
          });
        }
      }
    }

    setGraphData({
      nodes: [...clusterNodes, ...messageNodes],
      links: [...links, ...clusterLinks],
    });
  }, [clusteringData, searchQuery]);

  // Handle node click
  const handleNodeClick = useCallback((node) => {
    if (node.type === 'cluster') {
      onClusterClick?.(node);
    } else if (node.type === 'message') {
      onMessageClick?.(node.message);
    }
  }, [onClusterClick, onMessageClick]);

  // Custom node rendering
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = node.type === 'cluster' ? 12/globalScale : 10/globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;

    // Highlight selected cluster
    const isSelected = node.id === selectedClusterId;
    const isHovered = hoveredNode?.id === node.id;

    // Draw node
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
    ctx.fillStyle = isSelected || isHovered 
      ? '#FFD700' 
      : node.color;
    ctx.fill();

    // Add glow effect for clusters
    if (node.type === 'cluster') {
      ctx.shadowBlur = isSelected || isHovered ? 20 : 10;
      ctx.shadowColor = node.color;
    }

    // Draw border
    ctx.strokeStyle = isSelected ? '#FFF' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Draw label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFF';
    ctx.shadowBlur = 0;
    
    if (node.type === 'cluster' || isHovered) {
      // Show full label for clusters and hovered nodes
      const maxWidth = 100;
      const words = label.split(' ');
      let line = '';
      let y = node.y + node.val + 15;

      words.forEach(word => {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
          ctx.fillText(line, node.x, y);
          line = word + ' ';
          y += fontSize + 2;
        } else {
          line = testLine;
        }
      });
      ctx.fillText(line, node.x, y);
    }

    // Show size badge for clusters
    if (node.type === 'cluster') {
      ctx.beginPath();
      ctx.arc(node.x + node.val - 5, node.y - node.val + 5, 8, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.strokeStyle = node.color;
      ctx.stroke();
      
      ctx.fillStyle = '#000';
      ctx.font = `bold ${10/globalScale}px Sans-Serif`;
      ctx.fillText(node.size, node.x + node.val - 5, node.y - node.val + 5);
    }
  }, [selectedClusterId, hoveredNode]);

  // Link styling
  const linkCanvasObject = useCallback((link, ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  }, []);

  if (!clusteringData || graphData.nodes.length === 0) {
    return (
      <div className="cluster-graph-empty">
        <p>No clusters to display. Upload messages to get started.</p>
      </div>
    );
  }

  return (
    <div className="cluster-graph-container">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeId="id"
        nodeLabel="label"
        nodeVal="val"
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        linkDistance={link => link.distance || 100}
        linkStrength={link => link.strength || 0.1}
        onNodeClick={handleNodeClick}
        onNodeHover={setHoveredNode}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0a0e27"
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
};

// Generate color based on cluster ID
const getClusterColor = (clusterId, totalClusters) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
    '#E63946', '#A8DADC', '#457B9D', '#F4A261', '#E9C46A',
  ];
  
  const index = parseInt(clusterId.replace('cluster_', '')) % colors.length;
  return colors[index];
};

export default ClusterGraph;

