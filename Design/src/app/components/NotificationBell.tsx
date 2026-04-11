import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import { useTranslation } from 'react-i18next';
import { USE_DUMMY_DATA } from '../config/useDummyData';

export default function NotificationBell() {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch notification count
    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchNotificationCount = async () => {
            try {
                if (USE_DUMMY_DATA) {
                    setUnreadCount(3); // Dummy count
                    return;
                }

                const res = await api.get('/Notifications/count');
                setUnreadCount(res.data.count || 0);
            } catch (error) {
                logger.error('Error fetching notification count:', error);
            }
        };

        fetchNotificationCount();
        const interval = setInterval(fetchNotificationCount, 60000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    const handleOpen = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleOpen}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">{t('notifications.title', 'Notifications')}</h3>
                    </div>
                    <div className="p-4 text-center text-gray-500">
                        {t('notifications.noNew', 'No new notifications')}
                    </div>
                </div>
            )}
        </div>
    );
}
