import { useState, useEffect } from 'react';
import Hero from '../components/Hero';
import ProductGrid from '../components/ProductGrid';
import EditorialBanner from '../components/EditorialBanner';
import LookbookReels from '../components/LookbookReels';
import BrandSignature from '../components/BrandSignature';
import { fetchAPI } from '../lib/api';
import { fetchSettingsFromFirestore } from '../lib/firebase';
import { STORE_SETTINGS, PRODUCTS_DATA } from '../data/mockData';

export default function Home() {
  const [settings, setSettings] = useState(STORE_SETTINGS);
  const [recentDrops, setRecentDrops] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);

  const loadData = async () => {
    try {
      // 1. Instant render from local cache if present
      try {
        const cached = localStorage.getItem('confelion_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            // Strip any stale data:image base64 strings so they never mask cloud URLs
            for (const k in parsed) {
              if (typeof parsed[k] === 'string' && parsed[k].startsWith('data:image/')) {
                delete parsed[k];
              }
            }
            setSettings(prev => ({ ...STORE_SETTINGS, ...prev, ...parsed }));
          }
        }
      } catch (e) {}

      // 2. Concurrently fetch backend API & Cloud Firestore settings
      const [prods, sett, firestoreSett] = await Promise.all([
        fetchAPI('/api/products').catch(() => []),
        fetchAPI('/api/settings').catch(() => null),
        fetchSettingsFromFirestore().catch(() => null),
      ]);

      if (Array.isArray(prods) && prods.length > 0) {
        setRecentDrops(prods.filter((p) => p.is_recent_drop).slice(0, 4));
        setBestSellers(prods.filter((p) => p.is_bestseller).slice(0, 4));
      } else {
        setRecentDrops(PRODUCTS_DATA.filter((p) => p.is_recent_drop).slice(0, 4));
        setBestSellers(PRODUCTS_DATA.filter((p) => p.is_bestseller).slice(0, 4));
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
      if (merged.hero_image_pc && (!merged.hero_image_mobile || merged.hero_image_mobile === STORE_SETTINGS.hero_image_mobile)) {
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
    const handleSettingsUpdate = (e) => {
      if (e.detail) setSettings(e.detail);
    };
    const handleProductsUpdate = () => {
      loadData();
    };

    window.addEventListener('settings-updated', handleSettingsUpdate);
    window.addEventListener('products-updated', handleProductsUpdate);
    window.addEventListener('storage', handleProductsUpdate);

    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate);
      window.removeEventListener('products-updated', handleProductsUpdate);
      window.removeEventListener('storage', handleProductsUpdate);
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

      {/* 2. Recent Drops */}
      {visibility.recent_drops !== false && (
        <div className="pt-8 sm:pt-14">
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
