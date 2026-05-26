// ========== FILE: src/pages/CourierDashboard.jsx ==========
// Dashboard untuk kurir (PWA-ready)
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  Package, MapPin, Truck, CheckCircle, Clock, 
  Navigation, Phone, LogOut, Play, StopCircle
} from 'lucide-react';

export default function CourierDashboard() {
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [watchId, setWatchId] = useState(null);
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
    
    // Cek role user
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
      // Step 1: Ambil delivery assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('delivery_assignments')
        .select('*')
        .eq('courier_id', courierId)
        .order('created_at', { ascending: false });
      
      if (assignmentsError) throw assignmentsError;
      
      if (!assignments || assignments.length === 0) {
        setAssignments([]);
        setActiveDelivery(null);
        setLoading(false);
        return;
      }
      
      // Step 2: Ambil orders
      const orderIds = assignments.map(a => a.order_id);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, shipping_address, shipping_latitude, shipping_longitude, guest_name, guest_phone, notes, store_id, status')
        .in('id', orderIds);
      
      if (ordersError) throw ordersError;
      
      // Step 3: Ambil stores
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
      
      // Step 4: Gabungkan data
      const enrichedAssignments = assignments.map(assignment => {
        const order = orders?.find(o => o.id === assignment.order_id);
        const store = order ? storesMap.get(order.store_id) : null;
        
        return {
          ...assignment,
          orders: order ? { ...order, stores: store } : null
        };
      });
      
      setAssignments(enrichedAssignments);
      
      // Cari active delivery (status delivery belum selesai DAN order status belum delivered/cancelled)
      const active = enrichedAssignments.find(a => {
        const deliveryNotFinished = a.status !== 'completed' && a.status !== 'cancelled';
        const orderNotFinished = a.orders?.status !== 'delivered' && a.orders?.status !== 'cancelled';
        return deliveryNotFinished && orderNotFinished;
      });
      setActiveDelivery(active || null);
      
    } catch (err) {
      console.error('Error loading assignments:', err);
    }
    
    setLoading(false);
  };

  // ========== FUNGSI TRACKING GPS ==========
  const startTracking = async () => {
    if (!activeDelivery) {
      alert('Tidak ada pengiriman aktif');
      return;
    }
    
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung GPS');
      return;
    }
    
    // Minta izin lokasi
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    if (permission.state === 'denied') {
      alert('Izin lokasi ditolak. Silakan izinkan di pengaturan browser.');
      return;
    }
    
    // Mulai watch position
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, heading } = position.coords;
        
        // Broadcast ke Supabase Realtime
        const channel = supabase.channel(`tracking:${activeDelivery.id}`);
        await channel.send({
          type: 'broadcast',
          event: 'location-update',
          payload: {
            lat: latitude,
            lng: longitude,
            heading: heading || 0,
            timestamp: new Date().toISOString()
          }
        });
        
        // Simpan ke tracking_points untuk riwayat
        await supabase
          .from('tracking_points')
          .insert({
            delivery_id: activeDelivery.id,
            latitude,
            longitude,
            recorded_at: new Date().toISOString()
          });
        
        console.log('📍 Location sent:', latitude, longitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (error.code === 1) {
          alert('Izin lokasi ditolak. Aktifkan GPS untuk tracking.');
        } else if (error.code === 2) {
          alert('Lokasi tidak tersedia. Pastikan GPS aktif.');
        } else if (error.code === 3) {
          alert('Timeout获取 lokasi. Coba lagi.');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
    
    setWatchId(id);
    setTrackingActive(true);
    
    // Update status delivery jika masih assigned
    if (activeDelivery.status === 'assigned') {
      await updateDeliveryStatus('picking_up');
    }
  };
  
  const stopTracking = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setTrackingActive(false);
  };
  
  // ========== UPDATE STATUS DELIVERY ==========
  const updateDeliveryStatus = async (newStatus) => {
    if (!activeDelivery) return;
    
    const updates = { status: newStatus };
    if (newStatus === 'on_delivery' && !activeDelivery.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
      if (trackingActive) stopTracking();
    }
    
    const { error } = await supabase
      .from('delivery_assignments')
      .update(updates)
      .eq('id', activeDelivery.id);
    
    if (error) {
      alert('Gagal update status: ' + error.message);
    } else {
      await loadAssignments(user.id);
    }
  };
  
  // ========== BUKA NAVIGASI ==========
  const openNavigation = () => {
    if (!activeDelivery || !activeDelivery.orders?.shipping_latitude) {
      alert('Alamat tujuan tidak tersedia');
      return;
    }
    
    const dest = `${activeDelivery.orders.shipping_latitude},${activeDelivery.orders.shipping_longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    window.open(url, '_blank');
  };
  
  // ========== LOGOUT ==========
  const handleLogout = async () => {
    if (trackingActive) stopTracking();
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
        {/* ========== ACTIVE DELIVERY ========== */}
        {activeDelivery ? (
          <div className="bg-gray-900/50 rounded-xl p-5 border border-yellow-500/30 mb-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Truck size={20} className="text-yellow-500" />
                  Pengiriman Aktif
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Order #{activeDelivery.orders?.order_number}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                activeDelivery.status === 'assigned' ? 'bg-yellow-500/20 text-yellow-500' :
                activeDelivery.status === 'picking_up' ? 'bg-blue-500/20 text-blue-400' :
                activeDelivery.status === 'on_delivery' ? 'bg-green-500/20 text-green-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {activeDelivery.status === 'assigned' ? 'Menunggu Pickup' :
                 activeDelivery.status === 'picking_up' ? 'Pickup' :
                 activeDelivery.status === 'on_delivery' ? 'Dalam Perjalanan' :
                 activeDelivery.status}
              </span>
            </div>
            
            {/* Info Order */}
            <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Total:</span>
                <span className="text-yellow-500">Rp {activeDelivery.orders?.total_amount?.toLocaleString()}</span>
              </div>
              <div className="text-sm mb-1">
                <span className="text-gray-400">Alamat:</span>
                <p className="text-xs text-gray-300 mt-1">{activeDelivery.orders?.shipping_address}</p>
              </div>
              {activeDelivery.orders?.guest_name && (
                <div className="text-sm">
                  <span className="text-gray-400">Penerima:</span>
                  <span className="ml-2">{activeDelivery.orders.guest_name}</span>
                  {activeDelivery.orders.guest_phone && (
                    <a href={`tel:${activeDelivery.orders.guest_phone}`} className="ml-2 text-blue-400">
                      <Phone size={12} className="inline" /> {activeDelivery.orders.guest_phone}
                    </a>
                  )}
                </div>
              )}
            </div>
            
            {/* Tombol Aksi */}
            <div className="space-y-3">
              <button
                onClick={openNavigation}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Navigation size={18} /> Buka Navigasi Google Maps
              </button>
              
              {!trackingActive ? (
                <button
                  onClick={startTracking}
                  className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  <Play size={18} /> Mulai Tracking GPS
                </button>
              ) : (
                <button
                  onClick={stopTracking}
                  className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  <StopCircle size={18} /> Hentikan Tracking
                </button>
              )}
              
              {activeDelivery.status === 'assigned' && (
                <button
                  onClick={() => updateDeliveryStatus('picking_up')}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 py-3 rounded-lg font-semibold"
                >
                  Ambil Pesanan di Store
                </button>
              )}
              
              {activeDelivery.status === 'picking_up' && (
                <button
                  onClick={() => updateDeliveryStatus('on_delivery')}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
                >
                  Mulai Antar ke Pelanggan
                </button>
              )}
              
              {activeDelivery.status === 'on_delivery' && (
                <button
                  onClick={() => updateDeliveryStatus('completed')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} /> Tandai Selesai
                </button>
              )}
            </div>
            
            {/* Status Tracking */}
            {trackingActive && (
              <div className="mt-3 text-center">
                <div className="inline-flex items-center gap-2 text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Live Tracking Aktif
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-900/50 rounded-xl p-8 text-center border border-white/10 mb-6">
            <Truck size={48} className="mx-auto text-gray-500 mb-3" />
            <p className="text-gray-400">Tidak ada pengiriman aktif</p>
            <p className="text-xs text-gray-500 mt-1">Belum ada pesanan yang ditugaskan</p>
          </div>
        )}
        
        {/* ========== RIWAYAT PENGIRIMAN ========== */}
        <div className="mt-6">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock size={14} /> Riwayat Pengiriman
          </h3>
          <div className="space-y-2">
            {assignments.filter(a => a.status === 'completed').length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Belum ada riwayat</p>
            ) : (
              assignments.filter(a => a.status === 'completed').map(assignment => (
                <div key={assignment.id} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">Order #{assignment.orders?.order_number}</p>
                      <p className="text-xs text-gray-400">
                        Selesai: {new Date(assignment.completed_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Selesai</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}