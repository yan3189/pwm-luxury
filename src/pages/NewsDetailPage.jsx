// ========== FILE: src/pages/NewsDetailPage.jsx ==========
// Halaman detail berita lengkap
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { Calendar, User, ArrowLeft } from 'lucide-react';

export default function NewsDetailPage() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    const { data, error } = await supabase
      .from('news')
      .select(`
        *,
        stores ( id, name, slug )
      `)
      .eq('id', id)
      .single();

    if (error) {
      setError(error.message);
    } else {
      setArticle(data);
    }
    setLoading(false);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Memuat artikel...</div>;
  if (error || !article) return <div className="bg-black min-h-screen text-white p-8">Artikel tidak ditemukan</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <Link to="/news" className="inline-flex items-center gap-1 text-yellow-500 hover:gap-2 transition mb-6">
          <ArrowLeft size={16} /> Kembali ke semua berita
        </Link>
        
        {article.image_url && (
          <img src={article.image_url} alt={article.title} className="w-full h-64 md:h-96 object-cover rounded-xl mb-6" />
        )}
        
        <div className="flex items-center gap-4 text-gray-400 text-sm mb-4">
          <div className="flex items-center gap-1"><Calendar size={14} className="text-yellow-500" />{formatDate(article.published_at)}</div>
          <div className="flex items-center gap-1"><User size={14} className="text-yellow-500" />{article.stores?.name}</div>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-6">{article.title}</h1>
        
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{article.content || article.excerpt}</p>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10">
          <Link to={`/store/${article.stores?.slug}`} className="text-yellow-500 hover:underline">Kunjungi store ini →</Link>
        </div>
      </div>
    </div>
  );
}