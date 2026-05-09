// ========== IMPORTS ==========
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import StoresPage from './pages/StoresPage';
import StoreDetailPage from './pages/StoreDetailPage';
import LoginPage from './pages/LoginPage';

// ========== MAIN APP ==========
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/store/:slug" element={<StoreDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Nanti tambah dashboard store & member area */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;