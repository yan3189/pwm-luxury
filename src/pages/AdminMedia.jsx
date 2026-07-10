// ============================================================
// FILE: src/pages/AdminMedia.jsx
// Halaman galeri media untuk admin (super admin & store admin)
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Store } from 'lucide-react';
import MediaGallery from '../components/MediaGallery';

export default function AdminMedia() {
  const [user, setUser] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storeList, setStoreList] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [userRole, setUserRole] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/admin/login');
      return;
    }
    setUser(user);

    // Ambil data user
    const { data: userData, error } = await supabase
      .from('users')
      .select('role, store_id')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user data:', error);
      setLoading(false);
      return;
    }

    setUserRole(userData.role);

    // Super admin: bisa lihat semua store
    if (userData.role === 'super_admin') {
      const { data: stores } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');
      
      setStoreList(stores || []);
      if (stores && stores.length > 0) {
        setSelectedStoreId(stores[0].id);
      }
    } else {
      // Store admin: hanya store-nya
      setSelectedStoreId(userData.store_id);
      
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('id', userData.store_id)
        .single();
      
      setStore(storeData);
    }

    setLoading(false);
  };

  if (loading) {
    return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  }

  if (!selectedStoreId) {
    return (
      <div className="bg-black min-h-screen text-white p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-400">Belum ada store yang tersedia.</p>
          <button 
            onClick={() => navigate('/admin/dashboard')} 
            className="mt-4 bg-yellow-500 text-black px-4 py-2 rounded-full"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <button 
              onClick={() => navigate('/admin/dashboard')}
              className="text-gray-400 hover:text-yellow-500 transition flex items-center gap-1 text-sm mb-2"
            >
              <ArrowLeft size={16} /> Kembali
            </button>
            <h1 className="text-2xl font-display">📸 Manajemen Media</h1>
            <p className="text-gray-400 text-sm">
              {userRole === 'super_admin' 
                ? 'Super Admin: Kelola semua media store' 
                : `Store Admin: Kelola semua media (global)`
              }
            </p>
          </div>
        </div>

        {/* Store Selector (Super Admin) */}
        {userRole === 'super_admin' && storeList.length > 1 && (
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10 mb-6">
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Store size={16} /> Pilih Store:
            </label>
            <select
              value={selectedStoreId || ''}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-black/50 border border-white/20 rounded-lg px-3 py-2 w-full md:w-64"
            >
              {storeList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Media Gallery */}
        <MediaGallery
            storeId={null}  
          userId={user?.id}
          selectable={false}
          allowedTypes="all"
        />
      </div>
    </div>
  );
}