// ========== FILE: src/pages/AdminNews.jsx ==========
// Halaman manajemen news (full CRUD dengan tabel)
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AdminNews() {
  const [store, setStore] = useState(null)
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingNews, setEditingNews] = useState(null)
  const [newsForm, setNewsForm] = useState({ title: '', excerpt: '', content: '', image_url: '' })
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
      fetchStoreAndNews(userData.store_id)
    } else {
      setLoading(false)
    }
  }

  const fetchStoreAndNews = async (storeId) => {
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()
    setStore(storeData)

    const { data: newsData } = await supabase
      .from('news')
      .select('*')
      .eq('store_id', storeId)
      .order('published_at', { ascending: false })
    setNews(newsData || [])
    setLoading(false)
  }

  const openAddModal = () => {
    setEditingNews(null)
    setNewsForm({ title: '', excerpt: '', content: '', image_url: '' })
    setShowModal(true)
  }

  const openEditModal = (item) => {
    setEditingNews(item)
    setNewsForm({
      title: item.title,
      excerpt: item.excerpt || '',
      content: item.content || '',
      image_url: item.image_url || ''
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!store) return
    const newsData = {
      store_id: store.id,
      title: newsForm.title,
      excerpt: newsForm.excerpt,
      content: newsForm.content,
      image_url: newsForm.image_url,
      published_at: new Date().toISOString()
    }

    if (editingNews) {
      const { error } = await supabase
        .from('news')
        .update(newsData)
        .eq('id', editingNews.id)
      if (error) alert('Gagal update: ' + error.message)
    } else {
      const { error } = await supabase
        .from('news')
        .insert([newsData])
      if (error) alert('Gagal tambah: ' + error.message)
    }
    setShowModal(false)
    fetchStoreAndNews(store.id)
  }

  const handleDelete = async (newsId) => {
    if (confirm('Yakin hapus artikel ini?')) {
      const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', newsId)
      if (error) alert('Gagal hapus: ' + error.message)
      else fetchStoreAndNews(store.id)
    }
  }

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>
  if (!store) return <div className="bg-black min-h-screen text-white p-8">Store tidak ditemukan</div>

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display">Manajemen News & Artikel</h1>
          <div className="flex gap-3">
            <button onClick={() => navigate('/admin/dashboard')} className="bg-gray-700 px-4 py-2 rounded-full text-sm">Kembali ke Dashboard</button>
            <button onClick={openAddModal} className="bg-yellow-500 text-black px-4 py-2 rounded-full text-sm">Tambah Artikel</button>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 border-b border-white/10">
              <tr>
                <th className="p-3">Judul</th>
                <th className="p-3">Excerpt</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {news.map(n => (
                <tr key={n.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3">{n.title}</td>
                  <td className="p-3 text-sm text-gray-400">{n.excerpt?.substring(0, 50)}...</td>
                  <td className="p-3 text-sm">{new Date(n.published_at).toLocaleDateString('id-ID')}</td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => openEditModal(n)} className="text-blue-400 text-sm">Edit</button>
                    <button onClick={() => handleDelete(n.id)} className="text-red-400 text-sm">Hapus</button>
                  </td>
                </tr>
              ))}
              {news.length === 0 && (
                <tr><td colSpan="4" className="p-3 text-center text-gray-500">Belum ada artikel</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tambah/edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="text-xl font-display mb-4">{editingNews ? 'Edit Artikel' : 'Tambah Artikel'}</h3>
            <input type="text" placeholder="Judul" className="w-full p-2 rounded bg-black/50 border border-white/20 mb-3" value={newsForm.title} onChange={e=>setNewsForm({...newsForm, title: e.target.value})} />
            <input type="text" placeholder="Excerpt (ringkasan singkat)" className="w-full p-2 rounded bg-black/50 border border-white/20 mb-3" value={newsForm.excerpt} onChange={e=>setNewsForm({...newsForm, excerpt: e.target.value})} />
            <textarea placeholder="Konten lengkap" className="w-full p-2 rounded bg-black/50 border border-white/20 mb-3" rows="3" value={newsForm.content} onChange={e=>setNewsForm({...newsForm, content: e.target.value})}></textarea>
            <input type="text" placeholder="URL gambar (opsional)" className="w-full p-2 rounded bg-black/50 border border-white/20 mb-4" value={newsForm.image_url} onChange={e=>setNewsForm({...newsForm, image_url: e.target.value})} />
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