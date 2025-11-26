import Nav from "./Nav.jsx";
import { useState, useEffect } from "react";
import { keepTheme } from "../themes.js"
import channels from '../data/channels.js';
import './DataCollection.css';

const DataCollection = () => {
    function handleCreate() {
        const newDash = {
          id: `dash-${Date.now()}`,
          label: "New Dashboard",
          value: `/dashboard/${Date.now()}`
        };
      
        channels.push(newDash);  // persistent for now
        navigate("/"); // back to graph
      }

    useEffect(() => {
        keepTheme();
    }, [])
    return (
        <> 
        <Nav/>
        <div className="DataCollection">
        <h1>Data Collection</h1>
        <p>Placeholder to send data to backend about channel we want a dashbaord for</p>
        </div>
        </>
    );

}
export default DataCollection;