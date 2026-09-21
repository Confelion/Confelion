import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Admin from './pages/Admin'
import ThemeCustomizer from './pages/ThemeCustomizer'
import Account from './pages/Account'
import NotFound from './pages/NotFound'
import Preview from './pages/Preview'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/preview/:token" element={<Preview />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/editor" element={<ThemeCustomizer />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="product/:handle" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="account" element={<Account />} />
          <Route path="customer" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
