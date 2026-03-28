import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './contexts'
import App from './App.jsx'
import './index.css'

const VotePage = lazy(() => import('./pages/VotePage.jsx').then(m => ({ default: m.VotePage })))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/vote/:pollId" element={
          <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0E0E1A',color:'#374DF5',fontFamily:'Inter,system-ui,sans-serif'}}>Cargando...</div>}>
            <VotePage />
          </Suspense>
        } />
        <Route path="*" element={
          <AppProvider>
            <App />
          </AppProvider>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
