import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, LayoutGrid, User, ShoppingBag, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function BottomNav() {
  const [totalItems, setTotalItems] = useState(0);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const syncCartCount = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      setTotalItems(cart.reduce((sum, item) => sum + (item.qty || 1), 0));
    } catch {
      setTotalItems(0);
    }
  };

  useEffect(() => {
    syncCartCount();
    window.addEventListener('storage', syncCartCount);
    window.addEventListener('cart-updated', syncCartCount);
    return () => {
      window.removeEventListener('storage', syncCartCount);
      window.removeEventListener('cart-updated', syncCartCount);
    };
  }, []);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setShowSearchModal(false);
    navigate(`/products?q=${encodeURIComponent(searchInput.trim())}`);
  };

  // Don't render on desktop viewports or admin views
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      {/* Floating 5-Item Navigation Dock matching reference screenshot */}
      <nav 
        aria-label="Mobile Navigation"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md pointer-events-auto"
      >
        <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/15 rounded-full px-3 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.7)] flex items-center justify-around">
          
          {/* 1. Home */}
          <NavLink
            to="/"
            end
            className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-2.5 rounded-full transition-all duration-150 ${
              isActive 
                ? 'text-white opacity-100 font-bold scale-[1.05]' 
                : 'text-zinc-400 opacity-70 hover:opacity-100 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] tracking-tight">Home</span>
          </NavLink>

          {/* 2. Search */}
          <button
            type="button"
            onClick={() => setShowSearchModal(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-full text-zinc-400 opacity-70 hover:opacity-100 hover:text-white transition-all duration-150"
          >
            <Search className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] tracking-tight">Search</span>
          </button>

          {/* 3. Collection */}
          <NavLink
            to="/products"
            className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-2.5 rounded-full transition-all duration-150 ${
              isActive 
                ? 'text-white opacity-100 font-bold scale-[1.05]' 
                : 'text-zinc-400 opacity-70 hover:opacity-100 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] tracking-tight">Collection</span>
          </NavLink>

          {/* 4. Account */}
          <NavLink
            to={user ? "/account" : "/login"}
            className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-2.5 rounded-full transition-all duration-150 ${
              isActive 
                ? 'text-white opacity-100 font-bold scale-[1.05]' 
                : 'text-zinc-400 opacity-70 hover:opacity-100 hover:text-white'
            }`}
          >
            <User className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] tracking-tight">Account</span>
          </NavLink>

          {/* 5. Cart with Red Counter Badge */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-cart-drawer'))}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-full transition-all duration-150 ${
              location.pathname === '/cart' 
                ? 'text-white opacity-100 font-bold scale-[1.05]' 
                : 'text-zinc-400 opacity-70 hover:opacity-100 hover:text-white'
            }`}
          >
            <div className="relative">
              <ShoppingBag className="w-4 h-4 mb-0.5" />
              {/* Red Badge Indicator matching screenshot */}
              <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-black shadow-sm">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            </div>
            <span className="text-[10px] tracking-tight">Cart</span>
          </button>

        </div>
      </nav>

      {/* Quick Search Overlay Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start justify-center p-4 pt-20 animate-fade-in">
          <div className="bg-[#121212] border border-white/20 rounded-2xl w-full max-w-lg p-5 shadow-2xl relative">
            <button
              onClick={() => setShowSearchModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-white" />
              Search Confelion
            </h3>

            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder="Search shirts, baggy jeans, tees, hoodies..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 bg-black border border-white/20 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Suggestion Pills */}
              <div className="flex flex-wrap gap-1.5 text-xs text-zinc-400 pt-1">
                <span className="text-zinc-500 py-1">Popular:</span>
                {['Unique Tees', 'Waffle Knit', 'Wide Baggy', 'Baggy Jeans', 'Confelion Shirt'].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setShowSearchModal(false);
                      navigate(`/products?q=${encodeURIComponent(term)}`);
                    }}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white text-[11px] transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
