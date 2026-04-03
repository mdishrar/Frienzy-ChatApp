import React, { useEffect, useState, useContext, useRef } from 'react'
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { CallContext } from '../../Context/CallContext'
import AuthContext from '../../Context/AuthContext'
import ChatContext from '../../Context/ChatContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
}

const VideoCall = () => {
    const { roomId, callerInfo, setIsAnyOutgoingCall, setIsIcomingCallCancelled } = useContext(CallContext)
    const { socket, authUser } = useContext(AuthContext)
    const { selectedUser } = useContext(ChatContext)
    const navigate = useNavigate()

    const localVideoRef = useRef(null)
    const remoteVideoRef = useRef(null)
    const localStreamRef = useRef(null)
    const pcRef = useRef(null)

    const [isMuted, setIsMuted] = useState(false)
    const [isVideoOff, setIsVideoOff] = useState(false)
    const [callStatus, setCallStatus] = useState('Connecting...')

    // ─── Role Detection ───────────────────────────────────────────────────────
    // callerInfo is only populated on the CALLEE side (set when IncomingCall fires)
    // If callerInfo exists → we are the callee. Otherwise → we are the caller.
    const isCallerRole = !callerInfo?.callerId
    const remotePeerId = isCallerRole ? selectedUser?._id : callerInfo?.callerId
    const remoteUser   = isCallerRole ? selectedUser       : callerInfo

    // ─── Shared: Setup media stream + PeerConnection ──────────────────────────
    const setupMediaAndPC = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        localStreamRef.current = stream

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream
        }

        const pc = new RTCPeerConnection(ICE_SERVERS)
        pcRef.current = pc

        // Add local tracks to peer connection
        stream.getTracks().forEach(track => pc.addTrack(track, stream))

        // When remote stream arrives, show it
        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0]
                setCallStatus('Connected')
            }
        }

        // Send ICE candidates to the other peer
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
                toast.error('Connection failed. Please try again.')
                handleEndCall()
            }
        }

        return pc
    }

    // ─── CALLER Flow: create offer and send ───────────────────────────────────
    const startCallerFlow = async () => {
        try {
            setCallStatus('Starting camera...')
            const pc = await setupMediaAndPC()

            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            socket.emit('call:offer', {
                to: remotePeerId,       // ✅ selectedUser._id  (not callerInfo)
                from: authUser._id,
                offer
            })

            setCallStatus('Waiting for answer...')
        } catch (err) {
            console.error('Caller flow error:', err)
            toast.error('Could not start call: ' + err.message)
        }
    }

    // ─── CALLEE Flow: receive offer, create answer ────────────────────────────
    const startCalleeFlow = async (offer) => {
        try {
            setCallStatus('Starting camera...')
            const pc = await setupMediaAndPC()

            await pc.setRemoteDescription(new RTCSessionDescription(offer))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            socket.emit('call:answer', {
                to: remotePeerId,       // ✅ callerInfo.callerId
                from: authUser._id,
                answer
            })

            setCallStatus('Connected')
        } catch (err) {
            console.error('Callee flow error:', err)
            toast.error('Could not answer call: ' + err.message)
        }
    }

    // ─── End Call ─────────────────────────────────────────────────────────────
    const cleanup = () => {
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

    // ─── Mount: join room + start role-specific flow ──────────────────────────
    useEffect(() => {
        if (!roomId || !remotePeerId) {
            console.error('VideoCall mounted without roomId or remotePeerId')
            navigate('/')
            return
        }

        if (isCallerRole) {
            // Caller joins room separately (doesn't re-trigger notifyingCaller)
            socket.emit('call:caller-ready', {
                roomId,
                userId: authUser._id
            })
            startCallerFlow()
        }
        // Callee already joined room in IncomingCall.handleClick via call:join
        // Callee just waits for 'call:offer' (handled in socket listener below)

        return () => {
            cleanup()
        }
    }, []) // run once on mount

    // ─── Socket Listeners ─────────────────────────────────────────────────────
    useEffect(() => {
        // Callee receives the offer from caller
        const handleOffer = ({ offer }) => {
            if (!isCallerRole) {
                startCalleeFlow(offer)
            }
        }

        // Caller receives the answer from callee
        const handleAnswer = async ({ answer }) => {
            try {
                if (pcRef.current) {
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
                    setCallStatus('Connected')
                }
            } catch (err) {
                console.error('Error setting remote description (answer):', err)
            }
        }

        // Both sides receive ICE candidates from each other
        const handleIceCandidate = async ({ candidate }) => {
            try {
                if (pcRef.current) {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
                }
            } catch (err) {
                console.error('ICE candidate error:', err)
            }
        }

        // Other peer ended the call  ('call:ended' — past tense, matches server emit)
        const handleCallEnded = ({ by }) => {
            toast(`Call ended by ${remoteUser?.fullName || 'other user'}`)
            cleanup()
            navigate('/')
        }

        socket.on('call:offer', handleOffer)
        socket.on('call:answer', handleAnswer)
        socket.on('call:ice-candidate', handleIceCandidate)
        socket.on('call:ended', handleCallEnded)   // ✅ 'call:ended' not 'call:end'

        return () => {
            socket.off('call:offer', handleOffer)
            socket.off('call:answer', handleAnswer)
            socket.off('call:ice-candidate', handleIceCandidate)
            socket.off('call:ended', handleCallEnded)
        }
    }, [socket, isCallerRole])

    // ─── Controls ─────────────────────────────────────────────────────────────
    const toggleMute = () => {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0]
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled
            setIsMuted(prev => !prev)
        }
    }

    const toggleVideo = () => {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0]
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled
            setIsVideoOff(prev => !prev)
        }
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
    return (
        <div className='w-full h-screen bg-gray-950 relative overflow-hidden'>

            {/* Remote Video — full screen background */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className='w-full h-full object-cover'
            />

            {/* Placeholder when remote video hasn't arrived yet */}
            {callStatus !== 'Connected' && (
                <div className='absolute inset-0 flex flex-col items-center justify-center bg-gray-950'>
                    <div className='w-24 h-24 rounded-full bg-gray-700 overflow-hidden mb-4'>
                        {remoteUser?.profilePic
                            ? <img src={remoteUser.profilePic} className='w-full h-full object-cover' />
                            : <div className='w-full h-full bg-gray-600 flex items-center justify-center text-white text-3xl font-bold'>
                                {remoteUser?.fullName?.[0] || '?'}
                              </div>
                        }
                    </div>
                    <h2 className='text-white text-2xl font-semibold mb-2'>
                        {remoteUser?.fullName || 'Unknown'}
                    </h2>
                    <p className='text-gray-400 text-sm animate-pulse'>{callStatus}</p>
                </div>
            )}

            {/* Call Status Badge (when connected) */}
            {callStatus === 'Connected' && (
                <div className='absolute top-5 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm text-white text-xs px-4 py-1.5 rounded-full'>
                    {remoteUser?.fullName || 'Unknown'}
                </div>
            )}

            {/* Local Video — picture-in-picture */}
            <div className='absolute bottom-28 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-gray-800'>
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted   // always mute local to prevent echo
                    className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                />
                {isVideoOff && (
                    <div className='w-full h-full flex items-center justify-center text-white text-xs'>
                        Camera Off
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <div className='absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-5'>

                {/* Mute Toggle */}
                <button
                    onClick={toggleMute}
                    className={`p-4 rounded-full transition-all hover:scale-110 shadow-lg
                        ${isMuted ? 'bg-gray-600 text-gray-300' : 'bg-white/20 backdrop-blur-sm text-white'}`}
                >
                    {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                {/* End Call */}
                <button
                    onClick={handleEndCall}
                    className='bg-red-500 p-5 rounded-full hover:scale-110 hover:bg-red-600 transition-all shadow-xl text-white'
                >
                    <PhoneOff size={26} />
                </button>

                {/* Video Toggle */}
                <button
                    onClick={toggleVideo}
                    className={`p-4 rounded-full transition-all hover:scale-110 shadow-lg
                        ${isVideoOff ? 'bg-gray-600 text-gray-300' : 'bg-white/20 backdrop-blur-sm text-white'}`}
                >
                    {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                </button>
            </div>

        </div>
    )
}

export default VideoCall