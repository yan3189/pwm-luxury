// ============================================================
// FILE: src/services/upsellService.js
// Service untuk upselling & bonus di halaman checkout
// ============================================================

import { supabase } from '../lib/supabase';

/**
 * Ambil produk yang ditandai sebagai upselling (dari tabel products)
 * Menggunakan field `is_upsell` atau label khusus
 */
export async function getUpsells(storeId) {
  // Ambil produk dengan is_upsell = true (atau menggunakan label)
  const { data, error } = await supabase
    .from('products')
    .select(`
      id as product_id,
      name as title,
      description,
      price,
      image_url,
      stock,
      is_featured,
      has_discount,
      discount_percentage,
      store_id
    `)
    .eq('store_id', storeId)
    .eq('is_upsell', true) // ← TAMBAHKAN KOLOM INI DI DATABASE
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching upsell products:', error);
    return [];
  }
  
  // Format agar sesuai dengan struktur yang dibutuhkan CheckoutPage
  return (data || []).map(item => ({
    product_id: item.product_id,
    title: item.title,
    description: item.description || '',
    price: item.price,
    image_url: item.image_url,
    // Untuk konsistensi dengan struktur lama
    products: {
      name: item.title,
      image_url: item.image_url
    }
  }));
}

/**
 * Ambil daftar bonus aktif untuk store tertentu
 * @param {string} storeId - ID store
 */
export async function getBonuses(storeId) {
  const { data, error } = await supabase
    .from('checkout_bonuses')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching bonuses:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Ambil detail upselling berdasarkan ID
 * @param {string} upsellId - ID upselling
 */
export async function getUpsellById(upsellId) {
  const { data, error } = await supabase
    .from('checkout_upsells')
    .select('*')
    .eq('id', upsellId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Admin: Tambah upselling baru
 */
export async function createUpsell(data) {
  const { error } = await supabase
    .from('checkout_upsells')
    .insert([{
      store_id: data.store_id,
      product_id: data.product_id || null,
      title: data.title,
      description: data.description || '',
      price: data.price,
      display_order: data.display_order || 0,
      is_active: data.is_active !== undefined ? data.is_active : true
    }]);
  
  if (error) throw error;
  return { success: true };
}

/**
 * Admin: Update upselling
 */
export async function updateUpsell(id, data) {
  const { error } = await supabase
    .from('checkout_upsells')
    .update({
      product_id: data.product_id || null,
      title: data.title,
      description: data.description || '',
      price: data.price,
      display_order: data.display_order || 0,
      is_active: data.is_active !== undefined ? data.is_active : true,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

/**
 * Admin: Hapus upselling
 */
export async function deleteUpsell(id) {
  const { error } = await supabase
    .from('checkout_upsells')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

/**
 * Admin: Toggle status upselling
 */
export async function toggleUpsell(id) {
  const { data: current } = await supabase
    .from('checkout_upsells')
    .select('is_active')
    .eq('id', id)
    .single();
  
  if (!current) throw new Error('Upsell not found');
  
  const { error } = await supabase
    .from('checkout_upsells')
    .update({ 
      is_active: !current.is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  
  if (error) throw error;
  return { success: true, is_active: !current.is_active };
}