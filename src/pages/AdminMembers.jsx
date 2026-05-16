// ========== FILE: src/pages/AdminMembers.jsx ==========
// Halaman manajemen member untuk admin store (CRUD dengan profil lengkap)
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Edit, Trash2, ArrowLeft } from 'lucide-react';

export default function AdminMembers() {
  const [store, setStore] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({
    email: '',
    full_name: '',
    password: '',
    phone: '',
    bio: '',
    avatar_url: '',
    points: 0,
  });
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/admin/login');
      return;
    }
    const { data: userData } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', user.id)
      .single();
    
    if (userData?.store_id) {
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('id', userData.store_id)
        .single();
      setStore(storeData);
      fetchMembers();
    } else {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    // Ambil semua member (role = 'member')
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'member')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(error);
    } else {
      setMembers(data || []);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setEditingMember(null);
    setMemberForm({
      email: '',
      full_name: '',
      password: '',
      phone: '',
      bio: '',
      avatar_url: '',
      points: 0,
    });
    setShowModal(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    setMemberForm({
      email: member.email,
      full_name: member.full_name || '',
      password: '',
      phone: member.phone || '',
      bio: member.bio || '',
      avatar_url: member.avatar_url || '',
      points: member.points || 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (editingMember) {
      // Update member (full_name, phone, bio, avatar_url, points)
      const { error } = await supabase
        .from('users')
        .update({
          full_name: memberForm.full_name,
          phone: memberForm.phone,
          bio: memberForm.bio,
          avatar_url: memberForm.avatar_url,
          points: memberForm.points,
        })
        .eq('id', editingMember.id);
      
      if (error) {
        alert('Gagal update: ' + error.message);
      } else {
        alert('Member berhasil diupdate');
      }
    } else {
      // Buat member baru (registrasi sekaligus ke auth)
      if (!memberForm.password) {
        alert('Password wajib diisi untuk member baru');
        return;
      }
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: memberForm.email,
        password: memberForm.password,
      });
      
      if (authError) {
        alert('Gagal membuat akun: ' + authError.message);
        return;
      }
      
      if (authData.user) {
        const { error: userError } = await supabase
          .from('users')
          .insert([{
            id: authData.user.id,
            email: memberForm.email,
            full_name: memberForm.full_name,
            phone: memberForm.phone,
            bio: memberForm.bio,
            avatar_url: memberForm.avatar_url,
            role: 'member',
            points: memberForm.points || 0,
          }]);
        
        if (userError) {
          alert('Gagal menyimpan data member: ' + userError.message);
        } else {
          alert('Member berhasil ditambahkan');
        }
      }
    }
    setShowModal(false);
    fetchMembers();
  };

  const handleDelete = async (memberId) => {
    if (confirm('Yakin hapus member ini? Data tidak bisa dikembalikan.')) {
      // Hapus dari tabel users (auth user tidak otomatis terhapus)
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', memberId);
      
      if (error) {
        alert('Gagal hapus: ' + error.message);
      } else {
        alert('Member berhasil dihapus');
        fetchMembers();
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display">Manajemen Member</h1>
          <div className="flex gap-3">
            <button 
              onClick={() => navigate('/admin/dashboard')} 
              className="bg-gray-700 px-4 py-2 rounded-full text-sm flex items-center gap-1"
            >
              <ArrowLeft size={16} /> Kembali
            </button>
            <button 
              onClick={openAddModal} 
              className="bg-yellow-500 text-black px-4 py-2 rounded-full text-sm flex items-center gap-1"
            >
              <UserPlus size={16} /> Tambah Member
            </button>
          </div>
        </div>

        {/* Tabel Member */}
        <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-800/50 border-b border-white/10">
                <tr>
                  <th className="p-3">Avatar</th>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">No. HP</th>
                  <th className="p-3">Poin</th>
                  <th className="p-3">Bergabung</th>
                  <th className="p-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="avatar" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">📷</div>
                      )}
                    </td>
                    <td className="p-3 font-medium">{m.full_name || '-'}</td>
                    <td className="p-3 text-sm">{m.email}</td>
                    <td className="p-3 text-sm">{m.phone || '-'}</td>
                    <td className="p-3 text-yellow-500 font-semibold">{m.points || 0}</td>
                    <td className="p-3 text-sm">{formatDate(m.created_at)}</td>
                    <td className="p-3 flex gap-2">
                      <button 
                        onClick={() => openEditModal(m)} 
                        className="text-blue-400 hover:text-blue-300 transition"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(m.id)} 
                        className="text-red-400 hover:text-red-300 transition"
                        title="Hapus"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-500">
                      Belum ada member. Klik "Tambah Member" untuk menambahkan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== MODAL TAMBAH/EDIT MEMBER ========== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h3 className="text-xl font-display mb-4">
              {editingMember ? 'Edit Member' : 'Tambah Member Baru'}
            </h3>
            
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  placeholder="Nama lengkap" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={memberForm.full_name} 
                  onChange={e => setMemberForm({...memberForm, full_name: e.target.value})} 
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input 
                  type="email" 
                  placeholder="email@example.com" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={memberForm.email} 
                  onChange={e => setMemberForm({...memberForm, email: e.target.value})} 
                  disabled={editingMember} 
                />
                {editingMember && <p className="text-gray-500 text-xs mt-1">Email tidak dapat diubah</p>}
              </div>
              
              {!editingMember && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input 
                    type="password" 
                    placeholder="Minimal 6 karakter" 
                    className="w-full p-2 rounded bg-black/50 border border-white/20" 
                    value={memberForm.password} 
                    onChange={e => setMemberForm({...memberForm, password: e.target.value})} 
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nomor Telepon</label>
                <input 
                  type="tel" 
                  placeholder="08123456789" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={memberForm.phone} 
                  onChange={e => setMemberForm({...memberForm, phone: e.target.value})} 
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bio / Kata-kata Singkat</label>
                <textarea 
                  rows="2" 
                  placeholder="Ceritakan tentang member..." 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={memberForm.bio} 
                  onChange={e => setMemberForm({...memberForm, bio: e.target.value})} 
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL Foto Profil</label>
                <input 
                  type="text" 
                  placeholder="https://..." 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={memberForm.avatar_url} 
                  onChange={e => setMemberForm({...memberForm, avatar_url: e.target.value})} 
                />
                {memberForm.avatar_url && (
                  <img src={memberForm.avatar_url} className="h-16 w-16 rounded-full mt-2 object-cover" alt="preview" />
                )}
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Poin Awal</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={memberForm.points} 
                  onChange={e => setMemberForm({...memberForm, points: parseInt(e.target.value) || 0})} 
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleSave} 
                className="bg-yellow-500 text-black px-4 py-2 rounded-full flex-1 font-semibold hover:bg-yellow-600 transition"
              >
                Simpan
              </button>
              <button 
                onClick={() => setShowModal(false)} 
                className="bg-gray-700 px-4 py-2 rounded-full hover:bg-gray-600 transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}