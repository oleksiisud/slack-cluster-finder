import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FakeMessages from '../data/fakeMessages.jsx';
import fillerGif from './landing-pages-assets/fix_cloud.gif';
import stars from './landing-pages-assets/stars.gif';
import MiniCluster from './MiniCluster.jsx';
import AOS from 'aos';
import 'aos/dist/aos.css';
import './LandingPage.css'

const LandingPage = () => {
  const motiveRef = useRef(null);
  const solutionRef = useRef(null);
  const walkthroughRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    // Initialize AOS animations
    AOS.init({
      duration: 600,       // faster animation
      easing: 'ease-in-out',
      once: false,         // repeat animations on scroll
    });

    // Show header immediately
    const headerEl = headerRef.current;
    if (headerEl) {
      headerEl.classList.add('HomepageHeader--visible');
    }
  }, []);

  return (
    <div className='Homepage'
      style={{
        backgroundImage: `url(${stars})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'transparent'
      }}
    >
      <h2 ref={headerRef} className="HomepageHeader HomepageHeader--hidden">
        Search through your messages easily
      </h2>

      <div ref={walkthroughRef} className="Walkthrough" data-aos="fade-up">
        <div className="Steps">
          <div className="messages" data-aos="fade-right">
            <FakeMessages />
          </div>
          <div className='gif' data-aos="fade-up">
            <img src={fillerGif} alt="construction smoke" className="gif-image" />
          </div>
          <div className="cluster" data-aos="fade-left">
            <MiniCluster />
          </div>
        </div>
      </div>

      <div className="AboutInfo">
        <div ref={motiveRef} className='Motive' data-aos="fade-up">
          <p>
            The core problem is information fragmentation and user disorientation in large chat spaces.
            While the existing project provides a structure, the proposal needs to detail how to achieve
            high-quality, high-performance clustering.
          </p>
        </div>
        <div ref={solutionRef} className='Solution' data-aos="fade-left">
          <p>
            Our goal is to move beyond simple channel analysis to deliver actionable insights
            by automatically identifying and grouping latent topic clusters within large, active
            Slack and Discord communities.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
