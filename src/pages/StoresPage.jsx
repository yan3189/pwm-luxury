// ========== HALAMAN DAFTAR STORE SEMENTARA ==========
import Navbar from '../components/Navbar';
import { MapPin, Star } from 'lucide-react';

export default function StoresPage() {
  const stores = [
    { id: 1, name: 'PWM Senayan City', location: 'Jakarta Selatan', image: 'https://picsum.photos/id/104/400/300', rating: 4.8 },
    { id: 2, name: 'PWM Kelapa Gading', location: 'Jakarta Utara', image: 'https://picsum.photos/id/106/400/300', rating: 4.7 },
    { id: 3, name: 'PWM Surabaya', location: 'Surabaya Timur', image: 'https://picsum.photos/id/108/400/300', rating: 4.9 },
  ];

  return (
    <div className="bg-black min-h-screen pt-24">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-4xl font-display font-bold mb-8">Semua Store Partner</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stores.map((store) => (
            <div key={store.id} className="bg-gray-900/50 rounded-2xl overflow-hidden border border-white/10">
              <img src={store.image} alt={store.name} className="w-full h-48 object-cover" />
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-bold">{store.name}</h2>
                  <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full">
                    <Star size={14} className="text-yellow-400 fill-yellow-400" /> {store.rating}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-gray-400 text-sm mt-1">
                  <MapPin size={14} /> {store.location}
                </div>
                <button className="mt-4 w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 rounded-full transition">
                  Kunjungi
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}