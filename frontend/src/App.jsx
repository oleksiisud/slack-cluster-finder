import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import Nav from "./components/Nav";
import { keepTheme } from "./themes.js"
import ChannelCard from "./components/DataCard";
import { useAuth } from './AuthContext.jsx';

import "./App.css";

function App() {
  const [slackChannel, setSlackChannel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [category, setCategory] = useState('');
  const navigate = useNavigate();
  const {session} = useAuth();
 
const channels = [
  { label: "Connect Slack Workspace", value: "/slack/auth", isSlack: true },
  { label: "Create New Dashboard", value: "/new-dashboard" },
  { label: "Slack Channel - CTP-11", value: "fake-channel1.com" },
  { label: "Discord - CISC_1115", value: "fake-channel2.com" },
  { label: "WhatsApp Trip to Japan GC 🇯🇵", value: "fake-channel3.com" }
];
  // const [clusterData, setClusterData] = useState(null);

  const handleCategoryChange = (category) => {
    const newPage = '/new-dashboard';
    if (category == newPage) {
      navigate(newPage)
    } else {
      setCategory(category);
    }
 }
  useEffect(() => {
    keepTheme();
    console.log("useEffect triggered, session:", session);
    if (session) {
      console.log("Logged In");
    }
    else {
      console.log("Session is null");
    }
  }, [session])

  const handleChannelSubmit = async (e) => {
    e.preventDefault();
    if (!slackChannel.trim()) return;

    setIsLoading(true);
    // TODO: Replace with actual API call
    setTimeout(() => {
      setIsLoading(false);
      // How data would be processed, or another file to handle data processing
    }, 2000); // Added a delay so setTimeout has a valid second argument
  };

  useEffect(() => {
    console.log("SESSION DATA:", session);
  }, [session]);
  const userName = session?.user?.user_metadata?.name
                || session?.user?.user_metadata?.full_name
                || session?.user?.email
                || "User";

  return (
    <>
    <Nav />
    <div className="App">

      <div className="hero-section">
        <h1 className="jersey-10-regular hero-title">Hello {userName}</h1>
        <p className="hero-subtitle">Your personalized dashboards</p>
      </div>

      <div className="main-content">
        <div className="input-section">
          <p className="input-label">Select Your Dashboard</p>

          <div className="card-grid">
            {channels.map((c, i) => (
              <ChannelCard key={i} label={c.label} value={c.value} />
            ))}
          </div>
        </div>
      </div>

    </div>
  </>
  );
}

export default App;
