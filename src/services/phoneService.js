// ============================================================
// FILE: src/services/phoneService.js
// Service untuk CRUD nomor HP member
// ============================================================

import { supabase } from '../lib/supabase';

/**
 * Ambil semua nomor HP milik member
 * @param {string} memberId - ID member
 * @returns {Promise<Array>} Array of phones
 */
export async function getMemberPhones(memberId) {
  if (!memberId) return [];
  
  const { data, error } = await supabase
    .from('member_phones')
    .select('*')
    .eq('member_id', memberId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching member phones:', error);
    return [];
  }

  return data || [];
}

/**
 * Ambil nomor HP default member
 * @param {string} memberId - ID member
 * @returns {Promise<Object|null>} Phone object atau null
 */
export async function getDefaultPhone(memberId) {
  if (!memberId) return null;

  const { data, error } = await supabase
    .from('member_phones')
    .select('*')
    .eq('member_id', memberId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching default phone:', error);
    return null;
  }

  return data;
}

/**
 * Tambah nomor HP baru
 * @param {string} memberId - ID member
 * @param {string} phone - Nomor HP
 * @param {string} label - Label (opsional)
 * @param {boolean} isDefault - Jadikan default?
 * @returns {Promise<Object>} Phone yang baru dibuat
 */
export async function addPhone(memberId, phone, label = '', isDefault = false) {
  if (!memberId || !phone) {
    throw new Error('Member ID dan nomor HP wajib diisi');
  }

  // Clean phone number (hapus spasi, strip)
  const cleanPhone = phone.replace(/\s/g, '');

  // Jika dijadikan default, unset default yang lain dulu
  if (isDefault) {
    await supabase
      .from('member_phones')
      .update({ is_default: false })
      .eq('member_id', memberId);
  }

  // Jika ini adalah nomor HP pertama, otomatis jadi default
  const existingPhones = await getMemberPhones(memberId);
  if (existingPhones.length === 0) {
    isDefault = true;
  }

  const { data, error } = await supabase
    .from('member_phones')
    .insert([{
      member_id: memberId,
      phone: cleanPhone,
      label: label || null,
      is_default: isDefault,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding phone:', error);
    throw new Error('Gagal menambahkan nomor HP: ' + error.message);
  }

  return data;
}

/**
 * Update nomor HP
 * @param {string} phoneId - ID nomor HP
 * @param {Object} data - Data yang diupdate { phone, label, is_default }
 * @param {string} memberId - ID member (untuk validasi)
 * @returns {Promise<Object>} Phone yang diupdate
 */
export async function updatePhone(phoneId, data, memberId) {
  if (!phoneId) throw new Error('ID nomor HP wajib diisi');

  const updates = {};
  if (data.phone) {
    updates.phone = data.phone.replace(/\s/g, '');
  }
  if (data.label !== undefined) {
    updates.label = data.label || null;
  }
  if (data.is_default !== undefined) {
    updates.is_default = data.is_default;
    // Jika dijadikan default, unset default yang lain
    if (data.is_default && memberId) {
      await supabase
        .from('member_phones')
        .update({ is_default: false })
        .eq('member_id', memberId)
        .neq('id', phoneId);
    }
  }
  updates.updated_at = new Date().toISOString();

  const { data: result, error } = await supabase
    .from('member_phones')
    .update(updates)
    .eq('id', phoneId)
    .select()
    .single();

  if (error) {
    console.error('Error updating phone:', error);
    throw new Error('Gagal mengupdate nomor HP: ' + error.message);
  }

  return result;
}

/**
 * Hapus nomor HP
 * @param {string} phoneId - ID nomor HP
 * @param {string} memberId - ID member (untuk validasi)
 * @returns {Promise<boolean>}
 */
export async function deletePhone(phoneId, memberId) {
  if (!phoneId) throw new Error('ID nomor HP wajib diisi');

  // Ambil data phone dulu untuk cek apakah ini default
  const { data: phone } = await supabase
    .from('member_phones')
    .select('is_default')
    .eq('id', phoneId)
    .eq('member_id', memberId)
    .single();

  const { error } = await supabase
    .from('member_phones')
    .delete()
    .eq('id', phoneId)
    .eq('member_id', memberId);

  if (error) {
    console.error('Error deleting phone:', error);
    throw new Error('Gagal menghapus nomor HP: ' + error.message);
  }

  // Jika yang dihapus adalah default, set phone lain menjadi default
  if (phone?.is_default) {
    const remaining = await getMemberPhones(memberId);
    if (remaining.length > 0) {
      await supabase
        .from('member_phones')
        .update({ is_default: true })
        .eq('id', remaining[0].id);
    }
  }

  return true;
}

/**
 * Set default nomor HP
 * @param {string} phoneId - ID nomor HP
 * @param {string} memberId - ID member
 * @returns {Promise<Object>} Phone yang diupdate
 */
export async function setDefaultPhone(phoneId, memberId) {
  if (!phoneId || !memberId) {
    throw new Error('ID nomor HP dan member ID wajib diisi');
  }

  // Unset semua default
  await supabase
    .from('member_phones')
    .update({ is_default: false })
    .eq('member_id', memberId);

  // Set yang dipilih menjadi default
  const { data, error } = await supabase
    .from('member_phones')
    .update({ 
      is_default: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', phoneId)
    .eq('member_id', memberId)
    .select()
    .single();

  if (error) {
    console.error('Error setting default phone:', error);
    throw new Error('Gagal mengatur default: ' + error.message);
  }

  return data;
}

/**
 * Format nomor HP untuk display
 * @param {string} phone - Nomor HP
 * @returns {string} Format: 0812-3456-7890
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length <= 4) return clean;
  if (clean.length <= 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`;
}

/**
 * Validasi format nomor HP Indonesia
 * @param {string} phone - Nomor HP
 * @returns {boolean}
 */
export function validatePhone(phone) {
  if (!phone) return false;
  const clean = phone.replace(/\D/g, '');
  // Minimal 10 digit, maksimal 13 digit
  // Mulai dengan 0, atau 62, atau 8
  return clean.length >= 10 && clean.length <= 13 && /^[0-9]/.test(clean);
}