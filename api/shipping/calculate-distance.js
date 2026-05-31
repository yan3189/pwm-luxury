// api/shipping/calculate-distance.js
import { createClient } from '@supabase/supabase-js';

// Debug: log environment variables (jangan di production)
console.log('=== API LOADED ===');
console.log('VITE_SUPABASE_URL exists:', !!process.env.VITE_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('GOOGLE_MAPS_API_KEY exists:', !!process.env.GOOGLE_MAPS_API_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getShippingCost(distanceMeters, storeId) {
  const distanceKm = distanceMeters / 1000;
  const { data: settings } = await supabase
    .from('store_settings')
    .select('base_shipping_cost, cost_per_km')
    .eq('store_id', storeId)
    .maybeSingle();
  const base = settings?.base_shipping_cost || 10000;
  const perKm = settings?.cost_per_km || 2000;
  return Math.ceil(base + distanceKm * perKm);
}

export default async function handler(req, res) {
  console.log('=== HANDLER CALLED ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { storeId, addressId } = req.body;
    console.log('Request body:', { storeId, addressId });
    
    if (!storeId || !addressId) {
      return res.status(400).json({ error: 'storeId and addressId required' });
    }

    // Cek cache
    console.log('Checking cache...');
    const { data: cached, error: cacheError } = await supabase
      .from('distance_cache')
      .select('distance_meters, duration_seconds, polyline')
      .eq('store_id', storeId)
      .eq('address_id', addressId)
      .maybeSingle();
    
    if (cacheError) {
      console.error('Cache error:', cacheError);
    }
    
    console.log('Cache result:', cached ? 'HIT' : 'MISS');

    if (cached) {
      const shippingCost = await getShippingCost(cached.distance_meters, storeId);
      return res.status(200).json({
        success: true,
        cached: true,
        distanceMeters: cached.distance_meters,
        distanceKm: cached.distance_meters / 1000,
        durationSeconds: cached.duration_seconds,
        durationMinutes: Math.round(cached.duration_seconds / 60),
        shippingCost,
        polyline: cached.polyline
      });
    }

    // Ambil koordinat store
    console.log('Fetching store coordinates...');
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('latitude, longitude, name')
      .eq('id', storeId)
      .single();
    
    if (storeErr) {
      console.error('Store error:', storeErr);
      return res.status(404).json({ error: 'Store not found', details: storeErr.message });
    }
    
    if (!store?.latitude || !store?.longitude) {
      console.error('Store missing coordinates:', store);
      return res.status(404).json({ error: 'Store coordinates missing' });
    }
    console.log('Store coordinates:', store.latitude, store.longitude);

    // Ambil koordinat alamat
    console.log('Fetching address coordinates...');
    const { data: addr, error: addrErr } = await supabase
      .from('member_addresses')
      .select('latitude, longitude, address_text')
      .eq('id', addressId)
      .single();
    
    if (addrErr) {
      console.error('Address error:', addrErr);
      return res.status(404).json({ error: 'Address not found', details: addrErr.message });
    }
    
    if (!addr?.latitude || !addr?.longitude) {
      console.error('Address missing coordinates:', addr);
      return res.status(404).json({ error: 'Address coordinates missing' });
    }
    console.log('Address coordinates:', addr.latitude, addr.longitude);

    // Panggil Google Directions API
    const origin = `${store.latitude},${store.longitude}`;
    const destination = `${addr.latitude},${addr.longitude}`;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY is missing!');
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }
    
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}`;
    console.log('Calling Google Maps API...');
    
    const googleRes = await fetch(url);
    const googleData = await googleRes.json();
    console.log('Google API status:', googleData.status);
    
    if (googleData.status !== 'OK') {
      console.error('Google API error:', googleData.status, googleData.error_message);
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
    
    console.log(`Distance: ${distanceMeters}m, Duration: ${durationSeconds}s`);

    // Simpan cache (dengan error handling yang lebih baik)
console.log('Saving to cache:', { storeId, addressId, distanceMeters, durationSeconds });
const { data: upsertData, error: upsertError } = await supabase
  .from('distance_cache')
  .upsert({
    store_id: storeId,
    address_id: addressId,
    distance_meters: distanceMeters,
    duration_seconds: durationSeconds,
    polyline: polyline,
    last_calculated_at: new Date().toISOString()
  }, { 
    onConflict: 'store_id, address_id',
    ignoreDuplicates: false 
  });

if (upsertError) {
  console.error('Failed to save to cache:', JSON.stringify(upsertError, null, 2));
} else {
  console.log('Cache saved successfully:', upsertData);
}

    const shippingCost = await getShippingCost(distanceMeters, storeId);
    console.log('Shipping cost:', shippingCost);

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
      destinationAddress: addr.address_text
    });
    
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(200).json({ 
      success: false, 
      error: err.message,
      stack: err.stack 
    });
  }
}