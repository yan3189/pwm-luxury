// ============================================================
// FILE: src/services/voucherService.js
// Service untuk manajemen voucher (global & per-member)
// ============================================================

import { supabase } from '../lib/supabase';

/**
 * Ambil semua voucher yang tersedia untuk member (termasuk global + per-member)
 * @param {string} memberId - ID member
 * @param {string} storeId - ID store
 * @param {number} subtotal - Subtotal pesanan (untuk validasi min_order)
 */
export async function getAvailableVouchers(memberId, storeId, subtotal) {
  if (!memberId) return [];
  
  // 1. Ambil voucher yang dimiliki member (dari member_vouchers)
  const { data: memberVouchers, error: memberError } = await supabase
    .from('member_vouchers')
    .select(`
      id,
      is_used,
      expiry_date,
      voucher_id,
      vouchers (*)
    `)
    .eq('member_id', memberId)
    .eq('is_used', false)
    .eq('vouchers.is_active', true);
  
  if (memberError) {
    console.error('Error fetching member vouchers:', memberError);
  }
  
  // 2. Ambil voucher global (is_global = true)
  const { data: globalVouchers, error: globalError } = await supabase
    .from('vouchers')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_global', true)
    .eq('is_active', true);
  
  if (globalError) {
    console.error('Error fetching global vouchers:', globalError);
  }
  
  // 3. Gabungkan dan validasi
  const allVouchers = [];
  
  // Member vouchers
  (memberVouchers || []).forEach(mv => {
    if (mv.vouchers) {
      // Cek expiry_date (jika ada di member_vouchers)
      if (mv.expiry_date && new Date(mv.expiry_date) < new Date()) {
        return; // expired
      }
      allVouchers.push({
        ...mv.vouchers,
        member_voucher_id: mv.id,
        is_global: false,
        is_used: mv.is_used,
        expiry_date: mv.expiry_date || mv.vouchers.end_date
      });
    }
  });
  
  // Global vouchers
  (globalVouchers || []).forEach(v => {
    // Cek apakah member sudah punya voucher ini (tidak boleh double)
    const alreadyHas = allVouchers.some(vv => vv.id === v.id);
    if (!alreadyHas) {
      allVouchers.push({
        ...v,
        member_voucher_id: null,
        is_global: true,
        is_used: false,
        expiry_date: v.end_date
      });
    }
  });
  
  // 4. Filter berdasarkan validasi
  const validVouchers = allVouchers.filter(v => {
    // Cek is_voucher_valid
    const isValid = isVoucherValid(v, subtotal);
    return isValid;
  });
  
  return validVouchers;
}

/**
 * Cek validitas voucher
 * @param {Object} voucher - Data voucher
 * @param {number} subtotal - Subtotal pesanan
 */
export function isVoucherValid(voucher, subtotal) {
  if (!voucher.is_active) return false;
  
  // Cek expired
  if (voucher.expiry_date && new Date(voucher.expiry_date) < new Date()) {
    return false;
  }
  
  // Cek start date
  if (voucher.start_date && new Date(voucher.start_date) > new Date()) {
    return false;
  }
  
  // Cek min order
  if (voucher.min_order && subtotal < voucher.min_order) {
    return false;
  }
  
  // Cek usage limit
  if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) {
    return false;
  }
  
  // Cek is_used (untuk member voucher)
  if (voucher.is_used) return false;
  
  return true;
}

/**
 * Hitung diskon dari voucher
 * @param {Object} voucher - Data voucher
 * @param {number} subtotal - Subtotal pesanan
 * @param {number} shippingCost - Ongkos kirim
 */
export function calculateVoucherDiscount(voucher, subtotal, shippingCost) {
  let discount = 0;
  
  switch (voucher.type) {
    case 'shipping_free':
      discount = shippingCost;
      break;
      
    case 'discount_percent':
      discount = Math.round(subtotal * (voucher.value / 100));
      // Batasi max_discount jika ada
      if (voucher.max_discount && discount > voucher.max_discount) {
        discount = voucher.max_discount;
      }
      break;
      
    case 'discount_nominal':
      discount = voucher.value;
      break;
      
    default:
      discount = 0;
  }
  
  return Math.min(discount, subtotal + shippingCost);
}

/**
 * Hitung total diskon dari multiple vouchers
 * @param {Array} selectedVouchers - Array voucher yang dipilih
 * @param {number} subtotal - Subtotal pesanan
 * @param {number} shippingCost - Ongkos kirim
 */
export function calculateTotalDiscount(selectedVouchers, subtotal, shippingCost) {
  let totalDiscount = 0;
  let shippingFreeApplied = false;
  let remainingSubtotal = subtotal;
  
  selectedVouchers.forEach(v => {
    let discount = 0;
    
    // Jika shipping_free dan belum ada, diskon = shippingCost
    if (v.type === 'shipping_free' && !shippingFreeApplied) {
      discount = shippingCost;
      shippingFreeApplied = true;
    } else if (v.type === 'discount_percent') {
      // Diskon persentase dari subtotal YANG TERSISA
      discount = Math.round(remainingSubtotal * (v.value / 100));
      if (v.max_discount && discount > v.max_discount) {
        discount = v.max_discount;
      }
      remainingSubtotal -= discount;
    } else if (v.type === 'discount_nominal') {
      discount = Math.min(v.value, remainingSubtotal);
      remainingSubtotal -= discount;
    }
    
    totalDiscount += discount;
  });
  
  return totalDiscount;
}

/**
 * Simpan voucher yang digunakan ke order
 * @param {string} orderId - ID order
 * @param {Array} selectedVouchers - Array voucher yang dipilih
 * @param {number} totalDiscount - Total diskon
 */
export async function applyVouchersToOrder(orderId, selectedVouchers, totalDiscount) {
  if (!selectedVouchers || selectedVouchers.length === 0) {
    return { success: true };
  }
  
  // 1. Insert ke order_vouchers
  const orderVouchers = selectedVouchers.map(v => ({
    order_id: orderId,
    voucher_id: v.id,
    discount_applied: calculateVoucherDiscount(v, 0, 0) // ini akan dihitung ulang di backend
  }));
  
  // Untuk setiap voucher, hitung diskon aktual (butuh subtotal & shipping)
  // Untuk simpel, kita simpan 0 dulu, nanti update setelah final total dihitung
  const { error: insertError } = await supabase
    .from('order_vouchers')
    .insert(orderVouchers);
  
  if (insertError) throw insertError;
  
  // 2. Update used_count di vouchers
  for (const v of selectedVouchers) {
    // Cek apakah voucher ini dari member_vouchers (per-member)
    if (v.member_voucher_id) {
      // Update is_used di member_vouchers
      await supabase
        .from('member_vouchers')
        .update({ 
          is_used: true, 
          used_at: new Date().toISOString() 
        })
        .eq('id', v.member_voucher_id);
    }
    
    // Update used_count di vouchers (jika global atau per-member)
    if (v.is_global || !v.member_voucher_id) {
      await supabase
        .from('vouchers')
        .update({ 
          used_count: (v.used_count || 0) + 1 
        })
        .eq('id', v.id);
    }
  }
  
  return { success: true };
}

/**
 * Ambil voucher yang dimiliki member (untuk ditampilkan di dashboard)
 * @param {string} memberId - ID member
 */
export async function getMemberVouchers(memberId) {
  const { data, error } = await supabase
    .from('member_vouchers')
    .select(`
      id,
      is_used,
      expiry_date,
      assigned_at,
      vouchers (*)
    `)
    .eq('member_id', memberId)
    .order('assigned_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching member vouchers:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Admin: Buat voucher baru
 * @param {Object} data - Data voucher
 */
export async function createVoucher(data) {
  const { error } = await supabase
    .from('vouchers')
    .insert([{
      store_id: data.store_id,
      code: data.code || generateVoucherCode(),
      name: data.name,
      description: data.description || '',
      type: data.type,
      value: data.value,
      max_discount: data.max_discount || null,
      min_order: data.min_order || 0,
      is_global: data.is_global || false,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      usage_limit: data.usage_limit || null,
      is_active: data.is_active !== undefined ? data.is_active : true
    }]);
  
  if (error) throw error;
  return { success: true };
}

/**
 * Generate kode voucher unik
 */
function generateVoucherCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Admin: Assign voucher ke member
 * @param {string} voucherId - ID voucher
 * @param {string} memberId - ID member
 * @param {Date} expiryDate - Tanggal kadaluarsa (opsional)
 */
export async function assignVoucherToMember(voucherId, memberId, expiryDate = null) {
  const { error } = await supabase
    .from('member_vouchers')
    .insert([{
      member_id: memberId,
      voucher_id: voucherId,
      expiry_date: expiryDate,
      assigned_at: new Date().toISOString()
    }]);
  
  if (error) throw error;
  return { success: true };
}