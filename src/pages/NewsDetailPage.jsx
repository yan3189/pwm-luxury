// ========== FILE: src/pages/NewsDetailPage.jsx ==========
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { Calendar, User, ArrowLeft, ExternalLink } from 'lucide-react';

export default function NewsDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    const { data, error } = await supabase
      .from('news')
      .select(`*, stores ( id, name, slug )`)
      .eq('id', id)
      .single();

    if (error) setError(error.message);
    else setArticle(data);
    setLoading(false);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Memuat artikel...</div>;
  if (error || !article) return <div className="bg-black min-h-screen text-white p-8">Artikel tidak ditemukan</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-yellow-500 hover:gap-2 transition mb-6"
        >
          <ArrowLeft size={16} /> Kembali
        </button>

        {/* ===== CONTAINER GAMBAR (KOTAK) ===== */}
        {article.image_url && (
          <div className="w-full max-w-2xl mx-auto mb-6">
            <div className="aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-xl">
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

       {/* ===== CONTAINER VIDEO (PORTRAIT - SEPERTI TIKTOK/REELS) ===== */}
{article.video_url && (
  <div className="w-full max-w-[360px] mx-auto mb-6">
    <div className="aspect-[9/16] rounded-2xl overflow-hidden border border-white/10 shadow-xl">
      <video
  src={article.video_url}
  autoPlay
  loop
  muted
  playsInline
  controls
  className="w-full h-full object-cover"
  poster={article.image_url || undefined}
/>
    </div>
  </div>
)}

        <div className="flex items-center gap-4 text-gray-400 text-sm mb-4">
          <div className="flex items-center gap-1"><Calendar size={14} className="text-yellow-500" />{formatDate(article.published_at)}</div>
          <div className="flex items-center gap-1"><User size={14} className="text-yellow-500" />{article.stores?.name}</div>
        </div>

        <h1 className="text-3xl md:text-4xl font-display font-bold mb-6">{article.title}</h1>

        <div className="prose prose-invert max-w-none mb-6">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{article.content || article.excerpt}</p>
        </div>

        {/* Link Eksternal */}
        {article.link_url && (
          <div className="mt-4 mb-6">
            <a
              href={article.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-2 rounded-full text-sm font-medium hover:bg-yellow-500/20 transition"
            >
              <ExternalLink size={14} />
              {article.link_label || 'Selengkapnya'}
            </a>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/10">
          <Link to={`/store/${article.stores?.slug}`} className="text-yellow-500 hover:underline">Kunjungi store ini →</Link>
        </div>
      </div>
    </div>
  );
}