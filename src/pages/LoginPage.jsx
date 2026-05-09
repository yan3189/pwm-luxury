// ========== HALAMAN LOGIN SEMENTARA ==========
import Navbar from '../components/Navbar';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Fungsi login akan segera terhubung ke Supabase');
  };

  return (
    <div className="bg-black min-h-screen pt-24">
      <Navbar />
      <div className="flex items-center justify-center px-4">
        <div className="bg-gray-900/70 backdrop-blur-lg p-8 rounded-2xl w-full max-w-md border border-white/10">
          <h2 className="text-2xl font-display text-center mb-6">Login Member</h2>
          <form onSubmit={handleSubmit}>
            <input type="email" placeholder="Email" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 text-white mb-4" value={email} onChange={e=>setEmail(e.target.value)} />
            <input type="password" placeholder="Password" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 text-white mb-6" value={password} onChange={e=>setPassword(e.target.value)} />
            <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-full transition">Masuk</button>
          </form>
          <p className="text-center text-gray-400 text-sm mt-4">Belum punya akun? <a href="#" className="text-yellow-400">Daftar</a></p>
        </div>
      </div>
    </div>
  );
}