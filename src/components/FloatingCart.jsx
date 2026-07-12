// ========== FILE: src/components/FloatingCart.jsx ==========
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, X, Plus, Minus, Trash2 } from 'lucide-react';
import { getCart, updateCartItemQuantity, removeCartItem, getCartSubtotal, getCartTotalQuantity } from '../services/cartService';
import { interpretDiscount, calculateDiscountedPrice } from '../utils/priceUtils'; // DS001

export default function FloatingCart() {
  const [cart, setCart] = useState({ store_id: null, items: [] });
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const refreshCart = () => {
    setCart(getCart());
  };

  // Initial load dan event listener untuk cart update
  useEffect(() => {
    refreshCart();
    
    // Listen untuk event cart-updated (dari cartService)
    const handleCartUpdate = () => {
      refreshCart();
    };
    
    window.addEventListener('cart-updated', handleCartUpdate);
    
    // Cleanup event listener
    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, []);

  const [isAnimating, setIsAnimating] = useState(false);

// Event listener untuk animasi
useEffect(() => {
  const handleAnimate = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
  };
  
  window.addEventListener('cart-animate', handleAnimate);
  return () => window.removeEventListener('cart-animate', handleAnimate);
}, []);

  const handleUpdateQuantity = (productId, newQty) => {
    updateCartItemQuantity(productId, newQty);
    // refreshCart akan otomatis terpanggil via event listener
  };

  const handleRemoveItem = (productId) => {
    removeCartItem(productId);
    // refreshCart akan otomatis terpanggil via event listener
  };

  const subtotal = getCartSubtotal(cart);
  const totalQuantity = getCartTotalQuantity(cart);

  if (cart.items.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-6 z-40">
      {/* Tombol floating (tertutup) */}
      {!isOpen && (
       <button
  onClick={() => setIsOpen(true)}
  className={`
    bg-yellow-500 text-black rounded-full p-3 shadow-lg hover:scale-105 transition relative
    ${isAnimating ? 'animate-bounce' : ''}
  `}
>
  <ShoppingBag size={24} />
  {totalQuantity > 0 && (
    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
      {totalQuantity}
    </span>
  )}
</button>
      )}

      {/* Panel cart (terbuka) */}
      {isOpen && (
        <div className="bg-gray-900 rounded-xl w-80 shadow-xl border border-white/10 overflow-hidden">
          <div className="flex justify-between items-center p-3 border-b border-white/10 bg-gray-800">
            <h3 className="font-semibold">Keranjang Belanja</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          
          <div className="max-h-96 overflow-y-auto p-3 space-y-3">
            {cart.items.map(item => (
              <div key={item.product_id} className="flex gap-2 text-sm">
                <img src={item.image_url || 'https://placehold.co/50'} className="w-10 h-10 object-cover rounded" />
                <div className="flex-1">
                  <p className="font-medium line-clamp-1">{item.name}</p>
                  <p className="text-yellow-500 text-xs">
                      Rp {item.original_price.toLocaleString()}
                      {item.discounted_price < item.original_price && (
                        <div className="text-green-400 text-[10px]">
                          -Rp {((item.original_price - item.discounted_price) * item.quantity).toLocaleString()}
                        </div>
                      )}
                    </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button 
                      onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)} 
                      className="bg-gray-700 rounded-full w-5 h-5 flex items-center justify-center hover:bg-gray-600"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="text-xs">{item.quantity}</span>
                    <button 
                      onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)} 
                      className="bg-gray-700 rounded-full w-5 h-5 flex items-center justify-center hover:bg-gray-600"
                    >
                      <Plus size={10} />
                    </button>
                    <button 
                      onClick={() => handleRemoveItem(item.product_id)} 
                      className="text-red-400 ml-1 hover:text-red-300"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="border-t border-white/10 p-3 space-y-2">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>Rp {subtotal.toLocaleString()}</span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/checkout');
              }}
              className="w-full bg-yellow-500 text-black py-2 rounded-full text-sm font-semibold hover:bg-yellow-600 transition"
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}