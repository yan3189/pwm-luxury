import { useState, useRef } from 'react';

export default function SlideToConfirm({ onConfirm, text = "Geser ke kanan untuk selesai", disabled = false }) {
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const maxWidth = 200;

  const handleDragStart = (e) => {
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragMove = (e) => {
    if (!isDragging || disabled) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = containerRef.current.getBoundingClientRect();
    let newPosition = clientX - rect.left - 20;
    newPosition = Math.max(0, Math.min(newPosition, maxWidth));
    setSliderPosition(newPosition);
  };

  const handleDragEnd = () => {
    if (!isDragging || disabled) return;
    setIsDragging(false);
    if (sliderPosition >= maxWidth - 20) {
      onConfirm();
    }
    setSliderPosition(0);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-12 bg-gray-700 rounded-full overflow-hidden cursor-pointer"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
    >
      <div
        className="absolute left-0 top-0 h-full bg-emerald-600 transition-all duration-75"
        style={{ width: `${sliderPosition + 40}px` }}
      />
      <div
        className="absolute left-0 top-0 h-10 w-10 m-1 bg-white rounded-full shadow-lg flex items-center justify-center transition-transform"
        style={{ transform: `translateX(${sliderPosition}px)` }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <span className="text-gray-800 text-lg">→</span>
      </div>
      <span className="absolute inset-0 flex items-center justify-center text-white text-sm pointer-events-none">
        {text}
      </span>
    </div>
  );
}