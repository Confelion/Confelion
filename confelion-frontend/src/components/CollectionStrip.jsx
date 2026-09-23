import { Link, useSearchParams } from 'react-router-dom';

export const STORE_COLLECTIONS = [
  { id: 'unique-tees', label: 'UNIQUE TEES', type: 'tee', q: '' },
  { id: 'waffle-knit', label: 'WAFFLE KNIT', type: 'tee', q: 'waffle' },
  { id: 'wide-baggy', label: 'WIDE BAGGY', type: 'jeans', q: 'wide' },
  { id: 'baggy-jeans', label: 'BAGGY JEANS', type: 'jeans', q: '' },
  { id: 'confelion-shirt', label: 'CONFELION SHIRT', type: 'shirt', q: '' },
  { id: 'formal-edge', label: 'FORMAL EDGE', type: 'shirt', q: 'formal' },
  { id: 'selects-by-confelion', label: 'SELECTS BY CONFELION', type: 'all', featured: 'true', isFeatured: true }
];

export default function CollectionStrip({ activeId, onSelect, className = '' }) {
  const [searchParams] = useSearchParams();
  const currentType = searchParams.get('type');
  const currentQ = searchParams.get('q');
  const currentFeatured = searchParams.get('featured');

  return (
    <section className={`w-full py-6 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {/* Centered Collection Heading matching reference screenshot */}
      <div className="text-center mb-5 sm:mb-7">
        <h2 className="text-2xl sm:text-3xl font-serif uppercase tracking-[0.25em] text-white">
          COLLECTION
        </h2>
      </div>

      {/* Horizontal Pills Strip */}
      <div className="flex items-center justify-start md:justify-center gap-2 sm:gap-3 overflow-x-auto pb-3 scrollbar-none no-scrollbar px-1">
        {STORE_COLLECTIONS.map((col) => {
          const isSelected = activeId 
            ? activeId === col.id 
            : (col.isFeatured && currentFeatured === 'true') ||
              (!col.isFeatured && currentType === col.type && (!col.q || currentQ === col.q));

          const queryParts = [];
          if (col.type && col.type !== 'all') queryParts.push(`type=${col.type}`);
          if (col.q) queryParts.push(`q=${encodeURIComponent(col.q)}`);
          if (col.featured) queryParts.push(`featured=true`);
          const targetUrl = `/products${queryParts.length ? `?${queryParts.join('&')}` : ''}`;

          if (onSelect) {
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => onSelect(col)}
                className={`whitespace-nowrap transition-all duration-200 rounded-full cursor-pointer shrink-0 ${
                  col.isFeatured
                    ? isSelected
                      ? 'px-6 py-2.5 text-xs sm:text-base font-black uppercase tracking-[0.16em] bg-white text-black border-2 border-white shadow-xl scale-[1.05]'
                      : 'px-6 py-2.5 text-xs sm:text-base font-black uppercase tracking-[0.16em] bg-zinc-950 text-white border-2 border-white/70 hover:border-white shadow-lg hover:scale-[1.03]'
                    : isSelected
                    ? 'px-3.5 py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-white text-black border border-white shadow-sm'
                    : 'px-3.5 py-1.5 text-[10px] sm:text-xs font-medium uppercase tracking-wider bg-black text-zinc-300 border border-white/30 hover:border-white/80 hover:text-white'
                }`}
              >
                {col.label}
              </button>
            );
          }

          return (
            <Link
              key={col.id}
              to={targetUrl}
              className={`whitespace-nowrap transition-all duration-200 rounded-full inline-block shrink-0 ${
                col.isFeatured
                  ? isSelected
                    ? 'px-6 py-2.5 text-xs sm:text-base font-black uppercase tracking-[0.16em] bg-white text-black border-2 border-white shadow-xl scale-[1.05]'
                    : 'px-6 py-2.5 text-xs sm:text-base font-black uppercase tracking-[0.16em] bg-zinc-950 text-white border-2 border-white/70 hover:border-white shadow-lg hover:scale-[1.03]'
                  : isSelected
                  ? 'px-3.5 py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-white text-black border border-white shadow-sm'
                  : 'px-3.5 py-1.5 text-[10px] sm:text-xs font-medium uppercase tracking-wider bg-black text-zinc-300 border border-white/30 hover:border-white/80 hover:text-white'
              }`}
            >
              {col.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
