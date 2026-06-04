// src/components/LocalSearch.jsx
import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { searchStoreProducts } from '../services/searchService';

export default function LocalSearch({ storeId, onResults, onClear }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useState(null)[0];

  useEffect(() => {
    if (!debounceRef) return;
    
    if (query.length >= 2) {
      const timeoutId = setTimeout(async () => {
        setLoading(true);
        const results = await searchStoreProducts(storeId, query);
        if (onResults) onResults(results);
        setLoading(false);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (query.length === 0) {
      if (onClear) onClear();
    }
  }, [query, storeId]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Cari produk dalam store ini..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 rounded-lg bg-gray-800/50 border border-white/10 text-white text-sm focus:border-yellow-500 focus:outline-none transition"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {loading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}