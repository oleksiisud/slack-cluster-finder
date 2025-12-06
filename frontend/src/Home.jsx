/**
 * Home page with D3 force graph visualization
 * Shows center node (+) for creating new chats and other nodes for existing chats
 */
import { useState, useEffect } from 'react';
import InteractiveGraph from './components/graph/InteractiveGraph';
import FilterSidebar from './components/FilterSidebar';
import SettingsModal from './components/SettingsModal';
import Nav from './components/Nav';
import { getUserChats } from './services/chatService';
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
  const [activeChatData, setActiveChatData] = useState(null);
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

  const handleNodeClick = (node) => {
    if (!node) return;
    if (view === 'home') {
      if (node.type === 'add-root') {
        setSettingsOpen(true);
      } else if (node.type === 'workspace') { 
        setActiveChat(node);
        // Use clustering data if available, otherwise use mock data
        setActiveChatData(node.chatData?.clustering_data || MOCK_CHAT_DATA);
        setView('dashboard'); 
      }
    } else {
      if (node.type === 'cluster') setSidebarOpen(true);
    }
  };

  const handleBackToHome = () => {
    setView('home');
    setActiveChat(null);
    setActiveChatData(null);
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
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setSettingsOpen(false)}
        onChatCreated={handleChatCreated}
      />
    </div>
  );
}

export default Home;