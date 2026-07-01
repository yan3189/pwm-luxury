// ============================================================
// FILE: src/components/ImportProductsModal.jsx
// Modal untuk import produk dari Excel
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { parseExcelFile, importProducts } from '../services/importService';
import { downloadTemplate } from '../utils/excelTemplate';
import { supabase } from '../lib/supabase';

export default function ImportProductsModal({ 
  isOpen, 
  onClose, 
  userRole, 
  storeId, // store_id untuk store admin
  onSuccess 
}) {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'importing' | 'done'
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef(null);
  
  // Cek role: super_admin atau store_admin
  const isSuperAdmin = userRole === 'super_admin';
  const isStoreAdmin = userRole === 'store_admin';

  // Load daftar store untuk superadmin
  useEffect(() => {
    if (isSuperAdmin && isOpen) {
      fetchStores();
    }
  }, [isSuperAdmin, isOpen]);

  // Reset state saat modal tutup
  useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setFile(null);
      setPreviewData([]);
      setErrors([]);
      setSelectedStoreIds([]);
      setImportResult(null);
      setProgress({ current: 0, total: 0 });
    }
  }, [isOpen]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setStores(data || []);
      // Default pilih semua store
      setSelectedStoreIds(data.map(s => s.id));
    } catch (err) {
      console.error('Error fetching stores:', err);
      alert('Gagal memuat daftar store');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validasi ukuran file (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      e.target.value = '';
      return;
    }

    // Validasi ekstensi
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    if (!validExtensions.includes(ext)) {
      alert('Format file harus .xlsx, .xls, atau .csv');
      e.target.value = '';
      return;
    }

    setFile(selectedFile);
    handleParseFile(selectedFile);
  };

  const handleParseFile = async (fileToParse) => {
    setIsLoading(true);
    setErrors([]);
    setPreviewData([]);

    try {
      const result = await parseExcelFile(fileToParse);
      if (result.success) {
        setPreviewData(result.data);
        setErrors(result.errors);
        setStep('preview');
      } else {
        alert('Gagal parsing file: ' + result.error);
        setStep('upload');
      }
    } catch (err) {
      console.error('Parse error:', err);
      alert('Gagal parsing file: ' + err.message);
      setStep('upload');
    }

    setIsLoading(false);
  };

  const handleImport = async () => {
    // Validasi: harus ada produk
    if (previewData.length === 0) {
      alert('Tidak ada produk valid untuk diimport');
      return;
    }

    // Validasi superadmin: harus pilih minimal 1 store
    if (isSuperAdmin && selectedStoreIds.length === 0) {
      alert('Pilih minimal 1 store tujuan');
      return;
    }

    setStep('importing');
    setProgress({ current: 0, total: previewData.length * (isSuperAdmin ? selectedStoreIds.length : 1) });

    try {
      const result = await importProducts(
        previewData,
        isSuperAdmin ? selectedStoreIds : [],
        isStoreAdmin ? storeId : null,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      setImportResult(result);
      setStep('done');

      if (result.successCount > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('Gagal import: ' + err.message);
      setStep('preview');
    }
  };

  const handleDownloadTemplate = () => {
    if (isSuperAdmin) {
      // Download dengan sheet store
      downloadTemplate(stores);
    } else {
      // Download template biasa
      downloadTemplate();
    }
  };

  const toggleStore = (storeId) => {
    setSelectedStoreIds(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const selectAllStores = () => {
    setSelectedStoreIds(stores.map(s => s.id));
  };

  const deselectAllStores = () => {
    setSelectedStoreIds([]);
  };

  if (!isOpen) return null;

  // Render step upload
  const renderUpload = () => (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-yellow-500/50 transition">
        <Upload className="mx-auto text-gray-400 mb-3" size={40} />
        <p className="text-gray-400 text-sm mb-2">
          Upload file Excel (.xlsx, .xls, .csv)
        </p>
        <p className="text-gray-500 text-xs">Maksimal 5MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-600 transition"
          disabled={isLoading}
        >
          {isLoading ? 'Memproses...' : 'Pilih File'}
        </button>
        {file && (
          <p className="mt-2 text-xs text-green-400">
            ✓ {file.name} ({Math.round(file.size / 1024)} KB)
          </p>
        )}
      </div>

      <button
        onClick={handleDownloadTemplate}
        className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 text-sm transition"
      >
        <Download size={16} /> Download Template Excel
      </button>

      <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
        <p>📌 Format template:</p>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li><strong>Nama Produk</strong> (wajib) - max 255 karakter</li>
          <li><strong>Harga (Rp)</strong> (wajib) - angka bulat positif</li>
          <li><strong>Deskripsi</strong> (opsional)</li>
          <li><strong>Stok</strong> (opsional) - angka diatas 0, default 0</li>
          <li><strong>URL Gambar</strong> (opsional)</li>
          <li><strong>Status (aktif/tidak)</strong> (opsional) - default "aktif"</li>
        </ul>
      </div>
    </div>
  );

  // Render step preview
  const renderPreview = () => {
    const totalRecords = isSuperAdmin 
      ? previewData.length * selectedStoreIds.length
      : previewData.length;

    return (
      <div className="space-y-4">
        {/* Informasi total */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {previewData.length} produk valid
              {errors.length > 0 && (
                <span className="text-red-400 ml-2">({errors.length} error)</span>
              )}
            </span>
            {isSuperAdmin && (
              <span className="text-sm text-yellow-500">
                × {selectedStoreIds.length} store = {totalRecords} record
              </span>
            )}
          </div>
        </div>

        {/* Pilihan store (superadmin) */}
        {isSuperAdmin && stores.length > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-300">Pilih Store Tujuan</span>
              <div className="flex gap-2">
                <button onClick={selectAllStores} className="text-xs text-yellow-500 hover:underline">
                  Pilih Semua
                </button>
                <button onClick={deselectAllStores} className="text-xs text-gray-400 hover:underline">
                  Hapus Semua
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
              {stores.map(store => (
                <label key={store.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStoreIds.includes(store.id)}
                    onChange={() => toggleStore(store.id)}
                    className="accent-yellow-500"
                  />
                  <span className="text-gray-300">{store.name}</span>
                </label>
              ))}
            </div>
            {selectedStoreIds.length === 0 && (
              <p className="text-xs text-red-400 mt-1">⚠️ Pilih minimal 1 store</p>
            )}
          </div>
        )}

        {/* Preview data */}
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-60">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="p-2 text-left text-gray-400">#</th>
                  <th className="p-2 text-left text-gray-400">Nama</th>
                  <th className="p-2 text-left text-gray-400">Harga</th>
                  <th className="p-2 text-left text-gray-400">Stok</th>
                  <th className="p-2 text-left text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewData.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-gray-500">Tidak ada data valid</td></tr>
                ) : (
                  previewData.map((product, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="p-2 text-gray-500">{idx + 1}</td>
                      <td className="p-2">{product.name}</td>
                      <td className="p-2 text-yellow-500">Rp {product.price?.toLocaleString()}</td>
                      <td className="p-2">{product.stock}</td>
                      <td className="p-2">
                        {product.is_active ? (
                          <span className="text-green-400 text-xs">Aktif</span>
                        ) : (
                          <span className="text-gray-400 text-xs">Tidak</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
            <p className="text-red-400 text-sm font-medium mb-1">⚠️ Error validasi:</p>
            <ul className="text-xs text-red-300 list-disc list-inside max-h-20 overflow-y-auto">
              {errors.slice(0, 10).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
              {errors.length > 10 && <li>... dan {errors.length - 10} error lainnya</li>}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={previewData.length === 0 || (isSuperAdmin && selectedStoreIds.length === 0) || isLoading}
            className="flex-1 bg-yellow-500 text-black py-2 rounded-lg font-semibold hover:bg-yellow-600 transition disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : `Import ${previewData.length} Produk`}
          </button>
          <button
            onClick={() => setStep('upload')}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  };

  // Render step importing
  const renderImporting = () => (
    <div className="py-8 text-center space-y-4">
      <Loader className="mx-auto animate-spin text-yellow-500" size={48} />
      <p className="text-gray-400">Sedang mengimport produk...</p>
      <div className="w-full bg-gray-700 rounded-full h-2 max-w-md mx-auto">
        <div 
          className="bg-yellow-500 h-2 rounded-full transition-all"
          style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500">
        {progress.current} dari {progress.total} record
      </p>
    </div>
  );

  // Render step done
  const renderDone = () => {
    const result = importResult;
    if (!result) return null;

    return (
      <div className="space-y-4">
        <div className="py-4 text-center">
          {result.errorCount === 0 ? (
            <CheckCircle className="mx-auto text-green-400" size={48} />
          ) : (
            <AlertCircle className="mx-auto text-yellow-400" size={48} />
          )}
          <h3 className="text-lg font-semibold mt-2">
            {result.errorCount === 0 ? 'Import Berhasil!' : 'Import Selesai (dengan error)'}
          </h3>
          <p className="text-gray-400 text-sm">
            {result.successCount} produk berhasil diimport
            {result.errorCount > 0 && (
              <span className="text-red-400 ml-2">{result.errorCount} gagal</span>
            )}
          </p>
          <p className="text-xs text-gray-500">Total {result.total} record</p>
        </div>

        {result.errors.length > 0 && (
          <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30 max-h-40 overflow-y-auto">
            <p className="text-red-400 text-xs font-medium mb-1">❌ Gagal:</p>
            {result.errors.map((err, idx) => (
              <div key={idx} className="text-xs text-red-300 border-b border-red-500/10 py-1">
                <span className="font-medium">{err.product_name}</span> 
                <span className="text-gray-400"> → store {err.store_id.slice(0,8)}</span>
                <span className="text-red-400 ml-2">({err.error})</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-yellow-500 text-black py-2 rounded-lg font-semibold hover:bg-yellow-600 transition"
        >
          Tutup
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-3xl border border-white/10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-display flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-yellow-500" />
              Import Produk
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isSuperAdmin ? 'Super Admin - Pilih store tujuan' : 'Store Admin - Produk akan masuk ke store ini'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && renderUpload()}
          {step === 'preview' && renderPreview()}
          {step === 'importing' && renderImporting()}
          {step === 'done' && renderDone()}
        </div>
      </div>
    </div>
  );
}