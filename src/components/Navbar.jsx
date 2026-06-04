// ========== FILE: src/components/Navbar.jsx ==========
// Navbar dengan tombol login/daftar gabung, efek kotak & sliding highlight
import { useState, useEffect } from 'react';
import { Menu, X, User, Shield, LayoutDashboard, Download } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import GlobalSearch from './GlobalSearch';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const navigate = useNavigate();

  // PWA install prompt
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

  // Auth state
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        const { data } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (data?.full_name) setUserName(data.full_name);
      } else {
        setIsLoggedIn(false);
        setUserName('');
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        supabase
          .from('users')
          .select('full_name')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => setUserName(data?.full_name || ''));
      } else {
        setUserName('');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Menu items (urutkan: Home, Stores, Events, News, lalu setelah login/daftar, Install App di paling bawah)
  const menuItems = [
    { label: 'Home', path: '/' },
    { label: 'Stores', path: '/stores' },
    { label: 'Events', path: '/events' },
    { label: 'News', path: '/news' },
  ];

  // Tombol member (login/daftar atau dashboard)
  const MemberButton = () => {
    if (isLoggedIn) {
      return (
        <Link
          to="/member/dashboard"
          className="flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-4 py-2 rounded-full text-sm font-medium border border-yellow-500/50 hover:bg-yellow-500 hover:text-black transition-all duration-300"
        >
          <LayoutDashboard size={16} /> Dashboard
        </Link>
      );
    } else {
      return (
        <Link
          to="/member/login"
          className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-black px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-yellow-500/20 hover:scale-105 transition"
        >
          <User size={16} /> Daftar / Login
        </Link>
      );
    }
  };

  return (
    <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-black/70 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="text-2xl font-display tracking-wider bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            PWM
          </Link>
          <div className="hidden md:block w-80">
          <GlobalSearch />
          </div>

          {/* Desktop Menu dengan efek kotak & sliding */}
          <div className="hidden md:flex items-center gap-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="relative px-4 py-2 rounded-lg text-sm font-medium text-white hover:text-yellow-400 transition-all duration-300 overflow-hidden group"
              >
                <span className="relative z-10">{item.label}</span>
                <span className="absolute inset-0 bg-yellow-500/20 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 rounded-lg"></span>
              </Link>
            ))}
            <MemberButton />
            <Link
              to="/admin/login"
              className="relative px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-yellow-400 transition group overflow-hidden"
            >
              <span className="relative z-10">Admin</span>
              <span className="absolute inset-0 bg-yellow-500/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 rounded-lg"></span>
            </Link>
            
            {/* Install App button - paling bawah */}
            {showInstallBtn && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1 bg-yellow-500 text-black px-3 py-2 rounded-full text-sm font-medium hover:bg-yellow-400 transition"
              >
                <Download size={14} /> Install
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-white">
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu - juga dengan efek kotak dan Install App di bawah */}
      {isOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-lg border-t border-white/10">
          <div className="px-4 py-4 space-y-3">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 rounded-lg text-white hover:text-yellow-400 hover:bg-yellow-500/10 transition"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2">
              <MemberButton />
            </div>
            <Link
              to="/admin/login"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition"
            >
              Admin
            </Link>
            
            {showInstallBtn && (
              <button
                onClick={() => { handleInstallClick(); setIsOpen(false); }}
                className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-full text-sm font-medium w-full justify-center"
              >
                <Download size={16} /> Install App
              </button>
            )}
            
          </div>
        </div>
      )}
    </nav>
  );
}