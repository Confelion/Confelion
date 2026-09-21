import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronDown, 
  ShieldCheck, 
  Truck, 
  RefreshCw, 
  Lock, 
  Mail, 
  Phone, 
  MapPin, 
  ArrowRight, 
  Check, 
  X, 
  ExternalLink,
  Sparkles,
  Package,
  Layers
} from 'lucide-react';
import { STORE_SETTINGS } from '../data/mockData';

export default function Footer({ settings: propSettings, viewport = null }) {
  const [localSettings, setLocalSettings] = useState(propSettings || STORE_SETTINGS);
  const [openSection, setOpenSection] = useState(null);
  const [vipEmail, setVipEmail] = useState('');
  const [vipSubscribed, setVipSubscribed] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'exchange' | 'shipping' | 'size_guide' | 'care' | 'terms' | 'privacy'
  const navigate = useNavigate();

  useEffect(() => {
    if (propSettings) {
      setLocalSettings(propSettings);
      return;
    }
    try {
      const stored = localStorage.getItem('confelion_settings');
      if (stored) {
        setLocalSettings({ ...STORE_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {}

    const handleUpdate = (e) => {
      if (e.detail) {
        setLocalSettings((prev) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('settings-updated', handleUpdate);
    return () => window.removeEventListener('settings-updated', handleUpdate);
  }, [propSettings]);

  const s = propSettings || localSettings || STORE_SETTINGS;

  const toggleSection = (name) => {
    setOpenSection(openSection === name ? null : name);
  };

  const handleVipSubmit = (e) => {
    e.preventDefault();
    if (!vipEmail || !vipEmail.includes('@')) return;
    setVipSubscribed(true);
    setTimeout(() => {
      setVipEmail('');
    }, 4000);
  };

  const isMobile = viewport === 'mobile';
  const isTablet = viewport === 'tablet';
  const isDesktop = viewport === 'desktop';

  // Responsive layouts
  const trustGridClass = isMobile
    ? 'grid-cols-1 gap-4'
    : isTablet
    ? 'grid-cols-1 sm:grid-cols-3 gap-5'
    : isDesktop
    ? 'grid-cols-3 gap-6'
    : 'grid-cols-1 md:grid-cols-3 gap-6';

  const linksGridClass = isMobile
    ? 'grid-cols-1 gap-8'
    : isTablet
    ? 'grid-cols-2 gap-8'
    : isDesktop
    ? 'grid-cols-4 gap-10'
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12';

  return (
    <footer className="w-full bg-black text-white border-t border-white/10 select-none relative overflow-hidden">
      {/* =================================================================== */}
      {/* 1. VIP INNER CIRCLE (EXCLUSIVE DROP ACCESS) */}
      {/* =================================================================== */}
      <div className="border-b border-white/10 bg-zinc-950/80 px-4 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.28em] text-zinc-400">
                Confidential Drop Invitations
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-[0.14em] text-white">
              Join the Inner Circle
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed font-light">
              Receive confidential access to limited-run archival silhouettes, unreleased drop windows, and private member previews before public release.
            </p>
          </div>

          <div className="w-full lg:max-w-md">
            {vipSubscribed ? (
              <div className="p-4 bg-zinc-900 border border-white/20 text-white flex items-center gap-3 animate-fade-in">
                <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">Access Token Registered</h4>
                  <p className="text-[11px] text-zinc-400">Private drop invitations will be dispatched directly to your inbox.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVipSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={vipEmail}
                  onChange={(e) => setVipEmail(e.target.value)}
                  placeholder="ENTER YOUR EMAIL..."
                  required
                  className="bg-black border border-white/20 text-xs px-4 py-3.5 text-white placeholder-zinc-500 focus:outline-none focus:border-white w-full tracking-wider transition-colors"
                />
                <button
                  type="submit"
                  className="px-7 py-3.5 bg-white text-black hover:bg-zinc-200 transition-colors text-xs font-black uppercase tracking-[0.2em] shrink-0"
                >
                  Join VIP
                </button>
              </form>
            )}
            <p className="text-[10px] text-zinc-500 mt-2 tracking-wide font-mono">
              Zero spam. 100% Monochrome drops. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. THREE PILLARS LOGISTICS & CRAFTSMANSHIP ASSURANCES */}
      {/* =================================================================== */}
      <div className="border-b border-white/10 py-10 px-4 sm:px-6 lg:px-8 bg-black">
        <div className={`max-w-6xl mx-auto grid ${trustGridClass}`}>
          {/* Pillar 1: Fast Dispatch */}
          <div 
            onClick={() => setOpenPolicyModal('shipping')}
            className="group cursor-pointer p-6 sm:p-8 bg-zinc-950/80 border border-white/10 hover:border-white/25 transition-all duration-300 flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mx-auto mb-3.5 text-white transition-transform duration-300 group-hover:scale-105">
              <Truck className="w-5 h-5 text-white stroke-[1.5]" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-white text-center">
              {s.footer_trust_1_title || 'FAST DISPATCH'}
            </h4>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1.5 leading-relaxed text-center font-light max-w-[280px] mx-auto">
              {s.footer_trust_1_text || 'Dispatched in 24 hours. Free express shipping.'}
            </p>
          </div>

          {/* Pillar 2: 3-Day Exchange */}
          <div 
            onClick={() => setOpenPolicyModal('exchange')}
            className="group cursor-pointer p-6 sm:p-8 bg-zinc-950/80 border border-white/10 hover:border-white/25 transition-all duration-300 flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mx-auto mb-3.5 text-white transition-transform duration-300 group-hover:scale-105">
              <RefreshCw className="w-5 h-5 text-white stroke-[1.5]" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-white text-center">
              {s.footer_trust_2_title || '3-DAY EXCHANGE'}
            </h4>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1.5 leading-relaxed text-center font-light max-w-[280px] mx-auto">
              {s.footer_trust_2_text || 'Hassle-free size exchange guarantee.'}
            </p>
          </div>

          {/* Pillar 3: Luxury Packaging */}
          <div 
            onClick={() => setOpenPolicyModal('shipping')}
            className="group cursor-pointer p-6 sm:p-8 bg-zinc-950/80 border border-white/10 hover:border-white/25 transition-all duration-300 flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mx-auto mb-3.5 text-white transition-transform duration-300 group-hover:scale-105">
              <ShieldCheck className="w-5 h-5 text-white stroke-[1.5]" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-white text-center">
              {s.footer_trust_3_title || 'LUXURY PACKAGING'}
            </h4>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1.5 leading-relaxed text-center font-light max-w-[280px] mx-auto">
              {s.footer_trust_3_text || 'Rigid magnetic box on orders above ₹3,000.'}
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. MAIN EDITORIAL DIRECTORY */}
      {/* =================================================================== */}
      <div className={`max-w-7xl mx-auto px-4 ${isMobile ? 'py-10' : 'sm:px-6 lg:px-8 py-12 sm:py-16'}`}>
        <div className={`grid ${linksGridClass}`}>
          {/* Column 1: Maison Confelion */}
          <div className="space-y-4">
            <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
              <img 
                src="/images/confelion-logo.png" 
                alt="CONFELION" 
                className="h-8 sm:h-9 w-auto object-contain" 
              />
            </Link>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm font-light">
              {s.footer_about || "CONFELION is India's dedicated all-black luxury fashion label. Every drop is crafted in limited numbers with architectural tailoring from our Poonchh fulfillment hub."}
            </p>

            <div className="pt-2 border-t border-white/10 space-y-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Poonchh Fulfillment Hub · UP 284304</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <a href="mailto:support@confelion.com" className="hover:text-white transition-colors underline">
                  support@confelion.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <a 
                  href="https://wa.me/916392411276?text=Hi%20Confelion%2C%20I%20have%20an%20inquiry%20regarding%20my%20order." 
                  target="_blank" 
                  rel="noreferrer" 
                  className="hover:text-white transition-colors underline"
                >
                  +91 63924 11276 (WhatsApp Stylist)
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Silhouettes & Collections */}
          <div>
            <button
              onClick={() => toggleSection('shop')}
              className={`w-full flex items-center justify-between py-2 text-left ${
                isMobile ? 'cursor-pointer' : (!viewport ? 'md:cursor-default md:py-0' : 'cursor-default py-0')
              }`}
            >
              <h4 className="text-xs font-bold tracking-[0.2em] uppercase text-white">SILHOUETTES</h4>
              <ChevronDown className={`w-4 h-4 transition-transform ${
                isMobile ? 'block' : (!viewport ? 'md:hidden' : 'hidden')
              } ${openSection === 'shop' ? 'rotate-180' : ''}`} />
            </button>
            <div className={`mt-3 space-y-2.5 text-xs ${
              isMobile
                ? (openSection === 'shop' ? 'block' : 'hidden')
                : (!viewport ? (openSection === 'shop' ? 'block' : 'hidden md:block') : 'block')
            }`}>
              <Link to="/products" className="block text-zinc-400 hover:text-white transition-colors">
                All Archival Drops
              </Link>
              <Link to="/products?type=tee" className="block text-zinc-400 hover:text-white transition-colors">
                Heavyweight T-Shirts (280 GSM)
              </Link>
              <Link to="/products?type=shirt" className="block text-zinc-400 hover:text-white transition-colors">
                Relaxed Structured Shirts
              </Link>
              <Link to="/products?type=jeans" className="block text-zinc-400 hover:text-white transition-colors">
                Wide-Leg Baggy Denim
              </Link>
              <Link to="/products?type=hoodie" className="block text-zinc-400 hover:text-white transition-colors">
                French Terry Hoodies (450 GSM)
              </Link>
              <Link to="/products?sort=newest" className="block text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
                <span>Latest Drop Releases</span>
                <span className="text-[9px] px-1 bg-white text-black font-bold uppercase tracking-wider">New</span>
              </Link>
            </div>
          </div>

          {/* Column 3: Clientele Concierge */}
          <div>
            <button
              onClick={() => toggleSection('concierge')}
              className={`w-full flex items-center justify-between py-2 text-left ${
                isMobile ? 'cursor-pointer' : (!viewport ? 'md:cursor-default md:py-0' : 'cursor-default py-0')
              }`}
            >
              <h4 className="text-xs font-bold tracking-[0.2em] uppercase text-white">CLIENTELE CONCIERGE</h4>
              <ChevronDown className={`w-4 h-4 transition-transform ${
                isMobile ? 'block' : (!viewport ? 'md:hidden' : 'hidden')
              } ${openSection === 'concierge' ? 'rotate-180' : ''}`} />
            </button>
            <div className={`mt-3 space-y-2.5 text-xs ${
              isMobile
                ? (openSection === 'concierge' ? 'block' : 'hidden')
                : (!viewport ? (openSection === 'concierge' ? 'block' : 'hidden md:block') : 'block')
            }`}>
              <Link to="/account" className="block text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-zinc-500" />
                <span>Track Shipment (Delhivery Live)</span>
              </Link>
              <button
                onClick={() => setActiveModal('exchange')}
                className="block text-left text-zinc-400 hover:text-white transition-colors"
              >
                3-Day Doorstep Exchange Policy
              </button>
              <button
                onClick={() => setActiveModal('size_guide')}
                className="block text-left text-zinc-400 hover:text-white transition-colors"
              >
                Size & Measurements Guide
              </button>
              <button
                onClick={() => setActiveModal('shipping')}
                className="block text-left text-zinc-400 hover:text-white transition-colors"
              >
                Delhivery Logistics & Delivery Times
              </button>
              <button
                onClick={() => setActiveModal('care')}
                className="block text-left text-zinc-400 hover:text-white transition-colors"
              >
                Washing & Cotton Preservation Ritual
              </button>
              <Link to="/account" className="block text-zinc-400 hover:text-white transition-colors">
                Patron Order Archives & Invoices
              </Link>
            </div>
          </div>

          {/* Column 4: Policies & Assurances */}
          <div>
            <button
              onClick={() => toggleSection('policy')}
              className={`w-full flex items-center justify-between py-2 text-left ${
                isMobile ? 'cursor-pointer' : (!viewport ? 'md:cursor-default md:py-0' : 'cursor-default py-0')
              }`}
            >
              <h4 className="text-xs font-bold tracking-[0.2em] uppercase text-white">LEGAL & INTEGRITY</h4>
              <ChevronDown className={`w-4 h-4 transition-transform ${
                isMobile ? 'block' : (!viewport ? 'md:hidden' : 'hidden')
              } ${openSection === 'policy' ? 'rotate-180' : ''}`} />
            </button>
            <div className={`mt-3 space-y-2.5 text-xs ${
              isMobile
                ? (openSection === 'policy' ? 'block' : 'hidden')
                : (!viewport ? (openSection === 'policy' ? 'block' : 'hidden md:block') : 'block')
            }`}>
              <button
                onClick={() => setActiveModal('terms')}
                className="block text-left text-zinc-400 hover:text-white transition-colors"
              >
                Terms of Patronage
              </button>
              <button
                onClick={() => setActiveModal('privacy')}
                className="block text-left text-zinc-400 hover:text-white transition-colors"
              >
                Privacy & Data Protection Notice
              </button>
              <button
                onClick={() => setActiveModal('shipping')}
                className="block text-left text-zinc-400 hover:text-white transition-colors"
              >
                Cash on Delivery & Advance Terms
              </button>
              <div className="pt-2 text-[11px] text-zinc-500 font-mono">
                Atelier Hours: Mon - Sat (10:00 - 19:00 IST)
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. MASSIVE ARCHITECTURAL BRAND WATERMARK */}
        {/* =================================================================== */}
        <div className="mt-14 pt-8 border-t border-white/5 flex items-center justify-center overflow-hidden pointer-events-none select-none">
          <span className="text-[13vw] font-black tracking-[0.18em] uppercase text-zinc-900/70 leading-none whitespace-nowrap block select-none">
            CONFELION
          </span>
        </div>

        {/* =================================================================== */}
        {/* 5. BOTTOM BAR: COPYRIGHT, PAYMENTS & LOGISTICS BADGES */}
        {/* =================================================================== */}
        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <img src="/images/confelion-icon.png" alt="" className="w-5 h-5 object-contain opacity-60" />
            <p className="font-mono text-[11px] tracking-wider">
              {s.footer_copyright || `© ${new Date().getFullYear()} CONFELION. ALL RIGHTS RESERVED.`}
            </p>
          </div>

          {/* Luxury Payment Strip */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-mono text-zinc-400">
            <span className="px-2 py-1 bg-zinc-950 border border-white/15">UPI / GPAY</span>
            <span className="px-2 py-1 bg-zinc-950 border border-white/15">VISA / MC</span>
            <span className="px-2 py-1 bg-zinc-950 border border-white/15">RUPAY</span>
            <span className="px-2 py-1 bg-zinc-950 border border-white/15">NETBANKING</span>
            <span className="px-2 py-1 bg-zinc-950 border border-white/15 font-semibold text-white">COD VERIFIED</span>
            <span className="px-2 py-1 bg-white text-black font-black">DELHIVERY ONE</span>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 6. INTERACTIVE POLICY & ASSURANCE MODALS */}
      {/* =================================================================== */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/20 w-full max-w-lg p-6 sm:p-8 rounded-none shadow-2xl relative animate-scale-up text-left max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Exchange Policy */}
            {activeModal === 'exchange' && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-white">
                  <RefreshCw className="w-5 h-5 text-zinc-300" />
                  <h3 className="text-base font-bold uppercase tracking-wider">3-Day Doorstep Exchange Policy</h3>
                </div>
                <div className="mt-4 space-y-3 text-xs text-zinc-300 leading-relaxed font-light">
                  <p>
                    Every Confelion garment is crafted with architectural discipline. If you require a different size, we provide a seamless <strong>3-day doorstep exchange</strong> across all serviceable pincodes in India.
                  </p>
                  <div className="p-3 bg-zinc-900 border border-white/10 space-y-1.5 font-mono text-[11px]">
                    <div className="text-white font-bold uppercase">Exchange Guidelines:</div>
                    <div>• Items must be unwashed, unworn, and retain all original tags & barcodes intact.</div>
                    <div>• Exchange request must be lodged within 72 hours of doorstep delivery.</div>
                    <div>• Delhivery courier partner will arrive directly at your address for doorstep verification and pickup.</div>
                  </div>
                  <p>
                    To initiate an exchange, access your <Link to="/account" onClick={() => setActiveModal(null)} className="underline text-white font-medium">Patron Account</Link> or message our concierge on WhatsApp at <strong>+91 63924 11276</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Shipping & Delhivery Logistics */}
            {activeModal === 'shipping' && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-white">
                  <Truck className="w-5 h-5 text-zinc-300" />
                  <h3 className="text-base font-bold uppercase tracking-wider">Delhivery Express Logistics</h3>
                </div>
                <div className="mt-4 space-y-3 text-xs text-zinc-300 leading-relaxed font-light">
                  <p>
                    All Confelion drops are packaged and dispatched directly from the <strong>Confelion Fulfillment Center (Poonchh Hub, UP - 284304)</strong> via Delhivery Express surface logistics.
                  </p>
                  <div className="p-3 bg-zinc-900 border border-white/10 space-y-1.5 font-mono text-[11px]">
                    <div className="text-white font-bold uppercase">Transit & Rates:</div>
                    <div>• Orders ≥ ₹999: <strong>FREE Express Shipping</strong> throughout India.</div>
                    <div>• Orders &lt; ₹999: Standard flat freight fee of ₹50.</div>
                    <div>• Delivery Timeline: 2–4 business days across metropolitan & regional hubs.</div>
                    <div>• Real-time AWB tracking updates available on your account upon courier handover.</div>
                  </div>
                  <p>
                    Cash on Delivery orders include doorstep identity verification. Track live status anytime on Delhivery.com using your official Waybill.
                  </p>
                </div>
              </div>
            )}

            {/* Size Guide */}
            {activeModal === 'size_guide' && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-white">
                  <Sparkles className="w-5 h-5 text-zinc-300" />
                  <h3 className="text-base font-bold uppercase tracking-wider">Silhouette & Fit Specifications</h3>
                </div>
                <div className="mt-4 space-y-3 text-xs text-zinc-300 leading-relaxed font-light">
                  <p>
                    Confelion silhouettes feature signature oversized, drop-shoulder tailoring inspired by luxury architectural streetwear. We advise taking your standard size for the intended relaxed drape.
                  </p>
                  <div className="overflow-x-auto border border-white/10 mt-2">
                    <table className="w-full text-center text-xs font-mono">
                      <thead className="bg-zinc-900 text-white">
                        <tr>
                          <th className="py-2 px-3 border-b border-white/10">SIZE</th>
                          <th className="py-2 px-3 border-b border-white/10">CHEST (IN)</th>
                          <th className="py-2 px-3 border-b border-white/10">LENGTH (IN)</th>
                          <th className="py-2 px-3 border-b border-white/10">SHOULDER</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 text-zinc-400">
                        <tr><td className="py-2 px-3 font-bold text-white">S</td><td>42"</td><td>28"</td><td>21"</td></tr>
                        <tr><td className="py-2 px-3 font-bold text-white">M</td><td>44"</td><td>29"</td><td>22"</td></tr>
                        <tr><td className="py-2 px-3 font-bold text-white">L</td><td>46"</td><td>30"</td><td>23"</td></tr>
                        <tr><td className="py-2 px-3 font-bold text-white">XL</td><td>48"</td><td>31"</td><td>24"</td></tr>
                        <tr><td className="py-2 px-3 font-bold text-white">XXL</td><td>50"</td><td>32"</td><td>25"</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Care Guide */}
            {activeModal === 'care' && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-white">
                  <ShieldCheck className="w-5 h-5 text-zinc-300" />
                  <h3 className="text-base font-bold uppercase tracking-wider">Garment Care & Longevity Ritual</h3>
                </div>
                <div className="mt-4 space-y-3 text-xs text-zinc-300 leading-relaxed font-light">
                  <p>
                    Our garments are woven from 100% combed heavyweight cotton (280–450 GSM) treated with deep jet-black reactive dyes.
                  </p>
                  <div className="p-3 bg-zinc-900 border border-white/10 space-y-1.5 font-mono text-[11px]">
                    <div>• <strong>Reverse Wash:</strong> Always turn garment inside out before washing.</div>
                    <div>• <strong>Cold Cycle:</strong> Machine wash cold (≤ 30°C) on delicate cycle with mild detergent.</div>
                    <div>• <strong>Zero Bleach:</strong> Do not bleach or use heavy industrial optical brighteners.</div>
                    <div>• <strong>Air Dry:</strong> Flat air dry in the shade to preserve garment weight and dye depth.</div>
                    <div>• <strong>Ironing:</strong> Low-heat iron on reverse side. Never iron directly over screen prints or embroidery.</div>
                  </div>
                </div>
              </div>
            )}

            {/* Terms of Patronage */}
            {activeModal === 'terms' && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-white">
                  <Lock className="w-5 h-5 text-zinc-300" />
                  <h3 className="text-base font-bold uppercase tracking-wider">Terms of Patronage</h3>
                </div>
                <div className="mt-4 space-y-3 text-xs text-zinc-300 leading-relaxed font-light">
                  <p>
                    By accessing and placing orders on Confelion.com, patrons agree to our terms of limited archival production.
                  </p>
                  <p>
                    • All garments are produced in strict, non-mass production drops. Once an archival size run is depleted, re-releases are at the sole discretion of the creative director.
                  </p>
                  <p>
                    • Confelion reserves the right to cancel suspicious, fraudulent, or bot-automated checkout attempts to protect genuine patrons.
                  </p>
                </div>
              </div>
            )}

            {/* Privacy */}
            {activeModal === 'privacy' && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-white">
                  <ShieldCheck className="w-5 h-5 text-zinc-300" />
                  <h3 className="text-base font-bold uppercase tracking-wider">Privacy & Data Protection</h3>
                </div>
                <div className="mt-4 space-y-3 text-xs text-zinc-300 leading-relaxed font-light">
                  <p>
                    Confelion strictly values client confidentiality. Your shipping addresses, mobile numbers, and transactional records are encrypted via 256-bit SSL protocols.
                  </p>
                  <p>
                    We never sell patron information to third-party ad networks. Data is utilized strictly for order verification, Delhivery courier dispatch, and VIP drop invitations.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2.5 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
