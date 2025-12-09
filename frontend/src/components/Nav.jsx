import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { setTheme as setThemeFunction } from '../themes.js';
import { useAuth } from '../AuthContext.jsx';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { FaGithub } from "react-icons/fa6";
import './Nav.css'

const Nav = () => {
  const { session, signOut } = useAuth();
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'theme-dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
           {userName}'s Stellar Search Dashboards
        </div>
        
        <button 
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        
        <div className={`navbar-right ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <ul className="navbar-links">
            <li>
              <Link to={'/home'} className="navbar-link" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            </li>
            <li>
              <Link to={'https://github.com/oleksiisud/slack-cluster-finder'} className="navbar-link" onClick={() => setMobileMenuOpen(false)}> <FaGithub/> </Link>
            </li>
            <li>
              <Link to={'/account'} className="navbar-link" onClick={() => setMobileMenuOpen(false)}>Account</Link>
            </li>
            <li>
              <button className="dark-mode-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'theme-dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </li>
            <li>
              {session ? (
                <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="sign-out-btn">
                  Sign Out
                </button>
              ) : (
                <button onClick={() => { navigate('/log-in'); setMobileMenuOpen(false); }} className="sign-out-btn">
                  Log In
                </button>
              )}
            </li>
          </ul>
        </div>
      </div>
    </nav>
  )
}

export default Nav;