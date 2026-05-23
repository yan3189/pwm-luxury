// ========== FILE: src/services/categoryService.js ==========
// Service untuk mengelola kategori (master & store)
import { supabase } from '../lib/supabase'

/**
 * Ambil semua master kategori (untuk super admin)
 */
export async function getAllMasterCategories() {
  const { data, error } = await supabase
    .from('master_categories')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

/**
 * Tambah master kategori baru (super admin only)
 */
export async function addMasterCategory(name, sortOrder = 0) {
  const { data, error } = await supabase
    .from('master_categories')
    .insert([{ name, sort_order: sortOrder }])
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Update master kategori
 */
export async function updateMasterCategory(id, updates) {
  const { data, error } = await supabase
    .from('master_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Hapus master kategori (hanya jika tidak ada produk yang menggunakan)
 */
export async function deleteMasterCategory(id) {
  // Cek apakah ada produk yang menggunakan category_id ini
  const { count, error: countError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
  if (countError) throw countError
  if (count > 0) throw new Error('Kategori masih digunakan oleh produk, tidak bisa dihapus')
  
  const { error } = await supabase
    .from('master_categories')
    .delete()
    .eq('id', id)
  if (error) throw error
  return true
}

/**
 * Ambil kategori aktif untuk suatu store (urutan berdasarkan display_order)
 */
export async function getActiveCategoriesForStore(storeId) {
  const { data, error } = await supabase
    .from('store_categories')
    .select(`
      id,
      display_order,
      is_active,
      master_categories (id, name, sort_order)
    `)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) throw error
  return data.map(item => ({
    id: item.master_categories.id,
    name: item.master_categories.name,
    display_order: item.display_order,
    store_category_id: item.id
  }))
}

/**
 * Ambil semua master kategori dengan status aktif/nonaktif untuk store tertentu
 * (digunakan di halaman admin store categories)
 */
export async function getMasterCategoriesWithStoreStatus(storeId) {
  const { data: master, error: masterError } = await supabase
    .from('master_categories')
    .select('*')
    .order('sort_order', { ascending: true })
  if (masterError) throw masterError
  
  // Ambil store_categories untuk store ini
  const { data: storeCats, error: storeError } = await supabase
    .from('store_categories')
    .select('*')
    .eq('store_id', storeId)
  if (storeError) throw storeError
  
  const storeCatMap = new Map()
  storeCats.forEach(sc => {
    storeCatMap.set(sc.category_id, sc)
  })
  
  return master.map(cat => ({
    ...cat,
    is_active: storeCatMap.has(cat.id) ? storeCatMap.get(cat.id).is_active : false,
    display_order: storeCatMap.has(cat.id) ? storeCatMap.get(cat.id).display_order : 999,
    store_category_id: storeCatMap.get(cat.id)?.id || null
  }))
}

/**
 * Simpan pengaturan kategori untuk store (aktif/nonaktif + urutan)
 */
export async function saveStoreCategories(storeId, categories) {
  // categories: array of { category_id, is_active, display_order }
  // Upsert ke store_categories
  const upserts = categories.map(cat => ({
    store_id: storeId,
    category_id: cat.category_id,
    is_active: cat.is_active,
    display_order: cat.display_order
  }))
  
  // Hapus dulu yang tidak ada di list? Atau upsert
  for (const upsert of upserts) {
    const { error } = await supabase
      .from('store_categories')
      .upsert(upsert, { onConflict: 'store_id, category_id' })
    if (error) throw error
  }
  return true
}