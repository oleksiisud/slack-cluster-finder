import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { keepTheme } from "/src/themes.js"
import { IoLogoSlack } from "react-icons/io5";
import { MdEmail } from "react-icons/md";
import { RiLockPasswordFill } from "react-icons/ri";
import { supabase } from '../../supabaseClient.js';
import { useAuth } from '../../AuthContext.jsx';
import './Login.css'

const Login = () => {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  useEffect(() => {
    if (session) navigate('/home');
  }, [session, navigate])


  const handleSlackLogin = async () => {
    setLoading(true);
    try {
      const appOrigin = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'slack_oidc',
        options: {
          redirectTo: `${appOrigin}/home`,
        }
      });
      if (error) throw error;
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Navigation will happen via useEffect on auth state change
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
      keepTheme();
    }, [])
  
  return (
    <div className="form">
      <h1> Login to Stellar-Search</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="jersey-10-regular">Welcome</h2>
        
        <label htmlFor="email">Email Address <MdEmail/> </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required    
        />
        
        <label htmlFor="password">Password <RiLockPasswordFill/> </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required    
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Enter'}
        </button>
        <button type="button" onClick={handleSlackLogin} disabled={loading}>
                {loading ? (
            "Signing in..."
          ) : (
            <>
              Sign in with Slack <IoLogoSlack size={20} />
            </>
          )}
        </button>
        <Link to={'/sign-up'}><p><button type="submit">New User? Sign up</button></p></Link>
      </form>
    </div>
  )
}

export default Login;