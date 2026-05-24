// ========== FILE: src/pages/AdminShippingSettings.jsx ==========
// Halaman untuk admin store mengatur ongkos kirim
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getStoreShippingSettings, updateStoreShippingSettings } from '../services/shippingService';
import { ArrowLeft, Save, Truck } from 'lucide-react';

export default function AdminShippingSettings() {
  const [store, setStore] = useState(null);
  const [baseCost, setBaseCost] = useState(10000);
  const [costPerKm, setCostPerKm] = useState(2000);
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
    const { data: userData } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', user.id)
      .single();
    
    if (userData?.store_id) {
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('id', userData.store_id)
        .single();
      setStore(storeData);
      
      // Ambil setting ongkir yang sudah ada
      const settings = await getStoreShippingSettings(storeData.id);
      setBaseCost(settings.base_shipping_cost);
      setCostPerKm(settings.cost_per_km);
    } else {
      alert('Akun ini tidak terhubung ke store manapun');
      navigate('/admin/dashboard');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (baseCost < 0 || costPerKm < 0) {
      alert('Nilai tidak boleh negatif');
      return;
    }
    setSaving(true);
    try {
      await updateStoreShippingSettings(store.id, baseCost, costPerKm);
      alert('Pengaturan ongkir berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate('/admin/dashboard')}
            className="text-gray-400 hover:text-yellow-500 transition"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-display">Pengaturan Ongkos Kirim</h1>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <Truck size={28} className="text-yellow-500" />
            <div>
              <p className="text-gray-400 text-sm">Store: {store?.name}</p>
              <p className="text-xs text-gray-500">Jarak dihitung menggunakan rumus Haversine (garis lurus)</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Biaya Dasar */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Biaya Dasar (Base Cost)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
                <input
                  type="number"
                  value={baseCost}
                  onChange={(e) => setBaseCost(parseInt(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-black/50 border border-white/20 text-white focus:border-yellow-500 focus:outline-none"
                  placeholder="10000"
                  min="0"
                  step="1000"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Biaya tetap yang akan dikenakan untuk setiap pengiriman</p>
            </div>

            {/* Biaya per KM */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Biaya per Kilometer (Cost per KM)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
                <input
                  type="number"
                  value={costPerKm}
                  onChange={(e) => setCostPerKm(parseInt(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-black/50 border border-white/20 text-white focus:border-yellow-500 focus:outline-none"
                  placeholder="2000"
                  min="0"
                  step="500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Biaya tambahan per kilometer jarak</p>
            </div>

            {/* Contoh Perhitungan */}
            <div className="bg-gray-800/50 rounded-lg p-4 mt-4">
              <p className="text-sm font-semibold mb-2">📐 Contoh Perhitungan</p>
              <div className="space-y-1 text-sm text-gray-300">
                <p>Jika jarak = <span className="text-yellow-500">5 km</span></p>
                <p>Ongkir = Biaya Dasar + (Jarak × Biaya per KM)</p>
                <p>Ongkir = Rp {baseCost.toLocaleString()} + (5 × Rp {costPerKm.toLocaleString()})</p>
                <p className="text-yellow-400 font-semibold">= Rp {(baseCost + (5 * costPerKm)).toLocaleString()}</p>
              </div>
            </div>

            {/* Tombol Simpan */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-yellow-500 text-black font-semibold py-3 rounded-lg hover:bg-yellow-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}