// ========== FILE: src/components/EventList.jsx ==========
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    // Dapatkan tanggal hari ini dalam format YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('events')
      .select('*, stores(name)')
      .gte('date', today) // Hanya event yang tanggalnya >= hari ini
      .order('date', { ascending: true }) // Urutkan dari yang terdekat
      .limit(4) // Hapus limit jika ingin menampilkan semua event mendatang
    ;
    
    if (!error) setEvents(data || []);
    setLoading(false);
  };

  if (loading) return <div className="text-center text-gray-400 py-8">Memuat event...</div>;
  if (events.length === 0) return null; // Jangan tampilkan apapun jika tidak ada event mendatang

  return (
    <div className="py-16 px-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="inline-block mb-2 px-3 py-1 bg-yellow-500/10 rounded-full">
            <p className="text-yellow-500 text-xs font-semibold tracking-wide">HAPPENING NOW</p>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-wide">Upcoming Events</h2>
        </div>
        <Link to="/events" className="hidden md:flex items-center gap-1 text-yellow-500 hover:gap-2 transition-all text-sm border border-yellow-500/30 px-4 py-2 rounded-full hover:bg-yellow-500/10">
          Lihat Semua Event <ChevronRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {events.map(event => {
          const date = new Date(event.date);
          return (
            <Link key={event.id} to={`/events/${event.id}`} className="group bg-gray-900/40 backdrop-blur-sm rounded-xl border border-white/10 hover:border-yellow-500/40 transition-all duration-300 hover:-translate-y-1 hover:bg-gray-900/60">
              <div className="flex p-3 md:p-4">
                <div className="flex-shrink-0 w-16 md:w-20 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg flex flex-col items-center justify-center py-2 border border-yellow-500/30">
                  <span className="text-2xl md:text-3xl font-display font-bold text-yellow-400">{date.getDate()}</span>
                  <span className="text-[10px] md:text-xs font-semibold text-yellow-500 tracking-wider">{date.toLocaleString('id-ID', { month: 'short' }).toUpperCase()}</span>
                  <span className="text-[10px] text-gray-400">{date.getFullYear()}</span>
                </div>
                <div className="ml-3 md:ml-4 flex-1">
                  <h3 className="text-sm md:text-base font-bold text-white group-hover:text-yellow-400 transition line-clamp-1">{event.title}</h3>
                  <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
                    <MapPin size={10} className="text-yellow-500" />
                    <span>{event.location || event.stores?.name || 'Store'}</span>
                  </div>
                  <div className="mt-2 text-yellow-500 text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                    Lihat Detail <ChevronRight size={10} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="md:hidden mt-6 text-center">
        <Link to="/events" className="w-full flex items-center justify-center gap-2 border border-yellow-500/50 text-yellow-500 py-3 rounded-full hover:bg-yellow-500/10 transition">
          Lihat Semua Event <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}