// ============================================================
// FILE: api/midtrans/webhook.js
// ============================================================

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const notification = req.body;
    console.log('📨 Webhook Notification:', JSON.stringify(notification, null, 2));

    // Verifikasi signature
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const orderId = notification.order_id;
    const statusCode = notification.status_code;
    const grossAmount = notification.gross_amount;
    const signatureKey = notification.signature_key;

    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest('hex');

    if (signatureKey !== expectedSignature) {
      console.error('❌ Invalid signature!');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Ambil data order dari database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }

    // Tentukan status berdasarkan notifikasi
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    let newOrderStatus = order.status;
    let newPaymentStatus = transactionStatus; // settlement, pending, deny, cancel, expire, refund

    // Mapping status Midtrans ke status order
    if (transactionStatus === 'capture') {
      if (fraudStatus === 'accept') {
        newOrderStatus = 'paid';
        newPaymentStatus = 'settlement';
      } else if (fraudStatus === 'challenge') {
        newOrderStatus = 'pending';
        newPaymentStatus = 'pending';
      }
    } else if (transactionStatus === 'settlement') {
      newOrderStatus = 'paid';
      newPaymentStatus = 'settlement';
    } else if (transactionStatus === 'pending') {
      newOrderStatus = 'pending';
      newPaymentStatus = 'pending';
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel') {
      newOrderStatus = 'cancelled';
      newPaymentStatus = transactionStatus;
    } else if (transactionStatus === 'expire') {
      newOrderStatus = 'cancelled';
      newPaymentStatus = 'expire';
    } else if (transactionStatus === 'refund') {
      newOrderStatus = 'refunded';
      newPaymentStatus = 'refund';
    }

    // Update database jika status berubah
    if (newOrderStatus !== order.status || newPaymentStatus !== order.payment_status) {
      const updateData = {
        status: newOrderStatus,
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      };

      // Jika pembayaran berhasil, set payment_method ke midtrans
      if (newOrderStatus === 'paid') {
        updateData.payment_method = 'midtrans';
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (updateError) {
        console.error('❌ Failed to update order:', updateError);
        return res.status(500).json({ error: 'Failed to update order' });
      }

      console.log(`✅ Order status updated: ${order.status} → ${newOrderStatus}, payment_status: ${newPaymentStatus}`);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
}