import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './HomeNav.css'

const HomeNav = () => {

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`home-navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="home-navbar-content">
        <div className="jersey-10-regular logo">Stellar-Search</div>
        <ul className="home-navbar-links">
          <Link to="/"><p className="home-navbar-link">Home</p></Link>
          <Link to="https://github.com/oleksiisud/slack-cluster-finder">
            <p className="home-navbar-link">Development</p>
          </Link>
          <Link to="/log-in"><p className="home-navbar-link">Get Started</p></Link>
        </ul>
      </div>
    </nav>
  );
};

export default HomeNav;
