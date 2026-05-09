// ========== HALAMAN DAFTAR STORE ==========
import Navbar from '../components/Navbar';

export default function StoresPage() {
  const stores = [] 
  // sama seperti dummyStores, bisa ditambah
  return (
    <div className="bg-black min-h-screen pt-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-display">Semua Store</h1>
        {/* grid card store lagi */}
      </div>
    </div>
  );
}