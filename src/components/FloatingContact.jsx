// ========== FILE: src/components/FloatingContact.jsx ==========
// Floating button contact us - dinamis berdasarkan konteks store
// TIDAK muncul di halaman admin (path /admin)
// TETAP muncul di halaman store (bersama floating cart)
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function FloatingContact() {
  const location = useLocation();
  const [contactLink, setContactLink] = useState('/contact');
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);

  useEffect(() => {
    // Sembunyikan floating contact di halaman admin SAJA
    // (tetap muncul di halaman store, karena floating cart sudah diatur posisinya)
    const isAdminPage = location.pathname.startsWith('/admin');
    setShouldHide(isAdminPage);
  }, [location.pathname]);

  useEffect(() => {
    const path = location.pathname;
    
    // Jika di halaman admin, tidak perlu hitung link (karena tidak ditampilkan)
    if (path.startsWith('/admin')) return;
    
    setLoading(true);

    // 1. Jika di halaman store: /store/:slug
    const storeMatch = path.match(/^\/store\/([^\/]+)/);
    if (storeMatch) {
      const slug = storeMatch[1];
      setContactLink(`/store/${slug}/contact`);
      setLoading(false);
      return;
    }

    // 2. Jika di halaman detail event: /events/:id
    const eventMatch = path.match(/^\/events\/([a-f0-9-]+)$/i);
    if (eventMatch) {
      const eventId = eventMatch[1];
      fetchStoreSlugFromEvent(eventId).then(slug => {
        if (slug) setContactLink(`/store/${slug}/contact`);
        else setContactLink('/contact');
        setLoading(false);
      }).catch(() => {
        setContactLink('/contact');
        setLoading(false);
      });
      return;
    }

    // 3. Jika di halaman detail news: /news/:id
    const newsMatch = path.match(/^\/news\/([a-f0-9-]+)$/i);
    if (newsMatch) {
      const newsId = newsMatch[1];
      fetchStoreSlugFromNews(newsId).then(slug => {
        if (slug) setContactLink(`/store/${slug}/contact`);
        else setContactLink('/contact');
        setLoading(false);
      }).catch(() => {
        setContactLink('/contact');
        setLoading(false);
      });
      return;
    }

    // 4. Halaman lain (default)
    setContactLink('/contact');
    setLoading(false);
  }, [location.pathname]);

  const fetchStoreSlugFromEvent = async (eventId) => {
    const { data, error } = await supabase
      .from('events')
      .select('stores!inner(slug)')
      .eq('id', eventId)
      .single();
    if (error || !data) return null;
    return data.stores?.slug || null;
  };

  const fetchStoreSlugFromNews = async (newsId) => {
    const { data, error } = await supabase
      .from('news')
      .select('stores!inner(slug)')
      .eq('id', newsId)
      .single();
    if (error || !data) return null;
    return data.stores?.slug || null;
  };

  // Jika di halaman admin, tidak tampil
  if (shouldHide) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50">
      <Link
        to={contactLink}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        onTouchStart={() => setIsExpanded(true)}
        onTouchEnd={() => setIsExpanded(false)}
        className={`
          flex items-center justify-center
          bg-gradient-to-r from-yellow-500 to-orange-600
          text-black font-bold shadow-lg shadow-yellow-500/30
          transition-all duration-300 ease-out
          ${isExpanded ? 'rounded-full px-5 py-3 gap-2 w-auto' : 'rounded-full w-12 h-12 p-0'}
        `}
        style={{ boxShadow: '0 4px 15px rgba(255, 193, 7, 0.3)' }}
      >
        <MessageCircle size={24} className="flex-shrink-0" />
        {isExpanded && (
          <span className="whitespace-nowrap text-sm font-medium">
            {loading ? '...' : 'Contact Us'}
          </span>
        )}
      </Link>
    </div>
  );
}