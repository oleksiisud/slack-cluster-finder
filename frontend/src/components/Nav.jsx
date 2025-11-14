import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setTheme as setThemeFunction } from '../themes.js';
import './Nav.css'
import { useAuth } from '../AuthContext.jsx';

const Nav = () => {
  const { session, signOut } = useAuth();
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'theme-dark');
  const navigate = useNavigate();

  useEffect(() => {
    // Apply theme on component mount
    const currentTheme = localStorage.getItem('theme') || 'theme-dark';
    setThemeFunction(currentTheme);
    setThemeState(currentTheme);
    if (!session) navigate('/log-in');
  }, [session, navigate]);

  const toggleTheme = () => {
    const newTheme = theme === 'theme-dark' ? 'theme-light' : 'theme-dark';
    setThemeFunction(newTheme);
    setThemeState(newTheme);
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="jersey-10-regular logo">Context Search</div>
        <ul className="navbar-links">
          <Link to={'/home'}><p className="navbar-link">Home</p></Link>
          <Link to={'https://github.com/oleksiisud/slack-cluster-finder'}><p className="navbar-link">About</p></Link>
          <Link to={'/account'}><p className="navbar-link">Account</p></Link>
          <button className="dark-mode-toggle" onClick={toggleTheme}>
            {theme === 'theme-dark' ? '🐈' : '🐈‍⬛'}
          </button>
          {session ? <button onClick={signOut}>Sign Out</button> : null}
        </ul>
      </div>
    </nav>
  )
}

export default Nav;