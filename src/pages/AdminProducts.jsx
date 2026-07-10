// ========== FILE: src/pages/AdminProducts.jsx ==========
// Halaman manajemen produk dengan kategori, diskon (persen & nominal), favorit, upsell
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Package, Edit, Trash2, Plus, Percent, Star, ShoppingBag, X } from 'lucide-react'
import MediaGallery from '../components/MediaGallery'
import { markMediaAsUsed, unmarkMediaAsUsed } from '../services/mediaService'
import { 
  interpretDiscount, 
  calculateDiscountedPrice, 
  getDiscountLabel,
  validateDiscountInput,
  formatDiscountForTable
} from '../utils/priceUtils'

export default function AdminProducts() {
  const [store, setStore] = useState(null)
  const [user, setUser] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showMediaGallery, setShowMediaGallery] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  
  // ============================================================
  // FORM STATE
  // ============================================================
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    stock: '',
    image_url: '',
    description: '',
    category_id: '',
    has_discount: false,
    discount_type: 'percentage', // 'percentage' | 'nominal' ← BARU
    discount_value: '',           // ← BARU (ganti discount_percentage)
    is_featured: false,
    is_upsell: false,
    video_url: ''                 // ← BARU (opsional)
  })
  const [discountError, setDiscountError] = useState('')
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
    setUser(user)

    const { data: userData } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', user.id)
      .single()
    
    if (userData?.store_id) {
      fetchStoreAndProducts(userData.store_id)
      fetchCategories(userData.store_id)
    } else {
      setLoading(false)
    }
  }

  const fetchCategories = async (storeId) => {
    const { data, error } = await supabase
      .from('store_categories')
      .select(`
        category_id,
        master_categories (id, name, sort_order)
      `)
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
      return;
    }
    
    const activeCategories = data
      .filter(item => item.master_categories)
      .map(item => ({
        id: item.master_categories.id,
        name: item.master_categories.name,
        sort_order: item.master_categories.sort_order
      }));
    
    setCategories(activeCategories);
  }

  const fetchStoreAndProducts = async (storeId) => {
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()
    setStore(storeData)

    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
    setProducts(productsData || [])
    setLoading(false)
  }

  const openAddModal = () => {
    setEditingProduct(null)
    setProductForm({
      name: '',
      price: '',
      stock: '',
      image_url: '',
      description: '',
      category_id: '',
      has_discount: false,
      discount_type: 'percentage',
      discount_value: '',
      is_featured: false,
      is_upsell: false,
      video_url: ''
    })
    setDiscountError('')
    setShowModal(true)
  }

  const openEditModal = (product) => {
    // Tentukan tipe diskon dari nilai yang ada
    let discountType = 'percentage'
    if (product.has_discount && product.discount_value > 100) {
      discountType = 'nominal'
    }

    setEditingProduct(product)
    setProductForm({
      name: product.name,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url || '',
      description: product.description || '',
      category_id: product.category_id || '',
      has_discount: product.has_discount || false,
      discount_type: discountType,
      discount_value: product.discount_value || '',
      is_featured: product.is_featured || false,
      is_upsell: product.is_upsell || false,
      video_url: product.video_url || ''
    })
    setDiscountError('')
    setShowModal(true)
  }

  // ============================================================
  // VALIDASI DISKON
  // ============================================================
  const validateDiscount = () => {
    if (!productForm.has_discount) {
      setDiscountError('')
      return true
    }

    const value = parseFloat(productForm.discount_value)
    if (!value || value <= 0) {
      setDiscountError('Nilai diskon harus lebih dari 0')
      return false
    }

    const price = parseInt(productForm.price) || 0
    
    if (productForm.discount_type === 'percentage') {
      if (value > 100) {
        setDiscountError('Diskon persen maksimal 100%')
        return false
      }
      if (value < 1) {
        setDiscountError('Diskon persen minimal 1%')
        return false
      }
    } else {
      if (value < 500) {
        setDiscountError('Diskon nominal minimal Rp 500')
        return false
      }
      if (value > price && price > 0) {
        setDiscountError(`Diskon tidak boleh melebihi harga produk (Rp ${price.toLocaleString()})`)
        return false
      }
    }

    setDiscountError('')
    return true
  }

  // ============================================================
  // HANDLE SAVE
  // ============================================================
  const handleSave = async () => {
    if (!store) return
    
    // Validasi diskon
    if (!validateDiscount()) {
      return
    }

    // Hitung discount_value yang akan disimpan
    let discountValue = 0
    if (productForm.has_discount && productForm.discount_value) {
      discountValue = parseFloat(productForm.discount_value)
    }

    const productData = {
      store_id: store.id,
      name: productForm.name,
      price: parseInt(productForm.price),
      stock: parseInt(productForm.stock) || 0,
      image_url: productForm.image_url,
      video_url: productForm.video_url || null,
      description: productForm.description,
      category_id: productForm.category_id || null,
      has_discount: productForm.has_discount,
      discount_value: discountValue, // ← PAKAI discount_value
      is_featured: productForm.is_featured,
      is_upsell: productForm.is_upsell || false
    }

    let productId = editingProduct?.id

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id)
      if (error) {
        alert('Gagal update: ' + error.message)
        return
      }
      productId = editingProduct.id
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
      if (error) {
        alert('Gagal tambah: ' + error.message)
        return
      }
      productId = data[0]?.id
    }

    // Tandai media sebagai used (jika ada gambar)
    if (productForm.image_url && productId) {
      try {
        const { data: mediaData } = await supabase
          .from('media_library')
          .select('id')
          .eq('file_url', productForm.image_url)
          .maybeSingle()
        
        if (mediaData) {
          await markMediaAsUsed(
            [mediaData.id],
            { 
              type: 'product', 
              id: productId, 
              name: productForm.name || 'Produk' 
            }
          )
        }
      } catch (err) {
        console.error('Error marking media:', err)
      }
    }

    setShowModal(false)
    fetchStoreAndProducts(store.id)
  }

  const handleDelete = async (productId) => {
    if (!confirm('Yakin hapus produk ini?')) return

    const { data: productData } = await supabase
      .from('products')
      .select('image_url, name')
      .eq('id', productId)
      .single()

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
    
    if (error) {
      alert('Gagal hapus: ' + error.message)
      return
    }

    if (productData?.image_url) {
      try {
        await unmarkMediaAsUsed(
          [productData.id],
          { type: 'product', id: productId }
        )
      } catch (err) {
        console.error('Error unmarking media:', err)
      }
    }

    fetchStoreAndProducts(store.id)
  }

  const toggleUpsell = async (productId, currentValue) => {
    const { error } = await supabase
      .from('products')
      .update({ is_upsell: !currentValue })
      .eq('id', productId)
    if (error) alert('Gagal update upsell: ' + error.message)
    else fetchStoreAndProducts(store.id)
  }

  // ============================================================
  // HANDLE MEDIA SELECT (DARI GALERI)
  // ============================================================
  const handleMediaSelect = (url, selectedMedia) => {
    setProductForm({ ...productForm, image_url: url })
    setShowMediaGallery(false)
  }

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>
  if (!store) return <div className="bg-black min-h-screen text-white p-8">Store tidak ditemukan</div>

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display">Manajemen Produk</h1>
          <div className="flex gap-3">
            <button onClick={() => navigate('/admin/dashboard')} className="bg-gray-700 px-4 py-2 rounded-full text-sm">Kembali</button>
            <button onClick={openAddModal} className="bg-yellow-500 text-black px-4 py-2 rounded-full text-sm flex items-center gap-1">
              <Plus size={16} /> Tambah Produk
            </button>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-800/50 border-b border-white/10">
                <tr>
                  <th className="p-3">Gambar</th>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Harga</th>
                  <th className="p-3">Stok</th>
                  <th className="p-3">Diskon</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Upsell</th>
                  <th className="p-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  // ============================================================
                  // HITUNG DISKON DENGAN priceUtils
                  // ============================================================
                  const hasDiscount = p.has_discount && p.discount_value > 0
                  const discountInfo = interpretDiscount(p.price, p.has_discount, p.discount_value)
                  const discountLabel = formatDiscountForTable(p.price, p.has_discount, p.discount_value)
                  
                  return (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center text-xs">No img</div>
                        )}
                      </td>
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-sm">
                        {categories.find(c => c.id === p.category_id)?.name || '-'}
                      </td>
                      <td className="p-3">
                        {hasDiscount ? (
                          <div>
                            <span className="text-yellow-500 font-semibold">Rp {discountInfo.finalPrice.toLocaleString()}</span>
                            <span className="text-gray-400 text-xs line-through ml-2">Rp {p.price.toLocaleString()}</span>
                          </div>
                        ) : (
                          <span>Rp {p.price.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="p-3">{p.stock}</td>
                      <td className="p-3">
                        {hasDiscount ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            discountInfo.type === 'percentage' 
                              ? 'bg-red-500/20 text-red-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {discountLabel}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {hasDiscount && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              discountInfo.type === 'percentage' 
                                ? 'bg-red-500/20 text-red-400' 
                                : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {discountInfo.type === 'percentage' ? '💯 %' : '💰 Rp'}
                            </span>
                          )}
                          {p.is_featured && (
                            <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Star size={10} /> Favorit
                            </span>
                          )}
                          {!hasDiscount && !p.is_featured && (
                            <span className="text-gray-500 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => toggleUpsell(p.id, p.is_upsell)}
                          className={`px-2 py-1 rounded-full text-xs transition ${
                            p.is_upsell
                              ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                              : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                          }`}
                        >
                          {p.is_upsell ? '✅ Upsell' : 'Tandai Upsell'}
                        </button>
                      </td>
                      <td className="p-3 flex gap-2">
                        <button onClick={() => openEditModal(p)} className="text-blue-400 hover:text-blue-300">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan="9" className="p-3 text-center text-gray-500">Belum ada produk</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===== MODAL TAMBAH/EDIT PRODUK ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h3 className="text-xl font-display mb-4">{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h3>
            
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              {/* Nama Produk */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nama Produk *</label>
                <input 
                  type="text" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={productForm.name} 
                  onChange={e => setProductForm({...productForm, name: e.target.value})} 
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                <select 
                  className="w-full p-2 rounded bg-black/50 border border-white/20"
                  value={productForm.category_id}
                  onChange={e => setProductForm({...productForm, category_id: e.target.value})}
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Harga */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Harga (Rp)</label>
                <input 
                  type="number" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={productForm.price} 
                  onChange={e => setProductForm({...productForm, price: e.target.value})} 
                />
              </div>

              {/* Stok */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Stok</label>
                <input 
                  type="number" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={productForm.stock} 
                  onChange={e => setProductForm({...productForm, stock: e.target.value})} 
                />
              </div>

              {/* ============================================================
                  DISKON - DENGAN DROPDOWN & VALIDASI
                  ============================================================ */}
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center gap-3 mb-2">
                  <input 
                    type="checkbox" 
                    id="has_discount"
                    checked={productForm.has_discount}
                    onChange={e => setProductForm({...productForm, has_discount: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="has_discount" className="text-sm text-gray-300">Produk Diskon</label>
                </div>

                {productForm.has_discount && (
                  <div className="space-y-3 bg-gray-800/30 p-3 rounded-lg">
                    {/* Tipe Diskon */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Jenis Diskon</label>
                      <select 
                        className="w-full p-2 rounded bg-black/50 border border-white/20"
                        value={productForm.discount_type}
                        onChange={e => {
                          setProductForm({...productForm, discount_type: e.target.value})
                          setDiscountError('')
                        }}
                      >
                        <option value="percentage">Persen (%)</option>
                        <option value="nominal">Nominal (Rp)</option>
                      </select>
                    </div>

                    {/* Nilai Diskon */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        {productForm.discount_type === 'percentage' 
                          ? 'Nilai Diskon (%)' 
                          : 'Nilai Diskon (Rp)'}
                      </label>
                      <input 
                        type="number" 
                        className={`w-full p-2 rounded bg-black/50 border ${discountError ? 'border-red-500' : 'border-white/20'} focus:border-yellow-500 focus:outline-none`}
                        placeholder={productForm.discount_type === 'percentage' ? '10' : '15000'}
                        value={productForm.discount_value}
                        onChange={e => {
                          setProductForm({...productForm, discount_value: e.target.value})
                          setDiscountError('')
                        }}
                        onBlur={validateDiscount}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {productForm.discount_type === 'percentage' 
                          ? '💡 Masukkan angka 1-100 untuk diskon persen' 
                          : '💡 Minimal Rp 500 untuk diskon nominal'}
                      </p>
                      {discountError && (
                        <p className="text-xs text-red-400 mt-1">{discountError}</p>
                      )}
                      {productForm.price && productForm.has_discount && productForm.discount_value && !discountError && (
                        <p className="text-green-500 text-xs mt-1">
                          {productForm.discount_type === 'percentage' 
                            ? `✅ Harga setelah diskon: Rp ${Math.round(productForm.price * (1 - productForm.discount_value / 100)).toLocaleString()}`
                            : `✅ Harga setelah diskon: Rp ${Math.max(0, productForm.price - productForm.discount_value).toLocaleString()}`
                          }
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Favorit */}
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="is_featured"
                  checked={productForm.is_featured}
                  onChange={e => setProductForm({...productForm, is_featured: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="is_featured" className="text-sm text-gray-300">Produk Favorit</label>
              </div>

              {/* Upsell */}
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="is_upsell"
                  checked={productForm.is_upsell}
                  onChange={e => setProductForm({...productForm, is_upsell: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="is_upsell" className="text-sm text-gray-300">Produk Upselling (tampil di checkout)</label>
              </div>

              {/* Gambar */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL Gambar</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 p-2 rounded bg-black/50 border border-white/20" 
                    placeholder="https://..."
                    value={productForm.image_url}
                    onChange={e => setProductForm({...productForm, image_url: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMediaGallery(true)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    🖼️ Pilih
                  </button>
                </div>
                {productForm.image_url && (
                  <img src={productForm.image_url} className="h-16 w-16 object-cover rounded mt-2" alt="preview" />
                )}
              </div>

              {/* Video (opsional) */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL Video (opsional)</label>
                <input 
                  type="text" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  placeholder="https://..."
                  value={productForm.video_url}
                  onChange={e => setProductForm({...productForm, video_url: e.target.value})}
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Deskripsi</label>
                <textarea 
                  rows="3" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={productForm.description}
                  onChange={e => setProductForm({...productForm, description: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="bg-yellow-500 text-black px-4 py-2 rounded-full flex-1 font-semibold">
                Simpan
              </button>
              <button onClick={() => setShowModal(false)} className="bg-gray-700 px-4 py-2 rounded-full">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL MEDIA GALLERY ===== */}
      {showMediaGallery && (
        <div className="fixed inset-0 bg-black/80 z-50 p-4 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-display text-white">Pilih Gambar</h2>
              <button onClick={() => setShowMediaGallery(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <MediaGallery
              storeId={store?.id}
              userId={user?.id}
              selectable={true}
              maxSelect={1}
              allowedTypes="image"
              onSelect={handleMediaSelect}
            />
          </div>
        </div>
      )}
    </div>
  )
}