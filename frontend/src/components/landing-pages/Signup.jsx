import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient.js';
import { useAuth } from '../../AuthContext.jsx';
import { keepTheme } from "/src/themes.js";
import './Login.css'


const Signup = () => {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate('/home');
  }, [session, navigate]);

  useEffect(() => {
    keepTheme();
  }, []);
  
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const appOrigin = import.meta.env.VITE_APP_URL || window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${appOrigin}/home`,
        }
      });
      
      if (error) throw error;

      if (data?.user && !data?.session) {
        alert('Check your email for the confirmation link!');
      }
    } catch (error) {
      setError(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="form">
      <h1>Create Account for Stellar Search</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="jersey-10-regular">Enter Your Information Below</h2>
        
        {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required    
        />
        
        <label htmlFor="password">Create Password</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Enter your password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required    
        />

        <label htmlFor="confirmPassword">Re-enter Password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required    
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          Already have an account? <Link to="/log-in">Login here</Link>
        </p>
      </form>
    </div>
  )
}

export default Signup;