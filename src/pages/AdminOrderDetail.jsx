// ========== FILE: src/pages/AdminOrderDetail.jsx ==========
// Admin: detail pesanan lengkap dengan tab detail & tracking peta + assign kurir
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, MapPin, Calendar, Package, User, Truck, CheckCircle, MessageCircle, Eye, Download } from 'lucide-react';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

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
  const [isTrackingActive, setIsTrackingActive] = useState(false);
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
    
    // Step 2: Ambil store
    if (orderData.store_id) {
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('id', orderData.store_id)
        .single();
      if (storeData) setStore(storeData);
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
    
    // ========== TAMBAHKAN INI ==========
  // Step 6: Ambil delivery assignment (penugasan kurir)
  const { data: deliveryData } = await supabase
    .from('delivery_assignments')
    .select('*, courier:users(id, email, full_name)')
    .eq('order_id', id)
    .maybeSingle();
  
  if (deliveryData) {
    setDelivery(deliveryData);
    if (deliveryData.courier) setCourier(deliveryData.courier);
    
    // Ambil tracking point terbaru
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
  // ========== SAMPAI SINI ==========
    
    // Step 7: Ambil daftar kurir untuk assign
    await fetchCouriers();
    
    setLoading(false);
  };

  // Ambil daftar kurir
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

  // Assign kurir ke order
  const assignCourier = async () => {
    if (!selectedCourierId) {
      alert('Pilih kurir terlebih dahulu');
      return;
    }
    
    setAssigning(true);
    
    try {
      // Update order dengan delivery_type = 'internal' dan courier_id
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          delivery_type: 'internal', 
          courier_id: selectedCourierId 
        })
        .eq('id', id);
      
      if (orderError) throw orderError;
      
      // Buat delivery assignment
      const { error: assignmentError } = await supabase
        .from('delivery_assignments')
        .insert({
          order_id: id,
          courier_id: selectedCourierId,
          status: 'assigned'
        });
      
      if (assignmentError) throw assignmentError;
      
      alert('Kurir berhasil ditugaskan');
      fetchOrder(); // Refresh data
      
    } catch (err) {
      alert('Gagal assign kurir: ' + err.message);
    }
    
    setAssigning(false);
  };

  // Update order status (sinkron ke delivery assignment)
  const updateOrderStatus = async (newStatus) => {
    setUpdating(true);
    
    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date() })
      .eq('id', id);
    
    if (orderError) {
      alert('Gagal update order: ' + orderError.message);
      setUpdating(false);
      return;
    }
    
    // Jika order selesai atau dibatalkan, update delivery assignment
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
    fetchOrder(); // Refresh data
    setUpdating(false);
  };

  // Realtime subscription untuk tracking
  useEffect(() => {
    if (!delivery || !delivery.id) return;
    
    const channel = supabase
      .channel(`tracking:${delivery.id}`)
      .on('broadcast', { event: 'location-update' }, (payload) => {
        const { lat, lng } = payload.payload;
        if (courierLocation) {
          const startLat = courierLocation[0], startLng = courierLocation[1];
          const startTime = Date.now();
          const duration = 2000;
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
          function animate() {
            const elapsed = Date.now() - startTime;
            const t = Math.min(1, elapsed / duration);
            setCourierLocation([startLat + (lat - startLat) * t, startLng + (lng - startLng) * t]);
            if (t < 1) animationRef.current = requestAnimationFrame(animate);
            else animationRef.current = null;
          }
          animate();
        } else setCourierLocation([lat, lng]);
        if (mapRef.current && lat && lng) mapRef.current.setView([lat, lng], 14);
      })
      .subscribe();
    
    setIsTrackingActive(true);
    return () => { supabase.removeChannel(channel); if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [delivery]);

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
  const customerEmail = member?.email || '-';
  const customerPhone = member?.phone || order.guest_phone || '-';
  const showTrackingTab = delivery && 
    delivery.status !== 'completed' && 
    delivery.status !== 'cancelled' &&
    order?.status !== 'delivered' &&
    order?.status !== 'cancelled';
  const subtotal = order.total_amount - (order.shipping_cost || 0);

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
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-display">Pesanan #{order.order_number}</h1>
              <p className="text-gray-400">{store?.name}</p>
            </div>
            {getStatusBadge(order.status)}
          </div>
          
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
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nama:</span>
                    <span>{customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Email:</span>
                    <span>{customerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Telepon:</span>
                    <span>{customerPhone}</span>
                  </div>
                </div>

                <h2 className="font-semibold flex items-center gap-2 mt-4 mb-2"><MapPin size={16} /> Alamat Pengiriman</h2>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  {address ? (
                    <div>
                      <p className="font-medium">{address.label}</p>
                      <p className="text-sm text-gray-400">{address.address_text}</p>
                    </div>
                  ) : order.shipping_address ? (
                    <div>
                      {order.guest_name && <p className="font-medium">{order.guest_name}</p>}
                      <p className="text-sm text-gray-400">{order.shipping_address}</p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">Alamat tidak tersedia</p>
                  )}
                </div>

                <h2 className="font-semibold flex items-center gap-2 mt-4 mb-2"><Calendar size={16} /> Tanggal Pesan</h2>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <p className="text-sm">{new Date(order.created_at).toLocaleString('id-ID')}</p>
                </div>

                {/* Catatan */}
                {order.notes && (
                  <div className="mt-4">
                    <h2 className="font-semibold text-sm mb-1">📝 Catatan Pelanggan:</h2>
                    <div className="bg-gray-800/30 rounded-lg p-3">
                      <p className="text-sm text-gray-300">{order.notes}</p>
                    </div>
                  </div>
                )}

                {/* Bukti Transfer */}
                {order.payment_proof_url && (
                  <div className="mt-4">
                    <h2 className="font-semibold flex items-center gap-2 mb-2"><CheckCircle size={16} className="text-green-500" /> Bukti Transfer</h2>
                    <div className="bg-gray-800/30 rounded-lg p-3">
                      <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-yellow-500 underline text-sm flex items-center gap-1">
                        <Eye size={14} /> Lihat bukti transfer
                      </a>
                      <div className="mt-2">
                        <img src={order.payment_proof_url} alt="Bukti Transfer" className="max-w-full h-auto rounded-lg max-h-64" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Assign Kurir */}
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Truck size={16} /> Assign Kurir Internal
                  </h3>
                  
                  {delivery ? (
                    <div>
                      <p className="text-sm">Kurir: {delivery.courier?.full_name || delivery.courier?.email || 'Tidak diketahui'}</p>
                      <p className="text-sm text-gray-400">Status: {delivery.status}</p>
                      {delivery.status === 'completed' && (
                        <p className="text-xs text-green-400">Selesai: {new Date(delivery.completed_at).toLocaleString()}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={selectedCourierId}
                        onChange={(e) => setSelectedCourierId(e.target.value)}
                        className="w-full p-2 rounded bg-black/50 border border-white/20 text-sm"
                      >
                        <option value="">-- Pilih Kurir --</option>
                        {couriers.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.full_name || c.email} {c.phone && `- ${c.phone}`}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={assignCourier}
                        disabled={assigning || !selectedCourierId}
                        className="w-full bg-yellow-500 text-black py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                      >
                        {assigning ? 'Memproses...' : 'Assign Kurir'}
                      </button>
                    </div>
                  )}
                </div>

                {/* WhatsApp ke Customer */}
                {customerPhone && customerPhone !== '-' && (
                  <div className="mt-4">
                    <a
                      href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}?text=Halo%2C%20pesanan%20Anda%20%23${order.order_number}%20telah%20${order.status}%0A%0ALink%20pelacakan%3A%20${window.location.origin}/track-order/${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition w-fit text-sm"
                    >
                      <MessageCircle size={16} /> Hubungi Customer via WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========== TAB TRACKING ========== */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              {/* Status Pengiriman */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-semibold flex gap-2 mb-3"><Truck size={18} className="text-yellow-500" /> Status Pengiriman</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm">Status: <span className="font-bold uppercase text-yellow-500">{delivery?.status}</span></p>
                    {courier && <p className="text-sm text-gray-400">Kurir: {courier.full_name || courier.email}</p>}
                    {delivery?.started_at && <p className="text-xs text-gray-500">Mulai: {new Date(delivery.started_at).toLocaleString()}</p>}
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
                {store?.latitude && store?.longitude ? (
                  <MapContainer
                    center={courierLocation || [store.latitude, store.longitude]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    whenCreated={(map) => { mapRef.current = map; }}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB'
                    />
                    
                    {store?.latitude && store?.longitude && (
                      <Marker position={[store.latitude, store.longitude]}>
                        <Popup>📍 Store: {store.name}</Popup>
                      </Marker>
                    )}
                    
                    {order?.shipping_latitude && order?.shipping_longitude && (
                      <Marker position={[order.shipping_latitude, order.shipping_longitude]}>
                        <Popup>🏠 Tujuan: {order.shipping_address || 'Alamat tujuan'}</Popup>
                      </Marker>
                    )}
                    
                    {courierLocation && (
                      <Marker position={courierLocation}>
                        <Popup>🛵 Kurir: {courier?.full_name || 'Kurir'}</Popup>
                      </Marker>
                    )}
                    
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
                      <p>Koordinat store tidak tersedia</p>
                      <p className="text-xs mt-2">Silakan update koordinat store di halaman edit store</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}