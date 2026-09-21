import { Link } from 'react-router-dom';

export default function EditorialBanner({
  imageUrl = 'https://www.kaalvaish.in/cdn/shop/files/ChatGPT_Image_May_27_2026_02_24_02_PM.png?v=1780306111&width=3840',
  title = 'ONLY FEAR GOD',
  subtitle = 'Command respect through silence.',
  link = '/product/only-fear-god-theme-shirt',
  viewport = null
}) {
  const aspectClass = viewport === 'mobile'
    ? 'aspect-[4/3]'
    : viewport === 'tablet'
    ? 'aspect-[16/9]'
    : viewport === 'desktop'
    ? 'aspect-[21/9]'
    : 'aspect-[4/3] sm:aspect-[16/8] md:aspect-[21/9]';

  const titleClass = viewport === 'mobile'
    ? 'text-lg font-black'
    : 'text-xl sm:text-3xl md:text-4xl font-black';

  const marginClass = viewport === 'mobile' ? 'my-4' : 'my-6 sm:my-10';

  return (
    <section className={`relative w-full ${marginClass} bg-black overflow-hidden`}>
      <Link to={link} className={`group block relative w-full ${aspectClass} overflow-hidden`}>
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-4 sm:bottom-10 text-center px-4">
          <h2 className={`${titleClass} tracking-widest text-white uppercase drop-shadow-md`}>
            {title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-300 font-medium tracking-wide">
            {subtitle}
          </p>
          <span className="mt-2.5 inline-block text-[11px] sm:text-xs font-bold uppercase tracking-widest text-white underline underline-offset-4 decoration-white/50 group-hover:decoration-white">
            Explore The Shirt →
          </span>
        </div>
      </Link>
    </section>
  );
}
