// ============================================================
// FILE: src/components/ToastNotification.jsx
// Toast notifikasi untuk add to cart
// ============================================================

import { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

export default function ToastNotification({ message, duration = 2500, onClose }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50
        bg-gray-900 border border-white/10 rounded-xl shadow-2xl shadow-yellow-500/20
        px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[400px]
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'}
      `}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
        <CheckCircle className="w-5 h-5 text-green-400" />
      </div>
      <p className="text-sm text-gray-200 flex-1">{message}</p>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => {
            setIsVisible(false);
            if (onClose) onClose();
          }, 300);
        }}
        className="text-gray-500 hover:text-gray-300 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}