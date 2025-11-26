import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setTheme as setThemeFunction } from '../themes.js';
import './Nav.css'
import { useAuth } from '../AuthContext.jsx';

const Nav = () => {
  const { session, signOut } = useAuth();
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'theme-dark');
  const [gradient, setGradient] = useState('linear-gradient(135deg, #2f3061 0%, #3d2c65 50%, #5e5285 100%)'); // Default gradient
  const navigate = useNavigate();

  useEffect(() => {
    // Apply theme on component mount
    const currentTheme = localStorage.getItem('theme') || 'theme-dark';
    setThemeFunction(currentTheme);
    setThemeState(currentTheme);

    // Fetch user-defined gradient from localStorage or API
    const userGradient = localStorage.getItem('userGradient');
    if (userGradient) {
      setGradient(userGradient);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'theme-dark' ? 'theme-light' : 'theme-dark';
    setThemeFunction(newTheme);
    setThemeState(newTheme);
  };

  const userName = session?.user?.user_metadata?.name
                || session?.user?.user_metadata?.full_name
                || 'User';

  return (
    <nav className="navbar" style={{ background: gradient }}>
      <div className="navbar-content">
        <div className="jersey-10-regular logo">{userName} EZSearch Dashboards </div>
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