import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function AdminContacts() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/admin/login');
      return;
    }
    const { data: userData } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', user.id)
      .single();
    if (userData?.store_id) {
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('id', userData.store_id)
        .single();
      setStore(storeData);
      fetchMessages(userData.store_id);
    } else {
      // super admin? bisa lihat semua pesan
      fetchMessages(null);
    }
  };

  const fetchMessages = async (storeId) => {
    let query = supabase
      .from('contact_messages')
      .select('*, stores(name)')
      .order('created_at', { ascending: false });
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    const { data, error } = await query;
    if (error) console.error(error);
    else setMessages(data || []);
    setLoading(false);
  };

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display">Pesan Masuk</h1>
          <button onClick={() => navigate('/admin/dashboard')} className="bg-gray-700 px-4 py-2 rounded-full text-sm">Kembali</button>
        </div>
        <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 border-b border-white/10">
              <tr><th className="p-3">Tanggal</th><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Pesan</th><th className="p-3">Store</th></tr>
            </thead>
            <tbody>
              {messages.map(m => (
                <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-sm">{new Date(m.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="p-3 font-medium">{m.name}</td>
                  <td className="p-3">{m.email}</td>
                  <td className="p-3 line-clamp-2">{m.message}</td>
                  <td className="p-3 text-sm">{m.stores?.name || 'Umum'}</td>
                </tr>
              ))}
              {messages.length === 0 && <tr><td colSpan="5" className="p-3 text-center">Belum ada pesan</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}