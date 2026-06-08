// ========== FILE: src/pages/MemberLogin.jsx ==========
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { signInWithGoogle } from '../services/authService';

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

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      // Redirect otomatis ditangani oleh Supabase
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <div className="flex items-center justify-center px-4 py-24">
        <div className="bg-gray-900/80 p-8 rounded-2xl w-full max-w-md border border-white/10">
          <h2 className="text-2xl font-display text-center mb-6">Login Member</h2>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          
          <form onSubmit={handleLogin}>
            <input 
              type="email" 
              placeholder="Email" 
              className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-4" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-6" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-yellow-500 text-black font-bold py-3 rounded-full disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Login'}
            </button>
          </form>

          {/* Separator */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-400">Atau</span>
            </div>
          </div>

          {/* Tombol Login dengan Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Login dengan Google</span>
          </button>

          <p className="text-center text-gray-400 text-sm mt-4">
            Belum punya akun? <Link to="/member/register" className="text-yellow-400">Daftar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}