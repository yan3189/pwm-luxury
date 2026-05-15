// ========== FILE: src/components/LatestNewsCarousel.jsx ==========
// Carousel berita terbaru dari semua store (untuk homepage)
import { useEffect, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import { Calendar, User, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom';

import 'swiper/css'
import 'swiper/css/pagination'

export default function LatestNewsCarousel() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllNews()
  }, [])

  const fetchAllNews = async () => {
    // Ambil semua news dari semua store, join dengan stores untuk mendapatkan nama store
    const { data, error } = await supabase
      .from('news')
      .select(`
        *,
        stores (
          name,
          slug
        )
      `)
      .order('published_at', { ascending: false })
      .limit(10) // batasi 10 berita terbaru

    if (error) {
      console.error('Error fetching news:', error)
    } else {
      setNews(data || [])
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-8">Memuat berita...</div>
  }

  if (news.length === 0) {
    return <div className="text-center text-gray-400 py-8">Belum ada berita</div>
  }

  return (
    <div className="w-full py-4">
      <Swiper
        modules={[Pagination]}
        spaceBetween={16}
        slidesPerView={1.1}
        breakpoints={{
          640: { slidesPerView: 1.5, spaceBetween: 20 },
          1024: { slidesPerView: 2.2, spaceBetween: 24 },
          1280: { slidesPerView: 2.8, spaceBetween: 24 },
        }}
        pagination={{ clickable: true }}
        className="latest-news-carousel"
      >
        {news.map((item) => (
          <SwiperSlide key={item.id}>
            <NewsCard item={item} />
          </SwiperSlide>
        ))}
      </Swiper>

      <style>{`
        .latest-news-carousel .swiper-pagination-bullet {
          background: white;
          opacity: 0.5;
        }
        .latest-news-carousel .swiper-pagination-bullet-active {
          background: #FFD700;
          opacity: 1;
        }
      `}</style>
    </div>
  )
}

// ===== NEWS CARD (efek pop saat hover) =====
function NewsCard({ item }) {
  // Helper: format tanggal
  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-gray-900/50 backdrop-blur-sm border border-white/10 hover:border-yellow-500/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-yellow-500/10">
      {/* Gambar dengan efek scale saat hover */}
      <div className="relative h-48 md:h-56 overflow-hidden">
        <img
          src={item.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070'}
          alt={item.title}
          className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
      </div>

      {/* Konten artikel */}
      <div className="p-5">
        {/* Metadata: tanggal & author (nama store) */}
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
          <div className="flex items-center gap-1">
            <Calendar size={12} className="text-yellow-500" />
            <span>{formatDate(item.published_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <User size={12} className="text-yellow-500" />
            <span className="line-clamp-1">{item.stores?.name || 'Store'}</span>
          </div>
        </div>

        {/* Judul */}
        <h3 className="text-lg md:text-xl font-display font-bold text-white group-hover:text-yellow-400 transition line-clamp-2">
          {item.title}
        </h3>

        {/* Excerpt */}
        <p className="text-gray-400 text-sm mt-2 line-clamp-2">
          {item.excerpt || item.content?.substring(0, 100) || ''}
        </p>

        {/* Tombol baca selengkapnya (nanti bisa diarahkan ke halaman detail artikel) */}
        <Link to={`/news/${item.id}`} className="mt-4 flex items-center gap-1 text-yellow-500 text-sm font-medium hover:gap-2 transition-all">
  Baca Selengkapnya <ArrowRight size={14} />
</Link>
      </div>
    </div>
  )
}