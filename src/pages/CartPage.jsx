// ========== FILE: src/pages/CartPage.jsx ==========
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getCart, updateCartItemQuantity, removeCartItem, getCartSubtotal } from '../services/cartService';
import { interpretDiscount } from '../utils/priceUtils'; // DS001

export default function CartPage() {
  const [cart, setCart] = useState({ store_id: null, items: [] });
  const navigate = useNavigate();

  useEffect(() => {
    // DS001: Gunakan cartService untuk membaca cart yang sebenarnya
    const currentCart = getCart();
    setCart(currentCart);
  }, []);

  const handleUpdateQuantity = (productId, newQty) => {
    const updatedCart = updateCartItemQuantity(productId, newQty);
    setCart(updatedCart);
  };

  const handleRemoveItem = (productId) => {
    const updatedCart = removeCartItem(productId);
    setCart(updatedCart);
  };

  const subtotal = getCartSubtotal(cart);

  if (cart.items.length === 0) {
    return (
      <div className="bg-black min-h-screen text-white">
        <Navbar />
        <div className="pt-24 text-center">
          <h1 className="text-2xl font-display">Keranjang Kosong</h1>
          <p className="text-gray-400 mt-2">Yuk belanja dulu!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <h1 className="text-2xl font-display mb-6">Keranjang Belanja</h1>
        
        <div className="space-y-4">
          {cart.items.map(item => {
            const originalPrice = item.original_price || item.price;
            const discountedPrice = item.discounted_price || item.price;
            const totalOriginal = originalPrice * item.quantity;
            const totalDiscounted = discountedPrice * item.quantity;
            const hasDiscount = discountedPrice < originalPrice;
            // DS001: Dapatkan label diskon jika perlu
            const discountInfo = hasDiscount ? interpretDiscount(originalPrice, true, item.discount_value) : null;

            return (
              <div key={item.product_id} className="bg-gray-900/50 rounded-xl p-4 flex items-center justify-between">
                <div className="flex gap-4 items-center">
                  <img src={item.image_url || 'https://placehold.co/80'} className="w-16 h-16 object-cover rounded" alt={item.name} />
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <div>
                      <span className="text-yellow-500">Rp {originalPrice.toLocaleString()}</span>
                      {hasDiscount && (
                        <div className="text-xs text-green-400">
                          -Rp {(totalOriginal - totalDiscounted).toLocaleString()} ({discountInfo?.display})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                    className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center"
                  >-</button>
                  <span>{item.quantity}</span>
                  <button 
                    onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                    className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center"
                  >+</button>
                  <button 
                    onClick={() => handleRemoveItem(item.product_id)}
                    className="text-red-400 ml-2"
                  >Hapus</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-right border-t border-white/10 pt-6">
          <p className="text-xl font-bold">Total: Rp {subtotal.toLocaleString()}</p>
          <button 
            onClick={() => navigate('/checkout')}
            className="mt-4 bg-yellow-500 text-black px-6 py-2 rounded-full"
          >
            Lanjut ke Checkout
          </button>
        </div>
      </div>
    </div>
  );
}