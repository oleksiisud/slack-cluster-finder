import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';

import { keepTheme } from "./themes.js";
import ChannelCard from "./components/DataCard";
import channels from './data/channels.js'; // Import shared channels data
import { useAuth } from './AuthContext.jsx';
import DashboardGraph from "./components/DashboardGraph";
import "./App.css";

function App() {
  const [category, setCategory] = useState('');
  const navigate = useNavigate();
  const { session } = useAuth();

  const handleCategoryChange = (category) => {
    const newPage = '/new-dashboard';
    if (category === newPage) {
      navigate(newPage);
    } else {
      setCategory(category);
    }
  };

  useEffect(() => {
    keepTheme();
  }, []);

  const userName = session?.user?.user_metadata?.name
    || session?.user?.user_metadata?.full_name
    || session?.user?.email
    || "User";

  return (
    <>

      <div className="App">
        <div className="hero-section">
          {/* <h1 className="jersey-10-regular hero-title">Your personalized dashboards</h1> */}
          <p className="hero-subtitle"> Click the center node to create your first chat </p>
        </div>

        <div className="main-content">
          {/* <DashboardGraph channels={channels} /> */}
          <DashboardGraph
            channels={channels}
            onNodeClick={() => navigate("/new-dashboard")} // redirect on click
          />
          {/* <div className="input-section">
            <p className="input-label">Select Your Dashboard</p>

            <div className="card-grid">
              {channels.map((channel, index) => (
                <ChannelCard key={index} label={channel.label} value={channel.value} />
              ))}
            </div> */}
        </div>
      </div>
      {/* </div> */}
    </>
  );
}

export default App;
