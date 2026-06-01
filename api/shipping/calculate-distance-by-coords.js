// api/shipping/calculate-distance-by-coords.js
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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { storeId, lat, lng } = req.body;
    if (!storeId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'storeId, lat, lng required' });
    }

    // Ambil koordinat store
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('latitude, longitude, name')
      .eq('id', storeId)
      .single();
    
    if (storeErr || !store?.latitude || !store?.longitude) {
      return res.status(404).json({ error: 'Store coordinates missing' });
    }

    // Panggil Google Routes API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
    const requestBody = {
      origin: { location: { latLng: { latitude: store.latitude, longitude: store.longitude } } },
      destination: { location: { latLng: { latitude: lat, longitude: lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      routeModifiers: { avoidTolls: false, avoidHighways: false, avoidFerries: false },
      languageCode: "id-ID",
      units: "METRIC"
    };

    const googleRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline'
      },
      body: JSON.stringify(requestBody)
    });

    const googleData = await googleRes.json();
    
    if (!googleData.routes || googleData.routes.length === 0) {
      console.error('Google Routes API error:', googleData);
      return res.status(200).json({
        success: false,
        error: 'Google API error: no routes',
        message: googleData.error?.message || 'Unknown error'
      });
    }

    const route = googleData.routes[0];
    const distanceMeters = route.distanceMeters;
    const durationSeconds = parseInt(route.duration.replace('s', ''), 10);
    const polyline = route.polyline.encodedPolyline;

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
      destinationAddress: `Alamat (${lat}, ${lng})`
    });
    
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}