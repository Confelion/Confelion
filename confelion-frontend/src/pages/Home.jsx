import { useState, useEffect } from 'react';
import Hero from '../components/Hero';
import ProductGrid from '../components/ProductGrid';
import EditorialBanner from '../components/EditorialBanner';
import LookbookReels from '../components/LookbookReels';
import BrandSignature from '../components/BrandSignature';
import CollectionStrip from '../components/CollectionStrip';
import { fetchAPI, getDeletedProductHandles, getStoredProducts } from '../lib/api';
import { 
  fetchSettingsFromFirestore, 
  subscribeToStoreSettings, 
  fetchFirestoreProducts, 
  subscribeToProducts 
} from '../lib/firebase';
import { STORE_SETTINGS } from '../data/mockData';

export default function Home() {
  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem('confelion_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          for (const k in parsed) {
            if (typeof parsed[k] === 'string' && parsed[k].startsWith('data:image/')) {
              delete parsed[k];
            }
          }
          return { ...STORE_SETTINGS, ...parsed };
        }
      }
    } catch (e) {}
    return STORE_SETTINGS;
  });

  const [recentDrops, setRecentDrops] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);

  const loadData = async () => {
    try {
      // Concurrently fetch backend API & Cloud Firestore settings & products
      const [prods, sett, firestoreSett, firestoreProds] = await Promise.all([
        fetchAPI('/api/products').catch(() => []),
        fetchAPI('/api/settings').catch(() => null),
        fetchSettingsFromFirestore().catch(() => null),
        fetchFirestoreProducts().catch(() => []),
      ]);

      // Merge products: Active local catalog + Firestore real-time products, filtering out deleted items
      const deleted = getDeletedProductHandles();
      const allProdsMap = new Map();
      const initialCatalog = (Array.isArray(prods) && prods.length > 0) ? prods : getStoredProducts();
      initialCatalog.forEach(p => {
        const key = p.handle || p.id;
        if (!deleted.has(key) && !deleted.has(p.handle) && !deleted.has(p.id) && !p.is_deleted && p.published !== false) {
          allProdsMap.set(key, p);
        }
      });
      if (Array.isArray(firestoreProds)) {
        firestoreProds.forEach(p => {
          const key = p.handle || p.id;
          if (!deleted.has(key) && !deleted.has(p.handle) && !deleted.has(p.id) && !p.is_deleted && p.published !== false) {
            allProdsMap.set(key, p);
          }
        });
      }
      const combinedProds = Array.from(allProdsMap.values());

      if (combinedProds.length > 0) {
        setRecentDrops(combinedProds.filter((p) => p.is_recent_drop).slice(0, 4));
        setBestSellers(combinedProds.filter((p) => p.is_bestseller).slice(0, 4));
      }

      // Merge: STORE_SETTINGS < backend SQLite < Firestore cloud truth
      const merged = {
        ...STORE_SETTINGS,
        ...(sett || {}),
        ...(firestoreSett || {})
      };

      if (merged.hero_image && !merged.hero_image_pc) {
        merged.hero_image_pc = merged.hero_image;
      }
      if (merged.hero_image_pc && !merged.hero_image_mobile) {
        merged.hero_image_mobile = merged.hero_image_pc;
      }

      setSettings(merged);

      try {
        localStorage.setItem('confelion_settings', JSON.stringify(merged));
      } catch (e) {}
    } catch (e) {
      console.error('Home loadData error:', e);
    }
  };

  useEffect(() => {
    loadData();

    // Real-time Firestore WebSocket listeners for 0-delay updates across all devices
    const unsubSettings = subscribeToStoreSettings((liveSettings) => {
      if (liveSettings) {
        setSettings((prev) => {
          const next = { ...prev, ...liveSettings };
          if (next.hero_image && !next.hero_image_pc) next.hero_image_pc = next.hero_image;
          if (next.hero_image_pc && !next.hero_image_mobile) next.hero_image_mobile = next.hero_image_pc;
          try {
            localStorage.setItem('confelion_settings', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    });

    const unsubProducts = subscribeToProducts((liveProds) => {
      if (Array.isArray(liveProds) && liveProds.length > 0) {
        const deleted = getDeletedProductHandles();
        const allProdsMap = new Map();
        getStoredProducts().forEach(p => {
          const key = p.handle || p.id;
          if (!deleted.has(key) && !deleted.has(p.handle) && !deleted.has(p.id) && !p.is_deleted && p.published !== false) {
            allProdsMap.set(key, p);
          }
        });
        liveProds.forEach(p => {
          const key = p.handle || p.id;
          if (!deleted.has(key) && !deleted.has(p.handle) && !deleted.has(p.id) && !p.is_deleted && p.published !== false) {
            allProdsMap.set(key, p);
          }
        });
        const combined = Array.from(allProdsMap.values());
        setRecentDrops(combined.filter((p) => p.is_recent_drop).slice(0, 4));
        setBestSellers(combined.filter((p) => p.is_bestseller).slice(0, 4));
      }
    });

    const handleSettingsUpdate = (e) => {
      if (e.detail) setSettings((prev) => ({ ...prev, ...e.detail }));
    };
    const handleProductsUpdate = () => {
      loadData();
    };

    const handleStorageEvent = (e) => {
      if (e.key === 'confelion_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSettings((prev) => ({ ...prev, ...parsed }));
        } catch {}
      } else if (e.key === 'confelion_reels' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSettings((prev) => ({ ...prev, reels_data: parsed }));
        } catch {}
      } else if (e.key === 'confelion_products') {
        loadData();
      }
    };

    let channel = null;
    try {
      channel = new BroadcastChannel('confelion_media_sync');
      channel.onmessage = (msg) => {
        if (msg.data?.settings) {
          setSettings((prev) => ({ ...prev, ...msg.data.settings }));
        }
        if (msg.data?.reels) {
          setSettings((prev) => ({ ...prev, reels_data: msg.data.reels }));
        }
      };
    } catch {}

    window.addEventListener('settings-updated', handleSettingsUpdate);
    window.addEventListener('products-updated', handleProductsUpdate);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      unsubSettings();
      unsubProducts();
      channel?.close();
      window.removeEventListener('settings-updated', handleSettingsUpdate);
      window.removeEventListener('products-updated', handleProductsUpdate);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // Sections visibility settings (defaults to true if undefined)
  const visibility = settings.sections_visibility || {};

  return (
    <div className="w-full bg-black text-white selection:bg-white selection:text-black">
      {/* 1. Hero Banner: Desktop & Mobile synced with admin customizer */}
      {visibility.hero !== false && (
        <Hero
          imagePc={settings.hero_image_pc || STORE_SETTINGS.hero_image_pc}
          imageMobile={settings.hero_image_mobile || STORE_SETTINGS.hero_image_mobile}
          buttonText={settings.hero_button_text || 'Shop Now'}
          buttonLink={settings.hero_button_link || '/products'}
          headline={settings.hero_headline || ''}
          subheadline={settings.hero_subheadline || settings.hero_subtext || ''}
          fontFamily={settings.hero_font_family || 'sans'}
          fontSize={settings.hero_font_size || 'lg'}
          textAlign={settings.hero_text_align || 'center'}
          overlayOpacity={settings.hero_overlay_opacity !== undefined ? settings.hero_overlay_opacity : 40}
        />
      )}

      {/* 2. Collection Filter Strip matching reference store */}
      <CollectionStrip />

      {/* 3. Recent Drops */}
      {visibility.recent_drops !== false && (
        <div className="pt-2 sm:pt-6">
          <ProductGrid
            title={settings.recent_drops_title || 'Recent Drops'}
            subtitle={settings.recent_drops_subtitle || 'Exclusive limited edition releases'}
            products={recentDrops}
            desktopCols={settings.recent_drops_cols_desktop || 4}
            mobileCols={settings.recent_drops_cols_mobile || 2}
          />
        </div>
      )}

      {/* 3. Cinematic Editorial Banner */}
      {visibility.editorial !== false && (
        <EditorialBanner
          imageUrl={settings.editorial_banner || STORE_SETTINGS.editorial_banner}
          title={settings.editorial_title || 'ONLY FEAR GOD'}
          subtitle={settings.editorial_subtitle || 'Command respect through silence.'}
          link={settings.editorial_link || '/product/only-fear-god-theme-shirt'}
        />
      )}

      {/* 4. Shop the Drop Video Reels */}
      {visibility.reels !== false && (
        <LookbookReels 
          reels={settings.reels_data}
          title={settings.reels_title || 'Shop the Drop'}
          subtitle={settings.reels_subtitle || 'Curated motion lookbook & editorial unboxing'}
        />
      )}

      {/* 5. Best Sellers */}
      {visibility.best_sellers !== false && (
        <div className="py-8 sm:py-14">
          <ProductGrid
            title={settings.best_sellers_title || 'Best Sellers'}
            subtitle={settings.best_sellers_subtitle || 'Our most coveted all-black essentials'}
            products={bestSellers}
            desktopCols={settings.best_sellers_cols_desktop || 4}
            mobileCols={settings.best_sellers_cols_mobile || 2}
          />
        </div>
      )}

      {/* 6. Oversized Brand Signature Graphic */}
      {visibility.brand_signature !== false && (
        <BrandSignature text={settings.brand_signature_text || 'CONFELION'} />
      )}
    </div>
  );
}
