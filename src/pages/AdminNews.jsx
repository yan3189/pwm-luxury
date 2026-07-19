// ========== FILE: src/pages/AdminNews.jsx ==========
// Halaman manajemen news (full CRUD dengan tabel + Media Gallery + Video)
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import MediaGallery from '../components/MediaGallery'
import { markMediaAsUsed, unmarkMediaByEntity } from '../services/mediaService'

export default function AdminNews() {
  const [store, setStore] = useState(null)
  const [user, setUser] = useState(null)
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showMediaGallery, setShowMediaGallery] = useState(false)
  const [showVideoGallery, setShowVideoGallery] = useState(false)
  const [editingNews, setEditingNews] = useState(null)
  const [newsForm, setNewsForm] = useState({ 
    title: '', 
    excerpt: '', 
    content: '', 
    image_url: '',
    video_url: '',
    link_url: '', link_label: ''  
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
    setUser(user)

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
    setNewsForm({ title: '', excerpt: '', content: '', image_url: '', video_url: '', link_url: '', link_label: '' })
    setShowModal(true)
}

  const openEditModal = (item) => {
    setEditingNews(item)
    setNewsForm({
      title: item.title,
      excerpt: item.excerpt || '',
      content: item.content || '',
      image_url: item.image_url || '',
      video_url: item.video_url || '',
      link_url: item.link_url || '',
link_label: item.link_label || ''
    })
    setShowModal(true)
  }

  // ============================================================
  // HANDLE PILIH GAMBAR DARI GALERI
  // ============================================================
  const handleMediaSelect = (url, selectedMedia) => {
    setNewsForm({ ...newsForm, image_url: url })
    
    if (selectedMedia && selectedMedia.length > 0 && editingNews?.id) {
      markMediaAsUsed(
        selectedMedia.map(m => m.id),
        { 
          type: 'news', 
          id: editingNews.id, 
          name: newsForm.title || 'Artikel Baru' 
        }
      ).catch(err => console.error('Error marking media:', err))
    }
    
    setShowMediaGallery(false)
  }

  const handleVideoSelect = (url, selectedMedia) => {
    setNewsForm({ ...newsForm, video_url: url })
    setShowVideoGallery(false)
  }

  const handleSave = async () => {
    if (!store) return
    
    const newsData = {
      store_id: store.id,
      title: newsForm.title,
      excerpt: newsForm.excerpt,
      content: newsForm.content,
      image_url: newsForm.image_url,
      video_url: newsForm.video_url || null,
      link_url: newsForm.link_url || null,
      link_label: newsForm.link_label || null,
      published_at: new Date().toISOString()
    }

    let newsId = editingNews?.id

    if (editingNews) {
      const { error } = await supabase
        .from('news')
        .update(newsData)
        .eq('id', editingNews.id)
      if (error) {
        alert('Gagal update: ' + error.message)
        return
      }
      newsId = editingNews.id
    } else {
      const { data, error } = await supabase
        .from('news')
        .insert([newsData])
        .select()
      if (error) {
        alert('Gagal tambah: ' + error.message)
        return
      }
      newsId = data[0]?.id
    }

    // Tandai media sebagai used (jika ada gambar)
    if (newsForm.image_url && newsId) {
      try {
        const { data: mediaData } = await supabase
          .from('media_library')
          .select('id')
          .eq('file_url', newsForm.image_url)
          .maybeSingle()
        
        if (mediaData) {
          await markMediaAsUsed(
            [mediaData.id],
            { 
              type: 'news', 
              id: newsId, 
              name: newsForm.title || 'Artikel' 
            }
          )
          console.log('✅ Media marked as used for news:', newsId)
        }
      } catch (err) {
        console.error('Error marking media as used:', err)
      }
    }

    setShowModal(false)
    fetchStoreAndNews(store.id)
  }

  const handleDelete = async (newsId) => {
    if (!confirm('Yakin hapus artikel ini?')) return

    const { data: newsData } = await supabase
      .from('news')
      .select('image_url, title')
      .eq('id', newsId)
      .single()

    const { error } = await supabase
      .from('news')
      .delete()
      .eq('id', newsId)
    
    if (error) {
      alert('Gagal hapus: ' + error.message)
      return
    }

    if (newsData?.image_url) {
      try {
        await unmarkMediaByEntity(newsId, 'news')
        console.log('✅ Media unmarked for news:', newsId)
      } catch (err) {
        console.error('Error unmarking media:', err)
      }
    }

    fetchStoreAndNews(store.id)
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

      {/* ===== MODAL TAMBAH/EDIT ARTIKEL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-display mb-4">{editingNews ? 'Edit Artikel' : 'Tambah Artikel'}</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Judul" className="w-full p-2 rounded bg-black/50 border border-white/20" value={newsForm.title} onChange={e=>setNewsForm({...newsForm, title: e.target.value})} />
              <input type="text" placeholder="Excerpt (ringkasan singkat)" className="w-full p-2 rounded bg-black/50 border border-white/20" value={newsForm.excerpt} onChange={e=>setNewsForm({...newsForm, excerpt: e.target.value})} />
              <textarea placeholder="Konten lengkap" className="w-full p-2 rounded bg-black/50 border border-white/20" rows="3" value={newsForm.content} onChange={e=>setNewsForm({...newsForm, content: e.target.value})} />
              
              {/* ===== GAMBAR ===== */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL Gambar</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 p-2 rounded bg-black/50 border border-white/20" 
                    placeholder="https://..."
                    value={newsForm.image_url}
                    onChange={e => setNewsForm({...newsForm, image_url: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMediaGallery(true)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    🖼️ Pilih Gambar
                  </button>
                </div>
                {newsForm.image_url && (
                  <img src={newsForm.image_url} className="h-16 w-16 object-cover rounded mt-2" alt="preview" />
                )}
              </div>

              {/* ===== VIDEO ===== */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL Video (opsional)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 p-2 rounded bg-black/50 border border-white/20" 
                    placeholder="https://..."
                    value={newsForm.video_url}
                    onChange={e => setNewsForm({...newsForm, video_url: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowVideoGallery(true)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    🎬 Pilih Video
                  </button>
                </div>
                {newsForm.video_url && (
                  <p className="text-xs text-gray-400 mt-1">Video URL: {newsForm.video_url}</p>
                )}
              </div>

<div>
  <label className="block text-sm text-gray-400 mb-1">URL Link Eksternal (opsional)</label>
  <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" placeholder="https://instagram.com/..." value={newsForm.link_url || ''} onChange={e => setNewsForm({...newsForm, link_url: e.target.value})} />
</div>
<div>
  <label className="block text-sm text-gray-400 mb-1">Label Link</label>
  <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" placeholder="Lihat di Instagram" value={newsForm.link_label || ''} onChange={e => setNewsForm({...newsForm, link_label: e.target.value})} />
</div>

            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="bg-yellow-500 text-black px-4 py-2 rounded-full flex-1 font-semibold">Simpan</button>
              <button onClick={() => setShowModal(false)} className="bg-gray-700 px-4 py-2 rounded-full">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL MEDIA GALLERY (GAMBAR) ===== */}
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

      {/* ===== MODAL MEDIA GALLERY (VIDEO) ===== */}
      {showVideoGallery && (
        <div className="fixed inset-0 bg-black/80 z-50 p-4 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-display text-white">Pilih Video</h2>
              <button onClick={() => setShowVideoGallery(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <MediaGallery
              storeId={store?.id}
              userId={user?.id}
              selectable={true}
              maxSelect={1}
              allowedTypes="video"
              onSelect={handleVideoSelect}
            />
          </div>
        </div>
      )}
    </div>
  )
}