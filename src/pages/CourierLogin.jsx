// ========== FILE: src/pages/CourierLogin.jsx ==========
// Login khusus kurir – hanya email & password
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogIn } from 'lucide-react';

export default function CourierLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) throw authError;

      // 2. Cek role courier
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (userError) throw new Error('Gagal memeriksa akun');

      if (userData.role !== 'courier') {
        await supabase.auth.signOut();
        throw new Error('Akun ini bukan kurir. Gunakan akun kurir.');
      }

      // 3. Redirect ke dashboard
      navigate('/courier/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black min-h-screen flex items-center justify-center px-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-white/10">
        <h1 className="text-2xl font-display text-center text-yellow-500 mb-6">Kurir Login</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full p-3 rounded-lg bg-black/50 border border-white/20 text-white"
              placeholder="kurir@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full p-3 rounded-lg bg-black/50 border border-white/20 text-white"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 text-black py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-yellow-600 transition disabled:opacity-50"
          >
            <LogIn size={18} /> {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}