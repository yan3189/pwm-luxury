// ========== FILE: src/pages/MemberLogin.jsx ==========
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function MemberLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    
    // Cek role dari tabel users
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();
    
    if (userData?.role === 'member') {
      navigate('/member/dashboard');
    } else {
      setError('Akun ini bukan akun member');
      await supabase.auth.signOut();
    }
    
    setLoading(false);
  };
  
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="flex items-center justify-center px-4 py-24">
        <div className="bg-gray-900/80 p-8 rounded-2xl w-full max-w-md border border-white/10">
          <h2 className="text-2xl font-display text-center mb-6">Login Member</h2>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-4" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-6" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" disabled={loading} className="w-full bg-yellow-500 text-black font-bold py-3 rounded-full disabled:opacity-50">
              {loading ? 'Memproses...' : 'Login'}
            </button>
          </form>
          <p className="text-center text-gray-400 text-sm mt-4">
            Belum punya akun? <Link to="/member/register" className="text-yellow-400">Daftar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}