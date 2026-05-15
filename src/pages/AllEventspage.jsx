// ========== FILE: src/pages/AllEventsPage.jsx ==========
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Calendar, MapPin, Clock, ArrowRight } from 'lucide-react';

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
      .select(`
        *,
        stores ( id, name, slug )
      `)
      .order('date', { ascending: true });

    if (error) console.error(error);
    else setEvents(data || []);
    setLoading(false);
  };

  const filteredEvents = filterStore === 'all'
    ? events
    : events.filter(event => event.store_id === filterStore);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

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
          <div className="space-y-6">
            {filteredEvents.map(event => (
              <Link key={event.id} to={`/events/${event.id}`} className="block group">
                <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition hover:-translate-y-1 flex flex-col md:flex-row">
                  {event.image_url && (
                    <img src={event.image_url} alt={event.title} className="w-full md:w-48 h-48 object-cover" />
                  )}
                  <div className="p-5 flex-1">
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-2">
                      <div className="flex items-center gap-1"><Calendar size={14} className="text-yellow-500" />{formatDate(event.date)}</div>
                      {event.time && <div className="flex items-center gap-1"><Clock size={14} className="text-yellow-500" />{event.time}</div>}
                      <div className="flex items-center gap-1"><MapPin size={14} className="text-yellow-500" />{event.location || event.stores?.name}</div>
                    </div>
                    <h2 className="text-2xl font-display font-bold group-hover:text-yellow-400 transition">{event.title}</h2>
                    <p className="text-gray-400 mt-2 line-clamp-2">{event.description}</p>
                    <div className="mt-4 text-yellow-500 text-sm flex items-center gap-1 group-hover:gap-2 transition">Lihat Detail <ArrowRight size={14} /></div>
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