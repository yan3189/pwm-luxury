// api/shipping/calculate-distance.js
import { createClient } from '@supabase/supabase-js';

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
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { storeId, addressId } = req.body;
  if (!storeId || !addressId) {
    return res.status(400).json({ error: 'storeId and addressId required' });
  }

  try {
    // Cek cache
    const { data: cached } = await supabase
      .from('distance_cache')
      .select('distance_meters, duration_seconds, polyline')
      .eq('store_id', storeId)
      .eq('address_id', addressId)
      .maybeSingle();

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

    // Ambil koordinat
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('latitude, longitude, name')
      .eq('id', storeId)
      .single();
    if (storeErr || !store?.latitude || !store?.longitude) {
      return res.status(404).json({ error: 'Store coordinates missing' });
    }

    const { data: addr, error: addrErr } = await supabase
      .from('member_addresses')
      .select('latitude, longitude, address_text')
      .eq('id', addressId)
      .single();
    if (addrErr || !addr?.latitude || !addr?.longitude) {
      return res.status(404).json({ error: 'Address coordinates missing' });
    }

    // Panggil Google Directions API
    const origin = `${store.latitude},${store.longitude}`;
    const destination = `${addr.latitude},${addr.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const googleRes = await fetch(url);
    const googleData = await googleRes.json();

    if (googleData.status !== 'OK') {
      // Fallback: gunakan Haversine via response, tetapi jangan error
      console.warn('Google API error, fallback to Haversine');
      return res.status(200).json({
        success: false,
        error: 'Google API error, using fallback',
        distanceMeters: null
      });
    }

    const route = googleData.routes[0];
    const leg = route.legs[0];
    const distanceMeters = leg.distance.value;
    const durationSeconds = leg.duration.value;
    const polyline = route.overview_polyline.points;

    // Simpan cache
    await supabase.from('distance_cache').upsert({
      store_id: storeId,
      address_id: addressId,
      distance_meters: distanceMeters,
      duration_seconds: durationSeconds,
      polyline,
      last_calculated_at: new Date().toISOString()
    }, { onConflict: 'store_id, address_id' });

    const shippingCost = await getShippingCost(distanceMeters, storeId);

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
    console.error(err);
    return res.status(200).json({ success: false, error: err.message });
  }
}