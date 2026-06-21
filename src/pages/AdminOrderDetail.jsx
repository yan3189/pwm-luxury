// ========== FILE: src/pages/AdminOrderDetail.jsx ==========
// Admin: detail pesanan lengkap dengan assign kurir, tracking, ETA, pembatalan
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import TrackingMap from '../components/TrackingMap';
import { 
  ArrowLeft, MapPin, Calendar, Package, User, Truck, 
  CheckCircle, MessageCircle, Eye, Download, XCircle, AlertCircle, Gift
} from 'lucide-react';
import { calculateETA } from '../services/etaService';

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
  const [eta, setEta] = useState(null);
  const animationRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => { fetchOrder(); }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    
    console.log('===== FETCHING ORDER DETAIL (ADMIN) =====');
    console.log('Order ID:', id);
    
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
    let storeData = null;
    if (orderData.store_id) {
      const { data: sd } = await supabase
        .from('stores')
        .select('*')
        .eq('id', orderData.store_id)
        .single();
      if (sd) {
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
    
    // Step 4: Ambil items dari order_items
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);
    
    // ================================================================
    // STEP 4B: GABUNGKAN DENGAN UPSEL ITEMS (dari orders.upsell_items)
    // ================================================================
    let allItems = itemsData || [];
    
    if (orderData.upsell_items && Array.isArray(orderData.upsell_items) && orderData.upsell_items.length > 0) {
      console.log('✅ Upsell items found in order:', orderData.upsell_items);
      
      const upsellItems = orderData.upsell_items.map((upsell, index) => ({
        id: `upsell-${index}`,
        order_id: orderData.id,
        product_id: upsell.product_id || null,
        product_name: upsell.name || 'Produk Upsell',
        quantity: upsell.quantity || 1,
        price: upsell.price || 0,
        total: (upsell.discounted_price || upsell.price || 0) * (upsell.quantity || 1),
        discount_percentage: upsell.discount_percentage || 0,
        original_price: upsell.price || 0,
        discounted_price: upsell.discounted_price || upsell.price || 0,
        subtotal: (upsell.discounted_price || upsell.price || 0) * (upsell.quantity || 1),
        is_upsell: true,
        from_upsell: true,
        has_discount: upsell.has_discount || false
      }));
      
      allItems = [...allItems, ...upsellItems];
      console.log('✅ Combined items:', allItems);
    }
    
    setItems(allItems);
    
    // Step 5: Ambil alamat
    if (orderData.address_id) {
      const { data: addressData } = await supabase
        .from('member_addresses')
        .select('*')
        .eq('id', orderData.address_id)
        .single();
      if (addressData) setAddress(addressData);
    }
    
    // Step 6: Ambil delivery assignment
    let deliveryData = null;
    if (orderData.delivery_type === 'internal') {
      console.log('Fetching delivery assignment for order:', id);
      const { data: dd } = await supabase
        .from('delivery_assignments')
        .select('*, courier:users(id, email, full_name, phone)')
        .eq('order_id', id)
        .maybeSingle();
      
      if (dd) {
        deliveryData = dd;
        setDelivery(dd);
        if (dd.courier) setCourier(dd.courier);
        console.log('Delivery assignment found:', dd.id, 'status:', dd.status);
        
        const { data: points } = await supabase
          .from('tracking_points')
          .select('*')
          .eq('delivery_id', dd.id)
          .order('recorded_at', { ascending: false })
          .limit(1);
        if (points && points[0]) {
          console.log('Latest tracking point:', points[0]);
          setCourierLocation([points[0].latitude, points[0].longitude]);
        }
      } else {
        console.log('No delivery assignment found');
      }
    }
    
    // Step 7: Ambil polyline (prioritas: start_route_polyline → distance_cache)
    console.log('🔍 Fetching polyline...');
    console.log('deliveryData?.start_route_polyline exists?', !!deliveryData?.start_route_polyline);
    
    if (deliveryData?.start_route_polyline) {
      console.log('✅ Using START ROUTE polyline (kurir → customer)');
      setRoutePolyline(deliveryData.start_route_polyline);
    } else if (storeData?.id && orderData?.shipping_latitude && orderData?.shipping_longitude) {
      let addressId = orderData.address_id;
      if (!addressId && orderData.shipping_address) {
        console.log('No address_id, searching by shipping_address:', orderData.shipping_address);
        const { data: addrData } = await supabase
          .from('member_addresses')
          .select('id')
          .eq('address_text', orderData.shipping_address)
          .maybeSingle();
        if (addrData) addressId = addrData.id;
      }
      
      if (addressId) {
        console.log('Fetching from distance_cache for store:', storeData.id, 'address:', addressId);
        const { data: cacheData } = await supabase
          .from('distance_cache')
          .select('polyline')
          .eq('store_id', storeData.id)
          .eq('address_id', addressId)
          .maybeSingle();
        
        if (cacheData?.polyline) {
          console.log('✅ Using DISTANCE CACHE polyline (store → customer), length:', cacheData.polyline.length);
          setRoutePolyline(cacheData.polyline);
        } else {
          console.log('❌ No polyline found in distance_cache');
        }
      } else {
        console.log('❌ No address_id found');
      }
    } else {
      console.log('❌ Conditions not met for polyline fetch');
    }
    
    // Step 8: Ambil daftar kurir
    await fetchCouriers();
    
    setLoading(false);
    console.log('===== FETCH COMPLETE =====');
  };

  const fetchCouriers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone')
      .eq('role', 'courier');
    
    if (error) console.error('Error fetching couriers:', error);
    else setCouriers(data || []);
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
    fetchOrder();
    setUpdating(false);
  };

  const handleApproveCancellation = async () => {
    if (!confirm('Setujui pembatalan pesanan ini? Pesanan akan dibatalkan.')) return;
    await updateOrderStatus('cancelled');
  };

  const handleRejectCancellation = async () => {
    if (!confirm('Tolak pembatalan pesanan ini? Pesanan akan kembali ke status sebelumnya.')) return;
    const previousStatus = order.payment_proof_url ? 'paid' : 'pending';
    const { error } = await supabase
      .from('orders')
      .update({ status: previousStatus, notes: null })
      .eq('id', id);
    if (error) alert('Gagal menolak pembatalan: ' + error.message);
    else {
      alert('Pembatalan ditolak');
      fetchOrder();
    }
  };

  // ========== REALTIME SUBSCRIPTION ==========
  useEffect(() => {
    if (!delivery || !delivery.id) {
      console.log('❌ No delivery assignment, skipping realtime subscription');
      return;
    }
    
    console.log('🔧 Setting up realtime subscription for delivery:', delivery.id);
    
    let lastUpdateTime = Date.now();
    let statusCheckInterval = null;
    let isMounted = true;
    
    const destLat = order?.shipping_latitude;
    const destLng = order?.shipping_longitude;
    const storeIdData = store?.id;
    const addressIdData = order?.address_id;
    
    const channel = supabase
      .channel(`tracking:${delivery.id}`)
      .on('broadcast', { event: 'location-update' }, async (payload) => {
        if (!isMounted) return;
        console.log('📍🔥 LOCATION UPDATE RECEIVED! Payload:', payload);
        
        const { lat, lng, heading } = payload.payload;
        console.log('📍 Location:', lat, lng, 'Heading:', heading);
        
        lastUpdateTime = Date.now();
        if (isTrackingActive === 'timeout') setIsTrackingActive(true);
        if (heading !== undefined) setCourierHeading(heading);
        
        setCourierLocation([lat, lng]);
        
        if (destLat && destLng && lat && lng) {
          const newEta = await calculateETA(lat, lng, destLat, destLng, storeIdData, addressIdData);
          setEta(newEta);
        }
        
        if (mapRef.current && lat && lng) {
          mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: true });
        }
      })
      .on('broadcast', { event: 'tracking-status' }, (payload) => {
        if (!isMounted) return;
        console.log('📡 Tracking status update:', payload.payload);
        const { status } = payload.payload;
        if (status === 'active') { 
          setIsTrackingActive(true); 
          lastUpdateTime = Date.now();
          console.log('✅ Tracking status: ACTIVE');
        } else if (status === 'inactive') {
          setIsTrackingActive(false);
          console.log('❌ Tracking status: INACTIVE');
        }
      })
      .on('broadcast', { event: 'route-updated' }, (payload) => {
        console.log('🔄 Route updated! New polyline received:', payload.payload);
        const { polyline } = payload.payload;
        if (polyline) {
          console.log('✅ Updating route polyline to start route');
          setRoutePolyline(polyline);
        }
      })
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });
    
    statusCheckInterval = setInterval(() => {
      if (!isMounted) return;
      if (isTrackingActive === true && Date.now() - lastUpdateTime > 30000) {
        console.log('⏰ No location update for 30 seconds, marking tracking as timeout');
        setIsTrackingActive('timeout');
      }
    }, 10000);
    
    return () => {
      console.log('🧹 Cleaning up realtime subscription for delivery:', delivery.id);
      isMounted = false;
      supabase.removeChannel(channel);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (statusCheckInterval) clearInterval(statusCheckInterval);
    };
  }, [delivery, order?.shipping_latitude, order?.shipping_longitude, store?.id, order?.address_id]);

  const getStatusBadge = (status) => {
    const colors = { 
      pending: 'bg-yellow-500/20 text-yellow-500', 
      paid: 'bg-blue-500/20 text-blue-400', 
      processing: 'bg-purple-500/20 text-purple-400', 
      shipping: 'bg-orange-500/20 text-orange-400', 
      delivered: 'bg-green-500/20 text-green-400', 
      cancelled: 'bg-red-500/20 text-red-400',
      cancellation_requested: 'bg-orange-500/20 text-orange-400'
    };
    const labels = {
      pending: 'Menunggu Pembayaran',
      paid: 'Dibayar',
      processing: 'Diproses',
      shipping: 'Dikirim',
      delivered: 'Selesai',
      cancelled: 'Dibatalkan',
      cancellation_requested: 'Pengajuan Pembatalan'
    };
    return <span className={`text-xs px-2 py-1 rounded-full ${colors[status] || colors.pending}`}>{labels[status] || status}</span>;
  };

  const getDeliveryStatusText = (status) => {
    switch (status) {
      case 'assigned': return 'Menunggu Kurir Menjemput';
      case 'picking_up': return 'Kurir Menuju Store';
      case 'on_delivery': return 'Kurir Sedang Mengantar';
      case 'completed': return 'Pesanan Telah Sampai';
      default: return status || 'Menunggu';
    }
  };

  const getDeliveryStatusColor = (status) => {
    switch (status) {
      case 'assigned': return 'bg-yellow-500/20 text-yellow-500';
      case 'picking_up': return 'bg-blue-500/20 text-blue-400';
      case 'on_delivery': return 'bg-green-500/20 text-green-400';
      case 'completed': return 'bg-emerald-500/20 text-emerald-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  // ========== HITUNG SUBTOTAL ==========
  const cartSubtotal = order?.total_amount || 0;
  const upsellItems = order?.upsell_items || [];
  const upsellTotal = upsellItems.reduce((sum, item) => {
    const price = item.discounted_price || item.price || 0;
    return sum + (price * (item.quantity || 1));
  }, 0);
  const subtotal = cartSubtotal + upsellTotal;
  const shippingCost = order?.shipping_cost || 0;
  const voucherDiscount = order?.voucher_discount || 0;
  const finalTotal = order?.final_total || (subtotal + shippingCost - voucherDiscount);

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  if (error) return <div className="bg-black min-h-screen text-white p-8 text-center">{error}</div>;
  if (!order) return null;

  const customerName = member?.full_name || order.guest_name || 'Guest';
  const customerPhone = member?.phone || order.guest_phone || '-';
  const showTrackingTab = delivery && delivery?.status !== 'completed' && delivery?.status !== 'cancelled';
  const storeLocation = store?.latitude && store?.longitude ? [store.latitude, store.longitude] : null;
  const destination = order?.shipping_latitude && order?.shipping_longitude ? [order.shipping_latitude, order.shipping_longitude] : null;
  const isCancellationRequested = order.status === 'cancellation_requested';
  const hasUpsell = order.upsell_items && order.upsell_items.length > 0;

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <Link to="/admin/orders" className="inline-flex items-center gap-1 text-yellow-500 hover:gap-2 transition">
            <ArrowLeft size={16} /> Kembali ke Daftar Pesanan
          </Link>
          <div className="flex gap-2 flex-wrap">
            {order.status === 'pending' && (
              <button onClick={() => updateOrderStatus('paid')} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">Tandai Dibayar</button>
            )}
            {order.status === 'paid' && (
              <button onClick={() => updateOrderStatus('processing')} className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">Proses Pesanan</button>
            )}
            {order.status === 'processing' && (
              <button onClick={() => updateOrderStatus('shipping')} className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm">Kirim Pesanan</button>
            )}
            {order.status === 'shipping' && (
              <button onClick={() => updateOrderStatus('delivered')} className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">Tandai Selesai</button>
            )}
            {!['delivered', 'cancelled'].includes(order.status) && !isCancellationRequested && (
              <button onClick={() => updateOrderStatus('cancelled')} className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">Batalkan</button>
            )}
            {isCancellationRequested && (
              <>
                <button onClick={handleApproveCancellation} className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">Setujui Pembatalan</button>
                <button onClick={handleRejectCancellation} className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">Tolak Pembatalan</button>
              </>
            )}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-display">Pesanan #{order.order_number}</h1>
              <p className="text-gray-400">{store?.name}</p>
              {hasUpsell && (
                <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1">
                  <Gift size={12} /> +{order.upsell_items.reduce((sum, item) => sum + (item.quantity || 1), 0)} item upsell
                </span>
              )}
            </div>
            {getStatusBadge(order.status)}
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-white/10 mb-6">
            <button onClick={() => setActiveTab('detail')} className={`py-2 px-4 text-sm font-medium transition-all relative ${activeTab === 'detail' ? 'text-yellow-500' : 'text-gray-400'}`}>
              📋 Detail Pesanan
              {activeTab === 'detail' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></span>}
            </button>
            {showTrackingTab && (
              <button onClick={() => setActiveTab('map')} className={`py-2 px-4 text-sm font-medium transition-all relative ${activeTab === 'map' ? 'text-yellow-500' : 'text-gray-400'}`}>
                🗺️ Lacak Pengiriman
                {activeTab === 'map' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></span>}
              </button>
            )}
          </div>

          {/* Tab Detail */}
          {activeTab === 'detail' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="font-semibold flex items-center gap-2 mb-2"><Package size={16} /> Produk</h2>
                <div className="space-y-2 bg-gray-800/30 rounded-lg p-3">
                  {items.map(item => {
                    const isUpsell = item.is_upsell || item.from_upsell || false;
                    const displayPrice = item.discounted_price || item.price || 0;
                    const totalPerItem = displayPrice * (item.quantity || 1);
                    const hasDiscount = item.discount_percentage && item.discount_percentage > 0;
                    const originalPrice = item.original_price || item.price || 0;
                    
                    return (
                      <div key={item.id} className={`flex justify-between text-sm border-b border-white/5 pb-1 ${isUpsell ? 'text-yellow-500' : ''}`}>
                        <span>
                          {isUpsell && <span className="text-yellow-500">+ </span>}
                          {item.product_name} x{item.quantity}
                        </span>
                        <div className="text-right">
                          <span>Rp {totalPerItem.toLocaleString()}</span>
                          {hasDiscount && (
                            <div className="text-xs text-green-400">
                              <span className="line-through text-gray-500">Rp {originalPrice.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Total Diskon Produk */}
                  {(() => {
                    let totalProductDiscount = 0;
                    items.forEach(item => {
                      const originalPrice = item.original_price || item.price || 0;
                      const displayPrice = item.discounted_price || item.price || 0;
                      if (displayPrice < originalPrice && displayPrice > 0) {
                        totalProductDiscount += (originalPrice - displayPrice) * (item.quantity || 1);
                      }
                    });
                    return totalProductDiscount > 0 ? (
                      <div className="flex justify-between text-green-400 text-sm border-t border-white/10 pt-1">
                        <span>Total Diskon Produk</span>
                        <span>-Rp {totalProductDiscount.toLocaleString()}</span>
                      </div>
                    ) : null;
                  })()}
                  
                  <div className="flex justify-between text-sm pt-1">
                    <span>Subtotal</span>
                    <span>Rp {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ongkos Kirim</span>
                    <span>Rp {(order.shipping_cost || 0).toLocaleString()}</span>
                  </div>
                  {(order.voucher_discount || 0) > 0 && (
                    <div className="flex justify-between text-green-400 text-sm">
                      <span>Diskon Voucher</span>
                      <span>-Rp {(order.voucher_discount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10">
                    <span>Total</span>
                    <span className="text-yellow-500">Rp {finalTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="font-semibold flex items-center gap-2 mb-2"><User size={16} /> Informasi Customer</h2>
                <div className="bg-gray-800/30 rounded-lg p-3 space-y-2">
                  <div><span className="text-gray-400">Nama:</span> {customerName}</div>
                  <div><span className="text-gray-400">Telepon:</span> {customerPhone}</div>
                </div>

                <h2 className="font-semibold flex items-center gap-2 mt-4 mb-2"><MapPin size={16} /> Alamat Pengiriman</h2>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  {address ? <p className="text-sm">{address.address_text}</p> : <p className="text-sm">{order.shipping_address}</p>}
                </div>

                <h2 className="font-semibold flex items-center gap-2 mt-4 mb-2"><Calendar size={16} /> Tanggal Pesan</h2>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <p className="text-sm">{new Date(order.created_at).toLocaleString('id-ID')}</p>
                </div>

                {order.notes && (
                  <div className="mt-4"><h2 className="font-semibold text-sm mb-1">📝 Catatan Pelanggan:</h2>
                    <div className="bg-gray-800/30 rounded-lg p-3"><p className="text-sm text-gray-300">{order.notes}</p></div>
                  </div>
                )}

                {order.payment_proof_url && (
                  <div className="mt-4"><h2 className="font-semibold flex items-center gap-2 mb-2"><CheckCircle size={16} className="text-green-500" /> Bukti Transfer</h2>
                    <div className="bg-gray-800/30 rounded-lg p-3">
                      <a href={order.payment_proof_url} target="_blank" className="text-yellow-500 underline text-sm">Lihat bukti transfer</a>
                      <div className="mt-2"><img src={order.payment_proof_url} alt="Bukti Transfer" className="max-w-full h-auto rounded-lg max-h-64" /></div>
                    </div>
                  </div>
                )}

                {/* Assign Kurir */}
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Truck size={16} /> Assign Kurir Internal</h3>
                  {delivery ? (
                    <div>
                      <p className="text-sm">Kurir: {delivery.courier?.full_name || delivery.courier?.email || 'Tidak diketahui'}</p>
                      <p className="text-sm text-gray-400">Status: {delivery.status}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select value={selectedCourierId} onChange={(e) => setSelectedCourierId(e.target.value)} className="w-full p-2 rounded bg-black/50 border border-white/20 text-sm">
                        <option value="">-- Pilih Kurir --</option>
                        {couriers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email} {c.phone && `- ${c.phone}`}</option>)}
                      </select>
                      <button onClick={assignCourier} disabled={assigning || !selectedCourierId} className="w-full bg-yellow-500 text-black py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                        {assigning ? 'Memproses...' : 'Assign Kurir'}
                      </button>
                    </div>
                  )}
                </div>

                {/* WhatsApp Customer */}
                {customerPhone && customerPhone !== '-' && (
                  <div className="mt-4">
                    <a href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}?text=Halo%2C%20pesanan%20Anda%20%23${order.order_number}%20telah%20${order.status}`}
                       target="_blank" className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition w-fit text-sm">
                      <MessageCircle size={16} /> Hubungi Customer via WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Tracking */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-semibold flex gap-2 mb-2"><Truck size={18} className="text-yellow-500" /> Status Pengiriman</h3>
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <p className="text-sm">Status: 
                      <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${getDeliveryStatusColor(delivery?.status)}`}>
                        {getDeliveryStatusText(delivery?.status)}
                      </span>
                    </p>
                    {courier && <p className="text-sm text-gray-400 mt-1">Kurir: {courier.full_name || courier.email}</p>}
                    {eta !== null && <p className="text-sm mt-1">Estimasi Tiba: <span className="text-yellow-500 font-semibold">{eta} menit</span></p>}
                  </div>
                  <div className="flex items-center gap-2">
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
                        ⚠️ Live Tracking Terputus
                      </div>
                    )}
                    {courier?.phone && (
                      <a href={`https://wa.me/${courier.phone.replace(/[^0-9]/g, '')}?text=Halo%20kak%20kurir,%20saya%20admin%20mengenai%20pesanan%20%23${order.order_number}`}
                         target="_blank" className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs hover:bg-green-500/30 transition">
                        <MessageCircle size={12} /> Hubungi Kurir
                      </a>
                    )}
                  </div>
                </div>
              </div>
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