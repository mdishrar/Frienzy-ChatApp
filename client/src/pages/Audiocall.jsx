import React, { useContext, useEffect, useState, useRef } from 'react'
import { PhoneOff, Mic, MicOff } from 'lucide-react'
import { CallContext } from '../../Context/CallContext'
import AuthContext from '../../Context/AuthContext'
import ChatContext from '../../Context/ChatContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import assets from '../assets/assets'

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
}

const AudioCall = () => {
    const { roomId, callerInfo, setIsAnyOutgoingCall, setIsIcomingCallCancelled } = useContext(CallContext)
    const { socket, authUser } = useContext(AuthContext)
    const { selectedUser } = useContext(ChatContext)
    const navigate = useNavigate()

    const localStreamRef = useRef(null)
    const remoteAudioRef = useRef(null)   // <audio> element ref
    const pcRef = useRef(null)

    const [isMuted, setIsMuted] = useState(false)
    const [callStatus, setCallStatus] = useState('Connecting...')
    const [callDuration, setCallDuration] = useState(0)  // seconds
    const timerRef = useRef(null)

    // ─── Role Detection ───────────────────────────────────────────────────────
    const isCallerRole = !callerInfo?.callerId
    const remotePeerId = isCallerRole ? selectedUser?._id : callerInfo?.callerId
    const remoteUser   = isCallerRole ? selectedUser       : callerInfo

    // ─── Start timer when connected ───────────────────────────────────────────
    const startTimer = () => {
        timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1)
        }, 1000)
    }

    const formatDuration = (secs) => {
        const m = String(Math.floor(secs / 60)).padStart(2, '0')
        const s = String(secs % 60).padStart(2, '0')
        return `${m}:${s}`
    }

    const setupMediaAndPC = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: {noiseSuppression:true,echoCancellation:true,autoGainControl:true}, video: false })
        localStreamRef.current = stream

        const pc = new RTCPeerConnection(ICE_SERVERS)
        pcRef.current = pc

        stream.getTracks().forEach(track => pc.addTrack(track, stream))

        // When remote audio arrives, play it
        pc.ontrack = (event) => {
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0]
                setCallStatus('Connected')
                startTimer()
            }
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
              socket.emit('call:ice-candidate', {
                  to: remotePeerId,
                  candidate: event.candidate
              })
          }
        }
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState
          console.log('PeerConnection state:', state)
          if (state === 'failed') {
              toast.error('Connection failed.')
              handleEndCall()
          }
        }

      return pc
    }

    const startCallerFlow = async () => {
        try {
            setCallStatus('Starting microphone...')
            const pc = await setupMediaAndPC()

            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            socket.emit('call:offer', {
                to: remotePeerId,        // ✅ selectedUser._id
                from: authUser._id,
                offer
            })

            setCallStatus('Ringing...')
        } catch (err) {
            console.error('Caller flow error:', err)
            toast.error('Could not start call: ' + err.message)
        }
    }

    const startCalleeFlow = async (offer) => {
        try {
            setCallStatus('Starting microphone...')
            const pc = await setupMediaAndPC()

            await pc.setRemoteDescription(new RTCSessionDescription(offer))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            socket.emit('call:answer', {
                to: remotePeerId,        // ✅ callerInfo.callerId
                from: authUser._id,
                answer
            })

            setCallStatus('Connected')
            startTimer()
        } catch (err) {
            console.error('Callee flow error:', err)
            toast.error('Could not answer call: ' + err.message)
        }
    }

    const cleanup = () => {
        clearInterval(timerRef.current)
        localStreamRef.current?.getTracks().forEach(t => t.stop())
        pcRef.current?.close()
        pcRef.current = null
        setIsAnyOutgoingCall(false)
        setIsIcomingCallCancelled(true)
    }

    const handleEndCall = () => {
        socket.emit('call:end', {
            roomId,
            userId: authUser._id,
            to: remotePeerId
        })
        cleanup()
        navigate('/')
    }
    useEffect(() => {
        if (!roomId || !remotePeerId) {
            console.error('AudioCall mounted without roomId or remotePeerId')
            navigate('/')
            return
        }

        if (isCallerRole) {
            socket.emit('call:caller-ready', { roomId, userId: authUser._id })
            startCallerFlow()
        }

        return () => cleanup()
    }, [])

    useEffect(() => {
        const handleOffer = ({ offer }) => {
            if (!isCallerRole) startCalleeFlow(offer)
        }

        const handleAnswer = async ({ answer }) => {
            try {
                if (pcRef.current) {
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
                    setCallStatus('Connected')
                    startTimer()
                }
            } catch (err) {
                console.error('Error setting answer:', err)
            }
        }

        const handleIceCandidate = async ({ candidate }) => {
            try {
                if (pcRef.current) {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
                }
            } catch (err) {
                console.error('ICE error:', err)
            }
        }

        const handleCallEnded = () => {
            toast(`Call ended by ${remoteUser?.fullName || 'other user'}`)
            cleanup()
            navigate('/')
        }

        socket.on('call:offer', handleOffer)
        socket.on('call:answer', handleAnswer)
        socket.on('call:ice-candidate', handleIceCandidate)
        socket.on('call:ended', handleCallEnded)   // ✅ 'call:ended' matches server emit

        return () => {
            socket.off('call:offer', handleOffer)
            socket.off('call:answer', handleAnswer)
            socket.off('call:ice-candidate', handleIceCandidate)
            socket.off('call:ended', handleCallEnded)
        }
    }, [socket, isCallerRole])

    // ─── Mute Toggle ──────────────────────────────────────────────────────────
    const toggleMute = () => {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0]
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled
            setIsMuted(prev => !prev)
        }
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
    return (
        <div className='w-full h-screen bg-gray-950 flex items-center justify-center'>

            {/* Hidden audio element — plays remote peer's audio */}
            <audio ref={remoteAudioRef} autoPlay />

            <div className='flex flex-col items-center gap-6 text-white'>

                {/* Avatar */}
                <div className='relative'>
                    <img
                        src={remoteUser?.profilePic || assets.avatar_icon}
                        className='w-28 h-28 rounded-full object-cover ring-4 ring-white/20'
                    />
                    {/* Pulsing ring while connecting */}
                    {callStatus !== 'Connected' && (
                        <span className='absolute inset-0 rounded-full ring-4 ring-white/30 animate-ping' />
                    )}
                </div>

                {/* Name */}
                <h2 className='text-2xl font-semibold tracking-wide'>
                    {remoteUser?.fullName || 'Unknown'}
                </h2>

                {/* Status / Timer */}
                <p className='text-gray-400 text-sm tracking-widest uppercase'>
                    {callStatus === 'Connected'
                        ? formatDuration(callDuration)
                        : callStatus
                    }
                </p>

                {/* Muted indicator */}
                {isMuted && (
                    <div className='flex items-center gap-2 bg-gray-800 px-4 py-1.5 rounded-full text-xs text-gray-300'>
                        <MicOff size={12} /> Microphone muted
                    </div>
                )}

                {/* Controls */}
                <div className='flex items-center gap-8 mt-4'>

                    {/* Mute */}
                    <button
                        onClick={toggleMute}
                        className={`p-4 rounded-full transition-all hover:scale-110
                            ${isMuted ? 'bg-gray-600' : 'bg-white/15 backdrop-blur-sm'}`}
                    >
                        {isMuted
                            ? <MicOff size={22} className='text-gray-300' />
                            : <Mic    size={22} className='text-white'    />
                        }
                    </button>

                    {/* End Call */}
                    <button
                        onClick={handleEndCall}
                        className='bg-red-500 p-5 rounded-full hover:scale-110 hover:bg-red-600 transition-all shadow-xl'
                    >
                        <PhoneOff size={26} className='text-white' />
                    </button>

                </div>
            </div>

        </div>
    )
}

export default AudioCall
