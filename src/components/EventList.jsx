// ========== FILE: src/components/EventList.jsx ==========
// Komponen daftar event dengan tanggal besar di kiri
import { Calendar, MapPin, ChevronRight } from 'lucide-react';

export default function EventList() {
  // Data dummy event
  const events = [
    {
      id: 1,
      title: 'DJ Night with DJ Whiz',
      storeName: 'PWM SENAYAN CITY',
      city: 'Jakarta Selatan',
      date: '20',
      month: 'MEI',
      year: '2026',
    },
    {
      id: 2,
      title: 'Live Music: Soulful Sunday',
      storeName: 'PWM KELAPA GADING',
      city: 'Jakarta Utara',
      date: '24',
      month: 'MEI',
      year: '2026',
    },
    {
      id: 3,
      title: 'Standup Comedy Night',
      storeName: 'PWM SURABAYA',
      city: 'Surabaya Timur',
      date: '28',
      month: 'MEI',
      year: '2026',
    },
    {
      id: 4,
      title: 'Halloween Party',
      storeName: 'PWM BANDUNG',
      city: 'Bandung Barat',
      date: '31',
      month: 'OKT',
      year: '2026',
    },
  ];

  return (
    <div className="py-16 px-4 max-w-7xl mx-auto">
      {/* Header dengan tombol lihat semua */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="inline-block mb-2 px-3 py-1 bg-yellow-500/10 rounded-full">
            <p className="text-yellow-500 text-xs font-semibold tracking-wide">HAPPENING NOW</p>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-wide">Upcoming Events</h2>
          
        </div>
        <button className="hidden md:flex items-center gap-1 text-yellow-500 hover:gap-2 transition-all text-sm border border-yellow-500/30 px-4 py-2 rounded-full hover:bg-yellow-500/10">
          Lihat Semua Event <ChevronRight size={16} />
        </button>
      </div>

      {/* Grid 2x2 untuk 4 event - perkecil padding dan margin */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="group bg-gray-900/40 backdrop-blur-sm rounded-xl border border-white/10 hover:border-yellow-500/40 transition-all duration-300 hover:-translate-y-1 hover:bg-gray-900/60"
          >
            <div className="flex p-3 md:p-4">
              {/* Tanggal - perkecil ukuran */}
              <div className="flex-shrink-0 w-16 md:w-20 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg flex flex-col items-center justify-center py-2 border border-yellow-500/30">
                <span className="text-2xl md:text-3xl font-display font-bold text-yellow-400">{event.date}</span>
                <span className="text-[10px] md:text-xs font-semibold text-yellow-500 tracking-wider">{event.month}</span>
                <span className="text-[10px] text-gray-400">{event.year}</span>
              </div>

              {/* Informasi event */}
              <div className="ml-3 md:ml-4 flex-1">
                <h3 className="text-sm md:text-base font-bold text-white group-hover:text-yellow-400 transition line-clamp-1">
                  {event.title}
                </h3>
                <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
                  <MapPin size={10} className="text-yellow-500" />
                  <span className="text-xs">{event.storeName}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-xs">{event.city}</span>
                </div>
                <button className="mt-2 text-yellow-500 text-xs font-medium flex items-center gap-1 hover:gap-2 transition-all">
                  Lihat Detail <ChevronRight size={10} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tombol Lihat Semua Event untuk mobile (tampil hanya di HP) */}
      <div className="md:hidden mt-6 text-center">
        <button className="w-full flex items-center justify-center gap-2 border border-yellow-500/50 text-yellow-500 py-3 rounded-full hover:bg-yellow-500/10 transition">
          Lihat Semua Event <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}