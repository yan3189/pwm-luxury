// services/etaService.js
import { haversineDistance } from './shippingService';
import { supabase } from '../lib/supabase';

// Default constants
const DEFAULT_ROAD_FACTOR = 1.25;
const DEFAULT_TRAFFIC_FACTOR_NORMAL = 1.0;
const DEFAULT_TRAFFIC_FACTOR_PEAK = 1.5;
const DEFAULT_SPEED_NORMAL = 25; // km/h
const DEFAULT_SPEED_PEAK = 15; // km/h

/**
 * Check if current time is peak hour (07:00-09:00 or 16:00-19:00 local time)
 */
function isPeakHour() {
  const now = new Date();
  const hour = now.getHours();
  return (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
}

/**
 * Get calibrated road factor from distance_cache for a given store and address
 */
export async function getCalibratedRoadFactor(storeId, addressId) {
  const { data, error } = await supabase
    .from('distance_cache')
    .select('distance_meters, duration_seconds')
    .eq('store_id', storeId)
    .eq('address_id', addressId)
    .maybeSingle();
  
  if (error || !data) return DEFAULT_ROAD_FACTOR;
  
  // Haversine distance for the same pair (we need store coordinates and address coordinates)
  // But we don't have coordinates here; we can compute later if needed.
  // For simplicity, return default if not available.
  // Alternatively, we can store haversine distance in the cache as well.
  // Here we'll just return default.
  return DEFAULT_ROAD_FACTOR;
}

/**
 * Calculate ETA from current courier location to destination using Haversine + factors
 */
export async function calculateETA(courierLat, courierLng, destLat, destLng, storeId = null, addressId = null) {
  const haversineDist = haversineDistance(courierLat, courierLng, destLat, destLng); // km
  if (haversineDist <= 0) return 0;
  
  // Get road factor from cache if storeId and addressId provided
  let roadFactor = DEFAULT_ROAD_FACTOR;
  if (storeId && addressId) {
    const cachedFactor = await getCalibratedRoadFactor(storeId, addressId);
    if (cachedFactor) roadFactor = cachedFactor;
  }
  
  const isPeak = isPeakHour();
  const trafficFactor = isPeak ? DEFAULT_TRAFFIC_FACTOR_PEAK : DEFAULT_TRAFFIC_FACTOR_NORMAL;
  const speed = isPeak ? DEFAULT_SPEED_PEAK : DEFAULT_SPEED_NORMAL;
  
  // Effective distance = haversine * roadFactor * trafficFactor
  const effectiveDistance = haversineDist * roadFactor * trafficFactor;
  const etaHours = effectiveDistance / speed;
  const etaMinutes = Math.round(etaHours * 60);
  
  return etaMinutes;
}

/**
 * Alternative: Use Google's duration from distance_cache if available, but we want dynamic.
 * This function returns ETA using Haversine + calibration.
 */
export async function getDynamicETA(courierLat, courierLng, destLat, destLng, orderId) {
  // Try to get store_id and address_id from order
  const { data: order } = await supabase
    .from('orders')
    .select('store_id, address_id')
    .eq('id', orderId)
    .single();
  
  const storeId = order?.store_id;
  const addressId = order?.address_id;
  
  return calculateETA(courierLat, courierLng, destLat, destLng, storeId, addressId);
}