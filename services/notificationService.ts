// services/notificationService.ts
/**
 * Notification and Alert service
 * Handles proactive notifications, reminders, and alerts
 */

import { supabase } from '../lib/supabase';

// ============================================================================
// Types
// ============================================================================

export type NotificationType = 'weather_alert' | 'event_reminder' | 'risk_warning' | 'system';
export type NotificationSeverity = 'info' | 'warning' | 'danger';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    severity: NotificationSeverity;
    event_id: string | null;
    data: any;
    read: boolean;
    dismissed: boolean;
    expires_at: string | null;
    created_at: string;
}

export interface CreateNotificationInput {
    type: NotificationType;
    title: string;
    message: string;
    severity?: NotificationSeverity;
    event_id?: string;
    data?: any;
    expires_at?: Date;
}

// ============================================================================
// Notification CRUD
// ============================================================================

/**
 * Create a new notification
 */
export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
    const { data, error } = await supabase
        .from('notifications')
        .insert({
            type: input.type,
            title: input.title,
            message: input.message,
            severity: input.severity || 'info',
            event_id: input.event_id || null,
            data: input.data || null,
            expires_at: input.expires_at?.toISOString() || null
        })
        .select()
        .single();

    if (error) {
        console.error('[NotificationService] Error creating notification:', error);
        throw error;
    }

    return data;
}

/**
 * Get unread notifications
 */
export async function getUnreadNotifications(): Promise<Notification[]> {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('read', false)
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('[NotificationService] Error fetching notifications:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get all notifications (including read)
 */
export async function getAllNotifications(limit = 100): Promise<Notification[]> {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[NotificationService] Error fetching all notifications:', error);
        throw error;
    }

    return data || [];
}

/**
 * Mark notification as read
 */
export async function markAsRead(id: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

    if (error) {
        console.error('[NotificationService] Error marking as read:', error);
    }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);

    if (error) {
        console.error('[NotificationService] Error marking all as read:', error);
    }
}

/**
 * Dismiss notification (hide from UI)
 */
export async function dismissNotification(id: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ dismissed: true })
        .eq('id', id);

    if (error) {
        console.error('[NotificationService] Error dismissing notification:', error);
    }
}

/**
 * Get unread count
 */
export async function getUnreadCount(): Promise<number> {
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
        .eq('dismissed', false);

    if (error) {
        console.error('[NotificationService] Error getting unread count:', error);
        return 0;
    }

    return count || 0;
}

// ============================================================================
// Proactive Alert Generation
// ============================================================================

/**
 * Check weather and create alerts for upcoming events
 */
export async function checkWeatherAlerts(): Promise<Notification[]> {
    const createdAlerts: Notification[] = [];

    try {
        // Get upcoming events (next 7 days)
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const { data: events, error } = await supabase
            .from('events')
            .select('*')
            .eq('status', 'planned')
            .gte('date', now.toISOString().split('T')[0])
            .lte('date', weekFromNow.toISOString().split('T')[0]);

        if (error || !events?.length) return createdAlerts;

        // Import weather service dynamically to avoid circular deps
        const { fetchWeatherForecast } = await import('./weatherService');
        const weatherData = await fetchWeatherForecast(50.0755, 14.4378, 7);

        for (const event of events) {
            const eventDate = new Date(event.date);
            const dayIndex = Math.floor((eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

            if (dayIndex < 0 || dayIndex >= weatherData.length) continue;

            const dayWeather = weatherData[dayIndex];
            const issues: string[] = [];

            // Check for problematic conditions
            if (dayWeather.precipitation > 10) {
                issues.push(`srážky ${dayWeather.precipitation}mm`);
            }
            if (dayWeather.temperatureMax > 30) {
                issues.push(`horko ${dayWeather.temperatureMax}°C`);
            }
            if (dayWeather.temperatureMin < 0) {
                issues.push(`mráz ${dayWeather.temperatureMin}°C`);
            }
            if (dayWeather.precipitationProbability > 70) {
                issues.push(`pravděpodobnost srážek ${dayWeather.precipitationProbability}%`);
            }

            if (issues.length > 0) {
                // Check if we already have an alert for this event
                const { data: existing } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('event_id', event.id)
                    .eq('type', 'weather_alert')
                    .eq('dismissed', false)
                    .single();

                if (!existing) {
                    const alert = await createNotification({
                        type: 'weather_alert',
                        title: `Varování pro "${event.title}"`,
                        message: `Pro ${eventDate.toLocaleDateString('cs-CZ')} se očekává: ${issues.join(', ')}. Zvažte přesunutí akce.`,
                        severity: dayWeather.precipitation > 20 || dayWeather.temperatureMin < -5 ? 'danger' : 'warning',
                        event_id: event.id,
                        data: { dayWeather, issues },
                        expires_at: eventDate
                    });
                    createdAlerts.push(alert);
                }
            }
        }
    } catch (err) {
        console.error('[NotificationService] Error checking weather alerts:', err);
    }

    return createdAlerts;
}

/**
 * Create upcoming event reminders
 */
export async function createEventReminders(): Promise<Notification[]> {
    const createdReminders: Notification[] = [];

    try {
        // Get events happening tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const { data: events, error } = await supabase
            .from('events')
            .select('*')
            .eq('status', 'planned')
            .eq('date', tomorrowStr);

        if (error || !events?.length) return createdReminders;

        for (const event of events) {
            // Check if reminder already exists
            const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('event_id', event.id)
                .eq('type', 'event_reminder')
                .eq('dismissed', false)
                .single();

            if (!existing) {
                const reminder = await createNotification({
                    type: 'event_reminder',
                    title: `Zítra: ${event.title}`,
                    message: `Nezapomeňte na plánovanou akci "${event.title}" zítra.`,
                    severity: 'info',
                    event_id: event.id,
                    expires_at: tomorrow
                });
                createdReminders.push(reminder);
            }
        }
    } catch (err) {
        console.error('[NotificationService] Error creating reminders:', err);
    }

    return createdReminders;
}

/**
 * Run all proactive checks
 */
export async function runProactiveChecks(): Promise<{
    weatherAlerts: Notification[];
    reminders: Notification[];
}> {
    const [weatherAlerts, reminders] = await Promise.all([
        checkWeatherAlerts(),
        createEventReminders()
    ]);

    return { weatherAlerts, reminders };
}
