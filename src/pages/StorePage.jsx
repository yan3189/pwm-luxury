// ============================================================
// FILE: src/pages/StorePage.jsx
// Halaman publik store dengan lazy loading, tabs, kategori sticky
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import FloatingCart from '../components/FloatingCart'
import FloatingContact from '../components/FloatingContact'
import LocalSearch from '../components/LocalSearch'
import ProductCard from '../components/ProductCard'
import CategoryFilter from '../components/CategoryFilter'
import ToastNotification from '../components/ToastNotification'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { addToCart as addToCartService } from '../services/cartService'
import { Link2, Music2 } from 'lucide-react';

// ============================================================
// KONSTANTA - UBAH ANGKA INI UNTUK MENGATUR JUMLAH PRODUK PER BATCH
// ============================================================
const PRODUCTS_PER_PAGE = 24; // ← Ubah angka ini jika ingin load lebih banyak/lebih sedikit

export default function StorePage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  
  // ===== STATE STORE =====
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // ===== STATE PRODUK =====
  const [allProducts, setAllProducts] = useState([])
  const [displayProducts, setDisplayProducts] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalProducts, setTotalProducts] = useState(0)
  
  // ===== STATE KATEGORI =====
  const [storeCategories, setStoreCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [categoryProductCounts, setCategoryProductCounts] = useState({})
  
  // ===== STATE TAB =====
  const [activeTab, setActiveTab] = useState('products') // 'products' | 'articles'
  const [articles, setArticles] = useState([])
  const [events, setEvents] = useState([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  
  // ===== STATE SEARCH =====
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  
  // ===== STATE TOAST =====
  const [toastMessage, setToastMessage] = useState(null)
  
  // ===== REFS =====
  const initialLoadDone = useRef(false)
  const currentCategoryRef = useRef('all')

  // ============================================================
  // 1. FETCH STORE & INITIAL DATA
  // ============================================================
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

  // ============================================================
  // 2. FETCH STORE & PRODUCTS (PERTAMA KALI)
  // ============================================================
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
    
    // Ambil kategori store
    await fetchCategories(storeData.id)
    
    // Ambil total produk & produk pertama
    await fetchProducts(storeData.id, 'all', 0, true)
    
    // Ambil artikel & event
    await fetchArticlesAndEvents(storeData.id)
    
    setLoading(false)
  }

  // ============================================================
  // 3. FETCH KATEGORI
  // ============================================================
  const fetchCategories = async (storeId) => {
    const { data: categories, error: catError } = await supabase
      .from('store_categories')
      .select(`
        display_order,
        master_categories (id, name)
      `)
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    
    if (catError) {
      console.error('Error fetching categories:', catError)
    }
    setStoreCategories(categories || [])
    
    // Hitung jumlah produk per kategori
    await fetchCategoryCounts(storeId)
  }

  // ============================================================
  // 4. FETCH JUMLAH PRODUK PER KATEGORI
  // ============================================================
  const fetchCategoryCounts = async (storeId) => {
    const { data: products } = await supabase
      .from('products')
      .select('category_id')
      .eq('store_id', storeId)
      .eq('is_active', true)
    
    const counts = {}
    let total = 0
    products?.forEach(p => {
      total++
      if (p.category_id) {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1
      } else {
        counts['uncategorized'] = (counts['uncategorized'] || 0) + 1
      }
    })
    counts['total'] = total
    setCategoryProductCounts(counts)
    setTotalProducts(total)
  }

  // ============================================================
  // 5. FETCH PRODUK (DENGAN PAGINATION)
  // ============================================================
  const fetchProducts = async (storeId, categoryId, pageNum, reset = false) => {
    if (isLoadingMore) return
    
    setIsLoadingMore(true)
    
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (categoryId && categoryId !== 'all') {
        query = query.eq('category_id', categoryId)
      }
      
      const from = pageNum * PRODUCTS_PER_PAGE
      const to = from + PRODUCTS_PER_PAGE - 1
      
      query = query.range(from, to)
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error fetching products:', error)
        return
      }
      
      if (reset) {
        setAllProducts(data || [])
        setDisplayProducts(data || [])
        setPage(1)
        setHasMore((data || []).length === PRODUCTS_PER_PAGE)
      } else {
        setAllProducts(prev => [...prev, ...(data || [])])
        setDisplayProducts(prev => [...prev, ...(data || [])])
        setPage(prev => prev + 1)
        setHasMore((data || []).length === PRODUCTS_PER_PAGE)
      }
      
      currentCategoryRef.current = categoryId || 'all'
      
    } catch (err) {
      console.error('Error in fetchProducts:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // ============================================================
  // 6. LOAD MORE (UNTUK INFINITE SCROLL)
  // ============================================================
  const loadMore = useCallback(() => {
    if (!store || isLoadingMore || !hasMore) return
    const currentCategory = selectedCategory === 'all' ? 'all' : selectedCategory
    fetchProducts(store.id, currentCategory, page)
  }, [store, selectedCategory, page, isLoadingMore, hasMore])

  // ============================================================
  // 7. INFINITE SCROLL HOOK
  // ============================================================
  const { loaderRef } = useInfiniteScroll(loadMore, hasMore, isLoadingMore)

  // ============================================================
  // 8. FETCH ARTIKEL & EVENT
  // ============================================================
  const fetchArticlesAndEvents = async (storeId) => {
    setArticlesLoading(true)
    
    try {
      // Ambil artikel
      const { data: newsData } = await supabase
        .from('news')
        .select('id, title, excerpt, image_url, published_at')
        .eq('store_id', storeId)
        .order('published_at', { ascending: false })
        .limit(20)
      
      setArticles(newsData || [])
      
      // Ambil event
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, description, image_url, date, time, location')
        .eq('store_id', storeId)
        .order('date', { ascending: false })
        .limit(20)
      
      setEvents(eventsData || [])
      
    } catch (err) {
      console.error('Error fetching articles & events:', err)
    } finally {
      setArticlesLoading(false)
    }
  }

  // ============================================================
  // 9. HANDLE PILIH KATEGORI
  // ============================================================
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId)
    setPage(0)
    setAllProducts([])
    setDisplayProducts([])
    setHasMore(true)
    
    if (store) {
      fetchProducts(store.id, categoryId === 'all' ? 'all' : categoryId, 0, true)
    }
  }

  // ============================================================
  // 10. HANDLE SEARCH
  // ============================================================
  const handleSearchResults = (results) => {
    setSearchResults(results)
    setIsSearching(true)
    setActiveTab('products')
  }

  const handleClearSearch = () => {
    setSearchResults([])
    setIsSearching(false)
  }

  // ============================================================
  // 11. HANDLE ADD TO CART (DENGAN TOAST)
  // ============================================================
  const handleAddToCart = (product) => {
    const confirmed = addToCartService(product, 1, () => {
      return window.confirm('Keranjang berisi produk dari store lain. Ganti dengan store ini?')
    })
    if (confirmed) {
      // Trigger toast
      setToastMessage(`✅ ${product.name} ditambahkan ke keranjang`)
      
      // Trigger animasi floating cart (via event)
      window.dispatchEvent(new CustomEvent('cart-animate'))
      
      // Trigger cart update
      window.dispatchEvent(new Event('cart-updated'))
    }
  }

  // ============================================================
  // 12. RENDER PRODUK
  // ============================================================
  const renderProducts = (productsToRender) => {
    if (!productsToRender || productsToRender.length === 0) {
      return <div className="text-center text-gray-500 py-12">Belum ada produk.</div>
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {productsToRender.map(p => (
          <ProductCard
            key={p.id}
            product={p}
            onAddToCart={handleAddToCart}
          />
        ))}
      </div>
    )
  }

  // ============================================================
// RENDER ARTIKEL & EVENT (DENGAN LINK KE DETAIL)
// ============================================================
const renderArticlesAndEvents = () => {
  const allItems = [
    ...articles.map(a => ({ ...a, type: 'article', date: a.published_at })),
    ...events.map(e => ({ ...e, type: 'event', date: e.date })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  if (allItems.length === 0) {
    return <div className="text-center text-gray-500 py-12">Belum ada artikel atau event.</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {allItems.map(item => {
        // Tentukan link tujuan
        const detailLink = item.type === 'article' 
          ? `/news/${item.id}` 
          : `/events/${item.id}`;

        return (
          <Link
            key={`${item.type}-${item.id}`}
            to={detailLink}
            className="bg-gray-800/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition group block"
          >
            {item.image_url && (
              <div className="aspect-video overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  loading="lazy"
                  onError={(e) => e.target.src = '/placeholder-image.png'}
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.type === 'article' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {item.type === 'article' ? '📰 Artikel' : '📅 Event'}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h3 className="font-semibold text-lg line-clamp-2">{item.title}</h3>
              <p className="text-sm text-gray-400 line-clamp-2 mt-1">{item.excerpt || item.description}</p>
              {item.location && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  📍 {item.location}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

  // ============================================================
  // RENDER
  // ============================================================
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

  // Tentukan produk yang akan ditampilkan
  const productsToShow = isSearching ? searchResults : displayProducts

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
          {/* Sosial Media Icons */}
{(store.instagram_url || store.tiktok_url) && (
  <div className="absolute bottom-4 right-4 flex gap-3 z-10">
    {store.instagram_url && (
      <a
        href={store.instagram_url}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-black/50 backdrop-blur-sm p-2 rounded-full hover:bg-yellow-500/30 hover:scale-110 transition-all duration-300 border border-white/20"
        aria-label="Instagram"
      >
        <Link2 size={22} className="text-white" />
      </a>
    )}
    {store.tiktok_url && (
      <a
        href={store.tiktok_url}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-black/50 backdrop-blur-sm p-2 rounded-full hover:bg-yellow-500/30 hover:scale-110 transition-all duration-300 border border-white/20"
        aria-label="TikTok"
      >
        <Music2 size={22} className="text-white" />
      </a>
    )}
  </div>
)}
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-display text-center">{store.name}</h1>
        <p className="text-gray-400 text-center mt-2">{store.description}</p>
        
        {/* Local Search */}
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
        
        {/* ===== TABS ===== */}
        <div className="flex border-b border-white/10 mb-0 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('products'); setIsSearching(false); }}
            className={`py-3 px-6 font-semibold text-sm md:text-base transition-all relative whitespace-nowrap ${
              activeTab === 'products' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            📦 Produk
            {activeTab === 'products' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
          </button>
          <button
            onClick={() => { setActiveTab('articles'); setIsSearching(false); }}
            className={`py-3 px-6 font-semibold text-sm md:text-base transition-all relative whitespace-nowrap ${
              activeTab === 'articles' ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            📰 Artikel & Event
            {activeTab === 'articles' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full"></span>}
          </button>
        </div>

        {/* ===== TAB CONTENT ===== */}
        {activeTab === 'products' && (
          <>
            {/* Category Filter (Sticky) */}
            <CategoryFilter
              categories={storeCategories}
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategorySelect}
              productCounts={categoryProductCounts}
              className="mt-1"
            />

            {/* Produk Grid */}
            {renderProducts(productsToShow)}

            {/* Loader untuk infinite scroll */}
            {!isSearching && (
              <div ref={loaderRef} className="py-8 text-center">
                {isLoadingMore && (
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <div className="w-5 h-5 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
                    <span>Memuat produk...</span>
                  </div>
                )}
                {!hasMore && productsToShow.length > 0 && (
                  <p className="text-gray-500 text-sm">✨ Semua produk telah dimuat</p>
                )}
                {!hasMore && productsToShow.length === 0 && (
                  <p className="text-gray-500 text-sm">Belum ada produk di kategori ini</p>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'articles' && (
          <div className="mt-6">
            {articlesLoading ? (
              <div className="text-center py-12 text-gray-400">Memuat artikel & event...</div>
            ) : (
              renderArticlesAndEvents()
            )}
          </div>
        )}
      </div>
      
      {/* Floating Components */}
      <FloatingCart />
      <div className="fixed bottom-28 right-6 z-40 flex flex-col items-center gap-3">
        <FloatingContact />
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <ToastNotification
          message={toastMessage}
          duration={2500}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  )
}