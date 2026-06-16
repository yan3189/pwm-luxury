// ============================================================
// FILE: src/services/stockService.js
// Service untuk manajemen stok (CRUD, audit, export)
// ============================================================

import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

/**
 * Ambil semua produk di store tertentu
 * @param {string} storeId - ID store
 */
export async function getProducts(storeId) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      price,
      stock,
      image_url,
      category_id,
      master_categories (name)
    `)
    .eq('store_id', storeId)
    .order('name', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

/**
 * Ambil detail stok produk tertentu
 * @param {string} productId - ID produk
 */
export async function getProductStock(productId) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, stock, store_id')
    .eq('id', productId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update stok manual (tambah/kurangi)
 * @param {Object} params
 * @param {string} params.productId - ID produk
 * @param {string} params.storeId - ID store
 * @param {number} params.adjustment - Nilai perubahan (+ untuk tambah, - untuk kurang)
 * @param {string} params.reason - Alasan: 'restock', 'offline_sale', 'return', 'adjustment'
 * @param {string} params.note - Catatan opsional
 * @param {string} params.adminId - ID admin yang melakukan perubahan
 */
export async function updateStockManual({
  productId,
  storeId,
  adjustment,
  reason,
  note = '',
  adminId
}) {
  // 1. Ambil stok dan nama produk saat ini
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock, name')  // ← TAMBAHKAN 'name'
    .eq('id', productId)
    .single();
  
  if (fetchError) throw fetchError;
  
  const oldStock = product.stock || 0;
  const newStock = oldStock + adjustment;
  const productName = product.name;  // ← SIMPAN NAMA
  
  // 2. Validasi stok tidak negatif
  if (newStock < 0) {
    throw new Error('Stok tidak boleh negatif!');
  }
  
  // 3. Update stok
  const { error: updateError } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId);
  
  if (updateError) throw updateError;
  
  // 4. Catat audit trail
  const { error: logError } = await supabase
    .from('stock_adjustments')
    .insert({
      product_id: productId,
      store_id: storeId,
      old_stock: oldStock,
      new_stock: newStock,
      adjustment: adjustment,
      reason: reason,
      note: note,
      adjusted_by: adminId
    });
  
  if (logError) throw logError;
  
  return { 
    success: true, 
    oldStock, 
    newStock, 
    adjustment,
    productName  // ← KEMBALIKAN NAMA
  };
}

/**
 * Ambil riwayat perubahan stok (dengan filter)
 * @param {string} storeId - ID store
 * @param {number} limit - Jumlah data (default 50)
 * @param {string} productId - Filter produk (opsional)
 */
export async function getStockHistory(storeId, limit = 50, productId = null) {
  let query = supabase
    .from('stock_adjustments')
    .select(`
      id,
      product_id,
      products (name, price),
      old_stock,
      new_stock,
      adjustment,
      reason,
      note,
      adjusted_by,
      users (full_name, email),
      created_at
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (productId) {
    query = query.eq('product_id', productId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Ambil laporan stok semua produk (untuk export)
 * @param {string} storeId - ID store
 */
export async function getStockReport(storeId) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      price,
      stock,
      image_url,
      created_at,
      updated_at,
      master_categories (name)
    `)
    .eq('store_id', storeId)
    .order('name', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

/**
 * Export laporan stok ke Excel
 * @param {string} storeId - ID store
 * @param {string} storeName - Nama store (untuk nama file)
 */
export async function exportStockReport(storeId, storeName) {
  // 1. Ambil data produk
  const products = await getStockReport(storeId);
  
  // 2. Ambil riwayat 30 hari terakhir
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: history, error: historyError } = await supabase
    .from('stock_adjustments')
    .select(`
      created_at,
      products (name),
      old_stock,
      new_stock,
      adjustment,
      reason,
      note,
      users (full_name)
    `)
    .eq('store_id', storeId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });
  
  if (historyError) throw historyError;
  
  // 3. Buat workbook Excel
  // Sheet 1: Stok Aktual
  const stockData = products.map((p, i) => ({
    'No': i + 1,
    'Nama Produk': p.name,
    'Kategori': p.master_categories?.name || '-',
    'Harga': p.price,
    'Stok': p.stock,
    'Terakhir Update': p.updated_at ? new Date(p.updated_at).toLocaleDateString('id-ID') : '-'
  }));
  
  const ws1 = XLSX.utils.json_to_sheet(stockData);
  
  // Set lebar kolom
  ws1['!cols'] = [
    { wch: 5 },   // No
    { wch: 30 },  // Nama Produk
    { wch: 20 },  // Kategori
    { wch: 15 },  // Harga
    { wch: 10 },  // Stok
    { wch: 15 }   // Terakhir Update
  ];
  
  // Sheet 2: Riwayat Perubahan
  const historyData = (history || []).map(h => ({
    'Tanggal': h.created_at ? new Date(h.created_at).toLocaleString('id-ID') : '-',
    'Produk': h.products?.name || '-',
    'Stok Sebelum': h.old_stock,
    'Stok Sesudah': h.new_stock,
    'Perubahan': h.adjustment,
    'Alasan': h.reason || '-',
    'Admin': h.users?.full_name || '-',
    'Catatan': h.note || '-'
  }));
  
  const ws2 = XLSX.utils.json_to_sheet(historyData);
  ws2['!cols'] = [
    { wch: 20 }, // Tanggal
    { wch: 30 }, // Produk
    { wch: 12 }, // Sebelum
    { wch: 12 }, // Sesudah
    { wch: 10 }, // Perubahan
    { wch: 20 }, // Alasan
    { wch: 20 }, // Admin
    { wch: 25 }  // Catatan
  ];
  
  // Buat workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Stok Aktual');
  XLSX.utils.book_append_sheet(wb, ws2, 'Riwayat Perubahan');
  
  // Generate file
  const fileName = `Laporan_Stok_${storeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Cek apakah produk memiliki stok cukup
 * @param {string} productId - ID produk
 * @param {number} quantity - Jumlah yang diminta
 */
export async function checkStockAvailability(productId, quantity) {
  const { data, error } = await supabase
    .from('products')
    .select('stock, name')
    .eq('id', productId)
    .single();
  
  if (error) throw error;
  
  return {
    available: (data.stock || 0) >= quantity,
    currentStock: data.stock || 0,
    productName: data.name
  };
}