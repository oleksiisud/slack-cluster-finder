import { useEffect, useRef } from 'react';
import messagesData from './messages.json';
import './FakeMessages.css';
import starPic from './data_assets/star1.jpg'; 
import cat from './data_assets/poptart-cat.jpg';
import kirby from './data_assets/kirby-star.jpg';
import mario from './data_assets/mario-star.jpg';
import stardoodle from './data_assets/star_doodle.jpg';

// Optional mapping
const profilePics = {
  Lena: starPic,
  Arjun: stardoodle,
  Maya: kirby,
  Chris: starPic,
  Jordan: mario,
  Alex: starPic,
  Nia: stardoodle,
  Eli: starPic,
  Sam: stardoodle,
};

export default function FakeMessages() {
  const scrollContainerRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Start auto-scrolling
    scrollIntervalRef.current = setInterval(() => {
      if (container) {
        const maxScroll = container.scrollHeight - container.clientHeight;
        
        // If we've reached the bottom, smoothly scroll back to top
        if (container.scrollTop >= maxScroll - 10) {
          container.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        } else {
          // Otherwise, scroll down slowly
          container.scrollBy({
            top: 1,
            behavior: 'smooth'
          });
        }
      }
    }, 50); // Scroll every 50ms for smooth movement

    // Cleanup on unmount
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="messages">
      <div className="messages-window" ref={scrollContainerRef}>
        {messagesData.map((msg, index) => (
          <div key={index} className={`message-row ${msg.sender.toLowerCase()}`}>

            {/* Profile Picture */}
            <img
              src={profilePics[msg.sender] || starPic} 
              alt={`${msg.sender} profile`} 
              className="profile-pic"
            />

            <div className="message-content">
              <div className="meta">
                <span className="name">{msg.sender}</span>
              </div>
              <div className="bubble">{msg.text}</div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
