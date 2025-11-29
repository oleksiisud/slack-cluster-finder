import { DotLottieReact } from '@lottiefiles/dotlottie-react';
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
        <div className="jersey-10-regular logo">
         <div className="lottie-wrapper">
         < DotLottieReact
               src="https://lottie.host/b3fb3cdb-4df9-483f-93b4-92867bf0c3da/SZB4LHzuZu.lottie"
               loop
               autoplay
               style={{ width: "40px", height: "40px" }}
               />
          </div>
        {userName}'s Stellar-Search Dashboards 
        </div>
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