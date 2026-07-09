// ============================================================
// FILE: src/components/CategoryFilter.jsx
// Sticky category filter untuk halaman store
// ============================================================

import { useState, useEffect, useRef } from 'react';

export default function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  productCounts = {},
  className = '',
}) {
  const [isSticky, setIsSticky] = useState(false);
  const containerRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Tambahkan kategori "Semua"
  const allCategories = [
    { id: 'all', name: 'Semua', count: productCounts.total || 0 },
    ...categories.map(cat => ({
      id: cat.master_categories?.id || cat.id,
      name: cat.master_categories?.name || cat.name,
      count: productCounts[cat.master_categories?.id || cat.id] || 0,
    })),
  ];

  return (
    <>
      {/* Sentinel untuk deteksi sticky */}
      <div ref={sentinelRef} className="h-px" />

      <div
  ref={containerRef}
  className={`
    ${isSticky ? 'fixed top-[64px] left-0 right-0 z-40 bg-black/95 backdrop-blur-sm border-b border-white/10' : ''}
    transition-all duration-300
    ${className}
  `}
  style={isSticky ? { paddingTop: '8px', paddingBottom: '8px' } : {}}
>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-3 overflow-x-auto py-2 scrollbar-hide">
            {allCategories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`
                    flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap
                    ${isActive
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white'
                    }
                  `}
                >
                  {cat.name}
                  {cat.count > 0 && (
                    <span className={`ml-1.5 text-xs ${isActive ? 'text-black/70' : 'text-gray-500'}`}>
                      ({cat.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spacer untuk sticky (agar konten tidak tertutup) */}
      {isSticky && <div className="h-[52px]" />}
    </>
  );
}