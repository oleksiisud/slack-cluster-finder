import Nav from "./Nav.jsx";
import { useState, useEffect } from "react";
import { keepTheme } from "../themes.js"
import "./Account.css";

const Account = () => {
  useEffect(() => {
    keepTheme();
}, [])
  return (
    <>
      <Nav/>
      <div className = "Account">
        <h1>Account</h1>
        <p>Will add a profile info, setting, past dashboard, preferences, etc.</p>
        </div>
    </>
  );
}

export default Account;
