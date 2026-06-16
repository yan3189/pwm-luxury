// src/pages/AdminCreateUser.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Shield, Truck, User } from 'lucide-react';

export default function AdminCreateUser() {
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    role: 'member', // member, courier, store_admin
    store_id: '' // untuk store_admin
  });
  const [stores, setStores] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Cek role user yang sedang login
  useEffect(() => {
    checkUserRole();
    fetchStores();
  }, []);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/admin/login');
      return;
    }
    
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (!userData) {
      navigate('/admin/login');
      return;
    }
    
    setUserRole(userData.role);
    
    // Hanya super_admin dan store_admin yang bisa akses
    if (!['super_admin', 'store_admin'].includes(userData.role)) {
      navigate('/admin/dashboard');
      alert('Anda tidak memiliki akses ke halaman ini');
    }
  };

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('id, name')
      .order('name');
    
    if (!error && data) {
      setStores(data);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  
  // Validasi
  if (form.password !== form.confirmPassword) {
    setError('Password dan konfirmasi password tidak cocok');
    return;
  }
  
  if (form.password.length < 6) {
    setError('Password minimal 6 karakter');
    return;
  }
  
  if (form.role === 'store_admin' && !form.store_id) {
    setError('Pilih store untuk admin store');
    return;
  }
  
  // Super admin tidak bisa membuat akun super_admin
  if (form.role === 'super_admin') {
    setError('Anda tidak dapat membuat akun Super Admin');
    return;
  }
  
  // Store admin hanya bisa membuat member dan kurir
  if (userRole === 'store_admin' && !['member', 'courier'].includes(form.role)) {
    setError('Admin store hanya bisa membuat akun Member dan Kurir');
    return;
  }
  
  setLoading(true);
  
  try {
    // 1. Buat user di Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          phone: form.phone
        }
      }
    });
    
    if (authError) throw authError;
    
    // 2. Cek apakah user sudah ada di tabel users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', authData.user.id)
      .maybeSingle();
    
    let userError;
    
    if (existingUser) {
      // Jika sudah ada, UPDATE data
      console.log('User already exists, updating...');
      // UPDATE (tanpa updated_at)
const { error: updateError } = await supabase
  .from('users')
  .update({
    email: form.email,
    full_name: form.full_name,
    phone: form.phone || null,
    role: form.role,
    store_id: form.role === 'store_admin' ? form.store_id : null
    // HAPUS updated_at
  })
  .eq('id', authData.user.id);
      
      userError = updateError;
    } else {
      // Jika belum ada, INSERT baru
      console.log('User not found, inserting...');
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: form.email,
          full_name: form.full_name,
          phone: form.phone || null,
          role: form.role,
          store_id: form.role === 'store_admin' ? form.store_id : null,
          points: form.role === 'member' ? 0 : null
        });
      
      userError = insertError;
    }
    
    if (userError) throw userError;
    
    // Logout admin dan redirect ke login
await supabase.auth.signOut();
setSuccess(true);
// Redirect setelah delay
setTimeout(() => {
  navigate('/admin/login');
}, 2000);

    setSuccess(true);
    setForm({
      email: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      phone: '',
      role: 'member',
      store_id: ''
    });
    
    setTimeout(() => setSuccess(false), 5000);
    
  } catch (err) {
    console.error('Error creating user:', err);
    setError(err.message);
  }
  
  setLoading(false);
};

  // Tentukan role yang bisa dipilih berdasarkan role user
  const getAvailableRoles = () => {
    if (userRole === 'super_admin') {
      return [
        { value: 'member', label: 'Member', icon: <User size={16} /> },
        { value: 'courier', label: 'Kurir', icon: <Truck size={16} /> },
        { value: 'store_admin', label: 'Admin Store', icon: <Shield size={16} /> }
      ];
    } else {
      return [
        { value: 'member', label: 'Member', icon: <User size={16} /> },
        { value: 'courier', label: 'Kurir', icon: <Truck size={16} /> }
      ];
    }
  };

  if (!userRole) {
    return <div className="bg-black min-h-screen text-white p-8">Loading...</div>;
  }

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate('/admin/dashboard')}
            className="text-gray-400 hover:text-yellow-500 transition"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-display">Buat Akun Baru</h1>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-500/20 border border-green-500 text-green-400 rounded-lg p-3 mb-4 text-sm">
              ✅ Akun berhasil dibuat! Email konfirmasi telah dikirim.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tipe Akun</label>
              <div className="grid grid-cols-3 gap-2">
                {getAvailableRoles().map(role => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: role.value, store_id: '' })}
                    className={`p-3 rounded-lg border transition flex items-center justify-center gap-2 ${
                      form.role === role.value
                        ? 'border-yellow-500 bg-yellow-500/20 text-yellow-500'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    {role.icon}
                    <span className="text-sm">{role.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Nama Lengkap */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nama Lengkap</label>
              <input
                type="text"
                name="full_name"
                required
                className="w-full p-2 rounded bg-black/50 border border-white/20"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Nama lengkap user"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                name="email"
                required
                className="w-full p-2 rounded bg-black/50 border border-white/20"
                value={form.email}
                onChange={handleChange}
                placeholder="email@example.com"
              />
            </div>

            {/* Nomor HP */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nomor HP</label>
              <input
                type="tel"
                name="phone"
                className="w-full p-2 rounded bg-black/50 border border-white/20"
                value={form.phone}
                onChange={handleChange}
                placeholder="08123456789"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                name="password"
                required
                className="w-full p-2 rounded bg-black/50 border border-white/20"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimal 6 karakter"
              />
            </div>

            {/* Konfirmasi Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Konfirmasi Password</label>
              <input
                type="password"
                name="confirmPassword"
                required
                className="w-full p-2 rounded bg-black/50 border border-white/20"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Ulangi password"
              />
            </div>

            {/* Store (khusus store_admin) */}
            {form.role === 'store_admin' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Pilih Store</label>
                <select
                  name="store_id"
                  required
                  className="w-full p-2 rounded bg-black/50 border border-white/20"
                  value={form.store_id}
                  onChange={handleChange}
                >
                  <option value="">-- Pilih Store --</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 text-black font-semibold py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              {loading ? 'Memproses...' : 'Buat Akun'}
            </button>
          </form>

          <div className="mt-4 text-xs text-gray-500 text-center">
            {userRole === 'super_admin' ? (
              <p>🔑 Super Admin: Dapat membuat semua jenis akun (Member, Kurir, Admin Store)</p>
            ) : (
              <p>🔑 Admin Store: Dapat membuat akun Member dan Kurir</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}