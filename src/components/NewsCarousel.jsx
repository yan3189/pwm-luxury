// ========== FILE: src/components/NewsCarousel.jsx ==========
// News & Article Carousel - mirip store carousel tapi tanpa video, efek pop saat hover
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { Calendar, User, ArrowRight } from 'lucide-react';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function NewsCarousel() {
  // Data dummy news & article
  const newsItems = [
    {
      id: 1,
      title: 'Grand Opening PWM Senayan City',
      excerpt: 'Store terbaru kami hadir di kawasan Segitiga Emas Jakarta. Nikmati promo spesial untuk member baru.',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070',
      date: '15 Mei 2026',
      author: 'PWM Senayan City',
      storeSlug: 'senayan-city',
    },
    {
      id: 2,
      title: 'Program Poin Double di Akhir Pekan',
      excerpt: 'Setiap transaksi di hari Sabtu dan Minggu mendapatkan poin 2x lipat. Kumpulkan poinmu sekarang!',
      image: 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?q=80&w=2070',
      date: '12 Mei 2026',
      author: 'PWM Kelapa Gading',
      storeSlug: 'kelapa-gading',
    },
    {
      id: 3,
      title: 'Kolaborasi dengan Chef Terkenal',
      excerpt: 'PWM Surabaya menghadirkan menu eksklusif hasil kolaborasi dengan chef internasional.',
      image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070',
      date: '10 Mei 2026',
      author: 'PWM Surabaya',
      storeSlug: 'surabaya',
    },
    {
      id: 4,
      title: 'Event Charity: PWM Peduli',
      excerpt: 'Bergabunglah dalam acara amal kami untuk membantu sesama. Setiap pembelian menyumbang Rp5.000.',
      image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=2070',
      date: '8 Mei 2026',
      author: 'PWM Bandung',
      storeSlug: 'bandung',
    },
    {
      id: 5,
      title: 'Aplikasi PWM Mobile Launching',
      excerpt: 'Nikmati kemudahan memesan, cek poin, dan tukar voucher langsung dari HP Anda.',
      image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=2070',
      date: '5 Mei 2026',
      author: 'PWM Ecosystem',
      storeSlug: 'pusat',
    },
  ];

  return (
    <div className="w-full py-4">
      <Swiper
        modules={[Navigation, Pagination]}
        spaceBetween={16}
        slidesPerView={1.1}
        breakpoints={{
          640: { slidesPerView: 1.5, spaceBetween: 20 },
          1024: { slidesPerView: 2.2, spaceBetween: 24 },
          1280: { slidesPerView: 2.8, spaceBetween: 24 },
        }}
        navigation
        pagination={{ clickable: true }}
        className="news-carousel"
      >
        {newsItems.map((item) => (
          <SwiperSlide key={item.id}>
            <NewsCard item={item} />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom CSS untuk styling swiper */}
      <style>{`
        .news-carousel .swiper-button-next,
        .news-carousel .swiper-button-prev {
          color: #FFD700;
          background: rgba(0,0,0,0.5);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          backdrop-filter: blur(4px);
        }
        .news-carousel .swiper-button-next:after,
        .news-carousel .swiper-button-prev:after {
          font-size: 16px;
          font-weight: bold;
        }
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

// ===== NEWS CARD (efek POP saat hover, tanpa video) =====
function NewsCard({ item }) {
  return (
    <div className="group relative rounded-2xl overflow-hidden bg-gray-900/50 backdrop-blur-sm border border-white/10 hover:border-yellow-500/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-yellow-500/10">
      {/* Gambar dengan efek scale saat hover (pop effect) */}
      <div className="relative h-48 md:h-56 overflow-hidden">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
        />
        {/* Overlay gradien di bagian bawah */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
      </div>

      {/* Konten artikel */}
      <div className="p-5">
        {/* Metadata: tanggal & author */}
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
          <div className="flex items-center gap-1">
            <Calendar size={12} className="text-yellow-500" />
            <span>{item.date}</span>
          </div>
          <div className="flex items-center gap-1">
            <User size={12} className="text-yellow-500" />
            <span className="line-clamp-1">{item.author}</span>
          </div>
        </div>

        {/* Judul */}
        <h3 className="text-lg md:text-xl font-display font-bold text-white group-hover:text-yellow-400 transition line-clamp-2">
          {item.title}
        </h3>

        {/* Excerpt */}
        <p className="text-gray-400 text-sm mt-2 line-clamp-2">
          {item.excerpt}
        </p>

        {/* Tombol baca selengkapnya */}
        <button className="mt-4 flex items-center gap-1 text-yellow-500 text-sm font-medium hover:gap-2 transition-all">
          Baca Selengkapnya <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}