// ========== FILE: src/pages/TrackOrderPage.jsx ==========
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import TrackingMap from '../components/TrackingMap';
import { Package, MapPin, Calendar, CheckCircle, AlertCircle, Truck, Download, ArrowLeft, Upload, MessageCircle } from 'lucide-react';

export default function TrackOrderPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  
  // Tracking state
  const [delivery, setDelivery] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [courier, setCourier] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [courierHeading, setCourierHeading] = useState(0);
  const [isTrackingActive, setIsTrackingActive] = useState(null);
  const mapRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (id) {
      fetchOrder();
    } else {
      setError('ID pesanan tidak ditemukan');
      setLoading(false);
    }
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    
    console.log('===== FETCHING ORDER =====');
    console.log('Order ID:', id);
    
    // Step 1: Ambil order
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
    console.log('Order data:', orderData);
    
    // Step 2: Ambil store
    let storeData = null;
    if (orderData.store_id) {
      console.log('Fetching store with ID:', orderData.store_id);
      const { data: sd, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('id', orderData.store_id)
        .single();
      
      if (storeError) {
        console.error('Store error:', storeError);
      } else {
        storeData = sd;
        setStore(storeData);
        console.log('Store data:', storeData);
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
    
  let addressId = orderData.address_id;

// Jika tidak ada, cari berdasarkan shipping_address
if (!addressId && orderData.shipping_address) {
  const { data: addrData } = await supabase
    .from('member_addresses')
    .select('id')
    .eq('address_text', orderData.shipping_address)
    .maybeSingle();
  if (addrData) addressId = addrData.id;
}

if (addressId) {
  const { data: cacheData } = await supabase
    .from('distance_cache')
    .select('polyline')
    .eq('store_id', storeData.id)
    .eq('address_id', addressId)
    .maybeSingle();
  
  if (cacheData?.polyline) {
    console.log('✅ Polyline ditemukan');
    setRoutePolyline(cacheData.polyline);
  } else {
    console.log('❌ Polyline tidak ditemukan');
  }


      
      if (addressId) {
        console.log('Mengambil polyline untuk store:', storeData.id, 'address:', addressId);
        const { data: cacheData } = await supabase
          .from('distance_cache')
          .select('polyline')
          .eq('store_id', storeData.id)
          .eq('address_id', addressId)
          .maybeSingle();
        
        if (cacheData?.polyline) {
          console.log('✅ Polyline ditemukan!');
          setRoutePolyline(cacheData.polyline);
        } else {
          console.log('❌ Polyline tidak ditemukan');
        }
      }
    }
    
    setLoading(false);
    console.log('===== FETCH COMPLETE =====');
  };

  // ========== REALTIME SUBSCRIPTION (LENGKAP DENGAN STATUS) ==========
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
      
      const { lat, lng, heading } = payload.payload;
      console.log('📍 Location update received:', { lat, lng, heading });
      
      // Update last update time
      lastUpdateTime = Date.now();
      
      // Reset status ke aktif jika sebelumnya timeout
      if (isTrackingActive === 'timeout') {
        console.log('Resetting tracking status from timeout to active');
        setIsTrackingActive(true);
      }
      
      // Update heading untuk rotasi marker
      if (heading !== undefined) setCourierHeading(heading);
      
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
      console.log('📡 Tracking status update:', status);
      
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
  
  // Timeout detection: cek setiap 10 detik
  statusCheckInterval = setInterval(() => {
    if (!isMounted) return;
    
    // Hanya cek jika status pernah aktif (true) dan tidak ada update dalam 30 detik
    if (isTrackingActive === true && Date.now() - lastUpdateTime > 30000) {
      console.log('No location update for 30 seconds, marking tracking as timeout');
      setIsTrackingActive('timeout');
    }
  }, 10000);
  
  // Jangan set isTrackingActive ke true secara otomatis!
  // Biarkan status ditentukan oleh event tracking-status dari kurir
  
  return () => {
    console.log('Cleaning up realtime subscription');
    isMounted = false;
    supabase.removeChannel(channel);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (statusCheckInterval) clearInterval(statusCheckInterval);
  };
}, [delivery, courierLocation]);

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
      .update({ payment_proof_url: publicUrlData.publicUrl, status: 'paid' })
      .eq('id', id);
    
    if (updateError) {
      alert('Gagal menyimpan bukti: ' + updateError.message);
    } else {
      alert('Bukti transfer berhasil diupload!');
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
        <p className="text-gray-400 mb-4">{error}</p>
        <Link to="/" className="bg-yellow-500 text-black px-4 py-2 rounded-full">Kembali ke Beranda</Link>
      </div>
    </div>
  );
  
  if (!order) return null;
  
  const canUpload = order.status === 'pending' && !order.payment_proof_url;
  const showTrackingTab = delivery && delivery.status !== 'completed' && delivery.status !== 'cancelled';
  const hasValidCoordinates = store?.latitude && store?.longitude && order?.shipping_latitude && order?.shipping_longitude;
  
  const storeLocation = store?.latitude && store?.longitude ? [store.latitude, store.longitude] : null;
const destination = order?.shipping_latitude && order?.shipping_longitude ? [order.shipping_latitude, order.shipping_longitude] : null;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <Link to="/" className="inline-flex items-center gap-1 text-yellow-500 mb-6 hover:gap-2 transition">
          <ArrowLeft size={16} /> Kembali ke Beranda
        </Link>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-display">Pesanan #{order.order_number}</h1>
              <p className="text-gray-400">{store?.name}</p>
            </div>
            {getStatusBadge(order.status)}
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-white/10 mt-4 mb-6">
            <button
              onClick={() => setActiveTab('detail')}
              className={`py-2 px-4 font-medium text-sm transition-all relative ${
                activeTab === 'detail' ? 'text-yellow-500' : 'text-gray-400'
              }`}
            >
              📋 Detail Pesanan
              {activeTab === 'detail' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></span>}
            </button>
            {showTrackingTab && hasValidCoordinates && (
              <button
                onClick={() => setActiveTab('map')}
                className={`py-2 px-4 font-medium text-sm transition-all relative ${
                  activeTab === 'map' ? 'text-yellow-500' : 'text-gray-400'
                }`}
              >
                🗺️ Lacak Pengiriman
                {activeTab === 'map' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></span>}
              </button>
            )}
          </div>

          {/* Tab Detail */}
          {activeTab === 'detail' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h2 className="font-semibold mb-2">Informasi Pemesan</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm">{order.guest_name || 'Guest'}</p>
                    <p className="text-sm text-gray-400">{order.guest_phone}</p>
                    <p className="text-sm text-gray-400 mt-1">{order.shipping_address}</p>
                  </div>
                </div>
                <div>
                  <h2 className="font-semibold mb-2">Produk Dipesan</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    {items.map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.product_name} x{item.quantity}</span>
                        <span>Rp {item.total?.toLocaleString() || 0}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 font-bold flex justify-between">
                      <span>Total</span>
                      <span>Rp {order.total_amount?.toLocaleString() || 0}</span>
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
                    <label className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-lg cursor-pointer w-fit">
                      <Upload size={16} /> Upload Bukti Transfer
                      <input type="file" accept="image/*" onChange={handleUploadProof} disabled={uploading} className="hidden" />
                    </label>
                  </div>
                )}
                
                {order.payment_proof_url && (
                  <div className="mt-4">
                    <p className="text-green-500 text-sm">✅ Bukti sudah diupload</p>
                    <a href={order.payment_proof_url} target="_blank" className="text-yellow-500 text-sm">Lihat bukti transfer</a>
                  </div>
                )}
              </div>

              {/* WhatsApp */}
              {order.guest_phone && (
                <div className="text-center border-t pt-4">
                  <button onClick={copyToClipboard} className="bg-gray-700 px-4 py-2 rounded-lg text-sm mr-2">📋 Salin Link</button>
                  <a href={`https://wa.me/${order.guest_phone.replace(/[^0-9]/g, '')}?text=Link%20pesanan%3A%20${window.location.href}`} target="_blank" className="inline-flex items-center gap-2 bg-green-500 px-4 py-2 rounded-lg text-sm">💬 Kirim ke WhatsApp</a>
                </div>
              )}
            </div>
          )}

  {/* Tab Tracking */}
{activeTab === 'map' && (
  <div className="space-y-4">
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h3 className="font-semibold flex gap-2 mb-2">
        <Truck size={18} className="text-yellow-500" /> Status Pengiriman
      </h3>
      <div>
        <p className="text-sm">
          Status: <span className="font-bold uppercase">{delivery?.status || order.status}</span>
        </p>
        {courier && <p className="text-sm text-gray-400">Kurir: {courier.full_name || courier.email}</p>}
      </div>
      
      {/* Status Live Tracking dengan 3 kondisi */}
      <div className="mt-2">
        {isTrackingActive === true && (
          <div className="flex items-center gap-1 text-green-500 text-xs bg-green-500/10 px-2 py-1 rounded-full inline-flex">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Live Tracking Aktif
          </div>
        )}
        {isTrackingActive === false && (
          <div className="flex items-center gap-1 text-red-500 text-xs bg-red-500/10 px-2 py-1 rounded-full inline-flex">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            Live Tracking Tidak Aktif
          </div>
        )}
        {isTrackingActive === 'timeout' && (
          <div className="flex items-center gap-1 text-yellow-500 text-xs bg-yellow-500/10 px-2 py-1 rounded-full inline-flex">
            <span className="text-sm">⚠️</span>
            Live Tracking Terputus
          </div>
        )}
        {isTrackingActive === null && (
          <div className="flex items-center gap-1 text-gray-500 text-xs bg-gray-500/10 px-2 py-1 rounded-full inline-flex">
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            Menunggu status tracking...
          </div>
        )}
      </div>
    </div>
    
    {/* Peta Tracking */}
    <TrackingMap
      storeLocation={storeLocation}
      storeLogo={store?.logo}
      storeName={store?.name}
      destination={destination}
      destinationAddress={order?.shipping_address}
      courierLocation={courierLocation}
      polyline={routePolyline}
      courierHeading={courierHeading}
    />
  </div>
)}
        </div>
      </div>
    </div>
  );
}