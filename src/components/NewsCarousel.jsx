// ========== FILE: src/components/NewsCarousel.jsx ==========
import { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import { Calendar, User, ArrowRight } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/pagination';

const newsItems = [
  {
    id: 1,
    title: 'Grand Opening PWM Senayan City',
    excerpt: 'Store terbaru kami hadir di kawasan Segitiga Emas Jakarta.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070',
    date: '15 Mei 2026',
    author: 'PWM Senayan City',
  },
  {
    id: 2,
    title: 'Program Poin Double di Akhir Pekan',
    excerpt: 'Setiap transaksi di hari Sabtu dan Minggu mendapatkan poin 2x lipat.',
    image: 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?q=80&w=2070',
    date: '12 Mei 2026',
    author: 'PWM Kelapa Gading',
  },
  {
    id: 3,
    title: 'Kolaborasi dengan Chef Terkenal',
    excerpt: 'PWM Surabaya menghadirkan menu eksklusif hasil kolaborasi.',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070',
    date: '10 Mei 2026',
    author: 'PWM Surabaya',
  },
];

export default function NewsCarousel() {
  return (
    <div className="w-full py-4">
      <Swiper
        modules={[Pagination]}
        spaceBetween={16}
        slidesPerView={1.1}
        breakpoints={{
          640: { slidesPerView: 1.8, spaceBetween: 20 },
          1024: { slidesPerView: 2.5, spaceBetween: 24 },
          1280: { slidesPerView: 3.2, spaceBetween: 24 },
        }}
        pagination={{ clickable: true }}
        className="news-carousel"
      >
        {newsItems.map((item) => (
          <SwiperSlide key={item.id}>
            <NewsCard item={item} />
          </SwiperSlide>
        ))}
      </Swiper>

      <style>{`
        .news-carousel .swiper-pagination-bullet {
          background: white;
          opacity: 0.5;
        }
        .news-carousel .swiper-pagination-bullet-active {
          background: #FFD700;
          opacity: 1;
        }
      `}</style>
    </div>
  );
}

// ===== NEWS CARD (CLEAN - SEPERTI PRODUCT CARD) =====
function NewsCard({ item }) {
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

  return (
    <div
      ref={cardRef}
      className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-white/10 hover:border-yellow-500/50 transition-all duration-500"
    >
      {/* Gambar full */}
      <img
        src={item.image}
        alt={item.title}
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
        {/* Tanggal & Author */}
        <div className="flex items-center gap-3 text-xs text-gray-300 mb-2">
          <span className="flex items-center gap-1"><Calendar size={12} className="text-yellow-500" />{item.date}</span>
          <span className="flex items-center gap-1"><User size={12} className="text-yellow-500" />{item.author}</span>
        </div>

        {/* Judul */}
        <h3 className="text-lg font-display font-bold text-white line-clamp-2 mb-1">
          {item.title}
        </h3>

        {/* Excerpt */}
        <p className="text-gray-300 text-sm line-clamp-2 mb-3">
          {item.excerpt}
        </p>

        {/* Tombol */}
        <span className="inline-flex items-center gap-1 text-yellow-400 text-sm font-medium hover:gap-2 transition-all cursor-pointer">
          Baca Selengkapnya <ArrowRight size={14} />
        </span>
      </div>
    </div>
  );
}