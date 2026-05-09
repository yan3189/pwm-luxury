// ========== HALAMAN DETAIL STORE SEMENTARA ==========
import Navbar from '../components/Navbar';
import { useParams } from 'react-router-dom';

export default function StoreDetailPage() {
  const { slug } = useParams();
  return (
    <div className="bg-black min-h-screen pt-24">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-3xl font-display">Detail Store: {slug}</h1>
        <p className="text-gray-400 mt-4">Halaman ini akan menampilkan produk, info, dan fitur store.</p>
      </div>
    </div>
  );
}