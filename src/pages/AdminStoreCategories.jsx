// ========== FILE: src/pages/AdminStoreCategories.jsx ==========
// Halaman untuk admin store mengatur kategori aktif dan urutan tab
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Check, X } from 'lucide-react';

export default function AdminStoreCategories() {
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    
    // Ambil store_id dari user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('store_id, role')
      .eq('id', user.id)
      .single();
    
    if (userError || !userData?.store_id) {
      alert('Akun ini tidak terhubung ke store manapun');
      navigate('/admin/dashboard');
      return;
    }
    
    // Cek role apakah store_admin (bisa juga super_admin)
    if (userData.role !== 'store_admin' && userData.role !== 'super_admin') {
      alert('Hanya admin store yang dapat mengakses halaman ini');
      navigate('/admin/dashboard');
      return;
    }
    
    // Ambil info store
    const { data: storeData } = await supabase
      .from('stores')
      .select('id, name')
      .eq('id', userData.store_id)
      .single();
    setStore(storeData);
    
    // Ambil data kategori
    await fetchCategoriesData(userData.store_id);
    setLoading(false);
  };

  const fetchCategoriesData = async (storeId) => {
    // Ambil semua master kategori
    const { data: masterCats, error: masterError } = await supabase
      .from('master_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (masterError) {
      console.error('Error fetching master categories:', masterError);
      return;
    }
    
    // Ambil store_categories untuk store ini
    const { data: storeCats, error: storeError } = await supabase
      .from('store_categories')
      .select('*')
      .eq('store_id', storeId);
    
    if (storeError) {
      console.error('Error fetching store categories:', storeError);
    }
    
    // Buat map untuk quick lookup
    const storeCatMap = new Map();
    (storeCats || []).forEach(sc => {
      storeCatMap.set(sc.category_id, sc);
    });
    
    // Gabungkan data
    const combined = masterCats.map(cat => ({
      ...cat,
      is_active: storeCatMap.has(cat.id) ? storeCatMap.get(cat.id).is_active : false,
      display_order: storeCatMap.has(cat.id) ? storeCatMap.get(cat.id).display_order : 999,
      store_category_id: storeCatMap.get(cat.id)?.id || null
    }));
    
    // Urutkan berdasarkan display_order
    combined.sort((a, b) => a.display_order - b.display_order);
    setCategories(combined);
  };

  const toggleActive = (categoryId) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, is_active: !cat.is_active } : cat
    ));
  };

  const updateDisplayOrder = (categoryId, newOrder) => {
    const numOrder = parseInt(newOrder);
    if (isNaN(numOrder)) return;
    
    setCategories(prev => {
      const updated = prev.map(cat => 
        cat.id === categoryId ? { ...cat, display_order: numOrder } : cat
      );
      // Re-sort berdasarkan display_order
      updated.sort((a, b) => a.display_order - b.display_order);
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Hapus semua store_categories untuk store ini terlebih dahulu
      if (store) {
        await supabase
          .from('store_categories')
          .delete()
          .eq('store_id', store.id);
      }
      
      // Insert ulang berdasarkan data yang sudah diubah
      const toInsert = categories
        .filter(cat => cat.is_active)
        .map(cat => ({
          store_id: store.id,
          category_id: cat.id,
          is_active: true,
          display_order: cat.display_order
        }));
      
      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('store_categories')
          .insert(toInsert);
        
        if (error) {
          throw error;
        }
      }
      
      alert('Pengaturan kategori berhasil disimpan!');
    } catch (error) {
      console.error('Save error:', error);
      alert('Gagal menyimpan: ' + error.message);
    }
    
    setSaving(false);
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-display">Pengaturan Kategori Store</h1>
            {store && <p className="text-gray-400 text-sm mt-1">{store.name}</p>}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => navigate('/admin/dashboard')}
              className="bg-gray-700 px-4 py-2 rounded-full text-sm flex items-center gap-1"
            >
              <ArrowLeft size={16} /> Kembali
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-yellow-500 text-black px-4 py-2 rounded-full text-sm flex items-center gap-1 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30 mb-6">
          <p className="text-sm text-yellow-500">
            📌 Pilih kategori mana yang akan muncul di halaman store Anda. 
            Urutan tab dapat diatur dengan mengisi nomor urut (semakin kecil, semakin ke kiri).
          </p>
        </div>

        {/* Tabel Kategori */}
        <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 border-b border-white/10">
              <tr>
                <th className="p-3 w-32">No. Urut</th>
                <th className="p-3">Nama Kategori</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aktif?</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 w-32">
                    <input
                      type="number"
                      value={cat.display_order}
                      onChange={(e) => updateDisplayOrder(cat.id, e.target.value)}
                      className="w-20 p-1 rounded bg-black/50 border border-white/20 text-center text-sm"
                      min="0"
                      max="999"
                    />
                  </td>
                  <td className="p-3 font-medium">
                    {cat.name}
                  </td>
                  <td className="p-3">
                    {cat.is_active ? (
                      <span className="text-green-400 text-sm flex items-center gap-1">
                        <Check size={14} /> Aktif
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm flex items-center gap-1">
                        <X size={14} /> Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive(cat.id)}
                      className={`px-3 py-1 rounded-full text-xs transition ${
                        cat.is_active
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {cat.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 bg-gray-900/30 rounded-xl">
          <h3 className="font-semibold mb-2 text-sm">Preview Urutan Tab di Halaman Store:</h3>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter(cat => cat.is_active)
              .sort((a, b) => a.display_order - b.display_order)
              .map(cat => (
                <span key={cat.id} className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                  {cat.name}
                </span>
              ))}
            {categories.filter(cat => cat.is_active).length === 0 && (
              <span className="text-gray-500 text-sm">Belum ada kategori yang diaktifkan</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            *Tab "Semua Produk" akan muncul secara otomatis di paling kiri
          </p>
        </div>
      </div>
    </div>
  );
}