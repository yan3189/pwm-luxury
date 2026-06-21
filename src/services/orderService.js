// ============================================================
// FILE: src/services/orderService.js
// ============================================================

import { supabase } from '../lib/supabase';
import { clearCart } from './cartService';
import { applyVouchersToOrder } from './voucherService';

// ============================================================
// GENERATE ORDER NUMBER - ORD/YYYYMMDD/XXXXX
// ============================================================

/**
 * Generate order number dengan format ORD/YYYYMMDD/XXXXX
 * - ORD = prefix tetap
 * - YYYYMMDD = tanggal order (contoh: 20260621)
 * - XXXXX = nomor urut transaksi hari itu (5 digit, mulai 00001)
 */
const generateOrderNumber = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;
  const prefix = `ORD/${datePrefix}/`;
  
  // Cari order terakhir hari ini dengan format yang sama
  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .ilike('order_number', `${prefix}%`)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) {
    console.error('Error generating order number:', error);
    // Fallback: pakai timestamp + random
    const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    return `ORD/${datePrefix}/${random}`;
  }
  
  let nextNumber = 1;
  
  if (data && data.length > 0) {
    // Ambil angka terakhir dari order_number
    const lastOrderNumber = data[0].order_number;
    const parts = lastOrderNumber.split('/');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextNumber = lastSeq + 1;
    }
  }
  
  const seq = String(nextNumber).padStart(5, '0');
  return `${prefix}${seq}`;
};

// ============================================================
// CREATE ORDER
// ============================================================

/**
 * Membuat order baru dari checkout
 * @param {Object} orderData - Data order dari CheckoutPage
 * @param {Array} cartItems - Item dari cart
 */
export async function createOrder(orderData, cartItems) {
  console.log('===== CREATING ORDER =====');
  console.log('Order Data:', orderData);
  console.log('Cart Items:', cartItems);

  try {
    // ============================================================
    // STEP 1: BUAT ORDER DI TABEL orders
    // ============================================================

    // ✅ Generate order number dengan format ORD/YYYYMMDD/XXXXX
    const orderNumber = await generateOrderNumber();

    console.log('📋 Generated order number:', orderNumber);

    // Hitung ulang final_total jika tidak dikirim
    let finalTotal = orderData.final_total;
    if (!finalTotal || finalTotal === 0) {
      const cartSubtotal = orderData.total_amount || 0;
      const upsellItems = orderData.upsell_items || [];
      const upsellTotal = upsellItems.reduce((sum, item) => {
        const price = item.discounted_price || item.price || 0;
        return sum + (price * (item.quantity || 1));
      }, 0);
      const subtotal = cartSubtotal + upsellTotal;
      const shippingCost = orderData.shipping_cost || 0;
      const voucherDiscount = orderData.voucher_discount || 0;
      finalTotal = Math.max(0, subtotal + shippingCost - voucherDiscount);
      
      console.log('🔄 final_total dihitung ulang di server:', finalTotal);
    }

    // Prepare order data
    const orderPayload = {
      order_number: orderNumber,
      store_id: orderData.store_id,
      member_id: orderData.member_id || null,
      guest_name: orderData.guest_name || null,
      guest_phone: orderData.guest_phone || null,
      shipping_address: orderData.shipping_address,
      shipping_latitude: orderData.shipping_latitude,
      shipping_longitude: orderData.shipping_longitude,
      address_id: orderData.address_id || null,
      shipping_cost: orderData.shipping_cost || 0,
      total_amount: orderData.total_amount || 0,
      voucher_discount: orderData.voucher_discount || 0,
      final_total: finalTotal,
      notes: orderData.notes || null,
      payment_method: orderData.payment_method || 'manual_transfer',
      delivery_type: orderData.delivery_type || 'internal',
      status: 'pending',
      upsell_items: orderData.upsell_items || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('📊 ORDER PAYLOAD:', orderPayload);

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([orderPayload])
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw new Error('Gagal membuat pesanan: ' + orderError.message);
    }

    console.log('✅ Order created:', order.id);
    console.log('✅ Order number:', order.order_number);
    console.log('✅ final_total saved:', order.final_total);

    // ============================================================
    // STEP 2: SIMPAN ORDER ITEMS (DARI CART)
    // ============================================================
    
    const orderItems = cartItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      price: item.original_price || item.price,
      discounted_price: item.discounted_price || item.price,
      discount_percentage: item.discount_percentage || 0,
      original_price: item.original_price || item.price,
      total: (item.discounted_price || item.price) * item.quantity,
      subtotal: (item.discounted_price || item.price) * item.quantity
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items error:', itemsError);
      throw new Error('Gagal menyimpan item pesanan: ' + itemsError.message);
    }

    console.log('✅ Order items saved:', orderItems.length);

    // ============================================================
    // STEP 3: SIMPAN VOUCHER YANG DIGUNAKAN (order_vouchers)
    // ============================================================

    const selectedVouchers = orderData.selected_vouchers || [];
    const memberId = orderData.member_id;

    if (selectedVouchers.length > 0) {
      console.log('🎫 Saving selected vouchers:', selectedVouchers);
      
      const { data: voucherDetails, error: voucherError } = await supabase
        .from('vouchers')
        .select('id, name, type, value, max_discount')
        .in('id', selectedVouchers);

      if (voucherError) {
        console.error('Error fetching voucher details:', voucherError);
      }

      // ============================================================
      // Hitung subtotal untuk diskon (cart + upsell)
      // ============================================================
      
      const realSubtotal = orderData.subtotal || 0;
      
      let calculatedSubtotal = realSubtotal;
      if (realSubtotal === 0) {
        const cartSubtotal = orderData.total_amount || 0;
        const upsellItems = orderData.upsell_items || [];
        const upsellTotal = upsellItems.reduce((sum, item) => {
          const price = item.discounted_price || item.price;
          return sum + (price * item.quantity);
        }, 0);
        calculatedSubtotal = cartSubtotal + upsellTotal;
      }

      const shippingCost = orderData.shipping_cost || 0;
      const totalForDiscount = (realSubtotal || calculatedSubtotal) + shippingCost;

      console.log('📊 Discount calculation:', { 
        realSubtotal,
        calculatedSubtotal,
        shippingCost, 
        totalForDiscount 
      });

      // Buat data untuk order_vouchers
      const orderVouchers = (voucherDetails || []).map(voucher => {
        let discountApplied = 0;
        const baseForDiscount = realSubtotal || calculatedSubtotal;

        switch (voucher.type) {
          case 'shipping_free':
            discountApplied = shippingCost;
            break;
          case 'discount_percent':
            discountApplied = Math.round(baseForDiscount * (voucher.value / 100));
            if (voucher.max_discount && discountApplied > voucher.max_discount) {
              discountApplied = voucher.max_discount;
            }
            break;
          case 'discount_nominal':
            discountApplied = voucher.value;
            break;
          default:
            discountApplied = 0;
        }

        discountApplied = Math.min(discountApplied, totalForDiscount);

        console.log(`🎫 Voucher ${voucher.name}: type=${voucher.type}, value=${voucher.value}, base=${baseForDiscount}, discount=${discountApplied}`);

        return {
          order_id: order.id,
          voucher_id: voucher.id,
          voucher_name: voucher.name,
          discount_applied: discountApplied
        };
      });

      // Insert ke order_vouchers
      if (orderVouchers.length > 0) {
        const { error: ovError } = await supabase
          .from('order_vouchers')
          .insert(orderVouchers);

        if (ovError) {
          console.error('Error saving order_vouchers:', ovError);
        } else {
          console.log('✅ Order vouchers saved:', orderVouchers.length);
        }
      }

      // ============================================================
      // STEP 4: UPDATE member_vouchers.is_used
      // ============================================================
      if (memberId) {
        for (const voucherId of selectedVouchers) {
          const { data: memberVoucher, error: mvError } = await supabase
            .from('member_vouchers')
            .select('id')
            .eq('member_id', memberId)
            .eq('voucher_id', voucherId)
            .eq('is_used', false)
            .maybeSingle();

          if (mvError) {
            console.error('Error checking member_voucher:', mvError);
            continue;
          }

          if (memberVoucher) {
            const { error: updateError } = await supabase
              .from('member_vouchers')
              .update({ is_used: true, used_at: new Date().toISOString() })
              .eq('id', memberVoucher.id);

            if (updateError) {
              console.error('Error updating member_voucher:', updateError);
            } else {
              console.log('✅ Member voucher marked as used:', memberVoucher.id);
            }
          }
        }
      }

      // ============================================================
      // STEP 5: UPDATE vouchers.used_count
      // ============================================================
      for (const voucherId of selectedVouchers) {
        const { data: voucherData, error: vError } = await supabase
          .from('vouchers')
          .select('used_count')
          .eq('id', voucherId)
          .single();

        if (vError) {
          console.error('Error fetching voucher used_count:', vError);
          continue;
        }

        const newCount = (voucherData?.used_count || 0) + 1;

        const { error: updateError } = await supabase
          .from('vouchers')
          .update({ used_count: newCount })
          .eq('id', voucherId);

        if (updateError) {
          console.error('Error updating voucher used_count:', updateError);
        } else {
          console.log('✅ Voucher used_count updated:', voucherId, '→', newCount);
        }
      }
    }

    // ============================================================
    // STEP 6: KOSONGKAN CART
    // ============================================================
    clearCart();

    console.log('✅ Order completed:', order.id);
    console.log('===== ORDER CREATION COMPLETE =====');

    return order;

  } catch (error) {
    console.error('❌ Order creation failed:', error);
    throw error;
  }
}

/**
 * Helper: Hitung total cart (tanpa upsell)
 */
function calculateCartTotal(cartItems) {
  return cartItems.reduce((sum, item) => {
    const price = item.discounted_price || item.price || 0;
    return sum + (price * (item.quantity || 1));
  }, 0);
}