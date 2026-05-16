// ========== FILE: src/components/Navbar.jsx ==========
// Navbar dengan tombol install PWA (untuk Android/Chrome)
import { useState, useEffect } from 'react';
import { Menu, X, User, Shield, LayoutDashboard, Download } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const navigate = useNavigate();

  // Listen untuk event install PWA
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted install');
        }
        setDeferredPrompt(null);
        setShowInstallBtn(false);
      });
    }
  };

  useEffect(() => {
    checkUser();
    
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
          <div className="hidden md:flex space-x-4 lg:space-x-8 items-center">
            <Link to="/" className="hover:text-yellow-400 transition text-sm lg:text-base">Home</Link>
            <Link to="/stores" className="hover:text-yellow-400 transition text-sm lg:text-base">Stores</Link>
            <Link to="/events" className="hover:text-yellow-400 transition text-sm lg:text-base">Events</Link>
            <Link to="/news" className="hover:text-yellow-400 transition text-sm lg:text-base">News</Link>
            
            {/* Tombol Install PWA */}
            {showInstallBtn && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-1 bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-medium hover:bg-yellow-400 transition"
              >
                <Download size={14} /> Install App
              </button>
            )}
            
            {isLoggedIn ? (
              <>
                <Link to="/member/dashboard" className="flex items-center gap-1 hover:text-yellow-400 transition text-sm lg:text-base">
                  <LayoutDashboard size={16} /> Dashboard
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-1 text-gray-400 hover:text-red-400 transition text-sm">
                  Logout
                </button>
              </>
            ) : (
              <Link to="/member/login" className="flex items-center gap-1 hover:text-yellow-400 transition text-sm lg:text-base">
                <User size={16} /> Login
              </Link>
            )}
            
            <Link to="/admin/login" className="flex items-center gap-1 text-gray-400 hover:text-yellow-400 transition text-sm">
              <Shield size={14} /> Admin
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
            
            {/* Tombol Install PWA di mobile */}
            {showInstallBtn && (
              <button 
                onClick={() => { handleInstallClick(); setIsOpen(false); }}
                className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-full text-sm font-medium w-full justify-center"
              >
                <Download size={16} /> Install App
              </button>
            )}
            
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