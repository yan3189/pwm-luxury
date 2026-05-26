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

// ========== TAMBAHKAN DI AKHIR FILE shippingService.js ==========

/**
 * Hitung jarak menggunakan Google Maps API dengan caching
 * (via API route Vercel)
 */
export async function calculateDistanceWithCache(storeId, addressId) {
  try {
    const response = await fetch('/api/shipping/calculate-distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, addressId })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API call failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Distance calculation error:', error);
    return null;
  }
}

/**
 * Dapatkan ongkir dengan prioritas: cache → Google Maps → Haversine (fallback)
 */
export async function getShippingCostWithCache(storeId, addressId) {
  // 1. Coba pakai Google Maps API + cache
  const result = await calculateDistanceWithCache(storeId, addressId);
  
  if (result && result.success) {
    return {
      cost: result.shippingCost,
      distanceKm: result.distanceKm,
      durationMinutes: result.durationMinutes,
      cached: result.cached,
      source: 'google_maps'
    };
  }
  
  // 2. Fallback ke Haversine calculation (yang sudah ada)
  console.log('Falling back to Haversine calculation');
  try {
    const storeCoords = await getStoreCoordinates(storeId);
    const addressCoords = await getAddressCoordinates(addressId);
    
    if (storeCoords && addressCoords) {
      const distance = haversineDistance(
        storeCoords.lat, storeCoords.lng,
        addressCoords.lat, addressCoords.lng
      );
      const settings = await getStoreShippingSettings(storeId);
      const cost = calculateShippingCost(distance, settings);
      
      return {
        cost: cost,
        distanceKm: distance,
        durationMinutes: Math.round(distance * 2), // estimasi kasar
        cached: false,
        source: 'haversine'
      };
    }
  } catch (err) {
    console.error('Haversine fallback failed:', err);
  }
  
  return null;
}

/**
 * Ambil koordinat alamat member (untuk fallback)
 */
async function getAddressCoordinates(addressId) {
  const { data, error } = await supabase
    .from('member_addresses')
    .select('latitude, longitude')
    .eq('id', addressId)
    .single();
  
  if (error || !data) return null;
  return { lat: data.latitude, lng: data.longitude };
}