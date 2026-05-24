// ========== FILE: src/pages/MemberOrderDetail.jsx ==========
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { ArrowLeft, MapPin, Calendar, Package, Upload, CheckCircle, AlertCircle, Download } from 'lucide-react';

export default function MemberOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    
    // Step 1: Ambil order berdasarkan ID
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (orderError || !orderData) {
      console.error('Order error:', orderError);
      setLoading(false);
      return;
    }
    
    setOrder(orderData);
    
    // Step 2: Ambil store berdasarkan store_id
    if (orderData.store_id) {
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, name, slug, bank_name, bank_account_number, bank_account_name, phone, email, alamat')
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
    
    // Step 4: Ambil alamat dari member_addresses (jika ada address_id)
    if (orderData.address_id) {
      const { data: addressData, error: addressError } = await supabase
        .from('member_addresses')
        .select('*')
        .eq('id', orderData.address_id)
        .single();
      
      if (!addressError && addressData) {
        setAddress(addressData);
      }
    }
    
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
      .upload(fileName, file);

    if (uploadError) {
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

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  if (!order) return <div className="bg-black min-h-screen text-white p-8 text-center">Pesanan tidak ditemukan</div>;

  const canUpload = order.status === 'pending' && !order.payment_proof_url;

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <Link to="/member/orders" className="inline-flex items-center gap-1 text-yellow-500 mb-6 hover:gap-2 transition">
          <ArrowLeft size={16} /> Kembali ke Pesanan
        </Link>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-display">Pesanan #{order.order_number}</h1>
              <p className="text-gray-400">{store?.name}</p>
            </div>
            {getStatusBadge(order.status)}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h2 className="font-semibold flex items-center gap-2 mb-2"><Package size={16} /> Produk</h2>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.product_name} x{item.quantity}</span>
                    <span>Rp {item.total?.toLocaleString() || item.subtotal?.toLocaleString() || 0}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2 mt-2 font-bold flex justify-between">
                  <span>Subtotal</span>
                  <span>Rp {(order.total_amount - (order.shipping_cost || 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Ongkos Kirim</span>
                  <span>Rp {(order.shipping_cost || 0).toLocaleString()}</span>
                </div>
                <div className="border-t border-white/10 pt-2 mt-2 font-bold flex justify-between">
                  <span>Total</span>
                  <span>Rp {order.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold flex items-center gap-2 mb-2"><MapPin size={16} /> Alamat Pengiriman</h2>
              {address ? (
                <div className="text-sm space-y-1">
                  <p className="font-medium">{address.label}</p>
                  <p className="text-gray-400">{address.address_text}</p>
                </div>
              ) : order.shipping_address ? (
                <div className="text-sm">
                  {order.guest_name && <p className="font-medium">{order.guest_name}</p>}
                  {order.guest_phone && <p className="text-gray-400 text-xs">Telp: {order.guest_phone}</p>}
                  <p className="text-gray-400 mt-1">{order.shipping_address}</p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Alamat tidak tersedia</p>
              )}
              
              <h2 className="font-semibold flex items-center gap-2 mt-4 mb-2"><Calendar size={16} /> Tanggal Pesan</h2>
              <p className="text-sm text-gray-400">{new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Upload Bukti Transfer */}
          <div className="mt-6 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
            <h3 className="font-semibold text-yellow-500 mb-2">Instruksi Pembayaran</h3>
            <p className="text-sm">Transfer ke rekening berikut:</p>
            <div className="bg-gray-800 rounded-lg p-3 mt-2">
              <p className="font-mono text-sm">{store?.bank_name || 'BCA'}</p>
              <p className="font-mono text-lg font-bold">{store?.bank_account_number || '1234567890'}</p>
              <p className="text-sm">a.n. {store?.bank_account_name || 'PWM Store'}</p>
            </div>
            <p className="text-sm mt-2">Nominal: <span className="font-bold text-yellow-500">Rp {order.total_amount.toLocaleString()}</span></p>
            
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
        </div>
      </div>
    </div>
  );
}