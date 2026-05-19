// ========== FILE: src/pages/MemberDashboard.jsx ==========
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { User, LogOut, Gift, Star, Mail, Phone, Edit2, Save, X } from 'lucide-react';
import AddressPicker from '../components/AddressPicker';

export default function MemberDashboard() {
  const [user, setUser] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
  });
  const [saving, setSaving] = useState(false);
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
    setUser(user);
    
    // Ambil data member dari tabel users
    const { data: memberData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    setMemberData(memberData);
    setEditForm({
      full_name: memberData?.full_name || '',
      phone: memberData?.phone || '',
      bio: memberData?.bio || '',
      avatar_url: memberData?.avatar_url || '',
    });
    setLoading(false);
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/member/login');
  };
  
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    // Reset form ke data terbaru saat membuka edit
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
    
    if (error) {
      alert('Gagal menyimpan: ' + error.message);
    } else {
      alert('Profil berhasil diupdate');
      setMemberData({ ...memberData, ...editForm });
      setIsEditing(false);
    }
    setSaving(false);
  };
    // ========== ALAMAT ==========
  const [addresses, setAddresses] = useState([])
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)
  const [addressForm, setAddressForm] = useState({ label: '', address_text: '', latitude: '', longitude: '' })
  const [addressLocation, setAddressLocation] = useState({ lat: null, lng: null, address: '' })

  // Ambil daftar alamat member
  const fetchAddresses = async () => {
    const { data, error } = await supabase
      .from('member_addresses')
      .select('*')
      .eq('member_id', user.id)
      .order('is_default', { ascending: false })
    if (!error) setAddresses(data || [])
  }

  useEffect(() => {
    if (user) fetchAddresses()
  }, [user])

  const openAddAddress = () => {
    setEditingAddress(null)
    setAddressForm({ label: '', address_text: '', latitude: '', longitude: '' })
    setAddressLocation({ lat: null, lng: null, address: '' })
    setShowAddressModal(true)
  }

  const openEditAddress = (addr) => {
    setEditingAddress(addr)
    setAddressForm({
      label: addr.label,
      address_text: addr.address_text,
      latitude: addr.latitude,
      longitude: addr.longitude
    })
    setAddressLocation({
      lat: addr.latitude,
      lng: addr.longitude,
      address: addr.address_text
    })
    setShowAddressModal(true)
  }

  const saveAddress = async () => {
    const addressData = {
      member_id: user.id,
      label: addressForm.label,
      address_text: addressLocation.address || addressForm.address_text,
      latitude: addressLocation.lat || addressForm.latitude,
      longitude: addressLocation.lng || addressForm.longitude,
    }

    if (editingAddress) {
      const { error } = await supabase
        .from('member_addresses')
        .update(addressData)
        .eq('id', editingAddress.id)
      if (error) alert('Gagal update: ' + error.message)
    } else {
      const { error } = await supabase
        .from('member_addresses')
        .insert([addressData])
      if (error) alert('Gagal tambah: ' + error.message)
    }
    setShowAddressModal(false)
    fetchAddresses()
  }

  const deleteAddress = async (id) => {
    if (confirm('Hapus alamat ini?')) {
      const { error } = await supabase
        .from('member_addresses')
        .delete()
        .eq('id', id)
      if (error) alert('Gagal hapus: ' + error.message)
      else fetchAddresses()
    }
  }

  const setDefaultAddress = async (id) => {
    const { error } = await supabase
      .from('member_addresses')
      .update({ is_default: true })
      .eq('id', id)
    if (error) alert('Gagal: ' + error.message)
    else fetchAddresses()
  }

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
        
        {/* ========== EDIT MODE ========== */}
        {isEditing ? (
          <div className="bg-gray-900/50 rounded-xl p-6 border border-yellow-500/30 mb-6">
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
            </div>
          </div>
        ) : (
          /* ========== VIEW MODE ========== */
          <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10 mb-6">
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
        
        {/* ========== POIN & VOUCHER ========== */}
        <div className="grid grid-cols-2 gap-4 mb-6">
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
        
        {/* Riwayat Transaksi (placeholder) */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-display mb-4">Riwayat Transaksi</h2>
          <p className="text-gray-500 text-center py-8">Belum ada transaksi</p>
        </div>

                {/* ========== ALAMAT PENGIRIMAN ========== */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display">Alamat Pengiriman</h2>
            <button 
              onClick={() => setShowAddressModal(true)}
              className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm"
            >
              + Tambah Alamat
            </button>
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