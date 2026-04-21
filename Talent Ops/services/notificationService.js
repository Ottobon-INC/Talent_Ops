import { supabase } from '../lib/supabaseClient';

/**
 * Send a notification to a user
 * @param {string} receiverId - ID of the user receiving the notification
 * @param {string} senderId - ID of the user sending the notification
 * @param {string} senderName - Name of the sender
 * @param {string} message - Notification message
 * @param {string} type - Type of notification (task_assigned, announcement, leave_request, etc.)
 * @param {string} [orgId] - Optional ID of the organization the notification belongs to.
 * @returns {Promise<void>}
 */
export const sendNotification = async (receiverId, senderId, senderName, message, type, orgId = null) => {
    try {
        const payload = {
            receiver_id: receiverId,
            sender_id: senderId,
            sender_name: senderName,
            message: message,
            type: type,
            is_read: false,
            created_at: new Date().toISOString()
        };

        if (orgId) payload.org_id = orgId;

        const { error } = await supabase
            .from('notifications')
            .insert(payload);

        if (error) throw error;
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

/**
 * Send notifications to multiple users
 * @param {Array<string>} receiverIds - Array of user IDs to receive the notification
 * @param {string} senderId - ID of the user sending the notification
 * @param {string} senderName - Name of the sender
 * @param {string} message - Notification message
 * @param {string} type - Type of notification
 * @param {string} [orgId] - Optional ID of the organization the notifications belong to.
 * @returns {Promise<void>}
 */
export const sendBulkNotifications = async (receiverIds, senderId, senderName, message, type, orgId = null) => {
    try {
        const notifications = receiverIds.map(receiverId => ({
            receiver_id: receiverId,
            sender_id: senderId,
            sender_name: senderName,
            message: message,
            type: type,
            is_read: false,
            org_id: orgId,
            created_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('notifications')
            .insert(notifications);

        if (error) throw error;
    } catch (error) {
        console.error('Error sending bulk notifications:', error);
    }
};

/**
 * Send task assignment notification
 * @param {string} assignedToId - ID of the user the task is assigned to
 * @param {string} assignerId - ID of the user assigning the task
 * @param {string} assignerName - Name of the assigner
 * @param {string} taskTitle - Title of the task
 * @returns {Promise<void>}
 */
export const sendTaskAssignedNotification = async (assignedToId, assignerId, assignerName, taskTitle, orgId = null) => {
    const message = `You have been assigned a new task: ${taskTitle}`;
    await sendNotification(assignedToId, assignerId, assignerName, message, 'task_assigned', orgId);
};

/**
 * Send announcement notification to all relevant users
 * @param {Array<string>} recipientIds - Array of user IDs who should receive the announcement
 * @param {string} creatorId - ID of the user creating the announcement
 * @param {string} creatorName - Name of the creator
 * @param {string} announcementTitle - Title of the announcement
 * @returns {Promise<void>}
 */
export const sendAnnouncementNotification = async (recipientIds, creatorId, creatorName, announcementTitle, orgId = null) => {
    const message = `${announcementTitle}`;
    await sendBulkNotifications(recipientIds, creatorId, creatorName, message, 'announcement', orgId);
};

/**
 * Marks all notifications as read for a user (Issue 9)
 * @param {string} userId - User ID
 */
export const markAllNotificationsAsRead = async (userId) => {
    try {
        // 1. Permanently delete message-related notifications
        const { error: delError } = await supabase
            .from('notifications')
            .delete()
            .eq('receiver_id', userId)
            .in('type', ['message', 'mention']);

        if (delError) console.warn('Non-fatal: Error deleting message notifications:', delError);

        // 2. Mark other notifications as read
        const { error: updError } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('receiver_id', userId)
            .eq('is_read', false);

        if (updError) throw updError;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};

/**
 * Marks a single notification as read
 * @param {string} notificationId - Notification ID
 */
export const markNotificationAsRead = async (notificationId) => {
    try {
        // First check type
        const { data: notif } = await supabase
            .from('notifications')
            .select('type')
            .eq('id', notificationId)
            .single();

        if (notif && ['message', 'mention'].includes(notif.type)) {
            // Delete if message/mention
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);
            if (error) throw error;
        } else {
            // Otherwise just mark as read
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);
            if (error) throw error;
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};
/**
 * Deletes message/mention notifications for a specific sender
 * @param {string} userId - Current user receiving
 * @param {string} senderId - The sender we are looking at
 */
export const markMessageNotificationsAsRead = async (userId, senderId) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete() // Permanently delete to clear history as requested
            .eq('receiver_id', userId)
            .eq('sender_id', senderId)
            .in('type', ['message', 'mention']);

        if (error) throw error;
    } catch (error) {
        console.error('Error clearing message notifications:', error);
    }
};

/**
 * Deletes all message and mention notifications for a user
 * @param {string} userId - Current user ID
 */
export const markAllMessageNotificationsAsRead = async (userId) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete() // Permanently delete to clear history as requested
            .eq('receiver_id', userId)
            .in('type', ['message', 'mention']);

        if (error) throw error;
    } catch (error) {
        console.error('Error clearing all message notifications:', error);
    }
};

/**
 * Purge stale message/mention notifications older than 24 hours.
 * These are transient by nature — if you didn't read them within a day,
 * they should not resurface the next time you log in.
 * This prevents the "4-month-old notification flood" bug.
 * @param {string} userId - Current user ID
 */
export const purgeStaleMessageNotifications = async (userId) => {
    try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('receiver_id', userId)
            .in('type', ['message', 'mention'])
            .lt('created_at', cutoff);

        if (error) {
            console.warn('Non-fatal: Error purging stale message notifications:', error);
        } else {
            console.log('[NotificationService] Purged stale message notifications older than 24h');
        }
    } catch (error) {
        console.error('Error purging stale message notifications:', error);
    }
};
