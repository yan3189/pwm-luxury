// ============================================================
// FILE: src/components/MediaGallery.jsx
// Komponen galeri media untuk melihat, upload, copy URL, delete
// ============================================================

import { useState, useEffect } from 'react';
import { 
  Copy, Check, Trash, Upload, Search, Image, Video, File, 
  X, Grid, List, Filter, RefreshCw, AlertCircle 
} from 'lucide-react';
import { 
  getMediaLibrary, 
  uploadMediaFiles, 
  deleteMedia, 
  formatFileSize, 
  getMediaStats 
} from '../services/mediaService';

export default function MediaGallery({ 
  storeId, 
  userId, 
  onSelect, 
  selectable = false,
  maxSelect = 1,
  allowedTypes = 'all' // 'all' | 'image' | 'video'
}) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'image' | 'video'
  const [filterUsed, setFilterUsed] = useState('all'); // 'all' | 'used' | 'unused'
  const [copiedId, setCopiedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  // Load media saat filter berubah
  useEffect(() => {
    
      loadMedia();
      loadStats();
    
  }, [search, filterType, filterUsed]);

  const loadMedia = async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = { 
        search, 
        type: filterType,
        isUsed: filterUsed === 'all' ? undefined : filterUsed === 'used'
      };
      const data = await getMediaLibrary(null, filter);
      setMedia(data);
    } catch (err) {
      console.error('Error loading media:', err);
      setError('Gagal memuat galeri: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getMediaStats(null);
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Filter berdasarkan allowedTypes
    let allowedFiles = files;
    if (allowedTypes === 'image') {
      allowedFiles = files.filter(f => f.type.startsWith('image/'));
      if (allowedFiles.length !== files.length) {
        alert('⚠️ Hanya file gambar yang diizinkan. Video dilewati.');
      }
    } else if (allowedTypes === 'video') {
      allowedFiles = files.filter(f => f.type.startsWith('video/'));
      if (allowedFiles.length !== files.length) {
        alert('⚠️ Hanya file video yang diizinkan. Gambar dilewati.');
      }
    }

    if (allowedFiles.length === 0) {
      alert('Tidak ada file yang sesuai dengan kriteria.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadTotal(allowedFiles.length);
    setError(null);

    try {
      const result = await uploadMediaFiles(
        allowedFiles, 
        storeId, 
        userId,
        (current, total) => {
          setUploadProgress(current);
          setUploadTotal(total);
        }
      );

      const successCount = result.filter(r => r.success).length;
      const failCount = result.filter(r => !r.success).length;

      let message = `${successCount} dari ${result.length} file berhasil diupload.`;
      if (failCount > 0) {
        const errors = result.filter(r => !r.success).map(r => `${r.file}: ${r.error}`);
        message += `\n\n❌ Gagal (${failCount}):\n${errors.join('\n')}`;
      }
      alert(message);

      // Reset input file
      e.target.value = '';

      // Refresh
      await loadMedia();
      await loadStats();

    } catch (err) {
      console.error('Upload error:', err);
      setError('Gagal upload: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCopyUrl = (url, mediaId) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(mediaId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      // Fallback: tampilkan alert
      alert('URL: ' + url);
    });
  };

  const handleDelete = async (mediaId, fileName) => {
    if (!confirm(`Hapus file "${fileName}"? (Hanya jika tidak digunakan)`)) return;
    
    try {
      await deleteMedia(mediaId, storeId);
      await loadMedia();
      await loadStats();
    } catch (error) {
      alert('❌ ' + error.message);
    }
  };

  const handleSelect = (mediaId) => {
    if (!selectable) return;

    setSelectedIds(prev => {
      if (prev.includes(mediaId)) {
        return prev.filter(id => id !== mediaId);
      } else {
        if (maxSelect === 1) {
          return [mediaId];
        }
        if (prev.length >= maxSelect) {
          alert(`Maksimal pilih ${maxSelect} file`);
          return prev;
        }
        return [...prev, mediaId];
      }
    });
  };

  const handleConfirmSelect = () => {
    if (selectedIds.length === 0) {
      alert('Pilih minimal 1 file');
      return;
    }
    const selectedMedia = media.filter(m => selectedIds.includes(m.id));
    const urls = selectedMedia.map(m => m.file_url);
    if (onSelect) {
      onSelect(urls.length === 1 ? urls[0] : urls, selectedMedia);
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('video/')) {
      return <Video className="w-4 h-4 text-blue-400" />;
    }
    if (mimeType?.startsWith('image/')) {
      return <Image className="w-4 h-4 text-green-400" />;
    }
    return <File className="w-4 h-4 text-gray-400" />;
  };

  const getFileTypeLabel = (mimeType) => {
    if (mimeType?.startsWith('image/')) return 'Gambar';
    if (mimeType?.startsWith('video/')) return 'Video';
    return 'File';
  };

  // Reset filters
  const resetFilters = () => {
    setSearch('');
    setFilterType('all');
    setFilterUsed('all');
  };

  return (
    <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <div>
          <h2 className="text-xl font-display flex items-center gap-2">
            🖼️ Galeri Media
            {stats && (
              <span className="text-xs font-normal text-gray-400">
                ({stats.total} file · {formatFileSize(stats.totalSize)})
              </span>
            )}
          </h2>
          {stats && (
            <div className="text-xs text-gray-500 mt-0.5">
              ✅ Digunakan: {stats.used} · ⬜ Belum: {stats.unused}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded bg-black/50 border border-white/20 text-sm focus:border-yellow-500 focus:outline-none w-40 md:w-48"
            />
          </div>

          {/* Filter Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-black/50 border border-white/20 rounded px-2 py-1.5 text-sm"
          >
            <option value="all">📁 Semua</option>
            <option value="image">🖼️ Gambar</option>
            <option value="video">🎬 Video</option>
          </select>

          {/* Filter Used */}
          <select
            value={filterUsed}
            onChange={(e) => setFilterUsed(e.target.value)}
            className="bg-black/50 border border-white/20 rounded px-2 py-1.5 text-sm"
          >
            <option value="all">📋 Semua Status</option>
            <option value="used">✅ Digunakan</option>
            <option value="unused">⬜ Belum</option>
          </select>

          {/* Upload Button */}
          <label className="cursor-pointer bg-yellow-500 text-black px-3 py-1.5 rounded text-sm font-semibold hover:bg-yellow-600 transition flex items-center gap-1">
            <Upload className="w-4 h-4" />
            Upload
            <input
              type="file"
              multiple
              accept={allowedTypes === 'image' ? 'image/*' : allowedTypes === 'video' ? 'video/*' : 'image/*,video/*'}
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>

          {/* Refresh */}
          <button
            onClick={() => { loadMedia(); loadStats(); }}
            className="bg-gray-700 hover:bg-gray-600 p-1.5 rounded transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ===== UPLOAD PROGRESS ===== */}
      {uploading && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Uploading...</span>
            <span>{uploadProgress} / {uploadTotal}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(uploadProgress / uploadTotal) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ===== ERROR ===== */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 rounded-lg border border-red-500/30 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* ===== SELECTION MODE ===== */}
      {selectable && selectedIds.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30 flex justify-between items-center">
          <span className="text-sm text-yellow-400">
            ✅ {selectedIds.length} file dipilih
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm transition"
            >
              Batal
            </button>
            <button
              onClick={handleConfirmSelect}
              className="px-3 py-1 rounded bg-yellow-500 text-black text-sm font-semibold hover:bg-yellow-600 transition"
            >
              Gunakan {selectedIds.length} file
            </button>
          </div>
        </div>
      )}

      {/* ===== GALLERY GRID ===== */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      ) : media.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-16 h-16 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500">
            {search || filterType !== 'all' || filterUsed !== 'all' 
              ? 'Tidak ada file yang sesuai dengan filter' 
              : 'Belum ada file. Klik "Upload" untuk menambahkan.'}
          </p>
          {(search || filterType !== 'all' || filterUsed !== 'all') && (
            <button
              onClick={resetFilters}
              className="mt-2 text-yellow-500 hover:text-yellow-400 text-sm"
            >
              Reset filter →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {media.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const isImage = item.mime_type?.startsWith('image/');
            const isVideo = item.mime_type?.startsWith('video/');

            return (
              <div
                key={item.id}
                className={`bg-gray-800 rounded-lg overflow-hidden border transition ${
                  isSelected 
                    ? 'border-yellow-500 ring-2 ring-yellow-500/50' 
                    : item.is_used 
                      ? 'border-green-500/30' 
                      : 'border-gray-700'
                } hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/10 group`}
                onClick={() => selectable && handleSelect(item.id)}
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-700 relative overflow-hidden">
                  {isVideo ? (
                    <video 
                      className="w-full h-full object-cover"
                      muted
                      loop
                      onMouseEnter={(e) => e.target.play?.()}
                      onMouseLeave={(e) => e.target.pause?.()}
                    >
                      <source src={item.file_url} />
                    </video>
                  ) : (
                    <img
                      src={item.file_url}
                      alt={item.file_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                      onError={(e) => e.target.src = '/placeholder-image.png'}
                    />
                  )}

                  {/* Status Badge */}
                  {item.is_used && (
                    <div className="absolute top-1 right-1 bg-green-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                      ✅ Used
                    </div>
                  )}

                  {/* Selection Checkbox */}
                  {selectable && (
                    <div className="absolute top-1 left-1">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        isSelected 
                          ? 'bg-yellow-500 border-yellow-500' 
                          : 'border-white/50 bg-black/50'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-black" />}
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2">
                  <div className="flex items-center gap-1 text-xs text-gray-400 truncate" title={item.file_name}>
                    {getFileIcon(item.mime_type)}
                    <span className="truncate">{item.file_name}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">
                      {formatFileSize(item.file_size)}
                      <span className="ml-1 text-gray-600">· {getFileTypeLabel(item.mime_type)}</span>
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyUrl(item.file_url, item.id);
                        }}
                        className="text-yellow-400 hover:text-yellow-300 p-0.5 rounded hover:bg-yellow-500/10 transition"
                        title="Copy URL"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      {!item.is_used && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id, item.file_name);
                          }}
                          className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-red-500/10 transition"
                          title="Hapus"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== FOOTER INFO ===== */}
      <div className="mt-4 text-xs text-gray-500 border-t border-white/10 pt-3 flex justify-between items-center">
        <span>
          Total: {media.length} file
          {stats && ` · ${formatFileSize(stats.totalSize)}`}
        </span>
        <span className="text-gray-600">
          ⚠️ Gambar maks 500KB · Video maks 50MB
        </span>
      </div>
    </div>
  );
}