import { useNavigate } from 'react-router-dom';
import './Login.css'


const Signup = () => {
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
      <h1> Create Account for Slack Cluster Finder</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="jersey-10-regular">Enter Your Information Below</h2>
        
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
        
        <label htmlFor="password">Create Password</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Enter your password"
          // value={loginData.password}
          // onChange={handleChange}
          // required    
        />
         <label htmlFor="password">Re-enter Password</label>
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

export default Signup;