// ============================================================
// FILE: src/utils/excelTemplate.js
// Fungsi untuk generate template Excel yang bisa didownload admin
// ============================================================

import * as XLSX from 'xlsx';

/**
 * Generate template Excel untuk import produk
 * @param {Array} storeIds - (opsional) untuk superadmin, bisa tambahkan sheet store
 * @returns {Blob} Blob file Excel
 */
export function generateProductTemplate(storeIds = null) {
  // Data header template
  const headers = [
    'Nama Produk',
    'Harga (Rp)',
    'Deskripsi',
    'Stok',
    'URL Gambar',
    'Status (aktif/tidak)'
  ];

  // Contoh data (1 baris contoh untuk panduan)
  const exampleData = [
    'Contoh Produk',
    100000,
    'Deskripsi produk contoh',
    10,
    'https://example.com/gambar.jpg',
    'aktif'
  ];

  // Buat worksheet dengan header + contoh
  const wsData = [headers, exampleData];
  
  // Tambahkan beberapa baris kosong untuk diisi user
  for (let i = 0; i < 20; i++) {
    wsData.push(['', '', '', '', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set lebar kolom
  ws['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 40 },
    { wch: 10 },
    { wch: 40 },
    { wch: 15 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produk');

  // Jika superadmin (ada storeIds), tambahkan sheet info store
  if (storeIds && storeIds.length > 0) {
    const storeSheetData = [
      ['Store ID', 'Nama Store'],
      ...storeIds.map(s => [s.id, s.name])
    ];
    const wsStore = XLSX.utils.aoa_to_sheet(storeSheetData);
    XLSX.utils.book_append_sheet(wb, wsStore, 'Store');
  }

  // Generate file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
}

/**
 * Download template Excel
 * @param {Array} storeIds - (opsional)
 */
export function downloadTemplate(storeIds = null) {
  const blob = generateProductTemplate(storeIds);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `template_import_produk_${new Date().toISOString().slice(0,10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}