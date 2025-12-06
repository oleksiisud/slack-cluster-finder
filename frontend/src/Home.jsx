/**
 * Home page with D3 force graph visualization
 * Shows center node (+) for creating new chats and other nodes for existing chats
 */
import { useState, useEffect } from 'react';
import InteractiveGraph from './components/graph/InteractiveGraph';
import FilterSidebar from './components/FilterSidebar';
import SettingsModal from './components/SettingsModal';
import Nav from './components/Nav';
import { getUserChats, getChatById, saveChatClusteringData } from './services/chatService';
import { processClusteringGemini, checkGeminiApiHealth } from './services/clusteringApi';
import { useAuth } from './AuthContext';
import './Home.css';

const MOCK_HOME_DATA = {
  nodes: [
    { id: "root", name: "New Chat", type: "add-root", val: 50, x: 0, y: 0 },
    { id: "ws1", name: "Company Slack", type: "workspace", val: 20, source: "slack" },
    { id: "ws2", name: "Dev Discord", type: "workspace", val: 15, source: "discord" },
    { id: "ws3", name: "Support Team", type: "workspace", val: 10, source: "slack" },
  ],
  links: [
    { source: "root", target: "ws1" },
    { source: "root", target: "ws2" },
    { source: "root", target: "ws3" },
  ]
};

const MOCK_CHAT_DATA = {
  nodes: [
    { id: "c1", name: "Pandas Data Analysis", type: "cluster", val: 30, tags: ["python", "data", "pandas"] },
    { id: "c2", name: "React State Logic", type: "cluster", val: 20, tags: ["javascript", "react", "hooks"] },
    { id: "c3", name: "Deployment Issues", type: "cluster", val: 15, tags: ["devops", "aws", "docker"] },
    { id: "m1", name: "How do I merge dataframes?", type: "message", user: "alice", timestamp: "2023-11-14T10:00:00Z", parent: "c1" },
    { id: "m2", name: "Use pd.merge()", type: "message", user: "bob", timestamp: "2023-11-14T10:05:00Z", parent: "c1" },
    { id: "m3", name: "useEffect dependency loop", type: "message", user: "charlie", timestamp: "2023-11-15T09:00:00Z", parent: "c2" },
  ],
  links: [
    { source: "c1", target: "m1" },
    { source: "c1", target: "m2" },
    { source: "c2", target: "m3" },
    { source: "c1", target: "c2", value: 1 }
  ]
};

function Home() {
  const { session } = useAuth();
  const [view, setView] = useState('home');
  const [activeChat, setActiveChat] = useState(null);
  const [activeChatData, setActiveChatData] = useState({
    nodes: [],
    links: []
  });
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userChats, setUserChats] = useState([]);
  const [homeData, setHomeData] = useState({
    nodes: [{ id: "root", name: "New Chat", type: "add-root", val: 50, x: 0, y: 0 }],
    links: []
  });

  useEffect(() => {
    if (session) {
      loadUserChats();
    }
  }, [session]);

  const loadUserChats = async () => {
    try {
      const chats = await getUserChats();
      setUserChats(chats);
      
      // Build home graph data
      const nodes = [
        { id: "root", name: "New Chat", type: "add-root", val: 50, x: 0, y: 0 }
      ];
      
      const links = [];
      
      chats.forEach((chat, index) => {
        nodes.push({
          id: chat.id,
          name: chat.title,
          type: "workspace",
          val: 20,
          source: chat.source,
          chatData: chat
        });
        
        links.push({
          source: "root",
          target: chat.id
        });
      });
      
      setHomeData({ nodes, links });
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const handleChatCreated = async (newChat, clusteringData) => {
    // Reload chats to include the new one
    await loadUserChats();
    
    // Switch to the new chat
    setActiveChat({
      id: newChat.id,
      name: newChat.title,
      type: "workspace",
      source: newChat.source,
      chatData: newChat
    });
    
    setActiveChatData(clusteringData || MOCK_CHAT_DATA);
    setView('dashboard');
  };

  const handleNodeClick = async (node) => {
    if (!node) {
      // Reset zoom when clicking background
      return;
    }
    
    if (view === 'home') {
      // Home view: handle workspace selection
      if (node.type === 'add-root') {
        setSettingsOpen(true);
      } else if (node.type === 'workspace') { 
        setActiveChat(node);
        
          // Load full chat data including clustering_data
        try {
          const fullChat = await getChatById(node.id);
          console.log("=== Loading Chat Data ===");
          console.log("Full chat object:", fullChat);
          console.log("Has clustering_data:", !!fullChat?.clustering_data);
          console.log("Clustering data type:", typeof fullChat?.clustering_data);
          console.log("Clustering data value:", fullChat?.clustering_data);
          console.log("Clustering data keys:", fullChat?.clustering_data ? Object.keys(fullChat.clustering_data) : 'N/A');
          console.log("Has messages:", !!fullChat?.messages);
          console.log("Messages type:", Array.isArray(fullChat?.messages) ? 'array' : typeof fullChat?.messages);
          console.log("Messages count:", Array.isArray(fullChat?.messages) ? fullChat.messages.length : 'N/A');
          
          // Parse clustering_data if it's a string (JSONB from Supabase might be stringified)
          let clusteringData = fullChat?.clustering_data;
          if (typeof clusteringData === 'string') {
            try {
              clusteringData = JSON.parse(clusteringData);
              console.log("Parsed clustering_data from string");
            } catch (e) {
              console.error('Failed to parse clustering_data as JSON:', e);
              clusteringData = null;
            }
          }
          
          // Check if clustering_data is an empty object
          if (clusteringData && typeof clusteringData === 'object' && !Array.isArray(clusteringData)) {
            const hasNodes = clusteringData.nodes && Array.isArray(clusteringData.nodes);
            const hasLinks = clusteringData.links && Array.isArray(clusteringData.links);
            const nodeCount = hasNodes ? clusteringData.nodes.length : 0;
            const linkCount = hasLinks ? clusteringData.links.length : 0;
            
            console.log("Clustering data structure check:");
            console.log("  - Has nodes array:", hasNodes, `(${nodeCount} nodes)`);
            console.log("  - Has links array:", hasLinks, `(${linkCount} links)`);
            console.log("  - Is empty object:", Object.keys(clusteringData).length === 0);
            
            if (hasNodes && nodeCount > 0 && hasLinks) {
              console.log("✓ Valid clustering data found! Using it.");
              setActiveChatData(clusteringData);
            } else {
              console.warn("✗ Clustering data exists but is invalid or empty");
              clusteringData = null; // Treat as missing
            }
          } else {
            console.warn("✗ No clustering_data or wrong type");
            clusteringData = null;
          }
          
          // If no valid clustering data, try to re-cluster from messages
          if (!clusteringData && fullChat?.messages && Array.isArray(fullChat.messages) && fullChat.messages.length > 0) {
            console.log("=== Starting Re-clustering ===");
            console.log("Messages count:", fullChat.messages.length);
            console.log("Sample message:", fullChat.messages[0]);
            
            // Check if backend is available first
            const isBackendAvailable = await checkGeminiApiHealth();
            if (!isBackendAvailable) {
              console.error("✗ Backend server is not available");
              alert(`⚠️ Clustering Service Unavailable\n\nThe clustering backend server is not running at ${import.meta.env.VITE_GEMINI_API_BASE_URL || 'http://localhost:8001'}.\n\nPlease:\n1. Start the backend server (python backend/main_gemini.py or check your setup)\n2. Or re-upload your JSON file when the server is running\n\nYour messages are saved and will be clustered once the server is available.`);
              setActiveChatData({ nodes: [], links: [] });
              return;
            }
            
            // Show loading state
            setActiveChatData({ nodes: [], links: [] });
            
            // Try to re-cluster the messages
            try {
              // Map messages to the format expected by the clustering API
              const messagesForClustering = fullChat.messages.map((msg, idx) => {
                const mapped = {
                  text: msg.text || msg.content || '',
                  channel: msg.channel || msg.channel_id || '',
                  user: msg.user || msg.user_id || msg.user_id_hash || '',
                  timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
                  link: msg.permalink || msg.link || ''
                };
                if (idx === 0) console.log("Sample mapped message:", mapped);
                return mapped;
              });
              
              console.log("Calling processClusteringGemini with", messagesForClustering.length, "messages");
              const clusteringResult = await processClusteringGemini(
                messagesForClustering,
                0.5 // sensitivity
              );
              
              console.log("Clustering result received:", clusteringResult);
              console.log("Result has nodes:", !!clusteringResult?.nodes);
              console.log("Result has links:", !!clusteringResult?.links);
              
              if (!clusteringResult || !clusteringResult.nodes || !clusteringResult.links) {
                throw new Error("Invalid clustering result format");
              }
              
              // Build graph data from clustering result
              const clusterNodes = clusteringResult.nodes.filter(n => n.type === 'cluster');
              const messageNodes = clusteringResult.nodes.filter(n => n.type === 'message');
              const normalizedLinks = clusteringResult.links.map(link => ({
                source: typeof link.source === 'object' ? link.source.id : link.source,
                target: typeof link.target === 'object' ? link.target.id : link.target
              }));
              
              console.log("Processed clustering result:");
              console.log("  - Cluster nodes:", clusterNodes.length);
              console.log("  - Message nodes:", messageNodes.length);
              console.log("  - Links:", normalizedLinks.length);
              
              const rootNode = { id: 'root', name: 'Root', type: 'add-root' };
              const topClusters = clusterNodes.slice(0, 10);
              const rootLinks = topClusters.map(c => ({ source: 'root', target: c.id }));
              
              // Filter message nodes to only those connected to top clusters
              const topClusterIds = new Set(topClusters.map(c => c.id));
              const connectedMessageIds = new Set();
              normalizedLinks.forEach(link => {
                if (topClusterIds.has(link.source)) {
                  connectedMessageIds.add(link.target);
                }
              });
              const filteredMessageNodes = messageNodes.filter(n => connectedMessageIds.has(n.id));
              
              const graphData = {
                nodes: [rootNode, ...topClusters, ...filteredMessageNodes],
                links: [...rootLinks, ...normalizedLinks.filter(link => 
                  topClusterIds.has(link.source) || connectedMessageIds.has(link.target)
                )]
              };
              
              console.log("Final graph data:");
              console.log("  - Total nodes:", graphData.nodes.length);
              console.log("  - Total links:", graphData.links.length);
              
              // Save the newly created clustering data
              console.log("Saving clustering data to database...");
              await saveChatClusteringData(node.id, graphData);
              console.log("✓ Clustering data saved successfully");
              
              setActiveChatData(graphData);
              console.log("✓ Re-clustering completed and displayed");
            } catch (reclusterError) {
              console.error("✗ Failed to re-cluster messages:", reclusterError);
              console.error("Error details:", reclusterError.message);
              console.error("Error stack:", reclusterError.stack);
              
              // Show user-friendly error message
              if (reclusterError.message.includes('Cannot connect to clustering service')) {
                alert(`⚠️ Clustering Service Unavailable\n\nThe clustering backend server is not running.\n\nPlease:\n1. Start the backend server (port 8001)\n2. Or re-upload your JSON file to create clusters\n\nError: ${reclusterError.message}`);
              } else {
                alert(`⚠️ Failed to Re-cluster Messages\n\n${reclusterError.message}\n\nPlease try re-uploading your JSON file.`);
              }
              
              setActiveChatData({ nodes: [], links: [] });
            }
          } else if (!clusteringData) {
            console.warn("No messages available for re-clustering");
            setActiveChatData({ nodes: [], links: [] });
          }
        } catch (error) {
          console.error('✗ Error loading chat data:', error);
          console.error("Error details:", error.message);
          setActiveChatData({ nodes: [], links: [] });
        }
        
        setView('dashboard'); 
      }
    } else {
      // Dashboard view: handle cluster/message clicks (just open sidebar, don't reset data)
      if (node.type === 'cluster') {
        setSidebarOpen(true);
      }
      // For message nodes or other types, just keep the current view
      // Don't reset activeChatData - this prevents nodes from disappearing
    }
  };

  const handleBackToHome = () => {
    setView('home');
    setActiveChat(null);
    setActiveChatData({ nodes: [], links: [] });
    // setActiveChatData(null);
    setSearchQuery('');
  };

  return (
    <div className="app-container">
      <div className={`main-content ${view === 'dashboard' && isSidebarOpen ? 'sidebar-active' : ''}`}>
        {view === 'home' ? (
          <InteractiveGraph data={homeData} onNodeClick={handleNodeClick} isHome={true} />
        ) : (
          <InteractiveGraph 
            data={activeChatData || MOCK_CHAT_DATA} 
            onNodeClick={handleNodeClick} 
            searchQuery={searchQuery}
            onBackToHome={handleBackToHome}
          />
        )}
      </div>

      {view === 'dashboard' && (
        <FilterSidebar 
          isOpen={isSidebarOpen} 
          toggle={() => setSidebarOpen(!isSidebarOpen)} 
          onSettingsClick={() => setSettingsOpen(true)}
          activeChat={activeChat}
          activeChatData={activeChatData}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setSettingsOpen(false)}
        onChatCreated={handleChatCreated}
        activeChat={activeChat}
        activeChatData={activeChatData}
      />
    </div>
  );
}

export default Home;