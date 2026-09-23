import ProductCard from './ProductCard';

export default function ProductGrid({ 
  products, 
  title, 
  subtitle, 
  className = '',
  desktopCols = 4,
  mobileCols = 2,
  viewport = null // 'mobile' | 'tablet' | 'desktop' | null
}) {
  if (!products || products.length === 0) return null;

  // Enforce column layout based on viewport mode
  let gridColsClass = '';
  if (viewport === 'mobile') {
    gridColsClass = Number(mobileCols) === 1 ? 'grid-cols-1' : 'grid-cols-2';
  } else if (viewport === 'tablet') {
    gridColsClass = Number(desktopCols) === 2 ? 'grid-cols-2' : 'grid-cols-3';
  } else if (viewport === 'desktop') {
    gridColsClass = {
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4'
    }[Number(desktopCols)] || 'grid-cols-4';
  } else {
    // Normal responsive mode for live storefront
    const mobileClass = Number(mobileCols) === 1 ? 'grid-cols-1' : 'grid-cols-2';
    const desktopClass = {
      2: 'md:grid-cols-2',
      3: 'md:grid-cols-3',
      4: 'md:grid-cols-3 lg:grid-cols-4'
    }[Number(desktopCols)] || 'md:grid-cols-3 lg:grid-cols-4';
    gridColsClass = `${mobileClass} ${desktopClass}`;
  }

  const gapClass = viewport === 'mobile' ? 'gap-2.5' : 'gap-2.5 sm:gap-4 lg:gap-6';
  const paddingClass = viewport === 'mobile' ? 'px-3' : 'px-3 sm:px-6 lg:px-8';
  const titleSizeClass = viewport === 'mobile' ? 'text-xl' : 'text-2xl sm:text-3xl';

  return (
    <section className={`w-full ${paddingClass} max-w-7xl mx-auto ${className}`}>
      {title && (
        <div className="mb-3 sm:mb-6 text-left">
          <h2 className={`${titleSizeClass} font-extrabold tracking-tight text-white uppercase`}>
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Dynamic Grid Layout */}
      <div className={`grid ${gridColsClass} ${gapClass}`}>
        {products.map((product, idx) => (
          <ProductCard
            key={product.handle || product.id}
            product={product}
            priority={idx < 4}
          />
        ))}
      </div>
    </section>
  );
}
