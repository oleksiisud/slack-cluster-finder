import Nav from "./Nav.jsx";
import { useState, useEffect } from "react";
import { keepTheme } from "../themes.js"
import './DataCollection.css';

const DataCollection = () => {

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