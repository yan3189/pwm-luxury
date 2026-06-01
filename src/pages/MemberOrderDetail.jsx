// ========== FILE: src/pages/MemberOrderDetail.jsx ==========
// Detail pesanan member + upload bukti transfer + tracking peta
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { ArrowLeft, MapPin, Calendar, Package, Upload, CheckCircle, AlertCircle, Download, Map, Truck } from 'lucide-react';
import TrackingMap from '../components/TrackingMap';
// ========== IMPORTS UNTUK LEAFLET ==========
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

export default function MemberOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  
  // ========== STATE UNTUK TRACKING ==========
  const [delivery, setDelivery] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [courier, setCourier] = useState(null);
  const [isTrackingActive, setIsTrackingActive] = useState(null);
  const animationRef = useRef(null);
  const mapRef = useRef(null);
  const [routePolyline, setRoutePolyline] = useState([]);
const [courierHeading, setCourierHeading] = useState(0);

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
    }
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    console.log('===== FETCHING ORDER DETAIL =====');
    console.log('Order ID:', id);
    
// ========== DI DALAM FUNGSI fetchOrder ==========

// 1. Ambil order
const { data: orderData, error: orderError } = await supabase
  .from('orders')
  .select('*')
  .eq('id', id)
  .maybeSingle();

if (orderError || !orderData) {
  console.error('Order error:', orderError);
  setLoading(false);
  return;
}
setOrder(orderData);

// 2. Ambil store (DEKLARASIKAN storeData di sini)
let storeData = null;
if (orderData.store_id) {
  const { data: sd, error: storeError } = await supabase
    .from('stores')
    .select('*')
    .eq('id', orderData.store_id)
    .single();
  
  if (!storeError && sd) {
    storeData = sd;
    setStore(storeData);
  }
}

// 3. Ambil items
const { data: itemsData } = await supabase
  .from('order_items')
  .select('*')
  .eq('order_id', id);
setItems(itemsData || []);

// 4. Ambil alamat
if (orderData.address_id) {
  const { data: addressData } = await supabase
    .from('member_addresses')
    .select('*')
    .eq('id', orderData.address_id)
    .single();
  if (addressData) setAddress(addressData);
}

// 5. Ambil delivery assignment & tracking
if (orderData.delivery_type === 'internal') {
  const { data: deliveryData, error: deliveryError } = await supabase
    .from('delivery_assignments')
    .select('*, courier:users(id, email, full_name)')
    .eq('order_id', id)
    .maybeSingle();
  
  if (deliveryError) {
    console.error('Error fetching delivery assignment:', deliveryError);
  }
  
  if (deliveryData) {
    setDelivery(deliveryData);
    if (deliveryData.courier) setCourier(deliveryData.courier);
    
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

// ========== KODE POLYLINE (GUNAKAN storeData dan orderData) ==========
console.log('🔍 DEBUG: Memeriksa kondisi untuk mengambil polyline');
console.log('storeData:', storeData?.id);
console.log('orderData?.shipping_latitude:', orderData?.shipping_latitude);
console.log('orderData?.address_id:', orderData?.address_id);

if (storeData?.id && orderData?.shipping_latitude && orderData?.shipping_longitude) {
  let addressId = orderData.address_id;
  
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
}

// 6. Selesai
setLoading(false);
console.log('===== FETCH COMPLETE =====');
  };

 // ========== REALTIME SUBSCRIPTION ==========
useEffect(() => {
  if (!delivery || !delivery.id) {
    console.log('No delivery assignment, skipping realtime subscription');
    return;
  }
  
  console.log('Setting up realtime subscription for delivery:', delivery.id);
  
  let lastUpdateTime = Date.now();
  let statusCheckInterval = null;
  let isMounted = true;
  
  const channel = supabase
    .channel(`tracking:${delivery.id}`)
    .on('broadcast', { event: 'location-update' }, (payload) => {
      if (!isMounted) return;
      
      const { lat, lng, heading, timestamp } = payload.payload;
      console.log('📍 Location update received:', { lat, lng, heading });
      
      // Update last update time
      lastUpdateTime = Date.now();
      
      // Reset status ke aktif jika sebelumnya timeout
      if (isTrackingActive === 'timeout') {
        console.log('Resetting tracking status from timeout to active');
        setIsTrackingActive(true);
      }
      
      // Update heading untuk rotasi marker
      if (heading !== undefined) {
        setCourierHeading(heading);
      }
      
      // Animasi smooth movement
      if (courierLocation && courierLocation[0] && courierLocation[1]) {
        const startLat = courierLocation[0];
        const startLng = courierLocation[1];
        const endLat = lat;
        const endLng = lng;
        const startTime = Date.now();
        const duration = 2000;
        
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        
        function animate() {
          if (!isMounted) return;
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
      
      // Update map center
      if (mapRef.current && lat && lng) {
        mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: true });
      }
    })
    .on('broadcast', { event: 'tracking-status' }, (payload) => {
      if (!isMounted) return;
      
      const { status } = payload.payload;
      console.log('Tracking status update:', status);
      
      if (status === 'active') {
        setIsTrackingActive(true);
        lastUpdateTime = Date.now();
      } else if (status === 'inactive') {
        setIsTrackingActive(false);
      }
    })
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });
  
  // Timeout detection: cek setiap 10 detik, jika 30 detik no update -> timeout
  statusCheckInterval = setInterval(() => {
    if (!isMounted) return;
    
    if (isTrackingActive === true && Date.now() - lastUpdateTime > 30000) {
      console.log('No location update for 30 seconds, marking tracking as timeout');
      setIsTrackingActive('timeout');
    }
  }, 10000);
  
  // Set initial tracking active state
  setIsTrackingActive(true);
  
  return () => {
    console.log('Cleaning up realtime subscription');
    isMounted = false;
    supabase.removeChannel(channel);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (statusCheckInterval) clearInterval(statusCheckInterval);
  };
}, [delivery, courierLocation]);

  // ========== UPLOAD BUKTI ==========
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

  // Kondisi untuk menampilkan tab tracking
  // Tab tracking hanya muncul jika delivery ada, status delivery belum completed/cancelled, DAN order status belum delivered/cancelled
const showTrackingTab = delivery && 
  delivery.status !== 'completed' && 
  delivery.status !== 'cancelled' &&
  order?.status !== 'delivered' &&
  order?.status !== 'cancelled';
  console.log('showTrackingTab:', showTrackingTab);
  console.log('delivery status:', delivery?.status);

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  if (!order) return <div className="bg-black min-h-screen text-white p-8 text-center">Pesanan tidak ditemukan</div>;

  const canUpload = order.status === 'pending' && !order.payment_proof_url;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <Link to="/member/orders" className="inline-flex items-center gap-1 text-yellow-500 mb-6 hover:gap-2 transition">
          <ArrowLeft size={16} /> Kembali ke Pesanan
        </Link>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-display">Pesanan #{order.order_number}</h1>
              <p className="text-gray-400">{store?.name}</p>
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
            
            {/* Tab Lacak Pengiriman - muncul jika ada delivery */}
            {showTrackingTab && (
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
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h2 className="font-semibold flex items-center gap-2 mb-2"><Package size={16} /> Produk</h2>
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.product_name} x{item.quantity}</span>
                        <span>Rp {item.total?.toLocaleString() || item.subtotal?.toLocaleString() || 0}</span>
                      </div>
                    ))}
                    <div className="border-t border-white/10 pt-2 mt-2 font-bold flex justify-between">
                      <span>Subtotal</span>
                      <span>Rp {(order.total_amount - (order.shipping_cost || 0)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Ongkos Kirim</span>
                      <span>Rp {(order.shipping_cost || 0).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 mt-2 font-bold flex justify-between">
                      <span>Total</span>
                      <span>Rp {order.total_amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="font-semibold flex items-center gap-2 mb-2"><MapPin size={16} /> Alamat Pengiriman</h2>
                  {address ? (
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{address.label}</p>
                      <p className="text-gray-400">{address.address_text}</p>
                    </div>
                  ) : order.shipping_address ? (
                    <div className="text-sm">
                      {order.guest_name && <p className="font-medium">{order.guest_name}</p>}
                      {order.guest_phone && <p className="text-gray-400 text-xs">Telp: {order.guest_phone}</p>}
                      <p className="text-gray-400 mt-1">{order.shipping_address}</p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">Alamat tidak tersedia</p>
                  )}
                  
                  <h2 className="font-semibold flex items-center gap-2 mt-4 mb-2"><Calendar size={16} /> Tanggal Pesan</h2>
                  <p className="text-sm text-gray-400">{new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {/* Upload Bukti Transfer */}
              <div className="mt-6 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                <h3 className="font-semibold text-yellow-500 mb-2">Instruksi Pembayaran</h3>
                <p className="text-sm">Transfer ke rekening berikut:</p>
                <div className="bg-gray-800 rounded-lg p-3 mt-2">
                  <p className="font-mono text-sm">{store?.bank_name || 'BCA'}</p>
                  <p className="font-mono text-lg font-bold">{store?.bank_account_number || '1234567890'}</p>
                  <p className="text-sm">a.n. {store?.bank_account_name || 'PWM Store'}</p>
                </div>
                <p className="text-sm mt-2">Nominal: <span className="font-bold text-yellow-500">Rp {order.total_amount.toLocaleString()}</span></p>
                
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
  <div className="flex justify-between items-center flex-wrap gap-2">
    <div>
      <p className="text-sm">Status: <span className="font-bold uppercase text-yellow-500">{delivery?.status || 'assigned'}</span></p>
      {courier && <p className="text-sm text-gray-400">Kurir: {courier.full_name || courier.email}</p>}
    </div>
    
    {/* Tracking Status dengan 3 kondisi */}
    {isTrackingActive === true && (
      <div className="flex items-center gap-1 text-green-500 text-xs bg-green-500/10 px-2 py-1 rounded-full">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        Live Tracking Aktif
      </div>
    )}
    
    {isTrackingActive === false && (
      <div className="flex items-center gap-1 text-red-500 text-xs bg-red-500/10 px-2 py-1 rounded-full">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        Live Tracking Tidak Aktif
      </div>
    )}
    
    {isTrackingActive === 'timeout' && (
      <div className="flex items-center gap-1 text-yellow-500 text-xs bg-yellow-500/10 px-2 py-1 rounded-full">
        <span className="text-sm">⚠️</span>
        Live Tracking Terputus
      </div>
    )}
  </div>
</div>

            
{/* Peta */}
<TrackingMap
  storeLogo={store?.logo}
  storeLocation={store?.latitude && store?.longitude ? [store.latitude, store.longitude] : null}
  destination={order?.shipping_latitude && order?.shipping_longitude ? [order.shipping_latitude, order.shipping_longitude] : null}
  courierLocation={courierLocation}
  polyline={routePolyline}
  courierHeading={courierHeading}
  storeName={store?.name}
  destinationAddress={order?.shipping_address}
/>

              {/* Informasi Tracking */}
              {delivery && (
                <div className="bg-gray-800/50 rounded-lg p-4 text-sm">
                  <p><span className="text-gray-400">Status Pengiriman:</span> {delivery.status === 'on_delivery' ? 'Sedang dalam perjalanan' : delivery.status === 'picking_up' ? 'Mengambil pesanan di store' : delivery.status}</p>
                  {delivery.started_at && (
                    <p className="mt-1"><span className="text-gray-400">Mulai Pengiriman:</span> {new Date(delivery.started_at).toLocaleString()}</p>
                  )}
                  {delivery.completed_at && (
                    <p className="mt-1"><span className="text-gray-400">Selesai:</span> {new Date(delivery.completed_at).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}