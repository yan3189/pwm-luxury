// ============================================================
// FILE: src/hooks/useInfiniteScroll.js
// Custom hook untuk lazy loading (infinite scroll)
// ============================================================

import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook untuk infinite scroll dengan Intersection Observer
 * @param {Function} onLoadMore - Fungsi yang dipanggil saat perlu load lebih banyak data
 * @param {boolean} hasMore - Apakah masih ada data untuk dimuat
 * @param {boolean} loading - Apakah sedang loading
 * @param {number} threshold - Jarak trigger (default: 100px)
 * @returns {Object} { loaderRef, resetObserver }
 */
export function useInfiniteScroll(onLoadMore, hasMore, loading, threshold = 100) {
  const loaderRef = useRef(null);
  const observerRef = useRef(null);

  const resetObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Jika tidak ada data lagi atau sedang loading, hentikan observer
    if (!hasMore || loading) {
      return;
    }

    // Buat observer baru
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMore && !loading) {
          console.log('🔍 Triggering load more...');
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin: `0px 0px ${threshold}px 0px`,
        threshold: 0.1,
      }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
      observerRef.current = observer;
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [hasMore, loading, onLoadMore, threshold]);

  // Reset observer saat komponen unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  return { loaderRef, resetObserver };
}