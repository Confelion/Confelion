import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

export default function ProductCard({ product }) {
  const [isHovered, setIsHovered] = useState(false);

  const priceVal = typeof product.price === 'number' ? product.price : parseFloat(product.price || 0);
  const compareVal = product.compare_at_price ? (typeof product.compare_at_price === 'number' ? product.compare_at_price : parseFloat(product.compare_at_price)) : null;

  const handleQuickAddClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-quick-add', { detail: product }));
  };

  return (
    <div className="group relative flex flex-col bg-black select-none">
      {/* 3:4 Portrait Media Box */}
      <Link 
        to={`/product/${product.handle}`}
        className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-950 block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={product.image_url}
          alt={product.title}
          loading="lazy"
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            isHovered && product.secondary_image ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {product.secondary_image && (
          <img
            src={product.secondary_image}
            alt={`${product.title} back view`}
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Floating Circular Quick-Add Button */}
        <button
          onClick={handleQuickAddClick}
          aria-label={`Quick add ${product.title}`}
          className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 z-20 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95 group-hover:border-white/40"
        >
          <div className="relative">
            <ShoppingBag className="w-4 h-4 text-white stroke-[1.8]" />
            <span className="absolute -top-1 -right-1 text-[9px] font-bold leading-none">+</span>
          </div>
        </button>
      </Link>

      {/* Product Details below image */}
      <div className="pt-2 pb-1 text-left min-w-0">
        <Link to={`/product/${product.handle}`} className="block">
          <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-white truncate hover:text-zinc-300 transition-colors">
            {product.title}
          </h3>
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-white tracking-tight whitespace-nowrap">
            Rs. {priceVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          {compareVal && compareVal > priceVal && (
            <span className="text-[10px] sm:text-xs text-zinc-500 line-through whitespace-nowrap">
              Rs. {compareVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
