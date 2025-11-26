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
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-content">
        <div className="jersey-10-regular logo">EZSearch</div>
        <ul className="navbar-links">
          <Link to="/"><p className="navbar-link">Home</p></Link>
          <Link to="https://github.com/oleksiisud/slack-cluster-finder">
            <p className="navbar-link">Development</p>
          </Link>
          <Link to="/log-in"><p className="navbar-link">Get Started</p></Link>
        </ul>
      </div>
    </nav>
  );
};

export default HomeNav;
