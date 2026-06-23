// ============================================================
// FILE: api/midtrans/create-transaction.js
// ============================================================

// ✅ Load .env.local secara eksplisit
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Load .env.local dari root proyek
dotenv.config({ path: path.resolve(rootDir, '.env.local') });

import midtransClient from 'midtrans-client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 🔥 Baca dari process.env (sudah di-load oleh dotenv)
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const clientKey = process.env.VITE_MIDTRANS_CLIENT_KEY;
    const baseUrl = process.env.VITE_APP_URL || 'https://pwm-luxury.vercel.app';

    console.log('🔍 === MIDTRANS ENV CHECK ===');
    console.log('🔑 MIDTRANS_SERVER_KEY exists?', !!serverKey);
    console.log('🔑 VITE_MIDTRANS_CLIENT_KEY exists?', !!clientKey);
    console.log('📍 VITE_APP_URL:', baseUrl);

    if (!serverKey || !clientKey) {
      return res.status(500).json({
        success: false,
        error: 'MIDTRANS keys are not configured',
        details: { serverKey: !!serverKey, clientKey: !!clientKey }
      });
    }

    const snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: serverKey,
      clientKey: clientKey
    });

    const { orderId, orderNumber, finalTotal, customerName, customerEmail, customerPhone, items, shippingCost, voucherDiscount } = req.body;

    if (!orderId || !orderNumber || !finalTotal) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ============================================================
    // BUILD ITEM_DETAILS
    // ============================================================
    let itemDetails = [];

    if (items && items.length > 0) {
      itemDetails = items.map(item => ({
        id: item.id || 'product',
        name: item.name || 'Produk',
        price: Math.round(item.price || 0),
        quantity: item.quantity || 1,
        category: item.category || 'Product'
      }));
    }

    if (shippingCost > 0) {
      itemDetails.push({
        id: 'shipping',
        name: 'Ongkos Kirim',
        price: Math.round(shippingCost),
        quantity: 1,
        category: 'Shipping'
      });
    }

    if (voucherDiscount > 0) {
      itemDetails.push({
        id: 'discount',
        name: 'Diskon Voucher',
        price: -Math.round(voucherDiscount),
        quantity: 1,
        category: 'Discount'
      });
    }

    const grossAmount = itemDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    console.log('📊 Gross Amount:', grossAmount);
    console.log('📊 Item Details:', JSON.stringify(itemDetails, null, 2));

    // ============================================================
    // PARAMETER MIDTRANS
    // ============================================================
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount
      },
      customer_details: {
        first_name: customerName || 'Customer',
        email: customerEmail || 'customer@example.com',
        phone: customerPhone || '08123456789'
      },
      item_details: itemDetails,
      callbacks: {
        finish: `${baseUrl}/member/orders`,
        error: `${baseUrl}/checkout?error=payment_failed`,
        pending: `${baseUrl}/member/orders`
      },
      enabled_payments: [
        'credit_card',
        'bank_transfer',
        'gopay',
        'shopeepay',
        'qris',
        'other_qris'
      ]
    };

    console.log('📊 Midtrans Parameter:', JSON.stringify(parameter, null, 2));

    const transaction = await snap.createTransaction(parameter);

    console.log('✅ Midtrans Transaction Created:', transaction);

    res.status(200).json({
      success: true,
      snapToken: transaction.token,
      redirectUrl: transaction.redirect_url,
      orderId: orderId
    });

  } catch (error) {
    console.error('❌ Midtrans Error:', error);
    console.error('❌ Stack:', error.stack);

    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}