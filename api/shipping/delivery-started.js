import { createClient } from '@supabase/supabase-js';

// Menggunakan Service Role Key agar server dapat meng-update tabel tanpa terhalang RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    console.log('📡 Webhook payload received from Supabase:', payload);

    // Ambil data record baru dan lama dari payload Webhook Supabase
    const record = payload.record || payload.new;
    const oldRecord = payload.old_record || payload.old;

    // Keamanan: Pastikan API ini HANYA mengeksekusi jika status berubah menjadi 'delivering'
    if (record?.status !== 'on_delivery' || oldRecord?.status === 'on_delivery') {
      return res.status(200).json({ message: 'Ignored: Delivery is not transitioning to delivering' });
    }

    const deliveryId = record.id;
    const orderId = record.order_id;

    if (!deliveryId || !orderId) {
      return res.status(400).json({ error: 'Missing delivery_id or order_id in record' });
    }

    // 1. AMBIL KOORDINAT TUJUAN (CUSTOMER) DARI TABEL 'orders'
    const { data: orderData, error: orderErr } = await supabase
      .from('orders')
      .select('shipping_latitude, shipping_longitude, store_id')
      .eq('id', orderId)
      .single();

    if (orderErr || !orderData?.shipping_latitude || !orderData?.shipping_longitude) {
      console.error('❌ Latitude/Longitude tujuan tidak ditemukan di orders:', orderErr);
      return res.status(400).json({ error: 'Destination coordinates not found in order' });
    }

    const destinationLat = parseFloat(orderData.shipping_latitude);
    const destinationLng = parseFloat(orderData.shipping_longitude);

    // 2. AMBIL KOORDINAT TERAKHIR KURIR DARI TABEL 'tracking_points'
    const { data: points, error: pointErr } = await supabase
      .from('tracking_points')
      .select('latitude, longitude')
      .eq('delivery_id', deliveryId)
      .order('recorded_at', { ascending: false })
      .limit(1);

    if (pointErr || !points || points.length === 0) {
      console.error('❌ Lokasi kurir belum ada di tracking_points:', pointErr);
      return res.status(400).json({ error: 'Courier current location not found in tracking_points' });
    }

    const courierLat = parseFloat(points[0].latitude);
    const courierLng = parseFloat(points[0].longitude);

    console.log(`📍 Requesting Google Route: (${courierLat}, ${courierLng}) ➔ (${destinationLat}, ${destinationLng})`);

    // 3. PANGGIL GOOGLE ROUTES API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured in Environment Variables' });
    }

    const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
    const requestBody = {
      origin: { location: { latLng: { latitude: courierLat, longitude: courierLng } } },
      destination: { location: { latLng: { latitude: destinationLat, longitude: destinationLng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
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
      console.error('❌ Google Routes API error:', googleData);
      return res.status(400).json({ error: 'Google API error: no route found' });
    }

    const route = googleData.routes[0];
    const distanceMeters = route.distanceMeters;
    const durationSeconds = parseInt(route.duration.replace('s', ''), 10);
    const polyline = route.polyline.encodedPolyline;

    // 4. SIMPAN HASIL POLYLINE KE TABEL 'delivery_assignments'
    const { error: updateErr } = await supabase
      .from('delivery_assignments')
      .update({
        start_route_polyline: polyline,
        start_distance_meters: distanceMeters,
        start_duration_seconds: durationSeconds
      })
      .eq('id', deliveryId);

    if (updateErr) {
      throw updateErr;
    }

    console.log('✅ Polyline rute berhasil disimpan di database!');

    return res.status(200).json({
      success: true,
      message: 'Route generated and updated successfully',
      distanceMeters,
      durationSeconds,
      polylineLength: polyline?.length
    });

  } catch (err) {
    console.error('❌ Webhook Execution Error:', err);
    return res.status(500).json({ error: err.message });
  }
}