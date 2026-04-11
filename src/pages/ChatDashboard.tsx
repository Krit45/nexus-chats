import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  serverTimestamp, 
  getDocs, 
  doc, 
  updateDoc,
  limit,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Search, 
  MessageSquare, 
  Users, 
  Settings, 
  LogOut, 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical,
  Moon,
  Sun,
  Image as ImageIcon,
  Check,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ChatDashboard({ darkMode, setDarkMode }: any) {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedUsersForGroup, setSelectedUsersForGroup] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle responsive layout
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch all users and track online status
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData.filter(u => u.id !== user.id));
      
      const online = new Set<string>();
      usersData.forEach((u: any) => {
        if (u.online) online.add(u.id);
      });
      setOnlineUsers(online);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.id),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConversations(convs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch messages for active conversation
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'conversations', activeConversation.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(scrollToBottom, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `conversations/${activeConversation.id}/messages`);
    });

    return () => unsubscribe();
  }, [activeConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startConversation = async (otherUser: any) => {
    if (isMobile) setSidebarOpen(false);
    // Check if conversation already exists
    const q = query(
      collection(db, 'conversations'),
      where('isGroup', '==', false),
      where('participants', 'array-contains', user.id)
    );
    
    const snapshot = await getDocs(q);
    const existing = snapshot.docs.find(doc => doc.data().participants.includes(otherUser.id));
    
    if (existing) {
      setActiveConversation({ id: existing.id, ...existing.data() });
      setSearch('');
      return;
    }

    // Create new conversation
    const newConv = {
      participants: [user.id, otherUser.id],
      isGroup: false,
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'conversations'), newConv);
    setActiveConversation({ id: docRef.id, ...newConv });
    setSearch('');
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedUsersForGroup.length < 2) return;

    const newGroup = {
      participants: [user.id, ...selectedUsersForGroup],
      isGroup: true,
      name: groupName.trim(),
      updatedAt: serverTimestamp(),
      lastMessage: {
        content: 'Group created',
        senderId: user.id,
        createdAt: serverTimestamp()
      }
    };

    try {
      const docRef = await addDoc(collection(db, 'conversations'), newGroup);
      setActiveConversation({ id: docRef.id, ...newGroup });
      setIsCreatingGroup(false);
      setGroupName('');
      setSelectedUsersForGroup([]);
      if (isMobile) setSidebarOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'conversations');
    }
  };

  const handleRenameGroup = async () => {
    if (!newGroupName.trim() || !activeConversation?.isGroup) return;

    try {
      await updateDoc(doc(db, 'conversations', activeConversation.id), {
        name: newGroupName.trim(),
        updatedAt: serverTimestamp()
      });
      setActiveConversation({ ...activeConversation, name: newGroupName.trim() });
      setIsEditingGroupName(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `conversations/${activeConversation.id}`);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    const content = newMessage;
    setNewMessage('');
    setShowEmojiPicker(false);

    try {
      const msgData = {
        senderId: user.id,
        content,
        type: 'text',
        createdAt: serverTimestamp(),
        seen: false
      };

      await addDoc(collection(db, 'conversations', activeConversation.id, 'messages'), msgData);
      
      await updateDoc(doc(db, 'conversations', activeConversation.id), {
        lastMessage: {
          content,
          senderId: user.id,
          createdAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `conversations/${activeConversation.id}/messages`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      
      try {
        const msgData = {
          senderId: user.id,
          content: base64,
          type,
          createdAt: serverTimestamp(),
          seen: false
        };

        await addDoc(collection(db, 'conversations', activeConversation.id, 'messages'), msgData);
        
        await updateDoc(doc(db, 'conversations', activeConversation.id), {
          lastMessage: {
            content: type === 'image' ? 'Sent an image' : 'Sent a file',
            senderId: user.id,
            createdAt: serverTimestamp()
          },
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `conversations/${activeConversation.id}/messages`);
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const getOtherParticipant = (conv: any) => {
    const otherId = conv.participants.find((id: string) => id !== user.id);
    return users.find(u => u.id === otherId) || { username: 'User', id: otherId };
  };

  return (
    <div className="flex h-screen overflow-hidden relative bg-slate-50 dark:bg-slate-950">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div 
        initial={false}
        animate={{ 
          x: sidebarOpen ? 0 : -320,
          width: isMobile ? 320 : (sidebarOpen ? 320 : 0)
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 lg:relative lg:translate-x-0",
          !sidebarOpen && !isMobile && "border-none"
        )}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between h-16 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Nexus</h1>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button 
              onClick={logout}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {search ? (
            <div className="px-2 space-y-1">
              <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Users</p>
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startConversation(u)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors group"
                >
                  <div className="relative">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-sm">
                      {u.username[0].toUpperCase()}
                    </div>
                    {onlineUsers.has(u.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-sm truncate">{u.username}</p>
                    <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-2 space-y-1">
              <div className="flex items-center justify-between px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Chats</p>
                <button 
                  onClick={() => setIsCreatingGroup(true)}
                  className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
                  title="New Group"
                >
                  <Users className="w-4 h-4" />
                </button>
              </div>
              {conversations.map((conv) => {
                const other = getOtherParticipant(conv);
                const isActive = activeConversation?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveConversation(conv);
                      if (isMobile) setSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all group",
                      isActive ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className="relative">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                        isActive ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      )}>
                        {conv.isGroup ? <Users className="w-5 h-5" /> : other?.username[0].toUpperCase()}
                      </div>
                      {!conv.isGroup && other && onlineUsers.has(other.id) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <p className="font-semibold text-sm truncate">{conv.isGroup ? conv.name : other?.username}</p>
                        <p className="text-[10px] text-slate-400">{conv.lastMessage?.createdAt?.toDate ? format(conv.lastMessage.createdAt.toDate(), 'HH:mm') : ''}</p>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {conv.lastMessage?.content || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
              {user?.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user?.username}</p>
              <p className="text-[10px] text-slate-500">Active Now</p>
            </div>
            <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <Settings className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 lg:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button 
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-5 h-5 text-slate-500" />
                </button>
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                  {activeConversation.isGroup ? <Users className="w-5 h-5" /> : getOtherParticipant(activeConversation)?.username[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  {activeConversation.isGroup ? (
                    isEditingGroupName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameGroup();
                            if (e.key === 'Escape') setIsEditingGroupName(false);
                          }}
                          className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                          autoFocus
                        />
                        <button onClick={handleRenameGroup} className="text-green-500 hover:text-green-600">
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <h2 
                        className="font-bold text-sm lg:text-base truncate cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setNewGroupName(activeConversation.name);
                          setIsEditingGroupName(true);
                        }}
                      >
                        {activeConversation.name}
                        <Settings className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      </h2>
                    )
                  ) : (
                    <h2 className="font-bold text-sm lg:text-base truncate">{getOtherParticipant(activeConversation)?.username}</h2>
                  )}
                  <p className="text-[10px] lg:text-xs text-slate-500 truncate">
                    {activeConversation.isGroup ? `${activeConversation.participants.length} members` : (onlineUsers.has(getOtherParticipant(activeConversation)?.id) ? 'Online' : 'Offline')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <MoreVertical className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => {
                const isMe = msg.senderId === user.id;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id || i}
                    className={cn(
                      "flex flex-col",
                      isMe ? "items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[70%] px-4 py-2 rounded-2xl shadow-sm",
                      isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white dark:bg-slate-900 rounded-tl-none"
                    )}>
                      {msg.type === 'image' ? (
                        <img src={msg.content} alt="shared" className="rounded-lg max-w-full h-auto cursor-pointer" referrerPolicy="no-referrer" />
                      ) : msg.type === 'file' ? (
                        <div className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                          <Paperclip className="w-4 h-4" />
                          <span className="text-sm">Shared File</span>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}
                      <div className={cn(
                        "flex items-center gap-1 mt-1 justify-end",
                        isMe ? "text-indigo-200" : "text-slate-400"
                      )}>
                        <span className="text-[10px]">{msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : '...'}</span>
                        {isMe && (msg.seen ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {/* Typing Indicators could be added here with a separate collection */}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-5xl mx-auto relative">
                <div className="flex items-center gap-1 mb-1">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx"
                />

                <div className="flex-1 relative">
                  <textarea
                    rows={1}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"
                  />
                  
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute bottom-full mb-4 right-0 z-50"
                      >
                        <EmojiPicker 
                          theme={darkMode ? Theme.DARK : Theme.LIGHT}
                          onEmojiClick={(emojiData) => {
                            setNewMessage(prev => prev + emojiData.emoji);
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all mb-0.5"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden mb-8 p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 font-bold"
            >
              <MessageSquare className="w-5 h-5" />
              Open Conversations
            </button>
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Your Messages</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm">
              Select a conversation from the sidebar or search for a user to start chatting in real-time.
            </p>
          </div>
        )}
      </div>

      {/* Group Creation Modal */}
      <AnimatePresence>
        {isCreatingGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingGroup(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold">Create Group Chat</h3>
                <p className="text-sm text-slate-500 mt-1">Select at least 2 users to start a group.</p>
              </div>

              <div className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Group Name</label>
                  <input
                    type="text"
                    placeholder="Enter group name..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select Members</label>
                  <div className="space-y-2">
                    {users.map((u) => (
                      <label 
                        key={u.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                          selectedUsersForGroup.includes(u.id) ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedUsersForGroup.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsersForGroup([...selectedUsersForGroup, u.id]);
                            } else {
                              setSelectedUsersForGroup(selectedUsersForGroup.filter(id => id !== u.id));
                            }
                          }}
                        />
                        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-xs">
                          {u.username[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{u.username}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                <button
                  onClick={() => setIsCreatingGroup(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!groupName.trim() || selectedUsersForGroup.length < 2}
                  onClick={createGroupChat}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  Create Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
