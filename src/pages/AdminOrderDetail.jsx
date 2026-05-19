import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, MapPin, Calendar, Package, User, Truck } from 'lucide-react';

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    const { data: orderData } = await supabase
      .from('orders')
      .select(`
        *,
        stores ( name, slug ),
        member:users ( email, full_name, phone )
      `)
      .eq('id', id)
      .single();
    setOrder(orderData);

    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);
    setItems(itemsData || []);

    if (orderData?.address_id) {
      const { data: addressData } = await supabase
        .from('member_addresses')
        .select('*')
        .eq('id', orderData.address_id)
        .single();
      setAddress(addressData);
    }
    setLoading(false);
  };

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) alert('Gagal update: ' + error.message);
    else fetchOrder();
    setUpdating(false);
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  if (!order) return <div className="bg-black min-h-screen text-white p-8">Order tidak ditemukan</div>;

  return (
    <div className="bg-black text-white min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/admin/orders" className="inline-flex items-center gap-1 text-yellow-500 mb-6">
          <ArrowLeft size={16} /> Kembali ke Daftar Pesanan
        </Link>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          <h1 className="text-2xl font-display mb-4">Pesanan #{order.order_number}</h1>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="font-semibold flex items-center gap-2"><User size={16} /> Member</h2>
              <p>{order.member?.full_name || '-'}</p>
              <p className="text-sm text-gray-400">{order.member?.email}</p>
              {order.member?.phone && <p className="text-sm text-gray-400">Telp: {order.member.phone}</p>}
              
              <h2 className="font-semibold flex items-center gap-2 mt-4"><MapPin size={16} /> Alamat</h2>
              {address ? <p className="text-sm">{address.address_text}</p> : <p className="text-gray-400">Tidak tersedia</p>}
              
              <h2 className="font-semibold flex items-center gap-2 mt-4"><Package size={16} /> Produk</h2>
              <div className="space-y-1">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.product_name} x{item.quantity}</span>
                    <span>Rp {item.total.toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2 font-bold flex justify-between">
                  <span>Total</span>
                  <span>Rp {order.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold flex items-center gap-2"><Truck size={16} /> Status</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => updateStatus('paid')} disabled={updating} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">Tandai Dibayar</button>
                <button onClick={() => updateStatus('processing')} className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">Proses</button>
                <button onClick={() => updateStatus('shipping')} className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm">Kirim</button>
                <button onClick={() => updateStatus('delivered')} className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">Selesai</button>
                <button onClick={() => updateStatus('cancelled')} className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">Batalkan</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Status saat ini: <span className="text-yellow-500">{order.status}</span></p>
              
              <h2 className="font-semibold flex items-center gap-2 mt-4"><Calendar size={16} /> Tanggal Pesan</h2>
              <p className="text-sm text-gray-400">{new Date(order.created_at).toLocaleString('id-ID')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}