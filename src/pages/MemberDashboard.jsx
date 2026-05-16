// ========== FILE: src/pages/MemberDashboard.jsx ==========
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { User, LogOut, Gift, Star, Mail, Phone, Edit2, Save, X } from 'lucide-react';

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
      </div>
    </div>
  );
}