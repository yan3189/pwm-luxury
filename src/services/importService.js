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
 */
export function sanitizeString(str) {
  if (!str) return '';
  let cleaned = String(str);
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/javascript:/gi, '');
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  cleaned = cleaned.trim();
  return cleaned;
}

/**
 * Validasi tipe data harga (harus angka integer positif)
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
 */
export function validateStock(value) {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
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
 */
export function validateStatus(value) {
  if (!value) return { valid: true, value: true, error: null };
  const str = String(value).toLowerCase().trim();
  
  if (str === 'aktif' || str === 'active' || str === 'true' || str === '1' || str === 'yes' || str === 'y') {
    return { valid: true, value: true, error: null };
  }
  if (str === 'nonaktif' || str === 'tidak aktif' || str === 'inactive' || str === 'false' || str === '0' || str === 'no' || str === 'n') {
    return { valid: true, value: false, error: null };
  }
  return { valid: true, value: true, error: null };
}

/**
 * Validasi barcode (harus angka minimal 8 digit)
 */
export function validateBarcode(value) {
  if (!value || String(value).trim() === '') {
    return { valid: true, value: null, error: null }; // Barcode opsional
  }
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) {
    return { valid: false, value: null, error: 'Barcode harus berupa angka' };
  }
  if (str.length < 8) {
    return { valid: false, value: null, error: 'Barcode minimal 8 digit' };
  }
  return { valid: true, value: str, error: null };
}

/**
 * Validasi product code (jika diisi)
 */
export function validateProductCode(value) {
  if (!value || String(value).trim() === '') {
    return { valid: true, value: null, error: null }; // Product code opsional (akan auto-generate)
  }
  const str = String(value).trim();
  if (str.length < 3) {
    return { valid: false, value: null, error: 'Kode Produk minimal 3 karakter' };
  }
  if (/\s/.test(str)) {
    return { valid: false, value: null, error: 'Kode Produk tidak boleh mengandung spasi' };
  }
  return { valid: true, value: str, error: null };
}

/**
 * Cari kategori berdasarkan nama (case insensitive)
 */
export async function findCategoryByName(categoryName) {
  if (!categoryName) return null;
  const { data, error } = await supabase
    .from('master_categories')
    .select('id, name, initial')
    .ilike('name', categoryName.trim())
    .maybeSingle();
  
  if (error) {
    console.error('Error finding category:', error);
    return null;
  }
  return data;
}

/**
 * Cek apakah product code sudah ada di store
 */
export async function checkProductCodeExists(storeId, productCode) {
  if (!productCode) return false;
  const { data, error } = await supabase
    .from('products')
    .select('id, product_code')
    .eq('store_id', storeId)
    .eq('product_code', productCode)
    .maybeSingle();
  
  if (error) {
    console.error('Error checking product code:', error);
    return false;
  }
  return !!data;
}

/**
 * Dapatkan store initial (dengan fallback)
 */
export async function getStoreInitial(storeId) {
  if (!storeId) {
    console.warn('⚠️ storeId is null, using fallback STR');
    return 'STR';
  }

  try {
    const { data, error } = await supabase
      .from('stores')
      .select('name, initial')
      .eq('id', storeId)
      .single();

    if (error) {
      console.error('❌ Error fetching store initial:', error);
      return 'STR';
    }

    // Jika initial ada dan tidak kosong
    if (data?.initial && data.initial.trim() !== '') {
      const initial = data.initial.toUpperCase().trim();
      console.log(`✅ Store initial from database: ${initial}`);
      return initial;
    }

    // Fallback: 3 huruf pertama nama store
    const name = data?.name || 'Store';
    const fallback = name.substring(0, 3).toUpperCase();
    console.log(`⚠️ Store initial not set, using fallback from name: ${fallback}`);
    
    // Opsional: update database dengan fallback
    if (data?.id) {
      await supabase
        .from('stores')
        .update({ initial: fallback })
        .eq('id', data.id);
      console.log(`✅ Updated store initial to: ${fallback}`);
    }
    
    return fallback;

  } catch (err) {
    console.error('❌ Unexpected error in getStoreInitial:', err);
    return 'STR';
  }
}

/**
 * Generate product code auto
 */
export async function generateProductCode(storeId, categoryId = null) {
  // 1. Dapatkan initial store
  const storeInitial = await getStoreInitial(storeId);
  console.log(`🔑 Store initial: ${storeInitial}`);

  // 2. Dapatkan initial kategori
  let categoryInitial = 'GEN';
  if (categoryId) {
    try {
      const { data, error } = await supabase
        .from('master_categories')
        .select('name, initial')
        .eq('id', categoryId)
        .single();

      if (!error && data) {
        if (data.initial && data.initial.trim() !== '') {
          categoryInitial = data.initial.toUpperCase().trim();
        } else {
          categoryInitial = data.name.substring(0, 3).toUpperCase();
        }
      }
    } catch (err) {
      console.error('Error fetching category initial:', err);
    }
  }
  console.log(`🔑 Category initial: ${categoryInitial}`);

  // 3. Hitung total produk di store ini
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId);

  if (error) {
    console.error('Error counting products:', error);
  }

  const nextNumber = (count || 0) + 1;
  const seq = String(nextNumber).padStart(4, '0');
  
  const productCode = `${storeInitial}-${categoryInitial}-${seq}`;
  console.log(`✅ Generated product code: ${productCode}`);
  
  return productCode;
}

/**
 * Validasi produk dengan header (lengkap dengan kategori, barcode, product code)
 */
export async function validateProductRowWithHeaders({ 
  nameRaw, priceRaw, descRaw, stockRaw, imageRaw, statusRaw, 
  categoryRaw, barcodeRaw, productCodeRaw, rowIndex, storeId 
}) {
  const errors = [];
  let categoryId = null;
  let categoryName = null;

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

  // 7. Kategori (cari di master_categories)
  if (categoryRaw) {
    const categoryNameClean = sanitizeString(categoryRaw);
    if (categoryNameClean) {
      const category = await findCategoryByName(categoryNameClean);
      if (category) {
        categoryId = category.id;
        categoryName = category.name;
      } else {
        errors.push(`Baris ${rowIndex}: Kategori "${categoryNameClean}" tidak ditemukan di database`);
      }
    }
  }

  // 8. Barcode (opsional)
  const barcodeResult = validateBarcode(barcodeRaw);
  if (!barcodeResult.valid) {
    errors.push(`Baris ${rowIndex}: ${barcodeResult.error}`);
  }

  // 9. Product Code (opsional)
  let productCode = null;
const codeResult = validateProductCode(productCodeRaw);

if (!codeResult.valid) {
  errors.push(`Baris ${rowIndex}: ${codeResult.error}`);
} else if (codeResult.value) {
  // Jika product code diisi manual
  if (storeId) {
    const exists = await checkProductCodeExists(storeId, codeResult.value);
    if (exists) {
      errors.push(`Baris ${rowIndex}: Kode Produk "${codeResult.value}" sudah digunakan di store ini`);
    } else {
      productCode = codeResult.value;
    }
  } else {
    // StoreId null (super admin multi-store), simpan dulu
    productCode = codeResult.value;
  }
}

// 🔥 Jika product code KOSONG atau masih placeholder
if (!productCode) {
  if (storeId) {
    // ✅ STORE ADMIN: LANGSUNG GENERATE
    console.log(`🔍 Generating product code for store admin: ${storeId}`);
    productCode = await generateProductCode(storeId, categoryId);
    
    // Cek duplikat hasil generate
    let isUnique = false;
    let attempts = 0;
    let generatedCode = productCode;
    
    while (!isUnique && attempts < 10) {
      const exists = await checkProductCodeExists(storeId, generatedCode);
      if (!exists) {
        isUnique = true;
      } else {
        attempts++;
        const parts = generatedCode.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        const newNum = num + 1;
        parts[parts.length - 1] = String(newNum).padStart(4, '0');
        generatedCode = parts.join('-');
      }
    }
    productCode = generatedCode;
    console.log(`✅ Generated product code: ${productCode}`);
    
  } else {
    // SUPER ADMIN MULTI-STORE: BUAT PLACEHOLDER
    productCode = `AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    console.log(`🔍 Created placeholder for super admin: ${productCode}`);
  }
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
      is_active: statusResult.value !== undefined ? statusResult.value : true,
      category_id: categoryId,
      category_name: categoryName,
      barcode: barcodeResult.value,
      product_code: productCode,
      has_discount: false,
      discount_percentage: 0,
      is_featured: false,
    },
    errors: []
  };
}

/**
 * Parse file Excel dan validasi semua baris
 */
export async function parseExcelFile(file, storeId = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

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

        // Cari nama kolom (case insensitive)
        const headers = Object.keys(jsonData[0] || {});
        const findColumn = (possibleNames) => {
          for (const name of possibleNames) {
            const found = headers.find(h => h.toLowerCase().trim() === name.toLowerCase().trim());
            if (found) return found;
          }
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
        const categoryCol = findColumn(['Kategori', 'kategori', 'category']);
        const barcodeCol = findColumn(['Barcode', 'barcode']);
        const productCodeCol = findColumn(['Kode Produk', 'kode produk', 'product_code', 'product code']);

        console.log('📊 Column mapping:', { nameCol, priceCol, descCol, stockCol, imageCol, statusCol, categoryCol, barcodeCol, productCodeCol });

        if (!nameCol) {
          resolve({
            success: false,
            data: [],
            errors: ['Kolom "Nama Produk" tidak ditemukan. Pastikan header sesuai dengan template.'],
            totalRows: 0,
            validCount: 0,
            fileName: file.name,
          });
          return;
        }

        const validatedRows = [];
        const errors = [];
        let rowIndex = 2;

        for (const row of jsonData) {
          const nameRaw = nameCol ? row[nameCol] : '';
          const priceRaw = priceCol ? row[priceCol] : 0;
          const descRaw = descCol ? row[descCol] : '';
          const stockRaw = stockCol ? row[stockCol] : 0;
          const imageRaw = imageCol ? row[imageCol] : '';
          const statusRaw = statusCol ? row[statusCol] : 'aktif';
          const categoryRaw = categoryCol ? row[categoryCol] : '';
          const barcodeRaw = barcodeCol ? row[barcodeCol] : '';
          const productCodeRaw = productCodeCol ? row[productCodeCol] : '';

          const isEmpty = !nameRaw && !priceRaw && !descRaw && !stockRaw;
          if (isEmpty) {
            rowIndex++;
            continue;
          }

          const result = await validateProductRowWithHeaders({
            nameRaw,
            priceRaw,
            descRaw,
            stockRaw,
            imageRaw,
            statusRaw,
            categoryRaw,
            barcodeRaw,
            productCodeRaw,
            rowIndex,
            storeId
          });

          if (result.valid) {
            validatedRows.push(result.data);
          } else {
            errors.push(...result.errors);
          }

          rowIndex++;
        }

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
 * Cek apakah produk sudah ada di store tertentu
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
 * Import produk ke database (dengan duplikasi per store)
 */
export async function importProducts(products, storeIds = [], singleStoreId = null, onProgress = null, skipDuplicates = false) {
  let targetStores = [];
  if (singleStoreId) {
    targetStores = [singleStoreId];
  } else if (storeIds && storeIds.length > 0) {
    targetStores = storeIds;
  } else {
    throw new Error('Tidak ada store yang dipilih');
  }

  console.log(`🔍 Importing ${products.length} products to ${targetStores.length} stores`);

  const validProducts = products.filter(p => p && p.name);
  if (validProducts.length === 0) {
    throw new Error('Tidak ada produk valid untuk diimport');
  }

  const totalRecords = validProducts.length * targetStores.length;
  let processed = 0;
  const results = [];
  const errors = [];
  const duplicates = [];

  for (const storeId of targetStores) {
    console.log(`🔍 Processing store: ${storeId}`);
    
    // ✅ Ambil semua produk yang sudah ada di store ini (untuk cek duplikat nama)
    const productNames = validProducts.map(p => p.name);
    const { data: existingProducts } = await supabase
      .from('products')
      .select('name, barcode, product_code')
      .eq('store_id', storeId)
      .in('name', productNames);
    
    // Buat Set untuk pengecekan cepat
    const existingNames = new Set(existingProducts?.map(p => p.name.toLowerCase()) || []);
    const existingBarcodes = new Set(existingProducts?.map(p => p.barcode).filter(b => b) || []);
    const existingCodes = new Set(existingProducts?.map(p => p.product_code).filter(c => c) || []);

    for (const product of validProducts) {
      try {
        // ✅ CEK DUPLIKAT NAMA (case insensitive)
        if (!skipDuplicates) {
          if (existingNames.has(product.name.toLowerCase())) {
            duplicates.push({
              product_name: product.name,
              store_id: storeId,
              message: 'Produk dengan nama yang sama sudah ada di store ini'
            });
            processed++;
            if (onProgress) onProgress(processed, totalRecords);
            continue;
          }
        }

        // ✅ CEK DUPLIKAT BARCODE (jika diisi)
        if (product.barcode && existingBarcodes.has(product.barcode)) {
          duplicates.push({
            product_name: product.name,
            store_id: storeId,
            message: `Barcode "${product.barcode}" sudah digunakan di store ini`
          });
          processed++;
          if (onProgress) onProgress(processed, totalRecords);
          continue;
        }

        // ✅ CEK DUPLIKAT PRODUCT CODE
        let finalProductCode = product.product_code;
        
        // Jika product code adalah placeholder, generate ulang
        if (finalProductCode && finalProductCode.startsWith('AUTO-')) {
          console.log(`🔄 Regenerating product code for ${product.name} in store ${storeId}`);
          const categoryId = product.category_id || null;
          finalProductCode = await generateProductCode(storeId, categoryId);
          
          // Cek duplikat hasil generate
          let isUnique = false;
          let attempts = 0;
          while (!isUnique && attempts < 10) {
            if (!existingCodes.has(finalProductCode)) {
              isUnique = true;
            } else {
              attempts++;
              const parts = finalProductCode.split('-');
              const lastPart = parts[parts.length - 1];
              const num = parseInt(lastPart, 10);
              const newNum = num + 1;
              parts[parts.length - 1] = String(newNum).padStart(4, '0');
              finalProductCode = parts.join('-');
            }
          }
          console.log(`✅ Regenerated product code: ${finalProductCode}`);
          
        } else if (finalProductCode) {
          // Cek duplikat product code yang diisi manual
          if (existingCodes.has(finalProductCode)) {
            duplicates.push({
              product_name: product.name,
              store_id: storeId,
              message: `Kode Produk "${finalProductCode}" sudah digunakan di store ini`
            });
            processed++;
            if (onProgress) onProgress(processed, totalRecords);
            continue;
          }
        } else {
          // Jika product code kosong, generate
          const categoryId = product.category_id || null;
          finalProductCode = await generateProductCode(storeId, categoryId);
        }

        // ✅ INSERT DATA
        const insertData = {
          store_id: storeId,
          name: sanitizeString(product.name),
          price: product.price || 0,
          description: sanitizeString(product.description || ''),
          stock: product.stock || 0,
          image_url: product.image_url || '',
          is_active: product.is_active !== undefined ? product.is_active : true,
          category_id: product.category_id || null,
          barcode: product.barcode || null,
          product_code: finalProductCode,
          has_discount: false,
          discount_percentage: 0,
          is_featured: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
// Di dalam importProducts, setelah insert produk
if (insertData.image_url) {
  const { data: mediaData } = await supabase
    .from('media_library')
    .select('id')
    .eq('file_url', insertData.image_url)
    .maybeSingle();
  
  if (mediaData) {
    await markMediaAsUsed(
      [mediaData.id],
      { type: 'product', id: data[0]?.id, name: insertData.name }
    );
  }
}

        console.log(`📦 Inserting: ${insertData.name} | code: ${insertData.product_code} | store: ${storeId}`);

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
            product_code: data[0]?.product_code,
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
 */
export function generateTemplateData() {
  return [
    {
      'Nama Produk': 'Kopi Arabica',
      'Harga': 45000,
      'Deskripsi': 'Kopi arabica premium',
      'Stok': 10,
      'URL Gambar': 'https://example.com/kopi-arabica.jpg',
      'Status': 'aktif',
      'Kategori': 'Kopi',
      'Barcode': '8991234567890',
      'Kode Produk': 'PWM-KOP-0001'
    },
    {
      'Nama Produk': 'Kopi Robusta',
      'Harga': 35000,
      'Deskripsi': 'Kopi robusta pilihan',
      'Stok': 5,
      'URL Gambar': '',
      'Status': 'NONAKTIF',
      'Kategori': 'Kopi',
      'Barcode': '8991234567891',
      'Kode Produk': ''
    },
    {
      'Nama Produk': 'Teh Hitam',
      'Harga': 25000,
      'Deskripsi': 'Teh hitam premium',
      'Stok': 8,
      'URL Gambar': '',
      'Status': 'nonaktif',
      'Kategori': 'Teh',
      'Barcode': '',
      'Kode Produk': ''
    }
  ];
}