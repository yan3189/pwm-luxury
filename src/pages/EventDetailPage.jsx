// ========== FILE: src/pages/EventDetailPage.jsx ==========
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { Calendar, MapPin, Clock, ArrowLeft } from 'lucide-react';

export default function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        stores ( id, name, slug )
      `)
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

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Memuat event...</div>;
  if (error || !event) return <div className="bg-black min-h-screen text-white p-8">Event tidak ditemukan</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <Link to="/events" className="inline-flex items-center gap-1 text-yellow-500 hover:gap-2 transition mb-6">
          <ArrowLeft size={16} /> Kembali ke semua event
        </Link>

        {event.image_url && (
          <img src={event.image_url} alt={event.title} className="w-full h-64 md:h-96 object-cover rounded-xl mb-6" />
        )}

        <div className="flex flex-wrap gap-4 text-gray-400 text-sm mb-4">
          <div className="flex items-center gap-1"><Calendar size={14} className="text-yellow-500" />{formatDate(event.date)}</div>
          {event.time && <div className="flex items-center gap-1"><Clock size={14} className="text-yellow-500" />{event.time}</div>}
          <div className="flex items-center gap-1"><MapPin size={14} className="text-yellow-500" />{event.location || event.stores?.name}</div>
        </div>

        <h1 className="text-3xl md:text-4xl font-display font-bold mb-6">{event.title}</h1>
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{event.description}</p>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10">
          <Link to={`/store/${event.stores?.slug}`} className="text-yellow-500 hover:underline">Kunjungi store ini →</Link>
        </div>
      </div>
    </div>
  );
}