// ========== FILE: src/pages/AllStoresPage.jsx ==========
// Halaman daftar semua store - tampilan grid 2 kolom simpel seperti produk
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function AllStoresPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error(error);
    } else {
      setStores(data || []);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-black min-h-screen text-white p-8">
        <Navbar />
        <div className="pt-20 text-center">Memuat store...</div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      
      {/* Container dengan padding top untuk navbar */}
      <div className="pt-20 px-4 pb-8">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold">Semua Store</h1>
          <p className="text-gray-400 text-sm mt-1">Temukan store partner kami</p>
        </div>
        
        {/* Grid 2 kolom simpel */}
        {stores.length === 0 ? (
          <p className="text-gray-500 text-center py-12">Belum ada store.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {stores.map((store) => (
              <Link key={store.id} to={`/store/${store.slug}`}>
                <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition">
                  {/* Gambar */}
                  <div className="aspect-square overflow-hidden">
                    <img 
                      src={store.cover_image || store.background_image || 'https://images.unsplash.com/photo-1566417713940-fe9c9f0f9c2c?q=80&w=2070'} 
                      alt={store.name}
                      className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    />
                  </div>
                  {/* Nama Store */}
                  <div className="p-2 text-center">
                    <h2 className="font-medium text-sm line-clamp-1">{store.name}</h2>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        
      </div>
    </div>
  );
}