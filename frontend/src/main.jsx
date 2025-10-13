import { StrictMode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
   <BrowserRouter>
  <Routes>
    <Route path ="/slack-cluster-finder" element = {<App/>} > </Route>
    <Route path="/home" element={<App />} />
    <Route path="/" element={<App />} />

  </Routes>
</BrowserRouter>
  </StrictMode>,
)
