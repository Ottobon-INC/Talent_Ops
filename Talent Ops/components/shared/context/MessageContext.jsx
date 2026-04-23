import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { getConversationsByCategory, sendMessage, markAsReadInDB } from '../../../services/messageService';
import { markAllMessageNotificationsAsRead, purgeStaleMessageNotifications } from '../../../services/notificationService';

const messageAudio = new Audio('/sound.mp3');
messageAudio.preload = 'auto';

const MessageContext = createContext();

export const useMessages = () => useContext(MessageContext);

export const MessageProvider = ({ children, addToast }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [conversations, setConversations] = useState([]);
    const [lastReadTimes, setLastReadTimes] = useState({});
    const [userId, setUserId] = useState(null);
    const [notificationQueue, setNotificationQueue] = useState([]);
    const [lastIncomingMessage, setLastIncomingMessage] = useState(null);
    const [lastMemberReadUpdate, setLastMemberReadUpdate] = useState(null);
    
    const handledNotificationsRef = useRef(new Set());
    const suppressedNotificationsRef = useRef(new Set());
    const conversationsRef = useRef(conversations);
    const locationRef = useRef(null);

    const navigate = useNavigate();
    const location = useLocation();

    // -- Utilities --
    const getSuppressedStorageKey = (nextUserId) => `message_suppressed_notifications_${nextUserId}`;

    const persistSuppressedNotification = (notificationId) => {
        if (!userId || !notificationId) return;
        suppressedNotificationsRef.current.add(notificationId);
        const trimmed = Array.from(suppressedNotificationsRef.current).slice(-200);
        suppressedNotificationsRef.current = new Set(trimmed);
        localStorage.setItem(getSuppressedStorageKey(userId), JSON.stringify(trimmed));

        // #region agent log (debug)
        fetch('http://127.0.0.1:7913/ingest/7714614f-7dca-4c37-a17c-564f376e14bc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7f33bb'},body:JSON.stringify({sessionId:'7f33bb',runId:'pre-fix',hypothesisId:'H2',location:'MessageContext.jsx:persistSuppressedNotification',message:'persistSuppressedNotification',data:{notificationId,trimmedCount:trimmed.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
    };

    const showBrowserNotification = (title, body) => {
        try {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                const notif = new Notification(title, {
                    body: body,
                    tag: 'talent-ops-msg',
                    renotify: true
                });
                notif.onclick = () => {
                    window.focus();
                    notif.close();
                };
            }
        } catch (e) {
            console.warn('[MessageContext] Browser notification failed:', e);
        }
    };

    const addNotification = (notification) => {
        if (!notification?.id || suppressedNotificationsRef.current.has(notification.id)) return;
        // #region agent log (debug)
        fetch('http://127.0.0.1:7913/ingest/7714614f-7dca-4c37-a17c-564f376e14bc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7f33bb'},body:JSON.stringify({sessionId:'7f33bb',runId:'pre-fix',hypothesisId:'H1',location:'MessageContext.jsx:addNotification',message:'addNotification accepted',data:{id:notification.id,conversation_id:notification.conversation_id||null,sender_id:notification.sender_id||null,queueBefore:notificationQueue.length,suppressed:suppressedNotificationsRef.current.has(notification.id)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setNotificationQueue(prev => [notification, ...prev].slice(0, 5));
    };

    const dismissNotification = (messageId) => {
        persistSuppressedNotification(messageId);
        // #region agent log (debug)
        fetch('http://127.0.0.1:7913/ingest/7714614f-7dca-4c37-a17c-564f376e14bc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7f33bb'},body:JSON.stringify({sessionId:'7f33bb',runId:'pre-fix',hypothesisId:'H3',location:'MessageContext.jsx:dismissNotification',message:'dismissNotification',data:{id:messageId,queueBefore:notificationQueue.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setNotificationQueue(prev => prev.filter(n => n.id !== messageId));
    };

    // -- Effects --
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    useEffect(() => {
        locationRef.current = location.pathname;
    }, [location.pathname]);

    // 1. Auth Change Listener
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                setUserId(session.user.id);
                purgeStaleMessageNotifications(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                setUserId(null);
                setConversations([]);
                setUnreadCount(0);
                setLastReadTimes({});
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Initial Setup (Read times & Permissions)
    useEffect(() => {
        if (!userId) return;
        
        // Load read times
        const stored = localStorage.getItem(`message_read_times_${userId}`);
        if (stored) {
            try { setLastReadTimes(JSON.parse(stored)); } catch (e) {}
        }

        // Load suppressed notifications
        const suppressedStored = localStorage.getItem(getSuppressedStorageKey(userId));
        if (suppressedStored) {
            try { suppressedNotificationsRef.current = new Set(JSON.parse(suppressedStored)); } catch (e) {}
        }

        // Request browser notification permission
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }, [userId]);

    // 3. Fetch Conversations logic
    const fetchConversations = async () => {
        if (!userId) return [];
        try {
            const { data: memberships } = await supabase
                .from('conversation_members')
                .select('conversation_id, last_read_at')
                .eq('user_id', userId);

            if (!memberships?.length) return [];

            const updatedLastReadTimes = { ...lastReadTimes };
            let hasChanges = false;
            memberships.forEach(m => {
                if (m.last_read_at) {
                    const dbTime = new Date(m.last_read_at).getTime();
                    if (!updatedLastReadTimes[m.conversation_id] || dbTime > updatedLastReadTimes[m.conversation_id]) {
                        updatedLastReadTimes[m.conversation_id] = dbTime;
                        hasChanges = true;
                    }
                }
            });

            if (hasChanges) {
                setLastReadTimes(updatedLastReadTimes);
                localStorage.setItem(`message_read_times_${userId}`, JSON.stringify(updatedLastReadTimes));
            }

            const { data: convs, error } = await supabase
                .from('conversations')
                .select(`id, type, name, conversation_indexes(last_message, last_message_at, last_sender_id)`)
                .in('id', memberships.map(m => m.conversation_id));

            if (error) throw error;

            const convsWithCounts = await Promise.all((convs || []).map(async (conv) => {
                const index = conv.conversation_indexes?.[0];
                const lastRead = updatedLastReadTimes[conv.id] || 0;
                const lastMsgTime = index?.last_message_at ? new Date(index.last_message_at).getTime() : 0;
                
                if (lastMsgTime > lastRead && index?.last_sender_id !== userId) {
                    const { count } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('conversation_id', conv.id)
                        .gt('created_at', new Date(lastRead).toISOString())
                        .neq('sender_user_id', userId);
                    return { ...conv, unread_count: count || 0 };
                }
                return { ...conv, unread_count: 0 };
            }));

            setConversations(convsWithCounts);
            return convsWithCounts;
        } catch (err) {
            console.error('Error fetching conversations:', err);
            return [];
        }
    };

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 60000);
        return () => clearInterval(interval);
    }, [userId]);

    // 4. Real-time Message Listener
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`messages-rt-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `type=eq.message`
                },
                async (payload) => {
                    if (payload.new.receiver_id !== userId) return;
                    if (handledNotificationsRef.current.has(payload.new.id)) return;
                    if (suppressedNotificationsRef.current.has(payload.new.id)) return;
                    
                    handledNotificationsRef.current.add(payload.new.id);
                    if (handledNotificationsRef.current.size > 50) {
                        const firstItem = handledNotificationsRef.current.values().next().value;
                        handledNotificationsRef.current.delete(firstItem);
                    }

                    try {
                        messageAudio.currentTime = 0;
                        messageAudio.play().catch(() => {});
                    } catch (e) {}
                    
                    await fetchConversations();

                    const senderId = payload.new.sender_id;
                    let senderAvatar = null;
                    let conversationId = null;
                    let displayMessage = payload.new.message || 'New Message';

                    if (senderId) {
                        const [profileRes, membershipsRes] = await Promise.all([
                            supabase.from('profiles').select('avatar_url').eq('id', senderId).single(),
                            supabase.from('conversation_members').select('conversation_id').eq('user_id', senderId)
                        ]);
                        senderAvatar = profileRes.data?.avatar_url;
                        const memberships = membershipsRes.data;

                        if (memberships) {
                            const senderConvIds = memberships.map(c => c.conversation_id);
                            const latestConvs = conversationsRef.current;
                            const dm = latestConvs?.find(c => c.type === 'dm' && senderConvIds.includes(c.id));
                            if (dm) {
                                conversationId = dm.id;
                                const lastMessage = dm.conversation_indexes?.[0]?.last_message;
                                if (lastMessage) displayMessage = lastMessage;
                            }
                        }
                    }

                    // Show browser notification if tab is hidden
                    if (document.visibilityState === 'hidden') {
                        showBrowserNotification(
                            `New message from ${payload.new.sender_name || 'User'}`,
                            displayMessage
                        );
                    }

                    // #region agent log (debug)
                    fetch('http://127.0.0.1:7913/ingest/7714614f-7dca-4c37-a17c-564f376e14bc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7f33bb'},body:JSON.stringify({sessionId:'7f33bb',runId:'pre-fix',hypothesisId:'H4',location:'MessageContext.jsx:rt:notifications:INSERT',message:'rt notification insert processed',data:{notifId:payload.new.id,receiver:payload.new.receiver_id,sender:payload.new.sender_id,location:locationRef.current||null,conversationId:conversationId||null,willSuppress:Boolean(locationRef.current?.includes('/messages')),queueLen:notificationQueue.length},timestamp:Date.now()})}).catch(()=>{});
                    // #endregion

                    if (locationRef.current?.includes('/messages')) {
                        persistSuppressedNotification(payload.new.id);
                    } else {
                        addNotification({
                            id: payload.new.id || Date.now(),
                            sender_id: senderId,
                            sender_name: payload.new.sender_name || 'User',
                            avatar_url: senderAvatar,
                            content: displayMessage,
                            conversation_id: conversationId,
                            timestamp: Date.now()
                        });
                    }
                    setLastIncomingMessage({ id: payload.new.id, conversation_id: conversationId, timestamp: Date.now() });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'conversation_members'
                },
                (payload) => {
                    fetchConversations();
                    setLastMemberReadUpdate({ conversation_id: payload.new?.conversation_id, user_id: payload.new?.user_id, last_read_at: payload.new?.last_read_at, _t: Date.now() });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    // 5. Unread calculation
    useEffect(() => {
        if (!conversations.length) return;
        let count = 0;
        let hasValidIndexes = false;
        conversations.forEach(conv => {
            const index = conv.conversation_indexes?.[0];
            if (!index?.last_message_at) return;
            hasValidIndexes = true;
            const lastMsgTime = new Date(index.last_message_at).getTime();
            const lastReadTime = lastReadTimes[conv.id] || 0;
            if (lastMsgTime > lastReadTime && index.last_sender_id !== userId) count++;
        });
        if (hasValidIndexes) setUnreadCount(count);
    }, [conversations, lastReadTimes]);

    const markAsRead = (conversationId) => {
        const conv = conversationsRef.current?.find(c => c.id === conversationId);
        const lastMsgAtStr = conv?.conversation_indexes?.[0]?.last_message_at;
        const lastMsgTime = lastMsgAtStr ? new Date(lastMsgAtStr).getTime() : 0;
        const now = Math.max(Date.now(), lastMsgTime) + 1000; 

        setLastReadTimes(prev => {
            const updated = { ...prev, [conversationId]: now };
            if (userId) localStorage.setItem(`message_read_times_${userId}`, JSON.stringify(updated));
            return updated;
        });

        if (userId && conversationId) {
            markAsReadInDB(conversationId, userId, new Date(now).toISOString());
            markAllMessageNotificationsAsRead(userId);
        }

        setNotificationQueue(prev => prev.filter(n => n.conversation_id !== conversationId));
    };

    const sendQuickReply = async (conversationId, text) => {
        if (!userId || !conversationId || !text.trim()) return;
        try {
            const { data: conv } = await supabase.from('conversations').select('org_id').eq('id', conversationId).single();
            await sendMessage(conversationId, userId, text.trim(), [], conv?.org_id);
            return true;
        } catch (err) { return false; }
    };

    const value = {
        unreadCount,
        conversations,
        markAsRead,
        lastReadTimes,
        notificationQueue,
        dismissNotification,
        addNotification,
        sendQuickReply,
        lastIncomingMessage,
        lastMemberReadUpdate,
        userId
    };

    return (
        <MessageContext.Provider value={value}>
            {children}
        </MessageContext.Provider>
    );
};
