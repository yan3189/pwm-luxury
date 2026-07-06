// ============================================================
// FILE: src/components/PhoneSelector.jsx
// Komponen dropdown + form tambah nomor HP baru
// ============================================================

import { useState, useEffect } from 'react';
import { Phone, Plus, ChevronDown, Check, X } from 'lucide-react';
import { getMemberPhones, addPhone, formatPhone, validatePhone } from '../services/phoneService';

export default function PhoneSelector({ 
  memberId, 
  selectedPhoneId, 
  onSelect, 
  onPhoneAdded,
  required = true,
  label = 'Nomor HP Penerima',
  className = ''
}) {
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedId, setSelectedId] = useState(selectedPhoneId || null);
  
  // Form state
  const [newPhone, setNewPhone] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [newPhoneError, setNewPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load phones saat memberId berubah
  useEffect(() => {
    if (memberId) {
      loadPhones();
    }
  }, [memberId]);

  // Jika selectedPhoneId berubah dari luar, update state
  useEffect(() => {
    if (selectedPhoneId && selectedPhoneId !== selectedId) {
      setSelectedId(selectedPhoneId);
    }
  }, [selectedPhoneId]);

  const loadPhones = async () => {
    setLoading(true);
    try {
      const data = await getMemberPhones(memberId);
      setPhones(data);
      
      // Auto-select default atau phone pertama
      if (!selectedId && data.length > 0) {
        const defaultPhone = data.find(p => p.is_default) || data[0];
        setSelectedId(defaultPhone.id);
        if (onSelect) {
          onSelect(defaultPhone.id, defaultPhone.phone);
        }
      }
    } catch (error) {
      console.error('Error loading phones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (phoneId) => {
    setSelectedId(phoneId);
    const phone = phones.find(p => p.id === phoneId);
    if (onSelect) {
      onSelect(phoneId, phone?.phone || '');
    }
  };

  const handleAddNew = async () => {
    // Validasi
    if (!validatePhone(newPhone)) {
      setNewPhoneError('Nomor HP tidak valid. Minimal 10 digit.');
      return;
    }
    setNewPhoneError('');

    // Cek duplikat
    const exists = phones.some(p => p.phone === newPhone.replace(/\s/g, ''));
    if (exists) {
      setNewPhoneError('Nomor HP sudah terdaftar.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await addPhone(
        memberId,
        newPhone,
        newLabel || 'Lainnya',
        newIsDefault
      );
      
      // Refresh daftar
      await loadPhones();
      
      // Pilih phone yang baru
      setSelectedId(result.id);
      if (onSelect) {
        onSelect(result.id, result.phone);
      }
      if (onPhoneAdded) {
        onPhoneAdded(result);
      }
      
      // Reset form
      setNewPhone('');
      setNewLabel('');
      setNewIsDefault(false);
      setShowNewForm(false);
      
    } catch (error) {
      console.error('Error adding phone:', error);
      alert('Gagal menambahkan nomor HP: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Format nomor HP untuk tampilan
  const formatPhoneDisplay = (phone) => {
    return formatPhone(phone);
  };

  // Jika member tidak login, tampilkan input biasa
  if (!memberId) {
    return (
      <div className={className}>
        <label className="block text-sm text-gray-400 mb-1">{label}</label>
        <input
          type="tel"
          placeholder="0812-3456-7890"
          className="w-full p-2 rounded bg-black/50 border border-white/20 focus:border-yellow-500 focus:outline-none"
          onChange={(e) => onSelect && onSelect(null, e.target.value)}
          required={required}
        />
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className={className}>
        <label className="block text-sm text-gray-400 mb-1">{label}</label>
        <div className="bg-gray-800/50 rounded-lg p-3 text-gray-400 text-sm">
          Memuat nomor HP...
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="block text-sm text-gray-400 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {phones.length > 0 && !showNewForm ? (
        // ===== DROPDOWN =====
        <div className="relative">
          <select
            value={selectedId || ''}
            onChange={(e) => handleSelect(e.target.value)}
            className="w-full p-2 rounded bg-black/50 border border-white/20 focus:border-yellow-500 focus:outline-none appearance-none pr-10"
          >
            {phones.map(phone => (
              <option key={phone.id} value={phone.id}>
                {formatPhoneDisplay(phone.phone)} {phone.label ? `(${phone.label})` : ''}
                {phone.is_default && ' ★'}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          
          {selectedId && (
            <p className="text-xs text-gray-500 mt-1">
              Nomor HP: {formatPhoneDisplay(phones.find(p => p.id === selectedId)?.phone || '')}
            </p>
          )}
        </div>
      ) : (
        // ===== FORM TAMBAH BARU =====
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3 border border-white/10">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Label</label>
            <input
              type="text"
              placeholder="Contoh: Rumah, Kantor, Orang Tua"
              className="w-full p-2 rounded bg-black/50 border border-white/20 focus:border-yellow-500 focus:outline-none text-sm"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nomor HP</label>
            <input
              type="tel"
              placeholder="0812-3456-7890"
              className={`w-full p-2 rounded bg-black/50 border ${newPhoneError ? 'border-red-500' : 'border-white/20'} focus:border-yellow-500 focus:outline-none text-sm`}
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value);
                if (newPhoneError) setNewPhoneError('');
              }}
            />
            {newPhoneError && (
              <p className="text-xs text-red-400 mt-1">{newPhoneError}</p>
            )}
          </div>
          
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={newIsDefault}
              onChange={(e) => setNewIsDefault(e.target.checked)}
              className="accent-yellow-500"
            />
            <span className="text-gray-300">Jadikan nomor HP utama</span>
          </label>
          
          <div className="flex gap-2">
            <button
              onClick={handleAddNew}
              disabled={submitting || !newPhone}
              className="flex-1 bg-yellow-500 text-black py-2 rounded-lg text-sm font-semibold hover:bg-yellow-600 transition disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : '💾 Simpan & Gunakan'}
            </button>
            <button
              onClick={() => {
                setShowNewForm(false);
                setNewPhone('');
                setNewLabel('');
                setNewIsDefault(false);
                setNewPhoneError('');
              }}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-sm"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Tombol Tambah Baru (jika tidak dalam form) */}
      {phones.length > 0 && !showNewForm && (
        <button
          onClick={() => setShowNewForm(true)}
          className="mt-2 text-sm text-yellow-500 hover:text-yellow-400 transition flex items-center gap-1"
        >
          <Plus size={14} /> Tambah nomor HP baru
        </button>
      )}
    </div>
  );
}