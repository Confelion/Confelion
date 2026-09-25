import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { fetchAPI, getDeletedProductHandles, getStoredProducts } from '../lib/api';
import { fetchFirestoreProducts, subscribeToProducts } from '../lib/firebase';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [rawProducts, setRawProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeType = searchParams.get('type') || 'all';
  const sort = searchParams.get('sort') || 'featured';
  const searchQuery = searchParams.get('q') || '';

  const categories = [
    { id: 'all', label: 'ALL' },
    { id: 'unique-tees', label: 'UNIQUE TEES', type: 'tee', q: '' },
    { id: 'waffle-knit', label: 'WAFFLE KNIT', type: 'tee', q: 'waffle' },
    { id: 'wide-baggy', label: 'WIDE BAGGY', type: 'jeans', q: 'wide' },
    { id: 'baggy-jeans', label: 'BAGGY JEANS', type: 'jeans', q: '' },
    { id: 'confelion-shirt', label: 'CONFELION SHIRT', type: 'shirt', q: '' },
    { id: 'formal-edge', label: 'FORMAL EDGE', type: 'shirt', q: 'formal' },
    { id: 'selects-by-confelion', label: 'SELECTS BY CONFELION', isFeatured: true },
  ];

  // Apply filters and sorting to raw combined products
  const applyFilters = (items) => {
    let filtered = [...items];

    const currentCat = categories.find(c => c.id === activeType);

    if (activeType === 'selects-by-confelion') {
      filtered = filtered.filter(p => p.is_bestseller || p.is_recent_drop || p.featured);
    } else if (currentCat && currentCat.type) {
      filtered = filtered.filter(p => {
        const pType = (p.type || p.category || '').toLowerCase();
        const matchesType = pType.includes(currentCat.type.toLowerCase());
        if (!currentCat.q) return matchesType;
        const qSub = currentCat.q.toLowerCase();
        const text = `${p.title || ''} ${p.description || ''} ${p.tags || ''}`.toLowerCase();
        return matchesType && text.includes(qSub);
      });
    } else if (activeType !== 'all') {
      filtered = filtered.filter(p => (p.type || p.category || '').toLowerCase().includes(activeType.toLowerCase()));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        (p.title || '').toLowerCase().includes(q) || 
        (p.description || '').toLowerCase().includes(q)
      );
    }

    if (sort === 'price-low') {
      filtered.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sort === 'price-high') {
      filtered.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    setProducts(filtered);
  };

  const loadProducts = async () => {
    try {
      const [apiProds, fsProds] = await Promise.all([
        fetchAPI('/api/products').catch(() => []),
        fetchFirestoreProducts().catch(() => [])
      ]);

      const deleted = getDeletedProductHandles();
      const map = new Map();
      const catalog = (Array.isArray(apiProds) && apiProds.length > 0) ? apiProds : getStoredProducts();
      catalog.forEach(p => {
        const key = p.handle || p.id;
        if (!deleted.has(key) && !deleted.has(p.handle) && !deleted.has(p.id) && !p.is_deleted && p.published !== false) {
          map.set(key, p);
        }
      });
      if (Array.isArray(fsProds)) {
        fsProds.forEach(p => {
          const key = p.handle || p.id;
          if (!deleted.has(key) && !deleted.has(p.handle) && !deleted.has(p.id) && !p.is_deleted && p.published !== false) {
            map.set(key, p);
          }
        });
      }

      const combined = Array.from(map.values());
      setRawProducts(combined);
      applyFilters(combined);
    } catch (err) {
      console.error('Products load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    loadProducts();

    // Real-time synchronization: newly added or modified products appear instantly
    const unsub = subscribeToProducts((liveProds) => {
      if (Array.isArray(liveProds) && liveProds.length > 0) {
        const deleted = getDeletedProductHandles();
        setRawProducts(prev => {
          const map = new Map();
          prev.forEach(p => {
            const key = p.handle || p.id;
            if (!deleted.has(key) && !deleted.has(p.handle) && !deleted.has(p.id) && !p.is_deleted && p.published !== false) {
              map.set(key, p);
            }
          });
          liveProds.forEach(p => {
            const key = p.handle || p.id;
            if (!deleted.has(key) && !deleted.has(p.handle) && !deleted.has(p.id) && !p.is_deleted && p.published !== false) {
              map.set(key, p);
            }
          });
          const combined = Array.from(map.values());
          applyFilters(combined);
          return combined;
        });
      }
    });

    const handleProductsUpdate = () => loadProducts();
    window.addEventListener('products-updated', handleProductsUpdate);
    window.addEventListener('storage', handleProductsUpdate);

    return () => {
      unsub();
      window.removeEventListener('products-updated', handleProductsUpdate);
      window.removeEventListener('storage', handleProductsUpdate);
    };
  }, [activeType, sort, searchQuery]);

  const handleCategoryChange = (catId) => {
    const next = new URLSearchParams(searchParams);
    if (catId === 'all') {
      next.delete('type');
    } else {
      next.set('type', catId);
    }
    setSearchParams(next);
  };

  const handleSortChange = (e) => {
    const next = new URLSearchParams(searchParams);
    if (e.target.value === 'featured') {
      next.delete('sort');
    } else {
      next.set('sort', e.target.value);
    }
    setSearchParams(next);
  };

  return (
    <div className="w-full bg-black text-white min-h-screen selection:bg-white selection:text-black">
      {/* Category Header */}
      <div className="border-b border-white/10 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">
          {searchQuery ? `SEARCH: "${searchQuery}"` : 'ALL BLACK COLLECTION'}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400">
          {products.length} exclusive styles engineered in pure monochrome.
        </p>

        {/* Filter Navigation Chips */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`transition-all duration-200 rounded-full ${
                  cat.isFeatured
                    ? activeType === cat.id
                      ? 'px-5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-base font-black uppercase tracking-[0.16em] bg-white text-black border-2 border-white shadow-xl scale-[1.05]'
                      : 'px-5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-base font-black uppercase tracking-[0.16em] bg-zinc-950 text-white border-2 border-white/70 hover:border-white shadow-lg hover:scale-[1.03]'
                    : activeType === cat.id
                    ? 'px-3.5 py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-white text-black border border-white shadow-sm'
                    : 'px-3.5 py-1.5 text-[10px] sm:text-xs font-medium uppercase tracking-wider bg-black text-zinc-300 border border-white/25 hover:border-white/70 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sort selection */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 uppercase tracking-wider">Sort:</span>
            <select
              value={sort}
              onChange={handleSortChange}
              className="bg-black border border-white/20 text-white text-xs font-semibold px-2.5 py-1.5 focus:outline-none focus:border-white"
            >
              <option value="featured">Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Grid: 2-Column Mobile, 4-Column Desktop */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin mx-auto mb-3" />
            <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Loading pieces...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center">
            <h3 className="text-base font-bold uppercase tracking-wider text-white">No products found</h3>
            <p className="text-xs text-zinc-500 mt-1">Try switching categories or clearing search filters.</p>
            <button
              onClick={() => setSearchParams({})}
              className="mt-4 px-6 py-2.5 text-xs font-bold uppercase tracking-widest border border-white/30 text-white hover:bg-white hover:text-black transition-colors"
            >
              View All
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
            {products.map((product) => (
              <ProductCard key={product.handle || product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
