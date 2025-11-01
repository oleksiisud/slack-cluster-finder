import { StrictMode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client'
import './index.css'
import './colors.css'
import App from './App.jsx'
import Login from './components/Login.jsx'
import Account from './components/Account.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
   <BrowserRouter>
  <Routes>
    <Route path ="/slack-cluster-finder" element = {<App/>} > </Route>
    <Route path="/home" element={<App />} />
    <Route path="/" element={<Login />} />
    <Route path="/log-in" element={<Login />} />
    <Route path="/account" element = {<Account />} />
  </Routes>
</BrowserRouter>
  </StrictMode>,
)
