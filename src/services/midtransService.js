// ============================================================
// FILE: src/services/midtransService.js
// ============================================================

export async function createMidtransTransaction(orderData, cartItems) {
  try {
    const response = await fetch('/api/midtrans/create-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        finalTotal: orderData.final_total,
        customerName: orderData.guest_name || 'Customer',
        customerEmail: orderData.customer_email || 'customer@example.com',
        customerPhone: orderData.guest_phone || '08123456789',
        items: cartItems.map(item => ({
          id: item.product_id,
          name: item.name,
          price: item.discounted_price || item.price,
          quantity: item.quantity,
          category: 'Product'
        })),
        // ✅ KIRIM DATA ONGKIR & DISKON
        shippingCost: orderData.shipping_cost || 0,
        voucherDiscount: orderData.voucher_discount || 0,
        subtotal: orderData.subtotal || 0
      }),
    });

    // ✅ Cek response status sebelum parsing JSON
    if (!response.ok) {
      let errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      
      // Coba parse sebagai JSON, jika gagal pakai text
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { error: errorText || 'Unknown server error' };
      }
      
      throw new Error(errorJson.error || errorJson.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create transaction');
    }

    return data;

  } catch (error) {
    console.error('❌ Midtrans Service Error:', error);
    throw error;
  }
}

// ... (loadMidtransScript dan openMidtransPayment tetap sama seperti sebelumnya)

/**
 * Memuat Midtrans Snap script - DIPERBAIKI DENGAN RETRY
 */
export function loadMidtransScript(clientKey) {
  return new Promise((resolve, reject) => {
    // Jika snap sudah ada, resolve langsung
    if (window.snap && typeof window.snap.pay === 'function') {
      console.log('✅ Snap already available');
      resolve(window.snap);
      return;
    }

    // Hapus script lama jika ada (untuk reload)
    const existingScript = document.getElementById('midtrans-snap-script');
    if (existingScript) {
      existingScript.remove();
      console.log('🔄 Old Midtrans script removed');
    }

    const script = document.createElement('script');
    script.id = 'midtrans-snap-script';
    script.src = `https://app.sandbox.midtrans.com/snap/snap.js`;
    script.setAttribute('data-client-key', clientKey);
    script.async = true;

    let isResolved = false;

    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error('Timeout loading Midtrans Snap (10s)'));
      }
    }, 10000);

    script.onload = () => {
      // Beri waktu ekstra untuk inisialisasi
      setTimeout(() => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        
        if (window.snap && typeof window.snap.pay === 'function') {
          console.log('✅ Midtrans Snap loaded successfully');
          resolve(window.snap);
        } else {
          console.error('❌ Snap object not found after load');
          reject(new Error('Snap not available after load'));
        }
      }, 300);
    };

    script.onerror = () => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      console.error('❌ Failed to load Midtrans Snap script');
      reject(new Error('Failed to load Midtrans Snap (network error)'));
    };

    document.head.appendChild(script);
    console.log('🔧 Loading Midtrans Snap script...');
  });
}

/**
 * Buka popup pembayaran Midtrans
 */
export function openMidtransPayment(snapToken) {
  return new Promise((resolve, reject) => {
    if (!window.snap || typeof window.snap.pay !== 'function') {
      reject(new Error('Snap not loaded'));
      return;
    }

    console.log('🔓 Opening Midtrans popup with token:', snapToken);

    window.snap.pay(snapToken, {
      onSuccess: (result) => {
        console.log('✅ Payment Success:', result);
        resolve(result);
      },
      onPending: (result) => {
        console.log('⏳ Payment Pending:', result);
        resolve(result);
      },
      onError: (result) => {
        console.log('❌ Payment Error:', result);
        reject(result);
      },
      onClose: () => {
        console.log('🔄 Payment popup closed');
        // ✅ Resolve dengan status 'closed' agar loading hilang
        resolve({ status: 'closed', message: 'Popup ditutup' });
      }
    });
  });
}