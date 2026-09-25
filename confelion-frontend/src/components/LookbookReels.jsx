import { useState, useEffect } from 'react';
import { Play, X, ShoppingBag } from 'lucide-react';
import { REELS_DATA } from '../data/mockData';
import { getStoredProducts } from '../lib/api';
import { Link } from 'react-router-dom';
import { parseYouTubeUrl, getDeviceVideoUrl } from '../lib/videoStorage';

export default function LookbookReels({ 
  reels: propReels, 
  title: propTitle = 'Shop the Drop', 
  subtitle: propSubtitle = 'Curated motion lookbook & editorial unboxing',
  viewport = null
}) {
  const getInitialReels = () => {
    if (propReels && propReels.length > 0) return propReels;
    try {
      const stored = localStorage.getItem('confelion_reels');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const sett = localStorage.getItem('confelion_settings');
      if (sett) {
        const parsed = JSON.parse(sett);
        if (Array.isArray(parsed.reels_data) && parsed.reels_data.length > 0) return parsed.reels_data;
      }
    } catch {}
    return REELS_DATA;
  };

  const [reels, setReels] = useState(getInitialReels);
  const [activeReel, setActiveReel] = useState(null);
  const [resolvedUrls, setResolvedUrls] = useState({});

  // Sync with propReels, localStorage, or remote settings
  useEffect(() => {
    if (propReels && Array.isArray(propReels) && propReels.length > 0) {
      setReels(propReels);
    } else {
      try {
        const stored = localStorage.getItem('confelion_reels');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) setReels(parsed);
        }
      } catch {}
    }

    const handleReelsUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setReels(e.detail);
      }
    };

    const handleSettingsUpdate = (e) => {
      if (e.detail?.reels_data && Array.isArray(e.detail.reels_data) && e.detail.reels_data.length > 0) {
        setReels(e.detail.reels_data);
      }
    };

    const handleStorage = (e) => {
      if (e.key === 'confelion_reels' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) setReels(parsed);
        } catch {}
      } else if (e.key === 'confelion_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed.reels_data) && parsed.reels_data.length > 0) {
            setReels(parsed.reels_data);
          }
        } catch {}
      }
    };

    // Cross-tab real-time communication channel
    let channel = null;
    try {
      channel = new BroadcastChannel('confelion_media_sync');
      channel.onmessage = (msg) => {
        if (msg.data?.reels && Array.isArray(msg.data.reels)) {
          setReels(msg.data.reels);
        } else if (msg.data?.settings?.reels_data && Array.isArray(msg.data.settings.reels_data)) {
          setReels(msg.data.settings.reels_data);
        }
      };
    } catch {}

    window.addEventListener('reels-updated', handleReelsUpdate);
    window.addEventListener('settings-updated', handleSettingsUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      channel?.close();
      window.removeEventListener('reels-updated', handleReelsUpdate);
      window.removeEventListener('settings-updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [propReels]);

  // Resolve any IndexedDB device video keys to Blob URLs
  useEffect(() => {
    let isMounted = true;
    const resolveAll = async () => {
      const urls = {};
      for (const r of reels) {
        if (r.videoUrl && r.videoUrl.startsWith('device-video-')) {
          const blobUrl = await getDeviceVideoUrl(r.videoUrl);
          if (blobUrl && isMounted) urls[r.videoUrl] = blobUrl;
        }
      }
      if (isMounted) setResolvedUrls(urls);
    };
    resolveAll();
    return () => { isMounted = false; };
  }, [reels]);

  const getProduct = (handle) => {
    try {
      const storedProds = getStoredProducts();
      if (storedProds.length > 0) {
        const found = storedProds.find((p) => p.handle === handle);
        if (found) return found;
        return storedProds[0];
      }
    } catch {}
    return null;
  };

  const getVideoSrc = (rawUrl) => {
    if (!rawUrl) return '';
    if (resolvedUrls[rawUrl]) return resolvedUrls[rawUrl];
    return rawUrl;
  };

  const gridClass = viewport === 'mobile'
    ? 'grid-cols-2 gap-2.5'
    : viewport === 'tablet'
    ? 'grid-cols-2 sm:grid-cols-3 gap-3.5'
    : viewport === 'desktop'
    ? 'grid-cols-4 gap-4 sm:gap-6'
    : 'grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6';

  const sectionPadding = viewport === 'mobile' ? 'px-3 my-6' : 'px-3 sm:px-6 lg:px-8 my-10 sm:my-16';
  const titleSize = viewport === 'mobile' ? 'text-xl' : 'text-2xl sm:text-3xl';

  return (
    <section className={`w-full ${sectionPadding} max-w-7xl mx-auto`}>
      <div className="mb-3 sm:mb-6 text-left">
        <h2 className={`${titleSize} font-extrabold tracking-tight text-white uppercase`}>
          {propTitle}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400">
          {propSubtitle}
        </p>
      </div>

      {/* Dynamic columns based on active viewport */}
      <div className={`grid ${gridClass}`}>
        {reels.map((reel) => {
          const yt = parseYouTubeUrl(reel.videoUrl);
          const effectiveSrc = getVideoSrc(reel.videoUrl);

          return (
            <div
              key={reel.id}
              onClick={() => setActiveReel(reel)}
              className="group relative aspect-[9/16] overflow-hidden bg-zinc-950 cursor-pointer select-none border border-white/10 hover:border-white/30 transition-all duration-300 rounded-xs"
            >
              {/* Video or YouTube Preview */}
              {yt.isYouTube ? (
                <div className="relative w-full h-full bg-black overflow-hidden">
                  <img
                    src={reel.posterUrl || yt.thumbnailUrl}
                    alt={reel.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* YouTube badge icon */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-red-600/90 backdrop-blur-xs text-white text-[9px] font-bold uppercase tracking-wider">
                    <span>YouTube</span>
                  </div>
                </div>
              ) : effectiveSrc ? (
                <video
                  key={effectiveSrc}
                  src={effectiveSrc}
                  poster={reel.posterUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : reel.posterUrl ? (
                <img
                  src={reel.posterUrl}
                  alt={reel.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border border-white/5 p-4 text-center">
                  <Play className="w-8 h-8 text-white/30 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{reel.title}</span>
                </div>
              )}

              {/* Confelion Monogram Watermark in top right */}
              <div className="absolute top-2.5 right-2.5 text-xs font-serif font-black tracking-widest text-white/70 drop-shadow-md select-none pointer-events-none px-1.5 py-0.5 border border-white/20 bg-black/40 backdrop-blur-xs rounded-xs">
                C
              </div>

              {/* Custom Badge */}
              {!yt.isYouTube && reel.badge && (
                <div className="absolute top-2.5 left-2.5 pointer-events-none">
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-black/70 backdrop-blur-sm border border-white/20 text-white">
                    {reel.badge}
                  </span>
                </div>
              )}

              {/* Gradient Overlay & Info */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 flex flex-col justify-end pointer-events-none">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-tight">
                      {reel.title}
                    </h3>
                    <span className="text-[10px] text-zinc-300 font-medium">Tap to play & shop</span>
                  </div>
                  <div className="h-7 w-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:bg-white group-hover:text-black text-white transition-colors">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Video Modal Lightbox */}
      {activeReel && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm aspect-[9/16] bg-black overflow-hidden shadow-2xl border border-white/20 flex flex-col">
            <button
              onClick={() => setActiveReel(null)}
              className="absolute top-3 right-3 z-30 h-8 w-8 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-white hover:text-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Video Player (YouTube or Native) */}
            {(() => {
              const yt = parseYouTubeUrl(activeReel.videoUrl);
              const effectiveSrc = getVideoSrc(activeReel.videoUrl);

              if (yt.isYouTube) {
                return (
                  <iframe
                    src={`https://www.youtube.com/embed/${yt.videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1`}
                    title={activeReel.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                );
              }

              return (
                <video
                  key={effectiveSrc}
                  src={effectiveSrc}
                  autoPlay
                  controls
                  playsInline
                  className="h-full w-full object-cover"
                />
              );
            })()}

            {/* Bottom Product Action Bar */}
            {(() => {
              const prod = getProduct(activeReel.productHandle);
              return (
                <div className="absolute inset-x-0 bottom-0 p-3 bg-black/90 border-t border-white/15 flex items-center justify-between gap-3 z-20">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <img
                      src={prod.image_url}
                      alt={prod.title}
                      className="w-10 h-12 object-cover bg-zinc-900 border border-white/10 shrink-0"
                    />
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-white truncate">{prod.title}</h4>
                      <p className="text-xs text-zinc-300 font-semibold font-mono">₹{prod.price}</p>
                    </div>
                  </div>
                  <Link
                    to={`/product/${prod.handle}`}
                    onClick={() => setActiveReel(null)}
                    className="shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Buy
                  </Link>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}
