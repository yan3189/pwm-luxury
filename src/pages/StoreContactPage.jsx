// ========== FILE: src/pages/StoreContactPage.jsx ==========
// Halaman kontak per store
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import ContactForm from '../components/ContactForm';
import { Mail, Phone, MapPin, ArrowLeft } from 'lucide-react';

export default function StoreContactPage() {
  const { slug } = useParams();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (slug) fetchStore();
  }, [slug]);

  const fetchStore = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) setError('Store tidak ditemukan');
    else setStore(data);
    setLoading(false);
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  if (error) return <div className="bg-black min-h-screen text-white p-8">{error}</div>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-24">
        <Link to={`/store/${slug}`} className="inline-flex items-center gap-2 text-yellow-500 mb-6 hover:gap-3 transition">
          <ArrowLeft size={16} /> Kembali ke {store.name}
        </Link>
        <h1 className="text-3xl font-display mb-2">Hubungi {store.name}</h1>
        <p className="text-gray-400 mb-8">Ada pertanyaan untuk store ini? Silakan isi formulir di bawah.</p>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Info Store */}
          <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-display mb-4">Informasi Store</h2>
            <div className="space-y-4">
              {store.alamat && (
                <div className="flex items-start gap-3">
                  <MapPin className="text-yellow-500 flex-shrink-0 mt-1" size={20} />
                  <span>{store.alamat}</span>
                </div>
              )}
              {store.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="text-yellow-500" size={20} />
                  <span>{store.phone}</span>
                </div>
              )}
              {store.email && (
                <div className="flex items-center gap-3">
                  <Mail className="text-yellow-500" size={20} />
                  <span>{store.email}</span>
                </div>
              )}
              {!store.alamat && !store.phone && !store.email && (
                <p className="text-gray-500">Belum ada informasi kontak untuk store ini.</p>
              )}
            </div>
          </div>
          
          {/* Form Kontak */}
          <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-display mb-4">Kirim Pesan ke {store.name}</h2>
            <ContactForm storeId={store.id} storeName={store.name} />
          </div>
        </div>
      </div>
    </div>
  );
}