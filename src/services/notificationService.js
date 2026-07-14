// src/services/notificationService.js
import { supabase } from '../lib/supabase';

// ============================================================
// KONVERSI BASE64 KE Uint8Array (untuk VAPID public key)
// ============================================================
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ============================================================
// SUBSCRIBE PUSH NOTIFICATION
// ============================================================
export async function subscribePush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        import.meta.env.VITE_VAPID_PUBLIC_KEY
      ),
    });

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription,
      }, { onConflict: 'user_id' });

    if (error) throw error;
    console.log('Push subscription saved');
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe push:', error);
    throw error;
  }
}

// ============================================================
// UNSUBSCRIBE PUSH
// ============================================================
export async function unsubscribePush(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);
    console.log('Push subscription removed');
  } catch (error) {
    console.error('Error unsubscribing push:', error);
  }
}

// ============================================================
// AMBIL NOTIFIKASI USER
// ============================================================
export async function fetchNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ============================================================
// TANDAI NOTIFIKASI SUDAH DIBACA
// ============================================================
export async function markAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

// ============================================================
// TANDAI SEMUA NOTIFIKASI SUDAH DIBACA
// ============================================================
export async function markAllAsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

// ============================================================
// HITUNG NOTIFIKASI BELUM DIBACA
// ============================================================
export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

// ============================================================
// SUBSCRIBE REALTIME NOTIFICATIONS (PERBAIKAN URUTAN)
// ============================================================
export function subscribeNotifications(userId, callback) {
  // DS001: Pasang listener SEBELUM subscribe()
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return channel;
}