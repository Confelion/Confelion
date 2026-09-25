import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search, User, ShoppingBag, X } from 'lucide-react';
import { STORE_SETTINGS } from '../data/mockData';
import { getStoredProducts } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { optimizeImageUrl, PLACEHOLDER_IMAGE } from '../utils/imageOptimizer';

export default function Navigation() {
  const { user, isAdmin, signOut } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const updateCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      setCartCount(cart.reduce((sum, item) => sum + (item.qty || 1), 0));
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => {
    updateCart();
    window.addEventListener('storage', updateCart);
    window.addEventListener('cart-updated', updateCart);
    return () => {
      window.removeEventListener('storage', updateCart);
      window.removeEventListener('cart-updated', updateCart);
    };
  }, []);

  const handleOpenCart = () => {
    window.dispatchEvent(new Event('open-cart-drawer'));
  };

  const filteredSearchResults = searchQuery.trim()
    ? getStoredProducts().filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.category || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <>
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-white/10 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Left: Menu & Search */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setShowDrawer(true)}
              aria-label="Open navigation menu"
              className="p-1 text-white hover:text-zinc-300 transition-colors"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
            </button>
            <button
              onClick={() => setShowSearch(true)}
              aria-label="Open search"
              className="p-1 text-white hover:text-zinc-300 transition-colors"
            >
              <Search className="w-5 h-5 stroke-[1.8]" />
            </button>
          </div>

          {/* Center: Brand Logo */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
            <Link to="/" className="flex items-center justify-center hover:opacity-90 transition-opacity py-1">
              <img 
                src="/images/confelion-logo.png" 
                alt="CONFELION" 
                className="h-8 sm:h-9 md:h-10 w-auto max-w-[170px] sm:max-w-[220px] object-contain" 
              />
            </Link>
          </div>

          {/* Right: Account & Cart Bag */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to={user ? (isAdmin ? '/admin' : '/account') : '/login'}
              aria-label={user ? (isAdmin ? 'Admin Console' : 'My Account') : 'Sign In'}
              className="hidden sm:flex items-center gap-1.5 p-1 text-white hover:text-zinc-300 transition-colors"
            >
              <div className="relative">
                <User className="w-5 h-5 stroke-[1.8]" />
                {user && (
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-black ${
                    isAdmin ? 'bg-amber-400' : 'bg-emerald-400'
                  }`} />
                )}
              </div>
              {user && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 max-w-[80px] truncate">
                  {isAdmin ? 'Admin' : (user.name ? user.name.split(' ')[0] : 'Account')}
                </span>
              )}
            </Link>

            {/* Bag Button */}
            <button
              onClick={handleOpenCart}
              aria-label="Open shopping bag"
              className="relative p-1 text-white hover:text-zinc-300 transition-colors"
            >
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 bg-white text-black text-[10px] font-bold flex items-center justify-center rounded-full leading-none">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Side Menu Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex animate-fade-in">
          <div className="w-72 sm:w-80 bg-black border-r border-white/15 h-full p-6 flex flex-col justify-between animate-slide-up select-none">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-white/10">
                <Link to="/" onClick={() => setShowDrawer(false)} className="flex items-center">
                  <img 
                    src="/images/confelion-logo.png" 
                    alt="CONFELION" 
                    className="h-7 w-auto max-w-[150px] object-contain" 
                  />
                </Link>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-8 space-y-4">
                <Link
                  to="/"
                  onClick={() => setShowDrawer(false)}
                  className="block text-base font-bold uppercase tracking-wider text-white hover:text-zinc-400 transition-colors"
                >
                  Home
                </Link>
                <Link
                  to="/products"
                  onClick={() => setShowDrawer(false)}
                  className="block text-base font-bold uppercase tracking-wider text-white hover:text-zinc-400 transition-colors"
                >
                  All Products
                </Link>
                <Link
                  to="/products?type=shirt"
                  onClick={() => setShowDrawer(false)}
                  className="block text-sm font-medium uppercase tracking-wider text-zinc-300 hover:text-white pl-2 transition-colors"
                >
                  Shirts
                </Link>
                <Link
                  to="/products?type=tee"
                  onClick={() => setShowDrawer(false)}
                  className="block text-sm font-medium uppercase tracking-wider text-zinc-300 hover:text-white pl-2 transition-colors"
                >
                  T-Shirts
                </Link>
                <Link
                  to="/products?type=jeans"
                  onClick={() => setShowDrawer(false)}
                  className="block text-sm font-medium uppercase tracking-wider text-zinc-300 hover:text-white pl-2 transition-colors"
                >
                  Baggy Jeans
                </Link>
                <Link
                  to="/products?type=hoodie"
                  onClick={() => setShowDrawer(false)}
                  className="block text-sm font-medium uppercase tracking-wider text-zinc-300 hover:text-white pl-2 transition-colors"
                >
                  Hoodies
                </Link>
              </nav>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-2 text-xs text-zinc-400">
              {user ? (
                <>
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-white font-bold uppercase tracking-wider text-xs">
                      {user.name || 'Valued Patron'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                      {isAdmin ? 'ADMIN' : 'MEMBER'}
                    </span>
                  </div>
                  <Link
                    to={isAdmin ? '/admin' : '/account'}
                    onClick={() => setShowDrawer(false)}
                    className="block text-xs uppercase tracking-wider text-white font-bold py-1 hover:text-zinc-300"
                  >
                    {isAdmin ? '→ Admin Dashboard' : '→ Order History & Profile'}
                  </Link>
                  <button
                    onClick={() => {
                      setShowDrawer(false);
                      signOut();
                    }}
                    className="block text-left text-zinc-500 hover:text-red-400 uppercase text-[11px] font-semibold py-1"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setShowDrawer(false)}
                  className="block text-xs uppercase tracking-wider text-white font-bold hover:underline py-1"
                >
                  Patron Sign In / Register
                </Link>
              )}
              <div className="pt-4 border-t border-white/10 flex items-center gap-2.5">
                <img src="/images/confelion-icon.png" alt="" className="w-5 h-5 object-contain opacity-70" />
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                  CONFELION · All Black Collective
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md p-4 sm:p-8 flex flex-col animate-fade-in">
          <div className="max-w-2xl w-full mx-auto flex flex-col flex-1">
            <div className="flex items-center justify-between pb-4 border-b border-white/20">
              <div className="flex items-center gap-3 flex-1">
                <Search className="w-5 h-5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="SEARCH ALL BLACK PRODUCTS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-zinc-600 font-bold uppercase tracking-wider focus:outline-none"
                />
              </div>
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto mt-6 space-y-3">
              {searchQuery.trim() === '' ? (
                <div className="text-center py-12 text-zinc-600 text-xs uppercase tracking-widest">
                  Type to find shirts, tees, jeans, or hoodies
                </div>
              ) : filteredSearchResults.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs uppercase tracking-widest">
                  No products found for "{searchQuery}"
                </div>
              ) : (
                filteredSearchResults.map((prod) => (
                  <Link
                    key={prod.handle}
                    to={`/product/${prod.handle}`}
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-4 p-2.5 bg-zinc-950 border border-white/10 hover:border-white/30 transition-colors"
                  >
                    <img
                      src={optimizeImageUrl(prod.image_url, { width: 100, height: 120, format: 'webp' })}
                      alt={prod.title}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = PLACEHOLDER_IMAGE;
                      }}
                      className="w-12 h-14 object-cover bg-black"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white uppercase truncate">{prod.title}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">Rs. {prod.price}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
