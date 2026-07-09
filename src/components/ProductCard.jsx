// ============================================================
// FILE: src/components/ProductCard.jsx
// Komponen card produk yang optimal (rapi, lazy loading, placeholder)
// ============================================================

import { useState } from 'react';
import { Plus, ShoppingBag, Star } from 'lucide-react';

export default function ProductCard({ 
  product, 
  onAddToCart, 
  onViewDetail,
  showStoreName = false,
  storeName = '',
  className = ''
}) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Hitung harga diskon
  const hasDiscount = product.has_discount && product.discount_percentage > 0;
  const discountedPrice = hasDiscount 
    ? Math.round(product.price * (100 - product.discount_percentage) / 100)
    : product.price;

  // Placeholder image (base64 SVG minimal)
  const placeholderImage = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23666" font-size="12" font-family="sans-serif"%3ENo Image%3C/text%3E%3C/svg%3E`;

  const imageSrc = imageError || !product.image_url 
    ? placeholderImage 
    : product.image_url;

  return (
    <div className={`bg-gray-800/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition group ${className}`}>
      {/* ===== IMAGE ===== */}
      <div className="aspect-square relative overflow-hidden bg-gray-800">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
          </div>
        )}
        
        <img
          src={imageSrc}
          alt={product.name}
          loading="lazy"
          className={`w-full h-full object-cover transition duration-300 group-hover:scale-105 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => setIsLoading(false)}
          onError={(e) => {
            setImageError(true);
            setIsLoading(false);
            // Jika error, fallback ke placeholder
            e.target.src = placeholderImage;
          }}
        />

        {/* ===== BADGE ===== */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {hasDiscount && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              🔥 {product.discount_percentage}% OFF
            </span>
          )}
          {product.is_featured && (
            <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <Star size={10} /> Favorit
            </span>
          )}
          {product.stock <= 0 && (
            <span className="bg-gray-700 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              ⛔ Habis
            </span>
          )}
        </div>

        {/* ===== HOVER ADD TO CART BUTTON ===== */}
        {onAddToCart && product.stock > 0 && (
          <button
            onClick={() => onAddToCart(product)}
            className="absolute bottom-2 right-2 bg-yellow-500 text-black p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 hover:bg-yellow-400"
            title="Tambah ke keranjang"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* ===== INFO ===== */}
      <div className="p-3">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-sm font-semibold line-clamp-1 flex-1" title={product.name}>
            {product.name}
          </h3>
        </div>

        {showStoreName && storeName && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{storeName}</p>
        )}

        {/* ===== HARGA ===== */}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className="text-yellow-500 font-bold text-sm">
            Rp {discountedPrice.toLocaleString()}
          </span>
          {hasDiscount && (
            <span className="text-gray-500 text-xs line-through">
              Rp {product.price.toLocaleString()}
            </span>
          )}
        </div>

        {/* ===== STOK ===== */}
        {product.stock > 0 && product.stock < 10 && (
          <p className="text-[10px] text-orange-400 mt-0.5">
            ⚠️ Sisa {product.stock} pcs
          </p>
        )}

        {/* ===== VIEW DETAIL ===== */}
        {onViewDetail && (
          <button
            onClick={() => onViewDetail(product)}
            className="mt-2 text-xs text-yellow-500 hover:text-yellow-400 transition flex items-center gap-1 group-hover:gap-2"
          >
            Lihat Detail →
          </button>
        )}
      </div>
    </div>
  );
}