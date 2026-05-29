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
  const existing = await getStoreShippingSettings(storeId)
  
  if (existing.id) {
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

// ========== FUNGSI UNTUK DIRECTIONS API (DENGAN POLYLINE) ==========

/**
 * Hitung jarak menggunakan Google Maps Directions API dengan caching
 * (via API route Vercel)
 */
export async function calculateDistanceWithCache(storeId, addressId) {
  try {
    const response = await fetch('/api/shipping/calculate-distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, addressId })
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    if (!data.success) {
      console.warn('API returned error:', data.error, data.message);
      return null;
    }
    return data;
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
      polyline: result.polyline,
      cached: result.cached,
      source: 'google_maps'
    };
  }
  
  // 2. Fallback ke Haversine calculation
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
        durationMinutes: Math.round(distance * 2),
        polyline: null,
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

/**
 * Ambil polyline dari cache untuk ditampilkan di peta tracking
 */
export async function getRoutePolyline(storeId, addressId) {
  const { data, error } = await supabase
    .from('distance_cache')
    .select('polyline')
    .eq('store_id', storeId)
    .eq('address_id', addressId)
    .maybeSingle();
  
  if (error || !data?.polyline) return null;
  return data.polyline;
}

/**
 * Decode Google Maps encoded polyline menjadi array koordinat
 * untuk ditampilkan di Leaflet
 */
export function decodePolyline(encoded) {
  if (!encoded) return [];
  
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}