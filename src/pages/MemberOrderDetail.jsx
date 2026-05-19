// ========== FILE: src/pages/MemberOrderDetail.jsx ==========
// Detail pesanan member
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { ArrowLeft, MapPin, Calendar, Package } from 'lucide-react';

export default function MemberOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        stores ( name, slug, logo )
      `)
      .eq('id', id)
      .single();

    if (orderError) {
      console.error(orderError);
      setLoading(false);
      return;
    }
    setOrder(orderData);

    // Ambil item pesanan
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);
    setItems(itemsData || []);

    // Ambil alamat
    if (orderData.address_id) {
      const { data: addressData } = await supabase
        .from('member_addresses')
        .select('*')
        .eq('id', orderData.address_id)
        .single();
      setAddress(addressData);
    }
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
  if (!order) return <div className="bg-black min-h-screen text-white p-8">Pesanan tidak ditemukan</div>;

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
              <p className="text-gray-400">{order.stores?.name}</p>
            </div>
            {getStatusBadge(order.status)}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h2 className="font-semibold flex items-center gap-2 mb-2"><Package size={16} /> Produk</h2>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.product_name} x{item.quantity}</span>
                    <span>Rp {item.total.toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2 mt-2 font-bold flex justify-between">
                  <span>Total</span>
                  <span>Rp {order.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold flex items-center gap-2 mb-2"><MapPin size={16} /> Alamat Pengiriman</h2>
              {address ? (
                <div className="text-sm space-y-1">
                  <p>{address.label}</p>
                  <p className="text-gray-400">{address.address_text}</p>
                </div>
              ) : <p className="text-gray-400 text-sm">Alamat tidak tersedia</p>}
              
              <h2 className="font-semibold flex items-center gap-2 mt-4 mb-2"><Calendar size={16} /> Tanggal Pesan</h2>
              <p className="text-sm text-gray-400">{new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {order.status === 'pending' && (
            <div className="mt-6 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
              <p className="text-yellow-500 text-sm font-medium">Menunggu Pembayaran</p>
              <p className="text-xs text-gray-400 mt-1">Transfer ke BCA 1234567890 a.n. PWM Store. Setelah transfer, admin akan mengkonfirmasi.</p>
            </div>
          )}

          {order.status === 'shipping' && (
            <div className="mt-6 p-4 bg-orange-500/10 rounded-xl border border-orange-500/30">
              <p className="text-orange-500 text-sm font-medium">Pesanan Sedang Dikirim</p>
              <p className="text-xs text-gray-400 mt-1">Nomor resi: (akan diupdate admin)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}