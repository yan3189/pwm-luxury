// ============================================================
// FILE: src/utils/priceUtils.js
// Utility untuk mengelola diskon produk (persen & nominal)
// ============================================================

/**
 * Interpretasi nilai diskon dari database
 * @param {number} price - Harga asli produk
 * @param {boolean} hasDiscount - Apakah produk memiliki diskon
 * @param {number} discountValue - Nilai diskon dari database
 * @returns {Object} { type, display, discountAmount, finalPrice }
 */
export function interpretDiscount(price, hasDiscount, discountValue) {
  // Jika tidak ada diskon
  if (!hasDiscount || !discountValue || discountValue <= 0) {
    return {
      type: 'none',
      display: '',
      discountAmount: 0,
      finalPrice: price,
      originalPrice: price
    };
  }

  let type, display, discountAmount = 0, finalPrice = price;

  // Jika value <= 100 → dianggap PERSEN (%)
  if (discountValue <= 100) {
    type = 'percentage';
    discountAmount = Math.round(price * (discountValue / 100));
    finalPrice = price - discountAmount;
    display = `${discountValue}%`;
  }
  // Jika value > 100 → dianggap NOMINAL (Rp)
  else {
    type = 'nominal';
    discountAmount = Math.min(discountValue, price); // Tidak boleh melebihi harga
    finalPrice = price - discountAmount;
    display = `Rp ${discountValue.toLocaleString()}`;
  }

  return {
    type,
    display,
    discountAmount,
    finalPrice,
    originalPrice: price
  };
}

/**
 * Hitung harga setelah diskon (untuk cart, order, dll)
 * @param {number} price - Harga asli
 * @param {boolean} hasDiscount - Apakah ada diskon
 * @param {number} discountValue - Nilai diskon
 * @returns {number} Harga setelah diskon
 */
export function calculateDiscountedPrice(price, hasDiscount, discountValue) {
  if (!hasDiscount || !discountValue || discountValue <= 0) {
    return price;
  }

  // Jika value <= 100 → PERSEN
  if (discountValue <= 100) {
    return Math.round(price * (1 - discountValue / 100));
  }
  // Jika value > 100 → NOMINAL
  else {
    return Math.max(0, price - discountValue);
  }
}

/**
 * Mendapatkan label diskon untuk tampilan
 * @param {number} price - Harga asli
 * @param {boolean} hasDiscount - Apakah ada diskon
 * @param {number} discountValue - Nilai diskon
 * @returns {string} Label diskon (contoh: "10%", "Rp 15.000")
 */
export function getDiscountLabel(price, hasDiscount, discountValue) {
  if (!hasDiscount || !discountValue || discountValue <= 0) {
    return '';
  }
  if (discountValue <= 100) {
    return `${discountValue}%`;
  }
  return `Rp ${discountValue.toLocaleString()}`;
}

/**
 * Validasi input diskon di form admin
 * @param {string} type - 'percentage' | 'nominal'
 * @param {number} value - Nilai yang diinput
 * @param {number} price - Harga produk (untuk validasi nominal tidak boleh > harga)
 * @returns {Object} { valid, message }
 */
export function validateDiscountInput(type, value, price = Infinity) {
  if (!value || value <= 0) {
    return { valid: false, message: 'Nilai diskon harus lebih dari 0' };
  }

  if (type === 'percentage') {
    if (value > 100) {
      return { valid: false, message: 'Diskon persen maksimal 100%' };
    }
    if (value < 1) {
      return { valid: false, message: 'Diskon persen minimal 1%' };
    }
    return { valid: true, message: null };
  }

  if (type === 'nominal') {
    if (value < 500) {
      return { valid: false, message: 'Diskon nominal minimal Rp 500' };
    }
    if (value > price) {
      return { valid: false, message: `Diskon tidak boleh melebihi harga produk (Rp ${price.toLocaleString()})` };
    }
    return { valid: true, message: null };
  }

  return { valid: false, message: 'Tipe diskon tidak valid' };
}

/**
 * Format diskon untuk tampilan di admin table
 * @param {number} price - Harga asli
 * @param {boolean} hasDiscount - Apakah ada diskon
 * @param {number} discountValue - Nilai diskon
 * @returns {string} Format untuk tampilan
 */
export function formatDiscountForTable(price, hasDiscount, discountValue) {
  if (!hasDiscount || !discountValue || discountValue <= 0) {
    return '-';
  }
  const info = interpretDiscount(price, hasDiscount, discountValue);
  return info.display;
}