import React, { useEffect, useState, useCallback } from 'react'
import AuthContext from './AuthContext'
import {toast} from "react-hot-toast"
import axios from "axios"
import {io} from "socket.io-client"

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;
axios.defaults.withCredentials = true;

export const AuthProvider = ({children}) => {
    const [onlineUsers,setonlineUsers] = useState([]);
    const [authUser,setAuthUser] = useState(null);
    const [token,setToken]= useState(() => localStorage.getItem("token") || "")
    const [socket,setSocket] = useState(null)
    const [isTokenExpired,setIsTokenExpired] = useState(false); 
    
    
    const setAuthHeaders = useCallback((accessToken) => {
        axios.defaults.headers.common["token"] = accessToken || "";
        axios.defaults.headers.common["Authorization"] = accessToken ? `Bearer ${accessToken}` : "";
    }, []);
    
    const clearAuthState = useCallback(() => {
        localStorage.removeItem("token");
        setToken("");
        setAuthUser(null);
        setonlineUsers([]);
        setAuthHeaders("");
        setIsTokenExpired(true);
    }, [setAuthHeaders]);
    
    const connectSocket = useCallback((userData) => {
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
    }, [socket]);

    const checkAuth = useCallback(async () =>{
        try{
            const {data} = await axios.get('/api/auth/check');
            
            if(data.success){
                setAuthUser(data.user)
                connectSocket(data.user)
            }
            
        }catch(error){
            console.log("checkAuth failed", error);
        }
    }, [connectSocket]);
    
    const refreshAccessToken = useCallback(async () =>{
        try{
            const {data} = await axios.get('/api/auth/refresh');
            if(data.success && data.accessToken){
                setIsTokenExpired(false);
                setToken(data.accessToken);
                localStorage.setItem("token", data.accessToken);
                setAuthHeaders(data.accessToken);
                return data.accessToken;
            }
            throw new Error(data.message || "Unable to refresh token");
        }catch(error){
            console.log("refreshAccessToken failed", error);
            clearAuthState();
            throw error;
        }
    }, [clearAuthState, setAuthHeaders]);
    
    useEffect(() => {
        const requestInterceptor = axios.interceptors.request.use((config) => {
            const activeToken = token || localStorage.getItem("token");
            if (activeToken) {
                config.headers = {
                    ...config.headers,
                    token: activeToken,
                    Authorization: `Bearer ${activeToken}`,
                };
            }
            return config;
        });
        
        const responseInterceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response?.status === 401 && !originalRequest?._retry) {
                    originalRequest._retry = true;
                    try {
                        const newToken = await refreshAccessToken();
                        originalRequest.headers = {
                            ...originalRequest.headers,
                            token: newToken,
                            Authorization: `Bearer ${newToken}`,
                        };
                        return axios(originalRequest);
                    } catch (refreshError) {
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.request.eject(requestInterceptor);
            axios.interceptors.response.eject(responseInterceptor);
        };
    }, [refreshAccessToken, token]);
    
    const login = async (state,credentials) =>{
        try{
            const {data} = await axios.post(`/api/auth/${state}`,credentials);
            if(data.success){
                const accessToken = data.accessToken || data.token;
                setAuthUser(data.userData);
                connectSocket(data.userData);
                setToken(accessToken);
                
                localStorage.setItem("token", accessToken);
                setAuthHeaders(accessToken);
                toast.success(data.message)
            }else{
                toast.error(data.message)
            }
        }catch(error){
            toast.error(error.message)
            console.log(error)
        }
    }
    
    const logout = async () =>{
        try{
            console.log(authUser._id)
            const {data} = await axios.post('/api/auth/logout',{authUserId : authUser})
            if (data.success && socket) {
                socket.disconnect();
                clearAuthState();
            }
            toast.success('Logged out successfully')
        }catch(error){
            toast.error(error.message)
            console.log(error)
        }
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

    useEffect(()=>{
        if(token){
            setAuthHeaders(token);
            checkAuth();
        }
        const payload = (() => {
            try {
                return JSON.parse(atob(token.split('.')[1]));
            } catch {
                return null;
            }
        })();

        if (payload?.exp) {
            const delay = payload.exp * 1000 - Date.now() - 60 * 1000;                
            const timerId = setTimeout(() => {
                refreshAccessToken().catch(() => {});
            }, delay > 0 ? delay : 0);

            return () => clearTimeout(timerId);
        }
    
    },[checkAuth, setAuthHeaders, token,refreshAccessToken]);
    
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

