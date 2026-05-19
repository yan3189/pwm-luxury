// ========== FILE: src/pages/ContactPage.jsx ==========
// Halaman kontak umum
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ContactForm from '../components/ContactForm';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-24">
        <h1 className="text-3xl font-display mb-2">Hubungi Kami</h1>
        <p className="text-gray-400 mb-8">Punya pertanyaan atau saran? Silakan isi formulir di bawah.</p>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Info Kontak */}
          <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-display mb-4">Informasi Kontak</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <MapPin className="text-yellow-500" size={20} />
                <span>Jakarta, Indonesia</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="text-yellow-500" size={20} />
                <span>hello@pwm.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="text-yellow-500" size={20} />
                <span>+62 812 3456 7890</span>
              </div>
            </div>
          </div>
          
          {/* Form Kontak */}
          <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-display mb-4">Kirim Pesan</h2>
            <ContactForm storeId={null} storeName={null} />
          </div>
        </div>
      </div>
    </div>
  );
}