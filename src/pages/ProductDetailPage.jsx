// ============================================================
// FILE: src/pages/ProductDetailPage.jsx
// Halaman detail produk dengan gambar besar, harga, deskripsi, video
// ============================================================

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import FloatingCart from '../components/FloatingCart';
import { ArrowLeft, ShoppingBag, Star, CheckCircle, Video, Store } from 'lucide-react';
import { addToCart as addToCartService } from '../services/cartService';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mainImage, setMainImage] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    setLoading(true);
    setError(null);

    try {
      // Ambil produk
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError || !productData) {
        setError('Produk tidak ditemukan');
        setLoading(false);
        return;
      }

      setProduct(productData);
      setMainImage(productData.image_url || '/placeholder-product.png');

      // Ambil store
      if (productData.store_id) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('id, name, slug, logo')
          .eq('id', productData.store_id)
          .single();

        if (storeData) {
          setStore(storeData);
        }
      }

    } catch (err) {
      console.error('Error fetching product:', err);
      setError('Terjadi kesalahan saat memuat produk');
    }

    setLoading(false);
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    setIsAdding(true);
    const confirmed = addToCartService(product, 1, () => {
      return window.confirm('Keranjang berisi produk dari store lain. Ganti dengan store ini?');
    });
    
    if (confirmed) {
      // Trigger toast (dari StorePage)
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: `✅ ${product.name} ditambahkan ke keranjang` }
      }));
      
      // Trigger animasi floating cart
      window.dispatchEvent(new CustomEvent('cart-animate'));
      window.dispatchEvent(new Event('cart-updated'));
    }
    
    setIsAdding(false);
  };

  // Hitung harga diskon
  const hasDiscount = product?.has_discount && product?.discount_percentage > 0;
  const discountedPrice = hasDiscount 
    ? Math.round(product.price * (100 - product.discount_percentage) / 100)
    : product?.price || 0;

  if (loading) {
    return (
      <div className="bg-black min-h-screen text-white flex items-center justify-center">
        <div className="text-gray-400">Memuat produk...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-black min-h-screen text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-display mb-4">Oops!</h2>
        <p className="text-red-400 mb-4">{error || 'Produk tidak ditemukan'}</p>
        <Link to="/" className="bg-yellow-500 text-black px-4 py-2 rounded-full">Kembali ke Home</Link>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-24">
        {/* Back button */}
        <Link 
          to={`/store/${store?.slug || '#'}`} 
          className="inline-flex items-center gap-1 text-yellow-500 hover:gap-2 transition mb-6"
        >
          <ArrowLeft size={16} /> Kembali ke Store
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ===== KOLOM KIRI: GAMBAR ===== */}
          <div>
            <div className="aspect-square bg-gray-800 rounded-xl overflow-hidden">
              <img
                src={mainImage}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => e.target.src = '/placeholder-product.png'}
              />
            </div>

            {/* Video (jika ada) */}
            {product.video_url && (
              <div className="mt-4 aspect-video bg-gray-800 rounded-xl overflow-hidden">
                <video
                  src={product.video_url}
                  controls
                  className="w-full h-full object-cover"
                  poster={product.image_url || undefined}
                />
              </div>
            )}
          </div>

          {/* ===== KOLOM KANAN: INFO ===== */}
          <div>
            {/* Store info */}
            {store && (
              <Link 
                to={`/store/${store.slug}`}
                className="inline-flex items-center gap-2 text-gray-400 hover:text-yellow-500 transition text-sm mb-2"
              >
                <Store size={16} />
                {store.name}
              </Link>
            )}

            {/* Nama produk */}
            <h1 className="text-3xl md:text-4xl font-display font-bold">{product.name}</h1>

            {/* Harga */}
            <div className="mt-4">
              {hasDiscount ? (
                <div>
                  <span className="text-3xl font-bold text-yellow-500">
                    Rp {discountedPrice.toLocaleString()}
                  </span>
                  <span className="text-gray-500 text-lg line-through ml-3">
                    Rp {product.price.toLocaleString()}
                  </span>
                  <span className="ml-2 text-sm text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">
                    {product.discount_percentage}% OFF
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-yellow-500">
                  Rp {product.price.toLocaleString()}
                </span>
              )}
            </div>

            {/* Stok */}
            <div className="mt-2">
              {product.stock > 0 ? (
                <span className="text-sm text-green-400 flex items-center gap-1">
                  <CheckCircle size={14} /> Stok tersedia ({product.stock} pcs)
                </span>
              ) : (
                <span className="text-sm text-red-400">⛔ Stok habis</span>
              )}
            </div>

            {/* Deskripsi */}
            {product.description && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Deskripsi</h3>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-6 md:line-clamp-none">
                  {product.description}
                </p>
              </div>
            )}

            {/* Tombol Add to Cart */}
            {product.stock > 0 && (
              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                className="mt-6 w-full bg-yellow-500 text-black py-3 rounded-xl font-semibold text-lg hover:bg-yellow-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShoppingBag size={20} />
                {isAdding ? 'Menambahkan...' : 'Tambah ke Keranjang'}
              </button>
            )}

            {/* Favorit badge */}
            {product.is_featured && (
              <div className="mt-4 flex items-center gap-1 text-yellow-500 text-sm">
                <Star size={16} fill="currentColor" /> Produk Favorit
              </div>
            )}
          </div>
        </div>
      </div>

      <FloatingCart />
    </div>
  );
}