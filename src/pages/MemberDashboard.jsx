// ========== FILE: src/pages/MemberDashboard.jsx ==========
// Dashboard member dengan tab: Profil, Alamat, Pesanan
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AddressPicker from '../components/AddressPicker';
import { User, LogOut, Gift, Star, Mail, Phone, Edit2, Save, X, MapPin, Package, Eye } from 'lucide-react';
import { hasGoogleIdentity, linkGoogleAccount } from '../services/authService';

export default function MemberDashboard() {
  const [user, setUser] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'addresses', 'orders'
  const [hasGoogle, setHasGoogle] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  // Profile edit state
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
  });
  const [saving, setSaving] = useState(false);
  
  // Address state
  const [addresses, setAddresses] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState({ label: '', address_text: '', latitude: '', longitude: '' });
  const [addressLocation, setAddressLocation] = useState({ lat: null, lng: null, address: '' });
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

 // Cek status Google connection setelah user tersedia
useEffect(() => {
  if (user) {
    checkGoogleConnection();
  }
}, [user]);

const checkGoogleConnection = async () => {
  const linked = await hasGoogleIdentity();
  setHasGoogle(linked);
};

const handleLinkGoogle = async () => {
  setLinkingGoogle(true);
  try {
    await linkGoogleAccount();
    // Redirect ke Google, lalu balik ke callback
  } catch (error) {
    console.error('Linking error:', error);
    alert('Gagal menghubungkan: ' + error.message);
    setLinkingGoogle(false);
  }
};

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/member/login');
      return;
    }
    setUser(user);
    await fetchMemberData(user.id);
    await fetchAddresses(user.id);
    await fetchOrders(user.id);
    setLoading(false);
  };

  const fetchMemberData = async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setMemberData(data);
    setEditForm({
      full_name: data?.full_name || '',
      phone: data?.phone || '',
      bio: data?.bio || '',
      avatar_url: data?.avatar_url || '',
    });
  };

  const fetchAddresses = async (userId) => {
    const { data } = await supabase
      .from('member_addresses')
      .select('*')
      .eq('member_id', userId)
      .order('is_default', { ascending: false });
    setAddresses(data || []);
  };

  const fetchOrders = async (userId) => {
    setOrdersLoading(true);
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        stores ( name, slug )
      `)
      .eq('member_id', userId)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setOrdersLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/member/login');
  };

  // Profile functions
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setEditForm({
        full_name: memberData?.full_name || '',
        phone: memberData?.phone || '',
        bio: memberData?.bio || '',
        avatar_url: memberData?.avatar_url || '',
      });
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        full_name: editForm.full_name,
        phone: editForm.phone,
        bio: editForm.bio,
        avatar_url: editForm.avatar_url,
      })
      .eq('id', user.id);
    if (error) alert('Gagal menyimpan: ' + error.message);
    else {
      alert('Profil berhasil diupdate');
      await fetchMemberData(user.id);
      setIsEditing(false);
    }
    setSaving(false);
  };

  // Address functions
  const openAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({ label: '', address_text: '', latitude: '', longitude: '' });
    setAddressLocation({ lat: null, lng: null, address: '' });
    setShowAddressModal(true);
  };

  const openEditAddress = (addr) => {
    setEditingAddress(addr);
    setAddressForm({
      label: addr.label,
      address_text: addr.address_text,
      latitude: addr.latitude,
      longitude: addr.longitude
    });
    setAddressLocation({
      lat: addr.latitude,
      lng: addr.longitude,
      address: addr.address_text
    });
    setShowAddressModal(true);
  };

  const saveAddress = async () => {
    const addressData = {
      member_id: user.id,
      label: addressForm.label,
      address_text: addressLocation.address || addressForm.address_text,
      latitude: addressLocation.lat || addressForm.latitude,
      longitude: addressLocation.lng || addressForm.longitude,
    };

    if (editingAddress) {
      const { error } = await supabase
        .from('member_addresses')
        .update(addressData)
        .eq('id', editingAddress.id);
      if (error) alert('Gagal update: ' + error.message);
    } else {
      const { error } = await supabase
        .from('member_addresses')
        .insert([addressData]);
      if (error) alert('Gagal tambah: ' + error.message);
    }
    setShowAddressModal(false);
    fetchAddresses(user.id);
  };

  const deleteAddress = async (id) => {
    if (confirm('Hapus alamat ini?')) {
      const { error } = await supabase
        .from('member_addresses')
        .delete()
        .eq('id', id);
      if (error) alert('Gagal hapus: ' + error.message);
      else fetchAddresses(user.id);
    }
  };

  const setDefaultAddress = async (id) => {
    const { error } = await supabase
      .from('member_addresses')
      .update({ is_default: true })
      .eq('id', id);
    if (error) alert('Gagal: ' + error.message);
    else fetchAddresses(user.id);
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-display">Dashboard Member</h1>
          <button onClick={handleLogout} className="flex items-center gap-2 bg-red-500 px-4 py-2 rounded-full text-sm">
            <LogOut size={16} /> Logout
          </button>
        </div>

        {/* ========== TAB NAVIGATION ========== */}
        <div className="flex border-b border-white/10 mb-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-4 font-medium text-sm transition-all relative ${
              activeTab === 'profile' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            Profil
            {activeTab === 'profile' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
          </button>
          <button
            onClick={() => setActiveTab('addresses')}
            className={`py-2 px-4 font-medium text-sm transition-all relative ${
              activeTab === 'addresses' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            Alamat
            {activeTab === 'addresses' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-2 px-4 font-medium text-sm transition-all relative ${
              activeTab === 'orders' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            Pesanan
            {activeTab === 'orders' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
          </button>
        </div>

        {/* ========== TAB: PROFIL ========== */}
        {activeTab === 'profile' && (
          <>
            {isEditing ? (
              <div className="bg-gray-900/50 rounded-xl p-6 border border-yellow-500/30">
                <h2 className="text-xl font-display mb-4 flex items-center gap-2">Edit Profil <Edit2 size={18} className="text-yellow-500" /></h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Nama Lengkap</label>
                    <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Nomor Telepon</label>
                    <input type="tel" className="w-full p-2 rounded bg-black/50 border border-white/20" placeholder="0812xxxxxx" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Bio / Kata-kata Singkat</label>
                    <textarea rows="3" className="w-full p-2 rounded bg-black/50 border border-white/20" placeholder="Ceritakan tentang dirimu..." value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Foto Profil (URL gambar)</label>
                    <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" placeholder="https://..." value={editForm.avatar_url} onChange={e => setEditForm({...editForm, avatar_url: e.target.value})} />
                    {editForm.avatar_url && <img src={editForm.avatar_url} className="h-16 w-16 rounded-full mt-2 object-cover" alt="preview" />}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-full text-sm disabled:opacity-50">
                      <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                    <button onClick={handleEditToggle} className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-full text-sm">
                      <X size={16} /> Batal
                    </button>
                  </div>
<div className="mt-6 pt-4 border-t border-white/10">
  <h3 className="text-sm font-semibold mb-2">Login dengan Google</h3>
  {hasGoogle ? (
    <div className="flex items-center gap-2 text-green-500 text-sm">
      <span>✓</span>
      <span>Akun Google sudah terhubung</span>
    </div>
  ) : (
    <div>
      <p className="text-gray-400 text-sm mb-2">
        Hubungkan akun Google Anda untuk login tanpa password
      </p>
      <button
        onClick={handleLinkGoogle}
        disabled={linkingGoogle}
        className="flex items-center gap-2 px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 transition text-sm"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {linkingGoogle ? 'Memproses...' : 'Hubungkan dengan Google'}
      </button>
    </div>
  )}
</div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    {memberData?.avatar_url ? (
                      <img src={memberData.avatar_url} alt="avatar" className="h-20 w-20 rounded-full object-cover" />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-gray-700 flex items-center justify-center">
                        <User size={40} className="text-gray-400" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-bold">{memberData?.full_name || user.email}</h2>
                      <p className="text-gray-400">{user.email}</p>
                      {memberData?.phone && <p className="text-gray-400 text-sm flex items-center gap-1 mt-1"><Phone size={12} /> {memberData.phone}</p>}
                    </div>
                  </div>
                  <button onClick={handleEditToggle} className="flex items-center gap-1 text-yellow-500 text-sm hover:gap-2 transition">
                    <Edit2 size={14} /> Edit Profil
                  </button>
                </div>
                {memberData?.bio && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-gray-300 italic">"{memberData.bio}"</p>
                  </div>
                )}
              </div>
            )}

            {/* Poin & Voucher */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-900/50 rounded-xl p-5 text-center border border-white/10">
                <Star size={24} className="text-yellow-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{memberData?.points || 0}</p>
                <p className="text-xs text-gray-400">Total Poin</p>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-5 text-center border border-white/10">
                <Gift size={24} className="text-yellow-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">0</p>
                <p className="text-xs text-gray-400">Voucher</p>
              </div>
            </div>
          </>
        )}

        {/* ========== TAB: ALAMAT ========== */}
        {activeTab === 'addresses' && (
          <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-display">Alamat Pengiriman</h2>
              <button onClick={openAddAddress} className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm">+ Tambah Alamat</button>
            </div>
            {addresses.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Belum ada alamat. Klik "Tambah Alamat" untuk menambahkan.</p>
            ) : (
              <div className="space-y-3">
                {addresses.map(addr => (
                  <div key={addr.id} className="bg-gray-800/50 rounded-lg p-3 flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{addr.label}</span>
                        {addr.is_default && <span className="text-yellow-500 text-xs bg-yellow-500/20 px-2 py-0.5 rounded-full">Utama</span>}
                      </div>
                      <p className="text-gray-400 text-sm mt-1">{addr.address_text}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditAddress(addr)} className="text-blue-400 text-sm">Edit</button>
                      <button onClick={() => deleteAddress(addr.id)} className="text-red-400 text-sm">Hapus</button>
                      {!addr.is_default && (
                        <button onClick={() => setDefaultAddress(addr.id)} className="text-yellow-500 text-sm">Jadikan Utama</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== TAB: PESANAN ========== */}
        {activeTab === 'orders' && (
          <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-display mb-4">Riwayat Pesanan</h2>
            {ordersLoading ? (
              <p className="text-gray-400 text-center py-8">Memuat pesanan...</p>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <Package size={48} className="mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400">Belum ada pesanan</p>
                <Link to="/stores" className="text-yellow-500 mt-2 inline-block">Belanja sekarang →</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="bg-gray-800/50 rounded-lg p-4">
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
        )}
      </div>

      {/* MODAL TAMBAH/EDIT ALAMAT */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h3 className="text-xl font-display mb-4">{editingAddress ? 'Edit Alamat' : 'Tambah Alamat Baru'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Label (contoh: Rumah, Kantor)</label>
                <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" value={addressForm.label} onChange={e => setAddressForm({...addressForm, label: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Lokasi (cari alamat atau klik peta)</label>
                <AddressPicker
                  initialLat={addressLocation.lat || addressForm.latitude}
                  initialLng={addressLocation.lng || addressForm.longitude}
                  initialAddress={addressLocation.address || addressForm.address_text}
                  onAddressChange={(loc) => setAddressLocation(loc)}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveAddress} className="bg-yellow-500 text-black px-4 py-2 rounded-full flex-1">Simpan</button>
              <button onClick={() => setShowAddressModal(false)} className="bg-gray-700 px-4 py-2 rounded-full">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}