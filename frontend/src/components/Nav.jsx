import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { setTheme as setThemeFunction } from '../themes.js';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useState, useEffect } from 'react';
import './Nav.css'

const Nav = () => {
  const { session, signOut } = useAuth();
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'theme-dark');
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
        <div className="jersey-10-regular logo">Stellar Search</div>
        
        <div className="navbar-right">
          <ul className="navbar-links">
            <li>
              <Link to={'/home'} className="navbar-link">Home</Link>
            </li>
            <li>
              <Link to={'https://github.com/oleksiisud/slack-cluster-finder'} className="navbar-link">About</Link>
            </li>
            <li>
              <Link to={'/account'} className="navbar-link">Account</Link>
            </li>
          </ul>
          
          <button className="dark-mode-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'theme-dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {session && (
            <button onClick={signOut} className="sign-out-btn">
              Sign Out
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Nav;