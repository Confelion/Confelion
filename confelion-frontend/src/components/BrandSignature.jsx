export default function BrandSignature({ text = 'CONFELION', viewport = null }) {
  const fontClass = viewport === 'mobile'
    ? 'text-3xl sm:text-4xl tracking-wider'
    : viewport === 'tablet'
    ? 'text-5xl sm:text-6xl tracking-widest'
    : viewport === 'desktop'
    ? 'text-7xl lg:text-[8rem] tracking-widest'
    : 'text-3xl sm:text-5xl md:text-7xl lg:text-[clamp(3.5rem,8.5vw,8.5rem)] tracking-wider sm:tracking-widest';

  const pyClass = viewport === 'mobile' ? 'py-6' : 'py-8 sm:py-12';

  return (
    <section className={`w-full overflow-hidden bg-black ${pyClass} border-t border-b border-white/10 select-none`}>
      <div className="flex items-center justify-center px-4">
        <h1 className={`${fontClass} font-black uppercase text-white/90 text-center leading-none select-none whitespace-nowrap`}>
          {text || 'CONFELION'}
        </h1>
      </div>
    </section>
  );
}
