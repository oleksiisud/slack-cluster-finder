import 'bootstrap/dist/css/bootstrap.min.css';
import { StrictMode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import './index.css';
import './colors.css';
import { AuthProvider } from './AuthContext.jsx';
import App from './App.jsx';
import Login from './components/landing-pages/Login.jsx';
import Signup from './components/landing-pages/Signup.jsx';
import Account from './components/Account.jsx';
import DataCollection from './components/DataCollection.jsx';
import Dashboard from './components/data/Dashboard.jsx';
import Homepage from './components/landing-pages/LandingPage.jsx';
import Nav from './components/Nav.jsx';
import HomeNav from './components/landing-pages/HomeNav.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

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
        <Route path="/home" element={<App />} />
        <Route path="/log-in" element={<Login />} />
        <Route path="/sign-up" element={<Signup />} />
        <Route path="/account" element={<Account />} />
        <Route path="/new-dashboard" element={<DataCollection />} />
        <Route path="/dashboard/:channelId" element={<Dashboard />} />
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
