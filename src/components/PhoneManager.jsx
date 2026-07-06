// ============================================================
// FILE: src/components/PhoneManager.jsx
// Komponen manajemen nomor HP di dashboard
// ============================================================

import { useState, useEffect } from 'react';
import { Phone, Edit2, Trash2, Check, X, Plus, Star } from 'lucide-react';
import { 
  getMemberPhones, 
  addPhone, 
  updatePhone, 
  deletePhone, 
  setDefaultPhone,
  formatPhone,
  validatePhone 
} from '../services/phoneService';

export default function PhoneManager({ memberId, onUpdate }) {
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPhone, setEditingPhone] = useState(null);
  
  // Form state
  const [formPhone, setFormPhone] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (memberId) {
      loadPhones();
    }
  }, [memberId]);

  const loadPhones = async () => {
    setLoading(true);
    try {
      const data = await getMemberPhones(memberId);
      setPhones(data);
    } catch (error) {
      console.error('Error loading phones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingPhone(null);
    setFormPhone('');
    setFormLabel('');
    setFormIsDefault(phones.length === 0); // Jika tidak ada, default true
    setFormError('');
    setShowModal(true);
  };

  const handleEdit = (phone) => {
    setEditingPhone(phone);
    setFormPhone(phone.phone);
    setFormLabel(phone.label || '');
    setFormIsDefault(phone.is_default || false);
    setFormError('');
    setShowModal(true);
  };

  const handleDelete = async (phoneId) => {
    if (!confirm('Hapus nomor HP ini?')) return;
    
    try {
      await deletePhone(phoneId, memberId);
      await loadPhones();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting phone:', error);
      alert('Gagal menghapus: ' + error.message);
    }
  };

  const handleSetDefault = async (phoneId) => {
    try {
      await setDefaultPhone(phoneId, memberId);
      await loadPhones();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error setting default:', error);
      alert('Gagal set default: ' + error.message);
    }
  };

  const handleSave = async () => {
    // Validasi
    if (!validatePhone(formPhone)) {
      setFormError('Nomor HP tidak valid. Minimal 10 digit.');
      return;
    }
    setFormError('');

    // Cek duplikat (kecuali sedang edit)
    const exists = phones.some(p => 
      p.phone === formPhone.replace(/\s/g, '') && 
      p.id !== editingPhone?.id
    );
    if (exists) {
      setFormError('Nomor HP sudah terdaftar.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingPhone) {
        await updatePhone(editingPhone.id, {
          phone: formPhone,
          label: formLabel || null,
          is_default: formIsDefault
        }, memberId);
      } else {
        await addPhone(memberId, formPhone, formLabel || null, formIsDefault);
      }
      
      await loadPhones();
      if (onUpdate) onUpdate();
      setShowModal(false);
      
    } catch (error) {
      console.error('Error saving phone:', error);
      alert('Gagal menyimpan: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10">
        <p className="text-gray-400 text-center">Memuat nomor HP...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 rounded-xl p-4 border border-white/10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Phone size={18} className="text-yellow-500" />
          Nomor HP Tersimpan ({phones.length})
        </h3>
        <button
          onClick={handleAdd}
          className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm hover:bg-yellow-600 transition flex items-center gap-1"
        >
          <Plus size={14} /> Tambah
        </button>
      </div>

      {phones.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          Belum ada nomor HP. Klik "Tambah" untuk menambahkan.
        </p>
      ) : (
        <div className="space-y-2">
          {phones.map(phone => (
            <div 
              key={phone.id} 
              className={`bg-gray-800/50 rounded-lg p-3 flex justify-between items-center ${
                phone.is_default ? 'border border-yellow-500/30' : ''
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatPhone(phone.phone)}</span>
                  {phone.is_default && (
                    <span className="text-yellow-500 text-xs bg-yellow-500/20 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Star size={10} /> Utama
                    </span>
                  )}
                  {phone.label && (
                    <span className="text-gray-400 text-xs bg-gray-700/50 px-2 py-0.5 rounded-full">
                      {phone.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">ID: {phone.id.substring(0, 8)}...</p>
              </div>
              
              <div className="flex gap-1 flex-shrink-0">
                {!phone.is_default && (
                  <button
                    onClick={() => handleSetDefault(phone.id)}
                    className="text-yellow-500 hover:text-yellow-400 text-xs px-2 py-1 rounded hover:bg-yellow-500/10 transition"
                  >
                    Jadikan Utama
                  </button>
                )}
                <button
                  onClick={() => handleEdit(phone)}
                  className="text-blue-400 hover:text-blue-300 p-1 rounded hover:bg-blue-500/10 transition"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(phone.id)}
                  className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== MODAL TAMBAH/EDIT ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-display">
                {editingPhone ? 'Edit Nomor HP' : 'Tambah Nomor HP'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Label</label>
                <input
                  type="text"
                  placeholder="Contoh: Rumah, Kantor, Orang Tua"
                  className="w-full p-2 rounded bg-black/50 border border-white/20 focus:border-yellow-500 focus:outline-none"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Nomor HP</label>
                <input
                  type="tel"
                  placeholder="0812-3456-7890"
                  className={`w-full p-2 rounded bg-black/50 border ${formError ? 'border-red-500' : 'border-white/20'} focus:border-yellow-500 focus:outline-none`}
                  value={formPhone}
                  onChange={(e) => {
                    setFormPhone(e.target.value);
                    if (formError) setFormError('');
                  }}
                />
                {formError && (
                  <p className="text-xs text-red-400 mt-1">{formError}</p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="accent-yellow-500"
                />
                <span className="text-gray-300">Jadikan nomor HP utama</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={submitting || !formPhone}
                  className="flex-1 bg-yellow-500 text-black py-2 rounded-lg font-semibold hover:bg-yellow-600 transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}