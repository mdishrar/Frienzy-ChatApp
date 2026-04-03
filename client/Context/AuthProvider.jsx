import React, { useEffect, useState} from 'react'
import AuthContext from './AuthContext'
import {toast} from "react-hot-toast"
import axios from "axios"
import {io} from "socket.io-client"

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;

export const AuthProvider = ({children}) => {
    const [onlineUsers,setonlineUsers] = useState([]);
    const [authUser,setAuthUser] = useState(null);
    const [token,setToken]= useState(localStorage.getItem("token"))
    const [socket,setSocket] = useState(null)

    const checkAuth = async () =>{
        try{
            const {data} = await axios.get('/api/auth/check');
            if(data.success){
                setAuthUser(data.user)
                connectSocket(data.user)
            }

        }catch(error){
            toast.error(error.message)
        }
    }

    
    const login = async (state,credentials) =>{
        try{
            const {data} = await axios.post(`/api/auth/${state}`,credentials);
            
            if(data.success){
                console.log(data);
                setAuthUser(data.userData);
                connectSocket(data.userData);
                axios.defaults.headers.common["token"] = data.token;
                setToken(data.token)
                localStorage.setItem("token",data.token)
                toast.success(data.message)
            }else{
                toast.error(data.message)
            }
        }catch(error){
            toast.error(error.message)
            console.log(error)
        }
    }

    const logout = () =>{
        localStorage.removeItem('token');
        setToken("");
        setAuthUser(null);
        setonlineUsers([]);
        axios.defaults.headers.common['token'] = null;
        toast.success('Logged out successfully')
        socket.disconnect();
    }

    const updateProfile = async (body) =>{
        try{
            const {data} = await axios.put('/api/auth/update-profile',body)
            if(data.success){
                setAuthUser(data.user);
                toast.success('profile updated successfully')
            }
        }catch(error){
            toast.error(error.message)
            console.log(error)
        }
    }

    const connectSocket = async (userData) =>{
        if(!userData || socket?.connected) return;

        const newSocket = io(backendUrl,{
            query : {
                userId : userData._id,
            }
        });
        newSocket.connect();
        setSocket(newSocket);
        newSocket.on('getOnlineUsers',(userIds)=>{
            setonlineUsers(userIds);
        })
    }

    useEffect(()=>{
        if(token){
            axios.defaults.headers.common['token'] = token;
            checkAuth();
        }
    },[])
    
    const value = {
        onlineUsers,
        authUser,
        socket,
        axios,
        logout,
        checkAuth,
        login,
        updateProfile,
    }
  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  )
}

