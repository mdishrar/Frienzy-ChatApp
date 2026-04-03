import React, { useContext, useEffect, useState } from 'react'
import assets from '../assets/assets'
import ChatContext from '../../Context/ChatContext'
import { CallContext } from '../../Context/CallContext'
import {PhoneOff} from "lucide-react"
import AuthContext from '../../Context/AuthContext'
import { useNavigate } from 'react-router-dom' 

const OutGoingCall = ({ongoingcallType,setIsAnyOutgoingCall,isAnyOutgoingCall}) => {
  const {selectedUser} = useContext(ChatContext);
  const {getRoomforUsercalling,roomId} = useContext(CallContext);
  const {socket,authUser} = useContext(AuthContext)
  const [isCallpicked, setIsCallpicked] = useState(false);
  const navigate = useNavigate();
  console.log(ongoingcallType)

  useEffect(() => {
    const handler = (data) => {
      if (data.callpicked) {
        setIsCallpicked(true);
      }
    };

    socket.on('notifyingCaller', handler);

    return () => {
      socket.off('notifyingCaller', handler);
    };
  }, [socket]);

  useEffect(()=>{
    if(isCallpicked){
      console.log(ongoingcallType)
      if(ongoingcallType == 'VideoCall'){
        navigate('/videocall')
      }else{
        navigate('/audioCall')
      }
      setIsAnyOutgoingCall(false)
    }
  },[isCallpicked,ongoingcallType,navigate])


  useEffect(()=>{
    if(isAnyOutgoingCall){
      getRoomforUsercalling(ongoingcallType);
    }
  },[isAnyOutgoingCall])

  
  const handleClick = (e) => {
    e.preventDefault();
    socket.emit('call:end',{roomId,userId:authUser._id,to:selectedUser._id});
    setIsAnyOutgoingCall(false);
    
  }

  return isAnyOutgoingCall && (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="text-center text-white space-y-6">
        <div className="flex justify-center">
          <img src={selectedUser.profilePic || assets.avatar_icon} />
        </div>
        <div>
          <p className="text-lg opacity-70">{ongoingcallType}</p>
          <h2 className="text-2xl font-semibold">
            {selectedUser?.fullName || "Unknown"}
          </h2>
        </div>
        <div className="flex gap-10 justify-center mt-6">
          <button onClick={handleClick} className="bg-red-500 p-5 rounded-full hover:scale-110 transition">
            <PhoneOff size={28} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default OutGoingCall