// src/components/GlobalSearch.jsx
import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Package, Store, Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { globalSearch, getUserDefaultLocation } from '../services/searchService';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ products: [], stores: [], articles: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useState(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    // Ambil lokasi user untuk hitung jarak
    getUserDefaultLocation().then(loc => setLocation(loc));
    
    // Click outside handler
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (query.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        const coords = location || { lat: -6.2088, lng: 106.8456 };
        const searchResults = await globalSearch(query, coords.lat, coords.lng);
        setResults(searchResults);
        setIsOpen(true);
        setLoading(false);
      }, 300);
    } else {
      setIsOpen(false);
      setResults({ products: [], stores: [], articles: [], total: 0 });
    }
    
    return () => clearTimeout(debounceRef.current);
  }, [query, location]);

  const formatDistance = (distanceKm) => {
    if (!distanceKm) return '';
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
    return `${distanceKm.toFixed(1)} km`;
  };

  const totalResults = results.products.length + results.stores.length + results.articles.length;

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Cari produk, toko, artikel..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="w-full pl-10 pr-10 py-2 rounded-full bg-gray-800/50 border border-white/10 text-white text-sm focus:border-yellow-500 focus:outline-none transition"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Dropdown Hasil */}
      {isOpen && totalResults > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 rounded-xl border border-white/10 shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            {/* Produk */}
            {results.products.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400">
                  <Package size={12} /> Produk ({results.products.length})
                </div>
                {results.products.map(product => (
                  <Link
                    key={product.id}
                    to={`/store/${product.store_slug}?product=${product.id}`}                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg transition"
                  >
                    <img src={product.image_url || 'https://placehold.co/40'} className="w-10 h-10 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.store_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-yellow-500 text-xs font-semibold">Rp {product.price?.toLocaleString()}</span>
                        {product.distance_km && (
                          <span className="text-xs text-gray-500 flex items-center gap-0.5">
                            <MapPin size={10} /> {formatDistance(product.distance_km)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Toko */}
            {results.stores.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400">
                  <Store size={12} /> Toko ({results.stores.length})
                </div>
                {results.stores.map(store => (
                  <Link
                    key={store.id}
                    to={`/store/${store.id}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg transition"
                  >
                    <img src={store.image_url || 'https://placehold.co/40'} className="w-10 h-10 object-cover rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{store.name}</p>
                      {store.distance_km && (
                        <p className="text-xs text-gray-400 flex items-center gap-0.5">
                          <MapPin size={10} /> {formatDistance(store.distance_km)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Artikel */}
            {results.articles.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400">
                  <Newspaper size={12} /> Artikel ({results.articles.length})
                </div>
                {results.articles.map(article => (
                  <Link
                    key={article.id}
                    to={`/news/${article.id}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg transition"
                  >
                    <img src={article.image_url || 'https://placehold.co/40'} className="w-10 h-10 object-cover rounded" />
                    <div className="flex-1">
                      <p className="text-sm font-medium truncate">{article.name}</p>
                      <p className="text-xs text-gray-400">{article.store_name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Link Lihat Semua */}
            {totalResults > 0 && (
              <Link
                to={`/search?q=${encodeURIComponent(query)}`}
                onClick={() => setIsOpen(false)}
                className="block text-center text-yellow-500 text-sm py-2 border-t border-white/10 mt-1 hover:bg-gray-800 rounded-lg transition"
              >
                Lihat semua hasil ({totalResults})
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 rounded-xl border border-white/10 shadow-xl z-50 p-4 text-center text-gray-400 text-sm">
          <div className="animate-pulse">Mencari...</div>
        </div>
      )}
    </div>
  );
}