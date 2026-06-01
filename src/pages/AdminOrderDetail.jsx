// ========== FILE: src/pages/AdminOrderDetail.jsx ==========
// Admin: detail pesanan lengkap dengan tab detail & tracking peta
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, MapPin, Calendar, Package, User, Truck, CheckCircle, MessageCircle, Eye, Download } from 'lucide-react';
import TrackingMap from '../components/TrackingMap';

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  const [store, setStore] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  
  // Assign kurir state
  const [couriers, setCouriers] = useState([]);
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [assigning, setAssigning] = useState(false);
  
  // Tracking state
  const [delivery, setDelivery] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [courier, setCourier] = useState(null);
  const [courierHeading, setCourierHeading] = useState(0);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [isTrackingActive, setIsTrackingActive] = useState(null);
  const animationRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => { fetchOrder(); }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    
    // Step 1: Ambil order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (orderError || !orderData) {
      setError('Order tidak ditemukan');
      setLoading(false);
      return;
    }
    setOrder(orderData);
    
    // Step 2: Ambil store (gunakan variabel lokal storeData)
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
    
    // Step 3: Ambil member (jika ada)
    if (orderData.member_id) {
      const { data: memberData } = await supabase
        .from('users')
        .select('id, email, full_name, phone')
        .eq('id', orderData.member_id)
        .single();
      if (memberData) setMember(memberData);
    }
    
    // Step 4: Ambil items
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);
    setItems(itemsData || []);
    
    // Step 5: Ambil alamat member (jika ada address_id)
    if (orderData.address_id) {
      const { data: addressData } = await supabase
        .from('member_addresses')
        .select('*')
        .eq('id', orderData.address_id)
        .single();
      if (addressData) setAddress(addressData);
    }
    
    // Step 6: Ambil delivery assignment
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
    
    // Step 7: Ambil polyline dari cache (gunakan storeData lokal)
    if (storeData?.id && orderData?.shipping_latitude && orderData?.shipping_longitude) {
      let addressId = orderData.address_id;
      
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
          setRoutePolyline(cacheData.polyline);
        }
      }
    }
    
    // Step 8: Ambil daftar kurir
    await fetchCouriers();
    
    setLoading(false);
  };

  const fetchCouriers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone')
      .eq('role', 'courier');
    
    if (error) {
      console.error('Error fetching couriers:', error);
    } else {
      setCouriers(data || []);
    }
  };

  const assignCourier = async () => {
    if (!selectedCourierId) {
      alert('Pilih kurir terlebih dahulu');
      return;
    }
    
    setAssigning(true);
    
    try {
      const { error: orderError } = await supabase
        .from('orders')
        .update({ delivery_type: 'internal', courier_id: selectedCourierId })
        .eq('id', id);
      
      if (orderError) throw orderError;
      
      const { error: assignmentError } = await supabase
        .from('delivery_assignments')
        .insert({
          order_id: id,
          courier_id: selectedCourierId,
          status: 'assigned'
        });
      
      if (assignmentError) throw assignmentError;
      
      alert('Kurir berhasil ditugaskan');
      fetchOrder();
      
    } catch (err) {
      alert('Gagal assign kurir: ' + err.message);
    }
    
    setAssigning(false);
  };

  const updateOrderStatus = async (newStatus) => {
    setUpdating(true);
    
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date() })
      .eq('id', id);
    
    if (orderError) {
      alert('Gagal update order: ' + orderError.message);
      setUpdating(false);
      return;
    }
    
    if (newStatus === 'delivered' || newStatus === 'cancelled') {
      const { data: deliveryData } = await supabase
        .from('delivery_assignments')
        .select('id')
        .eq('order_id', id)
        .maybeSingle();
      
      if (deliveryData) {
        await supabase
          .from('delivery_assignments')
          .update({ 
            status: newStatus === 'delivered' ? 'completed' : 'cancelled',
            completed_at: newStatus === 'delivered' ? new Date().toISOString() : null
          })
          .eq('id', deliveryData.id);
      }
    }
    
    alert(`Status berhasil diubah menjadi ${newStatus}`);
    fetchOrder();
    setUpdating(false);
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
      paid: 'Dibayar',
      processing: 'Diproses',
      shipping: 'Dikirim',
      delivered: 'Selesai',
      cancelled: 'Dibatalkan'
    };
    return <span className={`text-xs px-2 py-1 rounded-full ${colors[status] || colors.pending}`}>{labels[status] || status}</span>;
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  if (error) return <div className="bg-black min-h-screen text-white p-8 text-center">{error}</div>;
  if (!order) return null;

  const customerName = member?.full_name || order.guest_name || 'Guest';
  const customerPhone = member?.phone || order.guest_phone || '-';
  const subtotal = order.total_amount - (order.shipping_cost || 0);
  const showTrackingTab = delivery && delivery.status !== 'completed' && delivery.status !== 'cancelled';
// Siapkan koordinat untuk TrackingMap
const storeLocation = store?.latitude && store?.longitude ? [store.latitude, store.longitude] : null;
const destination = order?.shipping_latitude && order?.shipping_longitude ? [order.shipping_latitude, order.shipping_longitude] : null;

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <Link to="/admin/orders" className="inline-flex items-center gap-1 text-yellow-500 hover:gap-2 transition">
            <ArrowLeft size={16} /> Kembali ke Daftar Pesanan
          </Link>
          <div className="flex gap-2 flex-wrap">
            {order.status === 'pending' && <button onClick={() => updateOrderStatus('paid')} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">Tandai Dibayar</button>}
            {order.status === 'paid' && <button onClick={() => updateOrderStatus('processing')} className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">Proses Pesanan</button>}
            {order.status === 'processing' && <button onClick={() => updateOrderStatus('shipping')} className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm">Kirim Pesanan</button>}
            {order.status === 'shipping' && <button onClick={() => updateOrderStatus('delivered')} className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">Tandai Selesai</button>}
            {!['delivered', 'cancelled'].includes(order.status) && <button onClick={() => updateOrderStatus('cancelled')} className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">Batalkan</button>}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          {/* Tab Navigation */}
          <div className="flex border-b border-white/10 mb-6">
            <button
              onClick={() => setActiveTab('detail')}
              className={`py-2 px-4 text-sm font-medium transition-all relative ${activeTab === 'detail' ? 'text-yellow-500' : 'text-gray-400'}`}
            >
              📋 Detail Pesanan
              {activeTab === 'detail' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></span>}
            </button>
            {showTrackingTab && (
              <button
                onClick={() => setActiveTab('map')}
                className={`py-2 px-4 text-sm font-medium transition-all relative ${activeTab === 'map' ? 'text-yellow-500' : 'text-gray-400'}`}
              >
                🗺️ Lacak Pengiriman
                {activeTab === 'map' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></span>}
              </button>
            )}
          </div>

          {/* ========== TAB DETAIL ========== */}
          {activeTab === 'detail' && (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Kiri - Produk */}
              <div>
                <h2 className="font-semibold flex items-center gap-2 mb-2"><Package size={16} /> Produk</h2>
                <div className="space-y-2 bg-gray-800/30 rounded-lg p-3">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm border-b border-white/5 pb-1">
                      <span>{item.product_name} x{item.quantity}</span>
                      <span>Rp {item.total?.toLocaleString() || (item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-1">
                    <span>Subtotal</span>
                    <span>Rp {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ongkos Kirim</span>
                    <span>Rp {(order.shipping_cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10">
                    <span>Total</span>
                    <span>Rp {order.total_amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Kanan - Info Customer & Alamat */}
              <div>
                <h2 className="font-semibold flex items-center gap-2 mb-2"><User size={16} /> Informasi Customer</h2>
                <div className="bg-gray-800/30 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between"><span className="text-gray-400">Nama:</span><span>{customerName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Telepon:</span><span>{customerPhone}</span></div>
                </div>

                <h2 className="font-semibold flex items-center gap-2 mt-4 mb-2"><MapPin size={16} /> Alamat Pengiriman</h2>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  {address ? (
                    <div><p className="font-medium">{address.label}</p><p className="text-sm text-gray-400">{address.address_text}</p></div>
                  ) : order.shipping_address ? (
                    <div><p className="text-sm text-gray-400">{order.shipping_address}</p></div>
                  ) : <p className="text-gray-400 text-sm">Alamat tidak tersedia</p>}
                </div>

                <h2 className="font-semibold flex items-center gap-2 mt-4 mb-2"><Calendar size={16} /> Tanggal Pesan</h2>
                <div className="bg-gray-800/30 rounded-lg p-3"><p className="text-sm">{new Date(order.created_at).toLocaleString('id-ID')}</p></div>

                {order.notes && (
                  <div className="mt-4"><h2 className="font-semibold text-sm mb-1">📝 Catatan Pelanggan:</h2><div className="bg-gray-800/30 rounded-lg p-3"><p className="text-sm text-gray-300">{order.notes}</p></div></div>
                )}

                {order.payment_proof_url && (
                  <div className="mt-4"><h2 className="font-semibold flex items-center gap-2 mb-2"><CheckCircle size={16} className="text-green-500" /> Bukti Transfer</h2>
                    <div className="bg-gray-800/30 rounded-lg p-3"><a href={order.payment_proof_url} target="_blank" className="text-yellow-500 underline text-sm">Lihat bukti transfer</a><div className="mt-2"><img src={order.payment_proof_url} alt="Bukti Transfer" className="max-w-full h-auto rounded-lg max-h-64" /></div></div>
                  </div>
                )}

                {/* Assign Kurir */}
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Truck size={16} /> Assign Kurir Internal</h3>
                  {delivery ? (
                    <div><p className="text-sm">Kurir: {delivery.courier?.full_name || delivery.courier?.email || 'Tidak diketahui'}</p><p className="text-sm text-gray-400">Status: {delivery.status}</p></div>
                  ) : (
                    <div className="space-y-2">
                      <select value={selectedCourierId} onChange={(e) => setSelectedCourierId(e.target.value)} className="w-full p-2 rounded bg-black/50 border border-white/20 text-sm">
                        <option value="">-- Pilih Kurir --</option>
                        {couriers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email} {c.phone && `- ${c.phone}`}</option>)}
                      </select>
                      <button onClick={assignCourier} disabled={assigning || !selectedCourierId} className="w-full bg-yellow-500 text-black py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{assigning ? 'Memproses...' : 'Assign Kurir'}</button>
                    </div>
                  )}
                </div>

                {customerPhone && customerPhone !== '-' && (
                  <div className="mt-4"><a href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}?text=Halo%2C%20pesanan%20Anda%20%23${order.order_number}%20telah%20${order.status}`} target="_blank" className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition w-fit text-sm"><MessageCircle size={16} /> Hubungi Customer via WhatsApp</a></div>
                )}
              </div>
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