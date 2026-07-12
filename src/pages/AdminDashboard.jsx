// ============================================================
// ADMIN DASHBOARD - UNTUK SUPER ADMIN & STORE ADMIN
// ============================================================
// Fitur:
// - Preview data terbaru (produk, artikel, event, member, pesan, pesanan)
// - Edit profil store (logo, gambar, lokasi, dll)
// - Laporan penjualan (daftar transaksi selesai + ringkasan)
// - Export Excel (4 sheet: Daftar Transaksi, Detail Item, Favorit vs Non, Dampak Diskon)
// ============================================================

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { 
  Package, Newspaper, Calendar, Users, MessageCircle, 
  ShoppingBag, Edit, ExternalLink, Image, Settings, Gift , Truck, UserPlus, X, FileSpreadsheet
} from 'lucide-react'
import LocationPicker from '../components/LocationPicker'
import * as XLSX from 'xlsx'
import ImportProductsModal from '../components/ImportProductsModal';
import MediaGallery from '../components/MediaGallery'
import { calculateDiscountedPrice, interpretDiscount } from '../utils/priceUtils'; // DS001

export default function AdminDashboard() {
  // -------------------- STATE DASAR --------------------
  const [store, setStore] = useState(null)
  const [storesList, setStoresList] = useState([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [storeId, setStoreId] = useState(null)
  const [selectedStoreId, setSelectedStoreId] = useState(null)
  const [showStoreModal, setShowStoreModal] = useState(false)
const [showImportModal, setShowImportModal] = useState(false);

  // -------------------- PREVIEW DATA (3 item terbaru) --------------------
  const [recentProducts, setRecentProducts] = useState([])
  const [recentNews, setRecentNews] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [recentMembers, setRecentMembers] = useState([])
  const [recentMessages, setRecentMessages] = useState([])
  const [recentOrders, setRecentOrders] = useState([])

  // -------------------- LAPORAN --------------------
  const [reportPeriod, setReportPeriod] = useState('month')
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)
  const [reportLoading, setReportLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)

  // Data hasil laporan
  const [orderList, setOrderList] = useState([])
  const [rawOrders, setRawOrders] = useState([])
  const [rawOrderItems, setRawOrderItems] = useState([])
  const [discountImpact, setDiscountImpact] = useState(null)
  const [featuredVsNonFeatured, setFeaturedVsNonFeatured] = useState([])

  // -------------------- FORM EDIT STORE --------------------
  const [storeForm, setStoreForm] = useState({
    name: '', description: '', logo: '', background_image: '', cover_image: '',
    video_preview: '', category: 'club', alamat: '', latitude: '', longitude: '',instagram_url: '',tiktok_url: '' 
  })

  const navigate = useNavigate()
const [showImagePicker, setShowImagePicker] = useState(false);
const [pickerField, setPickerField] = useState('');
const [user, setUser] = useState(null); 

// ============================================================
// HANDLE PILIH MEDIA DARI GALERI (UNTUK EDIT STORE)
// ============================================================
const handleStoreMediaSelect = (url, selectedMedia) => {
  // Update field yang sesuai
  setStoreForm(prev => ({
    ...prev,
    [pickerField]: url
  }));
  setShowImagePicker(false);
  setPickerField('');
};

  // ============================================================
  // 1. CEK USER & AMBIL DATA AWAL
  // ============================================================
  useEffect(() => { checkUser() }, [])

  const checkUser = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/admin/login'); return }
setUser(user);

    const { data: userData, error } = await supabase
      .from('users').select('role, store_id').eq('id', user.id).single()
    if (error) { console.error(error); setLoading(false); return }

    setUserRole(userData.role)

    if (userData.role === 'super_admin') {
      const { data: allStores } = await supabase.from('stores').select('id, name').order('name')
      setStoresList(allStores || [])
      if (allStores?.length) {
        setSelectedStoreId(allStores[0].id)
        await fetchDashboardData(allStores[0].id)
      }
      setLoading(false)
    } else if (userData.store_id) {
      setStoreId(userData.store_id)
      setSelectedStoreId(userData.store_id)
      await fetchDashboardData(userData.store_id)
      setLoading(false)
    } else {
      setLoading(false)
    }
  }

  // ============================================================
// TAMBAHKAN DI BAGIAN SUPER ADMIN RENDER
// ============================================================

// 1. Tambahkan state untuk modal
const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
const [newAdminForm, setNewAdminForm] = useState({
  email: '',
  full_name: '',
  phone: '',
  password: '',
  store_id: ''
});
const [creatingAdmin, setCreatingAdmin] = useState(false);
const [generatedPassword, setGeneratedPassword] = useState('');

// 2. Fungsi generate password
const generatePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// 3. Fungsi create store admin
// ============================================================
// FUNGSI CREATE STORE ADMIN (PAKAI API ROUTE)
// ============================================================
const handleCreateStoreAdmin = async () => {
  const { email, full_name, phone, password, store_id } = newAdminForm;
  
  if (!email || !full_name || !password || !store_id) {
    alert('Semua field wajib diisi!');
    return;
  }

  // ✅ Trim & lowercase
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = full_name.trim();

  setCreatingAdmin(true);

  try {
    console.log('📤 Creating store admin with email:', cleanEmail);
    
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: password,
        full_name: cleanName,
        phone: phone?.trim() || '',
        role: 'store_admin',
        store_id: store_id
      })
    });

    // ✅ Cek response
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Gagal membuat akun');
    }

    alert(`✅ Akun Store Admin berhasil dibuat!\n\nEmail: ${cleanEmail}\nPassword: ${password}\n\nSimpan password ini dengan aman.`);
    
    setShowCreateAdminModal(false);
    setNewAdminForm({ email: '', full_name: '', phone: '', password: '', store_id: '' });
    setGeneratedPassword('');

  } catch (error) {
    console.error('❌ Error:', error);
    alert('Gagal membuat akun: ' + error.message);
  }

  setCreatingAdmin(false);
};

  // Ambil data dashboard (store info + preview)
  const fetchDashboardData = async (targetStoreId) => {
    if (!targetStoreId) return
    const { data: storeData } = await supabase.from('stores').select('*').eq('id', targetStoreId).single()
    setStore(storeData)
    if (storeData) {
      setStoreForm({
        name: storeData.name || '', description: storeData.description || '',
        logo: storeData.logo || '', background_image: storeData.background_image || '',
        cover_image: storeData.cover_image || '', video_preview: storeData.video_preview || '',
        category: storeData.category || 'club', alamat: storeData.alamat || '',
        latitude: storeData.latitude || '', longitude: storeData.longitude || '',instagram_url: storeData.instagram_url || '',
tiktok_url: storeData.tiktok_url || ''
      })
    }

    const fetchLimit = (table, field) => supabase.from(table).select('*').eq('store_id', targetStoreId).order(field, { ascending: false }).limit(3)
    const products = await fetchLimit('products', 'created_at')
    const news = await fetchLimit('news', 'published_at')
    const events = await supabase.from('events').select('*').eq('store_id', targetStoreId).order('date', { ascending: true }).limit(3)
    const members = await supabase.from('users').select('*').eq('role', 'member').order('created_at', { ascending: false }).limit(3)
    const messages = await supabase.from('contact_messages').select('*').eq('store_id', targetStoreId).order('created_at', { ascending: false }).limit(3)
    const orders = await supabase.from('orders').select('*').eq('store_id', targetStoreId).order('created_at', { ascending: false }).limit(3)

    setRecentProducts(products.data || [])
    setRecentNews(news.data || [])
    setRecentEvents(events.data || [])
    setRecentMembers(members.data || [])
    setRecentMessages(messages.data || [])
    setRecentOrders(orders.data || [])
  }

  // ============================================================
  // 2. LAPORAN PENJUALAN (DAFTAR TRANSAKSI + RINGKASAN)
  // ============================================================
  const [upsellReport, setUpsellReport] = useState([]);
const [showUpsellReport, setShowUpsellReport] = useState(false);
const [upsellReportLoading, setUpsellReportLoading] = useState(false);
  
  const fetchSalesReport = async () => {
    const targetStoreId = userRole === 'super_admin' ? selectedStoreId : storeId
    if (!targetStoreId) return
    setReportLoading(true)

    try {
      // ✅ Ambil semua order dengan status delivered, filter periode
            let query = supabase
              .from('orders')
              .select('id, order_number, total_amount, final_total, shipping_cost, voucher_discount, created_at, status, upsell_items')
              .eq('store_id', targetStoreId)
              .eq('status', 'delivered')
              .order('created_at', { ascending: false });

            // DS001: Filter periode
            const now = new Date();
            if (reportPeriod === 'month') {
              const startDate = new Date(reportYear, reportMonth - 1, 1).toISOString();
              const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59).toISOString(); // akhir bulan
              query = query.gte('created_at', startDate).lte('created_at', endDate);
            } else if (reportPeriod === 'year') {
              const startDate = new Date(reportYear, 0, 1).toISOString();
              const endDate = new Date(reportYear, 11, 31, 23, 59, 59).toISOString();
              query = query.gte('created_at', startDate).lte('created_at', endDate);
            }

            const { data: orders, error } = await query;

      if (error) throw error
      if (!orders || orders.length === 0) {
        setOrderList([]); setRawOrders([]); setRawOrderItems([])
        setDiscountImpact(null); setFeaturedVsNonFeatured([])
        setReportLoading(false); return
      }

      setRawOrders(orders)

      // ✅ Format untuk ditampilkan di web: gunakan final_total
      const formatted = orders.map(o => ({
        order_number: o.order_number,
        tanggal: new Date(o.created_at).toLocaleDateString('id-ID'),
        total: o.final_total || o.total_amount,
        shipping_cost: o.shipping_cost || 0,
        voucher_discount: o.voucher_discount || 0,
        status: o.status,
        upsell_items: o.upsell_items || []
      }))
      setOrderList(formatted)

      // Ambil semua order_items dari order ini
      const orderIds = orders.map(o => o.id)
      const { data: items } = await supabase.from('order_items').select('*').in('order_id', orderIds)
      setRawOrderItems(items || [])

      // ✅ Hitung dampak diskon dari semua item (cart + upsell)
      let seharusnya = 0, realisasi = 0, diskonItems = 0
      const allItems = [...(items || [])]
      
      // DS001: Gunakan calculateDiscountedPrice untuk menghitung diskon upsell
          orders.forEach(order => {
            if (order.upsell_items && Array.isArray(order.upsell_items)) {
              order.upsell_items.forEach(upsell => {
                const origPrice = upsell.price || 0;
                const qty = upsell.quantity || 1;
                const hasDiscount = upsell.has_discount && upsell.discount_value > 0;
                const discPrice = hasDiscount
                  ? calculateDiscountedPrice(origPrice, upsell.has_discount, upsell.discount_value)
                  : origPrice;
                seharusnya += origPrice * qty;
                realisasi += discPrice * qty;
                if (origPrice > discPrice) diskonItems++;
              })
            }
          })
      
      // Hitung dari order_items
      if (items) {
        items.forEach(it => {
          const orig = it.original_price || it.price || 0
          const disc = it.discounted_price || it.price || 0
          seharusnya += orig * it.quantity
          realisasi += disc * it.quantity
          if (orig > disc) diskonItems++
        })
      }
      
      setDiscountImpact({ seharusnya, realisasi, total_diskon: seharusnya - realisasi, diskonItems })

      // ✅ Hitung favorit vs non-favorit (dari semua item)
      const productIds = [...new Set((items || []).map(i => i.product_id).filter(id => id))]
      let productsMap = new Map()
      if (productIds.length) {
        const { data: prods } = await supabase.from('products').select('id, is_featured').in('id', productIds)
        if (prods) prods.forEach(p => productsMap.set(p.id, p))
      }
      
      let featuredQty = 0, featuredSales = 0, nonFeaturedQty = 0, nonFeaturedSales = 0
      const totalRevenue = orders.reduce((s, o) => s + (o.final_total || o.total_amount), 0)
      
      // Hitung dari order_items
      if (items) {
        items.forEach(it => {
          const isFeat = productsMap.get(it.product_id)?.is_featured || false
          const itemTotal = it.subtotal || (it.discounted_price || it.price || 0) * it.quantity
          if (isFeat) {
            featuredQty += it.quantity
            featuredSales += itemTotal
          } else {
            nonFeaturedQty += it.quantity
            nonFeaturedSales += itemTotal
          }
        })
      }
      
      // Hitung dari upsell_items
      orders.forEach(order => {
        if (order.upsell_items && Array.isArray(order.upsell_items)) {
          order.upsell_items.forEach(upsell => {
            const isFeat = productsMap.get(upsell.product_id)?.is_featured || false
            const price = upsell.discounted_price || upsell.price || 0
            const qty = upsell.quantity || 1
            const itemTotal = price * qty
            if (isFeat) {
              featuredQty += qty
              featuredSales += itemTotal
            } else {
              nonFeaturedQty += qty
              nonFeaturedSales += itemTotal
            }
          })
        }
      })
      
      setFeaturedVsNonFeatured([
        { type: 'Favorit', total_qty: featuredQty, total_sales: featuredSales, percentage: totalRevenue ? (featuredSales / totalRevenue * 100).toFixed(1) : 0 },
        { type: 'Non Favorit', total_qty: nonFeaturedQty, total_sales: nonFeaturedSales, percentage: totalRevenue ? (nonFeaturedSales / totalRevenue * 100).toFixed(1) : 0 }
      ])

    } catch (err) { console.error(err) }
    setReportLoading(false)
  }

        // ============================================================
        // LAPORAN KHUSUS UPSEL
        // ============================================================
        const fetchUpsellReport = async () => {
          const targetStoreId = userRole === 'super_admin' ? selectedStoreId : storeId;
          if (!targetStoreId) return;
          setUpsellReportLoading(true);

          try {
            // Filter periode
            let query = supabase
              .from('orders')
              .select('id, order_number, upsell_items, created_at')
              .eq('store_id', targetStoreId)
              .eq('status', 'delivered')
              .order('created_at', { ascending: false });

            const now = new Date();
            if (reportPeriod === 'month') {
              const startDate = new Date(reportYear, reportMonth - 1, 1).toISOString();
              const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59).toISOString();
              query = query.gte('created_at', startDate).lte('created_at', endDate);
            } else if (reportPeriod === 'year') {
              const startDate = new Date(reportYear, 0, 1).toISOString();
              const endDate = new Date(reportYear, 11, 31, 23, 59, 59).toISOString();
              query = query.gte('created_at', startDate).lte('created_at', endDate);
            }

            const { data: orders, error } = await query;
            if (error) throw error;

            // Kumpulkan semua upsell items
            const upsellItems = [];
            orders.forEach(order => {
              if (order.upsell_items && Array.isArray(order.upsell_items)) {
                order.upsell_items.forEach(item => {
                  const origPrice = item.price || 0;
                  const qty = item.quantity || 1;
                  const hasDiscount = item.has_discount && item.discount_value > 0;
                  const discPrice = hasDiscount
                    ? calculateDiscountedPrice(origPrice, item.has_discount, item.discount_value)
                    : origPrice;
                  upsellItems.push({
                    order_number: order.order_number,
                    tanggal: new Date(order.created_at).toLocaleDateString('id-ID'),
                    nama_produk: item.name || 'Produk Upsell',
                    qty: qty,
                    harga_normal: origPrice,
                    harga_diskon: discPrice,
                    total: discPrice * qty,
                    has_discount: hasDiscount,
                    discount_value: item.discount_value || 0
                  });
                });
              }
            });

            setUpsellReport(upsellItems);
          } catch (err) {
            console.error(err);
          }
          setUpsellReportLoading(false);
        };

                // // ============================================================
              // 3. EXPORT KE EXCEL (4 SHEET) - DIPERBAIKI (UPSEL DISKON)
              // ============================================================
              const exportToExcel = () => {
                // ============================================================
                // Sheet 1: Daftar Transaksi
                // ============================================================
                const transactionData = rawOrders.map(o => ({
                  'Nomor Order': o.order_number,
                  'Tanggal': new Date(o.created_at).toLocaleDateString('id-ID'),
                  'Total Bayar': o.final_total || o.total_amount,
                  'Ongkos Kirim': o.shipping_cost || 0,
                  'Diskon Voucher': o.voucher_discount || 0,
                  'Status': o.status
                }))

                // ============================================================
                // Sheet 2: Detail Item (CART + UPSEL)
                // ============================================================
                const orderMap = new Map(rawOrders.map(o => [o.id, o.order_number]))
                
                // --- Data dari order_items (CART) ---
                const cartItemData = rawOrderItems.map(it => ({
                  'Nomor Order': orderMap.get(it.order_id) || '-',
                  'Nama Produk': it.product_name,
                  'Quantity': it.quantity,
                  'Harga Satuan': it.original_price || it.price || 0,
                  'Diskon %': it.discount_percentage || 0,
                  'Harga Setelah Diskon': it.discounted_price || it.price || 0,
                  'Subtotal': it.subtotal || (it.discounted_price || it.price || 0) * it.quantity
                }))

                // --- Data dari upsell_items (UPSEL) ---
                let upsellItemData = []
                rawOrders.forEach(order => {
                  if (order.upsell_items && Array.isArray(order.upsell_items)) {
                    order.upsell_items.forEach(upsell => {
                      const origPrice = upsell.price || 0;
                      const qty = upsell.quantity || 1;
                      const hasDiscount = upsell.has_discount && upsell.discount_value > 0;
                      const discPrice = hasDiscount
                        ? calculateDiscountedPrice(origPrice, upsell.has_discount, upsell.discount_value)
                        : origPrice;
                      
                      upsellItemData.push({
                        'Nomor Order': order.order_number,
                        'Nama Produk': upsell.name || 'Produk Upsell',
                        'Quantity': qty,
                        'Harga Satuan': origPrice,
                        'Diskon %': upsell.discount_value || 0,
                        'Harga Setelah Diskon': discPrice,
                        'Subtotal': discPrice * qty
                      })
                    })
                  }
                })

                // Gabungkan
                const allItemData = [...cartItemData, ...upsellItemData]

                // ============================================================
                // Sheet 3: Favorit vs Non-Favorit
                // ============================================================
                const featuredData = featuredVsNonFeatured.map(f => ({
                  'Tipe': f.type,
                  'Jumlah Terjual': f.total_qty,
                  'Omzet': f.total_sales,
                  'Kontribusi (%)': f.percentage
                }))

                // ============================================================
                // Sheet 4: Dampak Diskon
                // ============================================================
                const discountData = discountImpact ? [{
                  'Total Sebelum Diskon': discountImpact.seharusnya,
                  'Total Setelah Diskon': discountImpact.realisasi,
                  'Total Diskon': discountImpact.total_diskon,
                  'Item Mendapat Diskon': discountImpact.diskonItems
                }] : []

                // ============================================================
                // DS001: Sheet 5 - Laporan Upsell (khusus)
                // ============================================================
                const upsellSheetData = rawOrders.reduce((acc, order) => {
                  if (order.upsell_items && Array.isArray(order.upsell_items)) {
                    order.upsell_items.forEach(upsell => {
                      const origPrice = upsell.price || 0;
                      const qty = upsell.quantity || 1;
                      const hasDiscount = upsell.has_discount && upsell.discount_value > 0;
                      const discPrice = hasDiscount
                        ? calculateDiscountedPrice(origPrice, upsell.has_discount, upsell.discount_value)
                        : origPrice;
                      acc.push({
                        'Nomor Order': order.order_number,
                        'Tanggal': new Date(order.created_at).toLocaleDateString('id-ID'),
                        'Nama Produk': upsell.name || 'Produk Upsell',
                        'Qty': qty,
                        'Harga Normal': origPrice,
                        'Harga Diskon': hasDiscount ? discPrice : origPrice,
                        'Total': discPrice * qty
                      })
                    })
                  }
                  return acc;
                }, []);

                // ============================================================
                // BENTUK WORKBOOK & EXPORT
                // ============================================================
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transactionData), 'Daftar Transaksi')
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allItemData), 'Detail Item')
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(featuredData), 'Favorit vs Non')
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(discountData), 'Dampak Diskon')
                if (upsellSheetData.length > 0) {
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(upsellSheetData), 'Laporan Upsell')
                }

                XLSX.writeFile(wb, `laporan_penjualan_${new Date().toISOString().slice(0,10)}.xlsx`)
              }

  // ============================================================
  // 4. FUNGSI UTILITY LAIN (LOGOUT, UPDATE STORE, DLL)
  // ============================================================
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const handleUpdateStore = async () => {
    if (!store) return
    const { error } = await supabase.from('stores').update({
      name: storeForm.name, description: storeForm.description, logo: storeForm.logo,
      background_image: storeForm.background_image, cover_image: storeForm.cover_image,
      video_preview: storeForm.video_preview, category: storeForm.category,
      alamat: storeForm.alamat,
      latitude: storeForm.latitude ? parseFloat(storeForm.latitude) : null,
      longitude: storeForm.longitude ? parseFloat(storeForm.longitude) : null,
      instagram_url: storeForm.instagram_url || null,tiktok_url: storeForm.tiktok_url || null 
    }).eq('id', store.id)
    if (error) alert('Gagal update: ' + error.message)
    else { alert('Store berhasil diupdate'); setShowStoreModal(false); fetchDashboardData(store.id) }
  }

  const handleStoreChange = async (newStoreId) => {
    setSelectedStoreId(newStoreId)
    await fetchDashboardData(newStoreId)
  }

  // ============================================================
  // 5. RENDER UNTUK SUPER ADMIN (DENGAN DROPDOWN PILIH STORE)
  // ============================================================
  if (userRole === 'super_admin') {
    return (
      <div className="bg-black min-h-screen text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
  <div>
    <h1 className="text-3xl font-display">Super Admin Dashboard</h1>
    <p className="text-gray-400">Selamat datang, Super Admin</p>
  </div>
  <div className="flex gap-3">
    {/* ✅ TOMBOL IMPORT PRODUK - UNTUK SUPER ADMIN */}
    <button
      onClick={() => setShowImportModal(true)}
      className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full text-sm flex items-center gap-2 transition"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      Import Produk
    </button>
    <button 
  onClick={() => navigate('/admin/media')} 
  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-full text-sm transition"
>
  <Image size={16} /> Media
</button>
    <button
      onClick={() => {
        setGeneratedPassword(generatePassword());
        setNewAdminForm(prev => ({ ...prev, password: generatePassword() }));
        setShowCreateAdminModal(true);
      }}
      className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-full text-sm flex items-center gap-2 transition"
    >
      <UserPlus size={16} /> Buat Store Admin
    </button>
    <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-full text-sm">Logout</button>
  </div>
</div>

          {/* Pilih Store */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10 mb-6">
            <label className="block text-sm text-gray-400 mb-2">Pilih Store:</label>
            <select value={selectedStoreId || ''} onChange={e => handleStoreChange(e.target.value)} className="bg-black/50 border border-white/20 rounded-lg px-3 py-2 w-full md:w-64">
              {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Tombol Master Kategori */}
          <div className="mb-6 flex flex-wrap gap-3">
            <button onClick={() => navigate('/admin/master-categories')} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-full text-sm"><Settings size={16} /> Master Kategori</button>
          </div>



          {/* Preview Ringkasan (jumlah) */}
          {store && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
              <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><Package size={18} className="text-yellow-500 mb-2" /><p className="text-xs text-gray-400">Produk</p><p className="text-xl font-bold">{recentProducts.length}</p></div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><Newspaper size={18} className="text-yellow-500 mb-2" /><p className="text-xs text-gray-400">Artikel</p><p className="text-xl font-bold">{recentNews.length}</p></div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><Calendar size={18} className="text-yellow-500 mb-2" /><p className="text-xs text-gray-400">Event</p><p className="text-xl font-bold">{recentEvents.length}</p></div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><Users size={18} className="text-yellow-500 mb-2" /><p className="text-xs text-gray-400">Member</p><p className="text-xl font-bold">{recentMembers.length}</p></div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><MessageCircle size={18} className="text-yellow-500 mb-2" /><p className="text-xs text-gray-400">Pesan</p><p className="text-xl font-bold">{recentMessages.length}</p></div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><ShoppingBag size={18} className="text-yellow-500 mb-2" /><p className="text-xs text-gray-400">Pesanan</p><p className="text-xl font-bold">{recentOrders.length}</p></div>
            </div>
          )}

          {/* LAPORAN PENJUALAN */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-display">Laporan Penjualan - {store?.name || 'Pilih Store'}</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowReport(!showReport)} className="text-yellow-500 text-sm">{showReport ? 'Sembunyikan' : 'Tampilkan'}</button>
                {showReport && orderList.length > 0 && <button onClick={exportToExcel} className="bg-green-600 text-white px-3 py-1 rounded-full text-xs hover:bg-green-700">📎 Export Excel</button>}
              </div>
            </div>
            {showReport && (
              <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
                <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b border-white/10">
                  <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)} className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm">
                    <option value="month">Bulan Ini</option><option value="year">Tahun Ini</option>
                  </select>
                  {reportPeriod === 'month' && (
                    <select value={reportMonth} onChange={e => setReportMonth(parseInt(e.target.value))} className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm">
                      {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('id', { month: 'long' })}</option>)}
                    </select>
                  )}
                  <input type="number" value={reportYear} onChange={e => setReportYear(parseInt(e.target.value))} className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm w-24" />
                  <button onClick={fetchSalesReport} disabled={reportLoading || !store} className="bg-yellow-500 text-black px-4 py-1 rounded-full text-sm disabled:opacity-50">{reportLoading ? 'Memuat...' : 'Tampilkan'}</button>
                </div>

                {/* DAFTAR TRANSAKSI (tampilan web) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">📋 Daftar Transaksi Selesai</h3>
                    {orderList.length === 0 ? (
                      <p className="text-gray-500 text-sm">Belum ada transaksi selesai</p>
                    ) : (
                      <div className="border border-white/10 rounded-lg h-[360px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="text-gray-400 border-b border-white/10 sticky top-0 bg-gray-800 z-10">
                            <tr>
                              <th className="text-left py-2 px-2">Nomor Order</th>
                              <th className="text-left py-2 px-2">Tanggal</th>
                              <th className="text-right py-2 px-2">Total</th>
                              <th className="text-left py-2 px-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderList.map(order => (
                              <tr key={order.order_number} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-2 px-2 font-mono text-xs">{order.order_number}</td>
                                <td className="py-2 px-2">{order.tanggal}</td>
                                <td className="py-2 px-2 text-right text-yellow-500">Rp {order.total.toLocaleString()}</td>
                                <td className="py-2 px-2 capitalize">{order.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* RINGKASAN */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">📈 Ringkasan</h3>
                    {orderList.length > 0 ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Total Transaksi:</span><span className="font-bold">{orderList.length} transaksi</span></div>
                        <div className="flex justify-between"><span>Total Omzet:</span><span className="text-yellow-500 font-bold">Rp {orderList.reduce((s, o) => s + o.total, 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Rata-rata per Transaksi:</span><span>Rp {Math.round(orderList.reduce((s, o) => s + o.total, 0) / orderList.length).toLocaleString()}</span></div>
                        {discountImpact && discountImpact.total_diskon > 0 && (
                          <div className="flex justify-between"><span>Total Diskon Diberikan:</span><span className="text-red-400">Rp {discountImpact.total_diskon.toLocaleString()}</span></div>
                        )}
                        {featuredVsNonFeatured.length > 0 && (
                          <div className="flex justify-between"><span>Kontribusi Produk Favorit:</span><span className="text-yellow-500">{featuredVsNonFeatured.find(f => f.type === 'Favorit')?.percentage || 0}%</span></div>
                        )}
                        <div className="flex justify-between"><span>Total Ongkos Kirim:</span><span>Rp {rawOrders.reduce((sum, o) => sum + (o.shipping_cost || 0), 0).toLocaleString()}</span></div>
                      </div>
                    ) : <p className="text-gray-500 text-sm">Belum ada data</p>}
                  </div>

                  {/* DAMPAK DISKON */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">🏷️ Dampak Diskon</h3>
                    {discountImpact ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Total sebelum diskon:</span><span>Rp {discountImpact.seharusnya?.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Total setelah diskon:</span><span>Rp {discountImpact.realisasi?.toLocaleString()}</span></div>
                        <div className="flex justify-between font-bold text-yellow-500"><span>Total diskon diberikan:</span><span>Rp {discountImpact.total_diskon?.toLocaleString()}</span></div>
                        <div className="flex justify-between text-xs text-gray-400"><span>Item mendapat diskon:</span><span>{discountImpact.diskonItems} item</span></div>
                      </div>
                    ) : <p className="text-gray-500 text-sm">Belum ada data</p>}
                  </div>

                  {/* FAVORIT vs NON-FAVORIT */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">⭐ Penjualan Produk Favorit vs Non-Favorit</h3>
                    {featuredVsNonFeatured.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="text-gray-400 border-b border-white/10">
                          <tr><th className="text-left py-1">Tipe</th><th className="text-right">Qty</th><th className="text-right">Omzet</th><th className="text-right">Kontribusi</th></tr>
                        </thead>
                        <tbody>
                          {featuredVsNonFeatured.map(f => (
                            <tr key={f.type} className="border-b border-white/5">
                              <td className="py-1">{f.type}</td>
                              <td className="text-right">{f.total_qty}</td>
                              <td className="text-right">Rp {f.total_sales?.toLocaleString()}</td>
                              <td className="text-right text-yellow-500">{f.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-gray-500 text-sm">Belum ada data</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

{/* ===== MODAL CREATE STORE ADMIN ===== */}
{showCreateAdminModal && (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-display">Buat Akun Store Admin</h2>
        <button 
          onClick={() => setShowCreateAdminModal(false)} 
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Nama Lengkap */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nama Lengkap *</label>
          <input
            type="text"
            className="w-full p-2 rounded bg-black/50 border border-white/20"
            value={newAdminForm.full_name}
            onChange={(e) => setNewAdminForm({ ...newAdminForm, full_name: e.target.value })}
            placeholder="Nama Store Admin"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email *</label>
          <input
            type="email"
            className="w-full p-2 rounded bg-black/50 border border-white/20"
            value={newAdminForm.email}
            onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
            placeholder="admin@store.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nomor Telepon</label>
          <input
            type="tel"
            className="w-full p-2 rounded bg-black/50 border border-white/20"
            value={newAdminForm.phone}
            onChange={(e) => setNewAdminForm({ ...newAdminForm, phone: e.target.value })}
            placeholder="08123456789"
          />
        </div>

        {/* Password (auto-generated) */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Password *</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 p-2 rounded bg-black/50 border border-white/20 font-mono"
              value={newAdminForm.password}
              onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
              placeholder="Password otomatis"
            />
            <button
              onClick={() => {
                const newPass = generatePassword();
                setNewAdminForm({ ...newAdminForm, password: newPass });
                setGeneratedPassword(newPass);
              }}
              className="bg-gray-700 px-3 py-2 rounded-lg hover:bg-gray-600 transition text-sm"
              title="Generate password baru"
            >
              🔄
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Klik tombol 🔄 untuk generate password otomatis</p>
        </div>

        {/* Pilih Store */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Pilih Store *</label>
          <select
            className="w-full p-2 rounded bg-black/50 border border-white/20"
            value={newAdminForm.store_id}
            onChange={(e) => setNewAdminForm({ ...newAdminForm, store_id: e.target.value })}
          >
            <option value="">-- Pilih Store --</option>
            {storesList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleCreateStoreAdmin}
          disabled={creatingAdmin}
          className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded-lg font-semibold disabled:opacity-50 transition"
        >
          {creatingAdmin ? 'Memproses...' : 'Buat Akun'}
        </button>
        <button
          onClick={() => setShowCreateAdminModal(false)}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
        >
          Batal
        </button>
      </div>
    </div>
  </div>
)}


      {/* ===== MODAL IMPORT PRODUK ===== */}
      <ImportProductsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        userRole={userRole}
        stores={storesList}
        selectedStoreId={selectedStoreId}
        onImportComplete={() => {
          fetchDashboardData(selectedStoreId);
        }}
      />
      </div>
    )
  }

  // ============================================================
  // 6. RENDER UNTUK STORE ADMIN (TANPA DROPDOWN STORE)
  // ============================================================
  if (loading) return <div className="bg-black min-h-screen text-white p-8">Loading...</div>
  if (!store) return <div className="bg-black min-h-screen text-white p-8">Store tidak ditemukan. Pastikan akun admin terhubung ke store.</div>

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="text-3xl font-display">Dashboard Store</h1><p className="text-gray-400">{store.name}</p></div>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-full text-sm">Logout</button>
        </div>

        {/* Tombol aksi */}
        <div className="mb-6 flex flex-wrap gap-3 justify-end">
          {(userRole === 'super_admin' || userRole === 'store_admin') && (
            <button onClick={() => navigate('/admin/create-user')} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-full text-sm transition">
              <UserPlus size={16} /> Buat Akun
            </button>
          )}
          {(userRole === 'super_admin' || userRole === 'store_admin') && (
            <button onClick={() => navigate('/admin/members')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full text-sm transition">
              <Users size={16} /> Kelola Member
            </button>
          )}
          <button onClick={() => setShowStoreModal(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-full text-sm"><Edit size={16} /> Edit Profil Store</button>
          <button onClick={() => navigate('/admin/shipping')} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-full text-sm"><Truck size={16} /> Pengaturan Ongkir</button>
          <button onClick={() => navigate('/admin/store-categories')} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-full text-sm"><Package size={16} /> Atur Kategori Store</button>
          <button onClick={() => navigate('/admin/stock')} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-full text-sm transition">
            <Package size={16} /> Manajemen Stok
          </button>
          <button onClick={() => navigate('/admin/promotions')} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-full text-sm transition">
            <Gift size={16} /> Promosi
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-full text-sm transition"
          >
            <FileSpreadsheet size={16} /> Import Produk
          </button>
          <button 
  onClick={() => navigate('/admin/media')} 
  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-full text-sm transition"
>
  <Image size={16} /> Media
</button>
        </div>

        {/* Preview 6 card (produk, artikel, event, member, pesan, pesanan) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><div className="flex justify-between mb-2"><Package size={18} className="text-yellow-500" /><button onClick={() => navigate('/admin/products')} className="text-yellow-500 text-xs">Kelola</button></div>{recentProducts.map(p => <div key={p.id} className="flex justify-between text-xs py-1"><span className="truncate">{p.name}</span><span className="text-yellow-500">Rp {p.price.toLocaleString()}</span></div>)}{recentProducts.length === 0 && <p className="text-gray-500 text-center text-xs">Belum ada produk</p>}</div>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><div className="flex justify-between mb-2"><Newspaper size={18} className="text-yellow-500" /><button onClick={() => navigate('/admin/news')} className="text-yellow-500 text-xs">Kelola</button></div>{recentNews.map(n => <div key={n.id} className="text-xs py-1 truncate">{n.title}</div>)}{recentNews.length === 0 && <p className="text-gray-500 text-center text-xs">Belum ada artikel</p>}</div>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><div className="flex justify-between mb-2"><Calendar size={18} className="text-yellow-500" /><button onClick={() => navigate('/admin/events')} className="text-yellow-500 text-xs">Kelola</button></div>{recentEvents.map(e => <div key={e.id} className="text-xs py-1 truncate">{e.title}</div>)}{recentEvents.length === 0 && <p className="text-gray-500 text-center text-xs">Belum ada event</p>}</div>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><div className="flex justify-between mb-2"><Users size={18} className="text-yellow-500" /><button onClick={() => navigate('/admin/members')} className="text-yellow-500 text-xs">Kelola</button></div>{recentMembers.map(m => <div key={m.id} className="text-xs py-1 truncate">{m.full_name || m.email}<span className="text-yellow-500 ml-1">{m.points || 0} poin</span></div>)}{recentMembers.length === 0 && <p className="text-gray-500 text-center text-xs">Belum ada member</p>}</div>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10"><div className="flex justify-between mb-2"><MessageCircle size={18} className="text-yellow-500" /><button onClick={() => navigate('/admin/contacts')} className="text-yellow-500 text-xs">Kelola</button></div>{recentMessages.map(m => <div key={m.id} className="text-xs py-1 truncate font-medium">{m.name}<span className="text-gray-400 ml-1">{m.message?.substring(0, 20)}</span></div>)}{recentMessages.length === 0 && <p className="text-gray-500 text-center text-xs">Belum ada pesan</p>}</div>
          {/* Card Order Preview */}
<div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
  <div className="flex justify-between mb-2">
    <ShoppingBag size={18} className="text-yellow-500" />
    <button onClick={() => navigate('/admin/orders')} className="text-yellow-500 text-xs">Kelola</button>
  </div>
  {recentOrders.map(o => {
    // ✅ Gunakan final_total jika ada
    const totalDisplay = o.final_total || o.total_amount;
    return (
      <div key={o.id} className="text-xs py-1">
        <span>#{o.order_number}</span>
        <span className="text-yellow-500 ml-1">Rp {totalDisplay.toLocaleString()}</span>
        <span className="text-gray-400 ml-1 capitalize">{o.status}</span>
      </div>
    );
  })}
  {recentOrders.length === 0 && <p className="text-gray-500 text-center text-xs">Belum ada pesanan</p>}
</div>
        </div>

        {/* LAPORAN PENJUALAN */}
        <div className="mt-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-display">Laporan Penjualan</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowReport(!showReport)} className="text-yellow-500 text-sm">{showReport ? 'Sembunyikan' : 'Tampilkan'}</button>
              {showReport && orderList.length > 0 && <button onClick={exportToExcel} className="bg-green-600 text-white px-3 py-1 rounded-full text-xs hover:bg-green-700">📎 Export Excel</button>}
            </div>
          </div>
          {showReport && (
            <div className="bg-gray-900/50 rounded-xl p-5 border border-white/10">
              <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b border-white/10">
                <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)} className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm">
                  <option value="month">Bulan Ini</option><option value="year">Tahun Ini</option>
                </select>
                {reportPeriod === 'month' && (
                  <select value={reportMonth} onChange={e => setReportMonth(parseInt(e.target.value))} className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm">
                    {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('id', { month: 'long' })}</option>)}
                  </select>
                )}
                <input type="number" value={reportYear} onChange={e => setReportYear(parseInt(e.target.value))} className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm w-24" />
                <button onClick={fetchSalesReport} disabled={reportLoading} className="bg-yellow-500 text-black px-4 py-1 rounded-full text-sm disabled:opacity-50">{reportLoading ? 'Memuat...' : 'Tampilkan'}</button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* DAFTAR TRANSAKSI */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">📋 Daftar Transaksi Selesai</h3>
                  {orderList.length === 0 ? (
                    <p className="text-gray-500 text-sm">Belum ada transaksi selesai</p>
                  ) : (
                    <div className="border border-white/10 rounded-lg h-[360px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="text-gray-400 border-b border-white/10 sticky top-0 bg-gray-800 z-10">
                          <tr>
                            <th className="text-left py-2 px-2">Nomor Order</th>
                            <th className="text-left py-2 px-2">Tanggal</th>
                            <th className="text-right py-2 px-2">Total</th>
                            <th className="text-left py-2 px-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderList.map(order => (
                            <tr key={order.order_number} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-2 px-2 font-mono text-xs">{order.order_number}</td>
                              <td className="py-2 px-2">{order.tanggal}</td>
                              <td className="py-2 px-2 text-right text-yellow-500">Rp {order.total.toLocaleString()}</td>
                              <td className="py-2 px-2 capitalize">{order.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* RINGKASAN */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">📈 Ringkasan</h3>
                  {orderList.length > 0 ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Total Transaksi:</span><span className="font-bold">{orderList.length} transaksi</span></div>
                      <div className="flex justify-between"><span>Total Omzet:</span><span className="text-yellow-500 font-bold">Rp {orderList.reduce((s, o) => s + o.total, 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Rata-rata per Transaksi:</span><span>Rp {Math.round(orderList.reduce((s, o) => s + o.total, 0) / orderList.length).toLocaleString()}</span></div>
                      {discountImpact && discountImpact.total_diskon > 0 && (
                        <div className="flex justify-between"><span>Total Diskon Diberikan:</span><span className="text-red-400">Rp {discountImpact.total_diskon.toLocaleString()}</span></div>
                      )}
                      {featuredVsNonFeatured.length > 0 && (
                        <div className="flex justify-between"><span>Kontribusi Produk Favorit:</span><span className="text-yellow-500">{featuredVsNonFeatured.find(f => f.type === 'Favorit')?.percentage || 0}%</span></div>
                      )}
                      <div className="flex justify-between"><span>Total Ongkos Kirim:</span><span>Rp {rawOrders.reduce((sum, o) => sum + (o.shipping_cost || 0), 0).toLocaleString()}</span></div>
                    </div>
                  ) : <p className="text-gray-500 text-sm">Belum ada data</p>}
                </div>

                {/* DAMPAK DISKON */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">🏷️ Dampak Diskon</h3>
                  {discountImpact ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Total sebelum diskon:</span><span>Rp {discountImpact.seharusnya?.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Total setelah diskon:</span><span>Rp {discountImpact.realisasi?.toLocaleString()}</span></div>
                      <div className="flex justify-between font-bold text-yellow-500"><span>Total diskon diberikan:</span><span>Rp {discountImpact.total_diskon?.toLocaleString()}</span></div>
                      <div className="flex justify-between text-xs text-gray-400"><span>Item mendapat diskon:</span><span>{discountImpact.diskonItems} item</span></div>
                    </div>
                  ) : <p className="text-gray-500 text-sm">Belum ada data</p>}
                </div>

                {/* FAVORIT vs NON-FAVORIT */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">⭐ Penjualan Produk Favorit vs Non-Favorit</h3>
                  {featuredVsNonFeatured.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="text-gray-400 border-b border-white/10">
                        <tr><th className="text-left py-1">Tipe</th><th className="text-right">Qty</th><th className="text-right">Omzet</th><th className="text-right">Kontribusi</th></tr>
                      </thead>
                      <tbody>
                        {featuredVsNonFeatured.map(f => (
                          <tr key={f.type} className="border-b border-white/5">
                            <td className="py-1">{f.type}</td>
                            <td className="text-right">{f.total_qty}</td>
                            <td className="text-right">Rp {f.total_sales?.toLocaleString()}</td>
                            <td className="text-right text-yellow-500">{f.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-gray-500 text-sm">Belum ada data</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

            {/* ===== MODAL EDIT STORE ===== */}
      {showStoreModal && store && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-display mb-4">Edit Profil Store</h2>
            <div className="space-y-4">
              
              {/* Nama Store */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nama Store</label>
                <input type="text" className="w-full p-2 rounded bg-black/50 border border-white/20" value={storeForm.name} onChange={e => setStoreForm({...storeForm, name: e.target.value})} />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Deskripsi</label>
                <textarea rows="2" className="w-full p-2 rounded bg-black/50 border border-white/20" value={storeForm.description} onChange={e => setStoreForm({...storeForm, description: e.target.value})} />
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                <select className="w-full p-2 rounded bg-black/50 border border-white/20" value={storeForm.category} onChange={e => setStoreForm({...storeForm, category: e.target.value})}>
                  <option value="bar">Bar</option>
                  <option value="club">Club</option>
                  <option value="coffee_shop">Coffee Shop</option>
                </select>
              </div>

              {/* ===== LOGO ===== */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Logo</label>
                <div className="flex gap-2">
                  <input type="text" className="flex-1 p-2 rounded bg-black/50 border border-white/20" placeholder="https://..." value={storeForm.logo} onChange={e => setStoreForm({...storeForm, logo: e.target.value})} />
                  <button
                    type="button"
                    onClick={() => {
                      setPickerField('logo');
                      setShowImagePicker(true);
                    }}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    🖼️ Pilih
                  </button>
                </div>
                {storeForm.logo && <img src={storeForm.logo} className="h-16 w-16 object-cover rounded-full mt-2" />}
              </div>

              {/* ===== BACKGROUND IMAGE ===== */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Background Image</label>
                <div className="flex gap-2">
                  <input type="text" className="flex-1 p-2 rounded bg-black/50 border border-white/20" placeholder="https://..." value={storeForm.background_image} onChange={e => setStoreForm({...storeForm, background_image: e.target.value})} />
                  <button
                    type="button"
                    onClick={() => {
                      setPickerField('background_image');
                      setShowImagePicker(true);
                    }}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    🖼️ Pilih
                  </button>
                </div>
                {storeForm.background_image && <img src={storeForm.background_image} className="h-20 w-full object-cover rounded mt-2" />}
              </div>

              {/* ===== COVER IMAGE ===== */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cover Image</label>
                <div className="flex gap-2">
                  <input type="text" className="flex-1 p-2 rounded bg-black/50 border border-white/20" placeholder="https://..." value={storeForm.cover_image} onChange={e => setStoreForm({...storeForm, cover_image: e.target.value})} />
                  <button
                    type="button"
                    onClick={() => {
                      setPickerField('cover_image');
                      setShowImagePicker(true);
                    }}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    🖼️ Pilih
                  </button>
                </div>
                {storeForm.cover_image && <img src={storeForm.cover_image} className="h-20 w-full object-cover rounded mt-2" />}
              </div>

              {/* ===== VIDEO PREVIEW ===== */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Video Preview</label>
                <div className="flex gap-2">
                  <input type="text" className="flex-1 p-2 rounded bg-black/50 border border-white/20" placeholder="https://..." value={storeForm.video_preview} onChange={e => setStoreForm({...storeForm, video_preview: e.target.value})} />
                  <button
                    type="button"
                    onClick={() => {
                      setPickerField('video_preview');
                      setShowImagePicker(true);
                    }}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    🎬 Pilih Video
                  </button>
                </div>
                {storeForm.video_preview && <p className="text-xs text-gray-400 mt-1">Video URL: {storeForm.video_preview}</p>}
              </div>

              {/* Alamat */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Alamat</label>
                <textarea rows="2" className="w-full p-2 rounded bg-black/50 border border-white/20" value={storeForm.alamat} onChange={e => setStoreForm({...storeForm, alamat: e.target.value})} />
              </div>

              {/* Lokasi Store (Peta) */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Lokasi Store (Peta)</label>
                <LocationPicker 
                  initialLat={storeForm.latitude ? parseFloat(storeForm.latitude) : null} 
                  initialLng={storeForm.longitude ? parseFloat(storeForm.longitude) : null} 
                  onLocationChange={(location) => { 
                    setStoreForm({ ...storeForm, 
                      latitude: location.lat.toString(), 
                      longitude: location.lng.toString(), 
                      alamat: location.address || storeForm.alamat 
                    }) 
                  }} 
                />
              </div>

              {/* ===== SOSIAL MEDIA ===== */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Sosial Media</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Instagram URL</label>
                    <input 
                      type="url" 
                      className="w-full p-2 rounded bg-black/50 border border-white/20" 
                      placeholder="https://instagram.com/..."
                      value={storeForm.instagram_url || ''}
                      onChange={e => setStoreForm({...storeForm, instagram_url: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">TikTok URL</label>
                    <input 
                      type="url" 
                      className="w-full p-2 rounded bg-black/50 border border-white/20" 
                      placeholder="https://tiktok.com/@..."
                      value={storeForm.tiktok_url || ''}
                      onChange={e => setStoreForm({...storeForm, tiktok_url: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex gap-3 mt-6">
              <button onClick={handleUpdateStore} className="bg-yellow-500 text-black px-4 py-2 rounded-full flex-1 font-semibold">Simpan</button>
              <button onClick={() => setShowStoreModal(false)} className="bg-gray-700 px-4 py-2 rounded-full">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL MEDIA GALLERY UNTUK EDIT STORE ===== */}
      {showImagePicker && (
        <div className="fixed inset-0 bg-black/80 z-50 p-4 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-display text-white">
                {pickerField === 'video_preview' ? 'Pilih Video' : 'Pilih Gambar'}
              </h2>
              <button onClick={() => { setShowImagePicker(false); setPickerField(''); }} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <MediaGallery
              storeId={store?.id}
              userId={user?.id}
              selectable={true}
              maxSelect={1}
              allowedTypes={pickerField === 'video_preview' ? 'video' : 'image'}
              onSelect={handleStoreMediaSelect}
            />
          </div>
        </div>
      )}

                  <ImportProductsModal
              isOpen={showImportModal}
              onClose={() => setShowImportModal(false)}
              userRole={userRole}
              selectedStoreId={store?.id}
              onSuccess={() => {
                // Refresh data setelah import
                fetchDashboardData(store?.id || selectedStoreId);
              }}
            />
    </div>
  )
}