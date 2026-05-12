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
          <p className="text-gray-400 mt-1">Jangan lewatkan acara seru di store partner kami</p>
        </div>
        <button className="hidden md:flex items-center gap-1 text-yellow-500 hover:gap-2 transition-all text-sm border border-yellow-500/30 px-4 py-2 rounded-full hover:bg-yellow-500/10">
          Lihat Semua Event <ChevronRight size={16} />
        </button>
      </div>

      {/* Grid 2x2 untuk 4 event */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {events.map((event) => (
          <div
            key={event.id}
            className="group bg-gray-900/40 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-yellow-500/40 transition-all duration-300 hover:-translate-y-1 hover:bg-gray-900/60"
          >
            <div className="flex p-4 md:p-5">
              {/* Tanggal besar di kiri */}
              <div className="flex-shrink-0 w-20 md:w-24 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl flex flex-col items-center justify-center py-3 border border-yellow-500/30">
                <span className="text-3xl md:text-4xl font-display font-bold text-yellow-400">{event.date}</span>
                <span className="text-xs font-semibold text-yellow-500 tracking-wider">{event.month}</span>
                <span className="text-xs text-gray-400">{event.year}</span>
              </div>

              {/* Informasi event di kanan */}
              <div className="ml-4 md:ml-5 flex-1">
                <h3 className="text-base md:text-lg font-bold text-white group-hover:text-yellow-400 transition line-clamp-1">
                  {event.title}
                </h3>
                <div className="flex items-center gap-1 text-gray-400 text-xs md:text-sm mt-1">
                  <MapPin size={12} className="text-yellow-500" />
                  <span>{event.storeName}</span>
                  <span className="text-gray-600">•</span>
                  <span>{event.city}</span>
                </div>
                <button className="mt-3 text-yellow-500 text-xs md:text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all">
                  Lihat Detail <ChevronRight size={12} />
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