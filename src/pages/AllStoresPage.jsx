// ========== FILE: src/pages/AllStoresPage.jsx ==========
// Halaman daftar semua store dengan search
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { MapPin, Search } from 'lucide-react';

export default function AllStoresPage() {
  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    let filtered = [...stores];
    
    // Filter kategori
    if (filterCategory !== 'all') {
      filtered = filtered.filter(store => store.category === filterCategory);
    }
    
    // Filter search
    if (searchQuery.trim().length >= 2) {
      filtered = filtered.filter(store => 
        store.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredStores(filtered);
  }, [filterCategory, searchQuery, stores]);

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error(error);
    } else {
      setStores(data || []);
      setFilteredStores(data || []);
    }
    setLoading(false);
  };

  const categories = [
    { value: 'all', label: 'Semua' },
    { value: 'bar', label: '🍸 Bar' },
    { value: 'club', label: '🎧 Club' },
    { value: 'coffee_shop', label: '☕ Coffee Shop' },
  ];

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Memuat store...</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      
      {/* Hero kecil seperti halaman store */}
      <div className="relative h-48 md:h-56 w-full overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1566417713940-fe9c9f0f9c2c?q=80&w=2070" 
          alt="All Stores"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
          <h1 className="text-4xl md:text-5xl font-display font-bold">Our Stores</h1>
          <p className="text-gray-200 mt-2">Temukan store partner kami di berbagai kota</p>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-6 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cari nama toko..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800/50 border border-white/10 text-white text-sm focus:border-yellow-500 focus:outline-none transition"
            />
          </div>
        </div>
        
        {/* Filter kategori */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
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

        {/* Grid 2 kolom seperti tampilan produk */}
        {filteredStores.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Tidak ada store yang ditemukan.</p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-2 text-yellow-500 text-sm hover:underline"
              >
                Hapus pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredStores.map(store => (
              <Link key={store.id} to={`/store/${store.slug}`} className="group">
                <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition hover:-translate-y-1">
                  <div className="relative h-32 md:h-40 overflow-hidden">
                    <img 
                      src={store.cover_image || store.background_image || 'https://images.unsplash.com/photo-1566417713940-fe9c9f0f9c2c?q=80&w=2070'} 
                      alt={store.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                    />
                    {store.category && (
                      <div className="absolute top-2 left-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded-full text-[10px]">
                        {store.category === 'bar' && '🍸 Bar'}
                        {store.category === 'club' && '🎧 Club'}
                        {store.category === 'coffee_shop' && '☕ Coffee'}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h2 className="font-bold text-sm md:text-base group-hover:text-yellow-400 transition line-clamp-1">
                      {store.name}
                    </h2>
                    {store.location && (
                      <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
                        <MapPin size={10} />
                        <span className="line-clamp-1">{store.location}</span>
                      </div>
                    )}
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