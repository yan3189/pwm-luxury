// ========== APP.JSX - ROUTING UTAMA ==========
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
//import StoresPage from './pages/StoresPage';
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
import MemberRegister from './pages/MemberRegister'
import MemberLogin from './pages/MemberLogin'
import MemberDashboard from './pages/MemberDashboard'
import AdminMembers from './pages/AdminMembers'
import AllStoresPage from './pages/AllStoresPage'
import FloatingContact from './components/FloatingContact';
import ContactPage from './pages/ContactPage';
import StoreContactPage from './pages/StoreContactPage';
import AdminContacts from './pages/AdminContacts';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import MemberOrders from './pages/MemberOrders'
import MemberOrderDetail from './pages/MemberOrderDetail'
import AdminOrders from './pages/AdminOrders'
import AdminOrderDetail from './pages/AdminOrderDetail'
import OrderSuccessPage from './pages/OrderSuccessPage'
import AdminShippingSettings from './pages/AdminShippingSettings'
import TrackOrderPage from './pages/TrackOrderPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        
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
        <Route path="/member/register" element={<MemberRegister />} />
        <Route path="/member/login" element={<MemberLogin />} />
        <Route path="/member/dashboard" element={<MemberDashboard />} />
        <Route path="/admin/members" element={<AdminMembers />} />
        <Route path="/stores" element={<AllStoresPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/store/:slug/contact" element={<StoreContactPage />} />
        <Route path="/admin/contacts" element={<AdminContacts />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/member/orders" element={<MemberOrders />} />
        <Route path="/member/orders/:id" element={<MemberOrderDetail />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
      <Route path="/order-success" element={<OrderSuccessPage />} />
      <Route path="/admin/shipping" element={<AdminShippingSettings />} />
      <Route path="/track-order/:id" element={<TrackOrderPage />} />
      </Routes>
      <FloatingContact />
    </BrowserRouter>
  );
}

export default App;