// ========== FILE: src/services/guestService.js ==========
import { supabase } from '../lib/supabase';

/**
 * Mendapatkan atau membuat user guest berdasarkan session_id
 */
export async function getOrCreateGuestUser() {
  // Dapatkan atau buat session_id di localStorage
  let sessionId = localStorage.getItem('guest_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('guest_session_id', sessionId);
  }
  
  // Cek apakah sudah ada user guest dengan session_id ini
  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('id, role, full_name')
    .eq('session_id', sessionId)
    .maybeSingle();
  
  if (findError && findError.code !== 'PGRST116') {
    console.error('Error finding guest:', findError);
  }
  
  if (existing) {
    console.log('Existing guest user found:', existing.id);
    return existing;
  }
  
  // Buat user guest baru
  const tempEmail = `guest_${sessionId.slice(0, 8)}@temp.pwm.com`;
  
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      session_id: sessionId,
      email: tempEmail,
      temp_email: tempEmail,
      role: 'guest',
      full_name: 'Guest User',
      points: 0
    })
    .select()
    .single();
  
  if (insertError) {
    console.error('Error creating guest user:', insertError);
    throw insertError;
  }
  
  console.log('New guest user created:', newUser.id);
  return newUser;
}

/**
 * Simpan alamat untuk guest (langsung ke member_addresses)
 */
export async function saveGuestAddress(userId, lat, lng, addressText) {
  const { data, error } = await supabase
    .from('member_addresses')
    .insert({
      member_id: userId,
      label: 'Alamat Pengiriman',
      address_text: addressText,
      latitude: lat,
      longitude: lng,
      is_default: false
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error saving guest address:', error);
    return null;
  }
  
  console.log('Guest address saved:', data.id);
  return data;
}

/**
 * Upgrade guest menjadi member (tambahkan email & password)
 */
export async function upgradeGuestToMember(userId, email, password, fullName) {
  // 1. Update user di tabel users
  const { error: userError } = await supabase
    .from('users')
    .update({
      email: email,
      temp_email: null,
      role: 'member',
      full_name: fullName
    })
    .eq('id', userId);
  
  if (userError) throw userError;
  
  // 2. Buat akun auth di Supabase Auth
  const { error: authError } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { user_id: userId, full_name: fullName }
    }
  });
  
  if (authError) throw authError;
  
  return true;
}