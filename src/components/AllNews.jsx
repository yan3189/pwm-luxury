import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Calendar, ArrowRight } from 'lucide-react'

export default function AllNews() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllNews()
  }, [])

  const fetchAllNews = async () => {
    const { data, error } = await supabase
      .from('news')
      .select(`
        *,
        stores (
          name,
          slug
        )
      `)
      .order('published_at', { ascending: false })
      .limit(6)
    
    if (error) {
      console.error('Error fetching news:', error)
    } else {
      setNews(data || [])
    }
    setLoading(false)
  }

  if (loading) return <div className="text-center py-8 text-gray-400">Memuat berita...</div>
  if (news.length === 0) return null

  return (
    <div className="py-16 px-4 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="inline-block mb-2 px-3 py-1 bg-yellow-500/10 rounded-full">
          <p className="text-yellow-500 text-xs font-semibold tracking-wide">LATEST UPDATES</p>
        </div>
        <h2 className="text-3xl md:text-4xl font-display font-bold tracking-wide">Berita & Promo Terbaru</h2>
        <p className="text-gray-400 mt-1">Update dari semua store partner kami</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {news.map((item) => (
          <Link key={item.id} to={`/store/${item.stores?.slug}`} className="group block">
            <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/50 transition-all duration-300 hover:-translate-y-1">
              {item.image_url && (
                <img src={item.image_url} alt={item.title} className="w-full h-40 object-cover group-hover:scale-105 transition duration-500" />
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <Calendar size={12} className="text-yellow-500" />
                  <span>{new Date(item.published_at).toLocaleDateString('id-ID')}</span>
                  <span className="text-yellow-500">•</span>
                  <span>{item.stores?.name}</span>
                </div>
                <h3 className="font-bold text-lg line-clamp-2 group-hover:text-yellow-400 transition">{item.title}</h3>
                <p className="text-gray-400 text-sm mt-2 line-clamp-2">{item.excerpt}</p>
                <div className="mt-3 flex items-center gap-1 text-yellow-500 text-sm group-hover:gap-2 transition-all">
                  Baca selengkapnya <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}