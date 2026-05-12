// ========== FILE: src/components/StoreCarousel.jsx ==========
// Holywings-style card - dengan reset state saat slide berubah
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

  // Reset active state saat slide berubah
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

// ===== HOLYWINGS CARD (dengan prop isActive dari parent) =====
function HolywingsCard({ store, isActive }) {
  const [isHovering, setIsHovering] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

  // Untuk desktop: hover
  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // Untuk mobile: tap (menggunakan isActive dari swiper)
  useEffect(() => {
    if (!isActive) {
      // Jika slide tidak aktif, reset video dan state
      setIsHovering(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive]);

  // Jalankan video saat isHovering aktif
  useEffect(() => {
    if (isHovering && videoRef.current && !videoError) {
      videoRef.current.play().catch(e => console.log("Autoplay failed:", e));
    } else if (!isHovering && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovering, videoError]);

  const handleVideoError = () => {
    setVideoError(true);
    console.log("Video failed to load:", store.previewVideo);
  };

  // Untuk mobile: tap pada card (aktifkan hover state)
  const handleTap = () => {
    setIsHovering(!isHovering);
  };

  const showContent = isHovering || isActive;

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleTap}
      style={{ aspectRatio: '4/5' }} // Diubah dari 3/4 ke 4/5 agar lebih panjang
    >
      {!showContent || videoError ? (
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

      {/* Overlay gradien */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent transition-opacity duration-300 ${
          showContent && !videoError ? 'opacity-100' : 'opacity-0'
        }`}
      ></div>

      {/* Konten (nama store, lokasi, tombol) */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-5 transition-all duration-300 transform ${
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