// ========== FILE: src/components/Navbar.jsx ==========
// Navbar dengan conditional: jika member login, tampilkan Dashboard, jika tidak, tampilkan Login
import { useState, useEffect } from 'react';
import { Menu, X, User, Shield, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
    
    // Subscribe ke perubahan auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsLoggedIn(true);
        fetchUserName(session.user.id);
      } else {
        setIsLoggedIn(false);
        setUserName('');
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setIsLoggedIn(true);
      await fetchUserName(user.id);
    }
  };

  const fetchUserName = async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();
    if (data?.full_name) {
      setUserName(data.full_name);
    } else {
      setUserName('');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserName('');
    navigate('/');
  };

  return (
    <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-black/70 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-2xl font-display tracking-wider bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            PWM
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8 items-center">
            <Link to="/" className="hover:text-yellow-400 transition">Home</Link>
            <Link to="/stores" className="hover:text-yellow-400 transition">Stores</Link>
            <Link to="/events" className="hover:text-yellow-400 transition">Events</Link>
            <Link to="/news" className="hover:text-yellow-400 transition">News</Link>
            
            {isLoggedIn ? (
              <>
                <Link to="/member/dashboard" className="flex items-center gap-1 hover:text-yellow-400 transition">
                  <LayoutDashboard size={18} /> Dashboard
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-1 text-gray-400 hover:text-red-400 transition text-sm">
                  Logout
                </button>
              </>
            ) : (
              <Link to="/member/login" className="flex items-center gap-1 hover:text-yellow-400 transition">
                <User size={18} /> Login
              </Link>
            )}
            
            <Link to="/admin/login" className="flex items-center gap-1 text-gray-400 hover:text-yellow-400 transition text-sm">
              <Shield size={16} /> Admin
            </Link>
          </div>

          {/* Mobile button */}
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-white">
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
            <Link to="/events" onClick={() => setIsOpen(false)} className="block hover:text-yellow-400">Events</Link>
            <Link to="/news" onClick={() => setIsOpen(false)} className="block hover:text-yellow-400">News</Link>
            
            {isLoggedIn ? (
              <>
                <Link to="/member/dashboard" onClick={() => setIsOpen(false)} className="block hover:text-yellow-400">Dashboard</Link>
                <button onClick={() => { handleLogout(); setIsOpen(false); }} className="block text-red-400 hover:text-red-300 w-full text-left">Logout</button>
              </>
            ) : (
              <Link to="/member/login" onClick={() => setIsOpen(false)} className="block hover:text-yellow-400">Login Member</Link>
            )}
            
            <Link to="/admin/login" onClick={() => setIsOpen(false)} className="block text-gray-400 hover:text-yellow-400">Admin Login</Link>
          </div>
        </div>
      )}
    </nav>
  );
}