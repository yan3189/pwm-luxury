// ========== FILE: src/pages/OrderSuccessPage.jsx ==========
// Halaman setelah checkout berhasil
import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { CheckCircle, Copy, ArrowRight } from 'lucide-react';

export default function OrderSuccessPage() {
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Ambil data order dari state navigation (dikirim dari CheckoutPage)
    const orderData = location.state?.order;
    if (orderData) {
      setOrder(orderData);
      fetchStore(orderData.store_id);
    } else {
      // Jika tidak ada state, redirect ke beranda
      window.location.href = '/';
    }
  }, [location]);

  const fetchStore = async (storeId) => {
    const { data, error } = await supabase
      .from('stores')
      .select('name, bank_name, bank_account_number, bank_account_name')
      .eq('id', storeId)
      .single();
    if (!error && data) {
      setStore(data);
    }
    setLoading(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-black min-h-screen text-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">Loading...</div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-24">
        {/* Icon sukses */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border border-green-500">
            <CheckCircle size={48} className="text-green-500" />
          </div>
        </div>

        <h1 className="text-2xl font-display text-center mb-2">Pesanan Berhasil!</h1>
        <p className="text-gray-400 text-center mb-8">
          Terima kasih telah berbelanja di {store?.name || 'toko kami'}
        </p>

        {/* Info Order */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10 mb-6">
          <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
            <span className="text-gray-400">Nomor Order</span>
            <span className="font-mono font-bold">{order.order_number}</span>
          </div>
          <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
            <span className="text-gray-400">Total Pembayaran</span>
            <span className="text-yellow-500 text-xl font-bold">
              Rp {order.total_amount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Status</span>
            <span className="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full text-xs">Menunggu Pembayaran</span>
          </div>
        </div>

        {/* Info Rekening */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="font-semibold mb-3">Transfer ke Rekening Berikut:</h2>
          <div className="space-y-3">
            <div>
              <p className="text-gray-400 text-sm">Bank</p>
              <p className="font-medium">{store?.bank_name || 'BCA'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Nomor Rekening</p>
              <div className="flex items-center gap-2">
                <p className="font-mono font-bold">{store?.bank_account_number || '1234567890'}</p>
                <button 
                  onClick={() => copyToClipboard(store?.bank_account_number || '1234567890')}
                  className="text-yellow-500 hover:text-yellow-400"
                >
                  <Copy size={16} />
                </button>
              </div>
              {copied && <p className="text-green-500 text-xs mt-1">Tersalin!</p>}
            </div>
            <div>
              <p className="text-gray-400 text-sm">Atas Nama</p>
              <p className="font-medium">{store?.bank_account_name || 'PWM Store'}</p>
            </div>
          </div>
        </div>

        {/* Instruksi */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10 mb-8">
          <h2 className="font-semibold mb-3">Instruksi Pembayaran:</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
            <li>Transfer sesuai total di atas ke rekening yang tertera</li>
            <li>Upload bukti transfer di halaman detail pesanan</li>
            <li>Admin akan mengkonfirmasi pembayaran</li>
            <li>Pesanan akan diproses setelah pembayaran dikonfirmasi</li>
          </ol>
        </div>

        {/* Tombol Aksi */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/member/orders"
            className="bg-yellow-500 text-black font-semibold py-3 px-6 rounded-full text-center hover:bg-yellow-600 transition inline-flex items-center justify-center gap-2"
          >
            Lihat Pesanan Saya <ArrowRight size={18} />
          </Link>
          <Link
            to="/"
            className="border border-white/20 hover:bg-white/10 py-3 px-6 rounded-full text-center transition"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}