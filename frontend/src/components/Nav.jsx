import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setTheme as setThemeFunction } from '../themes.js';
import './Nav.css'
import { useAuth } from '../AuthContext.jsx';

const Nav = () => {
  const { session, signOut } = useAuth();
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'theme-dark');
  // const [gradient, setGradient] = useState('linear-gradient(135deg, #2f3061 0%, #3d2c65 50%, #5e5285 100%)'); // Default gradient
  const navigate = useNavigate();

  // sign out redirects user to landing page
  const handleSignOut = async () => {
    await signOut();      // log the user out
    navigate("/");        // then go to homepage
  };

  useEffect(() => {
    // Apply theme on component mount
    const currentTheme = localStorage.getItem('theme') || 'theme-dark';
    setThemeFunction(currentTheme);
    setThemeState(currentTheme);

    // Fetch user-defined gradient from localStorage or API
    // const userGradient = localStorage.getItem('userGradient');
    // if (userGradient) {
    //   setGradient(userGradient);
    // }
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
    <nav className="navbar">
      <div className="navbar-content">
        <div className="jersey-10-regular logo">{userName} Stellar-Search Dashboards </div>
        <ul className="navbar-links">
          <Link to={'/home'} className="nav-buttons">Home</Link>
          <Link to={'/account'} className="nav-buttons">Account</Link>
          <button className="dark-mode-toggle" onClick={toggleTheme}>
            {theme === 'theme-dark' ? '🐈' : '🐈‍⬛'}
          </button>
          {session && (
              <button className="sign-out-button" onClick={handleSignOut}> Sign Out </button>
)}
        </ul>
      </div>
    </nav>
  )
}

export default Nav;