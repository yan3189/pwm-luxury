// src/pages/CheckoutPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import AddressPicker from '../components/AddressPicker';
import { getCart, getCartSubtotal } from '../services/cartService';
import { createOrder } from '../services/orderService';
import { getStoreShippingSettings, getStoreCoordinates, haversineDistance, calculateShippingCost, getShippingCostWithCache, calculateDistanceWithCoordinates } from '../services/shippingService';
import { getOrCreateGuestUser, saveGuestAddress } from '../services/guestService';

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
  const [guestUser, setGuestUser] = useState(null);
  
  // ========== STATE UNTUK ALAMAT BARU MEMBER ==========
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressLocation, setNewAddressLocation] = useState({ lat: null, lng: null, address: '' });

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
    if (!user) {
      const guest = await getOrCreateGuestUser();
      setGuestUser(guest);
    }
    setLoading(false);
  };

  const calculateShipping = async (lat, lng, addressId, addressText = null) => {
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

    if (lat && lng) {
      console.log('🔄 Menghitung jarak untuk alamat baru dengan koordinat:', lat, lng);
      const apiResult = await calculateDistanceWithCoordinates(store.id, lat, lng);
      console.log('📡 Response API koordinat:', apiResult);
      
      if (apiResult && apiResult.success) {
        setShippingCost(apiResult.shippingCost);
        setShippingDistance(apiResult.distanceKm);
        setShippingDuration(apiResult.durationMinutes);
        setIsShippingCalculated(true);
        return;
      } else {
        console.log('⚠️ API koordinat gagal, fallback ke Haversine');
      }
    }
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
    setShowNewAddressForm(false); // Reset form alamat baru
    setNewAddressLabel('');
    setNewAddressLocation({ lat: null, lng: null, address: '' });
    
    const addr = addresses.find(a => a.id === addressId);
    if (addr && addr.latitude && addr.longitude && storeCoords) {
      await calculateShipping(addr.latitude, addr.longitude, addressId);
    }
  };

  const handleGuestAddressChange = async (location) => {
    setGuestForm(prev => ({ ...prev, address: location.address, lat: location.lat, lng: location.lng }));
    if (location.lat && location.lng && storeCoords) {
      await calculateShipping(location.lat, location.lng, null, location.address);
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
      let addressId = null;
      
      // ========== KASUS MEMBER (LOGIN) ==========
      if (user) {
        memberId = user.id;
        
        // Jika sedang menambah alamat baru
        if (showNewAddressForm && newAddressLocation.lat && newAddressLocation.lng) {
          if (!newAddressLabel.trim()) {
            alert('Silakan isi label alamat (contoh: Rumah, Kantor)');
            setSubmitting(false);
            return;
          }
          
          // Simpan alamat baru ke database
          const { data: newAddress, error: addressError } = await supabase
            .from('member_addresses')
            .insert([{
              member_id: user.id,
              label: newAddressLabel,
              address_text: newAddressLocation.address || `${newAddressLocation.lat}, ${newAddressLocation.lng}`,
              latitude: newAddressLocation.lat,
              longitude: newAddressLocation.lng,
              is_default: false
            }])
            .select()
            .single();
          
          if (addressError) {
            alert('Gagal menyimpan alamat: ' + addressError.message);
            setSubmitting(false);
            return;
          }
          
          addressId = newAddress.id;
          shippingAddress = newAddress.address_text;
          shippingLat = newAddress.latitude;
          shippingLng = newAddress.longitude;
          console.log('New address saved:', newAddress.id);
        } else {
          // Menggunakan alamat yang sudah ada
          const selectedAddress = addresses.find(a => a.id === selectedAddressId);
          if (!selectedAddress) throw new Error('Pilih alamat pengiriman');
          shippingAddress = selectedAddress.address_text;
          shippingLat = selectedAddress.latitude;
          shippingLng = selectedAddress.longitude;
          addressId = selectedAddress.id;
        }
      } 
      // ========== KASUS GUEST (NON-MEMBER) ==========
      else {
        if (!guestForm.name || !guestForm.phone || !guestForm.address) throw new Error('Isi semua data pengiriman');
        if (!guestForm.lat || !guestForm.lng) throw new Error('Alamat belum lengkap, silakan pilih dari peta');
        
        guestName = guestForm.name;
        guestPhone = guestForm.phone;
        shippingAddress = guestForm.address;
        shippingLat = guestForm.lat;
        shippingLng = guestForm.lng;
        
        if (!guestUser) throw new Error('Guest user not initialized');
        memberId = guestUser.id;
        
        // Simpan alamat guest ke member_addresses
        const savedAddress = await saveGuestAddress(guestUser.id, guestForm.lat, guestForm.lng, guestForm.address);
        if (savedAddress) {
          addressId = savedAddress.id;
          console.log('Saved guest address ID:', addressId);
        }
      }
      
      // ========== BUAT ORDER ==========
      const orderData = {
        store_id: cart.store_id,
        member_id: memberId,
        guest_name: guestName,
        guest_phone: guestPhone,
        shipping_address: shippingAddress,
        shipping_latitude: shippingLat,
        shipping_longitude: shippingLng,
        shipping_cost: shippingCost,
        notes: notes,
        address_id: addressId
      };
      
      const order = await createOrder(orderData, cart.items);
      console.log('Order created:', order.id);
      
      // ========== SIMPAN CACHE UNTUK ALAMAT BARU (JIKA PERLU) ==========
      if ((showNewAddressForm && newAddressLocation.lat) || (!user && guestForm.lat)) {
        const lat = showNewAddressForm ? newAddressLocation.lat : guestForm.lat;
        const lng = showNewAddressForm ? newAddressLocation.lng : guestForm.lng;
        const apiResult = await calculateDistanceWithCoordinates(cart.store_id, lat, lng);
        if (apiResult && apiResult.success && addressId) {
          await supabase
            .from('distance_cache')
            .upsert({
              store_id: cart.store_id,
              address_id: addressId,
              distance_meters: apiResult.distanceMeters,
              duration_seconds: apiResult.durationSeconds,
              polyline: apiResult.polyline,
              last_calculated_at: new Date().toISOString()
            }, { onConflict: 'store_id, address_id' });
          console.log('✅ Cache saved for new address');
        }
      }
      
      // ========== REDIRECT ==========
      if (user) {
        navigate(`/member/orders/${order.id}`);
      } else {
        navigate(`/track-order/${order.id}`);
      }
      
    } catch (err) {
      console.error('Submit error:', err);
      alert(err.message);
    }
    
    setSubmitting(false);
  };

  const subtotal = getCartSubtotal(cart);
  const total = subtotal + shippingCost;
  
  const isFormValid = () => {
    if (user) {
      // Jika sedang menambah alamat baru
      if (showNewAddressForm) {
        return newAddressLocation.lat && newAddressLocation.lng && newAddressLabel.trim() && isShippingCalculated && shippingCost > 0;
      }
      // Jika memilih alamat yang sudah ada
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
          {/* ========== FORM ========== */}
          <div className="space-y-4">
            {user ? (
              <div className="bg-gray-900/50 rounded-xl p-4">
                <h2 className="font-semibold mb-2">Alamat Pengiriman</h2>
                
                {/* Dropdown alamat yang sudah ada */}
                <select
                  className="w-full p-2 rounded bg-black/50 border border-white/20 mb-3"
                  value={selectedAddressId || ""}
                  onChange={(e) => handleAddressSelect(e.target.value)}
                >
                  <option value="" disabled>-- Pilih alamat pengiriman --</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label} - {addr.address_text}
                    </option>
                  ))}
                </select>
                
                {/* Checkbox untuk menambah alamat baru */}
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input 
                    type="checkbox" 
                    checked={showNewAddressForm} 
                    onChange={(e) => setShowNewAddressForm(e.target.checked)} 
                    className="w-4 h-4"
                  />
                  <span>Tambah alamat baru</span>
                </label>
                
                {/* Form alamat baru (muncul jika checkbox dicentang) */}
                {showNewAddressForm && (
                  <div className="mt-3 p-3 bg-gray-800/50 rounded-lg space-y-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Label Alamat</label>
                      <input
                        type="text"
                        placeholder="Contoh: Rumah, Kantor, Kos"
                        className="w-full p-2 rounded bg-black/50 border border-white/20"
                        value={newAddressLabel}
                        onChange={(e) => setNewAddressLabel(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Cari Alamat</label>
                      <AddressPicker 
                        onAddressChange={(location) => {
                          setNewAddressLocation(location);
                          // Hitung ulang ongkir dengan koordinat baru
                          if (location.lat && location.lng && storeCoords) {
                            calculateShipping(location.lat, location.lng, null);
                          }
                        }}
                      />
                    </div>
                    {newAddressLocation.lat && newAddressLocation.lng && (
                      <p className="text-xs text-green-500">✅ Lokasi dipilih: {newAddressLocation.address || `${newAddressLocation.lat}, ${newAddressLocation.lng}`}</p>
                    )}
                  </div>
                )}
                
                {!selectedAddressId && !showNewAddressForm && (
                  <p className="text-yellow-500 text-xs mt-1">⚠️ Silakan pilih alamat atau tambah alamat baru</p>
                )}
                {selectedAddressId && !isShippingCalculated && (
                  <p className="text-yellow-500 text-xs mt-1">⏳ Menghitung ongkir...</p>
                )}
                {selectedAddressId && isShippingCalculated && shippingCost > 0 && (
                  <p className="text-green-500 text-xs mt-1">✅ Ongkir terhitung: Rp {shippingCost.toLocaleString()}</p>
                )}
              </div>
            ) : (
              <div className="bg-gray-900/50 rounded-xl p-4 space-y-3">
                <h2 className="font-semibold">Data Pengirim</h2>
                <input type="text" placeholder="Nama Lengkap" className="w-full p-2 rounded bg-black/50 border border-white/20" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
                <input type="tel" placeholder="Nomor HP" className="w-full p-2 rounded bg-black/50 border border-white/20" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: e.target.value})} />
                <AddressPicker onAddressChange={handleGuestAddressChange} />
                {guestForm.lat && guestForm.lng && isShippingCalculated && shippingCost > 0 && (
                  <p className="text-green-500 text-xs">✅ Ongkir terhitung: Rp {shippingCost.toLocaleString()}</p>
                )}
              </div>
            )}

            <div className="bg-gray-900/50 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Catatan (opsional)</h2>
              <textarea rows="2" className="w-full p-2 rounded bg-black/50 border border-white/20" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: Tolong dibungkus rapi" />
            </div>
          </div>

          {/* ========== RINGKASAN ORDER ========== */}
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
                <span className="text-yellow-500">
                  {shippingCost > 0 ? `Rp ${total.toLocaleString()}` : '- - -'}
                </span>
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
            {!isFormValid() && user && !selectedAddressId && !showNewAddressForm && (
              <p className="text-xs text-yellow-500 text-center">Silakan pilih alamat pengiriman</p>
            )}
            {!isFormValid() && user && showNewAddressForm && (!newAddressLabel || !newAddressLocation.lat) && (
              <p className="text-xs text-yellow-500 text-center">Lengkapi alamat baru (label dan lokasi)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}