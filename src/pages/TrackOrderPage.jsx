// ========== FILE: src/pages/TrackOrderPage.jsx ==========
// Halaman untuk non-member melacak pesanan
// Fitur: Detail Pesanan (tab) + Peta Tracking (tab)
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { 
  Package, MapPin, Calendar, CheckCircle, AlertCircle, 
  Truck, Download, ArrowLeft, Upload, MessageCircle, 
  Globe, Map 
} from 'lucide-react';

// ========== IMPORTS UNTUK LEAFLET ==========
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TrackingMap from '../components/TrackingMap';

// Fix untuk marker icon Leaflet di Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ 
  iconUrl: icon, 
  shadowUrl: iconShadow, 
  iconSize: [25, 41], 
  iconAnchor: [12, 41] 
});
L.Marker.prototype.options.icon = DefaultIcon;

// Icon untuk store (kuning)
const storeIcon = L.icon({
  iconUrl: icon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'leaflet-marker-store'
});

// Icon untuk destination (hijau)
const destIcon = L.icon({
  iconUrl: icon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'leaflet-marker-dest'
});

// Icon untuk courier (biru - menggunakan icon yang sama tapi bisa di-css)
const courierIcon = L.icon({
  iconUrl: icon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'leaflet-marker-courier'
});

export default function TrackOrderPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('detail'); // 'detail' atau 'map'
  
  // ========== STATE UNTUK TRACKING ==========
  const [delivery, setDelivery] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [courier, setCourier] = useState(null);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const markerRef = useRef(null);
  const animationRef = useRef(null);
  const mapRef = useRef(null);
  const [routePolyline, setRoutePolyline] = useState([]);

function decodePolyline(encoded) {
  if (!encoded) return [];
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

  useEffect(() => {
    if (id) {
      fetchOrder();
    } else {
      setError('ID pesanan tidak ditemukan di URL');
      setLoading(false);
    }
  }, [id]);

  // ========== FETCH ORDER DATA ==========
  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    
    // Step 1: Ambil order berdasarkan ID
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (orderError || !orderData) {
      console.error('Order error:', orderError);
      setError('Pesanan tidak ditemukan');
      setLoading(false);
      return;
    }
    
    setOrder(orderData);
    
    // Step 2: Ambil store
    if (orderData.store_id) {
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name, slug, bank_name, bank_account_number, bank_account_name, phone, email, alamat, latitude, longitude')
        .eq('id', orderData.store_id)
        .single();
      if (storeData) setStore(storeData);
    }
    // Ambil polyline dari cache
if (store && order && order.shipping_latitude && order.shipping_longitude) {
  // Coba cari address_id (jika ada)
  const addressId = order.address_id;
  if (addressId) {
    const { data: cacheData } = await supabase
      .from('distance_cache')
      .select('polyline')
      .eq('store_id', store.id)
      .eq('address_id', addressId)
      .maybeSingle();
    
    if (cacheData?.polyline) {
      const decoded = decodePolyline(cacheData.polyline);
      setRoutePolyline(decoded);
    }
  }
}

    // Step 3: Ambil items
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);
    setItems(itemsData || []);
    
    // Step 4: Ambil delivery assignment
    if (orderData.delivery_type === 'internal') {
      const { data: deliveryData } = await supabase
        .from('delivery_assignments')
        .select('*, courier:users(id, email, full_name)')
        .eq('order_id', id)
        .maybeSingle();
      
      if (deliveryData) {
        setDelivery(deliveryData);
        if (deliveryData.courier) setCourier(deliveryData.courier);
        
        // Ambil tracking points terbaru
        const { data: points } = await supabase
          .from('tracking_points')
          .select('*')
          .eq('delivery_id', deliveryData.id)
          .order('recorded_at', { ascending: false })
          .limit(1);
        
        if (points && points[0]) {
          setCourierLocation([points[0].latitude, points[0].longitude]);
        }
      }
    }
    
// ========== AMBIL POLYLINE DARI CACHE (GUNAKAN VARIABEL LOKAL) ==========
console.log('🔍 DEBUG: Memeriksa kondisi untuk mengambil polyline');
console.log('storeData:', storeData?.id);
console.log('orderData?.shipping_latitude:', orderData?.shipping_latitude);
console.log('orderData?.address_id:', orderData?.address_id);

if (storeData?.id && orderData?.shipping_latitude && orderData?.shipping_longitude) {
  // Coba cari address_id dari order, atau gunakan shipping_address sebagai fallback
  let addressId = orderData.address_id;
  
  // Jika tidak ada address_id, coba cari di member_addresses berdasarkan alamat teks
  if (!addressId && orderData.shipping_address) {
    console.log('Tidak ada address_id, mencoba mencari berdasarkan shipping_address:', orderData.shipping_address);
    const { data: addrData } = await supabase
      .from('member_addresses')
      .select('id')
      .eq('address_text', orderData.shipping_address)
      .maybeSingle();
    if (addrData) addressId = addrData.id;
  }
  
  if (addressId) {
    console.log('Mengambil polyline untuk store:', storeData.id, 'address:', addressId);
    const { data: cacheData, error: cacheError } = await supabase
      .from('distance_cache')
      .select('polyline')
      .eq('store_id', storeData.id)
      .eq('address_id', addressId)
      .maybeSingle();
    
    if (cacheError) {
      console.error('Error mengambil polyline:', cacheError);
    }
    
    if (cacheData?.polyline) {
      console.log('✅ Polyline ditemukan, panjang:', cacheData.polyline.length);
      setRoutePolyline(cacheData.polyline);
    } else {
      console.log('❌ Polyline tidak ditemukan di cache untuk kombinasi ini');
    }
  } else {
    console.log('❌ Tidak ada address_id yang valid');
  }
} else {
  console.log('❌ Kondisi tidak terpenuhi: storeData atau orderData koordinat tidak lengkap');
  console.log('storeData?.id:', storeData?.id);
  console.log('orderData?.shipping_latitude:', orderData?.shipping_latitude);
  console.log('orderData?.shipping_longitude:', orderData?.shipping_longitude);
}

    setLoading(false);
  };

  // ========== SETUP REALTIME SUBSCRIPTION ==========
  useEffect(() => {
    if (!delivery || !delivery.id) return;
    
    // Subscribe ke broadcast location updates
    const channel = supabase
      .channel(`tracking:${delivery.id}`)
      .on('broadcast', { event: 'location-update' }, (payload) => {
        const { lat, lng, heading, timestamp } = payload.payload;
        
        // Animasi smooth movement
        if (markerRef.current && courierLocation) {
          const startLat = courierLocation[0];
          const startLng = courierLocation[1];
          const endLat = lat;
          const endLng = lng;
          const startTime = Date.now();
          const duration = 3000; // 3 detik animasi
          
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
          
          function animate() {
            const elapsed = Date.now() - startTime;
            const t = Math.min(1, elapsed / duration);
            
            const newLat = startLat + (endLat - startLat) * t;
            const newLng = startLng + (endLng - startLng) * t;
            
            setCourierLocation([newLat, newLng]);
            
            if (t < 1) {
              animationRef.current = requestAnimationFrame(animate);
            } else {
              animationRef.current = null;
            }
          }
          
          animate();
        } else {
          setCourierLocation([lat, lng]);
        }
        
        // Update map center jika diperlukan
        if (mapRef.current && lat && lng) {
          mapRef.current.setView([lat, lng], 14);
        }
      })
      .subscribe();
    
    setIsTrackingActive(true);
    
    return () => {
      supabase.removeChannel(channel);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setIsTrackingActive(false);
    };
  }, [delivery, courierLocation]);

  // ========== FUNGSI UPLOAD BUKTI ==========
  const handleUploadProof = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file maksimal 2MB');
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${order.order_number}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(fileName, file);

    if (uploadError) {
      alert('Gagal upload: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        payment_proof_url: publicUrlData.publicUrl,
        status: 'paid'
      })
      .eq('id', id);

    if (updateError) {
      alert('Gagal menyimpan bukti: ' + updateError.message);
    } else {
      alert('Bukti transfer berhasil diupload! Admin akan segera memverifikasi.');
      fetchOrder();
    }
    setUploading(false);
  };

  // ========== FUNGSI GET STATUS BADGE ==========
  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-500',
      paid: 'bg-blue-500/20 text-blue-400',
      processing: 'bg-purple-500/20 text-purple-400',
      shipping: 'bg-orange-500/20 text-orange-400',
      delivered: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400'
    };
    const labels = {
      pending: 'Menunggu Pembayaran',
      paid: 'Dibayar (Menunggu Konfirmasi)',
      processing: 'Diproses',
      shipping: 'Dikirim',
      delivered: 'Selesai',
      cancelled: 'Dibatalkan'
    };
    return <span className={`text-xs px-2 py-1 rounded-full ${colors[status] || colors.pending}`}>{labels[status] || status}</span>;
  };

  // ========== RENDER KOORDINAT UNTUK PETA ==========
  const storeLocation = store?.latitude && store?.longitude 
    ? [store.latitude, store.longitude] 
    : null;
  const destination = order?.shipping_latitude && order?.shipping_longitude 
    ? [order.shipping_latitude, order.shipping_longitude] 
    : null;
  const hasValidCoordinates = (storeLocation || destination) && courierLocation;

  // ========== COPY LINK ==========
  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link pesanan disalin!');
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  
  if (error) return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="flex flex-col items-center justify-center p-8 pt-32">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-display mb-2">Pesanan Tidak Ditemukan</h1>
        <p className="text-gray-400 mb-4 text-center">{error}</p>
        <p className="text-gray-500 text-sm mb-4">ID: {id}</p>
        <Link to="/" className="bg-yellow-500 text-black px-4 py-2 rounded-full">Kembali ke Beranda</Link>
      </div>
    </div>
  );
  
  if (!order) return null;

  const canUpload = order.status === 'pending' && !order.payment_proof_url;
  const canTrack = delivery && (delivery.status === 'on_delivery' || delivery.status === 'picking_up');

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-24">
        <Link to="/" className="inline-flex items-center gap-1 text-yellow-500 mb-6 hover:gap-2 transition">
          <ArrowLeft size={16} /> Kembali ke Beranda
        </Link>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          {/* Header */}
          <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-display">Pesanan #{order.order_number}</h1>
              <p className="text-gray-400">{store?.name}</p>
              <p className="text-xs text-gray-500 mt-1">ID: {order.id}</p>
            </div>
            {getStatusBadge(order.status)}
          </div>

          {/* ========== TAB NAVIGATION ========== */}
          <div className="flex border-b border-white/10 mt-4 mb-6">
            <button
              onClick={() => setActiveTab('detail')}
              className={`py-2 px-4 font-medium text-sm transition-all relative ${
                activeTab === 'detail' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Package size={14} className="inline mr-1" /> Detail Pesanan
              {activeTab === 'detail' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
            </button>
            
            {(canTrack || hasValidCoordinates) && (
              <button
                onClick={() => setActiveTab('map')}
                className={`py-2 px-4 font-medium text-sm transition-all relative ${
                  activeTab === 'map' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Map size={14} className="inline mr-1" /> Lacak Pengiriman
                {activeTab === 'map' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
              </button>
            )}
          </div>

          {/* ========== TAB: DETAIL PESANAN ========== */}
          {activeTab === 'detail' && (
            <div className="space-y-6">
              {/* Info Pemesan & Produk */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h2 className="font-semibold text-sm mb-2">Informasi Pemesan</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm">{order.guest_name || 'Guest'}</p>
                    <p className="text-sm text-gray-400">{order.guest_phone}</p>
                    <p className="text-sm text-gray-400 mt-1">{order.shipping_address}</p>
                  </div>
                </div>
                
                <div>
                  <h2 className="font-semibold text-sm mb-2">Produk Dipesan</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="space-y-1">
                      {items.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>{item.product_name} x{item.quantity}</span>
                          <span>Rp {item.total?.toLocaleString() || item.subtotal?.toLocaleString() || 0}</span>
                        </div>
                      ))}
                      <div className="border-t border-white/10 pt-2 mt-2 font-bold flex justify-between">
                        <span>Total</span>
                        <span>Rp {order.total_amount?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pembayaran & Upload */}
              <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
                <h3 className="font-semibold text-yellow-500 mb-2">Instruksi Pembayaran</h3>
                <p className="text-sm">Transfer ke rekening berikut:</p>
                <div className="bg-gray-800 rounded-lg p-3 mt-2">
                  <p className="font-mono text-sm">{store?.bank_name || 'BCA'}</p>
                  <p className="font-mono text-lg font-bold">{store?.bank_account_number || '1234567890'}</p>
                  <p className="text-sm">a.n. {store?.bank_account_name || 'PWM Store'}</p>
                </div>
                <p className="text-sm mt-2">Nominal: <span className="font-bold text-yellow-500">Rp {order.total_amount?.toLocaleString() || 0}</span></p>
                
                {canUpload && (
                  <div className="mt-4">
                    <label className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-lg cursor-pointer hover:bg-yellow-600 transition w-fit">
                      <Upload size={16} />
                      {uploading ? 'Mengupload...' : 'Upload Bukti Transfer'}
                      <input type="file" accept="image/*" onChange={handleUploadProof} disabled={uploading} className="hidden" />
                    </label>
                    <p className="text-xs text-gray-400 mt-2">Format: JPG, PNG (max 2MB)</p>
                  </div>
                )}

                {order.payment_proof_url && (
                  <div className="mt-4">
                    <p className="text-green-500 text-sm flex items-center gap-1"><CheckCircle size={14} /> Bukti sudah diupload</p>
                    <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-yellow-500 text-sm underline flex items-center gap-1 mt-1">
                      <Download size={14} /> Lihat bukti transfer
                    </a>
                  </div>
                )}
              </div>

              {/* WhatsApp ke Customer */}
              {order.guest_phone && (
                <div className="text-center border-t border-white/10 pt-4">
                  <p className="text-sm text-gray-400 mb-3">Simpan link pesanan Anda:</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button onClick={copyToClipboard} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition">
                      📋 Salin Link Pesanan
                    </button>
                    <a
                      href={`https://wa.me/${order.guest_phone.replace(/[^0-9]/g, '')}?text=Halo%2C%20pesanan%20saya%20dengan%20nomor%20%23${order.order_number}%0A%0ALink%20pelacakan%3A%20${window.location.href}%0A%0ATotal%3A%20Rp%20${order.total_amount.toLocaleString()}%0AStatus%3A%20${order.status}%0A%0ATerima%20kasih.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition justify-center"
                    >
                      <MessageCircle size={16} /> Kirim Link ke WhatsApp Saya
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== TAB: PETA TRACKING ========== */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              {/* Status Pengiriman */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Truck size={18} className="text-yellow-500" />
                  Status Pengiriman
                </h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm">Status: <span className="font-bold uppercase text-yellow-500">{delivery?.status || 'assigned'}</span></p>
                    {courier && <p className="text-sm text-gray-400">Kurir: {courier.full_name || courier.email}</p>}
                  </div>
                  {isTrackingActive && (
                    <div className="flex items-center gap-1 text-green-500 text-xs">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Live Tracking Aktif
                    </div>
                  )}
                </div>
              </div>

{/* Peta */}
<TrackingMap
  storeLocation={storeLocation}
  destination={destination}
  courierLocation={courierLocation}
  polyline={routePolyline}
  courierHeading={courierHeading}
  storeName={store?.name}
  destinationAddress={order?.shipping_address}
/>

              {/* Tracking Info */}
              {delivery && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-2">Riwayat Tracking</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Penugasan Kurir:</span>
                      <span>{new Date(delivery.created_at).toLocaleString()}</span>
                    </div>
                    {delivery.started_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Mulai Pengiriman:</span>
                        <span>{new Date(delivery.started_at).toLocaleString()}</span>
                      </div>
                    )}
                    {delivery.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Selesai:</span>
                        <span>{new Date(delivery.completed_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}