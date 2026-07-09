// ========== FILE: src/pages/StorePage.jsx ==========
// Halaman publik store dengan tab: Semua Produk, Kategori, Diskon, Favorit + Local Search
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import FloatingCart from '../components/FloatingCart'
import LocalSearch from '../components/LocalSearch'
import { addToCart as addToCartService } from '../services/cartService'
import ProductCard from '../components/ProductCard';

export default function StorePage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
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
  
  // Search state
  const [filteredProducts, setFilteredProducts] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (slug) {
      fetchStore()
    }
  }, [slug])

  // Scroll ke produk jika ada query parameter ?product=xxx
  useEffect(() => {
    const productId = searchParams.get('product')
    if (productId && !loading) {
      const element = document.getElementById(`product-${productId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.add('bg-yellow-500/20')
        setTimeout(() => {
          element.classList.remove('bg-yellow-500/20')
        }, 5000)
      }
    }
  }, [searchParams, loading])

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
    
    // Ambil daftar kategori aktif untuk store ini
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

  // Fungsi tambah ke keranjang
  const handleAddToCart = (product) => {
    const confirmed = addToCartService(product, 1, () => {
      return window.confirm('Keranjang berisi produk dari store lain. Ganti dengan store ini?')
    })
    if (confirmed) {
      alert(`✅ "${product.name}" ditambahkan ke keranjang`)
    }
  }

  // Handle search results
  const handleSearchResults = (results) => {
    setFilteredProducts(results)
    setIsSearching(true)
    // Set tab ke 'all' agar search results tampil
    setActiveTab('all')
  }

  const handleClearSearch = () => {
    setFilteredProducts([])
    setIsSearching(false)
  }

  // ========== RENDER PRODUK (DENGAN PRODUCT CARD) ==========
const renderProducts = (productsToRender) => {
  if (!productsToRender || productsToRender.length === 0) {
    return <div className="text-center text-gray-500 py-12">Belum ada produk.</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {productsToRender.map(p => (
        <ProductCard
          key={p.id}
          product={p}
          onAddToCart={handleAddToCart}
          onViewDetail={(product) => {
            // Scroll ke produk atau navigasi
            const element = document.getElementById(`product-${product.id}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
        />
      ))}
    </div>
  );
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

  // Tentukan produk yang akan ditampilkan (search results atau original)
  const displayProducts = isSearching ? filteredProducts : allProducts

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
        
        {/* Local Search Bar */}
        <div className="max-w-md mx-auto mt-4 mb-6">
          <LocalSearch 
            storeId={store.id} 
            onResults={handleSearchResults}
            onClear={handleClearSearch}
          />
          {isSearching && (
            <button 
              onClick={handleClearSearch}
              className="text-xs text-yellow-500 hover:underline mt-1 block text-center"
            >
              Hapus pencarian
            </button>
          )}
        </div>
        
        {/* ========== TAB NAVIGATION ========== */}
        <div className="flex border-b border-white/10 mt-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-3 px-6 font-semibold text-sm md:text-base transition-all relative whitespace-nowrap ${
              activeTab === 'all' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            Semua Produk
            {activeTab === 'all' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
          </button>

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
        
        {/* ========== TAB CONTENT ========== */}
        {!isSearching ? (
          <>
            {activeTab === 'all' && renderProducts(displayProducts)}
            {storeCategories.map(cat => (
              activeTab === `cat_${cat.master_categories.id}` && renderProducts(categoryProducts[cat.master_categories.id] || [])
            ))}
            {activeTab === 'discount' && renderProducts(discountProducts)}
            {activeTab === 'featured' && renderProducts(featuredProducts)}
          </>
        ) : (
          renderProducts(displayProducts)
        )}
        
        {/* ========== ARTIKEL & PROMO ========== */}
        <div className="mt-12">
          <div className="flex border-b border-white/10 mb-6">
            <h2 className="text-xl font-display text-yellow-500 pb-2 border-b-2 border-yellow-500">Artikel & Promo</h2>
          </div>
          <div className="space-y-4">
            {/* Artikel store akan ditampilkan di sini */}
            <p className="text-gray-500 text-center py-4">Belum ada artikel.</p>
          </div>
        </div>
      </div>
      
      <FloatingCart />
    </div>
  )
}