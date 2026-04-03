import React,{useContext, useEffect,useRef, useState} from 'react'
import assets from '../assets/assets'
import { formatMessageTime } from '../lib/utils';
import AuthContext from '../../Context/AuthContext';
import ChatContext from '../../Context/ChatContext';
import {useNavigate} from "react-router-dom"
import toast from 'react-hot-toast';


const ChatArea = ({setOngoingcallType,setIsAnyOutgoingCall}) => {

  const {authUser,onlineUsers} = useContext(AuthContext);
  const {messages,selectedUser,setSelectedUser,getMessages,sendMessage} = useContext(ChatContext);
  const [isListening,setIsListening] = useState(false);
  const ScrollEnd =  useRef();
  const [input,setInput] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  

   function drawWaveform() {
    if (!analyserRef.current || !canvasRef.current){
      animationRef.current = requestAnimationFrame(drawWaveform);
      return;
    } 
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#d67bfa";
    const sliceWidth = canvas.width / dataArrayRef.current.length;
    let x = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
    const v = dataArrayRef.current[i] / 128.0;
    const y = canvas.height / 2 + (v - 1) * 12;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
        }
    ctx.stroke();
    animationRef.current = requestAnimationFrame(drawWaveform);
  }

  const stopRecording =  () =>{
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
    mediaRecorderRef.current.stop();
    cancelAnimationFrame(animationRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    streamRef.current = null;
    setIsListening(false);
  }


  const startRecording =  async () =>{
    audioChunksRef.current = []; 
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true
        }
      });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      mediaRecorderRef.current = new MediaRecorder(stream, {mimeType});
      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
        type: mimeType,
        });
        audioChunksRef.current = [];
        const formData = new FormData();
        formData.append("audio", audioBlob, "voice-message.webm");
        await sendMessage(formData);
      };
      mediaRecorderRef.current.start();
      audioContextRef.current = new AudioContext();
      await audioContextRef.current.resume();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024;
      dataArrayRef.current = new Uint8Array(analyserRef.current.fftSize);
      source.connect(analyserRef.current);
      drawWaveform();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsListening(false);
      alert('Could not access microphone. Please check permissions.');
    }        
  }

  const cancelRecording = () =>{
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.onstop = () => {
      audioChunksRef.current = [];
    };
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cancelAnimationFrame(animationRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    audioContextRef.current.close();
    audioContextRef.current = null;
    setIsListening(false);
  }


  const handleSendMessage = async (e) =>{
    e.preventDefault();
    if(input.trim() === "") return null;
    await sendMessage({text:input.trim()})
    setInput("")
  } 

  const handleSendImage = async (e) =>{
    const file = e.target.files[0]
    if(!file || !file.type.startsWith("image/")){
      toast.error("Select an Image file")
    }

    const reader = new FileReader();
    reader.onloadend = async () =>{
      await sendMessage({image : reader.result})
      e.target.value = ""
    }
    reader.readAsDataURL(file)
  }

  useEffect(()=>{
    if(selectedUser){
      getMessages(selectedUser._id)
    }
  },[selectedUser])

  useEffect(()=>{
    if(ScrollEnd.current && messages){
      ScrollEnd.current.scrollIntoView({behavior : 'smooth'})
    }
  },[messages])

    useEffect(()=>{
    if(isListening){
      startRecording();
    }else{
      if (mediaRecorderRef.current?.state === 'recording') {
        stopRecording();
      }
    }
  },[isListening])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationRef.current);
        audioContextRef.current?.close();
      };
  }, []);



  return selectedUser ?  (
    <div className='h-full overflow-scroll relative backdrop-blur-lg'>
      <div className='flex items-center gap-3 py-3 mx-4 border-b border-stone-500'>
        <img src={selectedUser.profilePic || assets.avatar_icon} alt='' className='w-8 rounded-full' />
        <p className='flex-1 text-lg text-lg text-white flex items-center gap-2'>
          {selectedUser.fullName}
          {onlineUsers.includes(selectedUser._id) &&<span className='w-2 h-2 rounded-full bg-green-500'></span>}
        </p>
        <div className='flex'>
          <img src={assets.videoCall} alt='videoCall' className='w-10 h-10' onClick={()=>{setOngoingcallType('VideoCall');setIsAnyOutgoingCall(true)}} />
          <img src={assets.audioCall} alt='audioCall' className='w-10 h-10' onClick={()=>{setOngoingcallType('AudioCall');setIsAnyOutgoingCall(true)}} />
        </div>
        <img src={assets.arrow_icon} alt='' onClick={()=>setSelectedUser(null)} className='md:hidden max-w-7' />
        <img src={assets.help_icon} alt='help' className='max-md:hidden max-w-5' />
      </div>
      <div className='flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6'>
        {messages.map((msg,index)=>(
          <div key={index} className={`flex items-end gap-2 justify-end ${msg.senderId !==  authUser._id && 'flex-row-reverse'}`}>
            {msg.image ? (
              <img src={msg.image} className='max-w-[200px] border border-gray-700 rounded-lg overflow-hidden mb-8' />
            ): msg.audio ? (
              <div className='rounded-full'>
                <audio controls src={msg.audio}  className="mb-8 max-w-[250px] bg-[#B200ED] display-block rounded-full hover:color-red-500" />
              </div>
            ): msg.callType ? (
                <>
                </>
            ):(
              <>
                <p className={`p-2 max-w-[200px] md:text-sm font-light rounded-lg mb-8 break-all bg-violet-500/30 text-white 
                ${msg.senderId === authUser._id ? 'rounded-br-none' : 'rounded-bl-none'}`}>{msg.text}</p>
              </>
            )}
            <div className='text-center text-xs'>
              <img src={msg.senderId === authUser._id ? authUser?.profilePic || assets.avatar_icon : selectedUser?.profilePic || assets.avatar_icon } alt='' className='w-7 rounded-full' />
              <p className='text-gray-500'>{formatMessageTime(msg.createdAt)}</p>
            </div>
          </div>
        ))}
        <div className='text-gray-500' ref={ScrollEnd}></div>
      </div>
      <div className='absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3'>
        <div className='flex flex-1 items-center bg-gray-100/12 rounded-full'>
          {isListening ? (
            <div className='flex items-center gap-3 w-full'>
              <canvas ref={canvasRef} width={250} height={60} className="bg-transparent mx-7"  />
              <img src={assets.dustbin} className='w-10 h-10 cursor-pointer' onClick={cancelRecording} alt='dustbin' />
            </div>
          ):(
            <>
              <input type='text' placeholder='Send the Message....'value={input} onKeyDown={(e)=>e.key === 'Enter' ?
              handleSendMessage(e) : null} onChange={(e)=>setInput(e.target.value)} className='flex-1 text-sm p-3 
              border-none rounded-lg outline-none text-white placeholder-gray-400' />
              <input onChange={handleSendImage} type='file' id='image' accept='image/png, image/jpeg, image/svg, image/jpg' hidden />
              <label htmlFor='image'>
                <img src={assets.gallery_icon} className='w-5 mr-2 cursor-pointer' />
              </label>
            </>
          )}
          <img src={assets.microphone} onClick={()=>setIsListening(prev =>!prev)} className='w-12 h-12 cursor-pointer' />
        </div>
        <img onClick={handleSendMessage} src={assets.send_button} alt='send' className='w-8 h-8 cursor-pointer'  />
      </div>
        
    </div>
  ):(
    <div className='flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden'>
      <img src={assets.logo_icon} className='max-w-16' alt='' />
      <p className='text-lg font-medium text-white'>Chat anytime,anywhere</p>
    </div>
  )
}

export default ChatArea