// ========== FILE: src/pages/AdminDashboard.jsx ==========
// Dashboard admin dengan preview: produk, news, event, dan member (masing-masing 3 item terbaru)
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Package, Newspaper, Calendar, Users, Edit, ExternalLink } from 'lucide-react'

export default function AdminDashboard() {
  const [store, setStore] = useState(null)
  const [recentProducts, setRecentProducts] = useState([])
  const [recentNews, setRecentNews] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [recentMembers, setRecentMembers] = useState([])
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

    // Ambil 3 produk terbaru
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentProducts(productsData || [])

    // Ambil 3 news terbaru
    const { data: newsData } = await supabase
      .from('news')
      .select('*')
      .eq('store_id', storeId)
      .order('published_at', { ascending: false })
      .limit(3)
    setRecentNews(newsData || [])

    // Ambil 3 event terbaru (berdasarkan tanggal terdekat)
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: true })
      .limit(3)
    setRecentEvents(eventsData || [])

    // Ambil 3 member terbaru (dari semua store, role = member)
    const { data: membersData } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'member')
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentMembers(membersData || [])

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display">Dashboard Store</h1>
            {store && <p className="text-gray-400">{store.name}</p>}
          </div>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-full text-sm">Logout</button>
        </div>

        {/* Grid: 4 kolom untuk preview (produk, news, event, member) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* ========== 1. PREVIEW PRODUK (3 item) ========== */}
          <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-yellow-500" />
                <h2 className="text-xl font-display">Produk</h2>
              </div>
              <button onClick={() => navigate('/admin/products')} className="text-yellow-500 text-sm flex items-center gap-1 hover:gap-2 transition-all">
                Kelola <ExternalLink size={12} />
              </button>
            </div>
            {recentProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-6 text-sm">Belum ada produk</p>
            ) : (
              <div className="space-y-2">
                {recentProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                    <div>
                      <p className="font-medium text-sm line-clamp-1">{p.name}</p>
                      <p className="text-yellow-500 text-xs">Rp {p.price.toLocaleString()}</p>
                    </div>
                    <button onClick={() => navigate('/admin/products')} className="text-gray-400 hover:text-yellow-500">
                      <Edit size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========== 2. PREVIEW NEWS (3 item) ========== */}
          <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Newspaper size={20} className="text-yellow-500" />
                <h2 className="text-xl font-display">Artikel</h2>
              </div>
              <button onClick={() => navigate('/admin/news')} className="text-yellow-500 text-sm flex items-center gap-1 hover:gap-2 transition-all">
                Kelola <ExternalLink size={12} />
              </button>
            </div>
            {recentNews.length === 0 ? (
              <p className="text-gray-500 text-center py-6 text-sm">Belum ada artikel</p>
            ) : (
              <div className="space-y-2">
                {recentNews.map(n => (
                  <div key={n.id} className="p-2 bg-white/5 rounded-lg">
                    <p className="font-medium text-sm line-clamp-1">{n.title}</p>
                    <p className="text-gray-400 text-xs">{new Date(n.published_at).toLocaleDateString('id-ID')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========== 3. PREVIEW EVENT (3 item) ========== */}
          <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-yellow-500" />
                <h2 className="text-xl font-display">Event</h2>
              </div>
              <button onClick={() => navigate('/admin/events')} className="text-yellow-500 text-sm flex items-center gap-1 hover:gap-2 transition-all">
                Kelola <ExternalLink size={12} />
              </button>
            </div>
            {recentEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-6 text-sm">Belum ada event</p>
            ) : (
              <div className="space-y-2">
                {recentEvents.map(e => (
                  <div key={e.id} className="p-2 bg-white/5 rounded-lg">
                    <p className="font-medium text-sm line-clamp-1">{e.title}</p>
                    <p className="text-gray-400 text-xs">{new Date(e.date).toLocaleDateString('id-ID')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========== 4. PREVIEW MEMBER (3 item) ========== */}
          <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-yellow-500" />
                <h2 className="text-xl font-display">Member</h2>
              </div>
              <button onClick={() => navigate('/admin/members')} className="text-yellow-500 text-sm flex items-center gap-1 hover:gap-2 transition-all">
                Kelola <ExternalLink size={12} />
              </button>
            </div>
            {recentMembers.length === 0 ? (
              <p className="text-gray-500 text-center py-6 text-sm">Belum ada member</p>
            ) : (
              <div className="space-y-2">
                {recentMembers.map(m => (
                  <div key={m.id} className="p-2 bg-white/5 rounded-lg">
                    <p className="font-medium text-sm line-clamp-1">{m.full_name || m.email}</p>
                    <p className="text-gray-400 text-xs">{m.points || 0} poin</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}