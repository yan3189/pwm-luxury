// ========== FILE: src/components/StoreCarousel.jsx ==========
// Holywings-style card - dengan delay 1 detik sebelum video play
import { useState, useRef, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import { ChevronRight, MapPin } from 'lucide-react';

import 'swiper/css';
import 'swiper/css/pagination';

export default function StoreCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef(null);

 const stores = [
    {
      id: 1,
      name: 'PWM SENAYAN CITY',
      location: 'Jakarta Selatan',
      coverImage: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=2070',
      previewVideo: 'https://www.pexels.com/id-id/download/video/32699342/',
    },
    {
      id: 2,
      name: 'PWM KELAPA GADING',
      location: 'Jakarta Utara',
      coverImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=2070',
      previewVideo: 'https://www.pexels.com/id-id/download/video/32604328/',
    },
    {
      id: 3,
      name: 'PWM SURABAYA',
      location: 'Surabaya Timur',
      coverImage: 'https://images.pexels.com/photos/7271398/pexels-photo-7271398.jpeg?q=80&w=2070',
      previewVideo: 'https://www.pexels.com/id-id/download/video/6174615/',
    },
    {
      id: 4,
      name: 'PWM BANDUNG',
      location: 'Bandung Barat',
      coverImage: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=2070',
      previewVideo: 'https://www.pexels.com/id-id/download/video/13063141/',
    },
    {
      id: 5,
      name: 'PWM MEDAN',
      location: 'Medan Pusat',
      coverImage: 'https://images.pexels.com/photos/36063575/pexels-photo-36063575.jpeg?q=80&w=2070',
      previewVideo: 'https://www.pexels.com/id-id/download/video/32699354/',
    },
  ];

  const handleSlideChange = (swiper) => {
    setActiveIndex(swiper.activeIndex);
  };

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
            <HolywingsCard 
              store={store} 
              isActive={idx === activeIndex}
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

// ===== HOLYWINGS CARD dengan delay 1 detik =====
function HolywingsCard({ store, isActive }) {
  const [showVideo, setShowVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const videoRef = useRef(null);
  const delayTimerRef = useRef(null);

  // Reset dan handle delay saat isActive berubah
  useEffect(() => {
    if (isActive) {
      // Reset state
      setShowVideo(false);
      setShowContent(false);
      
      // Hentikan video jika sedang berjalan
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }

      // Hapus timer sebelumnya jika ada
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }

      // Timer 1 detik: setelah itu tampilkan video dan konten
      delayTimerRef.current = setTimeout(() => {
        setShowVideo(true);
        setShowContent(true);
      }, 1000);
    } else {
      // Jika tidak aktif, reset semua
      setShowVideo(false);
      setShowContent(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
    }

    // Cleanup timer saat komponen unmount atau isActive berubah lagi
    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
    };
  }, [isActive]);

  // Jalankan video saat showVideo menjadi true
  useEffect(() => {
    if (showVideo && videoRef.current && !videoError) {
      videoRef.current.play().catch(e => console.log("Autoplay failed:", e));
    }
  }, [showVideo, videoError]);

  const handleVideoError = () => {
    setVideoError(true);
    console.log("Video failed to load:", store.previewVideo);
  };

  // Untuk desktop: hover (opsional, bisa diaktifkan jika mau)
  // Untuk mobile: tap (alternatif jika swipe tidak dianggap)
  const handleTap = () => {
    if (!showContent) {
      setShowVideo(true);
      setShowContent(true);
      if (videoRef.current && !videoError) {
        videoRef.current.play().catch(e => console.log("Autoplay failed:", e));
      }
    }
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
      onClick={handleTap}
      style={{ aspectRatio: '9/16' }} // Diubah ke 9:16 (lebih panjang seperti story Instagram)
    >
      {/* Tampilkan gambar jika video belum ditampilkan atau error */}
      {(!showVideo || videoError) ? (
        <img
          src={store.coverImage}
          alt={store.name}
          className="absolute inset-0 w-full h-full object-cover transition duration-700"
        />
      ) : (
        <video
          ref={videoRef}
          src={store.previewVideo}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted
          playsInline
          preload="auto"
          onError={handleVideoError}
        />
      )}

      {/* Overlay gradien - muncul hanya saat konten ditampilkan */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent transition-opacity duration-500 ${
          showContent && !videoError ? 'opacity-100' : 'opacity-0'
        }`}
      ></div>

      {/* Konten (nama store, lokasi, tombol) - muncul setelah delay */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-5 transition-all duration-500 transform ${
          showContent && !videoError ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-wide">
          {store.name}
        </h3>
        <div className="flex items-center gap-1 text-gray-300 text-sm mt-1">
          <MapPin size={14} /> {store.location}
        </div>
        <button className="mt-4 flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2.5 px-5 rounded-full transition duration-300 text-sm">
          Lihat Detail <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}