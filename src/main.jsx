// ========== FILE: src/main.jsx ==========
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// DS001: Export fungsi minta izin notifikasi (bisa dipakai di Navbar/App)
export function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Browser tidak mendukung Notification');
    return;
  }
  Notification.requestPermission().then((permission) => {
    if (permission === 'granted') {
      console.log('✅ Notifikasi diizinkan');
    } else {
      console.log('❌ Notifikasi ditolak');
    }
  });
}

// DS001: Registrasi Service Worker (jika belum dilakukan oleh plugin PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered:', registration.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new Event('pwa-install-ready'));
});

export function getDeferredPrompt() {
  return deferredPrompt;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)