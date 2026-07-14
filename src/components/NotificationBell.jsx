// src/components/NotificationBell.jsx
import { useState, useEffect, useRef } from 'react';
import { Bell, Package, CheckCircle, Truck, MapPin } from 'lucide-react';
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  subscribeNotifications
} from '../services/notificationService';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase'; // DS001: import supabase untuk cleanup

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Load notifikasi awal
  useEffect(() => {
    if (userId) {
      loadNotifications();
      loadUnreadCount();
    }
  }, [userId]);

  // Subscribe realtime
  useEffect(() => {
    if (!userId) return;

    // Di dalam subscribeNotifications callback
const channel = subscribeNotifications(userId, (newNotif) => {
  try {
  const audio = new Audio('/sounds/notification.mp3');
  audio.play().catch(e => console.log('Audio play failed:', e));
} catch (e) {
  console.log('Audio error:', e);
}
  
  console.log('🔔 Realtime notification received:', newNotif); // DS001: debug
  setNotifications((prev) => [newNotif, ...prev]);
  setUnreadCount((prev) => prev + 1);
  window.dispatchEvent(new CustomEvent('show-toast', {
    detail: { message: `🔔 ${newNotif.title}` }
  }));
});

    return () => {
      supabase.removeChannel(channel); // DS001: cleanup dengan supabase
    };
  }, [userId]);

  // Click outside untuk menutup dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await fetchNotifications(userId);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await getUnreadCount(userId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleClickNotification = async (notif) => {
    await markAsRead(notif.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setIsOpen(false);

    // Navigasi berdasarkan tipe
    if (notif.data && notif.data.order_id) {
      if (notif.type.startsWith('delivery_')) {
        navigate(`/member/orders/${notif.data.order_id}`);
      } else {
        navigate(`/admin/orders/${notif.data.order_id}`);
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (userId) {
      await markAllAsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'new_order': return <Package size={14} className="text-blue-400" />;
      case 'order_paid': return <CheckCircle size={14} className="text-green-400" />;
      case 'delivery_started': return <Truck size={14} className="text-orange-400" />;
      case 'delivery_completed': return <MapPin size={14} className="text-green-400" />;
      default: return <Bell size={14} />;
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-yellow-500 transition rounded-full hover:bg-gray-800"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-900 rounded-xl border border-white/10 shadow-xl z-50">
          <div className="flex justify-between items-center p-3 border-b border-white/10">
            <h3 className="font-semibold text-sm">Notifikasi</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-yellow-500 hover:text-yellow-400"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Belum ada notifikasi
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClickNotification(notif)}
                  className={`w-full text-left p-3 hover:bg-gray-800 transition border-b border-white/5 flex items-start gap-3 ${
                    !notif.is_read ? 'bg-yellow-500/5' : ''
                  }`}
                >
                  {getIcon(notif.type)}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${!notif.is_read ? 'text-white' : 'text-gray-400'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{notif.message}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(notif.created_at).toLocaleTimeString('id-ID')}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5"></div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}