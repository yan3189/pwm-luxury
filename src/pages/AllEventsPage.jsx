// ========== FILE: src/pages/AllEventsPage.jsx ==========
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Calendar, MapPin, Clock, ArrowRight } from 'lucide-react';

// Komponen Card Event (clean full-image)
function EventCard({ event }) {
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
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <Link
      to={`/events/${event.id}`}
      ref={cardRef}
      className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-white/10 hover:border-yellow-500/50 transition-all duration-500 block"
    >
      {/* Gambar full */}
      <img
        src={event.image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070'}
        alt={event.title}
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
        {/* Tanggal, Waktu, Lokasi */}
        <div className="flex flex-wrap gap-2 text-xs text-gray-300 mb-2">
          <span className="flex items-center gap-1"><Calendar size={12} className="text-yellow-500" />{formatDate(event.date)}</span>
          {event.time && <span className="flex items-center gap-1"><Clock size={12} className="text-yellow-500" />{event.time}</span>}
          <span className="flex items-center gap-1"><MapPin size={12} className="text-yellow-500" />{event.location || event.stores?.name}</span>
        </div>

        {/* Judul */}
        <h3 className="text-lg font-display font-bold text-white line-clamp-2 mb-1">
          {event.title}
        </h3>

        {/* Deskripsi singkat */}
        <p className="text-gray-300 text-sm line-clamp-2 mb-3">
          {event.description}
        </p>

        {/* Tombol */}
        <span className="inline-flex items-center gap-1 text-yellow-400 text-sm font-medium hover:gap-2 transition-all cursor-pointer">
          Lihat Detail <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

export default function AllEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStore, setFilterStore] = useState('all');
  const [stores, setStores] = useState([]);

  useEffect(() => {
    fetchStores();
    fetchEvents();
  }, []);

  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('id, name, slug');
    if (data) setStores(data);
  };

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select(`*, stores ( id, name, slug )`)
      .order('date', { ascending: true });

    if (error) console.error(error);
    else setEvents(data || []);
    setLoading(false);
  };

  const filteredEvents = filterStore === 'all'
    ? events
    : events.filter(event => event.store_id === filterStore);

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Memuat event...</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-display mb-4">Semua Event</h1>
        <p className="text-gray-400 mb-6">Acara seru di store partner kami</p>

        {/* Filter store */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button onClick={() => setFilterStore('all')} className={`px-4 py-1 rounded-full text-sm transition ${filterStore === 'all' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>Semua Store</button>
          {stores.map(store => (
            <button key={store.id} onClick={() => setFilterStore(store.id)} className={`px-4 py-1 rounded-full text-sm transition ${filterStore === store.id ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{store.name}</button>
          ))}
        </div>

        {filteredEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-12">Tidak ada event.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}