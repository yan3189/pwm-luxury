// ========== FILE: src/pages/CheckoutPage.jsx ==========
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import AddressPicker from '../components/AddressPicker';
import { getCart, getCartSubtotal, clearCart } from '../services/cartService';
import { getStoreShippingSettings, getStoreCoordinates, haversineDistance, calculateShippingCost } from '../services/shippingService';
import { createOrder } from '../services/orderService';

export default function CheckoutPage() {
  const [cart, setCart] = useState({ store_id: null, items: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [guestForm, setGuestForm] = useState({ name: '', phone: '', address: '', lat: null, lng: null });
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingSettings, setShippingSettings] = useState(null);
  const [storeCoords, setStoreCoords] = useState(null);
  const [notes, setNotes] = useState('');
  const [saveAddressChecked, setSaveAddressChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const cartData = getCart();
    if (!cartData.store_id || cartData.items.length === 0) {
      navigate('/cart');
      return;
    }
    setCart(cartData);
    fetchUserAndData(cartData.store_id);
  }, []);

  const fetchUserAndData = async (storeId) => {
    setLoading(true);
    // Cek user login
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    
    // Ambil alamat member jika login
    if (user) {
      const { data: addrs } = await supabase
        .from('member_addresses')
        .select('*')
        .eq('member_id', user.id)
        .order('is_default', { ascending: false });
      setAddresses(addrs || []);
      if (addrs && addrs.length > 0) {
        setSelectedAddressId(addrs[0].id);
        // Hitung ongkir berdasarkan alamat default
        const addr = addrs[0];
        await calculateShipping(storeId, addr.latitude, addr.longitude);
      }
    }
    
    // Ambil setting ongkir store
    const settings = await getStoreShippingSettings(storeId);
    setShippingSettings(settings);
    const coords = await getStoreCoordinates(storeId);
    setStoreCoords(coords);
    setLoading(false);
  };

  const calculateShipping = async (storeId, lat, lng) => {
    if (!storeCoords) {
      const coords = await getStoreCoordinates(storeId);
      setStoreCoords(coords);
    }
    const distance = haversineDistance(
      storeCoords?.lat || (await getStoreCoordinates(storeId)).lat,
      storeCoords?.lng || (await getStoreCoordinates(storeId)).lng,
      lat,
      lng
    );
    const cost = calculateShippingCost(distance, shippingSettings);
    setShippingCost(cost);
    return cost;
  };

  const handleAddressSelect = async (addressId) => {
    setSelectedAddressId(addressId);
    const addr = addresses.find(a => a.id === addressId);
    if (addr) {
      await calculateShipping(cart.store_id, addr.latitude, addr.longitude);
    }
  };

  const handleGuestAddressChange = async (location) => {
    setGuestForm(prev => ({ ...prev, address: location.address, lat: location.lat, lng: location.lng }));
    if (location.lat && location.lng) {
      await calculateShipping(cart.store_id, location.lat, location.lng);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let memberId = null;
      let shippingAddress = '';
      let shippingLat = null;
      let shippingLng = null;
      let guestName = null;
      let guestPhone = null;

      if (user) {
        memberId = user.id;
        const selectedAddress = addresses.find(a => a.id === selectedAddressId);
        if (!selectedAddress) throw new Error('Pilih alamat pengiriman');
        shippingAddress = selectedAddress.address_text;
        shippingLat = selectedAddress.latitude;
        shippingLng = selectedAddress.longitude;
      } else {
        if (!guestForm.name || !guestForm.phone || !guestForm.address) throw new Error('Isi semua data pengiriman');
        guestName = guestForm.name;
        guestPhone = guestForm.phone;
        shippingAddress = guestForm.address;
        shippingLat = guestForm.lat;
        shippingLng = guestForm.lng;
      }

      // Simpan alamat baru jika member mencentang
      if (user && saveAddressChecked && guestForm.address && guestForm.lat && guestForm.lng) {
        const { error } = await supabase
          .from('member_addresses')
          .insert([{
            member_id: user.id,
            label: 'Alamat Baru',
            address_text: guestForm.address,
            latitude: guestForm.lat,
            longitude: guestForm.lng,
            is_default: false
          }]);
        if (error) console.error('Gagal simpan alamat:', error);
        else alert('Alamat baru disimpan');
      }

      const orderData = {
        store_id: cart.store_id,
        member_id: memberId,
        guest_name: guestName,
        guest_phone: guestPhone,
        shipping_address: shippingAddress,
        shipping_latitude: shippingLat,
        shipping_longitude: shippingLng,
        shipping_cost: shippingCost,
        notes: notes
      };

      const order = await createOrder(orderData, cart.items);
      alert('Pesanan berhasil dibuat! Silakan transfer ke rekening yang tertera.');
      navigate(`/member/orders/${order.id}`);
    } catch (err) {
      alert(err.message);
    }
    setSubmitting(false);
  };

  const subtotal = getCartSubtotal(cart);
  const total = subtotal + shippingCost;

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <h1 className="text-2xl font-display mb-6">Checkout</h1>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-4">
            {user ? (
              // Member checkout
              <div className="bg-gray-900/50 rounded-xl p-4">
                <h2 className="font-semibold mb-2">Alamat Pengiriman</h2>
                {addresses.length === 0 ? (
                  <p className="text-gray-400">Belum ada alamat. Silakan tambah alamat di dashboard.</p>
                ) : (
                  <select
                    className="w-full p-2 rounded bg-black/50 border border-white/20 mb-2"
                    value={selectedAddressId}
                    onChange={(e) => handleAddressSelect(e.target.value)}
                  >
                    {addresses.map(addr => (
                      <option key={addr.id} value={addr.id}>{addr.label} - {addr.address_text}</option>
                    ))}
                  </select>
                )}
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={saveAddressChecked} onChange={(e) => setSaveAddressChecked(e.target.checked)} />
                    Simpan alamat baru (isi di bawah)
                  </label>
                  {saveAddressChecked && (
                    <div className="mt-2">
                      <AddressPicker
                        initialAddress=""
                        onAddressChange={handleGuestAddressChange}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Non-member checkout
              <div className="bg-gray-900/50 rounded-xl p-4 space-y-3">
                <h2 className="font-semibold">Data Pengirim</h2>
                <input type="text" placeholder="Nama Lengkap" className="w-full p-2 rounded bg-black/50 border border-white/20" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
                <input type="tel" placeholder="Nomor HP" className="w-full p-2 rounded bg-black/50 border border-white/20" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: e.target.value})} />
                <AddressPicker
                  onAddressChange={handleGuestAddressChange}
                />
              </div>
            )}

            <div className="bg-gray-900/50 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Catatan (opsional)</h2>
              <textarea rows="2" className="w-full p-2 rounded bg-black/50 border border-white/20" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: Tolong dibungkus rapi" />
            </div>
          </div>

          {/* Ringkasan Order */}
          <div className="bg-gray-900/50 rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">Ringkasan Pesanan</h2>
            <div className="space-y-2 text-sm">
              {cart.items.map(item => (
                <div key={item.product_id} className="flex justify-between">
                  <span>{item.name} x{item.quantity}</span>
                  <span>Rp {(item.discounted_price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span>Subtotal</span>
                <span>Rp {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Ongkos Kirim</span>
                <span>Rp {shippingCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>Rp {total.toLocaleString()}</span>
              </div>
            </div>

            {/* Rekening store */}
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <p className="text-sm font-semibold">Transfer ke:</p>
              <p className="text-sm">Bank: BCA</p>
              <p className="text-sm">No. Rekening: 1234567890</p>
              <p className="text-sm">a.n. PWM Store</p>
              <p className="text-xs text-gray-400 mt-1">*Konfirmasi pembayaran dapat dilakukan di halaman detail pesanan setelah checkout.</p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-yellow-500 text-black py-2 rounded-full font-semibold disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Buat Pesanan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}