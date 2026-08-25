import React, { useContext, useState } from 'react';
import assets from '../assets/assets';
import ChatContext from '../../Context/ChatContext';
import { useNavigate } from 'react-router-dom';

const AddingUserInGroup = () => {
  const {GroupChat} = useContext(ChatContext);
  const [email, setEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [mailList, setMailList] = useState([]);
  const [adminList, setAdminList] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result); 
    };
    reader.readAsDataURL(file);
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = email.trim();
    if (!value || !emailRegex.test(value)) return;

    if (mailList.includes(value)) {
      setEmail("");
      return;
    }

    setMailList((prev) => [...prev, value]);
    setEmail("");
  };

  const handleAdminKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = adminEmail.trim();
    if (!value || !emailRegex.test(value)) return;

    if (adminList.includes(value)) {
      setAdminEmail("");
      return;
    }

    setAdminList((prev) => [...prev, value]);
    setAdminEmail("");
  };

  const removeEmail = (emailToRemove) => {
    setMailList((prev) => prev.filter((mail) => mail !== emailToRemove));
  };

  const removeAdminEmail = (emailToRemove) => {
    setAdminList((prev) => prev.filter((mail) => mail !== emailToRemove));
  };

  const handleCreateGroup = async () => {
    if (mailList.length === 0 || adminList.length === 0) return;

    try {
      setLoading(true);
      console.log(imageFile);
      console.log(groupName);
      await GroupChat(mailList,adminList,groupName,imageFile)
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='w-full h-screen sm:px-[15%] sm:py-[5%] flex items-center justify-center'>
      <div className="backdrop-blur-xl border-2 border-gray-400 rounded-2xl overflow-hidden h-full grid-cols-1 relative w-full p-6 sm:p-10 flex flex-col justify-between">
        <div className="text-center pt-2">
          <h2 className="text-2xl font-bold text-white tracking-wide">Add Users to Group</h2>
          <p className="text-xs text-gray-300 mt-1">Upload an icon and add member emails below</p>
        </div>

        <div className='flex flex-col items-center my-auto'>
          <div className="relative group">
            <div className="mt-4 w-20 h-20  rounded-full overflow-hidden border-2 border-gray-300 shadow-2xl bg-black/40 flex items-center justify-center">
              <img src={imagePreview || assets.avatar_icon} className='w-full h-full object-cover' alt='Group Avatar' />
            </div>
            <input onChange={handleImageChange} type='file' id='image' accept='image/*' hidden />
            <label htmlFor='image' className='absolute bottom-0 right-0 bg-violet-600 hover:bg-violet-500 text-white p-2.5 rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110 active:scale-95 border-2 border-gray-900' title="Upload Image">
              <img src={assets.gallery_icon} className='w-4 h-4 invert' alt='Gallery' />
            </label>
          </div>
          <label htmlFor='image' className='text-gray-300 text-xs mt-3 cursor-pointer hover:text-white font-medium transition-colors'>
            {imagePreview ? "Change Group Icon" : "Upload Group Icon"}
          </label>
        </div>

        <div className='w-full max-w-xl mx-auto space-y-4 pb-2'>
          <div>
            <label className="text-xs font-semibold text-gray-200 uppercase tracking-wider block mb-1.5">
              Group Name
            </label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              type='text'
              className="w-full border border-gray-400/80 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-white text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-200 uppercase tracking-wider block mb-1.5">
              Admin Emails:
            </label>
            <div className="border border-gray-400/80 rounded-xl p-3 min-h-13 flex flex-wrap gap-2 bg-black/40 backdrop-blur-lg focus-within:border-white transition-all shadow-inner">
              {adminList.map((mail) => (
                <div key={mail} className="bg-violet-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-md border border-violet-400/30">
                  <span>{mail}</span>
                  <button onClick={() => removeAdminEmail(mail)} type="button"
                    className="hover:bg-violet-800 rounded-full w-4 h-4 flex items-center justify-center font-bold text-xs transition-colors ml-0.5">
                    ×
                  </button>
                </div>
              ))}
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                onKeyDown={handleAdminKeyDown}
                placeholder={adminList.length === 0 ? "Type admin email & press Enter..." : "Add another..."}
                className="bg-transparent outline-none flex-1 min-w-45 text-white placeholder-gray-400 text-sm py-1 px-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-200 uppercase tracking-wider block mb-1.5">
              Member Emails
            </label>
            <div className="border border-gray-400/80 rounded-xl p-3 min-h-13 flex flex-wrap gap-2 bg-black/40 backdrop-blur-lg focus-within:border-white transition-all shadow-inner">
              {mailList.map((mail) => (
                <div key={mail} className="bg-violet-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-md border border-violet-400/30">
                  <span>{mail}</span>
                  <button onClick={() => removeEmail(mail)} className="hover:bg-violet-800 rounded-full w-4 h-4 flex items-center justify-center font-bold text-xs transition-colors ml-0.5" type="button">
                    ×
                  </button>
                </div>
              ))}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mailList.length === 0 ? "Type email & press Enter..." : "Add another..."}
                className="bg-transparent outline-none flex-1 min-w-45 text-white placeholder-gray-400 text-sm py-1 px-1"
              />
            </div>
            <p className="text-[11px] text-gray-300 mt-1 pl-1">
              Press <kbd className="px-1.5 py-0.5 text-[10px] bg-white/20 rounded border border-white/30 text-white font-mono">Enter</kbd> to confirm email
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateGroup}
            disabled={mailList.length === 0 || adminList.length === 0 || loading}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-600/50 text-white font-semibold text-sm rounded-xl shadow-lg transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating..." : `Create Group ${mailList.length > 0 ? `(${mailList.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddingUserInGroup;