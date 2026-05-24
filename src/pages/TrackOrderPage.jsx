// ========== FILE: src/pages/TrackOrderPage.jsx ==========
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { Package, MapPin, Calendar, CheckCircle, AlertCircle, Truck, Download, ArrowLeft, Upload, MessageCircle } from 'lucide-react';

export default function TrackOrderPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrder();
    } else {
      setError('ID pesanan tidak ditemukan di URL');
      setLoading(false);
    }
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    
    // Step 1: Ambil order berdasarkan ID
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (orderError || !orderData) {
      console.error('Order error:', orderError);
      setError('Pesanan tidak ditemukan');
      setLoading(false);
      return;
    }
    
    setOrder(orderData);
    
    // Step 2: Ambil info store
    if (orderData.store_id) {
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, name, slug, bank_name, bank_account_number, bank_account_name, phone, alamat')
        .eq('id', orderData.store_id)
        .single();
      
      if (!storeError && storeData) {
        setStore(storeData);
      }
    }
    
    // Step 3: Ambil items
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);
    
    if (itemsError) {
      console.error('Items error:', itemsError);
    }
    setItems(itemsData || []);
    
    setLoading(false);
  };

  const handleUploadProof = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file maksimal 2MB');
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${order.order_number}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      alert('Gagal upload: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        payment_proof_url: publicUrlData.publicUrl,
        status: 'paid'
      })
      .eq('id', id);

    if (updateError) {
      alert('Gagal menyimpan bukti: ' + updateError.message);
    } else {
      alert('Bukti transfer berhasil diupload! Admin akan segera memverifikasi.');
      fetchOrder();
    }
    setUploading(false);
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-500',
      paid: 'bg-blue-500/20 text-blue-400',
      processing: 'bg-purple-500/20 text-purple-400',
      shipping: 'bg-orange-500/20 text-orange-400',
      delivered: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400'
    };
    const labels = {
      pending: 'Menunggu Pembayaran',
      paid: 'Dibayar (Menunggu Konfirmasi)',
      processing: 'Diproses',
      shipping: 'Dikirim',
      delivered: 'Selesai',
      cancelled: 'Dibatalkan'
    };
    return <span className={`text-xs px-2 py-1 rounded-full ${colors[status] || colors.pending}`}>{labels[status] || status}</span>;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link pesanan disalin!');
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  
  if (error) return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="flex flex-col items-center justify-center p-8 pt-32">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-display mb-2">Pesanan Tidak Ditemukan</h1>
        <p className="text-gray-400 mb-4 text-center">{error}</p>
        <p className="text-gray-500 text-sm mb-4">ID: {id}</p>
        <Link to="/" className="bg-yellow-500 text-black px-4 py-2 rounded-full">Kembali ke Beranda</Link>
      </div>
    </div>
  );
  
  if (!order) return null;

  const canUpload = order.status === 'pending' && !order.payment_proof_url;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-24">
        <Link to="/" className="inline-flex items-center gap-1 text-yellow-500 mb-6 hover:gap-2 transition">
          <ArrowLeft size={16} /> Kembali ke Beranda
        </Link>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-display">Pesanan #{order.order_number}</h1>
              <p className="text-gray-400">{store?.name}</p>
              <p className="text-xs text-gray-500 mt-1">ID: {order.id}</p>
            </div>
            {getStatusBadge(order.status)}
          </div>

          {/* Info Pemesan */}
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
            <h2 className="font-semibold text-sm mb-2">Informasi Pemesan</h2>
            <p className="text-sm">{order.guest_name || 'Guest'}</p>
            <p className="text-sm text-gray-400">{order.guest_phone}</p>
            <p className="text-sm text-gray-400 mt-1">{order.shipping_address}</p>
          </div>

          {/* Produk */}
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
            <h2 className="font-semibold text-sm mb-2">Produk Dipesan</h2>
            <div className="space-y-1">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.product_name} x{item.quantity}</span>
                  <span>Rp {item.total?.toLocaleString() || item.subtotal?.toLocaleString() || 0}</span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-2 mt-2 font-bold flex justify-between">
                <span>Total</span>
                <span>Rp {order.total_amount?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>

          {/* Pembayaran & Upload */}
          <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30 mb-4">
            <h3 className="font-semibold text-yellow-500 mb-2">Instruksi Pembayaran</h3>
            <p className="text-sm">Transfer ke rekening berikut:</p>
            <div className="bg-gray-800 rounded-lg p-3 mt-2">
              <p className="font-mono text-sm">{store?.bank_name || 'BCA'}</p>
              <p className="font-mono text-lg font-bold">{store?.bank_account_number || '1234567890'}</p>
              <p className="text-sm">a.n. {store?.bank_account_name || 'PWM Store'}</p>
            </div>
            <p className="text-sm mt-2">Nominal: <span className="font-bold text-yellow-500">Rp {order.total_amount?.toLocaleString() || 0}</span></p>
            
            {canUpload && (
              <div className="mt-4">
                <label className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-lg cursor-pointer hover:bg-yellow-600 transition w-fit">
                  <Upload size={16} />
                  {uploading ? 'Mengupload...' : 'Upload Bukti Transfer'}
                  <input type="file" accept="image/*" onChange={handleUploadProof} disabled={uploading} className="hidden" />
                </label>
                <p className="text-xs text-gray-400 mt-2">Format: JPG, PNG (max 2MB)</p>
              </div>
            )}

            {order.payment_proof_url && (
              <div className="mt-4">
                <p className="text-green-500 text-sm flex items-center gap-1"><CheckCircle size={14} /> Bukti sudah diupload</p>
                <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-yellow-500 text-sm underline flex items-center gap-1 mt-1">
                  <Download size={14} /> Lihat bukti transfer
                </a>
              </div>
            )}
          </div>

          {/* WhatsApp ke Customer */}
          {order.guest_phone && (
            <div className="mt-4 text-center border-t border-white/10 pt-4">
              <p className="text-sm text-gray-400 mb-3">Simpan link pesanan Anda:</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={copyToClipboard}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition"
                >
                  📋 Salin Link Pesanan
                </button>
                <a
                  href={`https://wa.me/${order.guest_phone.replace(/[^0-9]/g, '')}?text=Halo%2C%20pesanan%20saya%20dengan%20nomor%20%23${order.order_number}%0A%0ALink%20pelacakan%3A%20${window.location.href}%0A%0ATotal%3A%20Rp%20${order.total_amount.toLocaleString()}%0AStatus%3A%20${order.status}%0A%0ATerima%20kasih.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition justify-center"
                >
                  <MessageCircle size={16} /> Kirim Link ke WhatsApp Saya
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}