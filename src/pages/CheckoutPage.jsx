// src/pages/CheckoutPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import AddressPicker from '../components/AddressPicker';
import VoucherModal from '../components/VoucherModal';
import { getCart, getCartSubtotal } from '../services/cartService';
import { createOrder } from '../services/orderService';
import { getStoreShippingSettings, getStoreCoordinates, haversineDistance, calculateShippingCost, getShippingCostWithCache, calculateDistanceWithCoordinates } from '../services/shippingService';
import { getOrCreateGuestUser, saveGuestAddress } from '../services/guestService';
import { getUpsells, getBonuses } from '../services/upsellService';
import { getAvailableVouchers, calculateTotalDiscount, isVoucherValid } from '../services/voucherService';
import { Plus, Minus, Gift, Tag, Truck, Percent, Coins, ChevronDown, ChevronUp } from 'lucide-react';

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

  // ========== STATE UPSELING ==========
  const [upsells, setUpsells] = useState([]);
  const [selectedUpsells, setSelectedUpsells] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [upsellLoading, setUpsellLoading] = useState(false);

  // ========== STATE VOUCHER ==========
  const [availableVouchers, setAvailableVouchers] = useState([]);
  const [selectedVouchers, setSelectedVouchers] = useState([]);
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [shippingDiscounted, setShippingDiscounted] = useState(false);

  useEffect(() => {
    const cartData = getCart();
    if (!cartData.store_id || cartData.items.length === 0) {
      navigate('/cart');
      return;
    }
    setCart(cartData);
    fetchUserAndData(cartData.store_id);
  }, []);

  // ========== LOAD UPSELING & VOUCHER SETELAH DATA STORE & USER READY ==========
  useEffect(() => {
    if (store && user) {
      loadUpsellsAndBonuses();
      loadVouchers();
    }
  }, [store, user]);

  // ========== RE-HITUNG DISKON VOUCHER SETIAP SUBTOTAL BERUBAH ==========
  useEffect(() => {
    if (selectedVouchers.length > 0) {
      const subtotal = getCurrentSubtotal();
      const totalDiscount = calculateTotalDiscount(selectedVouchers, subtotal, shippingCost);
      setVoucherDiscount(totalDiscount);
      // Cek apakah ada voucher shipping_free yang dipilih
      const hasShippingFree = selectedVouchers.some(v => v.type === 'shipping_free');
      setShippingDiscounted(hasShippingFree);
    } else {
      setVoucherDiscount(0);
      setShippingDiscounted(false);
    }
  }, [selectedUpsells, shippingCost, cart.items]);

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

  // ========== LOAD UPSELING & BONUS ==========
  const loadUpsellsAndBonuses = async () => {
    if (!store) return;
    setUpsellLoading(true);
    try {
      const upsellData = await getUpsells(store.id);
      const bonusData = await getBonuses(store.id);
      setUpsells(upsellData);
      setBonuses(bonusData);
    } catch (error) {
      console.error('Error loading upsells:', error);
    }
    setUpsellLoading(false);
  };

  // ========== LOAD VOUCHERS ==========
  const loadVouchers = async () => {
    if (!store || !user) return;
    setVoucherLoading(true);
    try {
      const subtotal = getCurrentSubtotal();
      const vouchers = await getAvailableVouchers(user.id, store.id, subtotal);
      setAvailableVouchers(vouchers);
    } catch (error) {
      console.error('Error loading vouchers:', error);
    }
    setVoucherLoading(false);
  };

  // ========== GET CURRENT SUBTOTAL (CART + UPSEL) ==========
  const getCurrentSubtotal = () => {
    const baseSubtotal = getCartSubtotal(cart);
    const upsellTotal = selectedUpsells.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return baseSubtotal + upsellTotal;
  };

  // ========== HANDLE ADD/REMOVE UPSEL ==========
  const handleToggleUpsell = (upsell) => {
    setSelectedUpsells(prev => {
      const existing = prev.find(u => u.product_id === upsell.product_id);
      if (existing) {
        return prev.filter(u => u.product_id !== upsell.product_id);
      }
      return [...prev, {
        product_id: upsell.product_id,
        name: upsell.title,
        price: upsell.price,
        quantity: 1,
        image_url: upsell.products?.image_url || null
      }];
    });
  };

  // ========== HANDLE APPLY VOUCHERS ==========
  const handleApplyVouchers = (voucherIds) => {
    const selected = availableVouchers.filter(v => voucherIds.includes(v.id));
    setSelectedVouchers(selected);
    // Hitung ulang diskon
    const subtotal = getCurrentSubtotal();
    const totalDiscount = calculateTotalDiscount(selected, subtotal, shippingCost);
    setVoucherDiscount(totalDiscount);
    const hasShippingFree = selected.some(v => v.type === 'shipping_free');
    setShippingDiscounted(hasShippingFree);
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
    setShowNewAddressForm(false);
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
        } else {
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
        
        const savedAddress = await saveGuestAddress(guestUser.id, guestForm.lat, guestForm.lng, guestForm.address);
        if (savedAddress) {
          addressId = savedAddress.id;
        }
      }
      
      // ========== HITUNG TOTAL ==========
      const subtotal = getCurrentSubtotal();
      const effectiveShipping = shippingDiscounted ? 0 : shippingCost;
      const finalTotal = Math.max(0, subtotal + effectiveShipping - voucherDiscount);
      
      // ========== BUAT ORDER ==========
      const orderData = {
        store_id: cart.store_id,
        member_id: memberId,
        guest_name: guestName,
        guest_phone: guestPhone,
        shipping_address: shippingAddress,
        shipping_latitude: shippingLat,
        shipping_longitude: shippingLng,
        shipping_cost: effectiveShipping,
        notes: notes,
        address_id: addressId,
        voucher_discount: voucherDiscount,
        final_total: finalTotal,
        upsell_items: selectedUpsells,
        selected_vouchers: selectedVouchers.map(v => v.id)
      };
      
      const order = await createOrder(orderData, cart.items);
      console.log('Order created:', order.id);
      
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

  // ========== VALIDASI FORM ==========
  const isFormValid = () => {
    if (user) {
      if (showNewAddressForm) {
        return newAddressLocation.lat && newAddressLocation.lng && newAddressLabel.trim() && isShippingCalculated && shippingCost > 0;
      }
      return selectedAddressId && isShippingCalculated && shippingCost > 0;
    } else {
      return guestForm.name && guestForm.phone && guestForm.address && guestForm.lat && guestForm.lng && isShippingCalculated && shippingCost > 0;
    }
  };

  // ========== HITUNG TOTAL ==========
  const baseSubtotal = getCartSubtotal(cart);
  const upsellTotal = selectedUpsells.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const subtotal = baseSubtotal + upsellTotal;
  const effectiveShipping = shippingDiscounted ? 0 : shippingCost;
  const total = Math.max(0, subtotal + effectiveShipping - voucherDiscount);

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
                
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input 
                    type="checkbox" 
                    checked={showNewAddressForm} 
                    onChange={(e) => setShowNewAddressForm(e.target.checked)} 
                    className="w-4 h-4"
                  />
                  <span>Tambah alamat baru</span>
                </label>
                
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
                          if (location.lat && location.lng && storeCoords) {
                            calculateShipping(location.lat, location.lng, null);
                          }
                        }}
                      />
                    </div>
                    {newAddressLocation.lat && newAddressLocation.lng && (
                      <p className="text-xs text-green-500">✅ Lokasi dipilih</p>
                    )}
                  </div>
                )}
                
                {!selectedAddressId && !showNewAddressForm && (
                  <p className="text-yellow-500 text-xs mt-1">⚠️ Silakan pilih alamat atau tambah alamat baru</p>
                )}
              </div>
            ) : (
              <div className="bg-gray-900/50 rounded-xl p-4 space-y-3">
                <h2 className="font-semibold">Data Pengirim</h2>
                <input type="text" placeholder="Nama Lengkap" className="w-full p-2 rounded bg-black/50 border border-white/20" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
                <input type="tel" placeholder="Nomor HP" className="w-full p-2 rounded bg-black/50 border border-white/20" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: e.target.value})} />
                <AddressPicker onAddressChange={handleGuestAddressChange} />
                {guestForm.lat && guestForm.lng && isShippingCalculated && shippingCost > 0 && (
                  <p className="text-green-500 text-xs">✅ Ongkir terhitung</p>
                )}
              </div>
            )}

            <div className="bg-gray-900/50 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Catatan (opsional)</h2>
              <textarea rows="2" className="w-full p-2 rounded bg-black/50 border border-white/20" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: Tolong dibungkus rapi" />
            </div>
          </div>

          {/* ========== RINGKASAN ORDER ========== */}
          <div className="space-y-4">
            <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
              <h2 className="font-semibold mb-3">Ringkasan Pesanan</h2>
              <div className="space-y-2 text-sm">
                {cart.items.map(item => (
                  <div key={item.product_id} className="flex justify-between">
                    <span>{item.name} x{item.quantity}</span>
                    <span>Rp {(item.discounted_price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
                
                {/* Upselling items */}
                {selectedUpsells.map(item => (
                  <div key={item.product_id} className="flex justify-between text-yellow-500">
                    <span>+ {item.name}</span>
                    <span>Rp {item.price.toLocaleString()}</span>
                  </div>
                ))}

                <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                  <span>Subtotal</span>
                  <span>Rp {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Jarak (Estimasi)</span>
                  <span>{shippingDistance > 0 ? `${shippingDistance.toFixed(1)} km` : '...'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Ongkos Kirim</span>
                  <span className={shippingDiscounted ? 'line-through text-gray-500' : shippingCost > 0 ? 'text-yellow-500' : 'text-gray-500'}>
                    {shippingDiscounted ? `Rp ${shippingCost.toLocaleString()}` : shippingCost > 0 ? `Rp ${shippingCost.toLocaleString()}` : 'Belum dihitung'}
                  </span>
                  {shippingDiscounted && (
                    <span className="text-green-400 text-xs ml-2">Gratis!</span>
                  )}
                </div>
                
                {/* Voucher Discount */}
                {voucherDiscount > 0 && (
                  <div className="flex justify-between text-green-400 text-sm">
                    <span>Diskon Voucher</span>
                    <span>-Rp {voucherDiscount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-lg border-t border-white/10 pt-2 mt-2">
                  <span>Total</span>
                  <span className="text-yellow-500">
                    {shippingCost > 0 || voucherDiscount > 0 ? `Rp ${total.toLocaleString()}` : '- - -'}
                  </span>
                </div>
              </div>
            </div>

            {/* ========== SECTION VOUCHER ========== */}
            {user && (
              <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Gift size={16} className="text-yellow-500" />
                      Voucher
                    </h3>
                    {selectedVouchers.length > 0 ? (
                      <p className="text-xs text-green-400">
                        {selectedVouchers.length} voucher dipakai
                        {selectedVouchers.some(v => v.type === 'shipping_free') && ' 🚚 Gratis Ongkir'}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Punya voucher? Tukerin di sini</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowVoucherModal(true)}
                    className="text-yellow-500 text-sm hover:text-yellow-400 transition flex items-center gap-1"
                  >
                    <Tag size={14} />
                    {selectedVouchers.length > 0 ? 'Ganti' : 'Tukerin di sini'}
                  </button>
                </div>
              </div>
            )}

            {/* ========== SECTION UPSELING (CAROUSEL) ========== */}
{upsells.length > 0 && (
  <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
    <h3 className="font-semibold mb-3 flex items-center gap-2">
      <Plus size={16} className="text-yellow-500" />
      Beli sekalian
    </h3>
    
    {/* Carousel horizontal */}
    <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
        {upsells.map(upsell => {
          const isSelected = selectedUpsells.some(u => u.product_id === upsell.product_id);
          return (
            <div 
              key={upsell.id} 
              className={`flex-shrink-0 w-48 bg-gray-800/50 rounded-xl p-3 border transition ${
                isSelected 
                  ? 'border-yellow-500/50 bg-yellow-500/10' 
                  : 'border-white/10 hover:border-yellow-500/30'
              }`}
            >
              {/* Gambar */}
              <div className="w-full h-28 rounded-lg overflow-hidden bg-gray-700">
                {upsell.products?.image_url ? (
                  <img 
                    src={upsell.products.image_url} 
                    alt={upsell.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                    No Image
                  </div>
                )}
              </div>
              
              {/* Info */}
              <div className="mt-2">
                <p className="text-sm font-medium line-clamp-1">{upsell.title}</p>
                <p className="text-yellow-500 text-sm font-bold">Rp {upsell.price.toLocaleString()}</p>
                {upsell.description && (
                  <p className="text-[10px] text-gray-400 line-clamp-2 mt-0.5">{upsell.description}</p>
                )}
              </div>
              
              {/* Tombol */}
              <button
                onClick={() => handleToggleUpsell(upsell)}
                className={`mt-2 w-full py-1.5 rounded-full text-xs font-medium transition ${
                  isSelected 
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                    : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                }`}
              >
                {isSelected ? '✕ Batal' : '+ Tambah'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
    
    {/* Indikator scroll (opsional) */}
    {upsells.length > 3 && (
      <div className="flex justify-center gap-1 mt-2">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
      </div>
    )}
  </div>
)}

            {/* ========== SECTION BONUS ========== */}
            {bonuses.length > 0 && (
              <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
                <h3 className="font-semibold text-yellow-500 text-sm flex items-center gap-2">
                  <Gift size={16} />
                  Bonus untukmu!
                </h3>
                <ul className="mt-2 space-y-1">
                  {bonuses.map(bonus => (
                    <li key={bonus.id} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-yellow-500">✦</span>
                      <span>
                        <span className="font-medium">{bonus.title}</span>
                        {bonus.description && (
                          <span className="text-gray-400 text-xs ml-1">— {bonus.description}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !isFormValid()}
              className={`w-full py-2 rounded-full font-semibold transition ${
                isFormValid() 
                  ? 'bg-yellow-500 text-black hover:bg-yellow-600' 
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Memproses...' : 'Buat Pesanan'}
            </button>
            {!isFormValid() && user && !selectedAddressId && !showNewAddressForm && (
              <p className="text-xs text-yellow-500 text-center">Silakan pilih alamat pengiriman</p>
            )}
          </div>
        </div>
      </div>

      {/* ========== MODAL VOUCHER ========== */}
      <VoucherModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        vouchers={availableVouchers}
        onApply={handleApplyVouchers}
        selectedVoucherIds={selectedVouchers.map(v => v.id)}
        subtotal={subtotal}
        shippingCost={shippingCost}
      />
    </div>
  );
}