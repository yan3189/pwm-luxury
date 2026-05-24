// ========== FILE: src/pages/AdminLogin.jsx ==========
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    // Login ke Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    
    const userId = authData.user.id
    
    // Cari di tabel users berdasarkan ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, store_id')
      .eq('id', userId)
      .maybeSingle()
    
    if (userError) {
      setError('Error query user: ' + userError.message)
      setLoading(false)
      return
    }
    
    // Izinkan store_admin DAN super_admin untuk mengakses dashboard
    if (userData?.role === 'store_admin' || userData?.role === 'super_admin') {
      navigate('/admin/dashboard')
    } else {
      setError(`Akun ini bukan admin store atau super admin. Role yang terdeteksi: ${userData?.role || 'tidak ada'}`)
      await supabase.auth.signOut()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="bg-gray-900/80 p-8 rounded-2xl w-full max-w-md border border-white/10">
        <h2 className="text-2xl font-display text-center mb-6">Login Admin Store</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={handleLogin}>
          <input 
            type="email" 
            placeholder="Email" 
            className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-4 text-white" 
            value={email} 
            onChange={e=>setEmail(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-6 text-white" 
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
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
        <p className="text-center text-gray-400 text-sm mt-4">
          Hanya untuk admin store dan super admin
        </p>
      </div>
    </div>
  )
}