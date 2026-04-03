import React, { useContext, useState,useEffect} from 'react'
import { CallContext } from './CallContext'
import ChatContext from './ChatContext'
import AuthContext from './AuthContext'
import toast from 'react-hot-toast'

const loadCallState = () => {
  try {
    const saved = sessionStorage.getItem('callState')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export const CallProvider = ({children}) => {
  const persisted = loadCallState()
  const {authUser,axios,socket} = useContext(AuthContext)
  const {selectedUser} = useContext(ChatContext);
  const [isAnyIncomingCall,setIsAnyIncomingCall] = useState(persisted?.isAnyIncomingCall ?? false);
  const [callType, setCallType] = useState(persisted?.callType ?? null);
  const [roomId, setRoomId] = useState(persisted?.roomId ?? null);
  const [callerInfo, setCallerInfo] = useState(persisted?.callerInfo ?? null);
  const [isIncomingCallCancelled,setIsIcomingCallCancelled] = useState(false);
  const [incomingCallTime ,setIncomingCallTime] = useState(null)
  const [isAnyOutgoingCall,setIsAnyOutgoingCall] = useState(false)

    useEffect(()=>{
      if(!socket) return;

      const handleIncomingCall = (data) => {
          setCallType(data.callType)
          setRoomId(data.roomid)
          setCallerInfo(data.callerInfo)
          setIsAnyIncomingCall(true)
          setIncomingCallTime(data.incomingCalltime)
      }
      socket.on('incomingCall', handleIncomingCall)
      return () => socket.off('incomingCall', handleIncomingCall)
    },[socket])


  useEffect(()=>{
    if(!socket) return;
    const handleCallEnded = ({by})=>{
      clearCallState();
      setIsAnyOutgoingCall(false);
    };
    socket.on('call:ended',handleCallEnded)
    return ()=>socket.off('call:ended',handleCallEnded)
  },[socket])

  useEffect(() => {
    if (isAnyIncomingCall) {
      sessionStorage.setItem('callState', JSON.stringify({
        isAnyIncomingCall,
        callType,
        roomId,
        callerInfo,
        incomingCallTime,
      }))
    } else {
      sessionStorage.removeItem('callState')
    }
  }, [isAnyIncomingCall, callType, roomId, callerInfo,incomingCallTime])

   const clearCallState = () => {
    sessionStorage.removeItem('callState')
    setIsAnyIncomingCall(false)
    setCallType(null)
    setRoomId(null)
    setCallerInfo(null)
    setIncomingCallTime(null)
    setIsIcomingCallCancelled(false);
  }

  const getRoomforUsercalling = async (ongoingcallType) =>{
      try{
        if(!authUser){
          toast.error("Unauthorized Sender")
          return;
        }
        const { data } = await axios.post(`/api/messages/call/start/${ongoingcallType}/${selectedUser._id}`)
        if(data.success){
          toast.success("You connected to server")
          setRoomId(data.roomid)
        }
      }catch(error){
        console.log(error.message);
        toast.error(error.message)
      }
    }

    const value ={
      getRoomforUsercalling,
      isIncomingCallCancelled,setIsIcomingCallCancelled,
      isAnyIncomingCall,setIsAnyIncomingCall,incomingCallTime,
      setCallType,callType,clearCallState,isAnyOutgoingCall,
      roomId,callerInfo,setCallerInfo,setRoomId,setIsAnyOutgoingCall,
    }
  return (
    <CallContext.Provider value={value}>
        {children}
    </CallContext.Provider>
  )
}