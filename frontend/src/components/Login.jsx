import { useNavigate } from 'react-router-dom';
import './Login.css'


const Login = () => {
  // Will add MongoDB Auth and JWS
  
  const navigate = useNavigate();
  
  const handleSubmit = (event) => {
    event.preventDefault();
    // TODO: Add MongoDB Auth and JWT validation
    // Redirect to Slack Cluster Finder Page
    navigate('/home');
  };
  
  return (
    <div className="form">
      <h1> Sign into Slack Cluster Finder</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="jersey-10-regular">Welcome</h2>
        
        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          // value={loginData.email}
          // onChange={handleChange}
          // required    
        />
        
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Enter your password"
          // value={loginData.password}
          // onChange={handleChange}
          // required    
        />
        
        <button type="submit">Enter</button>
      </form>
    </div>
  )
}

export default Login;