// ========== FILE: src/pages/AdminEvents.jsx ==========
// Halaman manajemen event (full CRUD dengan tabel + Media Gallery + Video)
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Clock, Trash2, Edit, Plus, X } from 'lucide-react'
import MediaGallery from '../components/MediaGallery'
import { markMediaAsUsed, unmarkMediaByEntity } from '../services/mediaService'

export default function AdminEvents() {
  const [store, setStore] = useState(null)
  const [user, setUser] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showMediaGallery, setShowMediaGallery] = useState(false)
  const [showVideoGallery, setShowVideoGallery] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    image_url: '',
    video_url: ''
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
      fetchStoreAndEvents(userData.store_id)
    } else {
      setLoading(false)
    }
  }

  const fetchStoreAndEvents = async (storeId) => {
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()
    setStore(storeData)

    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: true })
    setEvents(eventsData || [])
    setLoading(false)
  }

  const openAddModal = () => {
    setEditingEvent(null)
    setEventForm({ title: '', description: '', date: '', time: '', location: '', image_url: '', video_url: '' })
    setShowModal(true)
  }

  const openEditModal = (event) => {
    setEditingEvent(event)
    setEventForm({
      title: event.title,
      description: event.description || '',
      date: event.date,
      time: event.time || '',
      location: event.location || '',
      image_url: event.image_url || '',
      video_url: event.video_url || ''
    })
    setShowModal(true)
  }

  // ============================================================
  // HANDLE PILIH GAMBAR DARI GALERI
  // ============================================================
  const handleMediaSelect = (url, selectedMedia) => {
    setEventForm({ ...eventForm, image_url: url })
    
    if (selectedMedia && selectedMedia.length > 0 && editingEvent?.id) {
      markMediaAsUsed(
        selectedMedia.map(m => m.id),
        { 
          type: 'event', 
          id: editingEvent.id, 
          name: eventForm.title || 'Event Baru' 
        }
      ).catch(err => console.error('Error marking media:', err))
    }
    
    setShowMediaGallery(false)
  }

  const handleVideoSelect = (url, selectedMedia) => {
    setEventForm({ ...eventForm, video_url: url })
    setShowVideoGallery(false)
  }

  const handleSave = async () => {
    if (!store) return
    
    const eventData = {
      store_id: store.id,
      title: eventForm.title,
      description: eventForm.description,
      date: eventForm.date,
      time: eventForm.time || null,
      location: eventForm.location || null,
      image_url: eventForm.image_url || null,
      video_url: eventForm.video_url || null
    }

    let eventId = editingEvent?.id

    if (editingEvent) {
      const { error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', editingEvent.id)
      if (error) {
        alert('Gagal update: ' + error.message)
        return
      }
      eventId = editingEvent.id
    } else {
      const { data, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()
      if (error) {
        alert('Gagal tambah: ' + error.message)
        return
      }
      eventId = data[0]?.id
    }

    // Tandai media sebagai used (jika ada gambar)
    if (eventForm.image_url && eventId) {
      try {
        const { data: mediaData } = await supabase
          .from('media_library')
          .select('id')
          .eq('file_url', eventForm.image_url)
          .maybeSingle()
        
        if (mediaData) {
          await markMediaAsUsed(
            [mediaData.id],
            { 
              type: 'event', 
              id: eventId, 
              name: eventForm.title || 'Event' 
            }
          )
          console.log('✅ Media marked as used for event:', eventId)
        }
      } catch (err) {
        console.error('Error marking media as used:', err)
      }
    }

    setShowModal(false)
    fetchStoreAndEvents(store.id)
  }

  const handleDelete = async (eventId) => {
    if (!confirm('Yakin hapus event ini?')) return

    const { data: eventData } = await supabase
      .from('events')
      .select('image_url, title')
      .eq('id', eventId)
      .single()

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
    
    if (error) {
      alert('Gagal hapus: ' + error.message)
      return
    }

    if (eventData?.image_url) {
      try {
        await unmarkMediaByEntity(eventId, 'event')
        console.log('✅ Media unmarked for event:', eventId)
      } catch (err) {
        console.error('Error unmarking media:', err)
      }
    }

    fetchStoreAndEvents(store.id)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>
  if (!store) return <div className="bg-black min-h-screen text-white p-8">Store tidak ditemukan</div>

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display">Manajemen Event</h1>
          <div className="flex gap-3">
            <button onClick={() => navigate('/admin/dashboard')} className="bg-gray-700 px-4 py-2 rounded-full text-sm">Kembali ke Dashboard</button>
            <button onClick={openAddModal} className="bg-yellow-500 text-black px-4 py-2 rounded-full text-sm flex items-center gap-1"><Plus size={16} /> Tambah Event</button>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 border-b border-white/10">
              <tr>
                <th className="p-3">Judul</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Lokasi</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 font-medium">{e.title}</td>
                  <td className="p-3 text-sm">{formatDate(e.date)} {e.time && `• ${e.time}`}</td>
                  <td className="p-3 text-sm text-gray-400">{e.location || '-'}</td>
                  <td className="p-3 flex gap-3">
                    <button onClick={() => openEditModal(e)} className="text-blue-400 hover:text-blue-300"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan="4" className="p-3 text-center text-gray-500">Belum ada event</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MODAL TAMBAH/EDIT EVENT ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h3 className="text-xl font-display mb-4">{editingEvent ? 'Edit Event' : 'Tambah Event'}</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Judul event" className="w-full p-2 rounded bg-black/50 border border-white/20" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
              <textarea placeholder="Deskripsi" rows="3" className="w-full p-2 rounded bg-black/50 border border-white/20" value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} />
              <input type="date" className="w-full p-2 rounded bg-black/50 border border-white/20" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} />
              <input type="time" className="w-full p-2 rounded bg-black/50 border border-white/20" value={eventForm.time} onChange={e => setEventForm({...eventForm, time: e.target.value})} />
              <input type="text" placeholder="Lokasi (opsional)" className="w-full p-2 rounded bg-black/50 border border-white/20" value={eventForm.location} onChange={e => setEventForm({...eventForm, location: e.target.value})} />
              
              {/* ===== GAMBAR ===== */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL Gambar</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 p-2 rounded bg-black/50 border border-white/20" 
                    placeholder="https://..."
                    value={eventForm.image_url}
                    onChange={e => setEventForm({...eventForm, image_url: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMediaGallery(true)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    🖼️ Pilih Gambar
                  </button>
                </div>
                {eventForm.image_url && (
                  <img src={eventForm.image_url} className="h-16 w-16 object-cover rounded mt-2" alt="preview" />
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
                    value={eventForm.video_url}
                    onChange={e => setEventForm({...eventForm, video_url: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowVideoGallery(true)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    🎬 Pilih Video
                  </button>
                </div>
                {eventForm.video_url && (
                  <p className="text-xs text-gray-400 mt-1">Video URL: {eventForm.video_url}</p>
                )}
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