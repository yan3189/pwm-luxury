// ============================================================
// FILE: src/components/ImportProductsModal.jsx
// Modal untuk import produk dari Excel
// ============================================================

import { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseExcelFile, importProducts, generateTemplateData } from '../services/importService';
import { supabase } from '../lib/supabase';

export default function ImportProductsModal({ isOpen, onClose, userRole, stores, selectedStoreId, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'result'
  const fileInputRef = useRef(null);

  // State untuk super admin (pilih store)
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // State untuk store admin
  const isSuperAdmin = userRole === 'super_admin';
  const isStoreAdmin = userRole === 'store_admin' || userRole === 'store_admin';

  // Reset state saat modal ditutup
  const handleClose = () => {
    setFile(null);
    setFileError(null);
    setPreviewData([]);
    setValidationErrors([]);
    setImportResult(null);
    setStep('upload');
    setProgress(0);
    setIsLoading(false);
    setIsImporting(false);
    setSelectedStoreIds([]);
    setSelectAll(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validasi ekstensi
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(ext)) {
      setFileError('File harus berformat .xlsx, .xls, atau .csv');
      setFile(null);
      return;
    }

    // Validasi MIME type
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (!validMimeTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      setFileError('Tipe file tidak valid');
      setFile(null);
      return;
    }

    // Validasi ukuran file (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setFileError('Ukuran file maksimal 5MB');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setFileError(null);
    await processFile(selectedFile);
  };

 // Proses file (parsing & validasi)
const processFile = async (selectedFile) => {
  setIsLoading(true);
  setValidationErrors([]);
  setPreviewData([]);

  try {
    // ✅ Tentukan storeId dengan benar
    let storeId = null;
    
    // 🔥 STORE ADMIN: PASTIKAN storeId TERKIRIM
    if (isStoreAdmin && selectedStoreId) {
      storeId = selectedStoreId;
      console.log('🔍 Store admin detected, storeId:', storeId);
    } else if (isSuperAdmin && selectedStoreIds.length === 1) {
      storeId = selectedStoreIds[0];
      console.log('🔍 Super admin with 1 store, storeId:', storeId);
    } else if (isSuperAdmin && selectedStoreIds.length > 1) {
      storeId = null;
      console.log('🔍 Super admin with multiple stores, storeId: null');
    }
    
    console.log('🔍 Processing file with storeId:', storeId);

    const result = await parseExcelFile(selectedFile, storeId);

    if (result.success) {
      if (result.data.length === 0) {
        setFileError('Tidak ada data yang valid di file ini. Periksa format data.');
        setFile(null);
        return;
      }

      setPreviewData(result.data);
      setValidationErrors(result.errors || []);
      setStep('preview');
    } else {
      setFileError(result.errors?.[0] || 'Gagal memproses file');
      setFile(null);
    }
  } catch (err) {
    console.error('Error processing file:', err);
    setFileError(err.message || 'Gagal memproses file');
    setFile(null);
  } finally {
    setIsLoading(false);
  }
};

  // Handle import
  const handleImport = async () => {
    if (previewData.length === 0) return;

    // Validasi super admin: harus pilih minimal 1 store
    if (isSuperAdmin && selectedStoreIds.length === 0) {
      alert('Silakan pilih minimal 1 store untuk import produk');
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      const storeIds = isSuperAdmin ? selectedStoreIds : [selectedStoreId];
      
      console.log('📤 Importing products:', {
        productCount: previewData.length,
        storeCount: storeIds.length,
        totalRecords: previewData.length * storeIds.length,
        storeIds
      });

      const result = await importProducts(
        previewData,
        storeIds,
        null,
        (current, total) => {
          const percent = Math.round((current / total) * 100);
          setProgress(percent);
        },
        false // skipDuplicates = false (cek duplikat)
      );

      console.log('📥 Import result:', result);

      setImportResult({
        success: true,
        total: result.total,
        successCount: result.successCount,
        errorCount: result.errorCount,
        duplicateCount: result.duplicateCount || 0,
        errors: result.errors || [],
        duplicates: result.duplicates || [],
        results: result.results || []
      });
      setStep('result');

      // Refresh data di parent
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('Gagal import produk: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Download template
  const downloadTemplate = () => {
    const templateData = generateTemplateData();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'template_import_produk.xlsx');
  };

  // Toggle select all stores (untuk super admin)
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedStoreIds([]);
    } else {
      setSelectedStoreIds(stores.map(s => s.id));
    }
    setSelectAll(!selectAll);
  };

  // Toggle single store
  const toggleStore = (storeId) => {
    setSelectedStoreIds(prev => {
      if (prev.includes(storeId)) {
        return prev.filter(id => id !== storeId);
      } else {
        return [...prev, storeId];
      }
    });
  };

  if (!isOpen) return null;

  // Render hasil import
  if (step === 'result' && importResult) {
    const { total, successCount, errorCount, duplicateCount, errors, duplicates } = importResult;
    const isFullySuccess = errorCount === 0 && duplicateCount === 0;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display">Hasil Import Produk</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Ringkasan */}
            <div className={`p-4 rounded-lg ${isFullySuccess ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
              <div className="flex items-center gap-3">
                {isFullySuccess ? (
                  <CheckCircle size={24} className="text-green-400" />
                ) : (
                  <AlertCircle size={24} className="text-yellow-400" />
                )}
                <div>
                  <p className="font-semibold">
                    {isFullySuccess ? '✅ Import Berhasil!' : '⚠️ Import Selesai dengan Peringatan'}
                  </p>
                  <p className="text-sm text-gray-400">
                    Total {total} record • {successCount} sukses • {errorCount} gagal • {duplicateCount} duplikat
                  </p>
                </div>
              </div>
            </div>

            {/* Detail error */}
            {errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-red-400 mb-2">❌ Error ({errors.length})</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {errors.map((err, idx) => (
                    <p key={idx} className="text-xs text-red-300">
                      {err.product_name}: {err.error} (store: {err.store_id?.substring(0, 8)})
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Detail duplikat */}
            {duplicates.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-yellow-400 mb-2">⚠️ Duplikat ({duplicates.length})</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {duplicates.map((dup, idx) => (
                    <p key={idx} className="text-xs text-yellow-300">
                      {dup.product_name} - {dup.message} (store: {dup.store_id?.substring(0, 8)})
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Tombol */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 bg-yellow-500 text-black py-2 rounded-lg font-semibold hover:bg-yellow-600 transition"
              >
                Selesai
              </button>
              <button
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setPreviewData([]);
                  setImportResult(null);
                  setProgress(0);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
              >
                Import Lagi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-4xl border border-white/10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-display flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-yellow-500" />
              Import Produk dari Excel
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {isSuperAdmin ? 'Super Admin: Pilih store tujuan' : 'Store Admin: Import ke store Anda'}
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="flex-1 overflow-y-auto">
            {/* Tombol Download Template */}
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 text-sm mb-4"
            >
              <Download size={16} /> Download Template Excel
            </button>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-yellow-500/50 transition">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isLoading}
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <Upload size={48} className="mx-auto text-gray-500 mb-3" />
                <p className="text-gray-300">Klik atau drag file Excel ke sini</p>
                <p className="text-xs text-gray-500 mt-1">Format: .xlsx, .xls, .csv (Max 5MB)</p>
              </label>
            </div>

            {fileError && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                <p className="text-red-400 text-sm">{fileError}</p>
              </div>
            )}

            {isLoading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
                <span>Memproses file...</span>
              </div>
            )}

            {/* Pilihan Store (Super Admin) */}
            {isSuperAdmin && stores && stores.length > 0 && (
              <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
                <h3 className="font-semibold text-sm mb-3">Pilih Store Tujuan</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={toggleSelectAll}
                      className="accent-yellow-500"
                    />
                    <span className="text-yellow-500">Pilih Semua</span>
                  </label>
                  {stores.map(store => (
                    <label key={store.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStoreIds.includes(store.id)}
                        onChange={() => toggleStore(store.id)}
                        className="accent-yellow-500"
                      />
                      {store.name}
                    </label>
                  ))}
                </div>
                {selectedStoreIds.length === 0 && (
                  <p className="text-xs text-yellow-500 mt-2">⚠️ Pilih minimal 1 store</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div className="flex-1 overflow-y-auto">
            {/* Informasi */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-sm text-gray-300">
                  {previewData.length} produk siap diimport
                  {isSuperAdmin && selectedStoreIds.length > 0 && (
                    <span className="text-yellow-500 ml-2">
                      × {selectedStoreIds.length} store = {previewData.length * selectedStoreIds.length} record
                    </span>
                  )}
                </p>
                {validationErrors.length > 0 && (
                  <p className="text-xs text-yellow-500 mt-1">
                    ⚠️ {validationErrors.length} peringatan validasi (akan dilewati)
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setPreviewData([]);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="text-sm text-gray-400 hover:text-white"
              >
                ↺ Upload Ulang
              </button>
            </div>

            {/* Tabel Preview */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50 border-b border-white/10 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Nama Produk</th>
                    <th className="p-2 text-left">Harga</th>
                    <th className="p-2 text-left">Stok</th>
                    <th className="p-2 text-left">Kategori</th>
                    <th className="p-2 text-left">Barcode</th>
                    <th className="p-2 text-left">Kode Produk</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((product, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-2 font-medium">{product.name}</td>
                      <td className="p-2">Rp {product.price?.toLocaleString()}</td>
                      <td className="p-2">{product.stock}</td>
                      <td className="p-2">{product.category_name || '-'}</td>
                      <td className="p-2 font-mono text-xs">{product.barcode || '-'}</td>
                      <td className="p-2 font-mono text-xs text-yellow-500">{product.product_code || '(auto)'}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${product.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {product.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tombol Aksi */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleImport}
                disabled={isImporting || (isSuperAdmin && selectedStoreIds.length === 0)}
                className={`flex-1 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  isImporting || (isSuperAdmin && selectedStoreIds.length === 0)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-500 text-black hover:bg-yellow-600'
                }`}
              >
                {isImporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Importing... {progress}%
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import {previewData.length} Produk
                    {isSuperAdmin && selectedStoreIds.length > 0 && ` ke ${selectedStoreIds.length} store`}
                  </>
                )}
              </button>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
              >
                Batal
              </button>
            </div>

            {/* Progress Bar */}
            {isImporting && (
              <div className="mt-3">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-center">{progress}%</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}