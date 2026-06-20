// ============================================================
// FILE: src/pages/AdminPromotions.jsx
// Admin: Manajemen Upselling (dari products), Bonus, Voucher
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, Package, Gift, Tag, Plus, Edit, Trash2, 
  Eye, EyeOff, RefreshCw, Search, X, Check, AlertCircle
} from 'lucide-react';
import { getBonuses, createUpsell, updateUpsell, deleteUpsell, toggleUpsell } from '../services/upsellService';
import { createVoucher, getMemberVouchers, assignVoucherToMember } from '../services/voucherService';

export default function AdminPromotions() {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);           // ← BARU: daftar produk
  const [productsLoading, setProductsLoading] = useState(false);
  const [bonuses, setBonuses] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upsells'); // 'upsells' | 'bonuses' | 'vouchers'
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState({}); // track which product is being updated
  const navigate = useNavigate();

  // Modal state (untuk Bonus & Voucher)
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);

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
    
    if (!userData?.store_id) {
      alert('Akun ini tidak terhubung ke store');
      navigate('/admin/dashboard');
      return;
    }
    
    const { data: storeData } = await supabase
      .from('stores')
      .select('id, name')
      .eq('id', userData.store_id)
      .single();
    setStore(storeData);
    await loadData(storeData.id);
  };

  const loadData = async (storeId) => {
    setLoading(true);
    try {
      // Load bonus & voucher (tetap sama)
      const bonusData = await getBonuses(storeId);
      setBonuses(bonusData);
      
      const { data: voucherData } = await supabase
        .from('vouchers')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      setVouchers(voucherData || []);
      
      // Load produk untuk tab Upselling
      await loadProducts(storeId);
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  // ========== FUNGSI LOAD PRODUK ==========
  const loadProducts = async (storeId) => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, is_upsell, is_active, stock')
        .eq('store_id', storeId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Gagal memuat produk: ' + error.message);
    }
    setProductsLoading(false);
  };

  // ========== TOGGLE IS_UPSELL ==========
  const toggleUpsellStatus = async (productId, currentStatus) => {
    // Set loading state untuk produk ini
    setUpdating(prev => ({ ...prev, [productId]: true }));
    
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('products')
        .update({ is_upsell: newStatus })
        .eq('id', productId);
      
      if (error) throw error;
      
      // Update state lokal
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, is_upsell: newStatus } : p
      ));
      
      // Feedback sukses
      console.log(`✅ Product ${productId} upsell status: ${newStatus}`);
      
    } catch (error) {
      console.error('Error toggling upsell:', error);
      alert('Gagal mengubah status upsell: ' + error.message);
    }
    
    setUpdating(prev => ({ ...prev, [productId]: false }));
  };

  // ========== FUNGSI UNTUK BONUS & VOUCHER (TETAP SAMA) ==========
  const handleDelete = async (id, type) => {
    if (!confirm('Yakin hapus item ini?')) return;
    try {
      if (type === 'bonus') {
        await supabase.from('checkout_bonuses').delete().eq('id', id);
      } else if (type === 'voucher') {
        await supabase.from('vouchers').delete().eq('id', id);
      }
      await loadData(store.id);
    } catch (error) {
      alert('Gagal hapus: ' + error.message);
    }
  };

  const handleToggle = async (id, type) => {
    try {
      if (type === 'bonus') {
        const { data: current } = await supabase
          .from('checkout_bonuses')
          .select('is_active')
          .eq('id', id)
          .single();
        await supabase
          .from('checkout_bonuses')
          .update({ is_active: !current.is_active })
          .eq('id', id);
      } else if (type === 'voucher') {
        const { data: current } = await supabase
          .from('vouchers')
          .select('is_active')
          .eq('id', id)
          .single();
        await supabase
          .from('vouchers')
          .update({ is_active: !current.is_active })
          .eq('id', id);
      }
      await loadData(store.id);
    } catch (error) {
      alert('Gagal toggle: ' + error.message);
    }
  };

  const openModal = (item = null, type) => {
    setEditingItem(item);
    if (item) {
      setForm(item);
    } else {
      setForm({ 
        store_id: store.id, 
        is_active: true, 
        title: '', 
        description: '', 
        display_order: 0,
        type: type === 'voucher' ? 'discount_percent' : '',
        value: 0,
        min_order: 0,
        is_global: true,
        code: '',
        name: '',
        usage_limit: null
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      if (activeTab === 'bonuses') {
        const data = {
          store_id: store.id,
          title: form.title,
          description: form.description || '',
          is_active: form.is_active !== undefined ? form.is_active : true,
          display_order: form.display_order || 0
        };
        if (editingItem) {
          await supabase.from('checkout_bonuses').update(data).eq('id', editingItem.id);
        } else {
          await supabase.from('checkout_bonuses').insert([data]);
        }
      } else if (activeTab === 'vouchers') {
        await createVoucher({ ...form, store_id: store.id });
      }
      await loadData(store.id);
      setShowModal(false);
    } catch (error) {
      alert('Gagal menyimpan: ' + error.message);
    }
    setSubmitting(false);
  };

  const renderForm = () => {
    if (activeTab === 'bonuses') {
      return (
        <div className="space-y-3">
          <div><label className="block text-sm text-gray-400">Judul Bonus</label><input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div><label className="block text-sm text-gray-400">Deskripsi</label><input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div><label className="block text-sm text-gray-400">Urutan</label><input type="number" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.display_order || 0} onChange={e => setForm({...form, display_order: parseInt(e.target.value) || 0})} /></div>
          <div><label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({...form, is_active: e.target.checked})} /> Aktif</label></div>
        </div>
      );
    } else if (activeTab === 'vouchers') {
      return (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div><label className="block text-sm text-gray-400">Nama Voucher</label><input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><label className="block text-sm text-gray-400">Kode Voucher</label><input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.code || ''} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} /></div>
          <div><label className="block text-sm text-gray-400">Deskripsi</label><input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div><label className="block text-sm text-gray-400">Tipe</label>
            <select className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.type || 'discount_percent'} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="shipping_free">Gratis Ongkir</option>
              <option value="discount_percent">Diskon Persentase</option>
              <option value="discount_nominal">Diskon Nominal</option>
            </select>
          </div>
          <div><label className="block text-sm text-gray-400">Nilai</label>
            <input type="number" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.value || 0} onChange={e => setForm({...form, value: parseInt(e.target.value) || 0})} />
            <p className="text-xs text-gray-500">Untuk persentase: 10 = 10%, untuk nominal: 5000 = Rp 5.000</p>
          </div>
          <div><label className="block text-sm text-gray-400">Maks Diskon (opsional, untuk persentase)</label>
            <input type="number" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.max_discount || ''} onChange={e => setForm({...form, max_discount: parseInt(e.target.value) || ''})} />
          </div>
          <div><label className="block text-sm text-gray-400">Min. Order</label>
            <input type="number" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.min_order || 0} onChange={e => setForm({...form, min_order: parseInt(e.target.value) || 0})} />
          </div>
          <div><label className="flex items-center gap-2"><input type="checkbox" checked={form.is_global !== false} onChange={e => setForm({...form, is_global: e.target.checked})} /> Global (semua member bisa pakai)</label></div>
          <div><label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({...form, is_active: e.target.checked})} /> Aktif</label></div>
          <div><label className="block text-sm text-gray-400">Batas Penggunaan (kosongkan = unlimited)</label>
            <input type="number" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.usage_limit || ''} onChange={e => setForm({...form, usage_limit: parseInt(e.target.value) || ''})} />
          </div>
          <div><label className="block text-sm text-gray-400">Tanggal Mulai (opsional)</label>
            <input type="datetime-local" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.start_date || ''} onChange={e => setForm({...form, start_date: e.target.value})} />
          </div>
          <div><label className="block text-sm text-gray-400">Tanggal Kadaluarsa (opsional)</label>
            <input type="datetime-local" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.end_date || ''} onChange={e => setForm({...form, end_date: e.target.value})} />
          </div>
        </div>
      );
    }
    return null;
  };

  const getFilteredData = () => {
    const query = searchQuery.toLowerCase();
    if (activeTab === 'upsells') {
      // Filter produk berdasarkan nama
      return products.filter(p => p.name?.toLowerCase().includes(query));
    } else if (activeTab === 'bonuses') {
      return bonuses.filter(item => item.title?.toLowerCase().includes(query));
    } else {
      return vouchers.filter(item => item.name?.toLowerCase().includes(query) || item.code?.toLowerCase().includes(query));
    }
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  const data = getFilteredData();

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin/dashboard')} className="text-gray-400 hover:text-yellow-500 transition">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-display">Manajemen Promosi</h1>
            <p className="text-gray-400 text-sm">{store?.name}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6">
          {[
            { key: 'upsells', label: 'Upselling', icon: <Package size={16} /> },
            { key: 'bonuses', label: 'Bonus', icon: <Gift size={16} /> },
            { key: 'vouchers', label: 'Voucher', icon: <Tag size={16} /> }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
              className={`py-2 px-4 flex items-center gap-2 text-sm transition border-b-2 ${
                activeTab === tab.key 
                  ? 'border-yellow-500 text-yellow-500' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Cari..."
              className="pl-9 pr-4 py-2 rounded-lg bg-black/50 border border-white/20 text-sm focus:border-yellow-500 focus:outline-none w-48"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {activeTab !== 'upsells' && (
            <button
              onClick={() => openModal(null, activeTab)}
              className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-yellow-600 transition"
            >
              <Plus size={16} /> Tambah {activeTab === 'bonuses' ? 'Bonus' : 'Voucher'}
            </button>
          )}
          {activeTab === 'upsells' && (
            <button
              onClick={() => loadProducts(store.id)}
              className="bg-gray-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-600 transition"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          )}
        </div>

        {/* ========== TAB UPSELING ========== */}
        {activeTab === 'upsells' && (
          <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
            {productsLoading ? (
              <div className="p-8 text-center text-gray-400">Memuat produk...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50 border-b border-white/10">
                  <tr>
                    <th className="p-3 text-left">Produk</th>
                    <th className="p-3 text-left">Harga</th>
                    <th className="p-3 text-left">Stok</th>
                    <th className="p-3 text-center">Status Upsell</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">
                      {searchQuery ? 'Tidak ada produk yang cocok' : 'Belum ada produk'}
                    </td></tr>
                  ) : (
                    data.map(product => {
                      const isUpsell = product.is_upsell === true;
                      const isUpdating = updating[product.id];
                      
                      return (
                        <tr key={product.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-10 h-10 object-cover rounded" />
                              ) : (
                                <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center text-gray-500 text-xs">
                                  No img
                                </div>
                              )}
                              <span className="font-medium line-clamp-1">{product.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-yellow-500">Rp {product.price?.toLocaleString()}</td>
                          <td className="p-3">{product.stock || 0}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleUpsellStatus(product.id, isUpsell)}
                              disabled={isUpdating}
                              className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${
                                isUpsell ? 'bg-yellow-500' : 'bg-gray-600'
                              } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span
                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                  isUpsell ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className="ml-2 text-xs text-gray-400">
                              {isUpsell ? 'Aktif' : 'Nonaktif'}
                            </span>
                            {isUpdating && (
                              <span className="ml-2 text-xs text-yellow-500">⏳</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => navigate(`/admin/products`)}
                              className="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              Edit di Produk
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
            <div className="p-3 text-xs text-gray-500 border-t border-white/10">
              Total produk: {data.length}
            </div>
          </div>
        )}

        {/* ========== TAB BONUS & VOUCHER ========== */}
        {(activeTab === 'bonuses' || activeTab === 'vouchers') && (
          <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 border-b border-white/10">
                <tr>
                  <th className="p-3 text-left">Nama</th>
                  {activeTab === 'vouchers' && <th className="p-3 text-left">Kode</th>}
                  {activeTab === 'vouchers' && <th className="p-3 text-left">Tipe</th>}
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-gray-500">Belum ada data</td></tr>
                ) : (
                  data.map(item => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3 font-medium">
                        {activeTab === 'vouchers' ? item.name : item.title}
                      </td>
                      {activeTab === 'vouchers' && (
                        <>
                          <td className="p-3 font-mono text-xs">{item.code}</td>
                          <td className="p-3 text-xs">
                            {item.type === 'shipping_free' ? '🚚 Gratis Ongkir' : 
                             item.type === 'discount_percent' ? `${item.value}%` : 
                             `Rp ${item.value?.toLocaleString()}`}
                          </td>
                        </>
                      )}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggle(item.id, activeTab === 'bonuses' ? 'bonus' : 'voucher')}
                          className={`px-2 py-1 rounded-full text-xs transition ${
                            item.is_active !== false
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                          }`}
                        >
                          {item.is_active !== false ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="p-3 text-right flex gap-2 justify-end">
                        <button onClick={() => openModal(item, activeTab)} className="text-blue-400 hover:text-blue-300">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id, activeTab === 'bonuses' ? 'bonus' : 'voucher')} className="text-red-400 hover:text-red-300">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal (untuk Bonus & Voucher) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-display">
                {editingItem ? 'Edit' : 'Tambah'} {activeTab === 'bonuses' ? 'Bonus' : 'Voucher'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            {renderForm()}
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={submitting} className="flex-1 bg-yellow-500 text-black py-2 rounded-lg font-semibold disabled:opacity-50">
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}