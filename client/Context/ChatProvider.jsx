import { useContext, useEffect, useState } from "react";
import  ChatContext  from "./ChatContext";
import  AuthContext  from "./AuthContext";
import toast from "react-hot-toast";

export const ChatProvider = ({children})=>{
    const {socket,axios} = useContext(AuthContext);
    const [messages,setMessages] = useState([]);
    const [users,setUsers]= useState([]);
    const [selectedUser,setSelectedUser] = useState(null);
    const [unseenMessages,setUnseenMessages] = useState({});
    const [unseenGroupMessages,setUnseenGroupMessages] = useState({});
    const [groups,setGroups] = useState([])
    const [selectedGroup,setSelectedGroup] = useState(null);
    const [groupsMemberList,setGroupMemberList] = useState([]);
    
    const getUsers = async ()=>{
        try{
            const {data} = await axios.get('/api/messages/users');
            if(data.success){
                setUsers(data.users);
                setGroups(data.groups);
                setGroupMemberList(data.informAboutGroup)
                setUnseenMessages(data.unseenMessages)
            }
        }catch(error){
            toast.error(error.message);
        }
    }

    const getMessages = async (Id,isgroupMessage)=>{
        try{
            if(isgroupMessage){
                const {data} = await axios.get(`/api/messages/group/${Id}`)
                if(data.success){
                    setMessages(data.messages)
                }
            }
            else{
                const {data} = await axios.get(`/api/messages/${Id}`)
                if(data.success){
                    setMessages(data.messages)
                }
            }
        }catch(error){
            toast.error(error.message)
        }
    }

    const getMessagesFromGroup = async (groupId) =>{
        try{
            const {data} = await axios.get(`/api/messages/${groupId}`)
            if(data.success){
                setMessages(data.messages)
            }
        }catch(error){

        }
    }

    const deleteMessageList = async (messageList,forEveryOne=isForEveryOne) =>{
        try{
            
            const {data} = await axios.post('api/messages/ondelete',{messageList:messageList,selectedUserId:selectedUser._id,forEveryOne:forEveryOne})
            if(data.success){
                toast.success("Messages is Deleted");
                setMessages(data.updatedMessageList);
            }
        }catch(error){
            console.log(error);
            toast.error("Message is not Deleted");
        }
    }

    const sendMessage = async (messageData,groupId)=>{
        try{
            const isFormData = messageData instanceof FormData;
            if(groupId && selectedGroup){
                const {data} = await axios.post(`/api/messages/group/send/${groupId}`,messageData,
                    isFormData ? {headers : {"Content-Type" : "multipart/form-data"}} :{}
                )
                if(data.success){
                    setMessages((prevMessages)=>[...prevMessages,data.newMessage])
                }else{
                    toast.error(data.message)
                }

            }else{
                const {data} = await axios.post(`/api/messages/send/${selectedUser._id}`,
                    messageData,
                    isFormData
                    ? { headers: { "Content-Type": "multipart/form-data" } }
                    : {}
                );
                if(data.success){
                    setMessages((prevMessages)=>[...prevMessages,data.newMessage])
                }else{
                    toast.error(data.message)
                }
            }
        }catch(error){
            toast.error(error.message)
        }
    }

    const subscribeToMessages = async () =>{
        if(!socket){
            return;
        }
        socket.on('newMessage',(newMessage)=>{
            if((selectedUser && newMessage.senderId === selectedUser._id)){
                newMessage.seen = true;
                setMessages((prevMessages)=>[...prevMessages,newMessage]);
                axios.put(`/api/messages/mark/${newMessage._id}`);
            }else{
                setUnseenMessages((prevUnseenMessages)=>({
                    ...prevUnseenMessages,[newMessage.senderId]:
                    prevUnseenMessages[newMessage.senderId] ? prevUnseenMessages
                    [newMessage.senderId] +1:1
                }))
            }
        });
        socket.on("newGroupMessage", async (newMessage) => {
            if (selectedGroup && newMessage.groupId === selectedGroup._id) {
                newMessage.seenBy = true;
                setMessages(prev => [...prev, newMessage]);
                await axios.put(`/api/messages/group/mark/${newMessage._id}`);
            } else {
                setUnseenGroupMessages(prev => ({
                    ...prev,[newMessage.groupId]:
                    prev[newMessage.groupId] ? prev[newMessage.groupId] + 1: 1
                }));
            }
        });
    }

    const GroupChat = async (mailList,adminEmail,groupName,imageFile) =>{
        try{
            console.log(mailList);
            const {data} = await axios.post('/api/messages/ongrouping',{mailList,adminEmail,groupName,imageFile})
            if(data.success){
                toast.success(data.message);
            }
        }catch(error){
            console.log(error);
            console.log("something went wrong");
        }
    }

    const unsubscribeFromMessages = () =>{
        if(socket){ 
            socket.off('newMessage');
            socket.off('newGroupMessage');
        }
    }

    useEffect(()=>{
        subscribeToMessages();
        return ()=>unsubscribeFromMessages();
    },[socket,selectedUser])

    const value = {
        messages,users,selectedUser,getUsers,setMessages,sendMessage,GroupChat,selectedGroup,setSelectedGroup,setUnseenGroupMessages,unseenGroupMessages,
        groupsMemberList,setGroupMemberList,setSelectedUser,unseenMessages,setUnseenMessages,getMessages,deleteMessageList,groups,setGroups
    }
    return (
        <ChatContext.Provider value={value}> 
            {children}
        </ChatContext.Provider>
    )
}