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
  Arjun: starPic,
  Maya: kirby,
  Chris: starPic,
  Jordan: mario,
  Alex: starPic,
  Nia: starPic,
  Eli: starPic,
  Sam: stardoodle,
};

export default function FakeMessages() {
  return (
    <div className="messages">
      <div className="messages-window">
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
