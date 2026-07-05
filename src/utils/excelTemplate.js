// ============================================================
// FILE: src/utils/excelTemplate.js
// Template dan utility untuk Excel Import
// ============================================================

import * as XLSX from 'xlsx';

/**
 * Generate template Excel untuk download
 * @param {Array} sampleData - Data contoh (opsional)
 * @returns {Array} Array of objects
 */
export function generateTemplateData(sampleData = null) {
  if (sampleData) return sampleData;
  
  return [
    {
      'Nama Produk': 'Kopi Arabica Premium',
      'Harga': 45000,
      'Deskripsi': 'Kopi arabica pilihan dari dataran tinggi',
      'Stok': 10,
      'URL Gambar': 'https://example.com/kopi-arabica.jpg',
      'Status': 'aktif',
      'Kategori': 'Kopi',
      'Barcode': '8991234567890',
      'Kode Produk': 'PWM-KOP-0001'
    },
    {
      'Nama Produk': 'Teh Hitam Original',
      'Harga': 25000,
      'Deskripsi': 'Teh hitam premium kualitas export',
      'Stok': 8,
      'URL Gambar': '',
      'Status': 'aktif',
      'Kategori': 'Teh',
      'Barcode': '8991234567891',
      'Kode Produk': 'PWM-TEH-0001'
    },
    {
      'Nama Produk': 'Snack Keripik Singkong',
      'Harga': 15000,
      'Deskripsi': 'Keripik singkong rasa original',
      'Stok': 20,
      'URL Gambar': '',
      'Status': 'nonaktif',
      'Kategori': 'Snack',
      'Barcode': '',
      'Kode Produk': ''
    }
  ];
}

/**
 * Generate Excel file untuk download
 * @param {Array} data - Data produk
 * @param {string} fileName - Nama file (opsional)
 */
export function downloadExcelTemplate(data = null, fileName = 'template_import_produk.xlsx') {
  const templateData = generateTemplateData(data);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(templateData);
  
  // Set lebar kolom (opsional)
  const colWidths = [
    { wch: 25 }, // Nama Produk
    { wch: 12 }, // Harga
    { wch: 30 }, // Deskripsi
    { wch: 10 }, // Stok
    { wch: 35 }, // URL Gambar
    { wch: 12 }, // Status
    { wch: 15 }, // Kategori
    { wch: 18 }, // Barcode
    { wch: 20 }, // Kode Produk
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Template Produk');
  XLSX.writeFile(wb, fileName);
}

/**
 * Parse file Excel menjadi array of objects
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validasi header Excel
 */
export function validateExcelHeaders(data, requiredHeaders = [
  'Nama Produk',
  'Harga',
  'Deskripsi',
  'Stok',
  'URL Gambar',
  'Status',
  'Kategori',
  'Barcode',
  'Kode Produk'
]) {
  if (!data || data.length === 0) {
    return { valid: false, missing: requiredHeaders };
  }
  
  const headers = Object.keys(data[0]);
  const missing = requiredHeaders.filter(h => !headers.includes(h));
  
  return {
    valid: missing.length === 0,
    missing,
    headers
  };
}