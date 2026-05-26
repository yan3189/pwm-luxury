// ========== FILE: src/pages/AdminOrders.jsx ==========
// Admin: daftar pesanan untuk store yang login
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Eye, CheckCircle, Truck, PackageCheck, XCircle } from 'lucide-react';

export default function AdminOrders() {
  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/admin/login');
      return;
    }
    const { data: userData } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', user.id)
      .single();
    
    if (userData?.store_id) {
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('id', userData.store_id)
        .single();
      setStore(storeData);
      fetchOrders(userData.store_id);
    } else {
      setLoading(false);
    }
  };

  const fetchOrders = async (storeId) => {
    setLoading(true);
    
    // Query sederhana tanpa nested select
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      console.log('Orders found:', data?.length);
      setOrders(data || []);
    }
    setLoading(false);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdating(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date() })
      .eq('id', orderId);
    
    if (error) {
      alert('Gagal update: ' + error.message);
    } else {
      alert(`Status berhasil diubah menjadi ${newStatus}`);
      fetchOrders(store.id);
    }
    setUpdating(false);
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
      paid: 'Dibayar',
      processing: 'Diproses',
      shipping: 'Dikirim',
      delivered: 'Selesai',
      cancelled: 'Dibatalkan'
    };
    return <span className={`text-xs px-2 py-1 rounded-full ${colors[status] || colors.pending}`}>{labels[status] || status}</span>;
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-display">Manajemen Pesanan</h1>
            {store && <p className="text-gray-400 text-sm">{store.name}</p>}
            <p className="text-gray-500 text-xs mt-1">Total pesanan: {orders.length}</p>
          </div>
          <button onClick={() => navigate('/admin/dashboard')} className="bg-gray-700 px-4 py-2 rounded-full text-sm">Kembali</button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-gray-900/50 rounded-xl p-8 text-center">
            <Package size={48} className="mx-auto text-gray-500 mb-3" />
            <p className="text-gray-400">Belum ada pesanan</p>
            <p className="text-xs text-gray-500 mt-2">Pesanan akan muncul setelah member melakukan checkout</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-800/50 border-b border-white/10">
                <tr>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Pemesan</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono text-sm">#{order.order_number}</td>
                    <td className="p-3">
                      {order.guest_name || order.member_id || 'Guest'}
                      {order.guest_phone && <p className="text-xs text-gray-400">{order.guest_phone}</p>}
                    </td>
                    <td className="p-3">Rp {order.total_amount.toLocaleString()}</td>
                    <td className="p-3">{getStatusBadge(order.status)}</td>
                    <td className="p-3 text-sm">{new Date(order.created_at).toLocaleDateString('id-ID')}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {order.status === 'pending' && (
                          <button onClick={() => updateOrderStatus(order.id, 'paid')} disabled={updating} className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
                            <CheckCircle size={12} /> Bayar
                          </button>
                        )}
                        {order.status === 'paid' && (
                          <button onClick={() => updateOrderStatus(order.id, 'processing')} className="flex items-center gap-1 bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs">
                            <Package size={12} /> Proses
                          </button>
                        )}
                        {order.status === 'processing' && (
                          <button onClick={() => updateOrderStatus(order.id, 'shipping')} className="flex items-center gap-1 bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs">
                            <Truck size={12} /> Kirim
                          </button>
                        )}
                        {order.status === 'shipping' && (
                          <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">
                            <PackageCheck size={12} /> Selesai
                          </button>
                        )}
                        {!['delivered', 'cancelled'].includes(order.status) && (
                          <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                            <XCircle size={12} /> Batal
                          </button>
                        )}
                        <Link to={`/admin/orders/${order.id}`} className="text-yellow-500 text-xs flex items-center gap-1">
                          <Eye size={12} /> Detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}