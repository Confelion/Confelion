import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { fetchAPI } from '../lib/api';
import { fetchFirestoreProducts, subscribeToProducts } from '../lib/firebase';
import { PRODUCTS_DATA } from '../data/mockData';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [rawProducts, setRawProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeType = searchParams.get('type') || 'all';
  const sort = searchParams.get('sort') || 'featured';
  const searchQuery = searchParams.get('q') || '';

  const categories = [
    { id: 'all', label: 'ALL PRODUCTS' },
    { id: 'shirt', label: 'SHIRTS' },
    { id: 'tee', label: 'T-SHIRTS' },
    { id: 'jeans', label: 'BAGGY JEANS' },
    { id: 'hoodie', label: 'HOODIES' },
  ];

  // Apply filters and sorting to raw combined products
  const applyFilters = (items) => {
    let filtered = [...items];

    if (activeType !== 'all') {
      filtered = filtered.filter(p => (p.type || p.category || '').toLowerCase() === activeType.toLowerCase());
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

      const map = new Map();
      PRODUCTS_DATA.forEach(p => map.set(p.handle || p.id, p));
      if (Array.isArray(apiProds)) apiProds.forEach(p => map.set(p.handle || p.id, p));
      if (Array.isArray(fsProds)) fsProds.forEach(p => map.set(p.handle || p.id, p));

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
        setRawProducts(prev => {
          const map = new Map();
          PRODUCTS_DATA.forEach(p => map.set(p.handle || p.id, p));
          prev.forEach(p => map.set(p.handle || p.id, p));
          liveProds.forEach(p => map.set(p.handle || p.id, p));
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
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeType === cat.id
                    ? 'bg-white text-black border border-white'
                    : 'bg-black text-zinc-400 border border-white/20 hover:border-white/50 hover:text-white'
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
