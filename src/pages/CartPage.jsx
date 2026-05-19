// ========== FILE: src/pages/CartPage.jsx ==========
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function CartPage() {
  const [cart, setCart] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) setCart(JSON.parse(savedCart));
  }, []);

  const updateQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      setCart(cart.filter(item => item.id !== productId));
    } else {
      setCart(cart.map(item => 
        item.id === productId ? { ...item, quantity: newQty } : item
      ));
    }
  };

  const removeItem = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return alert('Keranjang kosong');
    // Simpan ke localStorage sementara, nanti di halaman checkout
    localStorage.setItem('checkoutCart', JSON.stringify(cart));
    navigate('/checkout');
  };

  if (cart.length === 0) {
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
          {cart.map(item => (
            <div key={item.id} className="bg-gray-900/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <img src={item.image_url || 'https://placehold.co/80'} className="w-16 h-16 object-cover rounded" />
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-yellow-500">Rp {item.price.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-8 h-8 rounded-full bg-gray-700"
                >-</button>
                <span>{item.quantity}</span>
                <button 
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-8 h-8 rounded-full bg-gray-700"
                >+</button>
                <button 
                  onClick={() => removeItem(item.id)}
                  className="text-red-400 ml-2"
                >Hapus</button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-right border-t border-white/10 pt-6">
          <p className="text-xl font-bold">Total: Rp {getTotal().toLocaleString()}</p>
          <button 
            onClick={handleCheckout}
            className="mt-4 bg-yellow-500 text-black px-6 py-2 rounded-full"
          >
            Lanjut ke Checkout
          </button>
        </div>
      </div>
    </div>
  );
}