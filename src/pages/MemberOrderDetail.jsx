// ========== FILE: src/pages/MemberOrderDetail.jsx ==========
// Detail pesanan member + upload bukti transfer + tracking peta
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import TrackingMap from '../components/TrackingMap';
import { ArrowLeft, MapPin, Calendar, Package, Upload, CheckCircle, AlertCircle, Download, Truck, Eye, XCircle, MessageCircle } from 'lucide-react';
import { calculateETA } from '../services/etaService';

export default function MemberOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  
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
    setOrder(orderData);
    
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
    
    // Step 5: Ambil delivery assignment
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
        
        // Ambil tracking points terbaru
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
    
    // Step 6: Ambil polyline (prioritas: start_route_polyline → distance_cache)
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
        
        // Update lokasi kurir
        console.log('🎯 Setting courier location to:', [lat, lng]);
        setCourierLocation([lat, lng]);
        
        // Hitung ETA
        if (destLat && destLng && lat && lng) {
          const newEta = await calculateETA(lat, lng, destLat, destLng, storeIdData, addressIdData);
          setEta(newEta);
        }
        
        // Update map center
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
    
    // Timeout detection
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
    
    const confirmed = window.confirm(`Upload bukti transfer untuk pesanan #${order.order_number}?\n\nFile: ${file.name}\n\nPastikan bukti transfer sesuai dengan nominal Rp ${order.total_amount?.toLocaleString()}`);
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
      .update({ status: 'cancellation_requested', notes: `Permintaan pembatalan oleh member pada ${new Date().toLocaleString()}` })
      .eq('id', id);
    if (error) alert('Gagal mengajukan pembatalan: ' + error.message);
    else {
      alert('Permintaan pembatalan telah dikirim ke admin.');
      fetchOrder();
    }
    setCancelling(false);
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

  const storeLocation = store?.latitude && store?.longitude ? [store.latitude, store.longitude] : null;
  const destination = order?.shipping_latitude && order?.shipping_longitude ? [order.shipping_latitude, order.shipping_longitude] : null;
  const showTrackingTab = delivery && delivery?.status !== 'completed' && delivery?.status !== 'cancelled';
  const canUpload = order?.status === 'pending' && !order?.payment_proof_url;
  const canCancel = order?.status === 'pending';
  const canRequestCancellation = ['paid', 'processing'].includes(order?.status);
  const subtotal = (order?.total_amount || 0) - (order?.shipping_cost || 0);

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  if (!order) return <div className="bg-black min-h-screen text-white p-8 text-center">Pesanan tidak ditemukan</div>;

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

          {/* ========== TAB DETAIL ========== */}
          {activeTab === 'detail' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h2 className="font-semibold mb-2"><Package size={16} /> Produk</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                    {items.map(item => (
                      <div key={item.id} className="flex justify-between text-sm border-b border-white/5 pb-1">
                        <span>{item.product_name} x{item.quantity}</span>
                        <span>Rp {item.total?.toLocaleString()}</span>
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
                <div>
                  <h2 className="font-semibold mb-2"><MapPin size={16} /> Alamat Pengiriman</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    {address ? <p className="text-sm">{address.address_text}</p> : <p className="text-sm">{order.shipping_address}</p>}
                  </div>
                  <h2 className="font-semibold mt-4 mb-2"><Calendar size={16} /> Tanggal Pesan</h2>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Instruksi Pembayaran */}
              <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                <h3 className="font-semibold text-yellow-500 mb-2">Instruksi Pembayaran</h3>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="font-mono text-sm">{store?.bank_name || 'BCA'}</p>
                  <p className="font-mono text-lg font-bold">{store?.bank_account_number || '1234567890'}</p>
                  <p className="text-sm">a.n. {store?.bank_account_name || 'PWM Store'}</p>
                </div>
                <p className="text-sm mt-2">Nominal: <span className="font-bold text-yellow-500">Rp {order.total_amount.toLocaleString()}</span></p>
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