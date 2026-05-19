// ========== FILE: src/pages/CheckoutPage.jsx ==========
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function CheckoutPage() {
  const [cart, setCart] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const savedCart = localStorage.getItem('checkoutCart');
    if (!savedCart) {
      navigate('/cart');
      return;
    }
    setCart(JSON.parse(savedCart));
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/member/login');
      return;
    }
    const { data } = await supabase
      .from('member_addresses')
      .select('*')
      .eq('member_id', user.id)
      .order('is_default', { ascending: false });
    setAddresses(data || []);
    const defaultAddr = data?.find(a => a.is_default);
    if (defaultAddr) setSelectedAddress(defaultAddr);
    setLoading(false);
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const generateOrderNumber = () => {
    return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
  };

  const handleSubmit = async () => {
    if (!selectedAddress) {
      alert('Pilih alamat pengiriman');
      return;
    }
    if (cart.length === 0) {
      alert('Keranjang kosong');
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    // Dapatkan store_id dari produk pertama (asumsi satu store)
    const storeId = cart[0]?.store_id;
    
    const orderData = {
      order_number: generateOrderNumber(),
      member_id: user.id,
      store_id: storeId,
      address_id: selectedAddress.id,
      status: 'pending',
      total_amount: getTotal(),
      shipping_cost: 0, // nanti diisi
      payment_method: 'manual_transfer',
      notes: note
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError) {
      alert('Gagal membuat pesanan: ' + orderError.message);
      setSubmitting(false);
      return;
    }

    // Simpan item pesanan
    const items = cart.map(item => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(items);

    if (itemsError) {
      alert('Gagal menyimpan item: ' + itemsError.message);
      setSubmitting(false);
      return;
    }

    // Hapus cart
    localStorage.removeItem('cart');
    localStorage.removeItem('checkoutCart');
    
    alert('Pesanan berhasil dibuat! Silakan transfer ke rekening yang tertera.');
    navigate(`/member/orders/${order.id}`);
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <h1 className="text-2xl font-display mb-6">Checkout</h1>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-4">
            <div className="bg-gray-900/50 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Alamat Pengiriman</h2>
              {addresses.length === 0 ? (
                <p className="text-gray-400">Belum ada alamat. <a href="/member/dashboard" className="text-yellow-500">Tambah alamat</a></p>
              ) : (
                <select 
                  className="w-full p-2 rounded bg-black/50 border border-white/20"
                  value={selectedAddress?.id || ''}
                  onChange={(e) => setSelectedAddress(addresses.find(a => a.id === e.target.value))}
                >
                  <option value="">Pilih alamat</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label} - {addr.address_text}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="bg-gray-900/50 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Catatan (opsional)</h2>
              <textarea 
                rows="3" 
                className="w-full p-2 rounded bg-black/50 border border-white/20"
                placeholder="Contoh: Tolong dibungkus rapi"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="bg-gray-900/50 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Pembayaran</h2>
              <p className="text-sm text-gray-400">Transfer ke:</p>
              <p className="font-mono">BCA 1234567890 a.n. PWM Store</p>
              <p className="text-yellow-500 text-sm mt-2">*Setelah pesan, admin akan mengkonfirmasi pembayaran manual</p>
            </div>
          </div>

          {/* Ringkasan Pesanan */}
          <div className="bg-gray-900/50 rounded-xl p-4">
            <h2 className="font-semibold mb-3">Ringkasan Pesanan</h2>
            <div className="space-y-2 text-sm">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.name} x{item.quantity}</span>
                  <span>Rp {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-2 mt-2 font-bold flex justify-between">
                <span>Total</span>
                <span>Rp {getTotal().toLocaleString()}</span>
              </div>
            </div>
            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-4 bg-yellow-500 text-black py-2 rounded-full disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Buat Pesanan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}