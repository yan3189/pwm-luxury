// src/pages/MemberSettingsCallback.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleLinkingCallback } from '../services/authService';

export default function MemberSettingsCallback() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function processCallback() {
      try {
        await handleLinkingCallback();
        setStatus('success');
        setTimeout(() => {
          navigate('/member/dashboard');
        }, 2000);
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    }
    
    processCallback();
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-white">Memproses koneksi Google...</p>
        </div>
      </div>
    );
  }
  
  if (status === 'error') {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="text-center text-red-400">
          <p className="text-xl">⚠️ Gagal menghubungkan</p>
          <p>{error}</p>
          <button onClick={() => navigate('/member/dashboard')} className="mt-4 text-yellow-500">
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-black min-h-screen flex items-center justify-center">
      <div className="text-center text-green-400">
        <p className="text-xl">✓ Berhasil!</p>
        <p>Akun Google telah terhubung. Mengalihkan...</p>
      </div>
    </div>
  );
}