import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { getConversationsByCategory, sendMessage, markAsReadInDB } from '../../../services/messageService';
import { markAllMessageNotificationsAsRead } from '../../../services/notificationService';

const messageAudio = new Audio('/sound.mp3');
messageAudio.preload = 'auto';
console.log('[MessageContext] Initialized sound: /sound.mp3');

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

    // Keep the ref in sync with state
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const navigate = useNavigate();
    const location = useLocation();

    const getSuppressedStorageKey = (nextUserId) => `message_suppressed_notifications_${nextUserId}`;

    const persistSuppressedNotification = (notificationId) => {
        if (!userId || !notificationId) return;

        suppressedNotificationsRef.current.add(notificationId);
        const trimmed = Array.from(suppressedNotificationsRef.current).slice(-200);
        suppressedNotificationsRef.current = new Set(trimmed);
        localStorage.setItem(getSuppressedStorageKey(userId), JSON.stringify(trimmed));
    };

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
            } else if (event === 'SIGNED_OUT') {
                setUserId(null);
                setConversations([]);
                setUnreadCount(0);
                setLastReadTimes({});
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Load initial Read Times from Storage
    useEffect(() => {
        if (!userId) return;
        const storageKey = `message_read_times_${userId}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            try {
                setLastReadTimes(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse read times', e);
            }
        }

        const suppressedStored = localStorage.getItem(getSuppressedStorageKey(userId));
        if (suppressedStored) {
            try {
                suppressedNotificationsRef.current = new Set(JSON.parse(suppressedStored));
            } catch (e) {
                console.error('Failed to parse suppressed notifications', e);
                suppressedNotificationsRef.current = new Set();
            }
        } else {
            suppressedNotificationsRef.current = new Set();
        }
    }, [userId]);

    // 3. Request Notification Permissions
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // 4. Fetch Conversations
    const fetchConversations = async () => {
        if (!userId) return [];
        try {
            const { data: memberships } = await supabase
                .from('conversation_members')
                .select('conversation_id, last_read_at')
                .eq('user_id', userId);

            if (!memberships?.length) return [];

            // Sync lastReadTimes with DB values
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

            const conversationIds = memberships.map(m => m.conversation_id);

            const { data: convs, error } = await supabase
                .from('conversations')
                .select(`id, type, name, conversation_indexes(last_message, last_message_at, last_sender_id)`)
                .in('id', conversationIds);

            if (error) throw error;

            // Fetch exact unread counts for conversations that seem unread
            const convsWithCounts = await Promise.all((convs || []).map(async (conv) => {
                const index = conv.conversation_indexes?.[0];
                const lastRead = updatedLastReadTimes[conv.id] || 0;
                const lastMsgTime = index?.last_message_at ? new Date(index.last_message_at).getTime() : 0;
                
                if (lastMsgTime > lastRead && index?.last_sender_id !== userId) {
                    const { count, error: countError } = await supabase
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

    // 5. Initial fetch & 60s fallback polling
    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 60000);
        return () => clearInterval(interval);
    }, [userId]);

    // 6. Real-time Message Listener
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`messages-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `type=eq.message`
                },
                async (payload) => {
                    // Make sure it's meant for this user and not already handled
                    if (payload.new.receiver_id !== userId) return;
                    if (handledNotificationsRef.current.has(payload.new.id)) return;
                    if (suppressedNotificationsRef.current.has(payload.new.id)) return;
                    
                    handledNotificationsRef.current.add(payload.new.id);
                    // Keep the set size manageable
                    if (handledNotificationsRef.current.size > 50) {
                        const firstItem = handledNotificationsRef.current.values().next().value;
                        handledNotificationsRef.current.delete(firstItem);
                    }

                    console.log('📬 Real-time message received:', payload);

                    // Play sound IMMEDIATELY — before any async work
                    try {
                        messageAudio.currentTime = 0;
                        messageAudio.play().catch(() => {});
                    } catch (e) {}
                    
                    await fetchConversations();

                    const senderId = payload.new.sender_id;
                    let senderAvatar = null;
                    let conversationId = null;
                    let displayMessage = payload.new.message || 'New Message';

                    // Context Fetching
                    if (senderId) {
                        const [profileRes, membershipsRes] = await Promise.all([
                            supabase.from('profiles').select('avatar_url').eq('id', senderId).single(),
                            supabase.from('conversation_members').select('conversation_id').eq('user_id', senderId)
                        ]);
                        senderAvatar = profileRes.data?.avatar_url;
                        const memberships = membershipsRes.data;

                        if (memberships) {
                            const senderConvIds = memberships.map(c => c.conversation_id);
                            const latestConvs = await fetchConversations();
                            const dm = latestConvs?.find(c => c.type === 'dm' && senderConvIds.includes(c.id));
                            if (dm) {
                                conversationId = dm.id;
                                const lastMessage = dm.conversation_indexes?.[0]?.last_message;
                                if (lastMessage) {
                                    displayMessage = lastMessage;
                                }
                            }
                        }
                    }

                    const newNotification = {
                        id: payload.new.id || Date.now(),
                        sender_id: senderId,
                        sender_name: payload.new.sender_name || 'User',
                        avatar_url: senderAvatar,
                        content: displayMessage,
                        conversation_id: conversationId,
                        timestamp: Date.now()
                    };

                    // If the user is already inside the messaging area, don't show popup cards again.
                    if (location.pathname.includes('/messages')) {
                        persistSuppressedNotification(payload.new.id);
                    } else {
                        addNotification(newNotification);
                    }
                    setLastIncomingMessage({ 
                        id: payload.new.id, 
                        conversation_id: conversationId,
                        timestamp: Date.now() 
                    });

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
                    console.log('👀 Member read status updated:', payload);
                    fetchConversations();
                    // Signal MessagingHub to refresh open chat's message read status
                    setLastMemberReadUpdate({ conversation_id: payload.new?.conversation_id, user_id: payload.new?.user_id, last_read_at: payload.new?.last_read_at, _t: Date.now() });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, location.pathname]); 

    // 7. Calculate Unread Count
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

    // Actions
    const markAsRead = (conversationId) => {
        const conv = conversationsRef.current?.find(c => c.id === conversationId);
        const lastMsgAtStr = conv?.conversation_indexes?.[0]?.last_message_at;
        const lastMsgTime = lastMsgAtStr ? new Date(lastMsgAtStr).getTime() : 0;

        // Use a buffer and ensure we cover the latest message timestamp perfectly even if sender's clock was ahead
        const now = Math.max(Date.now(), lastMsgTime) + 1000; 
        setLastReadTimes(prev => {
            const updated = { ...prev, [conversationId]: now };
            if (userId) localStorage.setItem(`message_read_times_${userId}`, JSON.stringify(updated));
            return updated;
        });

        if (userId && conversationId) {
            markAsReadInDB(conversationId, userId, new Date(now).toISOString());
            // Also clear all message notifications for this user (Issue: Double notifications)
            markAllMessageNotificationsAsRead(userId);
        }

        setNotificationQueue(prev => {
            prev.forEach(notification => {
                if (!conversationId || notification.conversation_id === conversationId) {
                    persistSuppressedNotification(notification.id);
                }
            });
            return prev.filter(notification => notification.conversation_id !== conversationId);
        });
    };

    const addNotification = (notification) => {
        if (!notification?.id || suppressedNotificationsRef.current.has(notification.id)) return;
        setNotificationQueue(prev => [notification, ...prev].slice(0, 5));
    };

    const dismissNotification = (messageId) => {
        persistSuppressedNotification(messageId);
        setNotificationQueue(prev => prev.filter(n => n.id !== messageId));
    };

    const sendQuickReply = async (conversationId, text) => {
        if (!userId || !conversationId || !text.trim()) return;
        try {
            const { data: conv } = await supabase.from('conversations').select('org_id').eq('id', conversationId).single();
            await sendMessage(conversationId, userId, text.trim(), [], conv?.org_id);
            return true;
        } catch (err) {
            console.error('Quick reply error:', err);
            return false;
        }
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

