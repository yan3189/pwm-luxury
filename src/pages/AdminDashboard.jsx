// ========== FILE: src/pages/AdminDashboard.jsx ==========
// Dashboard utama: preview 5 produk & 5 news terbaru, dengan tombol ke halaman khusus
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Package, Newspaper, Edit, ExternalLink } from 'lucide-react'

export default function AdminDashboard() {
  const [store, setStore] = useState(null)
  const [recentProducts, setRecentProducts] = useState([])
  const [recentNews, setRecentNews] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/admin/login')
      return
    }
    const { data: userData } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', user.id)
      .single()
    
    if (userData?.store_id) {
      fetchDashboardData(userData.store_id)
    } else {
      setLoading(false)
    }
  }

  const fetchDashboardData = async (storeId) => {
    // Ambil info store
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()
    setStore(storeData)

    // Ambil 5 produk terbaru
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentProducts(productsData || [])

    // Ambil 5 news terbaru
    const { data: newsData } = await supabase
      .from('news')
      .select('*')
      .eq('store_id', storeId)
      .order('published_at', { ascending: false })
      .limit(5)
    setRecentNews(newsData || [])

    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display">Dashboard Store</h1>
            {store && <p className="text-gray-400">{store.name}</p>}
          </div>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-full text-sm">Logout</button>
        </div>

        {/* Grid: Preview Produk dan News */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ========== PREVIEW PRODUK ========== */}
          <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-yellow-500" />
                <h2 className="text-xl font-display">Produk Terbaru</h2>
              </div>
              <button 
                onClick={() => navigate('/admin/products')}
                className="text-yellow-500 text-sm flex items-center gap-1 hover:gap-2 transition-all"
              >
                Kelola Semua <ExternalLink size={14} />
              </button>
            </div>
            
            {recentProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Belum ada produk. <button onClick={() => navigate('/admin/products')} className="text-yellow-500">Tambah sekarang</button></p>
            ) : (
              <div className="space-y-2">
                {recentProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-yellow-500 text-sm">Rp {p.price.toLocaleString()}</p>
                    </div>
                    <button 
                      onClick={() => navigate('/admin/products')}
                      className="text-gray-400 hover:text-yellow-500"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                ))}
                {recentProducts.length >= 5 && (
                  <p className="text-center text-gray-500 text-sm mt-2">...dan seterusnya</p>
                )}
              </div>
            )}
          </div>

          {/* ========== PREVIEW NEWS ========== */}
          <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Newspaper size={20} className="text-yellow-500" />
                <h2 className="text-xl font-display">Artikel Terbaru</h2>
              </div>
              <button 
                onClick={() => navigate('/admin/news')}
                className="text-yellow-500 text-sm flex items-center gap-1 hover:gap-2 transition-all"
              >
                Kelola Semua <ExternalLink size={14} />
              </button>
            </div>
            
            {recentNews.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Belum ada artikel. <button onClick={() => navigate('/admin/news')} className="text-yellow-500">Tambah sekarang</button></p>
            ) : (
              <div className="space-y-2">
                {recentNews.map(n => (
                  <div key={n.id} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                    <div>
                      <p className="font-medium line-clamp-1">{n.title}</p>
                      <p className="text-gray-400 text-xs">{new Date(n.published_at).toLocaleDateString('id-ID')}</p>
                    </div>
                    <button 
                      onClick={() => navigate('/admin/news')}
                      className="text-gray-400 hover:text-yellow-500"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                ))}
                {recentNews.length >= 5 && (
                  <p className="text-center text-gray-500 text-sm mt-2">...dan seterusnya</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tombol edit store (opsional, nanti bisa ditambah upload logo) */}
        <div className="mt-8 text-center">
          <button 
            onClick={() => alert('Fitur edit store akan menyusul')}
            className="border border-white/20 hover:border-yellow-500 px-6 py-2 rounded-full text-sm transition"
          >
            Edit Profil Store
          </button>
        </div>
      </div>
    </div>
  )
}