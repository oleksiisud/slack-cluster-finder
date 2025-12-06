import 'bootstrap/dist/css/bootstrap.min.css';
import { StrictMode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client'
import './index.css'
import './colors.css'
import { AuthProvider } from './AuthContext.jsx'
import App from './App.jsx'
import Login from './components/landing-pages/Login.jsx'
import Signup from './components/landing-pages/Signup.jsx' 
import Account from './components/Account.jsx'
import DataCollection from './components/DataCollection.jsx';
import Dashboard from './components/data/Dashboard.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import SlackAuth from './components/slack/SlackAuth.jsx';
import SlackCallback from './components/slack/SlackCallback.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path ="/slack-cluster-finder" element = {<Login/>} > </Route>
          <Route path="/" element={<Login />} />
          <Route path="/log-in" element={<Login />} />
          <Route path="/sign-up" element={<Signup />} />
          <Route path="/home" element={<App />} />
          <Route path="/account" element = {<Account />} />
          <Route path ="/new-dashboard" element = {<DataCollection/>} />
          <Route path="/dashboard/:channelId" element={<Dashboard />} />
          <Route path="/slack/auth" element={<SlackAuth />} />
          <Route path="/slack/callback" element={<SlackCallback />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
