// ========== FILE: src/services/shippingService.js ==========
import { supabase } from '../lib/supabase'

// Haversine formula: jarak lurus antara dua koordinat (km)
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * Math.PI / 180
  const R = 6371 // radius bumi (km)
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Hitung ongkir berdasarkan jarak dan setting store
export function calculateShippingCost(distanceKm, settings) {
  const base = settings?.base_shipping_cost || 10000
  const perKm = settings?.cost_per_km || 2000
  return base + Math.round(distanceKm * perKm)
}

// Ambil setting ongkir dari store (tabel store_settings)
export async function getStoreShippingSettings(storeId) {
  const { data, error } = await supabase
    .from('store_settings')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle()
  
  if (error && error.code !== 'PGRST116') throw error
  return data || { base_shipping_cost: 10000, cost_per_km: 2000 }
}

// Update setting ongkir store
export async function updateStoreShippingSettings(storeId, baseCost, costPerKm) {
  // Cek apakah sudah ada
  const existing = await getStoreShippingSettings(storeId)
  
  if (existing.id) {
    // Update
    const { error } = await supabase
      .from('store_settings')
      .update({ 
        base_shipping_cost: baseCost, 
        cost_per_km: costPerKm,
        updated_at: new Date().toISOString()
      })
      .eq('store_id', storeId)
    if (error) throw error
  } else {
    // Insert baru
    const { error } = await supabase
      .from('store_settings')
      .insert([{ 
        store_id: storeId, 
        base_shipping_cost: baseCost, 
        cost_per_km: costPerKm 
      }])
    if (error) throw error
  }
  return true
}

// Ambil koordinat store
export async function getStoreCoordinates(storeId) {
  const { data, error } = await supabase
    .from('stores')
    .select('latitude, longitude')
    .eq('id', storeId)
    .single()
  if (error) throw error
  return { lat: data.latitude, lng: data.longitude }
}