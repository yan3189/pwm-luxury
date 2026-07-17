// ========== FILE: src/pages/TrackOrderPage.jsx ==========
// Halaman tracking untuk non-member (guest) + upload bukti transfer
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import TrackingMap from '../components/TrackingMap';
import { ArrowLeft, MapPin, Calendar, Package, Upload, CheckCircle, AlertCircle, Download, Truck, Eye, XCircle, MessageCircle, User } from 'lucide-react';
import { calculateETA } from '../services/etaService';
import { interpretDiscount, calculateDiscountedPrice } from '../utils/priceUtils'; // DS001

export default function TrackOrderPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  const [snapLoaded, setSnapLoaded] = useState(false);
  
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
    
    console.log('===== FETCHING ORDER DETAIL (TRACK ORDER) =====');
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
    
                // Step 3: Ambil items dari order_items
            const { data: itemsData } = await supabase
              .from('order_items')
              .select('*')
              .eq('order_id', id);

            // DS001: Gabungkan dengan upsell_items dari order
            let allItems = itemsData || [];
            if (orderData.upsell_items && Array.isArray(orderData.upsell_items) && orderData.upsell_items.length > 0) {
              const upsellItems = orderData.upsell_items.map((upsell, index) => ({
                id: `upsell-${index}`,
                order_id: orderData.id,
                product_id: upsell.product_id || null,
                product_name: upsell.name || 'Produk Upsell',
                quantity: upsell.quantity || 1,
                price: upsell.price || 0,
                total: (upsell.discounted_price || upsell.price || 0) * (upsell.quantity || 1),
                discount_percentage: upsell.discount_value || 0, // DS001: pakai discount_value
                original_price: upsell.price || 0,
                discounted_price: upsell.discounted_price || upsell.price || 0,
                subtotal: (upsell.discounted_price || upsell.price || 0) * (upsell.quantity || 1),
                is_upsell: true,
                from_upsell: true,
                has_discount: upsell.has_discount || false,
                discount_value: upsell.discount_value || 0
              }));
              allItems = [...allItems, ...upsellItems];
            }
            setItems(allItems);
    
    // Step 4: Ambil delivery assignment
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
    
    // Step 5: Ambil polyline
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
    
    setLoading(false);
    console.log('===== FETCH COMPLETE =====');
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

  const handleUploadProof = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const nominal = order.final_total || 
      (order.total_amount || 0) + (order.shipping_cost || 0) - (order.voucher_discount || 0);
    
    const confirmed = window.confirm(
      `Upload bukti transfer untuk pesanan #${order.order_number}?\n\n` +
      `File: ${file.name}\n\n` +
      `Pastikan bukti transfer sesuai dengan nominal Rp ${nominal.toLocaleString()}`
    );
    if (!confirmed) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file maksimal 2MB');
      return;
    }
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${order.order_number}_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(fileName, file);
    if (uploadError) {
      alert('Gagal upload: ' + uploadError.message);
      setUploading(false);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);
    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_proof_url: publicUrlData.publicUrl, status: 'paid' })
      .eq('id', id);
    if (updateError) alert('Gagal menyimpan bukti: ' + updateError.message);
    else {
      alert('Bukti transfer berhasil diupload! Admin akan segera memverifikasi.');
      fetchOrder();
    }
    setUploading(false);
  };

  const handleCancelOrder = async () => {
    if (!confirm('Yakin ingin membatalkan pesanan ini? Pesanan yang sudah dibatalkan tidak dapat dikembalikan.')) return;
    setCancelling(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) alert('Gagal membatalkan: ' + error.message);
    else {
      alert('Pesanan berhasil dibatalkan');
      fetchOrder();
    }
    setCancelling(false);
  };

  const handleRequestCancellation = async () => {
    if (!confirm('Ajukan pembatalan pesanan? Admin akan memproses permintaan Anda.')) return;
    setCancelling(true);
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'cancellation_requested', 
        notes: `Permintaan pembatalan oleh pelanggan pada ${new Date().toLocaleString()}`
      })
      .eq('id', id);
    if (error) alert('Gagal mengajukan pembatalan: ' + error.message);
    else {
      alert('Permintaan pembatalan telah dikirim ke admin.');
      fetchOrder();
    }
    setCancelling(false);
  };

  // ========== HANDLE RETRY PAYMENT (UNTUK MIDTRANS) ==========
  const handleRetryPayment = async () => {
    if (!order.snap_token) {
      alert('Token pembayaran tidak ditemukan.');
      return;
    }

    // Load Snap jika belum tersedia
    let snap = window.snap;
    if (!snap || typeof snap.pay !== 'function') {
      try {
        const { loadMidtransScript } = await import('../services/midtransService');
        const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
        
        if (!clientKey) {
          alert('Midtrans tidak dikonfigurasi.');
          return;
        }
        
        await loadMidtransScript(clientKey);
        snap = window.snap;
        setSnapLoaded(true);
        
        if (!snap || typeof snap.pay !== 'function') {
          alert('Gagal memuat Midtrans. Silakan refresh halaman.');
          return;
        }
      } catch (error) {
        console.error('❌ Failed to load Midtrans:', error);
        alert('Gagal memuat Midtrans: ' + error.message);
        return;
      }
    }

    // Cek apakah sudah lunas
    if (order.payment_status === 'settlement' || order.status === 'paid' || order.status === 'processing' || order.status === 'shipping' || order.status === 'delivered') {
      alert('Pembayaran sudah lunas!');
      return;
    }

    try {
      snap.pay(order.snap_token, {
        onSuccess: async (result) => {
          console.log('✅ Payment Success:', result);
          alert('Pembayaran berhasil!');
          await fetchOrder();
          setTimeout(() => fetchOrder(), 3000);
        },
        onPending: (result) => {
          console.log('⏳ Payment Pending:', result);
          alert('Pembayaran masih diproses. Tunggu konfirmasi.');
          fetchOrder();
        },
        onError: (result) => {
          console.log('❌ Payment Error:', result);
          alert('Pembayaran gagal. Silakan coba lagi.');
        },
        onClose: () => {
          console.log('🔄 Payment popup closed');
          fetchOrder();
        }
      });
    } catch (error) {
      console.error('❌ Retry payment error:', error);
      alert('Gagal membuka pembayaran: ' + error.message);
    }
  };

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
      paid: 'Dibayar (Menunggu Konfirmasi)',
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

  const storeLocation = store?.latitude && store?.longitude ? [store.latitude, store.longitude] : null;
  const destination = order?.shipping_latitude && order?.shipping_longitude ? [order.shipping_latitude, order.shipping_longitude] : null;
  const showTrackingTab = delivery && delivery?.status !== 'completed' && delivery?.status !== 'cancelled';
  const canUpload = order?.status === 'pending' && !order?.payment_proof_url && order?.payment_method !== 'midtrans';
  const canCancel = order?.status === 'pending';
  const canRequestCancellation = ['paid', 'processing'].includes(order?.status);
  
  // Hitung subtotal & final total
  const cartSubtotal = order?.total_amount || 0;
  const upsellItems = order?.upsell_items || [];
  const upsellTotal = upsellItems.reduce((sum, item) => {
    const price = item.discounted_price || item.price || 0;
    return sum + (price * (item.quantity || 1));
  }, 0);
  const subtotal = cartSubtotal + upsellTotal;
  const finalTotal = order?.final_total || (subtotal + (order?.shipping_cost || 0) - (order?.voucher_discount || 0));

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  if (error) return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="flex flex-col items-center justify-center p-8 pt-32">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-display mb-2">Pesanan Tidak Ditemukan</h1>
        <p className="text-gray-400 mb-4 text-center">{error}</p>
        <Link to="/" className="bg-yellow-500 text-black px-4 py-2 rounded-full">Kembali ke Beranda</Link>
      </div>
    </div>
  );
  if (!order) return null;

  // Cek status pembayaran
  const isPaid = order.payment_status === 'settlement' || order.payment_status === 'capture' || order.status === 'paid' || order.status === 'processing' || order.status === 'shipping' || order.status === 'delivered';
  const isPending = order.payment_status === 'pending' || order.status === 'pending';
  const isExpiredOrCancelled = order.payment_status === 'expire' || order.payment_status === 'cancel' || order.payment_status === 'deny';

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
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge(order.status)}
              {canCancel && (
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="flex items-center gap-1 bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs hover:bg-red-500/30 transition"
                >
                  <XCircle size={14} /> Batalkan Pesanan
                </button>
              )}
              {canRequestCancellation && (
                <button
                  onClick={handleRequestCancellation}
                  disabled={cancelling}
                  className="flex items-center gap-1 bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs hover:bg-orange-500/30 transition"
                >
                  <AlertCircle size={14} /> Ajukan Pembatalan
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-white/10 mt-4 mb-6">
            <button onClick={() => setActiveTab('detail')} className={`py-2 px-4 font-medium text-sm transition-all relative ${activeTab === 'detail' ? 'text-yellow-500' : 'text-gray-400'}`}>
              📋 Detail Pesanan
              {activeTab === 'detail' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></span>}
            </button>
            {showTrackingTab && (
              <button onClick={() => setActiveTab('map')} className={`py-2 px-4 font-medium text-sm transition-all relative ${activeTab === 'map' ? 'text-yellow-500' : 'text-gray-400'}`}>
                🗺️ Lacak Pengiriman
                {activeTab === 'map' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></span>}
              </button>
            )}
          </div>

          {/* ========== TAB DETAIL PESANAN ========== */}
          {activeTab === 'detail' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h2 className="font-semibold mb-2"><Package size={16} /> Produk</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                    {items.map(item => {
                      const isUpsell = item.is_upsell || item.from_upsell || false;
                      const originalPrice = item.original_price || item.price || 0;
                      const discountedPrice = item.discounted_price || item.price || 0;
                      const totalOriginal = originalPrice * (item.quantity || 1);
                      const totalDiscounted = discountedPrice * (item.quantity || 1);
                      const hasDiscount = discountedPrice < originalPrice;

                      return (
                        <div key={item.id} className={`flex justify-between text-sm border-b border-white/5 pb-1 ${isUpsell ? 'text-yellow-500' : ''}`}>
                          <span>
                            {isUpsell && <span className="text-yellow-500">+ </span>}
                            {item.product_name} x{item.quantity}
                          </span>
                          <div className="text-right">
                            <span className={isUpsell ? 'text-yellow-500' : 'text-white'}>
                              Rp {totalOriginal.toLocaleString()}
                            </span>
                            {hasDiscount && (
                              <div className="text-xs text-green-400">
                                -Rp {(totalOriginal - totalDiscounted).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                  <h2 className="font-semibold mb-2"><MapPin size={16} /> Alamat Pengiriman</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm">{order.shipping_address}</p>
                  </div>
                  <h2 className="font-semibold mt-4 mb-2"><Calendar size={16} /> Tanggal Pesan</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <h2 className="font-semibold mt-4 mb-2"><User size={16} /> Info Pemesan</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm">Nama: {order.guest_name || '-'}</p>
                    <p className="text-sm">No. HP: {order.guest_phone || '-'}</p>
                    <p className="text-sm">No. HP Penerima: {order.shipping_phone || order.guest_phone || '-'}</p>
                  </div>
                </div>
              </div>

              {/* ===== STATUS PEMBAYARAN ===== */}
              <div className="p-4 bg-gray-800/50 rounded-lg border border-white/10">
                <h3 className="font-semibold text-sm mb-2">💳 Status Pembayaran</h3>
                
                {order.payment_method === 'midtrans' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Metode:</span>
                      <span className="text-sm font-medium text-yellow-500">Midtrans</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm">Status:</span>
                      <span className={`text-sm font-medium ${
                        isPaid ? 'text-green-400' :
                        isPending ? 'text-yellow-400' :
                        isExpiredOrCancelled ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                        {isPaid ? '✅ Lunas' :
                         isPending ? '⏳ Menunggu Pembayaran' :
                         isExpiredOrCancelled ? '⏰ Kadaluarsa / Dibatalkan' :
                         order.payment_status || 'Menunggu'}
                      </span>
                    </div>
                    
                    {/* TOMBOL LANJUTKAN PEMBAYARAN */}
                    {isPending && order.snap_token && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={handleRetryPayment}
                          className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-600 transition"
                        >
                          🔄 Lanjutkan Pembayaran
                        </button>
                        <button
                          onClick={handleCancelOrder}
                          className="bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm hover:bg-red-500/30 transition"
                        >
                          Batalkan Pesanan
                        </button>
                      </div>
                    )}
                    
                    {isExpiredOrCancelled && (
                      <div className="mt-3">
                        <button
                          onClick={handleRetryPayment}
                          className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-600 transition"
                        >
                          🔄 Buat Pembayaran Baru
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  // ===== MANUAL TRANSFER =====
                  <div className="text-sm text-gray-400">
                    Metode: Transfer Bank (Manual)
                    {order.payment_proof_url && <span className="text-green-400 ml-2">✓ Bukti diupload</span>}
                  </div>
                )}
              </div>

              {/* ===== INSTRUKSI PEMBAYARAN (MANUAL TRANSFER) ===== */}
              {order.payment_method === 'manual_transfer' && order.status === 'pending' && !order.payment_proof_url && (
                <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                  <h3 className="font-semibold text-yellow-500 mb-2">📋 Instruksi Pembayaran Transfer Bank</h3>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="font-mono text-sm">{store?.bank_name || 'BCA'}</p>
                    <p className="font-mono text-lg font-bold">{store?.bank_account_number || '1234567890'}</p>
                    <p className="text-sm">a.n. {store?.bank_account_name || 'PWM Store'}</p>
                  </div>
                  <p className="text-sm mt-2">
                    Nominal: <span className="font-bold text-yellow-500">
                      Rp {finalTotal.toLocaleString()}
                    </span>
                  </p>
                  {canUpload && (
                    <div className="mt-4">
                      <label className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-lg cursor-pointer w-fit hover:bg-yellow-600 transition">
                        <Upload size={16} /> {uploading ? 'Mengupload...' : 'Upload Bukti Transfer'}
                        <input type="file" accept="image/*" onChange={handleUploadProof} disabled={uploading} className="hidden" />
                      </label>
                      <p className="text-xs text-gray-400 mt-1">Format: JPG, PNG (max 2MB)</p>
                    </div>
                  )}
                  {order.payment_proof_url && (
                    <div className="mt-4">
                      <p className="text-green-500 text-sm flex items-center gap-1"><CheckCircle size={14} /> Bukti sudah diupload</p>
                      <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-yellow-500 text-sm underline flex items-center gap-1 mt-1">
                        <Eye size={14} /> Lihat bukti transfer
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========== TAB TRACKING ========== */}
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
                      <a
                        href={`https://wa.me/${courier.phone.replace(/[^0-9]/g, '')}?text=Halo%20kak%20kurir,%20saya%20ingin%20menanyakan%20pesanan%20saya%20dengan%20nomor%20%23${order.order_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs hover:bg-green-500/30 transition"
                      >
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