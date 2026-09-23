import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { addItemToCart } from '../lib/cartManager';
import { optimizeImageUrl, PLACEHOLDER_IMAGE } from '../utils/imageOptimizer';

export default function QuickAddModal() {
  const [product, setProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState('M');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const handleOpen = (e) => {
      if (e.detail) {
        setProduct(e.detail);
        const sizes = e.detail.sizes || ['S', 'M', 'L', 'XL', 'XXL'];
        setSelectedSize(sizes[0] || 'M');
        setAdded(false);
      }
    };

    window.addEventListener('open-quick-add', handleOpen);
    return () => window.removeEventListener('open-quick-add', handleOpen);
  }, []);

  if (!product) return null;

  const sizes = product.sizes || ['S', 'M', 'L', 'XL', 'XXL'];

  const handleAddToCart = () => {
    try {
      addItemToCart(product, selectedSize, 1);
      setAdded(true);

      setTimeout(() => {
        setProduct(null);
        setAdded(false);
        // Trigger cart drawer open for instant feedback
        window.dispatchEvent(new Event('open-cart-drawer'));
      }, 350);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-zinc-950 border border-white/20 text-white p-5 sm:p-6 shadow-2xl relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setProduct(null)}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Product Snapshot */}
        <div className="flex items-center gap-4 mb-5">
          <img
            src={optimizeImageUrl(product.image_url, { width: 160, height: 200, format: 'webp' })}
            alt={product.title}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
            className="w-16 h-20 object-cover bg-black border border-white/10"
          />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-tight text-white">{product.title}</h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-sm font-bold text-white">Rs. {product.price}</span>
              {product.compare_at_price && (
                <span className="text-xs text-zinc-500 line-through">Rs. {product.compare_at_price}</span>
              )}
            </div>
          </div>
        </div>

        {/* Size Selection */}
        <div className="mb-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Select Size
          </label>
          <div className="grid grid-cols-5 gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSize(s)}
                className={`h-10 border text-xs font-bold uppercase transition-all duration-150 ${
                  selectedSize === s
                    ? 'bg-white text-black border-white'
                    : 'bg-black text-white border-white/25 hover:border-white/60'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleAddToCart}
          disabled={added}
          className="w-full py-3.5 text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-zinc-200 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          {added ? (
            <>
              <Check className="w-4 h-4" /> Added to Bag
            </>
          ) : (
            'Add to Bag'
          )}
        </button>
      </div>
    </div>
  );
}
