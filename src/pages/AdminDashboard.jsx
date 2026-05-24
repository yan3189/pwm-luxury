// ========== FILE: src/pages/AdminDashboard.jsx ==========
// Dashboard admin dengan preview: produk, news, event, member, pesan, dan pesanan
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { 
  Package, Newspaper, Calendar, Users, MessageCircle, 
  ShoppingBag, Edit, ExternalLink, Truck 
} from 'lucide-react'
import LocationPicker from '../components/LocationPicker'

export default function AdminDashboard() {
  // ========== STATE ==========
  const [store, setStore] = useState(null)
  const [recentProducts, setRecentProducts] = useState([])
  const [recentNews, setRecentNews] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [recentMembers, setRecentMembers] = useState([])
  const [recentMessages, setRecentMessages] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showStoreModal, setShowStoreModal] = useState(false)
  
  // State untuk form edit store
  const [storeForm, setStoreForm] = useState({
    name: '',
    description: '',
    logo: '',
    background_image: '',
    cover_image: '',
    video_preview: '',
    category: 'club',
    alamat: '',
    latitude: '',
    longitude: ''
  })
  
  const navigate = useNavigate()

  // ========== CEK USER LOGIN ==========
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

  // ========== AMBIL SEMUA DATA UNTUK DASHBOARD ==========
  const fetchDashboardData = async (storeId) => {
    // Ambil info store
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()
    setStore(storeData)
    
    // Isi form edit dengan data store yang ada
    if (storeData) {
      setStoreForm({
        name: storeData.name || '',
        description: storeData.description || '',
        logo: storeData.logo || '',
        background_image: storeData.background_image || '',
        cover_image: storeData.cover_image || '',
        video_preview: storeData.video_preview || '',
        category: storeData.category || 'club',
        alamat: storeData.alamat || '',
        latitude: storeData.latitude || '',
        longitude: storeData.longitude || ''
      })
    }

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

    // Ambil 3 event terbaru
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: true })
      .limit(3)
    setRecentEvents(eventsData || [])

    // Ambil 3 member terbaru
    const { data: membersData } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'member')
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentMembers(membersData || [])

    // Ambil 3 pesan terbaru
    const { data: messagesData } = await supabase
      .from('contact_messages')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentMessages(messagesData || [])

    // Ambil 3 pesanan terbaru
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentOrders(ordersData || [])

    setLoading(false)
  }

  // ========== LOGOUT ==========
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  // ========== UPDATE DATA STORE ==========
  const handleUpdateStore = async () => {
    if (!store) return
    
    const { error } = await supabase
      .from('stores')
      .update({
        name: storeForm.name,
        description: storeForm.description,
        logo: storeForm.logo,
        background_image: storeForm.background_image,
        cover_image: storeForm.cover_image,
        video_preview: storeForm.video_preview,
        category: storeForm.category,
        alamat: storeForm.alamat,
        latitude: storeForm.latitude ? parseFloat(storeForm.latitude) : null,
        longitude: storeForm.longitude ? parseFloat(storeForm.longitude) : null
      })
      .eq('id', store.id)
    
    if (error) {
      alert('Gagal update store: ' + error.message)
    } else {
      alert('Store berhasil diupdate')
      setShowStoreModal(false)
      // Refresh data store
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('id', store.id)
        .single()
      setStore(storeData)
      setStoreForm({
        name: storeData.name || '',
        description: storeData.description || '',
        logo: storeData.logo || '',
        background_image: storeData.background_image || '',
        cover_image: storeData.cover_image || '',
        video_preview: storeData.video_preview || '',
        category: storeData.category || 'club',
        alamat: storeData.alamat || '',
        latitude: storeData.latitude || '',
        longitude: storeData.longitude || ''
      })
    }
  }

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>

  // ========== RENDER TAMPILAN ==========
  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display">Dashboard Store</h1>
            {store && <p className="text-gray-400">{store.name}</p>}
          </div>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-full text-sm">Logout</button>
        </div>

        {/* TOMBOL EDIT STORE */}
        

<div className="mb-6 flex justify-end gap-3">
  <button 
    onClick={() => setShowStoreModal(true)}
    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-full text-sm transition"
  >
    <Edit size={16} /> Edit Profil Store
  </button>
  <button 
    onClick={() => navigate('/admin/shipping')}
    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-full text-sm transition"
  >
    <Truck size={16} /> Pengaturan Ongkir
  </button>

<button 
  onClick={() => navigate('/admin/store-categories')}
  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-full text-sm transition"
>
  <Package size={16} /> Atur Kategori Store
</button>
</div>


        {/* GRID PREVIEW (6 KOLOM) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          
          {/* 1. PRODUK */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-yellow-500" />
                <h2 className="text-lg font-display">Produk</h2>
              </div>
              <button onClick={() => navigate('/admin/products')} className="text-yellow-500 text-xs flex items-center gap-1 hover:gap-2 transition">
                Kelola <ExternalLink size={10} />
              </button>
            </div>
            {recentProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-xs">Belum ada produk</p>
            ) : (
              <div className="space-y-2">
                {recentProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-1 bg-white/5 rounded text-xs">
                    <span className="truncate">{p.name}</span>
                    <span className="text-yellow-500">Rp {p.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. ARTIKEL */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Newspaper size={18} className="text-yellow-500" />
                <h2 className="text-lg font-display">Artikel</h2>
              </div>
              <button onClick={() => navigate('/admin/news')} className="text-yellow-500 text-xs flex items-center gap-1 hover:gap-2 transition">
                Kelola <ExternalLink size={10} />
              </button>
            </div>
            {recentNews.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-xs">Belum ada artikel</p>
            ) : (
              <div className="space-y-2">
                {recentNews.map(n => (
                  <div key={n.id} className="p-1 bg-white/5 rounded text-xs">
                    <p className="truncate">{n.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. EVENT */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-yellow-500" />
                <h2 className="text-lg font-display">Event</h2>
              </div>
              <button onClick={() => navigate('/admin/events')} className="text-yellow-500 text-xs flex items-center gap-1 hover:gap-2 transition">
                Kelola <ExternalLink size={10} />
              </button>
            </div>
            {recentEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-xs">Belum ada event</p>
            ) : (
              <div className="space-y-2">
                {recentEvents.map(e => (
                  <div key={e.id} className="p-1 bg-white/5 rounded text-xs">
                    <p className="truncate">{e.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. MEMBER */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-yellow-500" />
                <h2 className="text-lg font-display">Member</h2>
              </div>
              <button onClick={() => navigate('/admin/members')} className="text-yellow-500 text-xs flex items-center gap-1 hover:gap-2 transition">
                Kelola <ExternalLink size={10} />
              </button>
            </div>
            {recentMembers.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-xs">Belum ada member</p>
            ) : (
              <div className="space-y-2">
                {recentMembers.map(m => (
                  <div key={m.id} className="p-1 bg-white/5 rounded text-xs">
                    <p className="truncate">{m.full_name || m.email}</p>
                    <p className="text-yellow-500">{m.points || 0} poin</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. PESAN */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-yellow-500" />
                <h2 className="text-lg font-display">Pesan</h2>
              </div>
              <button onClick={() => navigate('/admin/contacts')} className="text-yellow-500 text-xs flex items-center gap-1 hover:gap-2 transition">
                Kelola <ExternalLink size={10} />
              </button>
            </div>
            {recentMessages.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-xs">Belum ada pesan</p>
            ) : (
              <div className="space-y-2">
                {recentMessages.map(m => (
                  <div key={m.id} className="p-1 bg-white/5 rounded text-xs">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="text-gray-400 truncate">{m.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. PESANAN */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-yellow-500" />
                <h2 className="text-lg font-display">Pesanan</h2>
              </div>
              <button onClick={() => navigate('/admin/orders')} className="text-yellow-500 text-xs flex items-center gap-1 hover:gap-2 transition">
                Kelola <ExternalLink size={10} />
              </button>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-xs">Belum ada pesanan</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map(o => (
                  <div key={o.id} className="p-1 bg-white/5 rounded text-xs">
                    <p className="truncate">#{o.order_number}</p>
                    <p className="text-yellow-500">Rp {o.total_amount.toLocaleString()}</p>
                    <p className="text-gray-400 capitalize">{o.status}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== MODAL EDIT STORE ========== */}
      {showStoreModal && store && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-display mb-4">Edit Profil Store</h2>
            
            <div className="space-y-4">
              {/* Nama Store */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nama Store</label>
                <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" value={storeForm.name} onChange={e => setStoreForm({...storeForm, name: e.target.value})} />
              </div>
              
              {/* Deskripsi */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Deskripsi</label>
                <textarea rows="2" className="w-full p-2 rounded bg-black/50 border border-white/20" value={storeForm.description} onChange={e => setStoreForm({...storeForm, description: e.target.value})} />
              </div>
              
              {/* Kategori */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                <select className="w-full p-2 rounded bg-black/50 border border-white/20" value={storeForm.category} onChange={e => setStoreForm({...storeForm, category: e.target.value})}>
                  <option value="bar">Bar</option>
                  <option value="club">Club</option>
                  <option value="coffee_shop">Coffee Shop</option>
                </select>
              </div>
              
              {/* Logo URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Logo (URL gambar)</label>
                <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" placeholder="https://..." value={storeForm.logo} onChange={e => setStoreForm({...storeForm, logo: e.target.value})} />
                {storeForm.logo && <img src={storeForm.logo} className="h-16 w-16 object-cover rounded-full mt-2" alt="preview" />}
              </div>
              
              {/* Background Image */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Background Image (Hero halaman store)</label>
                <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" placeholder="https://..." value={storeForm.background_image} onChange={e => setStoreForm({...storeForm, background_image: e.target.value})} />
                {storeForm.background_image && <img src={storeForm.background_image} className="h-20 w-full object-cover rounded mt-2" alt="preview" />}
              </div>
              
              {/* Cover Image */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cover Image (Card carousel homepage)</label>
                <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" placeholder="https://..." value={storeForm.cover_image} onChange={e => setStoreForm({...storeForm, cover_image: e.target.value})} />
                {storeForm.cover_image && <img src={storeForm.cover_image} className="h-20 w-full object-cover rounded mt-2" alt="preview" />}
                <p className="text-gray-500 text-xs mt-1">Gambar ini akan tampil sebagai gambar statis pada card store di homepage carousel.</p>
              </div>
              
              {/* Video Preview */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Video Preview (URL video, opsional)</label>
                <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" placeholder="https://..." value={storeForm.video_preview} onChange={e => setStoreForm({...storeForm, video_preview: e.target.value})} />
                <p className="text-gray-500 text-xs mt-1">Video akan diputar saat card di-hover/tap. Kosongkan jika tidak ingin video.</p>
              </div>
              
              {/* Alamat Text */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Alamat (Teks)</label>
                <textarea rows="2" className="w-full p-2 rounded bg-black/50 border border-white/20" value={storeForm.alamat} onChange={e => setStoreForm({...storeForm, alamat: e.target.value})} />
              </div>
              
              {/* Google Maps Location Picker */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Lokasi Store (Peta)</label>
                <LocationPicker
                  initialLat={storeForm.latitude ? parseFloat(storeForm.latitude) : null}
                  initialLng={storeForm.longitude ? parseFloat(storeForm.longitude) : null}
                  onLocationChange={(location) => {
                    setStoreForm({
                      ...storeForm,
                      latitude: location.lat.toString(),
                      longitude: location.lng.toString(),
                      alamat: location.address || storeForm.alamat
                    })
                  }}
                />
                <p className="text-gray-500 text-xs mt-1">Klik peta atau cari alamat untuk menentukan titik lokasi store.</p>
              </div>
            </div>
            
            {/* TOMBOL SIMPAN & BATAL */}
            <div className="flex gap-3 mt-6">
              <button onClick={handleUpdateStore} className="bg-yellow-500 text-black px-4 py-2 rounded-full flex-1 font-semibold">Simpan Perubahan</button>
              <button onClick={() => setShowStoreModal(false)} className="bg-gray-700 px-4 py-2 rounded-full">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}