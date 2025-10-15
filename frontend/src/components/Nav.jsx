import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Nav.css'


const Nav = () => {
    return (
        <nav className="navbar">
          <div className="navbar-content">
            <div className="logo">Slack Cluster Finder</div>
            <ul className="navbar-links">
              <Link to = {'/home'}><p className="navbar-link">Home</p></Link>
              <Link to = {'/home'}><p className="navbar-link">About</p></Link>
            </ul>
          </div>
        </nav>
      )
}

export default Nav;