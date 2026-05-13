// ========== FILE: src/pages/AdminProducts.jsx ==========
// Halaman manajemen produk (full CRUD dengan tabel)
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AdminProducts() {
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState({ name: '', price: '', stock: '', image_url: '', description: '' })
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
    } else {
      setLoading(false)
    }
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
    setProductForm({ name: '', price: '', stock: '', image_url: '', description: '' })
    setShowModal(true)
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url || '',
      description: product.description || ''
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
      description: productForm.description
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

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>
  if (!store) return <div className="bg-black min-h-screen text-white p-8">Store tidak ditemukan</div>

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display">Manajemen Produk</h1>
          <div className="flex gap-3">
            <button onClick={() => navigate('/admin/dashboard')} className="bg-gray-700 px-4 py-2 rounded-full text-sm">Kembali ke Dashboard</button>
            <button onClick={openAddModal} className="bg-yellow-500 text-black px-4 py-2 rounded-full text-sm">Tambah Produk</button>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 border-b border-white/10">
              <tr>
                <th className="p-3">Nama</th>
                <th className="p-3">Harga</th>
                <th className="p-3">Stok</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">Rp {p.price.toLocaleString()}</td>
                  <td className="p-3">{p.stock}</td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => openEditModal(p)} className="text-blue-400 text-sm">Edit</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-400 text-sm">Hapus</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan="4" className="p-3 text-center text-gray-500">Belum ada produk</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tambah/edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="text-xl font-display mb-4">{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h3>
            <input type="text" placeholder="Nama produk" className="w-full p-2 rounded bg-black/50 border border-white/20 mb-3" value={productForm.name} onChange={e=>setProductForm({...productForm, name: e.target.value})} />
            <input type="number" placeholder="Harga" className="w-full p-2 rounded bg-black/50 border border-white/20 mb-3" value={productForm.price} onChange={e=>setProductForm({...productForm, price: e.target.value})} />
            <input type="number" placeholder="Stok" className="w-full p-2 rounded bg-black/50 border border-white/20 mb-3" value={productForm.stock} onChange={e=>setProductForm({...productForm, stock: e.target.value})} />
            <input type="text" placeholder="URL gambar (opsional)" className="w-full p-2 rounded bg-black/50 border border-white/20 mb-3" value={productForm.image_url} onChange={e=>setProductForm({...productForm, image_url: e.target.value})} />
            <textarea placeholder="Deskripsi" className="w-full p-2 rounded bg-black/50 border border-white/20 mb-4" rows="2" value={productForm.description} onChange={e=>setProductForm({...productForm, description: e.target.value})}></textarea>
            <div className="flex gap-3">
              <button onClick={handleSave} className="bg-yellow-500 text-black px-4 py-2 rounded-full flex-1">Simpan</button>
              <button onClick={() => setShowModal(false)} className="bg-gray-700 px-4 py-2 rounded-full">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}