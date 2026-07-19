// ========== FILE: src/components/LatestNewsCarousel.jsx ==========
// Carousel berita terbaru dari semua store (untuk homepage) - CLEAN VERSION
import { useEffect, useState, useRef } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import { Calendar, User, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

import 'swiper/css'
import 'swiper/css/pagination'

export default function LatestNewsCarousel() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllNews()
  }, [])

  const fetchAllNews = async () => {
    const { data, error } = await supabase
      .from('news')
      .select(`*, stores (name, slug)`)
      .order('published_at', { ascending: false })
      .limit(10)

    if (error) console.error('Error fetching news:', error)
    else setNews(data || [])
    setLoading(false)
  }

  if (loading) return <div className="text-center text-gray-400 py-8">Memuat berita...</div>
  if (news.length === 0) return <div className="text-center text-gray-400 py-8">Belum ada berita</div>

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

// ===== NEWS CARD (CLEAN - SEPERTI PRODUCT CARD) =====
function NewsCard({ item }) {
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.3 }
    )
    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <Link
      to={`/news/${item.id}`}
      ref={cardRef}
      className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-white/10 hover:border-yellow-500/50 transition-all duration-500 block"
    >
      {/* Gambar full */}
      <img
        src={item.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070'}
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
          <span className="flex items-center gap-1"><Calendar size={12} className="text-yellow-500" />{formatDate(item.published_at)}</span>
          <span className="flex items-center gap-1"><User size={12} className="text-yellow-500" />{item.stores?.name || 'Store'}</span>
        </div>

        {/* Judul */}
        <h3 className="text-lg font-display font-bold text-white line-clamp-2 mb-1">
          {item.title}
        </h3>

        {/* Excerpt */}
        <p className="text-gray-300 text-sm line-clamp-2 mb-3">
          {item.excerpt || item.content?.substring(0, 100) || ''}
        </p>

        {/* Tombol */}
        <span className="inline-flex items-center gap-1 text-yellow-400 text-sm font-medium hover:gap-2 transition-all cursor-pointer">
          Baca Selengkapnya <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  )
}