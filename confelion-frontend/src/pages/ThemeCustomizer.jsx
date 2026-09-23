import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Save,
  Eye,
  EyeOff,
  ChevronRight,
  Upload,
  Play,
  Film,
  Grid,
  Sliders,
  Image as ImageIcon,
  Type,
  Bell,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Youtube,
  HelpCircle,
  ShoppingBag,
  Search,
  ShieldCheck
} from 'lucide-react';
import Hero from '../components/Hero';
import ProductGrid from '../components/ProductGrid';
import EditorialBanner from '../components/EditorialBanner';
import LookbookReels from '../components/LookbookReels';
import BrandSignature from '../components/BrandSignature';
import Footer from '../components/Footer';
import { STORE_SETTINGS, REELS_DATA, PRODUCTS_DATA } from '../data/mockData';
import { fetchAPI } from '../lib/api';
import { parseYouTubeUrl, saveDeviceVideo } from '../lib/videoStorage';
import { syncSettingsToFirestore, fetchSettingsFromFirestore } from '../lib/firebase';
import { uploadMediaAsset } from '../lib/mediaStorage';

// Canvas image compression helper
const compressImage = (file, maxDim = 1600, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function ThemeCustomizer() {
  const navigate = useNavigate();

  // Viewport mode: 'desktop' | 'tablet' | 'mobile'
  const [viewport, setViewport] = useState('desktop');

  // Selected section to edit in sidebar: null (all sections) | 'hero' | 'recent_drops' | 'editorial' | 'reels' | 'best_sellers' | 'brand_signature' | 'announcement'
  const [selectedSection, setSelectedSection] = useState(null);

  // Hovered section in preview for visual outline
  const [hoveredSection, setHoveredSection] = useState(null);

  // Store data states
  const [settings, setSettings] = useState(STORE_SETTINGS);
  const [reels, setReels] = useState(REELS_DATA);
  const [products, setProducts] = useState(PRODUCTS_DATA);
  const [isDirty, setIsDirty] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Currently editing reel index in Shop The Drop section
  const [activeReelIdx, setActiveReelIdx] = useState(0);

  // File upload refs
  const heroPcRef = useRef(null);
  const heroMobileRef = useRef(null);
  const editorialImageRef = useRef(null);
  const reelVideoRef = useRef(null);
  const reelPosterRef = useRef(null);

  // Load initial settings and products
  useEffect(() => {
    let token = localStorage.getItem('token');
    let storedUser = null;
    try {
      storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {}

    if (!token || storedUser?.role !== 'admin') {
      const demoAdmin = {
        id: 'usr_admin_01',
        email: 'confelion@gmail.com',
        name: 'Confelion Admin',
        role: 'admin',
      };
      token = 'admin_jwt_demo_token_' + Date.now();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(demoAdmin));
    }

    try {
      const storedSettings = localStorage.getItem('confelion_settings');
      if (storedSettings) {
        setSettings({ ...STORE_SETTINGS, ...JSON.parse(storedSettings) });
      }
      const storedReels = localStorage.getItem('confelion_reels');
      if (storedReels) {
        setReels(JSON.parse(storedReels));
      }
      const storedProds = localStorage.getItem('confelion_products');
      if (storedProds) {
        setProducts(JSON.parse(storedProds));
      }
    } catch (e) {
      console.error(e);
    }

    // Load latest live settings from backend and Firestore
    Promise.all([
      fetchAPI('/api/settings').catch(() => null),
      fetch('/api/settings').then(r => r.json()).catch(() => null),
      fetchSettingsFromFirestore().catch(() => null)
    ]).then(([mockSett, backendSett, firestoreSett]) => {
      const incoming = { ...(backendSett || {}), ...(firestoreSett || {}), ...(mockSett || {}) };
      if (Object.keys(incoming).length > 0) {
        const incomingReels = incoming.reels_data;
        if (incomingReels && Array.isArray(incomingReels) && incomingReels.length > 0) {
          setReels(incomingReels);
          try {
            localStorage.setItem('confelion_reels', JSON.stringify(incomingReels));
          } catch {}
        }
        setSettings((prev) => {
          const merged = {
            ...STORE_SETTINGS,
            ...prev,
            ...incoming
          };
          if (merged.hero_image && !merged.hero_image_pc) {
            merged.hero_image_pc = merged.hero_image;
          }
          if (merged.hero_image_pc && (!merged.hero_image_mobile || merged.hero_image_mobile === STORE_SETTINGS.hero_image_mobile)) {
            merged.hero_image_mobile = merged.hero_image_pc;
          }
          return merged;
        });
      }
    });
  }, [navigate]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const updateSettings = (partial) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    setIsDirty(true);
  };

  const updateReels = (newReels) => {
    setReels(newReels);
    setIsDirty(true);
    setSettings((prev) => ({ ...prev, reels_data: newReels }));
    try {
      localStorage.setItem('confelion_reels', JSON.stringify(newReels));
      window.dispatchEvent(new CustomEvent('reels-updated', { detail: newReels }));
      const channel = new BroadcastChannel('confelion_media_sync');
      channel.postMessage({ reels: newReels });
      channel.close();
    } catch {}
  };

  // Section visibility toggle
  const toggleVisibility = (sectionId, e) => {
    e.stopPropagation();
    const curVis = settings.sections_visibility || {};
    const current = curVis[sectionId] !== false;
    updateSettings({
      sections_visibility: {
        ...curVis,
        [sectionId]: !current
      }
    });
  };

  const isSectionVisible = (sectionId) => {
    return settings.sections_visibility?.[sectionId] !== false;
  };

  // Save all settings & reels
  const handleSave = async () => {
    try {
      const mergedSettings = { ...settings, reels_data: reels };
      setSettings(mergedSettings);
      localStorage.setItem('confelion_settings', JSON.stringify(mergedSettings));
      localStorage.setItem('confelion_reels', JSON.stringify(reels));
      
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: mergedSettings }));
      window.dispatchEvent(new CustomEvent('reels-updated', { detail: reels }));

      try {
        const channel = new BroadcastChannel('confelion_media_sync');
        channel.postMessage({ reels, settings: mergedSettings });
        channel.close();
      } catch {}

      const token = localStorage.getItem('token') || '';

      // 1. Sync settings to Backend SQLite database
      await fetchAPI('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ settings: mergedSettings })
      }).catch(err => console.warn('Backend settings save note:', err));

      // 1b. Direct HTTP sync to Express server
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ settings: mergedSettings })
      }).catch(err => console.warn('Direct backend save note:', err));

      // 2. Sync settings to Cloud Firestore
      await syncSettingsToFirestore(mergedSettings).catch(() => {});

      setIsDirty(false);
      showToast('Theme published & saved live across all devices');
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    }
  };

  // Media upload handlers
  const handleHeroImageUpload = async (e, type = 'pc') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast(`Compressing & uploading ${type.toUpperCase()} banner to Cloudflare...`);
      const uploaded = await uploadMediaAsset(file, 'heroes');
      if (!uploaded?.url) {
        throw new Error('Cloudflare upload did not return a valid URL');
      }
      const imgUrl = uploaded.url;

      const updated = {
        ...settings,
        [type === 'pc' ? 'hero_image_pc' : 'hero_image_mobile']: imgUrl,
        hero_image: imgUrl
      };

      if (type === 'pc' && (!updated.hero_image_mobile || updated.hero_image_mobile === STORE_SETTINGS.hero_image_mobile)) {
        updated.hero_image_mobile = imgUrl;
      }
      if (type === 'mobile' && (!updated.hero_image_pc || updated.hero_image_pc === STORE_SETTINGS.hero_image_pc)) {
        updated.hero_image_pc = imgUrl;
      }

      setSettings(updated);
      setIsDirty(true);

      // Auto-save immediately to local storage, backend SQLite, and Cloud Firestore!
      try {
        localStorage.setItem('confelion_settings', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('settings-updated', { detail: updated }));
      } catch (e) {}

      fetchAPI('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ settings: updated })
      }).catch(() => {});

      await syncSettingsToFirestore(updated);

      showToast(`Hero ${type.toUpperCase()} banner uploaded to Cloudflare & published live`);
    } catch (err) {
      console.error('Hero upload error:', err);
      alert('Upload failed: ' + err.message);
    }
  };

  const handleEditorialImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Compressing & uploading editorial banner to Cloudflare...');
      const uploaded = await uploadMediaAsset(file, 'banners');
      if (!uploaded?.url) {
        throw new Error('Cloudflare upload did not return a valid URL');
      }
      const imgUrl = uploaded.url;
      updateSettings({ editorial_banner: imgUrl });
      const updated = { ...settings, editorial_banner: imgUrl };
      await syncSettingsToFirestore(updated);
      showToast('Editorial banner uploaded to Cloudflare & published live');
    } catch (err) {
      console.error('Editorial upload error:', err);
      alert('Upload failed: ' + err.message);
    }
  };

  // Video Reel Device Upload
  const handleReelVideoUpload = async (e, idx) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Uploading video reel to Cloudflare R2...');
      const uploaded = await uploadMediaAsset(file, 'reels');
      if (!uploaded?.url) {
        throw new Error('Cloudflare upload did not return a valid video URL');
      }
      const videoTarget = uploaded.url;
      const updated = [...reels];
      updated[idx] = {
        ...updated[idx],
        videoUrl: videoTarget,
        sourceType: 'cloud'
      };
      updateReels(updated);
      const merged = { ...settings, reels_data: updated };
      setSettings(merged);

      try {
        localStorage.setItem('confelion_reels', JSON.stringify(updated));
        localStorage.setItem('confelion_settings', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('reels-updated', { detail: updated }));
        window.dispatchEvent(new CustomEvent('settings-updated', { detail: merged }));
        const channel = new BroadcastChannel('confelion_media_sync');
        channel.postMessage({ reels: updated, settings: merged });
        channel.close();
      } catch (e) {}

      // Automatically sync to backend SQLite and Cloud Firestore
      fetchAPI('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ settings: merged })
      }).catch(() => {});
      syncSettingsToFirestore(merged).catch(() => {});

      showToast('Video reel uploaded to Cloudflare & published live!');
    } catch (err) {
      console.error('Video upload error:', err);
      alert('Video upload failed: ' + (err.message || 'Please check your connection'));
    } finally {
      if (reelVideoRef.current) reelVideoRef.current.value = '';
    }
  };

  const handleReelPosterUpload = async (e, idx) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Compressing & uploading poster to Cloudflare...');
      const uploaded = await uploadMediaAsset(file, 'reels');
      if (!uploaded?.url) {
        throw new Error('Cloudflare upload did not return a valid URL');
      }
      const posterTarget = uploaded.url;
      const updated = [...reels];
      updated[idx] = {
        ...updated[idx],
        posterUrl: posterTarget
      };
      updateReels(updated);
      const merged = { ...settings, reels_data: updated };
      setSettings(merged);

      try {
        localStorage.setItem('confelion_reels', JSON.stringify(updated));
        localStorage.setItem('confelion_settings', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('reels-updated', { detail: updated }));
        window.dispatchEvent(new CustomEvent('settings-updated', { detail: merged }));
        const channel = new BroadcastChannel('confelion_media_sync');
        channel.postMessage({ reels: updated, settings: merged });
        channel.close();
      } catch (e) {}

      fetchAPI('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ settings: merged })
      }).catch(() => {});
      syncSettingsToFirestore(merged).catch(() => {});

      showToast('Reel poster uploaded to Cloudflare & saved live');
    } catch (err) {
      alert('Reel poster upload failed: ' + err.message);
    }
  };

  // Products for grids
  const recentDropsProducts = products.filter(p => p.is_recent_drop).slice(0, 8);
  const bestSellersProducts = products.filter(p => p.is_bestseller).slice(0, 8);

  // Section list definitions for sidebar
  const sectionsList = [
    { id: 'announcement', title: 'Announcement Bar', icon: Bell },
    { id: 'hero', title: 'Hero Banner', icon: Sliders },
    { id: 'recent_drops', title: 'Recent Drops (Grid)', icon: Grid },
    { id: 'editorial', title: 'Editorial Banner', icon: ImageIcon },
    { id: 'reels', title: 'Shop The Drop (Reels)', icon: Film },
    { id: 'best_sellers', title: 'Best Sellers (Grid)', icon: Sparkles },
    { id: 'brand_signature', title: 'Brand Signature', icon: Type },
    { id: 'footer', title: 'Footer & Trust Strip', icon: ShieldCheck }
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f1f2f4] overflow-hidden text-[#202223] font-sans select-none">
      {/* =================================================================== */}
      {/* 1. SHOPIFY TOP HEADER BAR */}
      {/* =================================================================== */}
      <header className="h-14 bg-white border-b border-[#e1e3e5] px-4 flex items-center justify-between z-30 shrink-0 shadow-xs">
        {/* Left: Exit & Page indicator */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#d2d5d8] hover:bg-zinc-100 text-xs font-semibold text-[#202223] transition-colors"
            title="Return to Admin Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Admin</span>
          </button>

          <div className="h-4 w-[1px] bg-[#d2d5d8]" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6d7175]">Page:</span>
            <span className="text-xs font-bold text-[#202223] px-2.5 py-1 bg-zinc-100 border border-[#e1e3e5] rounded-md flex items-center gap-1.5">
              <span>Homepage</span>
              <span className="text-[10px] text-zinc-400">▾</span>
            </span>
          </div>
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="flex items-center bg-[#f1f2f4] p-1 rounded-lg border border-[#d2d5d8]">
          <button
            onClick={() => setViewport('desktop')}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewport === 'desktop'
                ? 'bg-white text-black shadow-xs font-bold'
                : 'text-[#6d7175] hover:text-black'
            }`}
            title="Desktop View (100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>

          <button
            onClick={() => setViewport('tablet')}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewport === 'tablet'
                ? 'bg-white text-black shadow-xs font-bold'
                : 'text-[#6d7175] hover:text-black'
            }`}
            title="Tablet View (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tablet</span>
          </button>

          <button
            onClick={() => setViewport('mobile')}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewport === 'mobile'
                ? 'bg-white text-black shadow-xs font-bold'
                : 'text-[#6d7175] hover:text-black'
            }`}
            title="Mobile View (390px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Right: Unsaved status, View Store & Save */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${isDirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-[#6d7175] font-medium hidden sm:inline">
              {isDirty ? 'Unsaved changes' : 'All saved'}
            </span>
          </div>

          <Link
            to="/"
            target="_blank"
            className="p-2 rounded-lg border border-[#d2d5d8] hover:bg-zinc-100 text-[#202223] transition-colors"
            title="Open Live Store in New Tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. MAIN LAYOUT: LEFT SIDEBAR + CENTER CANVAS */}
      {/* =================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ----------------------------------------------------------------- */}
        {/* LEFT SIDEBAR: SHOPIFY POLARIS CUSTOMIZER CONTROLS                 */}
        {/* ----------------------------------------------------------------- */}
        <aside className="w-80 md:w-96 bg-white border-r border-[#e1e3e5] flex flex-col shrink-0 overflow-hidden shadow-sm z-20">
          {/* Sidebar Top: Mode Title or Back to Sections */}
          <div className="p-4 border-b border-[#e1e3e5] flex items-center justify-between bg-white shrink-0">
            {selectedSection ? (
              <button
                onClick={() => setSelectedSection(null)}
                className="flex items-center gap-2 text-xs font-bold text-[#202223] hover:text-[#008060] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Sections</span>
              </button>
            ) : (
              <div>
                <h2 className="text-sm font-bold text-[#202223]">Template Sections</h2>
                <p className="text-[11px] text-[#6d7175]">Click any section to customize styling & media</p>
              </div>
            )}
          </div>

          {/* Sidebar Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-[#202223]">
            {/* MODE A: SECTIONS TREE OVERVIEW */}
            {!selectedSection && (
              <div className="space-y-1.5">
                {sectionsList.map((sec) => {
                  const Icon = sec.icon;
                  const isVis = isSectionVisible(sec.id);

                  return (
                    <div
                      key={sec.id}
                      onClick={() => setSelectedSection(sec.id)}
                      onMouseEnter={() => setHoveredSection(sec.id)}
                      onMouseLeave={() => setHoveredSection(null)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        hoveredSection === sec.id
                          ? 'border-[#008060] bg-emerald-50/50 text-[#202223]'
                          : 'border-[#e1e3e5] bg-white hover:bg-zinc-50 text-[#202223]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-zinc-600" />
                        <span className="font-semibold text-xs">{sec.title}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => toggleVisibility(sec.id, e)}
                          className="p-1 text-zinc-400 hover:text-black rounded"
                          title={isVis ? 'Hide section' : 'Show section'}
                        >
                          {isVis ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-300" />}
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MODE B: HERO BANNER INSPECTOR */}
            {selectedSection === 'hero' && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-[#202223] pb-1 border-b border-[#e1e3e5]">
                  Hero Banner Customization
                </h3>

                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Headline Text</label>
                  <input
                    type="text"
                    value={settings.hero_headline || ''}
                    onChange={(e) => updateSettings({ hero_headline: e.target.value })}
                    placeholder="e.g. ROOTED IN CULTURE, CRAFTED WITH BLACK"
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-[#202223] focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Subtitle / Tagline</label>
                  <textarea
                    rows={2}
                    value={settings.hero_subheadline || settings.hero_subtext || ''}
                    onChange={(e) => updateSettings({ hero_subheadline: e.target.value, hero_subtext: e.target.value })}
                    placeholder="e.g. Exclusive apparel engineered in pure all-black silhouettes."
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Button Label</label>
                    <input
                      type="text"
                      value={settings.hero_button_text || 'Shop Now'}
                      onChange={(e) => updateSettings({ hero_button_text: e.target.value })}
                      className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Button Link</label>
                    <input
                      type="text"
                      value={settings.hero_button_link || '/products'}
                      onChange={(e) => updateSettings({ hero_button_link: e.target.value })}
                      className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black font-mono"
                    />
                  </div>
                </div>

                {/* Typography Settings */}
                <div className="p-3 bg-zinc-50 border border-[#e1e3e5] rounded-xl space-y-3">
                  <span className="font-bold text-xs text-[#202223] block">Typography & Layout</span>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6d7175] mb-1">Font Family</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'sans', label: 'Sans Brutalist' },
                        { id: 'serif', label: 'Serif Editorial' },
                        { id: 'mono', label: 'Technical Mono' },
                        { id: 'display', label: 'Wide Display' }
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateSettings({ hero_font_family: f.id })}
                          className={`px-2.5 py-1.5 rounded text-[11px] font-semibold border transition-all ${
                            (settings.hero_font_family || 'sans') === f.id
                              ? 'bg-black text-white border-black shadow-xs'
                              : 'bg-white text-zinc-700 border-[#d2d5d8] hover:border-zinc-400'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6d7175] mb-1">Font Size</label>
                      <select
                        value={settings.hero_font_size || 'lg'}
                        onChange={(e) => updateSettings({ hero_font_size: e.target.value })}
                        className="w-full px-2 py-1.5 border border-[#d2d5d8] rounded-lg text-xs bg-white text-[#202223] focus:outline-none focus:border-black"
                      >
                        <option value="sm">Small</option>
                        <option value="md">Medium</option>
                        <option value="lg">Large</option>
                        <option value="xl">Extra Large</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#6d7175] mb-1">Alignment</label>
                      <select
                        value={settings.hero_text_align || 'center'}
                        onChange={(e) => updateSettings({ hero_text_align: e.target.value })}
                        className="w-full px-2 py-1.5 border border-[#d2d5d8] rounded-lg text-xs bg-white text-[#202223] focus:outline-none focus:border-black"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[#6d7175] mb-1">
                      <span>Darkness Overlay</span>
                      <span className="font-mono">{settings.hero_overlay_opacity ?? 40}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="5"
                      value={settings.hero_overlay_opacity ?? 40}
                      onChange={(e) => updateSettings({ hero_overlay_opacity: Number(e.target.value) })}
                      className="w-full accent-black cursor-pointer"
                    />
                  </div>
                </div>

                {/* Hero Desktop Banner Image */}
                <div className="space-y-2">
                  <label className="block font-semibold text-[#6d7175]">Desktop Banner Image</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Paste image URL..."
                      value={settings.hero_image_pc || ''}
                      onChange={(e) => updateSettings({ hero_image_pc: e.target.value })}
                      className="flex-1 px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={() => heroPcRef.current?.click()}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-zinc-800 flex items-center gap-1 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" /> Device
                    </button>
                    <input
                      ref={heroPcRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleHeroImageUpload(e, 'pc')}
                    />
                  </div>
                  {settings.hero_image_pc && (
                    <div className="h-24 rounded-lg overflow-hidden border border-[#e1e3e5] bg-black relative">
                      <img src={settings.hero_image_pc} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Hero Mobile Banner Image */}
                <div className="space-y-2">
                  <label className="block font-semibold text-[#6d7175]">Mobile Banner Image</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Paste image URL..."
                      value={settings.hero_image_mobile || ''}
                      onChange={(e) => updateSettings({ hero_image_mobile: e.target.value })}
                      className="flex-1 px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={() => heroMobileRef.current?.click()}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-zinc-800 flex items-center gap-1 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" /> Device
                    </button>
                    <input
                      ref={heroMobileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleHeroImageUpload(e, 'mobile')}
                    />
                  </div>
                  {settings.hero_image_mobile && (
                    <div className="w-20 h-28 rounded-lg overflow-hidden border border-[#e1e3e5] bg-black">
                      <img src={settings.hero_image_mobile} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODE C: SHOP THE DROP (VIDEO REELS) INSPECTOR */}
            {selectedSection === 'reels' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-[#e1e3e5]">
                  <div>
                    <h3 className="font-bold text-sm text-[#202223]">Shop The Drop (Video Reels)</h3>
                    <p className="text-[11px] text-[#6d7175]">Edit videos, upload from device, or paste YouTube links</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newReel = {
                        id: `reel-${Date.now()}`,
                        title: 'New Drop Video',
                        productHandle: products[0]?.handle || '',
                        videoUrl: '',
                        posterUrl: '',
                        badge: 'NEW DROP'
                      };
                      const updated = [...reels, newReel];
                      updateReels(updated);
                      setActiveReelIdx(updated.length - 1);
                      showToast('Added new video reel card');
                    }}
                    className="p-1.5 bg-black text-white hover:bg-zinc-800 rounded-lg flex items-center gap-1 text-[11px] font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Reel
                  </button>
                </div>

                {/* Section Title & Subtitle */}
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Section Title</label>
                    <input
                      type="text"
                      value={settings.reels_title || 'Shop the Drop'}
                      onChange={(e) => updateSettings({ reels_title: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-[#202223] focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Section Subtitle</label>
                    <input
                      type="text"
                      value={settings.reels_subtitle || 'Curated motion lookbook & editorial unboxing'}
                      onChange={(e) => updateSettings({ reels_subtitle: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                {/* Reel Card Selector Tabs */}
                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1.5">Select Reel Card to Edit</label>
                  <div className="flex flex-wrap gap-1.5">
                    {reels.map((r, idx) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setActiveReelIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          activeReelIdx === idx
                            ? 'bg-[#008060] text-white border-[#008060] shadow-xs'
                            : 'bg-white text-zinc-700 border-[#d2d5d8] hover:border-zinc-400'
                        }`}
                      >
                        Reel {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Reel Editor Box */}
                {reels[activeReelIdx] && (() => {
                  const currentReel = reels[activeReelIdx];
                  const yt = parseYouTubeUrl(currentReel.videoUrl);

                  return (
                    <div className="p-3.5 bg-zinc-50 border border-[#e1e3e5] rounded-xl space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#e1e3e5]">
                        <span className="font-bold text-xs text-[#202223]">
                          Editing Reel #{activeReelIdx + 1}: "{currentReel.title}"
                        </span>
                        {reels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete reel "${currentReel.title}"?`)) {
                                const updated = reels.filter((_, i) => i !== activeReelIdx);
                                updateReels(updated);
                                setActiveReelIdx(Math.max(0, activeReelIdx - 1));
                                showToast('Reel deleted');
                              }
                            }}
                            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Delete Reel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#6d7175] mb-1">Reel Title</label>
                        <input
                          type="text"
                          value={currentReel.title || ''}
                          onChange={(e) => {
                            const updated = [...reels];
                            updated[activeReelIdx] = { ...updated[activeReelIdx], title: e.target.value };
                            updateReels(updated);
                          }}
                          className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-[#202223] focus:outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#6d7175] mb-1">Badge Tag</label>
                        <input
                          type="text"
                          value={currentReel.badge || ''}
                          onChange={(e) => {
                            const updated = [...reels];
                            updated[activeReelIdx] = { ...updated[activeReelIdx], badge: e.target.value };
                            updateReels(updated);
                          }}
                          placeholder="e.g. NEW DROP, UNBOXING, EDITORIAL"
                          className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black uppercase font-bold"
                        />
                      </div>

                      {/* Video Source Configuration */}
                      <div className="space-y-2 pt-1">
                        <label className="block text-[11px] font-semibold text-[#6d7175]">
                          Video Source (Device MP4, YouTube, or CDN URL)
                        </label>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={currentReel.videoUrl || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const isYt = parseYouTubeUrl(val).isYouTube;
                              const updated = [...reels];
                              updated[activeReelIdx] = {
                                ...updated[activeReelIdx],
                                videoUrl: val,
                                sourceType: isYt ? 'youtube' : 'url'
                              };
                              updateReels(updated);
                            }}
                            placeholder="Paste YouTube Link or Video URL..."
                            className="flex-1 px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => reelVideoRef.current?.click()}
                            className="px-3 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shadow-xs"
                          >
                            <Upload className="w-3.5 h-3.5" /> Upload Video
                          </button>
                          <input
                            ref={reelVideoRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => handleReelVideoUpload(e, activeReelIdx)}
                          />
                        </div>

                        {yt.isYouTube && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-[11px] text-red-700 font-medium">
                            <Youtube className="w-4 h-4 text-red-600 shrink-0" />
                            <span>YouTube Video Detected (ID: {yt.videoId}) — will stream embedded in 9:16 layout.</span>
                          </div>
                        )}

                        {currentReel.videoUrl?.startsWith('device-video-') && (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-[11px] text-emerald-800 font-medium">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Video stored in device database ({currentReel.videoUrl}).</span>
                          </div>
                        )}
                      </div>

                      {/* Poster image */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[11px] font-semibold text-[#6d7175]">Cover Thumbnail / Poster</label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="Poster image URL or pick from device..."
                            value={currentReel.posterUrl || ''}
                            onChange={(e) => {
                              const updated = [...reels];
                              updated[activeReelIdx] = { ...updated[activeReelIdx], posterUrl: e.target.value };
                              updateReels(updated);
                            }}
                            className="flex-1 px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                          />
                          <button
                            type="button"
                            onClick={() => reelPosterRef.current?.click()}
                            className="px-3 py-1.5 bg-white border border-[#d2d5d8] hover:bg-zinc-100 rounded-lg text-xs font-semibold text-zinc-800 flex items-center gap-1 whitespace-nowrap"
                          >
                            <Upload className="w-3.5 h-3.5" /> Device
                          </button>
                          <input
                            ref={reelPosterRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleReelPosterUpload(e, activeReelIdx)}
                          />
                        </div>
                      </div>

                      {/* Linked Product for Instant Buy popup */}
                      <div className="pt-1">
                        <label className="block text-[11px] font-semibold text-[#6d7175] mb-1">
                          Tagged Product (Opens on "Buy" in Reel)
                        </label>
                        <select
                          value={currentReel.productHandle || ''}
                          onChange={(e) => {
                            const updated = [...reels];
                            updated[activeReelIdx] = { ...updated[activeReelIdx], productHandle: e.target.value };
                            updateReels(updated);
                          }}
                          className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs bg-white text-[#202223] focus:outline-none focus:border-black font-semibold"
                        >
                          {products.map((p) => (
                            <option key={p.handle} value={p.handle}>
                              {p.title} (₹{p.price})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* MODE D: RECENT DROPS / BEST SELLERS PRODUCT GRIDS INSPECTOR */}
            {(selectedSection === 'recent_drops' || selectedSection === 'best_sellers') && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-[#202223] pb-1 border-b border-[#e1e3e5]">
                  {selectedSection === 'recent_drops' ? 'Recent Drops Grid' : 'Best Sellers Grid'}
                </h3>

                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Section Title</label>
                  <input
                    type="text"
                    value={
                      selectedSection === 'recent_drops'
                        ? settings.recent_drops_title || 'Recent Drops'
                        : settings.best_sellers_title || 'Best Sellers'
                    }
                    onChange={(e) =>
                      updateSettings({
                        [selectedSection === 'recent_drops' ? 'recent_drops_title' : 'best_sellers_title']:
                          e.target.value
                      })
                    }
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-[#202223] focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={
                      selectedSection === 'recent_drops'
                        ? settings.recent_drops_subtitle || 'Exclusive limited edition releases'
                        : settings.best_sellers_subtitle || 'Our most coveted all-black essentials'
                    }
                    onChange={(e) =>
                      updateSettings({
                        [selectedSection === 'recent_drops' ? 'recent_drops_subtitle' : 'best_sellers_subtitle']:
                          e.target.value
                      })
                    }
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                  />
                </div>

                {/* Columns Layout Control */}
                <div className="p-3 bg-zinc-50 border border-[#e1e3e5] rounded-xl space-y-3">
                  <span className="font-bold text-xs text-[#202223] block">Grid Layout Columns</span>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6d7175] mb-1">Desktop Columns</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[2, 3, 4].map((cols) => {
                        const currentCols =
                          selectedSection === 'recent_drops'
                            ? settings.recent_drops_cols_desktop || 4
                            : settings.best_sellers_cols_desktop || 4;

                        return (
                          <button
                            key={cols}
                            type="button"
                            onClick={() =>
                              updateSettings({
                                [selectedSection === 'recent_drops'
                                  ? 'recent_drops_cols_desktop'
                                  : 'best_sellers_cols_desktop']: cols
                              })
                            }
                            className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              Number(currentCols) === cols
                                ? 'bg-black text-white border-black shadow-xs'
                                : 'bg-white text-zinc-700 border-[#d2d5d8] hover:border-zinc-400'
                            }`}
                          >
                            {cols} Columns
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6d7175] mb-1">Mobile Columns</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2].map((cols) => {
                        const currentCols =
                          selectedSection === 'recent_drops'
                            ? settings.recent_drops_cols_mobile || 2
                            : settings.best_sellers_cols_mobile || 2;

                        return (
                          <button
                            key={cols}
                            type="button"
                            onClick={() =>
                              updateSettings({
                                [selectedSection === 'recent_drops'
                                  ? 'recent_drops_cols_mobile'
                                  : 'best_sellers_cols_mobile']: cols
                              })
                            }
                            className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              Number(currentCols) === cols
                                ? 'bg-black text-white border-black shadow-xs'
                                : 'bg-white text-zinc-700 border-[#d2d5d8] hover:border-zinc-400'
                            }`}
                          >
                            {cols} Column{cols > 1 ? 's' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODE E: EDITORIAL BANNER INSPECTOR */}
            {selectedSection === 'editorial' && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-[#202223] pb-1 border-b border-[#e1e3e5]">
                  Editorial Banner ("Only Fear God")
                </h3>

                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Headline</label>
                  <input
                    type="text"
                    value={settings.editorial_title || 'ONLY FEAR GOD'}
                    onChange={(e) => updateSettings({ editorial_title: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-[#202223] focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Subtitle / Statement</label>
                  <input
                    type="text"
                    value={settings.editorial_subtitle || 'Command respect through silence.'}
                    onChange={(e) => updateSettings({ editorial_subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Destination Link</label>
                  <input
                    type="text"
                    value={settings.editorial_link || '/product/only-fear-god-theme-shirt'}
                    onChange={(e) => updateSettings({ editorial_link: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs font-mono text-[#202223] focus:outline-none focus:border-black"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-semibold text-[#6d7175]">Cinematic Banner Image</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Paste image URL..."
                      value={settings.editorial_banner || ''}
                      onChange={(e) => updateSettings({ editorial_banner: e.target.value })}
                      className="flex-1 px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={() => editorialImageRef.current?.click()}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-zinc-800 flex items-center gap-1 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" /> Device
                    </button>
                    <input
                      ref={editorialImageRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditorialImageUpload}
                    />
                  </div>
                  {settings.editorial_banner && (
                    <div className="h-28 rounded-lg overflow-hidden border border-[#e1e3e5] bg-black">
                      <img src={settings.editorial_banner} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODE F: BRAND SIGNATURE INSPECTOR */}
            {selectedSection === 'brand_signature' && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-[#202223] pb-1 border-b border-[#e1e3e5]">
                  Brand Signature Banner
                </h3>

                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Signature Text</label>
                  <input
                    type="text"
                    value={settings.brand_signature_text || 'CONFELION'}
                    onChange={(e) => updateSettings({ brand_signature_text: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-sm font-black tracking-widest text-[#202223] focus:outline-none focus:border-black uppercase"
                  />
                  <p className="text-[11px] text-[#6d7175] mt-1">
                    Rendered in high-contrast oversized typography across the full width of the screen.
                  </p>
                </div>
              </div>
            )}

            {/* MODE G: ANNOUNCEMENT BAR INSPECTOR */}
            {selectedSection === 'announcement' && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-[#202223] pb-1 border-b border-[#e1e3e5]">
                  Top Announcement Bar
                </h3>

                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Marquee Message</label>
                  <input
                    type="text"
                    value={settings.announcement || settings.announcement_text || ''}
                    onChange={(e) => updateSettings({ announcement: e.target.value, announcement_text: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-[#202223] focus:outline-none focus:border-black"
                  />
                </div>
              </div>
            )}

            {/* MODE H: FOOTER & TRUST HIGHLIGHTS INSPECTOR */}
            {selectedSection === 'footer' && (
              <div className="space-y-5">
                <h3 className="font-bold text-sm text-[#202223] pb-1 border-b border-[#e1e3e5]">
                  Footer & Trust Highlights
                </h3>

                {/* Brand About & Tagline */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Brand Column
                  </span>

                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Brand Name / Headline</label>
                    <input
                      type="text"
                      value={settings.site_name || 'CONFELION'}
                      onChange={(e) => updateSettings({ site_name: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs font-bold text-[#202223] focus:outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Brand Bio / Statement</label>
                    <textarea
                      rows={3}
                      value={settings.footer_about || STORE_SETTINGS.footer_about}
                      onChange={(e) => updateSettings({ footer_about: e.target.value })}
                      className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Tagline</label>
                    <input
                      type="text"
                      value={settings.tagline || "India's Own All BLACK Premium Fashion Label."}
                      onChange={(e) => updateSettings({ tagline: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                {/* Trust Highlights Strip (3 Cards) */}
                <div className="space-y-3 pt-3 border-t border-[#e1e3e5]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Trust Highlights Strip (3 Value Props)
                  </span>

                  {/* Trust Benefit 1 */}
                  <div className="p-3 bg-zinc-50 border border-[#e1e3e5] rounded-lg space-y-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Card 1: Fast Dispatch</span>
                    <input
                      type="text"
                      placeholder="Title"
                      value={settings.footer_trust_1_title || 'FAST DISPATCH'}
                      onChange={(e) => updateSettings({ footer_trust_1_title: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white border border-[#d2d5d8] rounded text-xs font-semibold text-[#202223]"
                    />
                    <input
                      type="text"
                      placeholder="Description text"
                      value={settings.footer_trust_1_text || 'Dispatched in 24 hours. Free express shipping.'}
                      onChange={(e) => updateSettings({ footer_trust_1_text: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white border border-[#d2d5d8] rounded text-xs text-[#202223]"
                    />
                  </div>

                  {/* Trust Benefit 2 */}
                  <div className="p-3 bg-zinc-50 border border-[#e1e3e5] rounded-lg space-y-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Card 2: Exchange Guarantee</span>
                    <input
                      type="text"
                      placeholder="Title"
                      value={settings.footer_trust_2_title || '3-DAY EXCHANGE'}
                      onChange={(e) => updateSettings({ footer_trust_2_title: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white border border-[#d2d5d8] rounded text-xs font-semibold text-[#202223]"
                    />
                    <input
                      type="text"
                      placeholder="Description text"
                      value={settings.footer_trust_2_text || 'Hassle-free size exchange guarantee.'}
                      onChange={(e) => updateSettings({ footer_trust_2_text: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white border border-[#d2d5d8] rounded text-xs text-[#202223]"
                    />
                  </div>

                  {/* Trust Benefit 3 */}
                  <div className="p-3 bg-zinc-50 border border-[#e1e3e5] rounded-lg space-y-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Card 3: Luxury Packaging</span>
                    <input
                      type="text"
                      placeholder="Title"
                      value={settings.footer_trust_3_title || 'LUXURY PACKAGING'}
                      onChange={(e) => updateSettings({ footer_trust_3_title: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white border border-[#d2d5d8] rounded text-xs font-semibold text-[#202223]"
                    />
                    <input
                      type="text"
                      placeholder="Description text"
                      value={settings.footer_trust_3_text || 'Rigid magnetic box on orders above ₹3,000.'}
                      onChange={(e) => updateSettings({ footer_trust_3_text: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white border border-[#d2d5d8] rounded text-xs text-[#202223]"
                    />
                  </div>
                </div>

                {/* Customer Support & Contact */}
                <div className="space-y-3 pt-3 border-t border-[#e1e3e5]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Customer Care & Contact
                  </span>

                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Support Email</label>
                    <input
                      type="email"
                      value={settings.footer_contact_email || 'care@confelion.com'}
                      onChange={(e) => updateSettings({ footer_contact_email: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">WhatsApp / Phone</label>
                    <input
                      type="text"
                      value={settings.footer_contact_phone || '+91 99999 99999'}
                      onChange={(e) => updateSettings({ footer_contact_phone: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Operating Support Hours</label>
                    <input
                      type="text"
                      value={settings.footer_contact_hours || 'Mon - Sat: 10 AM to 7 PM IST'}
                      onChange={(e) => updateSettings({ footer_contact_hours: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                {/* Copyright Notice */}
                <div className="space-y-3 pt-3 border-t border-[#e1e3e5]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Bottom Copyright
                  </span>

                  <div>
                    <label className="block font-semibold text-[#6d7175] mb-1">Copyright Line</label>
                    <input
                      type="text"
                      value={settings.footer_copyright || '© 2026 CONFELION. All rights reserved.'}
                      onChange={(e) => updateSettings({ footer_copyright: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ----------------------------------------------------------------- */}
        {/* CENTER CANVAS: INTERACTIVE HOMEPAGE REPLICA                        */}
        {/* ----------------------------------------------------------------- */}
        <main className="flex-1 bg-[#202223]/10 overflow-y-auto p-4 md:p-8 flex justify-center items-start">
          <div
            className={`transition-all duration-300 bg-black text-white shadow-2xl relative select-none ${
              viewport === 'desktop'
                ? 'w-full max-w-full'
                : viewport === 'tablet'
                ? 'w-[768px] border border-zinc-700 rounded-xl overflow-hidden'
                : 'w-[390px] min-h-[844px] border-8 border-zinc-800 rounded-[44px] overflow-hidden'
            }`}
          >
            {/* Phone notch on mobile viewport */}
            {viewport === 'mobile' && (
              <div className="h-6 w-full bg-black flex items-center justify-center sticky top-0 z-40">
                <div className="w-28 h-4 bg-zinc-900 rounded-full" />
              </div>
            )}

            {/* 1. Announcement Bar Replica */}
            {isSectionVisible('announcement') && (
              <div
                onClick={() => setSelectedSection('announcement')}
                onMouseEnter={() => setHoveredSection('announcement')}
                onMouseLeave={() => setHoveredSection(null)}
                className={`relative cursor-pointer transition-all ${
                  selectedSection === 'announcement'
                    ? 'ring-2 ring-[#008060] z-30'
                    : hoveredSection === 'announcement'
                    ? 'ring-2 ring-blue-400 z-30'
                    : ''
                }`}
              >
                <div className="w-full bg-black text-white text-center py-2 px-4 border-b border-white/10">
                  <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.18em] text-zinc-200">
                    {settings.announcement || settings.announcement_text || "India's Own All BLACK Premium Fashion Label"}
                  </p>
                </div>
                {/* Floating Edit Badge */}
                {(selectedSection === 'announcement' || hoveredSection === 'announcement') && (
                  <div className="absolute top-1 right-2 bg-[#008060] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md pointer-events-none z-40 uppercase">
                    Edit Announcement
                  </div>
                )}
              </div>
            )}

            {/* Storefront Mini Header Branding */}
            <div className={`w-full bg-black/95 backdrop-blur-md border-b border-white/10 ${
              viewport === 'mobile' ? 'px-4 py-3 flex items-center justify-between' : 'px-6 py-4 flex items-center justify-between'
            }`}>
              <span className={`font-serif font-black tracking-widest text-white ${viewport === 'mobile' ? 'text-sm' : 'text-lg'}`}>
                CONFELION
              </span>
              {viewport === 'mobile' ? (
                <div className="flex items-center gap-3.5 text-zinc-300">
                  <Search className="w-4 h-4 text-zinc-300" />
                  <ShoppingBag className="w-4 h-4 text-zinc-300" />
                  <div className="flex flex-col gap-1 w-4 justify-center">
                    <span className="h-0.5 w-full bg-white rounded-full" />
                    <span className="h-0.5 w-full bg-white rounded-full" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <span>Shop</span>
                  <span>Drops</span>
                  <span>Lookbook</span>
                </div>
              )}
            </div>

            {/* 2. Hero Section Replica */}
            {isSectionVisible('hero') && (
              <div
                onClick={() => setSelectedSection('hero')}
                onMouseEnter={() => setHoveredSection('hero')}
                onMouseLeave={() => setHoveredSection(null)}
                className={`relative cursor-pointer transition-all ${
                  selectedSection === 'hero'
                    ? 'ring-2 ring-[#008060] z-30'
                    : hoveredSection === 'hero'
                    ? 'ring-2 ring-blue-400 z-30'
                    : ''
                }`}
              >
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
                  viewport={viewport}
                />
                {(selectedSection === 'hero' || hoveredSection === 'hero') && (
                  <div className="absolute top-4 right-4 bg-[#008060] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg pointer-events-none z-40 uppercase flex items-center gap-1">
                    <Sliders className="w-3 h-3" /> Edit Hero Section
                  </div>
                )}
              </div>
            )}

            {/* 3. Recent Drops Replica */}
            {isSectionVisible('recent_drops') && (
              <div
                onClick={() => setSelectedSection('recent_drops')}
                onMouseEnter={() => setHoveredSection('recent_drops')}
                onMouseLeave={() => setHoveredSection(null)}
                className={`relative cursor-pointer transition-all ${viewport === 'mobile' ? 'pt-5' : 'pt-8 sm:pt-12'} ${
                  selectedSection === 'recent_drops'
                    ? 'ring-2 ring-[#008060] z-30'
                    : hoveredSection === 'recent_drops'
                    ? 'ring-2 ring-blue-400 z-30'
                    : ''
                }`}
              >
                <ProductGrid
                  title={settings.recent_drops_title || 'Recent Drops'}
                  subtitle={settings.recent_drops_subtitle || 'Exclusive limited edition releases'}
                  products={recentDropsProducts}
                  desktopCols={settings.recent_drops_cols_desktop || 4}
                  mobileCols={settings.recent_drops_cols_mobile || 2}
                  viewport={viewport}
                />
                {(selectedSection === 'recent_drops' || hoveredSection === 'recent_drops') && (
                  <div className="absolute top-4 right-4 bg-[#008060] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg pointer-events-none z-40 uppercase flex items-center gap-1">
                    <Grid className="w-3 h-3" /> Edit Recent Drops Grid
                  </div>
                )}
              </div>
            )}

            {/* 4. Cinematic Editorial Banner Replica */}
            {isSectionVisible('editorial') && (
              <div
                onClick={() => setSelectedSection('editorial')}
                onMouseEnter={() => setHoveredSection('editorial')}
                onMouseLeave={() => setHoveredSection(null)}
                className={`relative cursor-pointer transition-all ${
                  selectedSection === 'editorial'
                    ? 'ring-2 ring-[#008060] z-30'
                    : hoveredSection === 'editorial'
                    ? 'ring-2 ring-blue-400 z-30'
                    : ''
                }`}
              >
                <EditorialBanner
                  imageUrl={settings.editorial_banner || STORE_SETTINGS.editorial_banner}
                  title={settings.editorial_title || 'ONLY FEAR GOD'}
                  subtitle={settings.editorial_subtitle || 'Command respect through silence.'}
                  link={settings.editorial_link || '/product/only-fear-god-theme-shirt'}
                  viewport={viewport}
                />
                {(selectedSection === 'editorial' || hoveredSection === 'editorial') && (
                  <div className="absolute top-4 right-4 bg-[#008060] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg pointer-events-none z-40 uppercase flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Edit Editorial Banner
                  </div>
                )}
              </div>
            )}

            {/* 5. Shop The Drop Video Reels Replica */}
            {isSectionVisible('reels') && (
              <div
                onClick={() => setSelectedSection('reels')}
                onMouseEnter={() => setHoveredSection('reels')}
                onMouseLeave={() => setHoveredSection(null)}
                className={`relative cursor-pointer transition-all ${
                  selectedSection === 'reels'
                    ? 'ring-2 ring-[#008060] z-30'
                    : hoveredSection === 'reels'
                    ? 'ring-2 ring-blue-400 z-30'
                    : ''
                }`}
              >
                <LookbookReels
                  reels={reels}
                  title={settings.reels_title || 'Shop the Drop'}
                  subtitle={settings.reels_subtitle || 'Curated motion lookbook & editorial unboxing'}
                  viewport={viewport}
                />
                {(selectedSection === 'reels' || hoveredSection === 'reels') && (
                  <div className="absolute top-4 right-4 bg-[#008060] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg pointer-events-none z-40 uppercase flex items-center gap-1">
                    <Film className="w-3 h-3" /> Edit Video Reels
                  </div>
                )}
              </div>
            )}

            {/* 6. Best Sellers Replica */}
            {isSectionVisible('best_sellers') && (
              <div
                onClick={() => setSelectedSection('best_sellers')}
                onMouseEnter={() => setHoveredSection('best_sellers')}
                onMouseLeave={() => setHoveredSection(null)}
                className={`relative cursor-pointer transition-all ${viewport === 'mobile' ? 'py-5' : 'py-8 sm:py-12'} ${
                  selectedSection === 'best_sellers'
                    ? 'ring-2 ring-[#008060] z-30'
                    : hoveredSection === 'best_sellers'
                    ? 'ring-2 ring-blue-400 z-30'
                    : ''
                }`}
              >
                <ProductGrid
                  title={settings.best_sellers_title || 'Best Sellers'}
                  subtitle={settings.best_sellers_subtitle || 'Our most coveted all-black essentials'}
                  products={bestSellersProducts}
                  desktopCols={settings.best_sellers_cols_desktop || 4}
                  mobileCols={settings.best_sellers_cols_mobile || 2}
                  viewport={viewport}
                />
                {(selectedSection === 'best_sellers' || hoveredSection === 'best_sellers') && (
                  <div className="absolute top-4 right-4 bg-[#008060] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg pointer-events-none z-40 uppercase flex items-center gap-1">
                    <Grid className="w-3 h-3" /> Edit Best Sellers Grid
                  </div>
                )}
              </div>
            )}

            {/* 7. Brand Signature Replica */}
            {isSectionVisible('brand_signature') && (
              <div
                onClick={() => setSelectedSection('brand_signature')}
                onMouseEnter={() => setHoveredSection('brand_signature')}
                onMouseLeave={() => setHoveredSection(null)}
                className={`relative cursor-pointer transition-all ${
                  selectedSection === 'brand_signature'
                    ? 'ring-2 ring-[#008060] z-30'
                    : hoveredSection === 'brand_signature'
                    ? 'ring-2 ring-blue-400 z-30'
                    : ''
                }`}
              >
                <BrandSignature text={settings.brand_signature_text || 'CONFELION'} viewport={viewport} />
                {(selectedSection === 'brand_signature' || hoveredSection === 'brand_signature') && (
                  <div className="absolute top-4 right-4 bg-[#008060] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg pointer-events-none z-40 uppercase flex items-center gap-1">
                    <Type className="w-3 h-3" /> Edit Brand Signature
                  </div>
                )}
              </div>
            )}

            {/* 8. Footer & Trust Strip Replica */}
            {isSectionVisible('footer') && (
              <div
                onClick={() => setSelectedSection('footer')}
                onMouseEnter={() => setHoveredSection('footer')}
                onMouseLeave={() => setHoveredSection(null)}
                className={`relative cursor-pointer transition-all ${
                  selectedSection === 'footer'
                    ? 'ring-2 ring-[#008060] z-30'
                    : hoveredSection === 'footer'
                    ? 'ring-2 ring-blue-400 z-30'
                    : ''
                }`}
              >
                <Footer settings={settings} viewport={viewport} />
                {(selectedSection === 'footer' || hoveredSection === 'footer') && (
                  <div className="absolute top-4 right-4 bg-[#008060] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-lg pointer-events-none z-40 uppercase flex items-center gap-1">
                    <Sliders className="w-3 h-3" /> Edit Footer & Trust Strip
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#202223] text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-fade-in border border-zinc-700">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
