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
  const totalAmount = items.reduce((sum, item) => sum + (item.discounted_price * item.quantity), 0) + (orderData.shipping_cost || 0)
  
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
    total_amount: totalAmount,
    status: 'pending',
    payment_method: 'bank_transfer',
    notes: orderData.notes || null,
    created_at: new Date().toISOString()
  }
  
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([orderPayload])
    .select()
    .single()
  
  if (orderError) throw orderError
  
  // Buat order_items
  const orderItems = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    product_name: item.name,
    original_price: item.original_price,
    discounted_price: item.discounted_price,
    discount_percentage: item.discount_percentage,
    quantity: item.quantity,
    subtotal: item.discounted_price * item.quantity
  }))
  
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)
  
  if (itemsError) throw itemsError
  
  // Kosongkan cart
  clearCart()
  
  return order
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