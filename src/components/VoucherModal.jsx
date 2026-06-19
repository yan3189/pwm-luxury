// ============================================================
// FILE: src/components/VoucherModal.jsx
// Modal untuk memilih voucher di halaman checkout
// ============================================================

import { useState, useEffect } from 'react';
import { X, Tag, Check, AlertCircle, Gift, Truck, Percent, Coins } from 'lucide-react';

export default function VoucherModal({ 
  isOpen, 
  onClose, 
  vouchers, 
  onApply, 
  selectedVoucherIds = [],
  subtotal = 0,
  shippingCost = 0
}) {
  const [selectedIds, setSelectedIds] = useState(selectedVoucherIds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset selected IDs ketika modal dibuka
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(selectedVoucherIds);
      setError('');
    }
  }, [isOpen, selectedVoucherIds]);

  // Toggle pilihan voucher
  const toggleVoucher = (voucherId) => {
    setSelectedIds(prev => {
      if (prev.includes(voucherId)) {
        return prev.filter(id => id !== voucherId);
      } else {
        return [...prev, voucherId];
      }
    });
  };

  // Handle apply voucher
  const handleApply = () => {
    if (selectedIds.length === 0) {
      setError('Pilih minimal 1 voucher');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      onApply(selectedIds);
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal menerapkan voucher');
    } finally {
      setLoading(false);
    }
  };

  // Format rupiah
  const formatRupiah = (amount) => {
    return new Intl.NumberFormat('id-ID').format(amount);
  };

  // Dapatkan ikon berdasarkan tipe voucher
  const getVoucherIcon = (type) => {
    switch (type) {
      case 'shipping_free':
        return <Truck size={16} className="text-blue-400" />;
      case 'discount_percent':
        return <Percent size={16} className="text-purple-400" />;
      case 'discount_nominal':
        return <Coins size={16} className="text-yellow-400" />;
      default:
        return <Tag size={16} className="text-gray-400" />;
    }
  };

  // Dapatkan label benefit
  const getBenefitLabel = (voucher) => {
    switch (voucher.type) {
      case 'shipping_free':
        return 'Gratis Ongkir';
      case 'discount_percent':
        return `${voucher.value}% Diskon`;
      case 'discount_nominal':
        return `Rp ${formatRupiah(voucher.value)} Diskon`;
      default:
        return '';
    }
  };

  // Cek apakah voucher valid
  const isVoucherValid = (voucher) => {
    // Cek expired
    if (voucher.expiry_date && new Date(voucher.expiry_date) < new Date()) {
      return false;
    }
    // Cek min order
    if (voucher.min_order && subtotal < voucher.min_order) {
      return false;
    }
    // Cek usage limit
    if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) {
      return false;
    }
    return true;
  };

  if (!isOpen) return null;

  const validVouchers = vouchers.filter(v => isVoucherValid(v));
  const invalidVouchers = vouchers.filter(v => !isVoucherValid(v));

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] border border-white/10 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-display flex items-center gap-2">
              <Gift size={20} className="text-yellow-500" />
              Pilih Voucher
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Pilih voucher yang ingin digunakan ({selectedIds.length} dipilih)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Body - Daftar Voucher */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {vouchers.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <Gift size={40} className="mx-auto mb-3 opacity-30" />
              <p>Belum ada voucher yang tersedia</p>
            </div>
          )}

          {/* Valid Vouchers */}
          {validVouchers.map(voucher => {
            const isSelected = selectedIds.includes(voucher.id);
            const isShippingFree = voucher.type === 'shipping_free';
            
            return (
              <div
                key={voucher.id}
                onClick={() => toggleVoucher(voucher.id)}
                className={`relative p-4 rounded-lg border cursor-pointer transition ${
                  isSelected 
                    ? 'border-yellow-500 bg-yellow-500/10' 
                    : 'border-white/10 hover:border-yellow-500/30 bg-gray-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected 
                      ? 'border-yellow-500 bg-yellow-500' 
                      : 'border-gray-500'
                  }`}>
                    {isSelected && <Check size={12} className="text-black" />}
                  </div>

                  {/* Icon & Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getVoucherIcon(voucher.type)}
                      <span className="font-semibold text-sm">{voucher.name}</span>
                      {voucher.is_global && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Global</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{voucher.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-xs font-semibold text-yellow-500">
                        {getBenefitLabel(voucher)}
                      </span>
                      {voucher.min_order > 0 && (
                        <span className="text-[10px] text-gray-500">
                          Min. belanja Rp {formatRupiah(voucher.min_order)}
                        </span>
                      )}
                      {voucher.expiry_date && (
                        <span className="text-[10px] text-gray-500">
                          Berlaku hingga {new Date(voucher.expiry_date).toLocaleDateString('id-ID')}
                        </span>
                      )}
                      {voucher.usage_limit !== null && (
                        <span className="text-[10px] text-gray-500">
                          Sisa: {voucher.usage_limit - (voucher.used_count || 0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Shipping Free Badge */}
                  {isShippingFree && isSelected && (
                    <div className="text-xs text-green-400 font-medium flex items-center gap-1">
                      <Truck size={12} /> Ongkir gratis!
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Invalid Vouchers (greyed out) */}
          {invalidVouchers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-gray-500 mb-2">Voucher tidak tersedia</p>
              {invalidVouchers.map(voucher => (
                <div
                  key={voucher.id}
                  className="p-3 rounded-lg border border-white/5 bg-gray-800/30 opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    {getVoucherIcon(voucher.type)}
                    <span className="text-sm font-medium line-through">{voucher.name}</span>
                    <span className="text-[10px] text-gray-500 ml-auto">
                      {!isVoucherValid(voucher) && (
                        <span className="flex items-center gap-1">
                          <AlertCircle size={10} /> 
                          {voucher.min_order > subtotal ? 'Min. order tidak cukup' : 'Tidak tersedia'}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

       {/* Footer */}
<div className="p-4 border-t border-white/10">
  {error && (
    <p className="text-red-400 text-sm mb-2">{error}</p>
  )}
  <div className="flex gap-3">
    {/* Tombol Bersihkan Semua */}
    <button
      onClick={() => setSelectedIds([])}
      disabled={selectedIds.length === 0}
      className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition disabled:opacity-50 text-sm"
    >
      ✕ Bersihkan
    </button>
    
    <button
      onClick={handleApply}
      disabled={loading || selectedIds.length === 0}
      className="flex-1 bg-yellow-500 text-black font-semibold py-2 rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
    >
      {loading ? 'Memproses...' : `Pakai Voucher (${selectedIds.length})`}
    </button>
    <button
      onClick={onClose}
      className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
    >
      Tutup
    </button>
  </div>
</div>
      </div>
    </div>
  );
}