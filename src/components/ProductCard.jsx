// ============================================================
// FILE: src/components/ProductCard.jsx
// Komponen card produk dengan diskon (persen & nominal)
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Star } from 'lucide-react';
import { interpretDiscount, getDiscountLabel } from '../utils/priceUtils';

export default function ProductCard({ 
  product, 
  onAddToCart, 
  showStoreName = false,
  storeName = '',
  className = ''
}) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // INTERPRETASI DISKON DENGAN priceUtils
  // ============================================================
  const hasDiscount = product.has_discount && product.discount_value > 0;
  const discountInfo = interpretDiscount(
    product.price, 
    product.has_discount, 
    product.discount_value
  );
  
  const finalPrice = discountInfo.finalPrice;
  const discountDisplay = discountInfo.display;
  const isPercentage = discountInfo.type === 'percentage';

  // Placeholder image
  const placeholderImage = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23666" font-size="12" font-family="sans-serif"%3ENo Image%3C/text%3E%3C/svg%3E`;

  const imageSrc = imageError || !product.image_url 
    ? placeholderImage 
    : product.image_url;

  // Handle klik card (redirect ke detail)
  const handleCardClick = (e) => {
    if (e.target.closest('button')) return;
    navigate(`/product/${product.id}`);
  };

  return (
    <div 
      className={`bg-gray-800/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition group cursor-pointer ${className}`}
      onClick={handleCardClick}
    >
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
            e.target.src = placeholderImage;
          }}
        />

        {/* ===== BADGE DISKON ===== */}
        {hasDiscount && (
          <div className="absolute top-2 left-2 z-10">
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {isPercentage ? `🔥 ${discountDisplay}` : `💰 ${discountDisplay}`}
            </span>
          </div>
        )}

        {product.is_featured && (
          <div className="absolute top-2 left-2 z-10 mt-6">
            <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <Star size={10} /> Favorit
            </span>
          </div>
        )}

        {product.stock <= 0 && (
          <span className="absolute top-2 left-2 bg-gray-700 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
            ⛔ Habis
          </span>
        )}

        {/* ===== HOVER ADD TO CART ===== */}
        {onAddToCart && product.stock > 0 && (
          <button
            onClick={() => {
              onAddToCart(product);
              window.dispatchEvent(new CustomEvent('cart-animate'));
            }}
            className="absolute bottom-2 right-2 bg-yellow-500 text-black p-2 rounded-full 
              opacity-100 md:opacity-0 group-hover:opacity-100 
              transition-all duration-300 hover:scale-110 hover:bg-yellow-400
              shadow-lg shadow-yellow-500/30 md:shadow-none z-10"
            title="Tambah ke keranjang"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* ===== INFO ===== */}
      <div className="p-3">
        <h3 className="text-sm font-semibold line-clamp-1" title={product.name}>
          {product.name}
        </h3>

        {showStoreName && storeName && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{storeName}</p>
        )}

        {/* ===== HARGA ===== */}
        <div className="mt-1.5">
          {hasDiscount ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-yellow-500 font-bold text-sm">
                Rp {finalPrice.toLocaleString()}
              </span>
              <span className="text-gray-500 text-xs line-through">
                Rp {product.price.toLocaleString()}
              </span>
              <span className="text-red-400 text-[10px] font-medium">
                {discountDisplay}
              </span>
            </div>
          ) : (
            <span className="text-yellow-500 font-bold text-sm">
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
      </div>
    </div>
  );
}