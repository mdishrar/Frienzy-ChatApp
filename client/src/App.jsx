import React, { useContext } from 'react'
import { Routes,Route, Navigate } from 'react-router-dom'
import Homepage from './pages/Homepage'
import Login from './pages/Login'
import ProfilePage from './pages/ProfilePage'
import VideoCall from './pages/VideoCall'
import Audiocall from './pages/Audiocall'
import {Toaster} from "react-hot-toast"
import AuthContext from '../Context/AuthContext'

const App = () => {
  const {authUser} = useContext(AuthContext);

  return (
    <div className="bg-[url('/bgImage.svg')] bg-contain">
      <Toaster/>
      <Routes>
        <Route path='/' element={authUser ? <Homepage/>:<Navigate to='/login' />} />
        <Route path='/login' element={!authUser ?<Login/>:<Navigate to='/' />} />
        <Route path='/profile' element={authUser ? <ProfilePage/>:<Navigate to='/login' />}  />
        <Route path='/audiocall' element={authUser ? <Audiocall/>:<Navigate to='/login' />}  />
        <Route path='/videocall' element={authUser ?<VideoCall/>:<Navigate to='/login' />}  />
      </Routes>
    </div>
  )
}

export default App
