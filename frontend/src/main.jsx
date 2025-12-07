import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import './index.css';
import './colors.css';
import { AuthProvider } from './AuthContext.jsx';
import DataCollection from './components/DataCollection.jsx';
import Homepage from './components/landing-pages/LandingPage.jsx';
import Nav from './components/Nav.jsx';
import HomeNav from './components/landing-pages/HomeNav.jsx';
import SlackCallback from './components/SlackCallback.jsx';
import DiscordCallback from './components/DiscordCallback.jsx';
import { StrictMode } from 'react'
import Home from './Home'
import Login from './components/landing-pages/Login'
import Signup from './components/landing-pages/Signup' 
import Account from './components/Account'
import ProtectedRoute from './ProtectedRoute';

const Root = () => {
  const location = useLocation();

  const hideNav = ["/log-in", "/sign-up"].includes(location.pathname);

  const showHomeNav = ["/slack-cluster-finder", "/", "/"].includes(location.pathname);

  return (
    <>
      {!hideNav && (showHomeNav ? <HomeNav /> : <Nav />)}

      <Routes>
        <Route path="/slack-cluster-finder" element={<Homepage />} />
        <Route path="/" element={<Homepage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/log-in" element={<Login />} />
        <Route path="/sign-up" element={<Signup />} />
        <Route path="/account" element={<Account />} />
        <Route path="/new-dashboard" element={<DataCollection />} />
        <Route path="/slack/callback" element={<SlackCallback />} />
        <Route path="/discord/callback" element={<DiscordCallback />} />
        {/* <Route path="/dashboard/:channelId" element={<Dashboard />} /> */}
      </Routes>
    </>
  );
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
