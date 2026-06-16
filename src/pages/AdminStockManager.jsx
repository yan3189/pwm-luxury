// ============================================================
// FILE: src/pages/AdminStockManager.jsx
// Halaman manajemen stok untuk admin store
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, Package, Search, Plus, Minus, 
  RefreshCw, FileSpreadsheet, AlertCircle, CheckCircle,
  History, Clock, User, FileText
} from 'lucide-react';
import {
  getProducts,
  getStockHistory,
  updateStockManual,
  exportStockReport,
  checkStockAvailability
} from '../services/stockService';

export default function AdminStockManager() {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustmentType, setAdjustmentType] = useState('add'); // 'add' atau 'subtract'
  const [adjustmentAmount, setAdjustmentAmount] = useState(1);
  const [reason, setReason] = useState('adjustment');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [adminId, setAdminId] = useState(null);
  
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
      .select('id, store_id')
      .eq('id', user.id)
      .single();
    
    if (!userData?.store_id) {
      alert('Akun ini tidak terhubung ke store manapun');
      navigate('/admin/dashboard');
      return;
    }
    
    setAdminId(userData.id);
    await fetchData(userData.store_id);
  };

  const fetchData = async (storeId) => {
    setLoading(true);
    try {
      // Ambil info store
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('id', storeId)
        .single();
      setStore(storeData);
      
      // Ambil produk
      const productsData = await getProducts(storeId);
      setProducts(productsData);
      setFilteredProducts(productsData);
      
      // Ambil riwayat
      const historyData = await getStockHistory(storeId, 50);
      setHistory(historyData);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Gagal memuat data: ' + error.message });
    }
    setLoading(false);
  };

  // Filter produk berdasarkan search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredProducts(products.filter(p => 
        p.name.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, products]);

  // Update selected product info
  useEffect(() => {
    if (selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      setSelectedProduct(product);
    } else {
      setSelectedProduct(null);
    }
  }, [selectedProductId, products]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      setMessage({ type: 'error', text: 'Pilih produk terlebih dahulu' });
      return;
    }
    if (!adjustmentAmount || adjustmentAmount <= 0) {
      setMessage({ type: 'error', text: 'Masukkan jumlah yang valid' });
      return;
    }
    
    const adjustment = adjustmentType === 'add' ? adjustmentAmount : -adjustmentAmount;
    
    // Validasi stok tidak negatif
    if (adjustmentType === 'subtract') {
      const availability = await checkStockAvailability(selectedProductId, adjustmentAmount);
      if (!availability.available) {
        setMessage({ 
          type: 'error', 
          text: `Stok tidak mencukupi! Stok saat ini: ${availability.currentStock}` 
        });
        return;
      }
    }
    
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    
    try {
      const result = await updateStockManual({
  productId: selectedProductId,
  storeId: store.id,
  adjustment,
  reason,
  note,
  adminId
});

// Pastikan result.productName digunakan
setMessage({ 
  type: 'success', 
  text: `✅ Stok "${result.productName || selectedProduct?.name || 'Produk'}" berhasil diupdate (${adjustment > 0 ? '+' : ''}${adjustment})` 
});
      
      // Refresh data
      await fetchData(store.id);
      
      // Reset form (kecuali produk)
      setAdjustmentAmount(1);
      setNote('');
      setReason('adjustment');
      
    } catch (error) {
      setMessage({ type: 'error', text: '❌ ' + error.message });
    }
    setSubmitting(false);
  };

  const handleExport = async () => {
    if (!store) return;
    try {
      await exportStockReport(store.id, store.name);
      setMessage({ type: 'success', text: '✅ Laporan berhasil diunduh!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Gagal export: ' + error.message });
    }
  };

  const getReasonLabel = (reason) => {
    const labels = {
      'online_sale': '🛒 Penjualan Online',
      'offline_sale': '🏪 Penjualan Offline',
      'restock': '📦 Restok',
      'return': '↩️ Return',
      'adjustment': '⚙️ Penyesuaian'
    };
    return labels[reason] || reason;
  };

  const getReasonColor = (reason) => {
    const colors = {
      'online_sale': 'text-blue-400',
      'offline_sale': 'text-purple-400',
      'restock': 'text-green-400',
      'return': 'text-yellow-400',
      'adjustment': 'text-gray-400'
    };
    return colors[reason] || 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="bg-black min-h-screen text-white p-8 flex items-center justify-center">
        <div className="animate-pulse">Memuat...</div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate('/admin/dashboard')}
            className="text-gray-400 hover:text-yellow-500 transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-display">Manajemen Stok</h1>
            <p className="text-gray-400 text-sm">{store?.name}</p>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500 text-green-400' 
              : 'bg-red-500/20 border border-red-500 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ========== KOLOM KIRI: FORM UPDATE STOK ========== */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-display mb-4 flex items-center gap-2">
                <Package size={20} className="text-yellow-500" />
                Update Stok
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Pilih Produk */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Pilih Produk</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="text"
                      placeholder="Cari produk..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/50 border border-white/20 text-sm focus:border-yellow-500 focus:outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <select
                    className="w-full mt-2 p-2 rounded-lg bg-black/50 border border-white/20 text-sm focus:border-yellow-500 focus:outline-none"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  >
                    <option value="">-- Pilih Produk --</option>
                    {filteredProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stok: {p.stock || 0})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info Produk Terpilih */}
                {selectedProduct && (
                  <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
                    <p className="font-semibold">{selectedProduct.name}</p>
                    <p className="text-gray-400">Stok saat ini: <span className="text-yellow-500 font-bold">{selectedProduct.stock || 0}</span></p>
                    {selectedProduct.master_categories?.name && (
                      <p className="text-gray-500 text-xs">Kategori: {selectedProduct.master_categories.name}</p>
                    )}
                  </div>
                )}

                {/* Tipe Adjustment */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tipe</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('add')}
                      className={`py-2 rounded-lg flex items-center justify-center gap-2 transition ${
                        adjustmentType === 'add' 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      <Plus size={16} /> Tambah
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('subtract')}
                      className={`py-2 rounded-lg flex items-center justify-center gap-2 transition ${
                        adjustmentType === 'subtract' 
                          ? 'bg-red-600 text-white' 
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      <Minus size={16} /> Kurangi
                    </button>
                  </div>
                </div>

                {/* Jumlah */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-sm focus:border-yellow-500 focus:outline-none"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(parseInt(e.target.value) || 1)}
                    required
                  />
                </div>

                {/* Alasan */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Alasan</label>
                  <select
                    className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-sm focus:border-yellow-500 focus:outline-none"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="restock">📦 Restok</option>
                    <option value="offline_sale">🏪 Penjualan Offline</option>
                    <option value="return">↩️ Return</option>
                    <option value="adjustment">⚙️ Penyesuaian</option>
                  </select>
                </div>

                {/* Catatan */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Catatan (opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Restok dari supplier A"
                    className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-sm focus:border-yellow-500 focus:outline-none"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                {/* Tombol Submit */}
                <button
                  type="submit"
                  disabled={submitting || !selectedProductId}
                  className="w-full bg-yellow-500 text-black font-semibold py-2 rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
                >
                  {submitting ? 'Memproses...' : 'Update Stok'}
                </button>
              </form>

              {/* Tombol Export */}
              <button
                onClick={handleExport}
                className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm"
              >
                <FileSpreadsheet size={16} /> Export Laporan Stok
              </button>
            </div>
          </div>

          {/* ========== KOLOM KANAN: RIWAYAT ========== */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-display flex items-center gap-2">
                  <History size={20} className="text-yellow-500" />
                  Riwayat Perubahan Stok
                </h2>
                <button 
                  onClick={() => fetchData(store.id)}
                  className="text-gray-400 hover:text-yellow-500 transition text-sm flex items-center gap-1"
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Clock size={40} className="mx-auto mb-3 opacity-50" />
                  <p>Belum ada riwayat perubahan stok</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-400 border-b border-white/10 sticky top-0 bg-gray-900 z-10">
                      <tr>
                        <th className="text-left py-2 px-2">Tanggal</th>
                        <th className="text-left py-2 px-2">Produk</th>
                        <th className="text-center py-2 px-2">Sebelum</th>
                        <th className="text-center py-2 px-2">Sesudah</th>
                        <th className="text-center py-2 px-2">Perubahan</th>
                        <th className="text-left py-2 px-2">Alasan</th>
                        <th className="text-left py-2 px-2 hidden md:table-cell">Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-2 text-xs whitespace-nowrap">
                            {new Date(h.created_at).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-2 font-medium">{h.products?.name || '-'}</td>
                          <td className="py-2 px-2 text-center">{h.old_stock}</td>
                          <td className="py-2 px-2 text-center">{h.new_stock}</td>
                          <td className={`py-2 px-2 text-center font-bold ${
                            h.adjustment > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {h.adjustment > 0 ? '+' : ''}{h.adjustment}
                          </td>
                          <td className={`py-2 px-2 text-xs ${getReasonColor(h.reason)}`}>
                            {getReasonLabel(h.reason)}
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-400 hidden md:table-cell">
                            {h.users?.full_name || h.users?.email || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}