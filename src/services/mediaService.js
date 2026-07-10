// ============================================================
// FILE: src/services/mediaService.js
// Service untuk manajemen media (upload, gallery, delete, mark used)
// ============================================================

import { supabase } from '../lib/supabase';

// ============================================================
// KONSTANTA BATASAN UKURAN FILE
// ============================================================
export const MAX_IMAGE_SIZE = 500 * 1024; // 500KB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];

// ============================================================
// 1. VALIDASI FILE SEBELUM UPLOAD
// ============================================================

/**
 * Validasi file sebelum upload
 * @param {File} file - File yang akan divalidasi
 * @returns {Object} { valid: boolean, error: string | null }
 */
export function validateFile(file) {
  // Cek apakah file ada
  if (!file) {
    return { valid: false, error: 'File tidak ditemukan' };
  }

  // Cek tipe file (gambar atau video)
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (!isImage && !isVideo) {
    return { valid: false, error: 'Hanya file gambar atau video yang diizinkan' };
  }

  // Cek ukuran file
  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Gambar terlalu besar! Maksimal ${MAX_IMAGE_SIZE / 1024}KB. Silakan kompres gambar Anda.`
    };
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      error: `Video terlalu besar! Maksimal ${MAX_VIDEO_SIZE / (1024 * 1024)}MB.`
    };
  }

  // Cek ekstensi gambar
  if (isImage && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF.'
    };
  }

  // Cek ekstensi video
  if (isVideo && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Format video tidak didukung. Gunakan MP4, WEBM, atau OGG.'
    };
  }

  return { valid: true, error: null };
}

/**
 * Format ukuran file untuk tampilan
 * @param {number} bytes - Ukuran dalam bytes
 * @returns {string} Format yang mudah dibaca (KB/MB)
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================================
// 2. UPLOAD MEDIA
// ============================================================

/**
 * Upload multiple file ke media library
 * @param {File[]} files - Array file yang akan diupload
 * @param {string} storeId - ID store tujuan
 * @param {string} userId - ID user yang upload
 * @param {Function} onProgress - Callback progress (current, total)
 * @returns {Promise<Array>} Hasil upload per file
 */
export async function uploadMediaFiles(files, storeId, userId, onProgress = null) {
  if (!files || files.length === 0) {
    throw new Error('Tidak ada file yang dipilih');
  }
    const finalStoreId = storeId || null;
  if (!userId) {
    throw new Error('User ID tidak ditemukan');
  }

  const results = [];
  const totalFiles = files.length;
  let completed = 0;

  for (const file of files) {
    const result = {
      file: file.name,
      success: false,
      error: null,
      url: null,
      mediaId: null
    };

    // 1. Validasi file
    const validation = validateFile(file);
    if (!validation.valid) {
      result.error = validation.error;
      results.push(result);
      completed++;
      if (onProgress) onProgress(completed, totalFiles);
      continue;
    }

    try {
      // 2. Upload ke Supabase Storage
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = `stores/${storeId}/${fileName}`;

      console.log(`📤 Uploading: ${filePath} (${formatFileSize(file.size)})`);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('store-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        result.error = uploadError.message || 'Gagal upload ke storage';
        results.push(result);
        completed++;
        if (onProgress) onProgress(completed, totalFiles);
        continue;
      }

      console.log('✅ Upload success:', uploadData);

      // 3. Dapatkan public URL
      const { data: urlData } = supabase.storage
        .from('store-media')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      console.log('🔗 Public URL:', publicUrl);

      // 4. Simpan metadata ke media_library
      const { data: metaData, error: metaError } = await supabase
        .from('media_library')
        .insert({
          store_id: finalStoreId,
          file_name: file.name || 'unknown_file',
          file_path: filePath,
          file_url: publicUrl,
          file_type: file.type || 'unknown',
          file_size: file.size,
          mime_type: file.type || 'unknown',
          is_used: false,
          used_by: [],
          uploaded_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (metaError) {
        console.error('❌ Metadata error:', metaError);
        // Rollback: hapus file dari storage
        await supabase.storage.from('store-media').remove([filePath]);
        result.error = metaError.message || 'Gagal menyimpan metadata';
        results.push(result);
        completed++;
        if (onProgress) onProgress(completed, totalFiles);
        continue;
      }

      // 5. Sukses
      result.success = true;
      result.url = publicUrl;
      result.mediaId = metaData.id;
      results.push(result);
      console.log(`✅ Uploaded: ${file.name} → ${metaData.id}`);

    } catch (err) {
      console.error('❌ Unexpected error:', err);
      result.error = err.message || 'Terjadi kesalahan saat upload';
      results.push(result);
    }

    completed++;
    if (onProgress) onProgress(completed, totalFiles);
  }

  return results;
}

// ============================================================
// 3. AMBIL MEDIA LIBRARY
// ============================================================

/**
 * Ambil daftar media (SEMUA media untuk admin, tidak dibatasi store)
 * @param {string} storeId - ID store (DIABAIKAN, semua admin bisa lihat semua)
 * @param {Object} filter - Filter (search, isUsed, type)
 * @returns {Promise<Array>} Array media
 */
export async function getMediaLibrary(storeId, filter = {}) {
  let query = supabase
    .from('media_library')
    .select('*')
    .order('created_at', { ascending: false });

  // ✅ TIDAK ADA FILTER store_id - SEMUA MEDIA TAMPIL

  // Filter by usage status
  if (filter.isUsed !== undefined && filter.isUsed !== null) {
    query = query.eq('is_used', filter.isUsed);
  }

  // Filter by search (file name)
  if (filter.search && filter.search.trim() !== '') {
    query = query.ilike('file_name', `%${filter.search.trim()}%`);
  }

  // Filter by file type
  if (filter.type && filter.type !== 'all') {
    if (filter.type === 'image') {
      query = query.ilike('mime_type', 'image/%');
    } else if (filter.type === 'video') {
      query = query.ilike('mime_type', 'video/%');
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Error fetching media library:', error);
    throw new Error('Gagal mengambil data media: ' + error.message);
  }

  return data || [];
}

/**
 * Ambil detail media berdasarkan ID
 * @param {string} mediaId - ID media
 * @returns {Promise<Object>} Data media
 */
export async function getMediaById(mediaId) {
  if (!mediaId) {
    throw new Error('Media ID tidak ditemukan');
  }

  const { data, error } = await supabase
    .from('media_library')
    .select('*')
    .eq('id', mediaId)
    .single();

  if (error) {
    console.error('❌ Error fetching media:', error);
    throw new Error('Gagal mengambil detail media: ' + error.message);
  }

  return data;
}

// ============================================================
// 4. TANDAI MEDIA SEBAGAI DIGUNAKAN
// ============================================================

/**
 * Tandai media sebagai digunakan oleh produk
 * @param {string[]} mediaIds - Array ID media
 * @param {Object} usedBy - { type: 'product', id: 'uuid', name: 'string' }
 * @returns {Promise<Object>} { success: true, updated: number }
 */
export async function markMediaAsUsed(mediaIds, usedBy) {
  if (!mediaIds || mediaIds.length === 0) {
    return { success: true, updated: 0 };
  }

  if (!usedBy || !usedBy.id || !usedBy.type) {
    throw new Error('Data usedBy tidak lengkap (type & id required)');
  }

  // Ambil data media yang ada
  const { data: mediaData, error: fetchError } = await supabase
    .from('media_library')
    .select('id, is_used, used_by')
    .in('id', mediaIds);

  if (fetchError) {
    console.error('❌ Error fetching media for mark:', fetchError);
    throw new Error('Gagal mengambil data media: ' + fetchError.message);
  }

  if (!mediaData || mediaData.length === 0) {
    console.warn('⚠️ No media found for IDs:', mediaIds);
    return { success: true, updated: 0 };
  }

  // Filter media yang belum memiliki usedBy entry ini
  const updates = mediaData
    .filter(media => {
      const currentUsedBy = media.used_by || [];
      const alreadyExists = currentUsedBy.some(
        item => item.id === usedBy.id && item.type === usedBy.type
      );
      return !alreadyExists;
    })
    .map(media => ({
      id: media.id,
      is_used: true,
      used_by: [...(media.used_by || []), usedBy],
    }));

  if (updates.length === 0) {
    return { success: true, updated: 0 };
  }

  // ✅ UPDATE SATU PER SATU (HINDARI UPSERT)
  let updatedCount = 0;
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('media_library')
      .update({
        is_used: update.is_used,
        used_by: update.used_by,
        updated_at: new Date().toISOString()
      })
      .eq('id', update.id);

    if (updateError) {
      console.error('❌ Error updating media:', updateError);
      // Lanjutkan ke yang lain, jangan throw
    } else {
      updatedCount++;
    }
  }

  console.log(`✅ Marked ${updatedCount} media as used`);
  return { success: true, updated: updatedCount };
}
/**
 * Hapus tanda used dari media (ketika produk dihapus)
 * @param {string[]} mediaIds - Array ID media
 * @param {Object} usedBy - { type: 'product', id: 'uuid' }
 * @returns {Promise<Object>} { success: true, updated: number }
 */
export async function unmarkMediaAsUsed(mediaIds, usedBy) {
  if (!mediaIds || mediaIds.length === 0) {
    return { success: true, updated: 0 };
  }

  if (!usedBy || !usedBy.id || !usedBy.type) {
    throw new Error('Data usedBy tidak lengkap');
  }

  const { data: mediaData, error: fetchError } = await supabase
    .from('media_library')
    .select('id, used_by')
    .in('id', mediaIds);

  if (fetchError) {
    console.error('❌ Error fetching media for unmark:', fetchError);
    throw new Error('Gagal mengambil data media: ' + fetchError.message);
  }

  if (!mediaData || mediaData.length === 0) {
    return { success: true, updated: 0 };
  }

  let updatedCount = 0;
  for (const media of mediaData) {
    const currentUsedBy = media.used_by || [];
    const newUsedBy = currentUsedBy.filter(
      item => !(item.id === usedBy.id && item.type === usedBy.type)
    );
    
    const isStillUsed = newUsedBy.length > 0;

    const { error: updateError } = await supabase
      .from('media_library')
      .update({
        is_used: isStillUsed,
        used_by: newUsedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', media.id);

    if (updateError) {
      console.error('❌ Error unmarking media:', updateError);
    } else {
      updatedCount++;
    }
  }

  console.log(`✅ Unmarked ${updatedCount} media`);
  return { success: true, updated: updatedCount };
}

// ============================================================
// 5. DELETE MEDIA
// ============================================================

/**
 * Hapus media (hanya jika is_used = false)
 * @param {string} mediaId - ID media
 * @param {string} storeId - ID store (untuk validasi)
 * @returns {Promise<Object>} { success: true }
 */
export async function deleteMedia(mediaId, storeId) {
  if (!mediaId) {
    throw new Error('Media ID tidak ditemukan');
  }
  if (!storeId) {
    throw new Error('Store ID tidak ditemukan');
  }

  // 1. Ambil data media
  const { data: media, error: fetchError } = await supabase
    .from('media_library')
    .select('is_used, file_path, file_name')
    .eq('id', mediaId)
    .eq('store_id', storeId)
    .single();

  if (fetchError) {
    console.error('❌ Error fetching media:', fetchError);
    throw new Error('Media tidak ditemukan');
  }

  // 2. Cek apakah sedang digunakan
  if (media.is_used) {
    throw new Error(`Media "${media.file_name}" sedang digunakan dan tidak bisa dihapus.`);
  }

  // 3. Hapus dari storage
  const { error: storageError } = await supabase.storage
    .from('store-media')
    .remove([media.file_path]);

  if (storageError) {
    console.error('❌ Storage delete error:', storageError);
    throw new Error('Gagal menghapus file dari storage: ' + storageError.message);
  }

  // 4. Hapus dari database
  const { error: dbError } = await supabase
    .from('media_library')
    .delete()
    .eq('id', mediaId)
    .eq('store_id', storeId);

  if (dbError) {
    console.error('❌ Database delete error:', dbError);
    throw new Error('Gagal menghapus data media: ' + dbError.message);
  }

  console.log(`✅ Deleted media: ${media.file_name} (${mediaId})`);
  return { success: true };
}

/**
 * Hapus semua tanda used untuk suatu entitas (produk/news/event)
 * @param {string} entityId - ID entitas (produk, news, event)
 * @param {string} type - 'product' | 'news' | 'event'
 * @returns {Promise<Object>} { success: true, updated: number }
 */
export async function unmarkMediaByEntity(entityId, type) {
  if (!entityId || !type) {
    throw new Error('Entity ID dan type wajib diisi');
  }

  // Cari semua media yang memiliki used_by dengan entity ini
  const { data: mediaData, error: fetchError } = await supabase
    .from('media_library')
    .select('id, used_by')
    .contains('used_by', [{ id: entityId, type: type }]);

  if (fetchError) {
    console.error('❌ Error fetching media for entity:', fetchError);
    throw new Error('Gagal mengambil data media: ' + fetchError.message);
  }

  if (!mediaData || mediaData.length === 0) {
    return { success: true, updated: 0 };
  }

  let updatedCount = 0;
  for (const media of mediaData) {
    const newUsedBy = (media.used_by || []).filter(
      item => !(item.id === entityId && item.type === type)
    );
    
    const isStillUsed = newUsedBy.length > 0;

    const { error: updateError } = await supabase
      .from('media_library')
      .update({
        is_used: isStillUsed,
        used_by: newUsedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', media.id);

    if (updateError) {
      console.error('❌ Error unmarking media:', updateError);
    } else {
      updatedCount++;
    }
  }

  console.log(`✅ Unmarked ${updatedCount} media for ${type}: ${entityId}`);
  return { success: true, updated: updatedCount };
}

/**
 * Hapus multiple media sekaligus
 * @param {string[]} mediaIds - Array ID media
 * @param {string} storeId - ID store
 * @returns {Promise<Object>} { success: true, deleted: number, errors: Array }
 */
export async function deleteMultipleMedia(mediaIds, storeId) {
  if (!mediaIds || mediaIds.length === 0) {
    return { success: true, deleted: 0, errors: [] };
  }

  const results = [];
  const errors = [];

  for (const mediaId of mediaIds) {
    try {
      const result = await deleteMedia(mediaId, storeId);
      results.push(mediaId);
    } catch (error) {
      errors.push({ mediaId, error: error.message });
    }
  }

  return {
    success: errors.length === 0,
    deleted: results.length,
    errors
  };
}

/**
 * Cari media berdasarkan URL dan tandai sebagai used
 * @param {string} fileUrl - URL gambar
 * @param {Object} usedBy - { type: 'product', id: 'uuid', name: 'string' }
 * @returns {Promise<Object>} { success: true, mediaId: string | null }
 */
export async function markMediaAsUsedByUrl(fileUrl, usedBy) {
  if (!fileUrl) return { success: true, mediaId: null };

  const { data, error } = await supabase
    .from('media_library')
    .select('id, file_name')  // ✅ TAMBAHKAN file_name
    .eq('file_url', fileUrl)
    .maybeSingle();

  if (error) {
    console.error('Error finding media by URL:', error);
    return { success: false, mediaId: null, error: error.message };
  }

  if (!data) {
    console.warn('⚠️ Media not found in library for URL:', fileUrl);
    return { success: true, mediaId: null };
  }

  // ✅ CEK: Jika file_name null, perbaiki dulu
  if (!data.file_name) {
    console.warn('⚠️ Media has null file_name, fixing...');
    await supabase
      .from('media_library')
      .update({ file_name: 'unknown_file' })
      .eq('id', data.id);
  }

  try {
    await markMediaAsUsed([data.id], usedBy);
    return { success: true, mediaId: data.id };
  } catch (err) {
    console.error('Error marking media as used:', err);
    return { success: false, mediaId: data.id, error: err.message };
  }
}

// ============================================================
// 6. GET MEDIA STATISTICS
// ============================================================

/**
 * Dapatkan statistik media (SEMUA media, tidak dibatasi store)
 * @param {string} storeId - ID store (DIABAIKAN)
 * @returns {Promise<Object>} { total, used, unused, totalSize }
 */
export async function getMediaStats(storeId) {
  const { data, error } = await supabase
    .from('media_library')
    .select('is_used, file_size');

  if (error) {
    console.error('❌ Error fetching media stats:', error);
    throw new Error('Gagal mengambil statistik media: ' + error.message);
  }

  const total = data.length;
  const used = data.filter(m => m.is_used).length;
  const unused = total - used;
  const totalSize = data.reduce((sum, m) => sum + (m.file_size || 0), 0);

  return {
    total,
    used,
    unused,
    totalSize,
    totalSizeFormatted: formatFileSize(totalSize)
  };
}