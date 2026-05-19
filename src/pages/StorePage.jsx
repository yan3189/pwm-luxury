// ========== FILE: src/pages/StorePage.jsx ==========
// Halaman publik store dengan tab: Produk dan Artikel
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function StorePage() {
  const { slug } = useParams()
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products') // 'products' atau 'articles'
  const [error, setError] = useState(null)

  useEffect(() => {
    if (slug) {
      fetchStore()
    }
  }, [slug])

  const fetchStore = async () => {
    setLoading(true)
    setError(null)
    
    // Ambil store berdasarkan slug
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    
    if (storeError || !storeData) {
      setError('Store tidak ditemukan')
      setLoading(false)
      return
    }
    
    setStore(storeData)
    
    // Ambil produk
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeData.id)
      .order('created_at', { ascending: false })
    setProducts(productsData || [])
    
    // Ambil artikel
    const { data: newsData } = await supabase
      .from('news')
      .select('*')
      .eq('store_id', storeData.id)
      .order('published_at', { ascending: false })
    setNews(newsData || [])
    
    setLoading(false)
  }

  // ========== FUNGSI TAMBAH KE KERANJANG ==========
  const addToCart = (product) => {
    // Ambil cart yang sudah ada dari localStorage
    const savedCart = localStorage.getItem('cart')
    let cart = savedCart ? JSON.parse(savedCart) : []
    
    // Cek apakah produk sudah ada di cart (menggunakan product.id)
    const existingIndex = cart.findIndex(item => item.id === product.id)
    
    if (existingIndex !== -1) {
      // Jika sudah ada, tambah quantity
      cart[existingIndex].quantity += 1
    } else {
      // Jika belum ada, tambah produk baru
      cart.push({ 
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        store_id: product.store_id,
        quantity: 1 
      })
    }
    
    // Simpan kembali ke localStorage
    localStorage.setItem('cart', JSON.stringify(cart))
    alert(`✅ "${product.name}" ditambahkan ke keranjang`)
  }

  if (loading) {
    return (
      <div className="bg-black min-h-screen text-white flex items-center justify-center">
        <div>Loading store...</div>
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="bg-black min-h-screen text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-display mb-4">Oops!</h2>
        <p className="text-red-400 mb-4">{error || 'Store tidak ditemukan'}</p>
        <button onClick={() => window.location.href = '/'} className="bg-yellow-500 text-black px-4 py-2 rounded-full">Kembali ke Home</button>
      </div>
    )
  }

  // Helper format tanggal
  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      
      {/* Hero Background & Logo */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <img 
          src={store.background_image || 'https://images.unsplash.com/photo-1566417713940-fe9c9f0f9c2c?q=80&w=2070'} 
          alt={store.name}
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          {store.logo && (
            <img src={store.logo} alt={store.name} className="h-24 w-24 object-contain rounded-full bg-white/10 p-2" />
          )}
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-display text-center">{store.name}</h1>
        <p className="text-gray-400 text-center mt-2">{store.description}</p>
        
        {/* ========== TAB NAVIGATION ========== */}
        <div className="flex border-b border-white/10 mt-8 mb-6">
          <button
            onClick={() => setActiveTab('products')}
            className={`py-3 px-6 font-semibold text-sm md:text-base transition-all relative ${
              activeTab === 'products'
                ? 'text-yellow-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Produk
            {activeTab === 'products' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('articles')}
            className={`py-3 px-6 font-semibold text-sm md:text-base transition-all relative ${
              activeTab === 'articles'
                ? 'text-yellow-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Artikel
            {activeTab === 'articles' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>
            )}
          </button>
        </div>
        
        {/* ========== TAB CONTENT: PRODUK ========== */}
        {activeTab === 'products' && (
          <div>
            {products.length === 0 ? (
              <div className="text-center text-gray-500 py-12">Belum ada produk.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {products.map(p => (
                  <div key={p.id} className="bg-gray-900/50 rounded-xl p-3 hover:scale-105 transition-transform duration-300">
                    <img 
                      src={p.image_url || 'https://placehold.co/400x300'} 
                      className="w-full h-32 md:h-40 object-cover rounded-lg mb-2" 
                      alt={p.name}
                    />
                    <p className="font-bold text-sm md:text-base">{p.name}</p>
                    <p className="text-yellow-500 text-sm md:text-base font-semibold">Rp {p.price.toLocaleString()}</p>
                    {p.description && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{p.description}</p>}
                    
                    {/* ========== TOMBOL TAMBAH KE KERANJANG ========== */}
                    <button
                      onClick={() => addToCart(p)}
                      className="mt-3 w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-1.5 rounded-full transition text-sm"
                    >
                      🛒 Tambah ke Keranjang
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* ========== TAB CONTENT: ARTIKEL ========== */}
        {activeTab === 'articles' && (
          <div>
            {news.length === 0 ? (
              <div className="text-center text-gray-500 py-12">Belum ada artikel.</div>
            ) : (
              <div className="space-y-6">
                {news.map(item => (
                  <div key={item.id} className="bg-gray-900/50 rounded-xl p-5 border border-white/10 hover:border-yellow-500/30 transition">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.title} className="w-full h-48 md:h-56 object-cover rounded-lg mb-4" />
                    )}
                    <h3 className="text-xl md:text-2xl font-display font-bold">{item.title}</h3>
                    <div className="flex items-center gap-2 text-gray-400 text-sm mt-2">
                      <span>{formatDate(item.published_at)}</span>
                      <span>•</span>
                      <span>{store.name}</span>
                    </div>
                    <p className="text-gray-300 mt-3">{item.content || item.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}