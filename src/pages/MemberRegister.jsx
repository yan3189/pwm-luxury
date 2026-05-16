// ========== FILE: src/pages/MemberRegister.jsx ==========
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function MemberRegister() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Password tidak cocok');
      return;
    }
    
    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }
    
    setLoading(true);
    
    // 1. Daftar ke Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    
    // 2. Simpan data member ke tabel users
    if (authData.user) {
      const { error: userError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: email,
            full_name: fullName,
            role: 'member',
            points: 0,
          },
        ]);
      
      if (userError) {
        console.error('Error saving user:', userError);
        // Tetap lanjut meskipun ada error (user sudah terdaftar di auth)
      }
    }
    
    setLoading(false);
    alert('Pendaftaran berhasil! Silakan login.');
    navigate('/member/login');
  };
  
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="flex items-center justify-center px-4 py-24">
        <div className="bg-gray-900/80 p-8 rounded-2xl w-full max-w-md border border-white/10">
          <h2 className="text-2xl font-display text-center mb-6">Daftar Member</h2>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <form onSubmit={handleRegister}>
            <input type="text" placeholder="Nama Lengkap" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-4" value={fullName} onChange={e => setFullName(e.target.value)} required />
            <input type="email" placeholder="Email" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-4" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password (min. 6 karakter)" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-4" value={password} onChange={e => setPassword(e.target.value)} required />
            <input type="password" placeholder="Konfirmasi Password" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-6" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            <button type="submit" disabled={loading} className="w-full bg-yellow-500 text-black font-bold py-3 rounded-full disabled:opacity-50">
              {loading ? 'Memproses...' : 'Daftar'}
            </button>
          </form>
          <p className="text-center text-gray-400 text-sm mt-4">
            Sudah punya akun? <Link to="/member/login" className="text-yellow-400">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}