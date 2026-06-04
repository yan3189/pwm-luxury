// src/services/searchService.js
import { supabase } from '../lib/supabase';

/**
 * Hitung jarak Haversine antara dua koordinat (km)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Global search: produk, toko, artikel (tanpa RPC)
 */
export async function globalSearch(query, userLat = -6.2088, userLng = 106.8456) {
  if (!query || query.length < 2) {
    return { products: [], stores: [], articles: [], total: 0 };
  }
  
  const searchTerm = `%${query}%`;
  
  // 1. Cari produk (tambahkan stores.slug)
const { data: products, error: productsError } = await supabase
  .from('products')
  .select(`
    id,
    name,
    price,
    image_url,
    store_id,
    stores (id, name, slug, latitude, longitude)
  `)
  .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
  .limit(5);
  
  if (productsError) console.error('Products search error:', productsError);
  
  // 2. Cari toko
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id, name, logo, latitude, longitude')
    .ilike('name', searchTerm)
    .limit(3);
  
  if (storesError) console.error('Stores search error:', storesError);
  
  // 3. Cari artikel
  const { data: articles, error: articlesError } = await supabase
    .from('news')
    .select(`
      id,
      title,
      image_url,
      store_id,
      stores (id, name, latitude, longitude)
    `)
    .or(`title.ilike.${searchTerm},excerpt.ilike.${searchTerm}`)
    .limit(3);
  
  if (articlesError) console.error('Articles search error:', articlesError);
  
  //distance product dari default address
  const productsWithDistance = (products || []).map(p => ({
  result_type: 'product',
  id: p.id,
  name: p.name,
  store_id: p.store_id,
  store_slug: p.stores?.slug,  // <-- TAMBAHKAN INI
  store_name: p.stores?.name,
  store_lat: p.stores?.latitude,
  store_lng: p.stores?.longitude,
  price: p.price,
  image_url: p.image_url,
  distance_km: p.stores?.latitude && p.stores?.longitude 
    ? haversineDistance(userLat, userLng, p.stores.latitude, p.stores.longitude)
    : null
}));
  
  // Hitung jarak untuk toko
  const storesWithDistance = (stores || []).map(s => ({
    result_type: 'store',
    id: s.id,
    name: s.name,
    store_id: null,
    store_name: null,
    store_lat: s.latitude,
    store_lng: s.longitude,
    price: null,
    image_url: s.logo,
    distance_km: s.latitude && s.longitude 
      ? haversineDistance(userLat, userLng, s.latitude, s.longitude)
      : null
  }));
  
  // Hitung jarak untuk artikel
  const articlesWithDistance = (articles || []).map(a => ({
    result_type: 'article',
    id: a.id,
    name: a.title,
    store_id: a.store_id,
    store_name: a.stores?.name,
    store_lat: a.stores?.latitude,
    store_lng: a.stores?.longitude,
    price: null,
    image_url: a.image_url,
    distance_km: a.stores?.latitude && a.stores?.longitude 
      ? haversineDistance(userLat, userLng, a.stores.latitude, a.stores.longitude)
      : null
  }));
  
  return {
    products: productsWithDistance,
    stores: storesWithDistance,
    articles: articlesWithDistance,
    total: productsWithDistance.length + storesWithDistance.length + articlesWithDistance.length
  };
}

/**
 * Local search: produk dalam store
 */
export async function searchStoreProducts(storeId, query) {
  if (!query || query.length < 2) return [];
  
  const searchTerm = `%${query}%`;
  
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      price,
      stock,
      image_url,
      has_discount,
      discount_percentage,
      category_id,
      master_categories (name)
    `)
    .eq('store_id', storeId)
    .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Store products search error:', error);
    return [];
  }
  
  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    stock: p.stock,
    image_url: p.image_url,
    category_name: p.master_categories?.name,
    has_discount: p.has_discount,
    discount_percentage: p.discount_percentage,
    final_price: p.has_discount ? p.price * (100 - p.discount_percentage) / 100 : p.price
  }));
}

/**
 * Get user's default address coordinates
 */
export async function getUserDefaultLocation() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase
    .from('member_addresses')
    .select('latitude, longitude')
    .eq('member_id', user.id)
    .eq('is_default', true)
    .maybeSingle();
  
  if (data?.latitude && data?.longitude) {
    return { lat: data.latitude, lng: data.longitude };
  }
  
  const { data: firstAddr } = await supabase
    .from('member_addresses')
    .select('latitude, longitude')
    .eq('member_id', user.id)
    .limit(1)
    .maybeSingle();
  
  if (firstAddr?.latitude && firstAddr?.longitude) {
    return { lat: firstAddr.latitude, lng: firstAddr.longitude };
  }
  
  return null;
}