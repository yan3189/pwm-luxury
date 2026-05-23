// ========== FILE: src/pages/StorePage.jsx ==========
// Halaman publik store dengan tab: Semua Produk, Kategori, Diskon, Favorit
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import FloatingCart from '../components/FloatingCart'
import { addToCart as addToCartService } from '../services/cartService'

export default function StorePage() {
  const { slug } = useParams()
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Data produk
  const [allProducts, setAllProducts] = useState([])
  const [discountProducts, setDiscountProducts] = useState([])
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [categoryProducts, setCategoryProducts] = useState({})
  const [storeCategories, setStoreCategories] = useState([])
  
  // Tab aktif
  const [activeTab, setActiveTab] = useState('all')

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
    
    // Ambil semua produk dari store ini
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeData.id)
      .order('created_at', { ascending: false })
    
    if (productsError) {
      console.error('Error fetching products:', productsError)
    }
    
    const products = productsData || []
    
    // Set semua produk
    setAllProducts(products)
    
    // Produk diskon
    const discounted = products.filter(p => p.has_discount === true)
    setDiscountProducts(discounted)
    
    // Produk favorit
    const featured = products.filter(p => p.is_featured === true)
    setFeaturedProducts(featured)
    
    // Produk per kategori
    const byCategory = {}
    products.forEach(p => {
      if (p.category_id) {
        if (!byCategory[p.category_id]) byCategory[p.category_id] = []
        byCategory[p.category_id].push(p)
      }
    })
    setCategoryProducts(byCategory)
    
    // Ambil daftar kategori aktif untuk store ini (urutan berdasarkan display_order)
    const { data: categories, error: catError } = await supabase
      .from('store_categories')
      .select(`
        display_order,
        master_categories (id, name)
      `)
      .eq('store_id', storeData.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    
    if (catError) {
      console.error('Error fetching categories:', catError)
    }
    setStoreCategories(categories || [])
    
    setLoading(false)
  }

  // Fungsi tambah ke keranjang (real-time, tanpa refresh)
  const handleAddToCart = (product) => {
    const confirmed = addToCartService(product, 1, () => {
      return window.confirm('Keranjang berisi produk dari store lain. Ganti dengan store ini?')
    })
    if (confirmed) {
      alert(`✅ "${product.name}" ditambahkan ke keranjang`)
      // Cart sudah otomatis update via event, tidak perlu refresh halaman
    }
  }

  // Fungsi render produk (grid)
  const renderProducts = (productsToRender) => {
    if (!productsToRender || productsToRender.length === 0) {
      return <div className="text-center text-gray-500 py-12">Belum ada produk.</div>
    }
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {productsToRender.map(p => (
          <div key={p.id} className="bg-gray-900/50 rounded-xl p-3 hover:scale-105 transition-transform duration-300">
            <img 
              src={p.image_url || 'https://placehold.co/400x300'} 
              className="w-full h-32 md:h-40 object-cover rounded-lg mb-2" 
              alt={p.name}
            />
            <p className="font-bold text-sm md:text-base line-clamp-1">{p.name}</p>
            
            {/* Harga dengan diskon */}
            {p.has_discount ? (
              <div>
                <p className="text-yellow-500 text-sm md:text-base font-semibold">
                  Rp {Math.round(p.price * (100 - p.discount_percentage) / 100).toLocaleString()}
                </p>
                <p className="text-gray-400 text-xs line-through">Rp {p.price.toLocaleString()}</p>
                <span className="text-red-400 text-xs">Diskon {p.discount_percentage}%</span>
              </div>
            ) : (
              <p className="text-yellow-500 text-sm md:text-base font-semibold">Rp {p.price.toLocaleString()}</p>
            )}
            
            {p.description && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{p.description}</p>}
            
            {/* Tombol tambah ke keranjang */}
            <button 
              onClick={() => handleAddToCart(p)} 
              className="mt-3 w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-1.5 rounded-full transition text-sm"
            >
              🛒 Tambah ke Keranjang
            </button>
          </div>
        ))}
      </div>
    )
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
        <div className="flex border-b border-white/10 mt-8 mb-6 overflow-x-auto">
          {/* Tab Semua Produk (paling kiri) */}
          <button
            onClick={() => setActiveTab('all')}
            className={`py-3 px-6 font-semibold text-sm md:text-base transition-all relative whitespace-nowrap ${
              activeTab === 'all' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            Semua Produk
            {activeTab === 'all' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
          </button>

          {/* Tab Kategori (dari store_categories) */}
          {storeCategories.map(cat => (
            <button
              key={cat.master_categories.id}
              onClick={() => setActiveTab(`cat_${cat.master_categories.id}`)}
              className={`py-3 px-6 font-semibold text-sm md:text-base transition-all relative whitespace-nowrap ${
                activeTab === `cat_${cat.master_categories.id}` ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
              }`}
            >
              {cat.master_categories.name}
              {activeTab === `cat_${cat.master_categories.id}` && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
            </button>
          ))}

          {/* Tab Diskon (jika ada produk diskon) */}
          {discountProducts.length > 0 && (
            <button
              onClick={() => setActiveTab('discount')}
              className={`py-3 px-6 font-semibold text-sm md:text-base transition-all relative whitespace-nowrap ${
                activeTab === 'discount' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
              }`}
            >
              Diskon 🔥
              {activeTab === 'discount' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
            </button>
          )}

          {/* Tab Favorit (jika ada produk favorit) */}
          {featuredProducts.length > 0 && (
            <button
              onClick={() => setActiveTab('featured')}
              className={`py-3 px-6 font-semibold text-sm md:text-base transition-all relative whitespace-nowrap ${
                activeTab === 'featured' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
              }`}
            >
              Favorit ⭐
              {activeTab === 'featured' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
            </button>
          )}
        </div>
        
        {/* ========== TAB CONTENT: PRODUK ========== */}
        {activeTab === 'all' && renderProducts(allProducts)}
        
        {storeCategories.map(cat => (
          activeTab === `cat_${cat.master_categories.id}` && renderProducts(categoryProducts[cat.master_categories.id] || [])
        ))}
        
        {activeTab === 'discount' && renderProducts(discountProducts)}
        
        {activeTab === 'featured' && renderProducts(featuredProducts)}
        
        {/* ========== TAB ARTIKEL ========== */}
        <div className="mt-12">
          <div className="flex border-b border-white/10 mb-6">
            <h2 className="text-xl font-display text-yellow-500 pb-2 border-b-2 border-yellow-500">Artikel & Promo</h2>
          </div>
          <div className="space-y-4">
            {/* Di sini nanti bisa ditambahkan daftar artikel store */}
            <p className="text-gray-500 text-center py-4">Belum ada artikel.</p>
          </div>
        </div>
      </div>
      
      {/* Floating Cart */}
      <FloatingCart />
    </div>
  )
}