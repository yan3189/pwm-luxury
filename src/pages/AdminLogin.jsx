import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    
    // Login ke Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      return
    }
    
    const userId = authData.user.id
    console.log('User ID dari auth:', userId)
    
    // Cari di tabel users berdasarkan ID (bukan email)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, store_id')
      .eq('id', userId)
      .maybeSingle()
    
    console.log('Data dari tabel users:', userData)
    
    if (userError) {
      setError('Error query user: ' + userError.message)
      return
    }
    
    if (userData?.role === 'store_admin') {
      // Simpan store_id ke session/local storage jika perlu
      navigate('/admin/dashboard')
    } else {
      setError(`Akun ini bukan admin store. Role yang terdeteksi: ${userData?.role || 'tidak ada'}. Pastikan di tabel users, id = ${userId} dan role = store_admin.`)
      await supabase.auth.signOut()
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="bg-gray-900/80 p-8 rounded-2xl w-full max-w-md border border-white/10">
        <h2 className="text-2xl font-display text-center mb-6">Login Admin Store</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Email" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-4 text-white" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full p-3 rounded-lg bg-black/50 border border-white/20 mb-6 text-white" value={password} onChange={e=>setPassword(e.target.value)} required />
          <button type="submit" className="w-full bg-yellow-500 text-black font-bold py-3 rounded-full">Login</button>
        </form>
      </div>
    </div>
  )
}