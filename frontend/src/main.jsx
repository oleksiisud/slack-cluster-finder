import 'bootstrap/dist/css/bootstrap.min.css';
import { StrictMode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client'
import './index.css'
import './colors.css'
import { AuthProvider } from './AuthContext.jsx'
import Home from './Home.jsx'
import Login from './components/landing-pages/Login.jsx'
import Signup from './components/landing-pages/Signup.jsx' 
import Account from './components/Account.jsx'
import CreateChat from './pages/CreateChat.jsx';
import Dashboard from './components/data/Dashboard.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import RadialClusterGraph from './components/graph/RadialClusterGraph.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth routes */}
          <Route path="/" element={<Login />} />
          <Route path="/slack-cluster-finder" element={<Login />} />
          <Route path="/log-in" element={<Login />} />
          <Route path="/sign-up" element={<Signup />} />
          
          {/* Main app routes */}
          <Route path="/home" element={<Home />} />
          <Route path="/account" element={<Account />} />
          <Route path="/create-chat" element={<CreateChat />} />
          <Route path="/dashboard/:channelId" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
