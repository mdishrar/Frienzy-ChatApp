import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import assets from '../assets/assets'
import { formatMessageTime } from '../lib/utils';
import AuthContext from '../../Context/AuthContext';
import ChatContext from '../../Context/ChatContext';
import { useNavigate } from "react-router-dom"
import toast from 'react-hot-toast';
import {
  Trash2, ArrowLeft, Phone, Video, MoreVertical, Image as ImageIcon,
  Mic, SendHorizontal, X, Check, CheckCheck, UserCircle2, MessageCircle,
  Users, Square
} from 'lucide-react'

const getSenderId = (msg) =>
  typeof msg.senderId === 'object' && msg.senderId !== null ? msg.senderId._id : msg.senderId;

const getSenderName = (msg) =>
  typeof msg.senderId === 'object' && msg.senderId !== null ? msg.senderId.fullName : null;

const getSenderPic = (msg) =>
  typeof msg.senderId === 'object' && msg.senderId !== null ? msg.senderId.profilePic : null;

const isSameDay = (a, b) => {
  const d1 = new Date(a), d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

const formatDateDivider = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

const buildRenderPlan = (messages) => {
  const plan = [];
  let lastDateKey = null;
  let lastSenderId = null;

  messages.forEach((msg, idx) => {
    const dateKey = new Date(msg.createdAt).toDateString();
    if (dateKey !== lastDateKey) {
      plan.push({ type: 'divider', label: formatDateDivider(msg.createdAt), key: `divider-${dateKey}` });
      lastDateKey = dateKey;
      lastSenderId = null;
    }
    const senderId = getSenderId(msg);
    const isFirstInCluster = senderId !== lastSenderId;
    const next = messages[idx + 1];
    const isLastInCluster = !next || getSenderId(next) !== senderId || new Date(next.createdAt).toDateString() !== dateKey;

    plan.push({ type: 'message', msg, isFirstInCluster, isLastInCluster, key: msg._id || `msg-${idx}` });
    lastSenderId = senderId;
  });

  return plan;
};

const MessageBubble = ({
  msg, isOwn, isGroup, isFirstInCluster, isLastInCluster,
  fallbackAvatar, fallbackName, selected, onPressStart, onPressEnd, onClick, seenState
}) => {
  return (
    <div onMouseDown={onPressStart} onMouseUp={onPressEnd} onMouseLeave={onPressEnd} onTouchStart={onPressStart} onTouchEnd={onPressEnd}
      onClick={onClick} className={['group flex items-end gap-2 px-1',isOwn ? 'flex-row-reverse' : 'flex-row',isFirstInCluster ? 'mt-3' : 'mt-0.5',
      'animate-message-in',selected ? 'bg-violet-500/15 rounded-xl' : ''].join(' ')}
    >
      <div className="w-7 shrink-0 self-end">
        {isLastInCluster && (
          isOwn ? (
            fallbackAvatar
              ? <img src={fallbackAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
              : <UserCircle2 className="w-7 h-7 text-gray-500" />
          ) : (
            fallbackAvatar
              ? <img src={fallbackAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
              : <UserCircle2 className="w-7 h-7 text-gray-500" />
          )
        )}
      </div>

      <div className={`flex flex-col max-w-[65%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {isGroup && !isOwn && isFirstInCluster && (
          <span className="text-[11px] text-violet-300 font-medium px-2 mb-0.5">
            {fallbackName || 'Member'}
          </span>
        )}

        {msg.image ? (
          <img
            src={msg.image}
            alt=""
            className="max-w-55 rounded-xl border border-white/10 shadow-md hover:brightness-110 transition-all duration-200 cursor-zoom-in"
          />
        ) : msg.audio ? (
          <div className="bg-[#B200ED]/90 rounded-full px-1 py-1 shadow-md">
            <audio controls src={msg.audio} className="max-w-60 rounded-full" />
          </div>
        ) : msg.callType ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 italic px-3 py-2 bg-white/5 rounded-lg">
            <Phone className="w-3.5 h-3.5" />
            {msg.callDetails?.callStatus || 'Call'}
          </div>
        ) : (
          <p
            className={[
              'px-3 py-2 text-sm font-light leading-snug wrap-break-words text-white shadow-sm',
              isOwn ? 'bg-violet-500/40' : 'bg-white/10',
              'rounded-2xl',
              isOwn
                ? (isLastInCluster ? 'rounded-br-md' : 'rounded-br-2xl')
                : (isLastInCluster ? 'rounded-bl-md' : 'rounded-bl-2xl'),
            ].join(' ')}
          >
            {msg.text}
          </p>
        )}

        <div className={`flex items-center gap-1 mt-1 px-1 transition-opacity duration-150 opacity-0 group-hover:opacity-100 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-gray-500">{formatMessageTime(msg.createdAt)}</span>
          {isOwn && (
            seenState === 'seen'
              ? <CheckCheck className="w-3.5 h-3.5 text-violet-400" />
              : <Check className="w-3.5 h-3.5 text-gray-500" />
          )}
        </div>
      </div>
    </div>
  );
};

const DateDivider = ({ label }) => (
  <div className="flex items-center gap-3 my-4 px-2 select-none">
    <div className="flex-1 h-px bg-white/10" />
    <span className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">{label}</span>
    <div className="flex-1 h-px bg-white/10" />
  </div>
);

const MessageList = ({
  renderPlan, scrollRef, isGroupView, authUser, selectedUser,
  messageList, onPressStart, onPressEnd, onMessageClick, seenStateFor
}) => (
  <div className='flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6'>
    {renderPlan.length === 0 && (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-500 animate-fade-in">
        <MessageCircle className="w-10 h-10 opacity-40" />
        <p className="text-sm">No messages yet — say hello</p>
      </div>
    )}

    {renderPlan.map((item) => {
      if (item.type === 'divider') return <DateDivider key={item.key} label={item.label} />;

      const { msg, isFirstInCluster, isLastInCluster } = item;
      const own = getSenderId(msg) === authUser._id;
      const avatar = own
        ? (authUser?.profilePic || null)
        : isGroupView
          ? (getSenderPic(msg) || null)
          : (selectedUser?.profilePic || null);

      return (
        <MessageBubble key={item.key} msg={msg} isOwn={own} isGroup={isGroupView} isFirstInCluster={isFirstInCluster} isLastInCluster={isLastInCluster}
          fallbackAvatar={avatar} fallbackName={isGroupView ? getSenderName(msg) : null} selected={messageList.includes(msg._id)} onPressStart={() => onPressStart(msg._id)}
          onPressEnd={onPressEnd} onClick={() => onMessageClick(msg._id)} seenState={own ? seenStateFor(msg) : null}
        />
      );
    })}
    <div ref={scrollRef}></div>
  </div>
);

const Composer = ({
  isListening, canvasRef, cancelRecording, input, setInput,
  handleSendMessage, handleSendImage, toggleListening
}) => (
  <div className='absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3'>
    <div className='flex flex-1 items-center bg-gray-100/12 rounded-full transition-all duration-200'>
      {isListening ? (
        <div className='flex items-center gap-3 w-full px-2'>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot shrink-0 ml-2" />
          <canvas ref={canvasRef} width={250} height={60} className="bg-transparent flex-1" />
          <button onClick={cancelRecording} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className='w-5 h-5 text-gray-300' />
          </button>
        </div>
      ) : (
        <>
          <input
            type='text' placeholder='Send the message....' value={input} onKeyDown={(e) => e.key === 'Enter' ? handleSendMessage(e) : null}
            onChange={(e) => setInput(e.target.value)} className='flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400 bg-transparent'
          />
          <input onChange={handleSendImage} type='file' id='image' accept='image/png, image/jpeg, image/svg, image/jpg' hidden />
          <label htmlFor='image' className="p-2 mr-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
            <ImageIcon className='w-5 h-5 text-gray-300' />
          </label>
        </>
      )}
      <button
        onClick={toggleListening}
        className={`p-3 mr-1 rounded-full transition-all duration-200 ${isListening ? 'bg-red-500/20' : 'hover:bg-white/10'}`}
      >
        {isListening ? <Square className="w-5 h-5 text-red-400 fill-red-400" /> : <Mic className='w-5 h-5 text-gray-300' />}
      </button>
    </div>
    <button
      onClick={handleSendMessage}
      className='w-11 h-11 flex items-center justify-center rounded-full bg-violet-500 hover:bg-violet-400 active:scale-95 transition-all duration-150 shadow-lg shadow-violet-500/30'
    >
      <SendHorizontal className='w-5 h-5 text-white' />
    </button>
  </div>
);

const DeleteMenu = ({ messageList, isForEveryOne, setIsForEveryOne, handleDeleteSelected, cancelSelection }) => (
  <div className="relative py-2 group animate-fade-in">
    <Trash2 color="white" size={20} className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity" />
    <div className="absolute right-0 top-9 flex flex-col p-2 z-50 min-w-40 rounded-xl bg-[#282142] border border-white/10 shadow-xl text-gray-100 group-hover:block animate-scale-in">
      <button className="text-white text-sm text-left rounded-lg hover:bg-white/10 px-3 py-2 transition-colors" onClick={handleDeleteSelected}>
        Delete {messageList.length > 1 ? `(${messageList.length})` : ''}
      </button>
      <label className="text-sm text-gray-300 flex items-center gap-2 px-3 py-2 cursor-pointer">
        <input type="checkbox" checked={isForEveryOne} onChange={(e) => setIsForEveryOne(e.target.checked)} className="accent-violet-500" />
        For everyone
      </label>
      <button className="text-gray-400 text-sm text-left rounded-lg hover:bg-white/10 px-3 py-2 transition-colors" onClick={cancelSelection}>
        Cancel
      </button>
    </div>
  </div>
);

const ChatArea = ({ setOngoingcallType, setIsAnyOutgoingCall }) => {

  const { authUser, onlineUsers } = useContext(AuthContext);
  const {
    messages, selectedUser, setSelectedUser, getMessages, sendMessage,
    deleteMessageList, selectedGroup, setSelectedGroup
  } = useContext(ChatContext);

  const [isListening, setIsListening] = useState(false);
  const ScrollEnd = useRef();
  const [input, setInput] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();
  const [isDeleteMessage, setIsDeleteMessage] = useState(false);
  const [isForEveryOne, setIsForEveryOne] = useState(false);
  const [messageList, setMessageList] = useState([]);
  const longPressTimer = useRef(null);
  const isLongPressRef = useRef(false);

  const isGroupView = !!selectedGroup;
  const activeGroupId = selectedGroup?._id ?? null;

  function drawWaveform() {
    if (!analyserRef.current || !canvasRef.current) {
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

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
    mediaRecorderRef.current.stop();
    cancelAnimationFrame(animationRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    streamRef.current = null;
    setIsListening(false);
  }

  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true }
      });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current.ondataavailable = (e) => { audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        const formData = new FormData();
        formData.append("audio", audioBlob, "voice-message.webm");
        await sendMessage(formData, activeGroupId);
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
      toast.error('Could not access microphone. Please check permissions.');
    }
  }

  const cancelRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.onstop = () => { audioChunksRef.current = []; };
    if (mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
    cancelAnimationFrame(animationRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setIsListening(false);
  }

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (input.trim() === "") return;
    await sendMessage({ text: input.trim() }, activeGroupId);
    setInput("");
  }

  const handleSendImage = async (e) => {
    const file = e.target.files[0]
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Select an Image file")
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      await sendMessage({ image: reader.result }, activeGroupId)
      e.target.value = ""
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (selectedUser) getMessages(selectedUser._id, false)
    if (selectedGroup) getMessages(selectedGroup._id, true)
  }, [selectedUser, selectedGroup])

  useEffect(() => {
    if (ScrollEnd.current && messages) {
      ScrollEnd.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (isListening) startRecording();
    else if (mediaRecorderRef.current?.state === 'recording') stopRecording();
  }, [isListening])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      cancelAnimationFrame(animationRef.current);
      audioContextRef.current?.close();
    };
  }, []);


  const handlePressStart = (msgId) => {
    isLongPressRef.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsDeleteMessage(true);
      setMessageList([msgId]);
    }, 300);
  };

  const handlePressEnd = () => clearTimeout(longPressTimer.current);

  const toggleSelect = (msgId) => {
    setMessageList((prev) => {
      const exists = prev.includes(msgId);
      const next = exists ? prev.filter((id) => id !== msgId) : [...prev, msgId];
      if (next.length === 0) setIsDeleteMessage(false);
      return next;
    });
  };

  const handleMessageClick = (msgId) => {
    if (isLongPressRef.current) { isLongPressRef.current = false; return; }
    if (isDeleteMessage) toggleSelect(msgId);
  };

  const cancelSelection = () => {
    setIsDeleteMessage(false);
    setMessageList([]);
    setIsForEveryOne(false);
  };

  const handleDeleteSelected = async () => {
    try {
      await deleteMessageList(messageList, isForEveryOne);
      cancelSelection();
    } catch (err) {
      toast.error("Failed to delete messages");
    }
  };


  const renderPlan = useMemo(() => buildRenderPlan(messages || []), [messages]);

  const seenStateFor = (msg) => {
    if (isGroupView) {
      // "seen" once at least one other member has it in seenBy
      const others = (msg.seenBy || []).filter((id) => id !== authUser._id && id?._id !== authUser._id);
      return others.length > 0 ? 'seen' : 'sent';
    }
    return msg.seen ? 'seen' : 'sent';
  };

  const isActive = selectedUser || selectedGroup;


  if (!isActive) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 h-full text-gray-500 bg-white/10 max-md:hidden animate-fade-in'>
        <div className="p-4 rounded-full bg-violet-500/10">
          <MessageCircle className="w-10 h-10 text-violet-400" />
        </div>
        <p className='text-lg font-medium text-white'>Chat anytime, anywhere</p>
        <p className="text-sm text-gray-500">Select a conversation to get started</p>
      </div>
    );
  }

  return (
    <div className='h-full overflow-scroll relative backdrop-blur-lg'>
      <div className='flex items-center gap-3 py-3 mx-4 border-b border-stone-500'>
        <button onClick={() => selectedUser ? setSelectedUser(null) : setSelectedGroup(null)} className='md:hidden p-1 -ml-1 rounded-full hover:bg-white/10 transition-colors'>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="relative">
          <img
            src={(selectedUser ? selectedUser.profilePic : selectedGroup.avatar) || assets.avatar_icon}
            alt=''
            className='w-9 h-9 rounded-full object-cover'
          />
          {selectedUser && onlineUsers.includes(selectedUser._id) && (
            <span className='absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#1a1330] animate-pulse-dot' />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className='text-base text-white font-medium truncate'>
            {selectedUser ? selectedUser.fullName : selectedGroup.name}
          </p>
          {selectedGroup && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Users className="w-3 h-3" /> {selectedGroup.members?.length ?? ''} members
            </p>
          )}
        </div>

        {isDeleteMessage && (
          <DeleteMenu messageList={messageList} isForEveryOne={isForEveryOne} cancelSelection={cancelSelection}
            setIsForEveryOne={setIsForEveryOne} handleDeleteSelected={handleDeleteSelected} 
          />
        )}

        {selectedUser && !isDeleteMessage && (
          <div className='flex items-center gap-1'>
            <button
              onClick={() => { setOngoingcallType('VideoCall'); setIsAnyOutgoingCall(true) }}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <Video className="w-5 h-5 text-gray-200" />
            </button>
            <button
              onClick={() => { setOngoingcallType('AudioCall'); setIsAnyOutgoingCall(true) }}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <Phone className="w-5 h-5 text-gray-200" />
            </button>
          </div>
        )}

        <button className="max-md:hidden p-2 rounded-full hover:bg-white/10 transition-colors">
          <MoreVertical className="w-4.5 h-4.5 text-gray-400" />
        </button>
      </div>

      <MessageList
        renderPlan={renderPlan} scrollRef={ScrollEnd} isGroupView={isGroupView} authUser={authUser}
        selectedUser={selectedUser} messageList={messageList} onPressStart={handlePressStart}
        onPressEnd={handlePressEnd} onMessageClick={handleMessageClick} seenStateFor={seenStateFor}
      />
      <Composer
        isListening={isListening} canvasRef={canvasRef} cancelRecording={cancelRecording} input={input} setInput={setInput}
        handleSendMessage={handleSendMessage} handleSendImage={handleSendImage} toggleListening={() => setIsListening(prev => !prev)}
      />
    </div>
  )
}

export default ChatArea