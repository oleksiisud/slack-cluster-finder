// ...existing code...
import { useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Home.css'

import FakeMessages from '../data/fakeMessages.jsx';
import fillerGif from './landing-pages-assets/fix_cloud.gif';
import stars from './landing-pages-assets/stars.gif';
import MiniCluster from './MiniCluster.jsx';

const Home = () => {
  const motiveRef = useRef(null);
  const solutionRef = useRef(null);
  const walkthroughRef = useRef(null);
  const headerRef = useRef(null);

  // ...existing code...
  useEffect(() => {
    // show header immediately on mount (load first)
    const headerEl = headerRef.current;
    if (headerEl) {
      // ensure initial hidden class is present in markup/CSS, then reveal
      requestAnimationFrame(() => headerEl.classList.add('HomepageHeader--visible'));
    }

    // reveal Walkthrough shortly after header paints (so it loads first)
    const preWalkEl = walkthroughRef.current;
    if (preWalkEl) {
      // small delay so header renders first; adjust ms to taste
      requestAnimationFrame(() => setTimeout(() => {
        preWalkEl.classList.add('Walkthrough--visible');
        preWalkEl.classList.remove('Walkthrough--hidden');
      }, 150));
    }

    // helper to observe and toggle classes; if repeat=true it will remove visible when out of view
    // ...existing code...
    // ...existing code...
    const observeToggle = (el, { threshold = 0.15, repeat = false, rootMargin = '0px 0px -10% 0px' } = {}) => {
      if (!el) return null;
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const target = entry.target;
          const anim = target.dataset.anim;
          if (!anim) return;

          const visibleCls = `${anim}--visible`;
          const hiddenCls = `${anim}--hidden`;
          const altVisible = `${anim}-visible`; // cleanup for old incorrect classes
          const altHidden = `${anim}-hidden`;

          if (entry.isIntersecting) {
            target.classList.add(visibleCls);
            // remove both correct and any stray incorrect variants
            target.classList.remove(hiddenCls, altHidden, altVisible);
            if (!repeat) {
              // one-time animation: stop observing after first reveal
              obs.unobserve(target);
            }
          } else if (repeat) {
            target.classList.add(hiddenCls);
            target.classList.remove(visibleCls, altVisible, altHidden);
          }
        });
      }, { threshold, rootMargin });
      obs.observe(el);
      return obs;
    };
    // ...existing code...

    // ...existing code...
    const walkEl = walkthroughRef.current;
    let motiveEl = motiveRef.current;
    let solutionEl = solutionRef.current;

    // debug: log refs so we can see if the DOM nodes exist when effect runs
    // open your browser console to view these logs
    // (remove these logs after you're done debugging)
    // eslint-disable-next-line no-console
    console.log('walkEl', walkEl, 'motiveRef.current', motiveRef.current);

    // fallback: if the ref isn't set for some reason, try querying the DOM directly
    if (!motiveEl) {
      // eslint-disable-next-line no-console
      console.warn('motiveRef is null — falling back to document.querySelector(".Motive")');
      motiveEl = document.querySelector('.Motive');
      // eslint-disable-next-line no-console
      console.log('fallback motiveEl', motiveEl);
    }

    // set data-anim keys used above to generate class names
    if (walkEl) walkEl.dataset.anim = 'Walkthrough';
    if (motiveEl) motiveEl.dataset.anim = 'Motive';
    if (solutionEl) solutionEl.dataset.anim = 'Solution';

    // only observe elements that actually exist
    const walkObs = walkEl ? observeToggle(walkEl, { threshold: 0.15, repeat: true }) : null;
    const motiveObs = motiveEl ? observeToggle(motiveEl, { threshold: 0.05, repeat: true, rootMargin: '0px 0px -20% 0px' }) : null;
    const solutionObs = solutionEl ? observeToggle(solutionEl, { threshold: 0.05, repeat: true, rootMargin: '0px 0px -20% 0px' }) : null;
    // ...existing code...
    return () => {
      if (walkObs) walkObs.disconnect();
      if (motiveObs) motiveObs.disconnect();
      if (solutionObs) solutionObs.disconnect();
    };
  }, []);

  return (
    <>

      <div className='Homepage'
        style={{
          backgroundImage: `url(${stars})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: 'transparent'
        }}>
        <h2 ref={headerRef} className="HomepageHeader HomepageHeader--hidden">Search through your messages easily</h2>

        <div ref={walkthroughRef} className="Walkthrough Walkthrough--hidden">
          <div className="Steps">
            <div className="messages">
              <h3 className="message_header"></h3>
              <FakeMessages />
            </div>
            <div className='gif'>
              <img src={fillerGif} alt="construction smoke" className="gif-image" />
            </div>
            <div className="cluster">
              <MiniCluster />
            </div>
          </div>
        </div>

        <div className="AboutInfo">
          <div ref={motiveRef} className='Motive Motive--hidden'>
            <p>The core problem is information fragmentation and user disorientation in large chat spaces.
              While the existing project provides a structure,
              the proposal needs to detail how to achieve high-quality, high-performance clustering.</p>
          </div>
          <div ref={solutionRef} className='Solution Solution--hidden'>
            <p>Our goal is to move beyond simple channel analysis to deliver actionable insights
              by automatically identifying and grouping latent topic clusters within large, active Slack and Discord communities.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
// ...existing code...