// ============================================================
// API: Hitung Jarak dengan Google Maps Directions API + Caching
// Endpoint: POST /api/shipping/calculate-distance
// Body: { storeId, addressId }
// Output: distance, duration, polyline, shippingCost
// ============================================================

import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase dengan Service Role Key (agar bisa bypass RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fungsi hitung ongkir berdasarkan jarak (meter) dan setting store
async function calculateShippingCost(distanceMeters, storeId) {
  const distanceKm = distanceMeters / 1000;
  
  // Ambil setting ongkir dari store_settings
  const { data: settings, error } = await supabase
    .from('store_settings')
    .select('base_shipping_cost, cost_per_km')
    .eq('store_id', storeId)
    .maybeSingle();
  
  if (error || !settings) {
    // Default jika belum ada setting
    return Math.ceil(10000 + (distanceKm * 2000));
  }
  
  const baseCost = settings.base_shipping_cost || 10000;
  const costPerKm = settings.cost_per_km || 2000;
  
  return Math.ceil(baseCost + (distanceKm * costPerKm));
}

export default async function handler(req, res) {
  // ========== CORS HEADERS ==========
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  console.log('Request method:', req.method);
  console.log('Request body:', req.body);
  

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  const { storeId, addressId } = req.body;
  
  if (!storeId || !addressId) {
    return res.status(400).json({ error: 'storeId and addressId are required' });
  }
  
  try {
    // ========== 1. CEK CACHE ==========
    const { data: cached, error: cacheError } = await supabase
      .from('distance_cache')
      .select('distance_meters, duration_seconds, polyline')
      .eq('store_id', storeId)
      .eq('address_id', addressId)
      .maybeSingle();
    
    if (cached && !cacheError) {
      console.log('Cache HIT untuk store', storeId, 'address', addressId);
      const shippingCost = await calculateShippingCost(cached.distance_meters, storeId);
      
      return res.status(200).json({
        success: true,
        cached: true,
        distanceMeters: cached.distance_meters,
        distanceKm: cached.distance_meters / 1000,
        durationSeconds: cached.duration_seconds,
        durationMinutes: Math.round(cached.duration_seconds / 60),
        shippingCost: shippingCost,
        polyline: cached.polyline || null
      });
    }
    
    console.log('Cache MISS untuk store', storeId, 'address', addressId);
    
    // ========== 2. AMBIL KOORDINAT STORE ==========
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('latitude, longitude, name')
      .eq('id', storeId)
      .single();
    
    if (storeError || !store || !store.latitude || !store.longitude) {
      console.error('Store not found or missing coordinates:', storeError);
      return res.status(404).json({ error: 'Store not found or missing coordinates' });
    }
    
    // ========== 3. AMBIL KOORDINAT ALAMAT ==========
    const { data: address, error: addressError } = await supabase
      .from('member_addresses')
      .select('latitude, longitude, address_text')
      .eq('id', addressId)
      .single();
    
    if (addressError || !address || !address.latitude || !address.longitude) {
      console.error('Address not found or missing coordinates:', addressError);
      return res.status(404).json({ error: 'Address not found or missing coordinates' });
    }
    
    // ========== 4. PANGGIL GOOGLE MAPS DIRECTIONS API ==========
    const origin = `${store.latitude},${store.longitude}`;
    const destination = `${address.latitude},${address.longitude}`;
    
    const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    console.log('Calling Google Maps Directions API...');
    const googleRes = await fetch(googleUrl);
    const googleData = await googleRes.json();
    
    if (googleData.status !== 'OK') {
      console.error('Google Maps API error:', googleData.status, googleData.error_message);
      return res.status(500).json({ 
        error: 'Google Maps API error', 
        status: googleData.status,
        message: googleData.error_message 
      });
    }
    
    const route = googleData.routes[0];
    const leg = route.legs[0];
    const distanceMeters = leg.distance.value;
    const durationSeconds = leg.duration.value;
    const polyline = route.overview_polyline.points; // Encoded polyline dari Google
    
    console.log(`Distance: ${distanceMeters}m, Duration: ${durationSeconds}s`);
    
    // ========== 5. SIMPAN KE CACHE ==========
    const { error: upsertError } = await supabase
      .from('distance_cache')
      .upsert({
        store_id: storeId,
        address_id: addressId,
        distance_meters: distanceMeters,
        duration_seconds: durationSeconds,
        polyline: polyline,
        last_calculated_at: new Date().toISOString()
      }, {
        onConflict: 'store_id, address_id'
      });
    
    if (upsertError) {
      console.error('Failed to save to cache:', upsertError);
      // Tidak perlu return error, tetap lanjut kirim response
    }
    
    // ========== 6. HITUNG ONGKIR ==========
    const shippingCost = await calculateShippingCost(distanceMeters, storeId);
    
    return res.status(200).json({
      success: true,
      cached: false,
      distanceMeters: distanceMeters,
      distanceKm: distanceMeters / 1000,
      durationSeconds: durationSeconds,
      durationMinutes: Math.round(durationSeconds / 60),
      shippingCost: shippingCost,
      polyline: polyline,
      originAddress: store.name,
      destinationAddress: address.address_text
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
// ...
try {
  const googleRes = await fetch(googleUrl);
  const googleData = await googleRes.json();

  if (googleData.status !== 'OK') {
    console.error('Google Maps API error:', googleData.status, googleData.error_message);
    // Jangan langsung return error, tapi kirim response dengan status 200
    // dan flag 'success: false' agar frontend bisa fallback ke Haversine.
    return res.status(200).json({
      success: false,
      error: `Google Maps API error: ${googleData.status}`,
      message: googleData.error_message
    });
  }
  // ... proses selanjutnya
} catch (error) {
    console.error('Error calling Google Maps API:', error);
    return res.status(200).json({
      success: false,
      error: error.message
    });
}
// ...