/**
 * Home page with D3 force graph visualization
 * Shows center node (+) for creating new chats and other nodes for existing chats
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { useAuth } from './AuthContext';
import { getUserChats, deleteChat } from './services/chatService';
import Nav from './components/Nav';
import './Home.css';

// Import SVG icons
import SlackIcon from './assets/brand-slack.svg';
import DiscordIcon from './assets/brand-discord.svg';
import WhatsAppIcon from './assets/brand-whatsapp.svg';
import CloudIcon from './assets/cloud-data-connection.svg';

const Home = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const graphRef = useRef();
  const [chats, setChats] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [iconImages, setIconImages] = useState({});

  // Load icons as images
  useEffect(() => {
    const loadIcons = async () => {
      const icons = {
        slack: SlackIcon,
        discord: DiscordIcon,
        whatsapp: WhatsAppIcon,
        default: CloudIcon,
      };

      const loadedImages = {};
      for (const [key, src] of Object.entries(icons)) {
        const img = new Image();
        img.src = src;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        loadedImages[key] = img;
      }
      setIconImages(loadedImages);
    };

    loadIcons();
  }, []);

  // Load user's chats from Supabase
  useEffect(() => {
    const loadChats = async () => {
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const userChats = await getUserChats();
        setChats(userChats);
      } catch (error) {
        console.error('Error loading chats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [session]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth - 40,
        height: window.innerHeight - 100,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Create graph data from chats with radial positioning
  useEffect(() => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = 200; // Fixed radius for chat nodes

    // Center node (Create new chat)
    const centerNode = {
      id: 'center',
      label: '＋',
      type: 'create',
      val: 30,
      color: '#4ECDC4',
      fx: centerX,
      fy: centerY,
      x: centerX,
      y: centerY,
    };

    // Chat nodes - positioned radially around center
    const angleStep = (2 * Math.PI) / Math.max(chats.length, 1);
    const chatNodes = chats.map((chat, idx) => {
      const angle = idx * angleStep;
      return {
        id: chat.id,
        label: chat.title,
        source: chat.source,
        type: 'chat',
        val: 18,
        color: getChatColor(chat.source),
        chat: chat,
        // Fixed radial position
        fx: centerX + radius * Math.cos(angle),
        fy: centerY + radius * Math.sin(angle),
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    // Links from center to each chat
    const links = chatNodes.map((node) => ({
      source: 'center',
      target: node.id,
    }));

    setGraphData({
      nodes: [centerNode, ...chatNodes],
      links: links,
    });
  }, [chats, dimensions]);

  // Handle node click
  const handleNodeClick = useCallback(
    (node) => {
      if (node.type === 'create') {
        navigate('/create-chat');
      } else if (node.type === 'chat') {
        navigate(`/dashboard/${node.id}`, { state: { chat: node.chat } });
      }
    },
    [navigate]
  );

  // Handle right-click for deletion
  const handleNodeRightClick = useCallback(
    async (node, event) => {
      event.preventDefault();
      
      if (node.type === 'chat') {
        const confirmed = window.confirm(`Delete "${node.label}"?`);
        if (confirmed) {
          try {
            await deleteChat(node.id);
            setChats(chats.filter((c) => c.id !== node.id));
          } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Failed to delete chat');
          }
        }
      }
    },
    [chats]
  );

  // Custom node rendering with radial style
  const nodeCanvasObject = useCallback(
    (node, ctx, globalScale) => {
      const isHovered = hoveredNode?.id === node.id;
      const label = node.label;

      // Draw node
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
      ctx.fillStyle = isHovered ? '#FFD700' : node.color;
      ctx.fill();

      // Add glow effect
      const glowIntensity = node.type === 'create' ? 25 : 12;
      ctx.shadowBlur = isHovered ? glowIntensity + 5 : glowIntensity;
      ctx.shadowColor = node.color;

      // Draw border
      ctx.strokeStyle = isHovered ? '#FFF' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Draw label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFF';

      if (node.type === 'create') {
        // Large + symbol
        ctx.font = `bold ${40 / globalScale}px Sans-Serif`;
        ctx.fillText(label, node.x, node.y);
      } else {
        // Chat label below node
        const fontSize = 14 / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        
        // Multi-line label
        const maxWidth = 120;
        const words = label.split(' ');
        let line = '';
        let y = node.y + node.val + 20;

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

        // Draw source badge
        if (node.source) {
          const badgeFontSize = 10 / globalScale;
          ctx.font = `${badgeFontSize}px Sans-Serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(node.source.toUpperCase(), node.x, node.y + node.val + y - node.y + 12);
        }
      }
    },
    [hoveredNode]
  );

  // Link styling - consistent with dashboard
  const linkCanvasObject = useCallback((link, ctx) => {
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  }, []);

  // Custom node rendering with icons
  const nodeCanvasObjectWithIcons = useCallback(
    (node, ctx, globalScale) => {
      nodeCanvasObject(node, ctx, globalScale);

      // Draw icon for chat nodes
      if (node.type === 'chat' && iconImages[node.source?.toLowerCase()]) {
        const icon = iconImages[node.source?.toLowerCase()] || iconImages.default;
        const iconSize = node.val * 1.2; // Slightly larger for visibility
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.drawImage(
          icon,
          node.x - iconSize / 2,
          node.y - iconSize / 2,
          iconSize,
          iconSize
        );
        ctx.restore();
      }

      // Draw count badge for chat nodes
      if (node.type === 'chat') {
        const messageCount = node.chat?.messages?.length || 0;
        if (messageCount > 0) {
          ctx.beginPath();
          ctx.arc(node.x + node.val - 8, node.y - node.val + 8, 10, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.fill();
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#000';
          ctx.font = `bold ${11 / globalScale}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(messageCount > 999 ? '999+' : messageCount, node.x + node.val - 8, node.y - node.val + 8);
        }
      }
    },
    [nodeCanvasObject, iconImages]
  );

  const userName =
    session?.user?.user_metadata?.name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email ||
    'User';

  if (loading) {
    return (
      <>
        <Nav />
        <div className="home-container">
          <div className="home-loading">Loading your chats...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="home-container">
        <div className="home-header">
          <h1 className="home-title">Welcome, {userName}</h1>
          <p className="home-subtitle">
            {chats.length === 0
              ? 'Click the center node to create your first chat'
              : 'Click a chat to open it, or the center node to create a new one'}
          </p>
          <p className="home-hint">Right-click on a chat to delete it</p>
        </div>

        <div className="home-graph">
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeId="id"
            nodeLabel={() => ''} // Tooltips handled manually
            nodeVal="val"
            nodeCanvasObject={nodeCanvasObjectWithIcons}
            linkCanvasObject={linkCanvasObject}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            onNodeHover={setHoveredNode}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0a0e27"
            cooldownTicks={0}
            d3AlphaDecay={1}
            d3VelocityDecay={1}
            enableNodeDrag={false}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        </div>
      </div>
    </>
  );
};

// Get color based on chat source
const getChatColor = (source) => {
  const colors = {
    slack: '#E01E5A',
    discord: '#5865F2',
    whatsapp: '#25D366',
    telegram: '#0088cc',
    default: '#4ECDC4',
  };
  return colors[source?.toLowerCase()] || colors.default;
};

export default Home;

