import React, { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Hook to handle browser notifications for real-time updates
 * @param {string} userId - The current user's ID
 */
export const useBrowserNotification = (userId, onNewNotification = null) => {
    // Use a ref to store the latest callback to avoid re-subscribing when the function changes
    const callbackRef = React.useRef(onNewNotification);

    useEffect(() => {
        callbackRef.current = onNewNotification;
    }, [onNewNotification]);

    useEffect(() => {
        // Request permission on mount
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        if (!userId) {
            console.log('[useBrowserNotification] No userId provided yet.');
            return;
        }

        console.log(`[useBrowserNotification] Initializing for user: ${userId}`);

        // Check if browser supports notifications
        if (!("Notification" in window)) {
            console.log("[useBrowserNotification] This browser does not support desktop notification");
            return;
        }

        if (Notification.permission !== "granted") {
            console.log('[useBrowserNotification] Permission not granted:', Notification.permission);
        } else {
            console.log('[useBrowserNotification] Permission granted.');
        }

        console.log('[useBrowserNotification] Setting up Supabase channel...');

        const channel = supabase
            .channel(`browser-notifications-${userId}`) // Unique channel name per user
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `receiver_id=eq.${userId}`
                },
                (payload) => {
                    console.log('[useBrowserNotification] Payload received:', payload);
                    const newNotification = payload.new;

                    // IN-APP NOTIFICATION logic remains (callbackRef.current handles this)
                    if (callbackRef.current && typeof callbackRef.current === 'function') {
                        callbackRef.current(newNotification);
                    }

                    if (Notification.permission === "granted") {
                        const title = newNotification?.sender_name
                            ? `${newNotification.sender_name}`
                            : 'Talent Ops';
                        const body = newNotification?.message || 'You have a new notification';

                        const notification = new Notification(title, {
                            body,
                            tag: newNotification?.id || `notif-${Date.now()}`,
                            renotify: false
                        });

                        notification.onclick = () => {
                            window.focus();
                            notification.close();
                        };
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[useBrowserNotification] Subscription status changed to: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log('[useBrowserNotification] Successfully subscribed to realtime events');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[useBrowserNotification] Realtime channel error. Check your connection or RLS policies.');
                }
                if (status === 'TIMED_OUT') {
                    console.error('[useBrowserNotification] Realtime subscription timed out.');
                }
            });

        return () => {
            console.log('[useBrowserNotification] Cleaning up subscription for', userId);
            supabase.removeChannel(channel);
        };
    }, [userId]);
};

export default useBrowserNotification;
