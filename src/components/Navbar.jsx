// ========== FILE: src/components/Navbar.jsx ==========
import { useState, useEffect } from 'react';
import { Menu, X, User, LayoutDashboard, Download } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import { requestNotificationPermission } from '../main';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // PWA install prompt (tetap)
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

  // Auth state (tetap sama seperti sebelumnya)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        setIsLoggedIn(true);
        const { data } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (data?.full_name) setUserName(data.full_name);
        requestNotificationPermission();
      } else {
        setIsLoggedIn(false);
        setUserName('');
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        setUser(session.user);
        requestNotificationPermission();
        supabase
          .from('users')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => setUserName(data?.full_name || ''));
      } else {
        setUserName('');
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const menuItems = [
    { label: 'Home', path: '/' },
    { label: 'Stores', path: '/stores' },
    { label: 'Events', path: '/events' },
    { label: 'News', path: '/news' },
  ];

  const MemberButton = () => {
  if (isLoggedIn) {
    return (
      <Link
        to="/member/dashboard"
        className="flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-3 py-2 rounded-full text-sm font-medium border border-yellow-500/50 hover:bg-yellow-500 hover:text-black transition-all duration-300"
        title="Dashboard"
      >
        <LayoutDashboard size={16} />
        <span className="hidden md:inline">Dashboard</span>
      </Link>
    );
  } else {
    return (
      <Link
        to="/member/login"
        className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-black px-3 py-2 rounded-full text-sm font-bold shadow-lg shadow-yellow-500/20 hover:scale-105 transition"
        title="Login"
      >
        <User size={16} />
        <span className="hidden md:inline">Daftar / Login</span>
      </Link>
    );
  }
};

  return (
    <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-black/70 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-3">
          {/* Logo */}
          <Link to="/" className="text-2xl font-display tracking-wider bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent shrink-0">
            PWM
          </Link>

          {/* Search – melebar saat fokus */}
<div className="flex-1 max-w-[200px] md:max-w-md focus-within:max-w-[280px] md:focus-within:max-w-lg transition-all duration-300">
  <GlobalSearch />
</div>

          {/* Tombol sebelah kanan: MemberButton + Lonceng + Install + Hamburger */}
          <div className="flex items-center gap-2">
            {/* Tampil di desktop & mobile: tombol login/dashboard + lonceng */}
            <MemberButton />
            {isLoggedIn && <NotificationBell userId={user?.id} />}

            {/* Tombol Install (jika muncul) */}
            {showInstallBtn && (
              <button
                onClick={handleInstallClick}
                className="hidden md:flex items-center gap-1 bg-yellow-500 text-black px-3 py-2 rounded-full text-sm font-medium hover:bg-yellow-400 transition"
              >
                <Download size={14} /> Install
              </button>
            )}

            {/* Desktop Menu */}
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
              <Link
                to="/admin/login"
                className="relative px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-yellow-400 transition group overflow-hidden"
              >
                <span className="relative z-10">Admin</span>
                <span className="absolute inset-0 bg-yellow-500/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 rounded-lg"></span>
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-white">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
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