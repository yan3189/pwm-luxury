// src/pages/CheckoutPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import AddressPicker from '../components/AddressPicker';
import { getCart, getCartSubtotal } from '../services/cartService';
import { getStoreShippingSettings, getStoreCoordinates, haversineDistance, calculateShippingCost, getShippingCostWithCache } from '../services/shippingService';
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
  const [isShippingCalculated, setIsShippingCalculated] = useState(false);
  const [shippingDistance, setShippingDistance] = useState(0);
  const [shippingDuration, setShippingDuration] = useState(0);
  const [store, setStore] = useState(null);
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
    const settings = await getStoreShippingSettings(storeId);
    setShippingSettings(settings);
    const coords = await getStoreCoordinates(storeId);
    setStoreCoords(coords);
    const { data: storeData } = await supabase
      .from('stores')
      .select('id, name')
      .eq('id', storeId)
      .single();
    setStore(storeData);
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      const { data: addrs } = await supabase
        .from('member_addresses')
        .select('*')
        .eq('member_id', user.id)
        .order('is_default', { ascending: false });
      setAddresses(addrs || []);
    }
    setLoading(false);
  };

  const calculateShipping = async (lat, lng, addressId) => {
    if (!storeCoords || !store) return;
    if (addressId) {
      const apiResult = await getShippingCostWithCache(store.id, addressId);
      if (apiResult && apiResult.distanceKm) {
        setShippingCost(apiResult.cost);
        setShippingDistance(apiResult.distanceKm);
        setShippingDuration(apiResult.durationMinutes);
        setIsShippingCalculated(true);
        return;
      }
    }
    // Fallback Haversine
    const distance = haversineDistance(storeCoords.lat, storeCoords.lng, lat, lng);
    const cost = calculateShippingCost(distance, shippingSettings);
    setShippingCost(cost);
    setShippingDistance(distance);
    setShippingDuration(Math.round(distance * 2));
    setIsShippingCalculated(true);
  };

  const handleAddressSelect = async (addressId) => {
    if (!addressId) {
      setSelectedAddressId('');
      setShippingCost(0);
      setShippingDistance(0);
      setIsShippingCalculated(false);
      return;
    }
    setSelectedAddressId(addressId);
    const addr = addresses.find(a => a.id === addressId);
    if (addr && addr.latitude && addr.longitude && storeCoords) {
      await calculateShipping(addr.latitude, addr.longitude, addressId);
    }
  };

  const handleGuestAddressChange = async (location) => {
    setGuestForm(prev => ({ ...prev, address: location.address, lat: location.lat, lng: location.lng }));
    if (location.lat && location.lng && storeCoords) {
      await calculateShipping(location.lat, location.lng, null);
    } else {
      setIsShippingCalculated(false);
      setShippingCost(0);
      setShippingDistance(0);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      alert('Silakan lengkapi data dan pilih alamat pengiriman');
      return;
    }
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
        if (!guestForm.lat || !guestForm.lng) throw new Error('Alamat belum lengkap');
        guestName = guestForm.name;
        guestPhone = guestForm.phone;
        shippingAddress = guestForm.address;
        shippingLat = guestForm.lat;
        shippingLng = guestForm.lng;
      }
      if (user && saveAddressChecked && guestForm.address && guestForm.lat && guestForm.lng) {
        await supabase.from('member_addresses').insert([{
          member_id: user.id,
          label: 'Alamat Baru',
          address_text: guestForm.address,
          latitude: guestForm.lat,
          longitude: guestForm.lng,
          is_default: false
        }]);
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
      if (user) {
        navigate(`/member/orders/${order.id}`);
      } else {
        navigate(`/track-order/${order.id}`);
      }
    } catch (err) {
      alert(err.message);
    }
    setSubmitting(false);
  };

  const subtotal = getCartSubtotal(cart);
  const total = subtotal + shippingCost;
  const isFormValid = () => {
    if (user) {
      return selectedAddressId && isShippingCalculated && shippingCost > 0;
    } else {
      return guestForm.name && guestForm.phone && guestForm.address && guestForm.lat && guestForm.lng && isShippingCalculated && shippingCost > 0;
    }
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <h1 className="text-2xl font-display mb-6">Checkout</h1>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {user ? (
              <div className="bg-gray-900/50 rounded-xl p-4">
                <h2 className="font-semibold mb-2">Alamat Pengiriman</h2>
                <select
                  className="w-full p-2 rounded bg-black/50 border border-white/20 mb-2"
                  value={selectedAddressId || ""}
                  onChange={(e) => handleAddressSelect(e.target.value)}
                >
                  <option value="" disabled>-- Pilih alamat pengiriman --</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>{addr.label} - {addr.address_text}</option>
                  ))}
                </select>
                {!selectedAddressId && <p className="text-yellow-500 text-xs mt-1">⚠️ Silakan pilih alamat</p>}
                {selectedAddressId && !isShippingCalculated && <p className="text-yellow-500 text-xs mt-1">⏳ Menghitung ongkir...</p>}
                {selectedAddressId && isShippingCalculated && shippingCost > 0 && <p className="text-green-500 text-xs mt-1">✅ Ongkir terhitung: Rp {shippingCost.toLocaleString()}</p>}
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={saveAddressChecked} onChange={(e) => setSaveAddressChecked(e.target.checked)} />
                    Simpan alamat baru (isi di bawah)
                  </label>
                  {saveAddressChecked && <div className="mt-2"><AddressPicker onAddressChange={handleGuestAddressChange} /></div>}
                </div>
              </div>
            ) : (
              <div className="bg-gray-900/50 rounded-xl p-4 space-y-3">
                <h2 className="font-semibold">Data Pengirim</h2>
                <input type="text" placeholder="Nama Lengkap" className="w-full p-2 rounded bg-black/50 border border-white/20" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
                <input type="tel" placeholder="Nomor HP" className="w-full p-2 rounded bg-black/50 border border-white/20" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: e.target.value})} />
                <AddressPicker onAddressChange={handleGuestAddressChange} />
                {guestForm.lat && guestForm.lng && isShippingCalculated && shippingCost > 0 && <p className="text-green-500 text-xs">✅ Ongkir terhitung: Rp {shippingCost.toLocaleString()}</p>}
              </div>
            )}
            <div className="bg-gray-900/50 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Catatan (opsional)</h2>
              <textarea rows="2" className="w-full p-2 rounded bg-black/50 border border-white/20" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: Tolong dibungkus rapi" />
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">Ringkasan Pesanan</h2>
            <div className="space-y-2 text-sm">
              {cart.items.map(item => (
                <div key={item.product_id} className="flex justify-between">
                  <span>{item.name} x{item.quantity}</span>
                  <span>Rp {(item.discounted_price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span>Jarak (Estimasi)</span>
                <span>{shippingDistance > 0 ? `${shippingDistance.toFixed(1)} km` : 'Menghitung...'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estimasi Waktu</span>
                <span>{shippingDuration > 0 ? `${shippingDuration} menit` : '-'}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span>Subtotal</span>
                <span>Rp {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Ongkos Kirim</span>
                <span className={shippingCost > 0 ? 'text-yellow-500' : 'text-gray-500'}>
                  {shippingCost > 0 ? `Rp ${shippingCost.toLocaleString()}` : 'Belum dihitung'}
                </span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-white/10 pt-2 mt-2">
                <span>Total</span>
                <span className="text-yellow-500">{shippingCost > 0 ? `Rp ${total.toLocaleString()}` : '- - -'}</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <p className="text-sm font-semibold">Transfer ke:</p>
              <p className="text-sm">Bank: BCA</p>
              <p className="text-sm">No. Rekening: 1234567890</p>
              <p className="text-sm">a.n. PWM Store</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !isFormValid()}
              className={`w-full py-2 rounded-full font-semibold transition ${isFormValid() ? 'bg-yellow-500 text-black hover:bg-yellow-600' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
            >
              {submitting ? 'Memproses...' : 'Buat Pesanan'}
            </button>
            {!isFormValid() && user && !selectedAddressId && <p className="text-xs text-yellow-500 text-center">Silakan pilih alamat pengiriman</p>}
          </div>
        </div>
      </div>
    </div>
  );
}