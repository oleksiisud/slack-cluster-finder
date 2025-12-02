import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaGithub } from "react-icons/fa6";
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
    <nav className={`home-navbar ${scrolled ? 'home-navbar-scrolled' : ''}`}>
      <div className="home-navbar-content">
        <div className="jersey-10-regular logo">
        <div className="home-lottie-wrapper">
          < DotLottieReact
                src="https://lottie.host/b3fb3cdb-4df9-483f-93b4-92867bf0c3da/SZB4LHzuZu.lottie"
                loop
                autoplay
                style={{ width: "40px", height: "40px" }}
                />
          </div>
              Stellar Search
         </div>

        <ul className="home-navbar-links">
          <Link to="/"><p className="home-navbar-link">Home</p></Link>
          <Link to="https://github.com/oleksiisud/slack-cluster-finder">
            <p className="home-navbar-link"> <FaGithub/> </p>
          </Link>
          <Link to="/log-in"><p className="home-navbar-link">Get Started</p></Link>
        </ul>
      </div>
    </nav>
  );
};

export default HomeNav;
