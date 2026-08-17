import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import MobileTabbar from './components/MobileTabbar.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Favorites from './pages/Favorites.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import GiftFinder from './pages/GiftFinder.jsx';
import Orders from './pages/Orders.jsx';
import Wheel from './pages/Wheel.jsx';
import Redeem from './pages/Redeem.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <header id="site-header">
        <Header />
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/product/:id" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/gift" element={<GiftFinder />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/wheel" element={<Wheel />} />
        <Route path="/redeem/:token" element={<Redeem />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>

      <Footer />
      <MobileTabbar />
    </>
  );
}
