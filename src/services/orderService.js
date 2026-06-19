// ========== FILE: src/services/orderService.js ==========
// Service untuk membuat order, upload bukti, dll
import { supabase } from '../lib/supabase'
import { getCart, clearCart } from './cartService'

/**
 * Generate order number: ORD/YYYYMMDD/XXXXX (5 digit random)
 */
export function generateOrderNumber() {
  const now = new Date()
  const yyyymmdd = now.toISOString().slice(0,10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `ORD/${yyyymmdd}/${random}`
}

/**
 * Buat pesanan baru
 * @param {Object} orderData - {
 *   store_id, member_id (optional), guest_name, guest_phone,
 *   shipping_address, shipping_latitude, shipping_longitude,
 *   shipping_cost, notes
 * }
 * @param {Array} items - dari cart (sudah termasuk snapshot harga)
 */
export async function createOrder(orderData, items) {
  const totalAmount = items.reduce((sum, item) => sum + (item.discounted_price * item.quantity), 0) + (orderData.shipping_cost || 0);
  
  const orderPayload = {
    order_number: generateOrderNumber(),
    store_id: orderData.store_id,
    member_id: orderData.member_id || null,
    guest_name: orderData.guest_name || null,
    guest_phone: orderData.guest_phone || null,
    shipping_address: orderData.shipping_address,
    shipping_latitude: orderData.shipping_latitude,
    shipping_longitude: orderData.shipping_longitude,
    shipping_cost: orderData.shipping_cost || 0,
    address_id: orderData.address_id || null,
    voucher_discount: orderData.voucher_discount || 0,
    final_total: orderData.final_total || totalAmount,
    upsell_items: orderData.upsell_items || null,
    total_amount: totalAmount,
    status: 'pending',
    payment_method: 'bank_transfer',
    notes: orderData.notes || null,
    created_at: new Date().toISOString()
  };
  
  console.log('Order payload:', orderPayload);
  
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([orderPayload])
    .select()
    .single();
  
  if (orderError) throw orderError;
  
  // Buat order_items (sama seperti sebelumnya)
  const orderItems = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    product_name: item.name,
    price: item.discounted_price,
    total: item.discounted_price * item.quantity,
    original_price: item.original_price,
    discounted_price: item.discounted_price,
    discount_percentage: item.discount_percentage || 0,
    quantity: item.quantity,
    subtotal: item.discounted_price * item.quantity
  }));
  
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);
  
  if (itemsError) throw itemsError;
  
  // ========== SIMPAN VOUCHER YANG DIGUNAKAN ==========
  if (orderData.selected_vouchers && orderData.selected_vouchers.length > 0) {
    // Ambil detail voucher untuk mendapatkan discount_applied
    const { data: vouchersData } = await supabase
      .from('vouchers')
      .select('id, type, value, max_discount')
      .in('id', orderData.selected_vouchers);
    
    if (vouchersData) {
      const orderVouchers = vouchersData.map(v => {
        // Hitung diskon aktual (simplifikasi)
        let discountApplied = 0;
        if (v.type === 'shipping_free') {
          discountApplied = orderData.shipping_cost || 0;
        } else if (v.type === 'discount_percent') {
          discountApplied = Math.round(totalAmount * (v.value / 100));
          if (v.max_discount && discountApplied > v.max_discount) {
            discountApplied = v.max_discount;
          }
        } else if (v.type === 'discount_nominal') {
          discountApplied = v.value;
        }
        return {
          order_id: order.id,
          voucher_id: v.id,
          discount_applied: discountApplied
        };
      });
      
      const { error: voucherError } = await supabase
        .from('order_vouchers')
        .insert(orderVouchers);
      
      if (voucherError) {
        console.error('Error saving order vouchers:', voucherError);
      }
    }
  }
  
  // ========== UPDATE USED_COUNT DAN MEMBER_VOUCHERS ==========
  if (orderData.selected_vouchers && orderData.selected_vouchers.length > 0) {
    for (const voucherId of orderData.selected_vouchers) {
      // Update used_count di vouchers
      await supabase.rpc('increment_voucher_used_count', { p_voucher_id: voucherId });
      
      // Update is_used di member_vouchers jika ada
      if (orderData.member_id) {
        await supabase
          .from('member_vouchers')
          .update({ is_used: true, used_at: new Date().toISOString() })
          .eq('member_id', orderData.member_id)
          .eq('voucher_id', voucherId);
      }
    }
  }
  
  clearCart();
  
  return order;
}
/**
 * Upload bukti transfer untuk order (member)
 */
export async function uploadPaymentProof(orderId, file) {
  // Upload file ke Supabase Storage
  const fileExt = file.name.split('.').pop()
  const fileName = `${orderId}_${Date.now()}.${fileExt}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(fileName, file)
  
  if (uploadError) throw uploadError
  
  const { data: publicUrlData } = supabase.storage
    .from('payment-proofs')
    .getPublicUrl(fileName)
  
  const publicUrl = publicUrlData.publicUrl
  
  // Update order dengan payment_proof_url
  const { error: updateError } = await supabase
    .from('orders')
    .update({ payment_proof_url: publicUrl })
    .eq('id', orderId)
  
  if (updateError) throw updateError
  
  return publicUrl
}

/**
 * Ambil detail order (lengkap dengan items dan store info)
 */
export async function getOrderDetail(orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      stores (name, bank_name, bank_account_number, bank_account_name),
      member:users (full_name, email)
    `)
    .eq('id', orderId)
    .single()
  if (error) throw error
  
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
  if (itemsError) throw itemsError
  
  return { ...order, items }
}