// ========== FILE: src/pages/AdminOrderDetail.jsx ==========
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, MapPin, Calendar, Package, User, Truck, CheckCircle, MessageCircle } from 'lucide-react';

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [couriers, setCouriers] = useState([]);
const [selectedCourierId, setSelectedCourierId] = useState('');
const [deliveryAssignment, setDeliveryAssignment] = useState(null);
const [assigning, setAssigning] = useState(false);

const fetchCouriers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone')
    .eq('role', 'courier');
  
  if (!error) setCouriers(data || []);
};

const assignCourier = async () => {
  if (!selectedCourierId) {
    alert('Pilih kurir terlebih dahulu');
    return;
  }
  
  setAssigning(true);
  
  // Update order dengan delivery_type = 'internal'
  await supabase
    .from('orders')
    .update({ delivery_type: 'internal', courier_id: selectedCourierId })
    .eq('id', id);
  
  // Buat delivery assignment
  const { error } = await supabase
    .from('delivery_assignments')
    .insert({
      order_id: id,
      courier_id: selectedCourierId,
      status: 'assigned'
    });
  
  if (error) {
    alert('Gagal assign kurir: ' + error.message);
  } else {
    alert('Kurir berhasil ditugaskan');
    fetchOrder(); // Refresh data
  }
  setAssigning(false);
};

const fetchDeliveryAssignment = async (orderId) => {
  const { data, error } = await supabase
    .from('delivery_assignments')
    .select('*, courier:users(id, email, full_name)')
    .eq('order_id', orderId)
    .maybeSingle();
  
  if (!error && data) setDeliveryAssignment(data);
};

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    
    // Step 1: Ambil order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (orderError || !orderData) {
      console.error('Order error:', orderError);
      setError('Order tidak ditemukan');
      setLoading(false);
      return;
    }
    // Setelah ambil order data
await fetchCouriers();
await fetchDeliveryAssignment(id);
    setOrder(orderData);
    
    // Step 2: Ambil store
    if (orderData.store_id) {
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, name, slug, bank_name, bank_account_number, bank_account_name, phone, email, alamat, latitude, longitude')
        .eq('id', orderData.store_id)
        .single();
      
      if (!storeError && storeData) {
        setStore(storeData);
      }
    }
    
    // Step 3: Ambil items
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);
    
    if (itemsError) {
      console.error('Items error:', itemsError);
    }
    setItems(itemsData || []);
    
    // Step 4: Ambil alamat
    if (orderData.address_id) {
      const { data: addressData, error: addressError } = await supabase
        .from('member_addresses')
        .select('*')
        .eq('id', orderData.address_id)
        .single();
      
      if (!addressError && addressData) {
        setAddress(addressData);
      }
    }
    
    setLoading(false);
  };

  const updateOrderStatus = async (newStatus) => {
    setUpdating(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date() })
      .eq('id', id);
    
    if (error) {
      alert('Gagal update: ' + error.message);
    } else {
      alert(`Status berhasil diubah menjadi ${newStatus}`);
      fetchOrder();
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
    return <span className={`text-xs px-2 py-1 rounded-full ${colors[status] || colors.pending} capitalize`}>{status}</span>;
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  if (error) return (
    <div className="bg-black min-h-screen text-white p-8">
      <div className="text-center">
        <h1 className="text-2xl font-display mb-4">Error</h1>
        <p className="text-red-400">{error}</p>
        <Link to="/admin/orders" className="text-yellow-500 mt-4 inline-block">Kembali ke Daftar Pesanan</Link>
      </div>
    </div>
  );
  if (!order) return null;

  const customerPhone = order.guest_phone;

  return (
    <div className="bg-black text-white min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <Link to="/admin/orders" className="inline-flex items-center gap-1 text-yellow-500 hover:gap-2 transition">
            <ArrowLeft size={16} /> Kembali ke Daftar Pesanan
          </Link>
          <div className="flex gap-2 flex-wrap">
            {order.status === 'pending' && (
              <button onClick={() => updateOrderStatus('paid')} disabled={updating} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">Tandai Dibayar</button>
            )}
            {order.status === 'paid' && (
              <button onClick={() => updateOrderStatus('processing')} disabled={updating} className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">Proses Pesanan</button>
            )}
            {order.status === 'processing' && (
              <button onClick={() => updateOrderStatus('shipping')} disabled={updating} className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm">Kirim Pesanan</button>
            )}
            {order.status === 'shipping' && (
              <button onClick={() => updateOrderStatus('delivered')} disabled={updating} className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">Tandai Selesai</button>
            )}
            {!['delivered', 'cancelled'].includes(order.status) && (
              <button onClick={() => updateOrderStatus('cancelled')} disabled={updating} className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">Batalkan</button>
            )}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          <h1 className="text-2xl font-display mb-4">Pesanan #{order.order_number}</h1>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Kiri */}
            <div>
              <div className="mb-4">
                <h2 className="font-semibold flex items-center gap-2 mb-2"><Package size={16} /> Produk</h2>
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm border-b border-white/5 pb-2">
                      <span>{item.product_name} x{item.quantity}</span>
                      <span>Rp {item.total?.toLocaleString() || item.subtotal?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-2">
                    <span>Subtotal</span>
                    <span>Rp {(order.total_amount - (order.shipping_cost || 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ongkos Kirim</span>
                    <span>Rp {(order.shipping_cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-white/10 pt-2 mt-2">
                    <span>Total</span>
                    <span>Rp {order.total_amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="font-semibold flex items-center gap-2 mb-2"><Truck size={16} /> Status Pesanan</h2>
                <div className="flex items-center gap-2">
                  {getStatusBadge(order.status)}
                  <span className="text-xs text-gray-400">
                    Terakhir diupdate: {new Date(order.updated_at || order.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Kanan */}
            <div>
              <div className="mb-4">
                <h2 className="font-semibold flex items-center gap-2 mb-2"><MapPin size={16} /> Alamat Pengiriman</h2>
                {address ? (
                  <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
                    <p className="font-medium">{address.label}</p>
                    <p className="text-gray-400">{address.address_text}</p>
                  </div>
                ) : order.shipping_address ? (
                  <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
                    {order.guest_name && <p className="font-medium">{order.guest_name}</p>}
                    {order.guest_phone && <p className="text-gray-400 text-xs">Telp: {order.guest_phone}</p>}
                    <p className="text-gray-400 mt-1">{order.shipping_address}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Alamat tidak tersedia</p>
                )}
              </div>

              <div className="mb-4">
                <h2 className="font-semibold flex items-center gap-2 mb-2"><User size={16} /> Info Customer</h2>
                <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
                  {order.member_id ? (
                    <p className="font-medium">Member ID: {order.member_id}</p>
                  ) : (
                    <>
                      <p className="font-medium">{order.guest_name || 'Guest'}</p>
                      {order.guest_phone && <p className="text-gray-400">Telp: {order.guest_phone}</p>}
                    </>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <h2 className="font-semibold flex items-center gap-2 mb-2"><Calendar size={16} /> Tanggal Pesan</h2>
                <p className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3">
                  {new Date(order.created_at).toLocaleString('id-ID')}
                </p>
              </div>

              {/* Catatan */}
              {order.notes && (
                <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
                  <h3 className="font-semibold text-sm mb-1">Catatan Pelanggan:</h3>
                  <p className="text-gray-300 text-sm">{order.notes}</p>
                </div>
              )}

              {/* Bukti Transfer */}
              {order.payment_proof_url && (
                <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" /> Bukti Transfer
                  </h3>
                  <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-yellow-500 underline text-sm">Lihat bukti transfer</a>
                  <div className="mt-2">
                    <img src={order.payment_proof_url} alt="Bukti Transfer" className="max-w-full h-auto rounded-lg max-h-96" />
                  </div>
                </div>
              )}

{/* Assign Kurir */}
<div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
  <h3 className="font-semibold mb-2 flex items-center gap-2">
    <Truck size={16} /> Assign Kurir Internal
  </h3>
  
  {deliveryAssignment ? (
    <div>
      <p className="text-sm">Kurir: {deliveryAssignment.courier?.full_name || deliveryAssignment.courier?.email}</p>
      <p className="text-sm text-gray-400">Status: {deliveryAssignment.status}</p>
      {deliveryAssignment.status === 'completed' && (
        <p className="text-xs text-green-400">Selesai: {new Date(deliveryAssignment.completed_at).toLocaleString()}</p>
      )}
    </div>
  ) : (
    <div className="space-y-2">
      <select
        value={selectedCourierId}
        onChange={(e) => setSelectedCourierId(e.target.value)}
        className="w-full p-2 rounded bg-black/50 border border-white/20 text-sm"
      >
        <option value="">-- Pilih Kurir --</option>
        {couriers.map(c => (
          <option key={c.id} value={c.id}>{c.full_name || c.email} {c.phone && `- ${c.phone}`}</option>
        ))}
      </select>
      <button
        onClick={assignCourier}
        disabled={assigning}
        className="w-full bg-yellow-500 text-black py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        {assigning ? 'Memproses...' : 'Assign Kurir'}
      </button>
    </div>
  )}
</div>

              {/* WhatsApp ke Kasir */}
              {store?.phone && (
                <div className="mt-4">
                  <a
                    href={`https://wa.me/${store.phone.replace(/[^0-9]/g, '')}?text=Halo%2C%20saya%20menerima%20pesanan%20baru%20%23${order.order_number}%0A%0A📦%20Total%3A%20Rp%20${order.total_amount.toLocaleString()}%0A👤%20Pemesan%3A%20${order.guest_name || 'Guest'}%0A📍%20Alamat%3A%20${order.shipping_address || address?.address_text || '-'}%0A📝%20Catatan%3A%20${order.notes || '-'}%0A%0A✅%20Bukti%20transfer%3A%20${order.payment_proof_url ? order.payment_proof_url : 'Belum diupload'}%0A%0ASilakan%20verifikasi%20pesanan%20ini%20di%20dashboard%20admin.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition w-fit"
                  >
                    <MessageCircle size={16} /> Kirim Notifikasi ke Kasir
                  </a>
                </div>
              )}

              {/* WhatsApp ke Customer */}
              {customerPhone && (
                <div className="mt-2">
                  <a
                    href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}?text=Halo%2C%20pesanan%20Anda%20%23${order.order_number}%20telah%20${order.status === 'delivered' ? 'selesai' : order.status === 'shipping' ? 'dikirim' : order.status === 'processing' ? 'diproses' : 'diterima'}%0A%0ALink%20pelacakan%3A%20${window.location.origin}/track-order/${order.id}%0A%0ATerima%20kasih%20telah%20berbelanja%20di%20${store?.name || 'toko kami'}.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition w-fit mt-2"
                  >
                    <MessageCircle size={16} /> Kirim Notifikasi ke Customer
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}