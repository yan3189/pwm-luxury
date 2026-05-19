// ========== FILE: src/pages/MemberOrders.jsx ==========
// Daftar pesanan member
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Package, Eye } from 'lucide-react';

export default function MemberOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/member/login');
      return;
    }
    fetchOrders(user.id);
  };

  const fetchOrders = async (memberId) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        stores ( name, slug )
      `)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setOrders(data || []);
    setLoading(false);
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
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <h1 className="text-2xl font-display mb-6">Pesanan Saya</h1>
        
        {orders.length === 0 ? (
          <div className="bg-gray-900/50 rounded-xl p-8 text-center">
            <Package size={48} className="mx-auto text-gray-500 mb-3" />
            <p className="text-gray-400">Belum ada pesanan</p>
            <Link to="/stores" className="text-yellow-500 mt-2 inline-block">Belanja sekarang →</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <div key={order.id} className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <p className="text-sm text-gray-400">#{order.order_number}</p>
                    <p className="font-semibold">{order.stores?.name}</p>
                    <p className="text-sm">Total: Rp {order.total_amount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(order.status)}
                    <p className="text-xs text-gray-500 mt-1">{new Date(order.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Link to={`/member/orders/${order.id}`} className="flex items-center gap-1 text-yellow-500 text-sm hover:gap-2 transition">
                    <Eye size={14} /> Lihat Detail
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}