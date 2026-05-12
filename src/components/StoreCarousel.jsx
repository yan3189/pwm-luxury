// ========== FILE: src/components/StoreCarousel.jsx ==========
import { useState, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { ChevronRight, MapPin } from 'lucide-react';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function StoreCarousel() {
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

  return (
    <div className="w-full py-4">
      <Swiper
        modules={[Navigation, Pagination]}
        spaceBetween={12}
        slidesPerView={1.1}
        breakpoints={{
          640: { slidesPerView: 1.3, spaceBetween: 16 },
          1024: { slidesPerView: 1.8, spaceBetween: 20 },
          1280: { slidesPerView: 2.2, spaceBetween: 24 },
        }}
        navigation
        pagination={{ clickable: true }}
        className="store-carousel"
      >
        {stores.map((store) => (
          <SwiperSlide key={store.id}>
            <HolywingsCard store={store} />
          </SwiperSlide>
        ))}
      </Swiper>

      <style>{`
        .store-carousel .swiper-button-next,
        .store-carousel .swiper-button-prev {
          color: #FFD700;
          background: rgba(0,0,0,0.5);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          backdrop-filter: blur(4px);
        }
        .store-carousel .swiper-button-next:after,
        .store-carousel .swiper-button-prev:after {
          font-size: 16px;
          font-weight: bold;
        }
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

// ===== INI ADALAH HolywingsCard (masih di file yang sama) =====
function HolywingsCard({ store }) {
  const [isActive, setIsActive] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

  const handleMouseEnter = () => {
    setIsActive(true);
    if (videoRef.current && !videoError) {
      videoRef.current.play().catch(e => console.log("Autoplay failed:", e));
    }
  };

  const handleMouseLeave = () => {
    setIsActive(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleTouchStart = () => {
    if (!isActive) {
      setIsActive(true);
      if (videoRef.current && !videoError) {
        videoRef.current.play().catch(e => console.log("Autoplay failed:", e));
      }
    }
  };

  const handleVideoError = () => {
    setVideoError(true);
    console.log("Video failed to load:", store.previewVideo);
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      style={{ aspectRatio: '3/4' }}
    >
      {!isActive || videoError ? (
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
          autoPlay
          onError={handleVideoError}
        />
      )}

      <div
        className={`absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent transition-opacity duration-300 ${
          isActive && !videoError ? 'opacity-100' : 'opacity-0'
        }`}
      ></div>

      <div
        className={`absolute bottom-0 left-0 right-0 p-5 transition-all duration-300 transform ${
          isActive && !videoError ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <h3 className="text-2xl md:text-3xl font-display font-bold text-white tracking-wide">
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