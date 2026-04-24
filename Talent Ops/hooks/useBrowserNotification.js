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
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(console.warn);
        }
    }, []);

    useEffect(() => {
        if (!userId) {
            return;
        }

        // Check if browser supports notifications
        if (typeof window === 'undefined' || !("Notification" in window)) {
            return;
        }

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
                    const newNotification = payload.new;

                    // IN-APP NOTIFICATION logic remains (callbackRef.current handles this)
                    if (callbackRef.current && typeof callbackRef.current === 'function') {
                        callbackRef.current(newNotification);
                    }

                    // Show browser notification if tab is hidden
                    if (document.visibilityState === 'hidden' && Notification.permission === "granted") {
                        const title = newNotification?.sender_name
                            ? `${newNotification.sender_name}`
                            : 'Talent Ops';
                        const body = newNotification?.message || 'You have a new notification';

                        try {
                            const notification = new Notification(title, {
                                body,
                                tag: newNotification?.id || `notif-${Date.now()}`,
                                renotify: false
                            });

                            notification.onclick = () => {
                                window.focus();
                                notification.close();
                            };
                        } catch (e) {
                            console.warn('[useBrowserNotification] Failed to create notification:', e);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);
};

export default useBrowserNotification;
