// hooks/useNotifications.ts
/**
 * React hook for managing notifications state
 */

import { useState, useCallback, useEffect } from 'react';
import {
    getUnreadNotifications,
    getAllNotifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    getUnreadCount,
    runProactiveChecks,
    type Notification
} from '../services/notificationService';

interface UseNotificationsReturn {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    error: string | null;

    refresh: () => Promise<void>;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    dismiss: (id: string) => Promise<void>;
    checkForAlerts: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const [notifs, count] = await Promise.all([
                getAllNotifications(),
                getUnreadCount()
            ]);
            setNotifications(notifs);
            setUnreadCount(count);
            setError(null);
        } catch (err) {
            setError('Nepodařilo se načíst notifikace');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const markRead = useCallback(async (id: string) => {
        await markAsRead(id);
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    const markAllRead = useCallback(async () => {
        await markAllAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    }, []);

    const dismiss = useCallback(async (id: string) => {
        await dismissNotification(id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        // Update unread count if dismissed notification was unread
        const notification = notifications.find(n => n.id === id);
        if (notification && !notification.read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    }, [notifications]);

    const checkForAlerts = useCallback(async () => {
        try {
            const result = await runProactiveChecks();
            const newCount = result.weatherAlerts.length + result.reminders.length;
            if (newCount > 0) {
                await refresh();
            }
        } catch (err) {
            console.error('Failed to check for alerts:', err);
        }
    }, [refresh]);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Periodic check for new alerts (every 30 minutes)
    useEffect(() => {
        const interval = setInterval(checkForAlerts, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [checkForAlerts]);

    return {
        notifications,
        unreadCount,
        isLoading,
        error,
        refresh,
        markRead,
        markAllRead,
        dismiss,
        checkForAlerts
    };
}
