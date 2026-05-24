// ========== FILE: src/pages/AdminProducts.jsx ==========
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Package, Edit, Trash2, Plus, Percent, Star } from 'lucide-react'

export default function AdminProducts() {
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    stock: '',
    image_url: '',
    description: '',
    category_id: '',
    has_discount: false,
    discount_percentage: '',
    is_featured: false
  })
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
      fetchStoreAndProducts(userData.store_id)
      fetchCategories(userData.store_id)
    } else {
      setLoading(false)
    }
  }

  const fetchCategories = async (storeId) => {
    // Ambil hanya kategori yang aktif untuk store ini
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
    
    // Extract master categories data
    const activeCategories = data
      .filter(item => item.master_categories)
      .map(item => ({
        id: item.master_categories.id,
        name: item.master_categories.name,
        sort_order: item.master_categories.sort_order
      }));
    
    setCategories(activeCategories);
  };

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
      discount_percentage: '',
      is_featured: false
    })
    setShowModal(true)
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url || '',
      description: product.description || '',
      category_id: product.category_id || '',
      has_discount: product.has_discount || false,
      discount_percentage: product.discount_percentage || '',
      is_featured: product.is_featured || false
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!store) return
    
    const productData = {
      store_id: store.id,
      name: productForm.name,
      price: parseInt(productForm.price),
      stock: parseInt(productForm.stock) || 0,
      image_url: productForm.image_url,
      description: productForm.description,
      category_id: productForm.category_id || null,
      has_discount: productForm.has_discount,
      discount_percentage: productForm.has_discount ? parseInt(productForm.discount_percentage) || 0 : 0,
      is_featured: productForm.is_featured
    }

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id)
      if (error) alert('Gagal update: ' + error.message)
    } else {
      const { error } = await supabase
        .from('products')
        .insert([productData])
      if (error) alert('Gagal tambah: ' + error.message)
    }
    setShowModal(false)
    fetchStoreAndProducts(store.id)
  }

  const handleDelete = async (productId) => {
    if (confirm('Yakin hapus produk ini?')) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
      if (error) alert('Gagal hapus: ' + error.message)
      else fetchStoreAndProducts(store.id)
    }
  }

  const getDiscountedPrice = (price, discountPercentage) => {
    if (!discountPercentage || discountPercentage === 0) return price
    return Math.round(price * (100 - discountPercentage) / 100)
  }

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>
  if (!store) return <div className="bg-black min-h-screen text-white p-8">Store tidak ditemukan</div>

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display">Manajemen Produk</h1>
          <div className="flex gap-3">
            <button onClick={() => navigate('/admin/dashboard')} className="bg-gray-700 px-4 py-2 rounded-full text-sm">Kembali ke Dashboard</button>
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
                  <th className="p-3">Status</th>
                  <th className="p-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const discountedPrice = getDiscountedPrice(p.price, p.discount_percentage)
                  const hasActiveDiscount = p.has_discount && p.discount_percentage > 0
                  
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
                        {hasActiveDiscount ? (
                          <div>
                            <span className="text-yellow-500 font-semibold">Rp {discountedPrice.toLocaleString()}</span>
                            <span className="text-gray-400 text-xs line-through ml-2">Rp {p.price.toLocaleString()}</span>
                          </div>
                        ) : (
                          <span>Rp {p.price.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="p-3">{p.stock}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {hasActiveDiscount && (
                            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Percent size={10} /> Diskon {p.discount_percentage}%
                            </span>
                          )}
                          {p.is_featured && (
                            <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Star size={10} /> Favorit
                            </span>
                          )}
                          {!hasActiveDiscount && !p.is_featured && (
                            <span className="text-gray-500 text-xs">-</span>
                          )}
                        </div>
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
                  )}
                )}
                {products.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-3 text-center text-gray-500">Belum ada produk</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL TAMBAH/EDIT PRODUK */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h3 className="text-xl font-display mb-4">{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h3>
            
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nama Produk</label>
                <input 
                  type="text" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={productForm.name} 
                  onChange={e => setProductForm({...productForm, name: e.target.value})} 
                />
              </div>

              {/* Dropdown Kategori - Hanya yang aktif */}
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
                {categories.length === 0 && (
                  <p className="text-yellow-500 text-xs mt-1">
                    Belum ada kategori yang diaktifkan. Silakan atur di menu "Atur Kategori Store"
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Harga (Rp)</label>
                <input 
                  type="number" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={productForm.price} 
                  onChange={e => setProductForm({...productForm, price: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Stok</label>
                <input 
                  type="number" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  value={productForm.stock} 
                  onChange={e => setProductForm({...productForm, stock: e.target.value})} 
                />
              </div>

              <div className="flex items-center gap-3">
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
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Persentase Diskon (%)</label>
                  <input 
                    type="number" 
                    className="w-full p-2 rounded bg-black/50 border border-white/20" 
                    placeholder="10"
                    value={productForm.discount_percentage}
                    onChange={e => setProductForm({...productForm, discount_percentage: e.target.value})}
                  />
                  {productForm.price && productForm.discount_percentage && (
                    <p className="text-green-500 text-xs mt-1">
                      Setelah diskon: Rp {Math.round(productForm.price * (100 - productForm.discount_percentage) / 100).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

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

              <div>
                <label className="block text-sm text-gray-400 mb-1">URL Gambar</label>
                <input 
                  type="text" 
                  className="w-full p-2 rounded bg-black/50 border border-white/20" 
                  placeholder="https://..."
                  value={productForm.image_url}
                  onChange={e => setProductForm({...productForm, image_url: e.target.value})}
                />
                {productForm.image_url && (
                  <img src={productForm.image_url} className="h-16 w-16 object-cover rounded mt-2" alt="preview" />
                )}
              </div>

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
    </div>
  )
}