import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { fetchAPI } from '../lib/api';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
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

  const loadProducts = () => {
    const query = new URLSearchParams();
    if (activeType !== 'all') query.set('type', activeType);
    if (sort !== 'featured') query.set('sort', sort);
    if (searchQuery) query.set('q', searchQuery);

    fetchAPI(`/api/products?${query.toString()}`)
      .then((res) => {
        setProducts(res);
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    loadProducts();

    const handleProductsUpdate = () => loadProducts();
    window.addEventListener('products-updated', handleProductsUpdate);
    window.addEventListener('storage', handleProductsUpdate);

    return () => {
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
