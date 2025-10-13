import { useState } from "react";
import Nav from "./components/Nav"
import { Link } from 'react-router-dom';
import "./App.css";

function App() {
  const [query, setQuery] = useState(""); // store search input

  return (
    <>
     <Nav/>
        <div className="App ">
      
      <h1>Slack Cluster Finder</h1>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        className="search-bar"
      />
    </div>
    </>
  );
}

export default App;
