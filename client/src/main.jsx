import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {BrowserRouter} from "react-router-dom"
import {AuthProvider} from '../Context/AuthProvider.jsx'
import { ChatProvider } from '../Context/ChatProvider.jsx'
import { CallProvider } from '../Context/CallProvider.jsx'


createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ChatProvider>
        <CallProvider>
         <App/>
        </CallProvider>
      </ChatProvider>
    </AuthProvider>
  </BrowserRouter>,
)
