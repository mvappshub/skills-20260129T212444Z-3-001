// components/NotificationPanel.tsx
/**
 * Notification panel showing alerts, reminders, and system messages
 */

import React from 'react';
import {
    Bell,
    X,
    Check,
    CheckCheck,
    AlertTriangle,
    CloudRain,
    Calendar,
    Info,
    Trash2
} from 'lucide-react';
import type { Notification, NotificationType, NotificationSeverity } from '../services/notificationService';

interface NotificationPanelProps {
    notifications: Notification[];
    unreadCount: number;
    isOpen: boolean;
    onClose: () => void;
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onDismiss: (id: string) => void;
}

const typeIcons: Record<NotificationType, React.ReactNode> = {
    weather_alert: <CloudRain className="w-4 h-4" />,
    event_reminder: <Calendar className="w-4 h-4" />,
    risk_warning: <AlertTriangle className="w-4 h-4" />,
    system: <Info className="w-4 h-4" />
};

const severityColors: Record<NotificationSeverity, string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800'
};

const severityIconColors: Record<NotificationSeverity, string> = {
    info: 'text-blue-500',
    warning: 'text-amber-500',
    danger: 'text-red-500'
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
    notifications,
    unreadCount,
    isOpen,
    onClose,
    onMarkRead,
    onMarkAllRead,
    onDismiss
}) => {
    if (!isOpen) return null;

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'právě teď';
        if (minutes < 60) return `před ${minutes} min`;
        if (hours < 24) return `před ${hours} hod`;
        if (days === 1) return 'včera';
        return `před ${days} dny`;
    };

    return (
        <div className="fixed top-4 right-4 w-96 max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    <span className="font-semibold">Upozornění</span>
                    {unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
                            {unreadCount} nových
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                        <button
                            onClick={onMarkAllRead}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            title="Označit vše jako přečtené"
                        >
                            <CheckCheck className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Žádná upozornění</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`group p-4 ${!notification.read ? 'bg-indigo-50/50' : ''} hover:bg-slate-50 transition-colors`}
                            >
                                <div className="flex gap-3">
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 p-2 rounded-lg ${severityColors[notification.severity]}`}>
                                        <span className={severityIconColors[notification.severity]}>
                                            {typeIcons[notification.type]}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className={`font-medium text-sm ${!notification.read ? 'text-slate-900' : 'text-slate-600'}`}>
                                                {notification.title}
                                            </h4>
                                            {!notification.read && (
                                                <span className="flex-shrink-0 w-2 h-2 bg-indigo-500 rounded-full mt-1.5" />
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-slate-400">
                                                {formatTime(notification.created_at)}
                                            </span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!notification.read && (
                                                    <button
                                                        onClick={() => onMarkRead(notification.id)}
                                                        className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                                        title="Označit jako přečtené"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => onDismiss(notification.id)}
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded"
                                                    title="Zavřít"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Bell button component with badge
export const NotificationBell: React.FC<{
    unreadCount: number;
    onClick: () => void;
}> = ({ unreadCount, onClick }) => (
    <button
        onClick={onClick}
        className="relative p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        title="Upozornění"
    >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
            </span>
        )}
    </button>
);
