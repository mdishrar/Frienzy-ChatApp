import React, { useContext,useEffect } from 'react'
import assets from '../assets/assets';
import { useNavigate } from 'react-router-dom';
import {Phone,PhoneOff} from "lucide-react"
import {CallContext} from "../../Context/CallContext"
import AuthContext from '../../Context/AuthContext';
import ChatContext from '../../Context/ChatContext';


const IncomingCall = () => {
  const navigate = useNavigate();
  const {incomingCallTime,isAnyIncomingCall,setIsAnyIncomingCall,setIsAnyOutgoingCall,callType,
  callerInfo,isIncomingCallCancelled,setIsIcomingCallCancelled,roomId} = useContext(CallContext);
  const {socket,authUser} = useContext(AuthContext);
  const {setSelectedUser} = useContext(ChatContext)

  useEffect(() => {
    if (!isAnyIncomingCall || !incomingCallTime) return;
  
    const timeout = setTimeout(() => {
  
      setIsAnyIncomingCall(false);
      setIsIcomingCallCancelled(true);
  
    }, incomingCallTime); 
    return () => clearTimeout(timeout); 
  }, [isAnyIncomingCall,incomingCallTime]);


  const handleClick = (e) =>{
    e.preventDefault();
    
    socket.emit('call:join',{
      roomId: roomId,
      userId: authUser._id,
      callerId : callerInfo?.callerId
    })
    setSelectedUser(callerInfo?.callerId);
    setIsAnyOutgoingCall(false);
    setIsAnyIncomingCall(false);
    if(callType === 'VideoCall'){
      navigate('/videocall')
    }else{
      navigate('/audioCall');
    }
  }

  const onclickCancel = (e) =>{
      e.preventDefault();
      setIsAnyIncomingCall(false);
      setIsIcomingCallCancelled(true);
      socket.emit('call:end',{
        roomId: roomId,
        userId : authUser._id,
        to : callerInfo?.callerId
      })
  }
  
  return (
    isAnyIncomingCall && !isIncomingCallCancelled &&(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="text-center text-white space-y-6">
        <div className="flex justify-center">
          <img src={callerInfo?.profilePic || assets.avatar_icon} className='rounded-full'/>
        </div>
        <div>
          <p className="text-lg opacity-70">Incoming {callType}</p>
          <h2 className="text-2xl font-semibold">
            {callerInfo?.fullName || "Unknown"}
          </h2>
        </div>
        <div className="flex gap-10 justify-center mt-6">
          <button onClick={handleClick} className="bg-green-500 p-5 rounded-full hover:scale-110 transition">
            <Phone size={28} />
          </button>
          <button onClick={onclickCancel} className="bg-red-500 p-5 rounded-full hover:scale-110 transition">
            <PhoneOff size={28} />
          </button>
        </div>
        <div className='text-white'>
          <p>RayId : {roomId}</p>
        </div>
      </div>
    </div>
    )
  )
}

export default IncomingCall

