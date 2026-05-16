// ========== FILE: src/pages/AllStoresPage.jsx ==========
// Halaman daftar semua store (2 kolom, seperti tampilan produk di store)
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { MapPin } from 'lucide-react';

export default function AllStoresPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');

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

  const categories = [
    { value: 'all', label: 'Semua' },
    { value: 'bar', label: 'Bar' },
    { value: 'club', label: 'Club' },
    { value: 'coffee_shop', label: 'Coffee Shop' },
  ];

  const filteredStores = filterCategory === 'all'
    ? stores
    : stores.filter(store => store.category === filterCategory);

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Memuat store...</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <h1 className="text-3xl font-display mb-2">Semua Store Partner</h1>
        <p className="text-gray-400 mb-6 text-sm">Temukan store partner kami di berbagai kota</p>

        {/* Filter kategori - scroll horizontal di mobile */}
        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`px-4 py-1.5 rounded-full text-sm transition ${
                filterCategory === cat.value
                  ? 'bg-yellow-500 text-black font-medium'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid 2 kolom seperti produk di store */}
        {filteredStores.length === 0 ? (
          <p className="text-gray-500 text-center py-12">Belum ada store dalam kategori ini.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredStores.map(store => (
              <Link key={store.id} to={`/store/${store.slug}`} className="group">
                <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition hover:-translate-y-1">
                  <div className="relative h-40 overflow-hidden">
                    <img 
                      src={store.cover_image || store.background_image || 'https://images.unsplash.com/photo-1566417713940-fe9c9f0f9c2c?q=80&w=2070'} 
                      alt={store.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                    />
                    {store.category && (
                      <div className="absolute top-2 left-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded-full text-xs">
                        {store.category === 'bar' && '🍸 Bar'}
                        {store.category === 'club' && '🎧 Club'}
                        {store.category === 'coffee_shop' && '☕ Coffee Shop'}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h2 className="font-bold text-sm group-hover:text-yellow-400 transition line-clamp-1">
                      {store.name}
                    </h2>
                    <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
                      <MapPin size={10} />
                      <span className="line-clamp-1">{store.location || store.category}</span>
                    </div>
                    <button className="mt-3 w-full bg-white/10 hover:bg-yellow-500 hover:text-black py-1.5 rounded-full transition font-medium text-xs">
                      Lihat Store
                    </button>
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