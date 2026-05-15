// ========== FILE: src/components/StoreCarousel.jsx ==========
// Carousel store dengan data dari Supabase
import { useState, useRef, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import { ChevronRight, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

import 'swiper/css';
import 'swiper/css/pagination';

export default function StoreCarousel() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching stores:', error);
    } else {
      setStores(data || []);
    }
    setLoading(false);
  };

  const handleSlideChange = (swiper) => {
    setActiveIndex(swiper.activeIndex);
  };

  const handleDetailClick = (slug) => {
    navigate(`/store/${slug}`);
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-8">Memuat store...</div>;
  }

  if (stores.length === 0) {
    return <div className="text-center text-gray-400 py-8">Belum ada store</div>;
  }

  return (
    <div className="w-full py-4">
      <Swiper
        modules={[Pagination]}
        spaceBetween={12}
        slidesPerView={1.1}
        breakpoints={{
          640: { slidesPerView: 1.3, spaceBetween: 16 },
          1024: { slidesPerView: 1.8, spaceBetween: 20 },
          1280: { slidesPerView: 2.2, spaceBetween: 24 },
        }}
        pagination={{ clickable: true }}
        onSlideChange={handleSlideChange}
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        className="store-carousel"
      >
        {stores.map((store, idx) => (
          <SwiperSlide key={store.id}>
            <StoreCard
              store={store}
              isActive={idx === activeIndex}
              onDetailClick={() => handleDetailClick(store.slug)}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      <style>{`
        .store-carousel .swiper-pagination-bullet {
          background: white;
          opacity: 0.5;
        }
        .store-carousel .swiper-pagination-bullet-active {
          background: #FFD700;
          opacity: 1;
        }
      `}</style>
    </div>
  );
}

// ===== KOMPONEN CARD (sama seperti sebelumnya, pakai data dari props) =====
function StoreCard({ store, isActive, onDetailClick }) {
  const [showVideo, setShowVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const videoRef = useRef(null);
  const delayTimerRef = useRef(null);

  // Gunakan cover_image jika ada, fallback ke background_image atau Unsplash
  const coverImage = store.cover_image || store.background_image || 'https://images.unsplash.com/photo-1566417713940-fe9c9f0f9c2c?q=80&w=2070';
  const previewVideo = store.video_preview || '';

  useEffect(() => {
    if (isActive && previewVideo) {
      setShowVideo(false);
      setShowContent(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      delayTimerRef.current = setTimeout(() => {
        setShowVideo(true);
        setShowContent(true);
      }, 1000);
    } else {
      setShowVideo(false);
      setShowContent(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    }
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, [isActive, previewVideo]);

  useEffect(() => {
    if (showVideo && videoRef.current && !videoError && previewVideo) {
      videoRef.current.play().catch(e => console.log("Autoplay failed:", e));
    }
  }, [showVideo, videoError, previewVideo]);

  const handleVideoError = () => {
    setVideoError(true);
  };

  // Jika store tidak punya video, langsung tampilkan konten tanpa video
  const hasVideo = previewVideo && !videoError;

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
      style={{ aspectRatio: '9/16' }}
    >
      {(!showVideo || !hasVideo) ? (
        <img
          src={coverImage}
          alt={store.name}
          className="absolute inset-0 w-full h-full object-cover transition duration-700"
        />
      ) : (
        <video
          ref={videoRef}
          src={previewVideo}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted
          playsInline
          preload="auto"
          onError={handleVideoError}
        />
      )}

      <div
        className={`absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent transition-opacity duration-500 ${
          showContent && hasVideo ? 'opacity-100' : 'opacity-0'
        }`}
      ></div>

      <div
        className={`absolute bottom-0 left-0 right-0 p-5 transition-all duration-500 transform ${
          showContent && hasVideo ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-wide">
          {store.name}
        </h3>
        <div className="flex items-center gap-1 text-gray-300 text-sm mt-1">
          <MapPin size={14} /> {store.location || store.category || 'Store'}
        </div>
        <button 
          onClick={onDetailClick}
          className="mt-4 flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2.5 px-5 rounded-full transition duration-300 text-sm"
        >
          Lihat Detail <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}