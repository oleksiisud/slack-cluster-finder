import { useState } from "react";
import Nav from "./components/Nav";
import "./App.css";

function App() {
  const [slackChannel, setSlackChannel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [clusterData, setClusterData] = useState(null);

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
          <h1>Slack Cluster Finder</h1>
          <p className="hero-subtitle">
            Find answers faster
          </p>
        </div>

        <div className="main-content">
          <div className="input-section">
            <form onSubmit={handleChannelSubmit} className="channel-input-form">
              <div className="input-group">
                <label htmlFor="slack-channel" className="input-label">
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
                />
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
