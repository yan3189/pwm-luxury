// ========== FILE: src/services/shippingService.js ==========
// Service untuk perhitungan jarak dan ongkir
import { supabase } from '../lib/supabase'

/**
 * Hitung jarak antara dua koordinat menggunakan rumus Haversine (km)
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * Math.PI / 180
  const R = 6371 // radius bumi dalam km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

/**
 * Hitung ongkir berdasarkan jarak dan setting store
 * setting: { base_shipping_cost, cost_per_km }
 */
export function calculateShippingCost(distanceKm, settings) {
  const base = settings?.base_shipping_cost || 10000 // default 10k
  const perKm = settings?.cost_per_km || 2000 // default 2k/km
  return base + Math.round(distanceKm * perKm)
}

/**
 * Ambil setting ongkir dari store (tabel store_settings)
 */
export async function getStoreShippingSettings(storeId) {
  const { data, error } = await supabase
    .from('store_settings')
    .select('*')
    .eq('store_id', storeId)
    .single()
  if (error && error.code !== 'PGRST116') throw error // not found bukan error
  return data || { base_shipping_cost: 10000, cost_per_km: 2000 }
}

/**
 * Ambil koordinat store
 */
export async function getStoreCoordinates(storeId) {
  const { data, error } = await supabase
    .from('stores')
    .select('latitude, longitude')
    .eq('id', storeId)
    .single()
  if (error) throw error
  return { lat: data.latitude, lng: data.longitude }
}