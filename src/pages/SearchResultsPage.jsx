// src/pages/SearchResultsPage.jsx
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { globalSearch, getUserDefaultLocation } from '../services/searchService';
import { MapPin, Package, Store, Newspaper, ArrowLeft } from 'lucide-react';

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState({ products: [], stores: [], articles: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    getUserDefaultLocation().then(loc => setLocation(loc));
  }, []);

  useEffect(() => {
    if (query.length >= 2) {
      search();
    } else {
      setLoading(false);
    }
  }, [query, location]);

  const search = async () => {
    setLoading(true);
    const coords = location || { lat: -6.2088, lng: 106.8456 };
    const searchResults = await globalSearch(query, coords.lat, coords.lng);
    setResults(searchResults);
    setLoading(false);
  };

  const formatDistance = (distanceKm) => {
    if (!distanceKm) return '';
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
    return `${distanceKm.toFixed(1)} km`;
  };

  if (loading) {
    return (
      <div className="bg-black min-h-screen text-white">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-400">Mencari "{query}"...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <Link to="/" className="inline-flex items-center gap-1 text-yellow-500 mb-6 hover:gap-2 transition">
          <ArrowLeft size={16} /> Kembali
        </Link>

        <h1 className="text-2xl font-display mb-2">Hasil pencarian untuk "{query}"</h1>
        <p className="text-gray-400 mb-6">Ditemukan {results.total} hasil</p>

        {/* Produk */}
        {results.products.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-display mb-4 flex items-center gap-2">
              <Package size={20} className="text-yellow-500" /> Produk ({results.products.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.products.map(product => (
                <Link
                  key={product.id}
                  to={`/store/${product.store_slug}?product=${product.id}`}
                  className="bg-gray-900/50 rounded-xl p-4 border border-white/10 hover:border-yellow-500/50 transition flex gap-4 group"
                >
                  <img 
                    src={product.image_url || 'https://placehold.co/80'} 
                    className="w-20 h-20 object-cover rounded-lg group-hover:scale-105 transition duration-300" 
                    alt={product.name}
                  />
                  <div className="flex-1">
                    <p className="font-semibold line-clamp-1">{product.name}</p>
                    <p className="text-sm text-gray-400">{product.store_name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-yellow-500 font-semibold">Rp {product.price?.toLocaleString()}</span>
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
          </div>
        )}

        {/* Toko */}
        {results.stores.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-display mb-4 flex items-center gap-2">
              <Store size={20} className="text-yellow-500" /> Toko ({results.stores.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.stores.map(store => (
                <Link
                  key={store.id}
                  to={`/store/${store.slug}`}
                  className="bg-gray-900/50 rounded-xl p-4 border border-white/10 hover:border-yellow-500/50 transition flex gap-4 group"
                >
                  <img 
                    src={store.image_url || 'https://placehold.co/80'} 
                    className="w-20 h-20 object-cover rounded-full group-hover:scale-105 transition duration-300" 
                    alt={store.name}
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{store.name}</p>
                    {store.distance_km && (
                      <p className="text-sm text-gray-400 flex items-center gap-0.5 mt-1">
                        <MapPin size={12} /> {formatDistance(store.distance_km)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Artikel */}
        {results.articles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-display mb-4 flex items-center gap-2">
              <Newspaper size={20} className="text-yellow-500" /> Artikel ({results.articles.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.articles.map(article => (
                <Link
                  key={article.id}
                  to={`/news/${article.id}`}
                  className="bg-gray-900/50 rounded-xl p-4 border border-white/10 hover:border-yellow-500/50 transition flex gap-4 group"
                >
                  <img 
                    src={article.image_url || 'https://placehold.co/80'} 
                    className="w-20 h-20 object-cover rounded-lg group-hover:scale-105 transition duration-300" 
                    alt={article.name}
                  />
                  <div className="flex-1">
                    <p className="font-semibold line-clamp-2">{article.name}</p>
                    <p className="text-sm text-gray-400 mt-1">{article.store_name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {results.total === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Tidak ada hasil untuk "{query}"</p>
            <p className="text-sm text-gray-500 mt-2">Coba kata kunci lain</p>
          </div>
        )}
      </div>
    </div>
  );
}