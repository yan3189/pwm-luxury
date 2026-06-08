// src/services/authService.js
import { supabase } from '../lib/supabase';

/**
 * Login dengan Google (untuk halaman login)
 * @param {string} redirectTo - Halaman redirect setelah login (default: /member/dashboard)
 */
export async function signInWithGoogle(redirectTo = '/member/dashboard') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${redirectTo}`,
    },
  });
  
  if (error) throw error;
  return data;
}

/**
 * Cek apakah user sudah punya identitas Google
 */
export async function hasGoogleIdentity() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  // Ambil identitas dari user
  const identities = user.identities || [];
  return identities.some(identity => identity.provider === 'google');
}

/**
 * Hubungkan akun Google (untuk member yang sudah login)
 */
export async function linkGoogleAccount() {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/member/settings/callback`,
    },
  });
  
  if (error) throw error;
  
  // Redirect ke halaman Google untuk konfirmasi
  if (data.url) {
    window.location.href = data.url;
  }
  
  return data;
}

/**
 * Handle callback setelah linking (dipanggil di halaman callback)
 */
export async function handleLinkingCallback() {
  // Setelah redirect dari Google, session akan otomatis ter-update
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  
  return { success: true, user };
}