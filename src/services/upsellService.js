// ============================================================
// FILE: src/services/upsellService.js
// Service untuk upselling & bonus di halaman checkout
// ============================================================

import { supabase } from '../lib/supabase';

/**
 * Ambil daftar upselling aktif untuk store tertentu
 * @param {string} storeId - ID store
 */
export async function getUpsells(storeId) {
  const { data, error } = await supabase
    .from('checkout_upsells')
    .select(`
      *,
      products (
        id,
        name,
        image_url
      )
    `)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching upsells:', error);
    return [];
  }
  
  return data || [];
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