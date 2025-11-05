import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import Nav from "./components/Nav";
import { keepTheme } from "./themes.js"
import "./App.css";

function App() {
  const [slackChannel, setSlackChannel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [category, setCategory] = useState('');
  const navigate = useNavigate();
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
  }, [])

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

  return (
    <>
      <Nav />
      <div className="App">
        <div className="hero-section">
          <h1 className="jersey-10-regular">Slack Cluster Finder</h1>
          <p className="hero-subtitle"> Your personalized dashboards </p>
        </div>

        <div className="main-content">
          <div className="input-section">
            <p className="input-label">Welcome Back **Username**</p>
            <form onSubmit={handleChannelSubmit} className="channel-input-form">
              <div className="input-group">
              <select name="category" className="input-label" value={category} onChange={event => handleCategoryChange(event.target.value)}>
                  <option id="0" value="" disabled>Select your dashboard</option>
                  <option id="1" value="/new-dashboard" >Create New DashBoard!</option>
                  <option id="2" value="fake-channel1.com" >Slack Channel - CTP-11</option>
                  <option id="3" value="fake-channel2.com" >Discord Channel - CISC_1115</option>
                  <option id="4" value="fake-channel3.com" >WhatsApp - Trip To Japan GC 🇯🇵</option>
              </select>
                {/* <label htmlFor="slack-channel" className="input-label">
                  Select Slack Channel
                </label>
                <input
                  id="slack-channel"
                  type="text"
                  placeholder="Enter channel name or link (e.g., #general, #dev-team)"
                  value={slackChannel}
                  onChange={(e) => setSlackChannel(e.target.value)}
                  className="channel-input"
                  disabled={isLoading}
                /> */}
              </div>
              <button
                type="submit"
                className="analyze-button"
                disabled={!slackChannel.trim() || isLoading}
              >
                {isLoading ? "Analyzing..." : "Analyze Channel"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
