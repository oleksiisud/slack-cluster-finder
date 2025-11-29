import stars from './landing-pages-assets/stars.gif';
import FakeMessages from '../data/fakeMessages.jsx';
import MiniCluster from './MiniCluster.jsx';
import { useRef, useEffect } from 'react';
import 'aos/dist/aos.css';
import './LandingPage.css'
import AOS from 'aos';


import { DotLottieReact } from '@lottiefiles/dotlottie-react';

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
      <h1 ref={headerRef} className="HomepageHeader HomepageHeader--hidden">
        Understand your workspace in seconds.
      </h1>
      <p>yerrr</p>
      <div ref={walkthroughRef} className="Walkthrough" data-aos="fade-up">
     
        <div className="Steps">
          <div className="messages" data-aos="fade-right">
            <h3 className="walkthrough-headers" data-aos= "fade-down">Raw Messages</h3>
            <FakeMessages />
          </div>
          <div className='gif' data-aos="fade-up">
          <h3 className="walkthrough-headers" data-aos= "fade-down" >AI Understanding</h3>
          <DotLottieReact className="gif-image"
               src="https://lottie.host/85b12a28-2e57-4379-a441-bacf673ea60d/Jjhd1m2Rhz.lottie"
                loop
                autoplay
              />
          </div>
          <div className="cluster" data-aos="fade-left">
          <h3 className="walkthrough-headers" data-aos= "fade-down">Topic Clusters</h3>
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
