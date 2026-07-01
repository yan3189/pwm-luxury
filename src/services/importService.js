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
  
  // ✅ Status AKTIF
  if (str === 'aktif' || str === 'active' || str === 'true' || str === '1' || str === 'yes' || str === 'y') {
    return { valid: true, value: true, error: null };
  }
  
  // ✅ Status TIDAK AKTIF
  if (str === 'nonaktif' || str === 'tidak aktif' || str === 'inactive' || str === 'false' || str === '0' || str === 'no' || str === 'n') {
    return { valid: true, value: false, error: null };
  }
  
  // ❌ Jika tidak dikenali, default true dan beri peringatan
  return { valid: true, value: true, error: null };
}

/**
 * Cek apakah produk sudah ada di store tertentu
 * @param {string} storeId - ID store
 * @param {string} productName - Nama produk (case insensitive)
 * @returns {Promise<boolean>} true jika sudah ada
 */
export async function checkProductExists(storeId, productName) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name')
    .eq('store_id', storeId)
    .ilike('name', productName)
    .maybeSingle();

  if (error) {
    console.error('Error checking product:', error);
    return false;
  }
  return !!data;
}

/**
 * Validasi produk dengan header (menggunakan objek, bukan array)
 */
export function validateProductRowWithHeaders({ nameRaw, priceRaw, descRaw, stockRaw, imageRaw, statusRaw, rowIndex }) {
  const errors = [];

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

  // 3. Deskripsi (opsional)
  const description = sanitizeString(descRaw);

  // 4. Stok
  const stockResult = validateStock(stockRaw);
  if (!stockResult.valid) {
    errors.push(`Baris ${rowIndex}: ${stockResult.error}`);
  }

  // 5. URL Gambar (opsional)
  const imageUrl = sanitizeString(imageRaw);

  // 6. Status
  const statusResult = validateStatus(statusRaw);
  if (!statusResult.valid) {
    errors.push(`Baris ${rowIndex}: ${statusResult.error}`);
  }

  if (errors.length > 0) {
    return { valid: false, data: null, errors };
  }

  return {
    valid: true,
    data: {
      name,
      price: priceResult.value,
      description,
      stock: stockResult.value,
      image_url: imageUrl,
      is_active: statusResult.value !== undefined ? statusResult.value : true,
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
        // ✅ PARSE DENGAN HEADER (MENCARI NAMA KOLOM)
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        // Jika tidak ada data
        if (!jsonData || jsonData.length === 0) {
          resolve({
            success: false,
            data: [],
            errors: ['File Excel kosong atau tidak memiliki header yang valid'],
            totalRows: 0,
            validCount: 0,
            fileName: file.name,
          });
          return;
        }

        // Cari nama kolom yang sesuai (case insensitive)
        const headers = Object.keys(jsonData[0] || {});
        const findColumn = (possibleNames) => {
          for (const name of possibleNames) {
            const found = headers.find(h => h.toLowerCase().trim() === name.toLowerCase().trim());
            if (found) return found;
          }
          // Coba cari dengan includes
          for (const name of possibleNames) {
            const found = headers.find(h => h.toLowerCase().trim().includes(name.toLowerCase().trim()));
            if (found) return found;
          }
          return null;
        };

        const nameCol = findColumn(['Nama Produk', 'nama produk', 'nama', 'product name', 'name']);
        const priceCol = findColumn(['Harga', 'harga', 'price']);
        const descCol = findColumn(['Deskripsi', 'deskripsi', 'description']);
        const stockCol = findColumn(['Stok', 'stok', 'stock']);
        const imageCol = findColumn(['URL Gambar', 'url gambar', 'image_url', 'image']);
        const statusCol = findColumn(['Status', 'status', 'is_active', 'active']);

        console.log('📊 Column mapping found:', { nameCol, priceCol, descCol, stockCol, imageCol, statusCol });

        // Validasi apakah kolom wajib ada
        if (!nameCol) {
          resolve({
            success: false,
            data: [],
            errors: ['Kolom "Nama Produk" tidak ditemukan di file Excel. Pastikan header sesuai dengan template.'],
            totalRows: 0,
            validCount: 0,
            fileName: file.name,
          });
          return;
        }

        // Validasi setiap baris
        const validatedRows = [];
        const errors = [];
        let rowIndex = 2; // Baris pertama = header

        jsonData.forEach((row) => {
          // Ambil nilai dari kolom yang ditemukan
          const nameRaw = nameCol ? row[nameCol] : '';
          const priceRaw = priceCol ? row[priceCol] : 0;
          const descRaw = descCol ? row[descCol] : '';
          const stockRaw = stockCol ? row[stockCol] : 0;
          const imageRaw = imageCol ? row[imageCol] : '';
          const statusRaw = statusCol ? row[statusCol] : 'aktif';

          // Lewati baris kosong (semua kolom kosong)
          const isEmpty = !nameRaw && !priceRaw && !descRaw && !stockRaw;
          if (isEmpty) {
            rowIndex++;
            return;
          }

          const result = validateProductRowWithHeaders({
            nameRaw,
            priceRaw,
            descRaw,
            stockRaw,
            imageRaw,
            statusRaw,
            rowIndex
          });

          if (result.valid) {
            validatedRows.push(result.data);
          } else {
            errors.push(...result.errors);
          }

          rowIndex++;
        });

        resolve({
          success: true,
          data: validatedRows,
          errors,
          totalRows: jsonData.length,
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
 * Import produk ke database (dengan duplikasi per store & pengecekan duplikat)
 * @param {Array} products - Array produk hasil validasi
 * @param {Array} storeIds - Array store_id tujuan (untuk superadmin)
 * @param {string} singleStoreId - store_id tunggal (untuk store admin)
 * @param {Function} onProgress - Callback untuk update progress
 * @param {boolean} skipDuplicates - Jika true, lewati pengecekan duplikat
 * @returns {Promise} { success: boolean, results: Array, errors: Array, duplicates: Array }
 */
export async function importProducts(products, storeIds = [], singleStoreId = null, onProgress = null, skipDuplicates = false) {
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
  const duplicates = [];

  // Proses per store
  for (const storeId of targetStores) {
    // Ambil semua nama produk yang sudah ada di store ini (untuk batch check)
    const productNames = validProducts.map(p => p.name);
    const existingProducts = await supabase
      .from('products')
      .select('name')
      .eq('store_id', storeId)
      .in('name', productNames);
    
    const existingNames = new Set(existingProducts.data?.map(p => p.name.toLowerCase()) || []);

    for (const product of validProducts) {
      try {
        // ✅ CEK DUPLIKAT (jika tidak skip)
        if (!skipDuplicates) {
          if (existingNames.has(product.name.toLowerCase())) {
            duplicates.push({
              product_name: product.name,
              store_id: storeId,
              message: 'Produk sudah ada di store ini'
            });
            processed++;
            if (onProgress) onProgress(processed, totalRecords);
            continue;
          }
        }

        // Sanitasi ulang (jaga-jaga)
        const insertData = {
          store_id: storeId,
          name: sanitizeString(product.name),
          price: product.price || 0,
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

        // Log untuk debugging
        console.log(`📦 Inserting product: ${insertData.name} for store ${storeId}, active: ${insertData.is_active}`);

        const { data, error } = await supabase
          .from('products')
          .insert([insertData])
          .select();

        if (error) {
          console.error('❌ Insert error:', error);
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
        console.error('❌ Error processing product:', err);
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
    duplicates,
    total: totalRecords,
    successCount: results.length,
    errorCount: errors.length,
    duplicateCount: duplicates.length
  };
}

/**
 * Generate template Excel untuk download
 * @returns {Array} Array of objects untuk template
 */
export function generateTemplateData() {
  return [
    {
      'Nama Produk': 'Contoh Produk 1',
      'Harga': 50000,
      'Deskripsi': 'Deskripsi produk contoh 1',
      'Stok': 10,
      'URL Gambar': 'https://example.com/image1.jpg',
      'Status': 'aktif'
    },
    {
      'Nama Produk': 'Contoh Produk 2',
      'Harga': 75000,
      'Deskripsi': 'Deskripsi produk contoh 2',
      'Stok': 5,
      'URL Gambar': '',
      'Status': 'aktif'
    },
    {
      'Nama Produk': 'Contoh Produk Nonaktif',
      'Harga': 100000,
      'Deskripsi': 'Produk ini nonaktif',
      'Stok': 0,
      'URL Gambar': '',
      'Status': 'nonaktif'
    }
  ];
}