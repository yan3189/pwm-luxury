// ========== APP.JSX - ROUTING UTAMA ==========
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import StoresPage from './pages/StoresPage';
import StoreDetailPage from './pages/StoreDetailPage';
import LoginPage from './pages/LoginPage';
import StorePage from './pages/StorePage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminProducts from './pages/AdminProducts';
import AdminNews from './pages/AdminNews';
import AllNewsPage from './pages/AllNewsPage';
import NewsDetailPage from './pages/NewsDetailPage';
import AllEventsPage from './pages/AllEventsPage';
import EventDetailPage from './pages/EventDetailPage';
import AdminEvents from './pages/AdminEvents';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/store/:slug" element={<StorePage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/products" element={<AdminProducts />} />
        <Route path="/admin/news" element={<AdminNews />} />
        <Route path="/news" element={<AllNewsPage />} />
        <Route path="/events" element={<AllEventsPage />} />
        <Route path="/admin/events" element={<AdminEvents />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/news/:id" element={<NewsDetailPage />} /> 
      </Routes>
    </BrowserRouter>
  );
}

export default App;