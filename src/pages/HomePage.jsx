// ========== HALAMAN HOME ==========
// Desain hero dengan video/gambar latar, efek glassmorphism, dan card store dummy
import Navbar from '../components/Navbar';
import { ArrowRight, Star } from 'lucide-react';

export default function HomePage() {
  // Data dummy untuk store terdekat
  const dummyStores = [
    { id: 1, name: 'PWM Senayan City', location: 'Jakarta Selatan', image: 'https://picsum.photos/id/20/400/300', rating: 4.8 },
    { id: 2, name: 'PWM Kelapa Gading', location: 'Jakarta Utara', image: 'https://picsum.photos/id/22/400/300', rating: 4.7 },
    { id: 3, name: 'PWM Surabaya', location: 'Surabaya Timur', image: 'https://picsum.photos/id/26/400/300', rating: 4.9 },
  ];

  return (
    <div className="bg-black">
      <Navbar />
      
      {/* ========== HERO SECTION ========== */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background image dengan overlay gelap */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1566417713940-fe9c9f0f9c2c?q=80&w=2070" 
            alt="hero background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40"></div>
        </div>

        {/* Konten hero */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-wider">
            <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent animate-glow">
              EKOSISTEM STORE
            </span>
            <br />
            <span className="text-white">PWM</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-200 max-w-2xl mx-auto">
            Satu member, ribuan keuntungan di semua store partner. Kumpulkan poin, tukar voucher, nikmati pengalaman berbelanja yang tak terlupakan.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-5 justify-center">
            <button className="bg-gradient-to-r from-yellow-500 to-orange-600 text-black font-bold py-3 px-8 rounded-full flex items-center justify-center gap-2 hover:scale-105 transition">
              Daftar Member <ArrowRight size={18} />
            </button>
            <button className="border border-white/40 hover:bg-white/10 py-3 px-8 rounded-full transition">
              Lihat Store
            </button>
          </div>
        </div>

        {/* Scroll indicator (opsional) */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white rounded-full mt-2"></div>
          </div>
        </div>
      </section>

      {/* ========== STORE PARTNER SECTION ========== */}
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold inline-block bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            Store Partner Kami
          </h2>
          <p className="text-gray-400 mt-2">Temukan store terdekat dan nikmati layanan eksklusif</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {dummyStores.map((store) => (
            <div key={store.id} className="group bg-gray-900/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition-all duration-300 hover:-translate-y-2">
              <div className="relative h-48 overflow-hidden">
                <img src={store.image} alt={store.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1 text-sm">
                  <Star size={14} className="text-yellow-400 fill-yellow-400" /> {store.rating}
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-xl font-bold">{store.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{store.location}</p>
                <button className="mt-4 w-full bg-white/10 hover:bg-yellow-500 hover:text-black py-2 rounded-full transition font-medium">
                  Kunjungi Store
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========== CTA BANNER ========== */}
      <section className="py-16 mx-4 md:mx-8 my-10 rounded-3xl bg-gradient-to-r from-yellow-600/20 via-orange-600/20 to-yellow-600/20 border border-yellow-500/30">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h3 className="text-2xl md:text-3xl font-display">Siap menjadi bagian dari ekosistem PWM?</h3>
          <p className="text-gray-300 mt-2">Daftarkan store Anda sekarang dan raih lebih banyak pelanggan loyal.</p>
          <button className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-full transition">
            Hubungi Kami
          </button>
        </div>
      </section>

      {/* Footer sederhana */}
      <footer className="border-t border-white/10 py-8 text-center text-gray-500 text-sm">
        © 2026 PWM Ecosystem. All rights reserved.
      </footer>
    </div>
  );
}