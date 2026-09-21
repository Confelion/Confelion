import { Link } from 'react-router-dom';

export default function Hero({ 
  imagePc = 'https://www.kaalvaish.in/cdn/shop/files/Kaalvaish_Hero_Banner_PC_1.png?v=1786518719&width=3840',
  imageMobile = 'https://www.kaalvaish.in/cdn/shop/files/Kaalvaish_Hero_Banner_MOBILE.png?v=1786518421&width=3840',
  buttonText = 'Shop Now',
  buttonLink = '/products',
  headline = '',
  subheadline = '',
  fontFamily = 'sans', // 'sans' | 'serif' | 'mono' | 'display'
  fontSize = 'lg', // 'sm' | 'md' | 'lg' | 'xl'
  textAlign = 'center', // 'left' | 'center' | 'right'
  overlayOpacity = 40, // 0 to 90
  viewport = null // 'mobile' | 'tablet' | 'desktop' | null
}) {
  // Font family mappings
  const fontClass = {
    sans: 'font-sans font-black',
    serif: 'font-serif font-bold italic',
    mono: 'font-mono font-bold tracking-tight',
    display: 'font-black tracking-[0.2em]'
  }[fontFamily] || 'font-sans font-black';

  // Font size mappings tailored to viewport
  const sizeClass = viewport === 'mobile' ? {
    sm: 'text-xl leading-tight',
    md: 'text-2xl leading-tight',
    lg: 'text-3xl leading-tight',
    xl: 'text-4xl leading-tight'
  }[fontSize] || 'text-3xl leading-tight' : {
    sm: 'text-2xl sm:text-3xl md:text-4xl',
    md: 'text-3xl sm:text-4xl md:text-5xl',
    lg: 'text-4xl sm:text-5xl md:text-6xl',
    xl: 'text-5xl sm:text-6xl md:text-7xl'
  }[fontSize] || 'text-4xl sm:text-5xl md:text-6xl';

  // Text alignment
  const alignClass = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end'
  }[textAlign] || 'text-center items-center';

  const bottomPosClass = viewport === 'mobile' ? 'bottom-4 px-4' : 'bottom-6 sm:bottom-12 px-4 sm:px-10';
  const subheadlineClass = viewport === 'mobile'
    ? 'text-xs text-zinc-300 font-medium tracking-wide mb-3 max-w-xs drop-shadow-md line-clamp-2'
    : 'text-xs sm:text-sm md:text-base text-zinc-300 font-medium tracking-wide mb-5 max-w-xl drop-shadow-md';
  const btnClass = viewport === 'mobile'
    ? 'px-6 py-2.5 text-xs'
    : 'px-8 py-3 text-xs sm:text-sm';

  return (
    <section className="relative w-full bg-black overflow-hidden select-none">
      {/* Responsive Images */}
      <div className="relative w-full">
        {viewport === 'mobile' ? (
          <img
            src={imageMobile || imagePc}
            alt="CONFELION All Black Fashion Mobile"
            className="w-full h-auto min-h-[62vh] max-h-[75vh] object-cover object-center block"
            priority="high"
          />
        ) : viewport === 'desktop' ? (
          <img
            src={imagePc}
            alt="CONFELION All Black Fashion"
            className="w-full h-auto max-h-[92vh] object-cover object-top block"
            priority="high"
          />
        ) : (
          <>
            {/* Desktop Image */}
            <img
              src={imagePc}
              alt="CONFELION All Black Fashion"
              className="hidden md:block w-full h-auto max-h-[92vh] object-cover object-top"
              priority="high"
            />
            {/* Mobile Image */}
            <img
              src={imageMobile}
              alt="CONFELION All Black Fashion Mobile"
              className="block md:hidden w-full h-auto min-h-[75vh] object-cover object-center"
              priority="high"
            />
          </>
        )}

        {/* Dynamic Overlay darkness */}
        <div 
          className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-300"
          style={{ opacity: Number(overlayOpacity || 0) / 100 }}
        />

        {/* Overlay gradient for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

        {/* Hero Content & CTA */}
        <div className={`absolute inset-x-0 ${bottomPosClass} flex flex-col justify-end z-10 max-w-7xl mx-auto ${alignClass}`}>
          {headline && (
            <h1 className={`uppercase text-white drop-shadow-lg tracking-tight mb-2 max-w-3xl ${fontClass} ${sizeClass}`}>
              {headline}
            </h1>
          )}
          {subheadline && (
            <p className={subheadlineClass}>
              {subheadline}
            </p>
          )}

          <Link
            to={buttonLink}
            className={`inline-flex items-center justify-center font-bold tracking-widest text-white border border-white/60 bg-black/50 backdrop-blur-md hover:bg-white hover:text-black transition-all duration-300 active:scale-95 uppercase shadow-xl ${btnClass}`}
          >
            {buttonText || 'Shop Now'}
          </Link>
        </div>
      </div>
    </section>
  );
}
