import React, { useContext, useEffect, useState, useMemo } from 'react'
import assets from '../assets/assets'
import AuthContext from '../../Context/AuthContext'
import { imagesDummyData } from '../assets/assets'
import ChatContext from '../../Context/ChatContext'

const RightSidebar = () => {
  const { logout, onlineUsers } = useContext(AuthContext);
  const { selectedUser, users, setSelectedUser, messages, selectedGroup, setSelectedGroup, groups, groupsMemberList } = useContext(ChatContext);
  const [msgImages, setMsgImages] = useState([])

  useEffect(() => {
    setMsgImages(messages.filter(msg => msg.image).map(msg => msg.image))
  }, [messages])

  const groupMembersDetails = useMemo(() => {
    if (!selectedGroup?.members || !groupsMemberList) return [];

    return selectedGroup.members
      .map((id) => {
        const info = groupsMemberList[id];
        if (!info) return null;
        return { id, ...info };
      })
      .filter(Boolean);
  }, [selectedGroup, groupsMemberList]);

  const groupAdminDetails = useMemo(() => {
    if (!selectedGroup?.admin) return [];

    return groupMembersDetails.filter(member =>
      selectedGroup.admin.includes(member.id)
    );
  }, [selectedGroup, groupMembersDetails]);

  if (!selectedUser && !selectedGroup) return null;

  const isGroup = !selectedUser;
  const onlineCount = isGroup ? groupMembersDetails.filter((m) => onlineUsers.includes(m.id)).length : 0;

  return (
    <div className={`bg-[#8185B2]/10 text-white w-full h-full flex flex-col justify-between overflow-y-auto scrollbar-thin ${selectedUser ? 'max-md:hidden' : ''}`}>
      <div className="pb-24">
        <div className='pt-16 pb-6 flex flex-col items-center gap-3 text-xs font-light mx-auto'>
          <div className='relative'>
            <img
              src={isGroup ? (selectedGroup?.avatar || assets.avatar_icon) : (selectedUser?.profilePic || assets.avatar_icon)}
              className='w-20 h-20 object-cover rounded-full ring-4 ring-white/10 shadow-lg shadow-black/20'
              alt=''
            />
            {!isGroup && onlineUsers.includes(selectedUser._id) && (
              <span className='absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-green-500 ring-2 ring-[#1a1a2e]' />
            )}
          </div>

          <h1 className='px-10 text-base font-semibold mx-auto flex items-center gap-2 text-center leading-tight'>
            {isGroup ? (selectedGroup?.name || 'Group') : selectedUser.fullName}
          </h1>

          {isGroup ? (
            <p className='text-[11px] uppercase tracking-wider text-white/50 font-medium'>
              {groupMembersDetails.length} member{groupMembersDetails.length !== 1 ? 's' : ''}
              {onlineCount > 0 && (
                <span className='text-green-400'> · {onlineCount} online</span>
              )}
            </p>
          ) : (
            selectedUser.bio && (
              <p className='px-10 mx-auto text-center text-white/60 leading-relaxed'>{selectedUser.bio}</p>
            )
          )}
        </div>

        <div className='px-5 text-xs'>
          <hr className='border-[#ffffff15] mb-4' />

          {isGroup ? (
            <>
              <div className='mb-4'>
                <p className='text-[11px] uppercase tracking-wider text-white/50 font-medium mb-3'>Admins</p>
                {groupAdminDetails.map((admin) => {
                  const isOnline = onlineUsers.includes(admin.id);
                  return (
                    <div key={admin.id} onClick={()=>{setSelectedUser(admin);setSelectedGroup(null)}} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
                      <div className="relative shrink-0">
                        <img src={admin.profilePic || assets.avatar_icon} className="w-9 h-9 rounded-full object-cover" alt=""/>
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium text-white/90">{admin.fullName}</span>
                        <span className={`text-[10px] ${isOnline ? 'text-green-400' : 'text-white/35'}`}>
                          {isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <p className='text-[11px] uppercase tracking-wider text-white/50 font-medium mb-3'>Members</p>
              {groupMembersDetails.length === 0 ? (
                <p className='text-white/40 italic py-6 text-center'>No members yet</p>
              ) : (
                <div className='flex flex-col gap-1 pr-1'>
                  {groupMembersDetails.map((member) => {
                    const isOnline = onlineUsers.includes(member.id);
                    return (
                      <div
                        onClick={()=>{setSelectedUser(member);setSelectedGroup(null)}}
                        key={member.id}
                        className='flex items-center gap-3 px-2 py-2 rounded-lg transition-colors hover:bg-white/5'
                      >
                        <div className='relative shrink-0'>
                          <img
                            src={member.profilePic || assets.avatar_icon}
                            className='w-9 h-9 rounded-full object-cover ring-1 ring-white/10'
                            alt=''
                          />
                          {isOnline && (
                            <span className='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-[#1a1a2e]' />
                          )}
                        </div>
                        <div className='flex flex-col min-w-0'>
                          <span className='truncate font-medium text-white/90'>{member.fullName}</span>
                          <span className={`text-[10px] ${isOnline ? 'text-green-400' : 'text-white/35'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <p className='text-[11px] uppercase tracking-wider text-white/50 font-medium mb-3'>
                Shared media
                {msgImages.length > 0 && <span className='text-white/30 normal-case tracking-normal'> · {msgImages.length}</span>}
              </p>
              {msgImages.length === 0 ? (
                <p className='text-white/40 italic py-6 text-center'>No media shared yet</p>
              ) : (
                <div className='grid grid-cols-2 gap-3 pr-1'>
                  {msgImages.map((url, index) => (
                    <div key={index} onClick={() => window.open(url)} className='group cursor-pointer rounded-lg overflow-hidden ring-1 ring-white/10 aspect-square'>
                      <img src={url} className='w-full h-full object-cover transition-transform duration-200 group-hover:scale-110' alt=''/>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className='p-4 bg-linear-to-t from-[#1a1a2e]/60 to-transparent sticky bottom-0 w-full flex justify-center'>
        <button
          className='w-full max-w-xs bg-linear-to-r from-purple-400 to-violet-600 text-white border-none text-sm font-light py-2.5 px-6 rounded-full cursor-pointer shadow-lg shadow-violet-900/30 transition-transform hover:scale-[1.03] active:scale-[0.98]'
          onClick={logout}
        >
          Logout
        </button>
      </div>
    </div>
  )
}

export default RightSidebar