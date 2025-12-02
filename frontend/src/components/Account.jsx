import { useEffect, useState } from "react";
import Nav from "./Nav.jsx";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../supabaseClient.js";
import "./Account.css";

const Account = () => {
  const { session } = useAuth();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = session?.user;
  const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email ||  "User";
  const userAvatar = user?.user_metadata?.picture || "/default-avatar.png";
  
  // temp solution, display team ID instead of workspace name
  const teamId = user?.user_metadata?.custom_claims?.["https://slack.com/team_id"] || "No team ID found";

  // Dummy for now - fetch the users Slack workspace from someowhere, not from user_metadata
  const slackWorkspace =
    user?.user_metadata?.slack_workspace || "No workspace connected";

  // Dummy for now - fetch user's Slack token from user_settings table in Supabase
  const fetchUserToken = async () => {
    if (!user) return null;
    const { data, error } = await supabase
    // if we want to store them in this table we can fetch them here
    // if not, we can change the table, or remove this function entirely
      .from("user_chats")
      .select("access_token")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user settings:", error);
      return null;
    }
    return data?.chat_id || null;
  };

  // fetch dashboards
  useEffect(() => {
    const fetchDashboards = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Dummy for now - fetching user token to associate with dashboards from user_settings table
        const token = await fetchUserToken();
        const { data: dashboardsData, error } = await supabase
          .from("user_chats")
          .select("clustering_data")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching dashboards:", error);
        }

        let finalDashboards;
        if (dashboardsData && dashboardsData.length > 0) {
          finalDashboards = dashboardsData.map((d) => ({
            ...d,
            token: token || d.token,
            // when the token will expire, we can calculate time left here or store them somewhere
            // if we dont want this information, we can remove it
            time_left: d.time_left || "N/A",
          }));
        } else {
          // fake dashboards to show layout, delete before production
          finalDashboards = [
            { id: "ws1", name: "Company Slack", token: "123abc" },
            { id: "ws2", name: "Dev Discord", token: "456def" },
            { id: "ws3", name: "Support Team", token: "789gfi" },
            // { id: 1, name: "Cat Behavior Dashboard", token: token || "abc123", time_left: "2 days" },
            // { id: 2, name: "Model Analytics", token: token || "xyz789", time_left: "5 hours" },
            // { id: 3, name: "User Insights", token: token || "lmn456", time_left: "1 week" },
          ];
        }

        setDashboards(finalDashboards);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboards();
  }, [user]);

  return (
    <>
      <div className="AccountPage">
        <div className="AccountCard">
          <img src={userAvatar} alt="avatar" className="avatar" />
          <h1>{userName}</h1>
          <p className="workspace">
            Connected Slack workspace: <strong>{teamId}</strong>
          </p>

          <h2>Your Dashboards</h2>
          {loading ? (
            <p>Loading dashboards...</p>
          ) : dashboards.length === 0 ? (
            <p>No dashboards found.</p>
          ) : (
            <div className="dashboard-list">
              {dashboards.map((dash) => (
                <div key={dash.id} className="dashboard-card">
                  <h3>{dash.name}</h3>
                  {dash.token && <p>Token: {dash.token}</p>}
                  {/* <p>Time left: {dash.time_left}</p> */}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Account;