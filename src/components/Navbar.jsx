// ========== KOMPONEN NAVBAR ==========
// Navbar dengan efek blur dan hamburger menu untuk mobile
import { useState } from 'react';
import { Menu, X, ShoppingBag, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-black/70 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="text-2xl font-display tracking-wider bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            PWM
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="hover:text-yellow-400 transition">Home</Link>
            <Link to="/stores" className="hover:text-yellow-400 transition">Stores</Link>
            <Link to="/login" className="flex items-center gap-1 hover:text-yellow-400 transition">
              <User size={18} /> Login
            </Link>
          </div>

          {/* Mobile button */}
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden">
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-lg border-t border-white/10">
          <div className="px-4 py-4 space-y-3">
            <Link to="/" onClick={() => setIsOpen(false)} className="block hover:text-yellow-400">Home</Link>
            <Link to="/stores" onClick={() => setIsOpen(false)} className="block hover:text-yellow-400">Stores</Link>
            <Link to="/login" onClick={() => setIsOpen(false)} className="block hover:text-yellow-400">Login</Link>
          </div>
        </div>
      )}
    </nav>
  );
}