// ========== FILE: src/pages/AllNewsPage.jsx ==========
// Halaman daftar semua berita dari semua store
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Calendar, User, ArrowRight } from 'lucide-react';

export default function AllNewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStore, setFilterStore] = useState('all');
  const [stores, setStores] = useState([]);

  useEffect(() => {
    fetchStores();
    fetchNews();
  }, []);

  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('id, name, slug');
    if (data) setStores(data);
  };

  const fetchNews = async () => {
    let query = supabase
      .from('news')
      .select(`
        *,
        stores ( id, name, slug )
      `)
      .order('published_at', { ascending: false });

    const { data, error } = await query;
    if (error) console.error(error);
    else setNews(data || []);
    setLoading(false);
  };

  const filteredNews = filterStore === 'all' 
    ? news 
    : news.filter(item => item.stores?.id === filterStore);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Memuat berita...</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-display mb-4">Semua Berita & Artikel</h1>
        <p className="text-gray-400 mb-6">Informasi terbaru dari store partner kami</p>

        {/* Filter store */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button 
            onClick={() => setFilterStore('all')}
            className={`px-4 py-1 rounded-full text-sm transition ${filterStore === 'all' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            Semua Store
          </button>
          {stores.map(store => (
            <button
              key={store.id}
              onClick={() => setFilterStore(store.id)}
              className={`px-4 py-1 rounded-full text-sm transition ${filterStore === store.id ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              {store.name}
            </button>
          ))}
        </div>

        {/* Grid daftar berita */}
        {filteredNews.length === 0 ? (
          <p className="text-gray-500 text-center py-12">Tidak ada berita.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNews.map(item => (
              <Link key={item.id} to={`/news/${item.id}`} className="group">
                <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition hover:-translate-y-1">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.title} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                      <div className="flex items-center gap-1"><Calendar size={12} className="text-yellow-500" />{formatDate(item.published_at)}</div>
                      <div className="flex items-center gap-1"><User size={12} className="text-yellow-500" />{item.stores?.name}</div>
                    </div>
                    <h2 className="text-xl font-display font-bold group-hover:text-yellow-400 transition line-clamp-2">{item.title}</h2>
                    <p className="text-gray-400 text-sm mt-2 line-clamp-3">{item.excerpt || item.content?.substring(0, 120)}</p>
                    <div className="mt-4 text-yellow-500 text-sm flex items-center gap-1 group-hover:gap-2 transition">Baca Selengkapnya <ArrowRight size={14} /></div>
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