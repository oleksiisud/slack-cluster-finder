import messagesData from './messages.json'
import './FakeMessages.css'
export default function FakeMessages() {
    return (
      <div className="messages">
        <div className="messages-window">
            {messagesData.map((msg, index) => (
                <div key={index} className={`message-row ${msg.from}`}>
                
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