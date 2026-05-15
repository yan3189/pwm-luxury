// ========== FILE: src/pages/HomeHolywings.jsx ==========
// VERSI DENGAN ASUMSI DESAIN PREMIUM (NEON, BOLD, GLASSMORPHISM)
import NavbarHolywings from '../components/Navbar';
import NewsCarousel from '../components/NewsCarousel';
import EventList from '../components/EventList';
import StoreCarousel from '../components/StoreCarousel';
import AllNews from '../components/AllNews';
import LatestNewsCarousel from '../components/LatestNewsCarousel';
import { ArrowRight, Star, MapPin, ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HomeHolywings() {
  // Data dummy untuk store
  const featuredStores = [
    { id: 1, name: 'PWM SENAYAN CITY', location: 'Jakarta Selatan', image: 'https://images.unsplash.com/photo-1566417713940-fe9c9f0f9c2c?q=80&w=2070', rating: 4.8, tag: 'POPULAR' },
    { id: 2, name: 'PWM KELAPA GADING', location: 'Jakarta Utara', image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=2070', rating: 4.7, tag: 'NEW' },
    { id: 3, name: 'PWM SURABAYA', location: 'Surabaya Timur', image: 'https://images.unsplash.com/photo-1534865819013-fcb4881ac473?q=80&w=2070', rating: 4.9, tag: 'TRENDING' },
  ];

  return (
    <div className="bg-black text-white">
      <NavbarHolywings />
      
      {/* ========== 1. HERO SECTION (PREMIUM LOOK) ========== */}
      {/* Asumsi: background keramaian kota, overlay gelap, teks besar */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=2070" 
            alt="Hero Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/80 to-black/50"></div>
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          {/* Badge kecil */}
          <div className="inline-block mb-4 px-3 py-1 bg-yellow-500/10 backdrop-blur-sm rounded-full border border-yellow-500/30">
            <p className="text-yellow-400 text-sm font-semibold tracking-wide">#NEVER STOP FLYING</p>
          </div>
          
          {/* Efek Glow pada Teks Utama */}
          <h1 className="text-6xl md:text-8xl font-display font-bold tracking-wider">
            <span className="bg-linear-to-r from-yellow-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent animate-pulse">
              EKOSISTEM STORE
            </span>
            <br />
            <span className="text-white">PWM</span>
          </h1>
          
          <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
            Satu member, ribuan keuntungan di semua store partner. 
            Kumpulkan poin, tukar voucher, nikmati pengalaman premium.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row gap-5 justify-center">
            <button className="group bg-linear-to-r from-yellow-500 to-orange-600 text-black font-bold py-3 px-8 rounded-full flex items-center justify-center gap-2 hover:scale-105 transition duration-300 shadow-lg shadow-yellow-500/20">
              Daftar Member <ArrowRight size={18} className="group-hover:translate-x-1 transition" />
            </button>
            <button className="border border-white/40 hover:bg-white/10 py-3 px-8 rounded-full transition duration-300 backdrop-blur-sm">
              Lihat Store
            </button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-yellow-500 rounded-full mt-2"></div>
          </div>
        </div>
      </section>

      {/* ========== 2. FEATURED STORES ========== */}
                 {/* ========== 2. FEATURED STORES (Holywings Style - Card tanpa teks, muncul saat hover) ========== */}
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="inline-block mb-2 px-3 py-1 bg-yellow-500/10 rounded-full">
            <p className="text-yellow-500 text-xs font-semibold tracking-wide">EXPLORE OUR STORES</p>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-wide">Featured Stores</h2>
        </div>

        {/* CAROUSEL COMPONENT */}
        <StoreCarousel />
      </section>

            {/* ========== 3. EVENT LIST SECTION ========== */}
      <EventList />

            {/* ========== NEWS & ARTICLE SECTION ========== */}
      <section className="py-16 px-4 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="inline-block mb-2 px-3 py-1 bg-yellow-500/10 rounded-full">
            <p className="text-yellow-500 text-xs font-semibold tracking-wide">STORE UPDATES</p>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-wide">News & Articles</h2>
        </div>
          <Link to="/news" className="text-yellow-500 hover:underline">
    Lihat semua berita →
  </Link>

        <LatestNewsCarousel />
      </section>

      {/* ========== 4. FOOTER ========== */}
      <footer className="border-t border-white/10 py-12 text-center text-gray-500 text-sm">
        <div className="max-w-7xl mx-auto px-4">
          <p className="mb-2">© 2026 PWM Ecosystem. All rights reserved.</p>
          <p className="text-xs">#NeverStopFlying</p>
        </div>
      </footer>
    </div>
  );
}