import React, { useContext, useEffect, useState } from 'react'
import ChatArea from '../components/ChatArea'
import RightSidebar from '../components/RightSidebar'
import ChatContext from '../../Context/ChatContext'
import IncomingCall from '../components/IncomingCall'
import Sidebar from '../components/Sidebar'
import OutGoingCall from '../components/OutGoingCall'
import { CallContext } from '../../Context/CallContext'
import AuthContext from '../../Context/AuthContext'


const Homepage = () => {
  const {selectedUser} = useContext(ChatContext);
  const {isAnyIncomingCall,setIsAnyIncomingCall,callType,callerInfo,isIncomingCallCancelled,
  setIsIcomingCallCancelled,roomId,isAnyOutgoingCall,setIsAnyOutgoingCall} = useContext(CallContext);
  const [ongoingcallType,setOngoingcallType] = useState(false);
  const {socket} = useContext(AuthContext)

  return (
    <div className='w-full h-screen sm:px-[15%] sm:py-[5%]'>
      <div className={`backdrop-blur-xl border-2 border-gray-400 rounded-2xl
      overflow-hidden h-[100%] grid grid-cols-1 relative ${selectedUser ? 'md:grid-cols-[1fr_1.5fr_1fr] xl:grid-cols-[1fr_2fr_1fr]':'md:grid-cols-2'}`}>
        {isAnyIncomingCall ? (
            <IncomingCall isAnyIncomingCall={isAnyIncomingCall} setIsAnyIncomingCall={setIsAnyIncomingCall} setIsAnyOutgoingCall={setIsAnyOutgoingCall} callType={callType}
            callerInfo={callerInfo} isIncomingCallCancelled={isIncomingCallCancelled} setIsIcomingCallCancelled={setIsIcomingCallCancelled} roomId={roomId} />
        ) : isAnyOutgoingCall && !isIncomingCallCancelled ? (
            <OutGoingCall ongoingcallType={ongoingcallType} setIsAnyOutgoingCall={setIsAnyOutgoingCall} isAnyOutgoingCall={isAnyOutgoingCall} />
        ):(
          <>
            <Sidebar />
            <ChatArea setOngoingcallType={setOngoingcallType} setIsAnyOutgoingCall={setIsAnyOutgoingCall} />
            <RightSidebar/>
          </>
        )}
      </div>
    </div>
  )
}

export default Homepage