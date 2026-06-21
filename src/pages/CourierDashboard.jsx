// ========== FILE: src/pages/CourierDashboard.jsx ==========
// Dashboard untuk kurir - multiple assignments support
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  Package, MapPin, Truck, CheckCircle, Clock, 
  Navigation, Phone, LogOut, Play, StopCircle, ChevronDown, ChevronUp, MessageCircle, Gift
} from 'lucide-react';
import SlideToConfirm from '../components/SlideToConfirm';

export default function CourierDashboard() {
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [completedDeliveries, setCompletedDeliveries] = useState([]);
  const [expandedDelivery, setExpandedDelivery] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [trackingStates, setTrackingStates] = useState({});
  const [processingDelivery, setProcessingDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const navigate = useNavigate();

        // ============================================================
      // FORMAT WAKTU WIB (DENGAN TAMBAH 7 JAM)
      // ============================================================
      const formatWIB = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        // Tambah 7 jam (WIB = UTC+7)
        date.setHours(date.getHours() + 7);
        return date.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatDateWIB = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        date.setHours(date.getHours() + 7);
        return date.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      };

  // ========== CEK USER & LOAD DATA ==========
  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/admin/login');
      return;
    }
    
    const { data: userData, error } = await supabase
      .from('users')
      .select('role, full_name, email, phone')
      .eq('id', user.id)
      .single();
    
    if (error || userData?.role !== 'courier') {
      alert('Akun ini bukan kurir. Hubungi admin.');
      navigate('/admin/login');
      return;
    }
    
    setUser(userData);
    await loadAssignments(user.id);
    setLoading(false);
  };

  const loadAssignments = async (courierId) => {
  setLoading(true);
  
  try {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('delivery_assignments')
      .select('*')
      .eq('courier_id', courierId)
      .order('created_at', { ascending: false });
    
    if (assignmentsError) throw assignmentsError;
    
    if (!assignments || assignments.length === 0) {
      setAssignments([]);
      setActiveDeliveries([]);
      setCompletedDeliveries([]);
      setLoading(false);
      return;
    }
    
    const orderIds = assignments.map(a => a.order_id);
    
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id, 
        order_number, 
        total_amount,
        final_total,
        shipping_cost, 
        voucher_discount,
        shipping_address, 
        shipping_latitude, 
        shipping_longitude, 
        guest_name, 
        guest_phone, 
        notes, 
        store_id, 
        status,
        created_at,
        member_id,
        upsell_items,
        order_items (
          product_name,
          quantity,
          total,
          discounted_price,
          original_price
        )
      `)
      .in('id', orderIds);
    
    if (ordersError) throw ordersError;

    // ============================================================
    // 🔥 AMBIL order_vouchers UNTUK CEK TIPE VOUCHER
    // ============================================================
    const { data: orderVouchers, error: ovError } = await supabase
      .from('order_vouchers')
      .select(`
        order_id,
        voucher_id,
        discount_applied,
        vouchers (
          id,
          name,
          type
        )
      `)
      .in('order_id', orderIds);

    if (ovError) {
      console.error('Error fetching order_vouchers:', ovError);
    }

    // Map: order_id → apakah ada voucher shipping_free
    const shippingFreeMap = new Map();
    (orderVouchers || []).forEach(ov => {
      if (ov.vouchers?.type === 'shipping_free') {
        shippingFreeMap.set(ov.order_id, true);
      }
    });

    // Log untuk debugging
    console.log('📊 shippingFreeMap:', Array.from(shippingFreeMap.entries()));

    const memberIds = [...new Set((orders || []).filter(o => o.member_id).map(o => o.member_id))];
    let membersMap = new Map();

    if (memberIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('users')
        .select('id, full_name, phone, email')
        .in('id', memberIds);
      
      if (!membersError && members) {
        members.forEach(m => membersMap.set(m.id, m));
      }
    }
    
    const storeIds = [...new Set((orders || []).map(o => o.store_id).filter(id => id))];
    let storesMap = new Map();
    
    if (storeIds.length > 0) {
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id, name, latitude, longitude, address')
        .in('id', storeIds);
      
      if (!storesError && stores) {
        stores.forEach(s => storesMap.set(s.id, s));
      }
    }
    
    // ============================================================
    // ENRICH DATA - PASTIKAN is_shipping_free UNTUK SEMUA ORDER
    // ============================================================
    const enriched = assignments.map(assignment => {
      const order = orders?.find(o => o.id === assignment.order_id);
      const store = order ? storesMap.get(order.store_id) : null;
      const member = order?.member_id ? membersMap.get(order.member_id) : null;
      
      let customerName = 'Guest';
      let customerPhone = '-';
      
      if (order?.guest_name) {
        customerName = order.guest_name;
        customerPhone = order.guest_phone || '-';
      } else if (member) {
        customerName = member.full_name || 'Member';
        customerPhone = member.phone || '-';
      }
      
      let allItems = [];
      
      if (order?.order_items && order.order_items.length > 0) {
        allItems = allItems.concat(order.order_items.map(item => ({
          ...item,
          is_upsell: false
        })));
      }
      
      if (order?.upsell_items && Array.isArray(order.upsell_items) && order.upsell_items.length > 0) {
        const upsellItems = order.upsell_items.map(upsell => ({
          product_name: upsell.name || 'Produk Upsell',
          quantity: upsell.quantity || 1,
          total: (upsell.discounted_price || upsell.price || 0) * (upsell.quantity || 1),
          is_upsell: true,
          discounted_price: upsell.discounted_price || upsell.price || 0,
          original_price: upsell.price || 0
        }));
        allItems = allItems.concat(upsellItems);
      }
      
      // ✅ PASTIKAN is_shipping_free DIAMBIL DARI MAP
      const isShippingFree = shippingFreeMap.get(order?.id) || false;
      
      const enrichedOrder = order ? { 
        ...order, 
        stores: store,
        customer_name: customerName,
        customer_phone: customerPhone,
        all_items: allItems,
        is_shipping_free: isShippingFree  // ← PASTIKAN INI
      } : null;
      
      return {
        ...assignment,
        orders: enrichedOrder
      };
    });
    
    setAssignments(enriched);
    
    // Pisahkan active dan completed
    const active = enriched.filter(a => {
      const deliveryNotFinished = a.status !== 'completed' && a.status !== 'cancelled';
      const orderNotFinished = a.orders?.status !== 'delivered' && a.orders?.status !== 'cancelled';
      return deliveryNotFinished && orderNotFinished;
    });
    
    const completed = enriched.filter(a => a.status === 'completed' || a.orders?.status === 'delivered');
    
    setActiveDeliveries(active);
    setCompletedDeliveries(completed);
    
  } catch (err) {
    console.error('Error loading assignments:', err);
  }
  
  setLoading(false);
};

  // ========== TRACKING GPS ==========
  const startTracking = async (deliveryId) => {
    const delivery = assignments.find(a => a.id === deliveryId);
    if (!delivery) return;
    
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung GPS');
      return;
    }
    
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    if (permission.state === 'denied') {
      alert('Izin lokasi ditolak. Silakan izinkan di pengaturan browser.');
      return;
    }
    
    let intervalId = null;
    
    const sendLocation = async () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, heading } = position.coords;
          
          const channel = supabase.channel(`tracking:${deliveryId}`);
          await channel.send({
            type: 'broadcast',
            event: 'location-update',
            payload: { lat: latitude, lng: longitude, heading: heading || 0, timestamp: new Date().toISOString() }
          });
          
          await supabase.from('tracking_points').insert({
            delivery_id: deliveryId,
            latitude, longitude,
            recorded_at: new Date().toISOString()
          });
          
          console.log('📍 Location sent (10s interval):', latitude, longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };
    
    await sendLocation();
    intervalId = setInterval(sendLocation, 10000);
    
    setTrackingStates(prev => ({ 
      ...prev, 
      [deliveryId]: { intervalId, active: true } 
    }));
    
    try {
      const statusChannel = supabase.channel(`tracking:${deliveryId}`);
      await statusChannel.send({
        type: 'broadcast',
        event: 'tracking-status',
        payload: { status: 'active' }
      });
      console.log('📡 Tracking status broadcast: active');
    } catch (err) {
      console.error('Failed to broadcast tracking status:', err);
    }
    
    if (delivery.status === 'assigned') {
      await updateDeliveryStatus(deliveryId, 'picking_up');
    }
  };
  
  const stopTracking = (deliveryId) => {
    const state = trackingStates[deliveryId];
    if (state?.intervalId) {
      clearInterval(state.intervalId);
      setTrackingStates(prev => ({ ...prev, [deliveryId]: { intervalId: null, active: false } }));
      
      (async () => {
        try {
          const statusChannel = supabase.channel(`tracking:${deliveryId}`);
          await statusChannel.send({
            type: 'broadcast',
            event: 'tracking-status',
            payload: { status: 'inactive' }
          });
          console.log('📡 Tracking status broadcast: inactive');
        } catch (err) {
          console.error('Failed to broadcast tracking status:', err);
        }
      })();
    }
  };
  
  // ========== UPDATE STATUS DELIVERY ==========
  const updateDeliveryStatus = async (deliveryId, newStatus) => {
    const delivery = assignments.find(a => a.id === deliveryId);
    if (!delivery) return;
    
    const updates = { status: newStatus };
    let shouldUpdateOrderStatus = false;
    
    if (newStatus === 'on_delivery' && !delivery.started_at) {
      updates.started_at = new Date().toISOString();
      
      console.log('===== CALCULATING START ROUTE =====');
      try {
        const getCurrentPosition = () => new Promise((resolve, reject) => {
          if (!navigator.geolocation) reject('Geolocation not supported');
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            enableHighAccuracy: true, 
            timeout: 10000 
          });
        });
        
        const position = await getCurrentPosition();
        const courierLat = position.coords.latitude;
        const courierLng = position.coords.longitude;
        const destLat = delivery.orders?.shipping_latitude;
        const destLng = delivery.orders?.shipping_longitude;
        
        if (destLat && destLng) {
          const response = await fetch('/api/shipping/route-from-current', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courierLat,
              courierLng,
              destinationLat: destLat,
              destinationLng: destLng,
              storeId: delivery.orders?.store_id
            })
          });
          const data = await response.json();
          
          if (data.success) {
            updates.start_route_polyline = data.polyline;
            updates.start_distance_meters = data.distanceMeters;
            updates.start_duration_seconds = data.durationSeconds;
            console.log('✅ Start route saved, polyline length:', data.polyline?.length);
            
            try {
              supabase
                .channel(`tracking:${deliveryId}`)
                .send({
                  type: 'broadcast',
                  event: 'route-updated',
                  payload: { polyline: data.polyline }
                })
                .then(() => console.log('📡 Route update broadcast sent'))
                .catch(err => console.error('Failed to broadcast route update:', err));
            } catch (broadcastErr) {
              console.error('Broadcast error:', broadcastErr);
            }
          } else {
            console.error('Route API failed:', data.error);
          }
        }
      } catch (err) {
        console.error('Failed to get start route:', err);
      }
    }
    
    if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
      stopTracking(deliveryId);
      shouldUpdateOrderStatus = true;
    }
    
    const { error } = await supabase
      .from('delivery_assignments')
      .update(updates)
      .eq('id', deliveryId);
    
    if (error) {
      alert('Gagal update status: ' + error.message);
      return;
    }
    
    if (shouldUpdateOrderStatus) {
      await supabase
        .from('orders')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', delivery.order_id);
      alert('Pesanan telah selesai!');
    }
    
    setAssignments(prev => prev.map(a => 
      a.id === deliveryId ? { ...a, ...updates } : a
    ));
    
    if (newStatus === 'completed') {
      setActiveDeliveries(prev => prev.filter(a => a.id !== deliveryId));
      setCompletedDeliveries(prev => [...prev, { ...delivery, ...updates }]);
    } else {
      setActiveDeliveries(prev => prev.map(a => 
        a.id === deliveryId ? { ...a, ...updates } : a
      ));
    }
  };
  
  // ========== BUKA NAVIGASI ==========
  const openNavigation = (delivery) => {
    if (!delivery.orders?.shipping_latitude) {
      alert('Alamat tujuan tidak tersedia');
      return;
    }
    const dest = `${delivery.orders.shipping_latitude},${delivery.orders.shipping_longitude}`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
  };
  
  // ========== LOGOUT ==========
  const handleLogout = async () => {
    Object.keys(trackingStates).forEach(deliveryId => {
      if (trackingStates[deliveryId]?.active) stopTracking(deliveryId);
    });
    await supabase.auth.signOut();
    navigate('/admin/login');
  };
  
  // ========== RENDER ==========
  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  
  return (
    <div className="bg-black min-h-screen text-white">
      <div className="bg-gray-900/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-display">Kurir Dashboard</h1>
            <p className="text-xs text-gray-400">{user?.full_name || user?.email}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-gray-400 hover:text-red-400 text-sm">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">
        
        {/* ========== TAB NAVIGATION ========== */}
        <div className="flex border-b border-white/10 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-2 px-4 text-sm font-medium transition-all relative ${
              activeTab === 'active' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            🚚 Pengiriman Aktif ({activeDeliveries.length})
            {activeTab === 'active' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-4 text-sm font-medium transition-all relative ${
              activeTab === 'history' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            📋 Riwayat ({completedDeliveries.length})
            {activeTab === 'history' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
          </button>
        </div>

        {/* ========== TAB: PENGIRIMAN AKTIF ========== */}
        {activeTab === 'active' && (
          <>
            {activeDeliveries.length === 0 ? (
              <div className="bg-gray-900/50 rounded-xl p-6 text-center border border-white/10">
                <Truck size={48} className="mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400">Tidak ada pengiriman aktif</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeDeliveries.map(delivery => {
                  const order = delivery.orders;
                  const finalTotal = order?.final_total || order?.total_amount || 0;
                  const shippingCost = order?.shipping_cost || 0;
                  const voucherDiscount = order?.voucher_discount || 0;
                  const isShippingFree = order?.is_shipping_free || false;

                  return (
                    <div key={delivery.id} className="bg-gray-900/50 rounded-xl border border-yellow-500/30 overflow-hidden">
                      <button
                        onClick={() => setExpandedDelivery(expandedDelivery === delivery.id ? null : delivery.id)}
                        className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition"
                      >
                        <div>
                          <p className="font-semibold">Order #{order?.order_number}</p>
                          <p className="text-xs text-gray-400">
                            {delivery.status === 'assigned' ? 'Menunggu Pickup' : 
                             delivery.status === 'picking_up' ? 'Pickup' : 
                             delivery.status === 'on_delivery' ? 'Dalam Perjalanan' : delivery.status}
                          </p>
                        </div>
                        {expandedDelivery === delivery.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                      
                      {expandedDelivery === delivery.id && (
                        <div className="p-4 pt-0 border-t border-white/10 space-y-3">
                          
                          {/* 1. BARANG DIPESAN (CART + UPSEL) */}
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <h4 className="text-xs font-semibold text-gray-400 mb-1">📦 Barang Dipesan:</h4>
                            <div className="space-y-1">
                              {order?.all_items && order.all_items.length > 0 ? (
                                order.all_items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-xs">
                                    <span>
                                      {item.is_upsell && <span className="text-yellow-500">+ </span>}
                                      {item.product_name} x{item.quantity}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-gray-500">-</p>
                              )}
                            </div>
                            <div className="border-t border-white/10 mt-2 pt-2">
                             
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Ongkos Kirim:</span>
                                <span className={isShippingFree ? 'line-through text-gray-500' : ''}>
                                  Rp {shippingCost.toLocaleString()}
                                  {isShippingFree && <span className="text-green-400 ml-1">(Gratis!)</span>}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm font-semibold mt-1">
                                <span>Total:</span>
                                <span className="text-yellow-500">Rp {finalTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 2. ALAMAT PENGIRIMAN */}
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <h4 className="text-xs font-semibold text-gray-400 mb-1">📍 Alamat Pengiriman:</h4>
                            <p className="text-xs">{order?.shipping_address || '-'}</p>
                          </div>
                          
                          {/* 3. INFO PEMESAN + TOMBOL WA */}
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <h4 className="text-xs font-semibold text-gray-400 mb-1">👤 Info Pemesan:</h4>
                              {order?.customer_phone && order.customer_phone !== '-' && (
                                <a
                                  href={`https://wa.me/${order.customer_phone.replace(/[^0-9]/g, '')}?text=Halo%20kak,%20saya%20kurir%20dari%20${order?.stores?.name || 'PWM'}%20sedang%20mengantarkan%20pesanan%20anda%20dengan%20nomor%20%23${order.order_number}.%20Mohon%20disediakan%20waktunya.`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs hover:bg-green-500/30 transition"
                                >
                                  <MessageCircle size={12} /> Hubungi Pemesan
                                </a>
                              )}
                            </div>
                            <p className="text-xs mt-1">Nama: {order?.customer_name || 'Guest'}</p>
                            <p className="text-xs">No. HP: {order?.customer_phone || '-'}</p>
                            {order?.notes && (
                              <p className="text-xs text-gray-400 mt-1">Catatan: {order.notes}</p>
                            )}
                          </div>
                          
                          {/* Tombol Aksi */}
                          <div className="space-y-2">
                            <button
                              onClick={() => openNavigation(delivery)}
                              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                            >
                              <Navigation size={16} /> Buka Navigasi
                            </button>
                            
                            {!trackingStates[delivery.id]?.active ? (
                              <button
                                onClick={() => startTracking(delivery.id)}
                                className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                              >
                                <Play size={16} /> Mulai Tracking GPS
                              </button>
                            ) : (
                              <button
                                onClick={() => stopTracking(delivery.id)}
                                className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                              >
                                <StopCircle size={16} /> Hentikan Tracking
                              </button>
                            )}
                            
                            {delivery.status === 'assigned' && (
                              <button
                                onClick={() => updateDeliveryStatus(delivery.id, 'picking_up')}
                                className="w-full bg-yellow-600 hover:bg-yellow-700 py-2 rounded-lg text-sm font-semibold"
                              >
                                Ambil Pesanan di Store
                              </button>
                            )}
                            
                            {delivery.status === 'picking_up' && (
                              <button
                                onClick={() => {
                                  setProcessingDelivery(delivery.id);
                                  updateDeliveryStatus(delivery.id, 'on_delivery').finally(() => {
                                    setProcessingDelivery(null);
                                  });
                                }}
                                disabled={processingDelivery === delivery.id}
                                className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {processingDelivery === delivery.id ? 'Memproses...' : 'Mulai Antar ke Pelanggan'}
                              </button>
                            )}
                            
                            {delivery.status === 'on_delivery' && (
                              <SlideToConfirm
                                onConfirm={() => updateDeliveryStatus(delivery.id, 'completed')}
                                text="Geser ke kanan untuk menyelesaikan pengiriman"
                                disabled={processingDelivery === delivery.id}
                              />
                            )}
                          </div>
                          
                          {trackingStates[delivery.id]?.active && (
                            <div className="text-center">
                              <div className="inline-flex items-center gap-2 text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                Live Tracking Aktif
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ========== TAB: RIWAYAT PENGIRIMAN ========== */}
        {activeTab === 'history' && (
          <>
            {completedDeliveries.length === 0 ? (
              <div className="bg-gray-900/50 rounded-xl p-6 text-center border border-white/10">
                <Clock size={48} className="mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400">Belum ada riwayat pengiriman</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedDeliveries.map(delivery => {
                  const order = delivery.orders;
                  const finalTotal = order?.final_total || order?.total_amount || 0;
                  const completedDate = delivery.completed_at || delivery.updated_at;
                  const shippingCost = order?.shipping_cost || 0;
                  const voucherDiscount = order?.voucher_discount || 0;
                  const isShippingFree = order?.is_shipping_free || false;
                  
                  return (
                    <div key={delivery.id} className="bg-gray-900/50 rounded-xl border border-green-500/30 overflow-hidden">
                      <button
                        onClick={() => setExpandedHistory(expandedHistory === delivery.id ? null : delivery.id)}
                        className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition"
                      >
                        <div>
                          <p className="font-semibold">Order #{order?.order_number}</p>
                          <p className="text-xs text-gray-400">
                            Selesai: {formatWIB(completedDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Selesai</span>
                          {expandedHistory === delivery.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </button>
                      
                      {expandedHistory === delivery.id && (
                        <div className="p-4 pt-0 border-t border-white/10 space-y-3">
                          
                          {/* 1. BARANG DIPESAN (CART + UPSEL) */}
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <h4 className="text-xs font-semibold text-gray-400 mb-1">📦 Barang Dipesan:</h4>
                            <div className="space-y-1">
                              {order?.all_items && order.all_items.length > 0 ? (
                                order.all_items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-xs">
                                    <span>
                                      {item.is_upsell && <span className="text-yellow-500">+ </span>}
                                      {item.product_name} x{item.quantity}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-gray-500">-</p>
                              )}
                            </div>
                            <div className="border-t border-white/10 mt-2 pt-2">
                              
<div className="flex justify-between text-xs">
  <span className="text-gray-400">Ongkos Kirim:</span>
  <span className={isShippingFree ? 'line-through text-gray-500' : ''}>
    Rp {shippingCost.toLocaleString()}
    {isShippingFree && <span className="text-green-400 ml-1">(Gratis!)</span>}
  </span>
</div>
                              <div className="flex justify-between text-sm font-semibold mt-1">
                                <span>Total:</span>
                                <span className="text-yellow-500">Rp {finalTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 2. ALAMAT PENGIRIMAN */}
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <h4 className="text-xs font-semibold text-gray-400 mb-1">📍 Alamat Pengiriman:</h4>
                            <p className="text-xs">{order?.shipping_address || '-'}</p>
                          </div>
                          
                          {/* 3. INFO PEMESAN (TANPA TOMBOL WA) */}
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <h4 className="text-xs font-semibold text-gray-400 mb-1">👤 Info Pemesan:</h4>
                            <p className="text-xs mt-1">Nama: {order?.customer_name || 'Guest'}</p>
                            <p className="text-xs">No. HP: {order?.customer_phone || '-'}</p>
                            {order?.notes && (
                              <p className="text-xs text-gray-400 mt-1">Catatan: {order.notes}</p>
                            )}
                          </div>
                          
                          {/* 4. INFO WAKTU */}
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Mulai Pengiriman:</span>
                              <span>{delivery.started_at ? formatWIB(delivery.started_at) : '-'}</span>
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                              <span className="text-gray-400">Selesai:</span>
                              <span className="text-green-400">{formatWIB(completedDate)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}