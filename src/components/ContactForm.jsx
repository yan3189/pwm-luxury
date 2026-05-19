// ========== FILE: src/components/ContactForm.jsx ==========
// Form kontak reusable dengan autofill untuk member login
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ContactForm({ storeId, storeName }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Autofill jika member login
  useEffect(() => {
    const fetchMember = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabase
          .from('users')
          .select('full_name, email, phone')
          .eq('id', user.id)
          .single();
        if (member) {
          setForm({
            name: member.full_name || '',
            email: member.email || '',
            phone: member.phone || '',
            message: ''
          });
        }
      }
    };
    fetchMember();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: insertError } = await supabase
      .from('contact_messages')
      .insert([{
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.message,
        store_id: storeId || null,
        created_at: new Date().toISOString()
      }]);
    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess(true);
      setForm({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setSuccess(false), 4000);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="bg-green-500/20 border border-green-500 text-green-400 rounded-xl p-5 text-center">
        <p>✅ Pesan berhasil dikirim! Kami akan segera merespon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Nama Lengkap</label>
        <input type="text" name="name" required className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.name} onChange={handleChange} />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Email</label>
        <input type="email" name="email" required className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.email} onChange={handleChange} />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Nomor Telepon</label>
        <input type="tel" name="phone" className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.phone} onChange={handleChange} />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Pesan</label>
        <textarea name="message" rows="4" required className="w-full p-2 rounded bg-black/50 border border-white/20" value={form.message} onChange={handleChange} />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="w-full bg-yellow-500 text-black font-bold py-2 rounded-full disabled:opacity-50">
        {loading ? 'Mengirim...' : 'Kirim Pesan'}
      </button>
    </form>
  );
}