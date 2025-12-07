import React, { useState, useEffect } from 'react';
import InteractiveGraph from './components/graph/InteractiveGraph';
import FilterSidebar from './components/graph/FilterSidebar';
import SettingsModal from './components/graph/SettingsModal';
import EmptyState from './components/graph/EmptyState';
import { getUserChats, getChatById } from './services/chatService';
import { transformClusteringToGraph } from './utils/graphTransform';
import './Home.css';

function Home() {
  const [view, setView] = useState('home');
  const [activeChat, setActiveChat] = useState(null);
  const [activeChatData, setActiveChatData] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [homeData, setHomeData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [editingChat, setEditingChat] = useState(null);
  
  // AI State
  const [aiState, setAiState] = useState({ clusterId: null, type: null, loading: false, content: null });

  useEffect(() => {
    loadUserChats();
  }, []);

  const loadUserChats = async () => {
    try {
      setLoading(true);
      const chats = await getUserChats();
      
      // Transform chats to graph nodes
      const nodes = [
        { id: "root", name: "New Chat", type: "add-root", val: 50, x: 0, y: 0 },
        ...chats.map(chat => ({
          id: chat.id,
          name: chat.title || chat.source,
          type: "workspace",
          val: 20,
          source: chat.source,
          chatData: chat // Store full chat object
        }))
      ];

      const links = chats.map(chat => ({ source: "root", target: chat.id }));

      setHomeData({ nodes, links });
    } catch (error) {
      console.error("Failed to load chats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAiAction = async (type, clusterId) => {
    setAiState({ clusterId, type, loading: true, content: null });
    // Simulate AI delay - replace with real API call later
    setTimeout(() => {
      setAiState({ 
        clusterId, 
        type, 
        loading: false, 
        content: "AI Analysis: This cluster represents discussions about..." 
      });
    }, 1500);
  };

  const handleNodeClick = async (node, event) => {
    if (!node) return;
    
    console.log('Node clicked:', { type: node.type, id: node.id, view });
    
    if (view === 'home') {
      if (node.type === 'add-root') {
        setEditingChat(null);
        setSettingsOpen(true);
      } else if (node.type === 'workspace') {
        // Load full chat data if needed
        let chatData = node.chatData;
        if (!chatData.clustering_data || !chatData.messages) {
           // Fetch full if we only had summary
           try {
             const fullChat = await getChatById(node.id);
             chatData = fullChat;
           } catch(e) { console.error(e); }
        }

        console.log('Loading workspace chat:', { 
          hasClusteringData: !!chatData.clustering_data, 
          hasMessages: !!chatData.messages 
        });

        setActiveChat({ id: node.id, name: node.name, source: node.source, chatData });
        // Only set clustering data if it exists, otherwise null (EmptyState will be shown in render)
        setActiveChatData(chatData.clustering_data || null);
        setView('dashboard');
      }
    } else if (node.type === 'cluster') {
      setSidebarOpen(true);
    }
  };

  const handleBackToHome = () => {
    setView('home');
    setActiveChat(null);
    setActiveChatData(null);
    setSearchQuery('');
    loadUserChats(); // Refresh in case of changes
  };

  return (
    <div className="app-container">
      <div className={`main-content ${view === 'dashboard' && isSidebarOpen ? 'sidebar-active' : ''}`}>
        {loading ? (
           <div className="loading-screen">Loading your universe...</div>
        ) : view === 'home' ? (
          <InteractiveGraph 
            data={homeData} 
            onNodeClick={handleNodeClick} 
            isHome={true} 
          />
        ) : activeChatData ? (
          <InteractiveGraph 
            data={activeChatData} 
            onNodeClick={handleNodeClick} 
            searchQuery={searchQuery}
            onBackToHome={handleBackToHome}
          />
        ) : (
          <EmptyState 
            activeChat={activeChat}
            onBackToHome={handleBackToHome}
          />
        )}
      </div>

      {view === 'dashboard' && (
        <FilterSidebar 
          isOpen={isSidebarOpen} 
          toggle={() => setSidebarOpen(!isSidebarOpen)} 
          onSettingsClick={() => { setEditingChat(activeChat?.chatData); setSettingsOpen(true); }}
          activeChat={activeChat}
          chatData={activeChatData}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onAiAction={handleAiAction}
          aiState={aiState}
        />
      )}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setSettingsOpen(false)}
        existingChat={editingChat}
        onChatCreated={(chat, clusterResult) => { 
          loadUserChats(); 
          // If clustering was successful, switch to dashboard view
          if (chat && clusterResult) {
            const graphData = transformClusteringToGraph(clusterResult);
            if (graphData) {
              setActiveChat({ 
                id: chat.id, 
                name: chat.title, 
                source: chat.source, 
                chatData: { ...chat, clustering_data: graphData } 
              });
              setActiveChatData(graphData);
              setView('dashboard');
            }
          }
        }}
        onChatDeleted={() => { handleBackToHome(); setSettingsOpen(false); }}
      />
    </div>
  );
}

export default Home;