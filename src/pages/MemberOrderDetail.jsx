// ========== FILE: src/pages/MemberOrderDetail.jsx ==========
// Detail pesanan member + upload bukti transfer + tracking peta
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { ArrowLeft, MapPin, Calendar, Package, Upload, CheckCircle, AlertCircle, Download, Map, Truck } from 'lucide-react';

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
  const [isTrackingActive, setIsTrackingActive] = useState(false);
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
    }
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    console.log('===== FETCHING ORDER DETAIL =====');
    console.log('Order ID:', id);
    
    // Step 1: Ambil order
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
    
    console.log('Order data retrieved:', {
      id: orderData.id,
      order_number: orderData.order_number,
      delivery_type: orderData.delivery_type,
      status: orderData.status,
      shipping_latitude: orderData.shipping_latitude,
      shipping_longitude: orderData.shipping_longitude
    });
    
    setOrder(orderData);
    
    // Step 2: Ambil store (query sederhana, tanpa nested select)
if (orderData.store_id) {
  console.log('Fetching store with ID:', orderData.store_id);
  const { data: storeData, error: storeError } = await supabase
    .from('stores')
    .select('*')  // SELECT SEMUA KOLOM, tanpa nested
    .eq('id', orderData.store_id)
    .single();
  
  if (storeError) {
    console.error('Error fetching store:', storeError);
  } else {
    console.log('Store data retrieved:', {
      name: storeData.name,
      latitude: storeData.latitude,
      longitude: storeData.longitude
    });
    setStore(storeData);
  }
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
    
    // Step 4: Ambil alamat
    if (orderData.address_id) {
      const { data: addressData } = await supabase
        .from('member_addresses')
        .select('*')
        .eq('id', orderData.address_id)
        .single();
      if (addressData) setAddress(addressData);
    }
    
    // Step 5: Ambil delivery assignment & tracking
    if (orderData.delivery_type === 'internal') {
      console.log('Order has internal delivery, fetching delivery_assignments...');
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_assignments')
        .select('*, courier:users(id, email, full_name)')
        .eq('order_id', id)
        .maybeSingle();
      
      if (deliveryError) {
        console.error('Error fetching delivery assignment:', deliveryError);
      }
      
      if (deliveryData) {
        console.log('Delivery assignment found:', {
          id: deliveryData.id,
          status: deliveryData.status,
          courier: deliveryData.courier?.full_name || deliveryData.courier?.email
        });
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
          console.log('Latest tracking point:', points[0]);
          setCourierLocation([points[0].latitude, points[0].longitude]);
        }
      } else {
        console.log('No delivery assignment found for this order');
      }
    } else {
      console.log('Order delivery_type is not internal:', orderData.delivery_type);
    }
    
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
    
    const channel = supabase
      .channel(`tracking:${delivery.id}`)
      .on('broadcast', { event: 'location-update' }, (payload) => {
        const { lat, lng, heading, timestamp } = payload.payload;
        console.log('📍 Location update received:', { lat, lng, heading, timestamp });
        
        // Animasi smooth movement
        if (courierLocation) {
          const startLat = courierLocation[0];
          const startLng = courierLocation[1];
          const endLat = lat;
          const endLng = lng;
          const startTime = Date.now();
          const duration = 2000; // 2 detik animasi
          
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
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });
    
    setIsTrackingActive(true);
    
    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [delivery]);

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
<div className="bg-gray-800/50 rounded-lg overflow-hidden" style={{ height: '500px' }}>
  {(store?.latitude || order?.shipping_latitude) ? (
    <MapContainer
      center={courierLocation || [store?.latitude || -6.2, store?.longitude || 106.816]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      whenCreated={(map) => { mapRef.current = map; }}
    >
      {/* Route Polyline dari Directions API */}
{routePolyline && routePolyline.length > 0 && (
  <Polyline
    positions={routePolyline}
    color="#2563EB"
    weight={4}
    opacity={0.8}
  />
)}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB'
      />
      
      {/* Store Marker */}
      {store?.latitude && store?.longitude && (
        <Marker position={[store.latitude, store.longitude]}>
          <Popup>📍 Store: {store.name}</Popup>
        </Marker>
      )}
      
      {/* Destination Marker */}
      {order?.shipping_latitude && order?.shipping_longitude && (
        <Marker position={[order.shipping_latitude, order.shipping_longitude]}>
          <Popup>🏠 Tujuan: {order.shipping_address}</Popup>
        </Marker>
      )}
      
      {/* Courier Marker */}
      {courierLocation && (
        <Marker position={courierLocation}>
          <Popup>🛵 Kurir sedang dalam perjalanan</Popup>
        </Marker>
      )}
      
      {/* Route Line */}
      {courierLocation && order?.shipping_latitude && order?.shipping_longitude && (
        <Polyline
          positions={[courierLocation, [order.shipping_latitude, order.shipping_longitude]]}
          color="#F59E0B"
          weight={3}
          opacity={0.7}
          dashArray="5, 10"
        />
      )}
    </MapContainer>
  ) : (
    <div className="h-full flex items-center justify-center text-gray-400">
      <div className="text-center">
        <p>Koordinat tidak tersedia</p>
        <p className="text-xs mt-2">Pastikan store dan alamat pengiriman memiliki koordinat</p>
      </div>
    </div>
  )}
</div>

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