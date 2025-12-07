/**
 * Discord OAuth Callback Page
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleDiscordCallback } from '../services/discordAuth';

const DiscordCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`Authorization failed: ${errorParam}`);
        setTimeout(() => navigate('/new-dashboard'), 3000);
        return;
      }

      if (!code || !state) {
        setError('Missing authorization parameters');
        setTimeout(() => navigate('/new-dashboard'), 3000);
        return;
      }

      try {
        setStatus('Exchanging authorization code...');
        await handleDiscordCallback(code, state);
        setStatus('Success! Discord connected.');
        setTimeout(() => navigate('/new-dashboard'), 2000);
      } catch (err) {
        setError(err.message || 'Failed to complete Discord authorization');
        setTimeout(() => navigate('/new-dashboard'), 3000);
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{ maxWidth: '500px' }}>
        <h2>Discord Authorization</h2>
        {error ? (
          <>
            <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>
            <p style={{ marginTop: '1rem' }}>Redirecting back to dashboard...</p>
          </>
        ) : (
          <>
            <p style={{ marginTop: '1rem' }}>{status}</p>
            <div style={{ marginTop: '2rem' }}>
              <div className="spinner"></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DiscordCallback;
