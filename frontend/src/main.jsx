import 'bootstrap/dist/css/bootstrap.min.css';
import { StrictMode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client'
import './index.css'
import './colors.css'
import { AuthProvider } from './AuthContext'
import Home from './Home'
import Login from './components/landing-pages/Login'
import Signup from './components/landing-pages/Signup' 
import Account from './components/Account'
import ProtectedRoute from './ProtectedRoute';

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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
