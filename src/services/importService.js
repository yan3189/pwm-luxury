// ============================================================
// FILE: src/services/importService.js
// Service untuk import produk dari Excel (dengan sanitasi & validasi)
// ============================================================

import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

// ============================================================
// 1. SANITASI INPUT (Cegah XSS & injection)
// ============================================================

/**
 * Sanitasi string: hapus HTML/script tags & karakter berbahaya
 * @param {string} str - String yang akan disanitasi
 * @returns {string} String yang sudah aman
 */
export function sanitizeString(str) {
  if (!str) return '';
  // Konversi ke string
  let cleaned = String(str);
  // Hapus HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  // Hapus script pattern
  cleaned = cleaned.replace(/javascript:/gi, '');
  // Hapus karakter kontrol
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  // Trim
  cleaned = cleaned.trim();
  return cleaned;
}

/**
 * Validasi tipe data harga (harus angka integer positif)
 * @param {any} value - Nilai yang divalidasi
 * @returns {Object} { valid: boolean, value: number | null, error: string }
 */
export function validatePrice(value) {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, value: null, error: 'Harga harus berupa angka' };
  }
  if (num < 0) {
    return { valid: false, value: null, error: 'Harga tidak boleh negatif' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, value: null, error: 'Harga harus bilangan bulat' };
  }
  return { valid: true, value: Math.round(num), error: null };
}

/**
 * Validasi tipe data stok (harus angka integer >= 0)
 * @param {any} value - Nilai yang divalidasi
 * @returns {Object} { valid: boolean, value: number | null, error: string }
 */
export function validateStock(value) {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    // Jika kosong, default 0
    if (value === '' || value === null || value === undefined) {
      return { valid: true, value: 0, error: null };
    }
    return { valid: false, value: null, error: 'Stok harus berupa angka' };
  }
  if (num < 0) {
    return { valid: false, value: null, error: 'Stok tidak boleh negatif' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, value: null, error: 'Stok harus bilangan bulat' };
  }
  return { valid: true, value: Math.round(num), error: null };
}

/**
 * Validasi status (aktif/tidak) → boolean
 * @param {any} value - Nilai yang divalidasi
 * @returns {Object} { valid: boolean, value: boolean | null, error: string }
 */
export function validateStatus(value) {
  if (!value) return { valid: true, value: true, error: null };
  const str = String(value).toLowerCase().trim();
  if (str === 'aktif' || str === 'active' || str === 'true' || str === '1') {
    return { valid: true, value: true, error: null };
  }
  if (str === 'tidak' || str === 'nonaktif' || str === 'inactive' || str === 'false' || str === '0') {
    return { valid: true, value: false, error: null };
  }
  return { valid: false, value: null, error: 'Status harus "aktif" atau "tidak"' };
}

/**
 * Validasi dan sanitasi 1 baris produk
 * @param {Array} row - Array dari Excel
 * @param {number} rowIndex - Index baris (untuk error reporting)
 * @returns {Object} { valid: boolean, data: Object, errors: Array }
 */
export function validateProductRow(row, rowIndex) {
  const errors = [];
  const nameRaw = row[0] || '';
  const priceRaw = row[1];
  const descRaw = row[2] || '';
  const stockRaw = row[3];
  const imageRaw = row[4] || '';
  const statusRaw = row[5] || 'aktif';

  // 1. Nama Produk (wajib, sanitasi)
  const name = sanitizeString(nameRaw);
  if (!name) {
    errors.push(`Baris ${rowIndex}: Nama produk tidak boleh kosong`);
  }

  // 2. Harga
  const priceResult = validatePrice(priceRaw);
  if (!priceResult.valid) {
    errors.push(`Baris ${rowIndex}: ${priceResult.error}`);
  }

  // 3. Deskripsi (opsional, sanitasi)
  const description = sanitizeString(descRaw);

  // 4. Stok
  const stockResult = validateStock(stockRaw);
  if (!stockResult.valid) {
    errors.push(`Baris ${rowIndex}: ${stockResult.error}`);
  }

  // 5. URL Gambar (opsional, sanitasi)
  const imageUrl = sanitizeString(imageRaw);
  // Validasi URL (opsional)
  if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    // Tidak error, hanya warning (admin bisa memasukkan URL relatif)
    // Tapi kita tetap sanitasi
  }

  // 6. Status
  const statusResult = validateStatus(statusRaw);
  if (!statusResult.valid) {
    errors.push(`Baris ${rowIndex}: ${statusResult.error}`);
  }

  // Jika ada error, return invalid
  if (errors.length > 0) {
    return { valid: false, data: null, errors };
  }

  // Data valid
  return {
    valid: true,
    data: {
      name,
      price: priceResult.value,
      description,
      stock: stockResult.value,
      image_url: imageUrl,
      is_active: statusResult.value,
      // Default values (tidak dari Excel)
      has_discount: false,
      discount_percentage: 0,
      is_featured: false,
    },
    errors: []
  };
}

/**
 * Parse file Excel dan validasi semua baris
 * @param {File} file - File yang diupload
 * @returns {Promise} { success: boolean, data: Array, errors: Array, fileName: string }
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        // Skip header (baris pertama)
        const rows = jsonData.slice(1);
        
        // Validasi setiap baris
        const validatedRows = [];
        const errors = [];
        let hasValidData = false;

        rows.forEach((row, index) => {
          // Lewati baris kosong (semua kolom kosong)
          const isEmpty = row.every(cell => String(cell).trim() === '');
          if (isEmpty) return;

          const result = validateProductRow(row, index + 2); // +2 karena index mulai 0 dan header di baris 1
          if (result.valid) {
            validatedRows.push(result.data);
            hasValidData = true;
          } else {
            errors.push(...result.errors);
          }
        });

        resolve({
          success: true,
          data: validatedRows,
          errors,
          totalRows: rows.length,
          validCount: validatedRows.length,
          fileName: file.name,
        });
      } catch (err) {
        reject(new Error('Gagal parsing file: ' + err.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Import produk ke database (dengan duplikasi per store)
 * @param {Array} products - Array produk hasil validasi
 * @param {Array} storeIds - Array store_id tujuan (untuk superadmin)
 * @param {string} singleStoreId - store_id tunggal (untuk store admin)
 * @param {Function} onProgress - Callback untuk update progress
 * @returns {Promise} { success: boolean, results: Array, errors: Array }
 */
export async function importProducts(products, storeIds = [], singleStoreId = null, onProgress = null) {
  // Tentukan store tujuan
  let targetStores = [];
  if (singleStoreId) {
    targetStores = [singleStoreId];
  } else if (storeIds && storeIds.length > 0) {
    targetStores = storeIds;
  } else {
    throw new Error('Tidak ada store yang dipilih');
  }

  // Filter produk yang valid
  const validProducts = products.filter(p => p && p.name);
  if (validProducts.length === 0) {
    throw new Error('Tidak ada produk valid untuk diimport');
  }

  const totalRecords = validProducts.length * targetStores.length;
  let processed = 0;
  const results = [];
  const errors = [];

  // Proses per store (untuk batch)
  for (const storeId of targetStores) {
    for (const product of validProducts) {
      try {
        // Sanitasi ulang (jaga-jaga)
        const insertData = {
          store_id: storeId,
          name: sanitizeString(product.name),
          price: product.price,
          description: sanitizeString(product.description || ''),
          stock: product.stock || 0,
          image_url: product.image_url || '',
          is_active: product.is_active !== undefined ? product.is_active : true,
          has_discount: false,
          discount_percentage: 0,
          is_featured: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('products')
          .insert([insertData])
          .select();

        if (error) {
          errors.push({
            product_name: product.name,
            store_id: storeId,
            error: error.message
          });
        } else {
          results.push({
            product_name: product.name,
            store_id: storeId,
            product_id: data[0]?.id,
            success: true
          });
        }

        processed++;
        if (onProgress) {
          onProgress(processed, totalRecords);
        }
      } catch (err) {
        errors.push({
          product_name: product.name,
          store_id: storeId,
          error: err.message
        });
        processed++;
        if (onProgress) {
          onProgress(processed, totalRecords);
        }
      }
    }
  }

  return {
    success: true,
    results,
    errors,
    total: totalRecords,
    successCount: results.length,
    errorCount: errors.length
  };
}