// ========== FILE: src/pages/EventDetailPage.jsx ==========
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { Calendar, MapPin, Clock, ArrowLeft, ExternalLink } from 'lucide-react';

export default function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select(`*, stores ( id, name, slug )`)
      .eq('id', id)
      .single();

    if (error) setError(error.message);
    else setEvent(data);
    setLoading(false);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Memuat event...</div>;
  if (error || !event) return <div className="bg-black min-h-screen text-white p-8">Event tidak ditemukan</div>;

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
        {event.image_url && (
          <div className="w-full max-w-2xl mx-auto mb-6">
            <div className="aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-xl">
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* ===== VIDEO  (PORTRAIT) ===== */}
          {event.video_url && (
            <div className="w-full max-w-[360px] mx-auto mb-6">
              <div className="aspect-[9/16] rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                <video
                  src={event.video_url}
                  controls
                  className="w-full h-full object-cover"
                  poster={event.image_url || undefined}
                />
              </div>
            </div>
          )}

        <div className="flex flex-wrap gap-4 text-gray-400 text-sm mb-4">
          <div className="flex items-center gap-1"><Calendar size={14} className="text-yellow-500" />{formatDate(event.date)}</div>
          {event.time && <div className="flex items-center gap-1"><Clock size={14} className="text-yellow-500" />{event.time}</div>}
          <div className="flex items-center gap-1"><MapPin size={14} className="text-yellow-500" />{event.location || event.stores?.name}</div>
        </div>

        <h1 className="text-3xl md:text-4xl font-display font-bold mb-6">{event.title}</h1>

        <div className="prose prose-invert max-w-none mb-6">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{event.description}</p>
        </div>

        {/* Link Eksternal */}
        {event.link_url && (
          <div className="mt-4 mb-6">
            <a
              href={event.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-2 rounded-full text-sm font-medium hover:bg-yellow-500/20 transition"
            >
              <ExternalLink size={14} />
              {event.link_label || 'Selengkapnya'}
            </a>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/10">
          <Link to={`/store/${event.stores?.slug}`} className="text-yellow-500 hover:underline">Kunjungi store ini →</Link>
        </div>
      </div>
    </div>
  );
}