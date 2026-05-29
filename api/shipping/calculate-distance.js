// ============================================================
// API: Hitung Jarak dengan Google Maps Directions API + Caching
// Endpoint: POST /api/shipping/calculate-distance
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function calculateShippingCost(distanceMeters, storeId) {
  const distanceKm = distanceMeters / 1000;
  const { data: settings, error } = await supabase
    .from('store_settings')
    .select('base_shipping_cost, cost_per_km')
    .eq('store_id', storeId)
    .maybeSingle();
  
  if (error || !settings) {
    return Math.ceil(10000 + (distanceKm * 2000));
  }
  return Math.ceil(settings.base_shipping_cost + (distanceKm * settings.cost_per_km));
}

export default async function handler(req, res) {
  // CORS dan method check
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  const { storeId, addressId } = req.body;
  if (!storeId || !addressId) {
    return res.status(400).json({ error: 'storeId and addressId required' });
  }
  
  try {
    // 1. Cek cache
    const { data: cached } = await supabase
      .from('distance_cache')
      .select('distance_meters, duration_seconds, polyline')
      .eq('store_id', storeId)
      .eq('address_id', addressId)
      .maybeSingle();
    
    if (cached) {
      const shippingCost = await calculateShippingCost(cached.distance_meters, storeId);
      return res.status(200).json({
        success: true,
        cached: true,
        distanceMeters: cached.distance_meters,
        distanceKm: cached.distance_meters / 1000,
        durationSeconds: cached.duration_seconds,
        durationMinutes: Math.round(cached.duration_seconds / 60),
        shippingCost,
        polyline: cached.polyline || null
      });
    }
    
    // 2. Ambil koordinat store & address
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('latitude, longitude, name')
      .eq('id', storeId)
      .single();
    if (storeError || !store?.latitude || !store?.longitude) {
      return res.status(404).json({ error: 'Store not found or missing coordinates' });
    }
    
    const { data: address, error: addressError } = await supabase
      .from('member_addresses')
      .select('latitude, longitude, address_text')
      .eq('id', addressId)
      .single();
    if (addressError || !address?.latitude || !address?.longitude) {
      return res.status(404).json({ error: 'Address not found or missing coordinates' });
    }
    
    // 3. Panggil Google Maps Directions API
    const origin = `${store.latitude},${store.longitude}`;
    const destination = `${address.latitude},${address.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const googleRes = await fetch(url);
    const googleData = await googleRes.json();
    
    if (googleData.status !== 'OK') {
      console.error('Google Maps error:', googleData.status, googleData.error_message);
      // Jangan gagalkan request, kembalikan error tapi tetap success=false
      return res.status(200).json({
        success: false,
        error: `Google API error: ${googleData.status}`,
        message: googleData.error_message
      });
    }
    
    const route = googleData.routes[0];
    const leg = route.legs[0];
    const distanceMeters = leg.distance.value;
    const durationSeconds = leg.duration.value;
    const polyline = route.overview_polyline.points;
    
    // 4. Simpan ke cache
    await supabase
      .from('distance_cache')
      .upsert({
        store_id: storeId,
        address_id: addressId,
        distance_meters: distanceMeters,
        duration_seconds: durationSeconds,
        polyline,
        last_calculated_at: new Date().toISOString()
      }, { onConflict: 'store_id, address_id' });
    
    const shippingCost = await calculateShippingCost(distanceMeters, storeId);
    
    return res.status(200).json({
      success: true,
      cached: false,
      distanceMeters,
      distanceKm: distanceMeters / 1000,
      durationSeconds,
      durationMinutes: Math.round(durationSeconds / 60),
      shippingCost,
      polyline,
      originAddress: store.name,
      destinationAddress: address.address_text
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
}