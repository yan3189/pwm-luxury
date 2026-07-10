// ========== FILE: src/pages/SuperAdminCategories.jsx ==========
// Halaman untuk super admin mengelola master kategori (CRUD)
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Save, X } from 'lucide-react';

export default function SuperAdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', initial: '',sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  const checkSuperAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/admin/login');
      return;
    }
    
    // Cek role user apakah super_admin
    const { data: userData, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (error || userData?.role !== 'super_admin') {
      alert('Hanya Super Admin yang dapat mengakses halaman ini');
      navigate('/admin/dashboard');
      return;
    }
    
    fetchCategories();
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('master_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', sort_order: categories.length + 1 });
    setShowModal(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, initial: category.initial || '', sort_order: category.sort_order });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!categoryForm.name.trim()) {
      alert('Nama kategori tidak boleh kosong');
      return;
    }
    
    setSaving(true);
    
    if (editingCategory) {
      // Update
      const { error } = await supabase
        .from('master_categories')
        .update({
          name: categoryForm.name,
          initial: categoryForm.initial || null,
          sort_order: categoryForm.sort_order
        })
        .eq('id', editingCategory.id);
      
      if (error) {
        alert('Gagal update: ' + error.message);
      } else {
        alert('Kategori berhasil diupdate');
      }
    } else {
      // Insert baru
      const { error } = await supabase
        .from('master_categories')
        .insert([{
          name: categoryForm.name,
          initial: categoryForm.initial || null,
          sort_order: categoryForm.sort_order
        }]);
      
      if (error) {
        alert('Gagal tambah: ' + error.message);
      } else {
        alert('Kategori berhasil ditambahkan');
      }
    }
    
    setShowModal(false);
    fetchCategories();
    setSaving(false);
  };

  const handleDelete = async (category) => {
    // Cek apakah kategori sudah digunakan oleh produk
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', category.id);
    
    if (countError) {
      alert('Gagal mengecek penggunaan kategori: ' + countError.message);
      return;
    }
    
    if (count > 0) {
      alert(`Kategori "${category.name}" tidak dapat dihapus karena masih digunakan oleh ${count} produk.`);
      return;
    }
    
    if (confirm(`Hapus kategori "${category.name}"?`)) {
      const { error } = await supabase
        .from('master_categories')
        .delete()
        .eq('id', category.id);
      
      if (error) {
        alert('Gagal hapus: ' + error.message);
      } else {
        alert('Kategori berhasil dihapus');
        fetchCategories();
      }
    }
  };

  const moveUp = async (index) => {
    if (index === 0) return;
    const current = categories[index];
    const prev = categories[index - 1];
    
    // Swap sort_order
    const temp = current.sort_order;
    current.sort_order = prev.sort_order;
    prev.sort_order = temp;
    
    // Update ke database
    const { error: error1 } = await supabase
      .from('master_categories')
      .update({ sort_order: current.sort_order })
      .eq('id', current.id);
    
    const { error: error2 } = await supabase
      .from('master_categories')
      .update({ sort_order: prev.sort_order })
      .eq('id', prev.id);
    
    if (error1 || error2) {
      alert('Gagal mengubah urutan');
      fetchCategories();
    } else {
      fetchCategories();
    }
  };

  const moveDown = async (index) => {
    if (index === categories.length - 1) return;
    const current = categories[index];
    const next = categories[index + 1];
    
    const temp = current.sort_order;
    current.sort_order = next.sort_order;
    next.sort_order = temp;
    
    const { error: error1 } = await supabase
      .from('master_categories')
      .update({ sort_order: current.sort_order })
      .eq('id', current.id);
    
    const { error: error2 } = await supabase
      .from('master_categories')
      .update({ sort_order: next.sort_order })
      .eq('id', next.id);
    
    if (error1 || error2) {
      alert('Gagal mengubah urutan');
      fetchCategories();
    } else {
      fetchCategories();
    }
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-display">Manajemen Master Kategori</h1>
            <p className="text-gray-400 text-sm mt-1">Super Admin hanya</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => navigate('/admin/dashboard')}
              className="bg-gray-700 px-4 py-2 rounded-full text-sm flex items-center gap-1"
            >
              <ArrowLeft size={16} /> Kembali ke Dashboard
            </button>
            <button 
              onClick={openAddModal}
              className="bg-yellow-500 text-black px-4 py-2 rounded-full text-sm flex items-center gap-1"
            >
              <Plus size={16} /> Tambah Kategori
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30 mb-6">
          <p className="text-sm text-yellow-500">
            📌 Kategori ini akan tersedia untuk semua store. Store dapat memilih kategori mana yang akan diaktifkan.
          </p>
        </div>

        {/* Tabel Kategori */}
        <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 border-b border-white/10">
              <tr>
                <th className="p-3 w-20">No. Urut</th>
                <th className="p-3">Nama Kategori</th>
                <th className="p-3">Inisial</th>
                <th className="p-3">Dibuat</th>
                <th className="p-3 w-48">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr key={cat.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-center">
                    {cat.sort_order}
                  </td>
                  <td className="p-3 font-medium">{cat.name}</td>
                  <td className="p-3 font-mono text-xs">{cat.initial || '-'}</td>
                  <td className="p-3 text-sm text-gray-400">
                    {new Date(cat.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => openEditModal(cat)}
                        className="text-blue-400 hover:text-blue-300 p-1"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(cat)}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Hapus"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className={`p-1 ${idx === 0 ? 'text-gray-600' : 'text-yellow-500 hover:text-yellow-400'}`}
                        title="Naikkan Urutan"
                      >
                        ↑
                      </button>
                      <button 
                        onClick={() => moveDown(idx)}
                        disabled={idx === categories.length - 1}
                        className={`p-1 ${idx === categories.length - 1 ? 'text-gray-600' : 'text-yellow-500 hover:text-yellow-400'}`}
                        title="Turunkan Urutan"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-3 text-center text-gray-500">Belum ada kategori</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Catatan */}
        <div className="mt-6 p-4 bg-gray-900/30 rounded-xl">
          <h3 className="font-semibold mb-2 text-sm">Catatan:</h3>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            <li>Kategori yang sudah digunakan oleh produk tidak dapat dihapus</li>
            <li>Urutan kategori (No. Urut) mempengaruhi tampilan di dropdown saat menambah/ mengedit produk</li>
            <li>Store dapat memilih kategori mana yang akan ditampilkan di halaman store mereka</li>
          </ul>
        </div>
      </div>

      {/* MODAL TAMBAH/EDIT KATEGORI */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="text-xl font-display mb-4">
              {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
            </h3>
            
            <div className="space-y-4">
              <div>
  <label className="block text-sm text-gray-400 mb-1">Nama Kategori</label>
  <input 
    type="text" 
    className="w-full p-2 rounded bg-black/50 border border-white/20" 
    value={categoryForm.name} 
    onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} 
  />
</div>

{/* ===== INITIAL KATEGORI ===== */}
<div>
  <label className="block text-sm text-gray-400 mb-1">Initial Kategori (opsional)</label>
  <input 
    type="text" 
    className="w-full p-2 rounded bg-black/50 border border-white/20" 
    placeholder="Contoh: KOP untuk Kopi, TEA untuk Teh"
    value={categoryForm.initial || ''} 
    onChange={e => setCategoryForm({...categoryForm, initial: e.target.value.toUpperCase()})} 
  />
  <p className="text-xs text-gray-500 mt-1">Digunakan untuk auto-generate product code.</p>
</div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nomor Urut</label>
                <input 
                  type="number" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={categoryForm.sort_order}
                  onChange={e => setCategoryForm({...categoryForm, sort_order: parseInt(e.target.value) || 0})}
                  min="0"
                  max="999"
                />
                <p className="text-gray-500 text-xs mt-1">Semakin kecil angkanya, semakin atas posisinya</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-yellow-500 text-black px-4 py-2 rounded-full flex-1 font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button 
                onClick={() => setShowModal(false)}
                className="bg-gray-700 px-4 py-2 rounded-full flex items-center gap-1"
              >
                <X size={16} /> Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}