// ========== FILE: src/pages/CourierDashboard.jsx ==========
// Dashboard untuk kurir - multiple assignments support
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  Package, MapPin, Truck, CheckCircle, Clock, 
  Navigation, Phone, LogOut, Play, StopCircle, ChevronDown, ChevronUp
} from 'lucide-react';

export default function CourierDashboard() {
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [completedDeliveries, setCompletedDeliveries] = useState([]);
  const [expandedDelivery, setExpandedDelivery] = useState(null);
  const [trackingStates, setTrackingStates] = useState({});
  const [processingDelivery, setProcessingDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
      // Ambil delivery assignments
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
      
      // Ambil orders
      const orderIds = assignments.map(a => a.order_id);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, shipping_address, shipping_latitude, shipping_longitude, guest_name, guest_phone, notes, store_id, status')
        .in('id', orderIds);
      
      if (ordersError) throw ordersError;
      
      // Ambil stores
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
      
      // Gabungkan data
      const enriched = assignments.map(assignment => {
        const order = orders?.find(o => o.id === assignment.order_id);
        const store = order ? storesMap.get(order.store_id) : null;
        return {
          ...assignment,
          orders: order ? { ...order, stores: store } : null
        };
      });
      
      setAssignments(enriched);
      
      // Pisahkan active (belum selesai) dan completed
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
    
    const id = navigator.geolocation.watchPosition(
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
        
        console.log('📍 Location sent:', latitude, longitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (error.code === 1) alert('Izin lokasi ditolak.');
        else if (error.code === 2) alert('Lokasi tidak tersedia.');
        else if (error.code === 3) alert('Timeout获取 lokasi.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    
    setTrackingStates(prev => ({ ...prev, [deliveryId]: { watchId: id, active: true } }));
    
    // Broadcast status aktif
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
    if (state?.watchId) {
      navigator.geolocation.clearWatch(state.watchId);
      setTrackingStates(prev => ({ ...prev, [deliveryId]: { watchId: null, active: false } }));
      
      // Broadcast status tidak aktif
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
      
      // ===== HITUNG RUTE DARI POSISI KURIR SAAT INI =====
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
        
        console.log('📍 Start route from:', courierLat, courierLng);
        console.log('📍 Destination:', destLat, destLng);
        
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
          console.log('Route API response:', data);
          
          if (data.success) {
            updates.start_route_polyline = data.polyline;
            updates.start_distance_meters = data.distanceMeters;
            updates.start_duration_seconds = data.durationSeconds;
            console.log('✅ Start route saved, polyline length:', data.polyline?.length);
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
    } else {
      if (shouldUpdateOrderStatus) {
        await supabase
          .from('orders')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('id', delivery.order_id);
        alert('Pesanan telah selesai!');
      }
      await loadAssignments(user.id);
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
      {/* Header */}
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
        
        {/* ========== ACTIVE DELIVERIES ========== */}
        <div className="mb-6">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Truck size={14} className="text-yellow-500" />
            Pengiriman Aktif ({activeDeliveries.length})
          </h2>
          
          {activeDeliveries.length === 0 ? (
            <div className="bg-gray-900/50 rounded-xl p-6 text-center border border-white/10">
              <Truck size={48} className="mx-auto text-gray-500 mb-3" />
              <p className="text-gray-400">Tidak ada pengiriman aktif</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeDeliveries.map(delivery => (
                <div key={delivery.id} className="bg-gray-900/50 rounded-xl border border-yellow-500/30 overflow-hidden">
                  <button
                    onClick={() => setExpandedDelivery(expandedDelivery === delivery.id ? null : delivery.id)}
                    className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition"
                  >
                    <div>
                      <p className="font-semibold">Order #{delivery.orders?.order_number}</p>
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
                      {/* Info Order */}
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Total:</span>
                          <span className="text-yellow-500">Rp {delivery.orders?.total_amount?.toLocaleString()}</span>
                        </div>
                        <div className="text-sm mb-1">
                          <span className="text-gray-400">Alamat:</span>
                          <p className="text-xs text-gray-300 mt-1">{delivery.orders?.shipping_address}</p>
                        </div>
                        {delivery.orders?.guest_name && (
                          <div className="text-sm">
                            <span className="text-gray-400">Penerima:</span>
                            <span className="ml-2">{delivery.orders.guest_name}</span>
                            {delivery.orders.guest_phone && (
                              <a href={`tel:${delivery.orders.guest_phone}`} className="ml-2 text-blue-400">
                                <Phone size={12} className="inline" /> {delivery.orders.guest_phone}
                              </a>
                            )}
                          </div>
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
                          <button
                            onClick={() => updateDeliveryStatus(delivery.id, 'completed')}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={16} /> Tandai Selesai
                          </button>
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
              ))}
            </div>
          )}
        </div>
        
        {/* ========== RIWAYAT PENGIRIMAN ========== */}
        <div className="mt-6">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock size={14} /> Riwayat Pengiriman ({completedDeliveries.length})
          </h3>
          
          {completedDeliveries.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Belum ada riwayat</p>
          ) : (
            <div className="space-y-2">
              {completedDeliveries.map(delivery => (
                <div key={delivery.id} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">Order #{delivery.orders?.order_number}</p>
                      <p className="text-xs text-gray-400">
                        Selesai: {new Date(delivery.completed_at || delivery.updated_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Selesai</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}