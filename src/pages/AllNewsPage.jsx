// ========== FILE: src/pages/AllNewsPage.jsx ==========
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Calendar, User, ArrowRight } from 'lucide-react';

// Komponen Card News (clean full-image)
function NewsCard({ item }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.3 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <Link
      to={`/news/${item.id}`}
      ref={cardRef}
      className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-white/10 hover:border-yellow-500/50 transition-all duration-500 block"
    >
      {/* Gambar full */}
      <img
        src={item.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070'}
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-110"
      />

      {/* Overlay gelap dari bawah */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />

      {/* Info yang muncul dari bawah */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-5 transition-all duration-500 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        } group-hover:translate-y-0 group-hover:opacity-100`}
      >
        {/* Tanggal & Author */}
        <div className="flex items-center gap-3 text-xs text-gray-300 mb-2">
          <span className="flex items-center gap-1"><Calendar size={12} className="text-yellow-500" />{formatDate(item.published_at)}</span>
          <span className="flex items-center gap-1"><User size={12} className="text-yellow-500" />{item.stores?.name || 'Store'}</span>
        </div>

        {/* Judul */}
        <h3 className="text-lg font-display font-bold text-white line-clamp-2 mb-1">
          {item.title}
        </h3>

        {/* Excerpt */}
        <p className="text-gray-300 text-sm line-clamp-2 mb-3">
          {item.excerpt || item.content?.substring(0, 100) || ''}
        </p>

        {/* Tombol */}
        <span className="inline-flex items-center gap-1 text-yellow-400 text-sm font-medium hover:gap-2 transition-all cursor-pointer">
          Baca Selengkapnya <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

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
    const { data, error } = await supabase
      .from('news')
      .select(`*, stores ( id, name, slug )`)
      .order('published_at', { ascending: false });

    if (error) console.error(error);
    else setNews(data || []);
    setLoading(false);
  };

  const filteredNews = filterStore === 'all' 
    ? news 
    : news.filter(item => item.stores?.id === filterStore);

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
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}