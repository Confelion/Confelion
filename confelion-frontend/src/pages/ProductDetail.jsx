import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ChevronDown, 
  Check, 
  ShoppingBag, 
  ShieldCheck, 
  Truck, 
  RefreshCw, 
  Star, 
  Share2, 
  ArrowLeft,
  X,
  Ruler,
  MapPin,
  Loader2,
  Clock,
  Play
} from 'lucide-react';
import { fetchAPI, checkDelhiveryPincode, getStoredProducts, getDeletedProductHandles } from '../lib/api';
import { fetchFirestoreProducts } from '../lib/firebase';
import { DEFAULT_SIZE_CHART, DEFAULT_TOPS_SIZE_CHART, DEFAULT_BOTTOMS_SIZE_CHART } from '../data/mockData';
import ProductGrid from '../components/ProductGrid';
import { addItemToCart } from '../lib/cartManager';
import { optimizeImageUrl, PLACEHOLDER_IMAGE } from '../utils/imageOptimizer';

export default function ProductDetail() {
  const { handle } = useParams();
  const carouselRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('M');
  const [openAccordion, setOpenAccordion] = useState('desc');
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [sizeUnit, setSizeUnit] = useState('in'); // 'in' or 'cm'
  const [pincode, setPincode] = useState(() => {
    try { return localStorage.getItem('confelion_pincode') || ''; } catch { return ''; }
  });
  const [pincodeChecking, setPincodeChecking] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState(null);

  const handleCheckPincode = async (e, pinToCheck) => {
    if (e) e.preventDefault();
    const targetPin = (pinToCheck || pincode || '').trim();
    if (targetPin.length !== 6) return;
    setPincodeChecking(true);
    try {
      const res = await checkDelhiveryPincode(targetPin);
      setDeliveryResult(res);
      if (res && res.serviceable) {
        localStorage.setItem('confelion_pincode', targetPin);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPincodeChecking(false);
    }
  };

  // Auto-check if pincode was previously stored
  useEffect(() => {
    if (pincode && pincode.length === 6 && !deliveryResult) {
      handleCheckPincode(null, pincode);
    }
  }, []);

  const loadProduct = async () => {
    const deletedHandles = getDeletedProductHandles();
    if (deletedHandles.has(handle)) {
      setData(null);
      setLoading(false);
      return;
    }

    // 1. Try fetchAPI
    try {
      const res = await fetchAPI(`/api/products/${handle}`);
      if (res && res.product && !deletedHandles.has(res.product.handle || res.product.id)) {
        setData(res);
        if (res?.variants?.length > 0) {
          setSelectedSize(res.variants[0].title || 'M');
        }
        setLoading(false);
        return;
      }
    } catch (err) {}

    // 2. Direct fetch to Express server
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(handle)}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.product && !deletedHandles.has(json.product.handle || json.product.id)) {
          setData(json);
          if (json?.variants?.length > 0) {
            setSelectedSize(json.variants[0].title || 'M');
          }
          setLoading(false);
          return;
        }
      }
    } catch (e) {}

    // 3. Fallback to getStoredProducts()
    try {
      const stored = getStoredProducts();
      let found = stored.find(p => (p.handle === handle || String(p.id) === String(handle)) && !deletedHandles.has(p.handle) && !deletedHandles.has(p.id));
      if (found) {
        const productObj = {
          product: found,
          images: (found.images && found.images.length > 0) ? found.images : [found.image_url],
          productImages: ((found.images && found.images.length > 0) ? found.images : [found.image_url]).map((url, i) => ({ id: i + 1, image_url: url })),
          variants: (found.sizes || ['S', 'M', 'L', 'XL', 'XXL']).map(s => ({ id: s, title: s, inventory_quantity: found.inventory !== undefined ? found.inventory : 10 })),
          sizeChart: found.size_chart_table || DEFAULT_SIZE_CHART,
          sizeChartImage: found.size_chart_image || null
        };
        setData(productObj);
        if (productObj.variants.length > 0) {
          setSelectedSize(productObj.variants[0].title || 'M');
        }
        setLoading(false);
        return;
      }
    } catch (e) {}

    // 4. Fallback to Firestore products collection
    try {
      const fsProds = await fetchFirestoreProducts();
      const found = fsProds.find(p => (p.handle === handle || String(p.id) === String(handle)) && !deletedHandles.has(p.handle) && !deletedHandles.has(p.id) && !p.is_deleted && p.published !== false);
      if (found) {
        const productObj = {
          product: found,
          images: (found.images && found.images.length > 0) ? found.images : [found.image_url],
          productImages: ((found.images && found.images.length > 0) ? found.images : [found.image_url]).map((url, i) => ({ id: i + 1, image_url: url })),
          variants: (found.sizes || ['S', 'M', 'L', 'XL', 'XXL']).map(s => ({ id: s, title: s, inventory_quantity: found.inventory !== undefined ? found.inventory : 10 })),
          sizeChart: found.size_chart_table || DEFAULT_SIZE_CHART,
          sizeChartImage: found.size_chart_image || null
        };
        setData(productObj);
        if (productObj.variants.length > 0) {
          setSelectedSize(productObj.variants[0].title || 'M');
        }
      }
    } catch (fsErr) {
      console.warn('Firestore product fallback error:', fsErr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    setSelectedImage(0);
    loadProduct();

    const handleProductsUpdate = () => loadProduct();
    window.addEventListener('products-updated', handleProductsUpdate);
    window.addEventListener('storage', handleProductsUpdate);

    return () => {
      window.removeEventListener('products-updated', handleProductsUpdate);
      window.removeEventListener('storage', handleProductsUpdate);
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin" />
          <span className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Loading Item...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.product) {
    return (
      <div className="min-h-[70vh] bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold uppercase tracking-widest mb-2">Product Not Found</h2>
          <p className="text-xs text-zinc-400 mb-6">The item you are searching for is unavailable.</p>
          <Link to="/products" className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-zinc-200">
            Back to Collection
          </Link>
        </div>
      </div>
    );
  }

  const { product, productImages, variants, details } = data;

  const isBottom = product.size_chart_type === 'bottoms' ||
    ['jeans', 'pant', 'pants', 'bottom', 'bottoms'].includes((product.type || '').toLowerCase()) ||
    (product.category || '').toLowerCase().includes('jean') ||
    (product.category || '').toLowerCase().includes('pant') ||
    (product.category || '').toLowerCase().includes('baggy');

  // Consolidate all image assets & video media
  const rawImages = productImages?.map((p) => p.image_url) || (product.images || [product.image_url]);
  const images = [...rawImages];
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => {
      if (img && !images.includes(img)) images.push(img);
    });
  }
  if (product.video_url && !images.includes(product.video_url)) {
    images.push(product.video_url);
  }
  const isMediaVideo = (url) => typeof url === 'string' && (url.endsWith('.mp4') || url.includes('/videos/') || url.includes('video'));

  const sizes = variants?.map((v) => v.title) || (isBottom ? ['28', '30', '32', '34', '36'] : ['S', 'M', 'L', 'XL', 'XXL']);

  const discountPercent = product.compare_at_price 
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100) 
    : 0;

  const toggleAccordion = (name) => {
    setOpenAccordion(openAccordion === name ? null : name);
  };

  const handleAddToCart = () => {
    try {
      addItemToCart(
        {
          ...product,
          image: images[0]
        },
        selectedSize,
        1
      );

      setAdded(true);

      setTimeout(() => {
        setAdded(false);
        window.dispatchEvent(new Event('open-cart-drawer'));
      }, 350);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const relatedProducts = getStoredProducts().filter((p) => p.handle !== product.handle).slice(0, 4);

  // Helper to format table values according to inches / cm - strictly guaranteed to be an array
  let resolvedSizeTable = isBottom ? DEFAULT_BOTTOMS_SIZE_CHART : DEFAULT_TOPS_SIZE_CHART;
  if (Array.isArray(product.size_chart_table) && product.size_chart_table.length > 0) {
    resolvedSizeTable = product.size_chart_table;
  } else if (typeof product.size_chart_table === 'string' && product.size_chart_table.startsWith('[')) {
    try {
      const parsed = JSON.parse(product.size_chart_table);
      if (Array.isArray(parsed) && parsed.length > 0) {
        resolvedSizeTable = parsed;
      }
    } catch {}
  }
  const sizeTable = Array.isArray(resolvedSizeTable) ? resolvedSizeTable : (isBottom ? DEFAULT_BOTTOMS_SIZE_CHART : DEFAULT_TOPS_SIZE_CHART);

  const convertVal = (valStr) => {
    if (!valStr) return '-';
    if (sizeUnit === 'in') return valStr;
    // Strip quotes and convert to CM
    const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return valStr;
    return (num * 2.54).toFixed(1) + ' cm';
  };

  return (
    <div className="w-full bg-black text-white selection:bg-white selection:text-black">
      {/* Breadcrumb strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 text-xs text-zinc-400 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-white transition-colors">Products</Link>
          <span>/</span>
          <span className="text-white truncate max-w-[150px] sm:max-w-none">{product.title}</span>
        </div>
        <button onClick={handleShare} className="flex items-center gap-1.5 hover:text-white transition-colors text-[11px] uppercase tracking-wider">
          <Share2 className="w-3.5 h-3.5" />
          {copied ? 'Link Copied!' : 'Share'}
        </button>
      </div>

      {/* Main PDP Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Media Gallery */}
          <div className="lg:col-span-7">
            {/* Mobile Swipeable Full-Bleed Carousel */}
            <div className="block lg:hidden relative">
              <div className="relative aspect-[3/4] w-full bg-zinc-950 overflow-hidden">
                <div 
                  ref={carouselRef}
                  onScroll={(e) => {
                    const scrollLeft = e.currentTarget.scrollLeft;
                    const width = e.currentTarget.clientWidth || 1;
                    const idx = Math.round(scrollLeft / width);
                    if (idx !== selectedImage && idx >= 0 && idx < images.length) {
                      setSelectedImage(idx);
                    }
                  }}
                  className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-none no-scrollbar"
                >
                  {images.map((item, idx) => (
                    <div key={idx} className="w-full h-full shrink-0 snap-center relative bg-zinc-950 luxury-shimmer">
                      {isMediaVideo(item) ? (
                        <video
                          src={item}
                          autoPlay
                          muted
                          loop
                          playsInline
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={optimizeImageUrl(item, { width: 900, height: 1200, format: 'webp' })}
                          alt={`${product.title} view ${idx + 1}`}
                          className="w-full h-full object-cover object-top"
                          loading={idx === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = PLACEHOLDER_IMAGE;
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Overlaid Pagination Dots Indicator (...) matching reference */}
                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 z-10 pointer-events-none">
                  {images.map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        selectedImage === idx ? 'w-6 bg-white shadow-md' : 'w-1.5 bg-white/40'
                      }`}
                    />
                  ))}
                </div>

                {/* Slide Counter Badge */}
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-white border border-white/15 z-10">
                  {selectedImage + 1} / {images.length}
                </div>
              </div>

              {/* Mobile Thumbnail strip */}
              <div className="flex items-center gap-2 overflow-x-auto mt-2.5 pb-2 scrollbar-none no-scrollbar">
                {images.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedImage(idx);
                      if (carouselRef.current) {
                        carouselRef.current.scrollTo({
                          left: idx * carouselRef.current.clientWidth,
                          behavior: 'smooth'
                        });
                      }
                    }}
                    className={`relative w-14 h-16 shrink-0 bg-zinc-950 overflow-hidden border transition-all ${
                      selectedImage === idx ? 'border-white ring-1 ring-white/50' : 'border-white/20 opacity-50 hover:opacity-100'
                    }`}
                  >
                    {isMediaVideo(item) ? (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white">
                        <Play className="w-4 h-4 fill-white" />
                      </div>
                    ) : (
                      <img
                        src={optimizeImageUrl(item, { width: 160, height: 200, format: 'webp' })}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = PLACEHOLDER_IMAGE;
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop Stacked Images View */}
            <div className="hidden lg:flex flex-col gap-4">
              {images.map((item, idx) => (
                <div key={idx} className="relative aspect-[3/4] w-full bg-zinc-950 overflow-hidden border border-white/10 luxury-shimmer">
                  {isMediaVideo(item) ? (
                    <video
                      src={item}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={optimizeImageUrl(item, { width: 1000, height: 1333, format: 'webp' })}
                      alt={`${product.title} view ${idx + 1}`}
                      className="w-full h-full object-cover object-top"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = PLACEHOLDER_IMAGE;
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Sticky Product Info */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 h-fit space-y-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                CONFELION LABEL
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white mt-1">
                {product.title}
              </h1>

              {/* Price & Discount */}
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-xl sm:text-2xl font-black text-white">
                  Rs. {Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                {product.compare_at_price && (
                  <>
                    <span className="text-sm text-zinc-500 line-through">
                      Rs. {Number(product.compare_at_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-white/15 text-white border border-white/20">
                      {discountPercent}% OFF
                    </span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Tax included. Free express shipping on all prepaid orders.
              </p>
            </div>

            {/* Size Variant Picker */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Size: <strong className="text-white">{selectedSize}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowSizeGuide(true)}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer underline underline-offset-2 hover:text-white transition-colors"
                >
                  <Ruler className="w-3 h-3" />
                  <span>Size Guide</span>
                </button>
              </div>

              {/* Equal-width Rectangular Buttons with Sharp 0px Corners */}
              <div className="grid grid-cols-5 gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`h-11 border text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
                      selectedSize === s
                        ? 'bg-white text-black border-white shadow-md'
                        : 'bg-black text-white border-white/25 hover:border-white/60'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Purchase Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleAddToCart}
                disabled={added}
                className="w-full py-4 text-xs font-bold uppercase tracking-[0.2em] bg-white text-black hover:bg-zinc-200 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                {added ? (
                  <>
                    <Check className="w-4 h-4" /> Added to Bag
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" /> Add to Cart
                  </>
                )}
              </button>
            </div>

            {/* Delhivery Express Pincode & Delivery Availability Checker */}
            <div className="p-4 bg-zinc-950 border border-white/15 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                  <Truck className="w-4 h-4 text-emerald-400" />
                  <span>Delhivery Express Delivery</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Verified Courier SLA
                </span>
              </div>

              {/* Dispatch prompt */}
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 font-medium bg-white/5 px-2.5 py-1.5 rounded">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Dispatched within <strong className="text-white font-mono">3 to 7 days</strong> via Delhivery Express</span>
              </div>

              <form onSubmit={handleCheckPincode} className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit Pincode"
                    value={pincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setPincode(val);
                      if (val.length !== 6) setDeliveryResult(null);
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-black border border-white/20 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pincodeChecking || pincode.length !== 6}
                  className="px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors disabled:opacity-40 flex items-center justify-center min-w-[70px]"
                >
                  {pincodeChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Check'}
                </button>
              </form>

              {deliveryResult && (
                deliveryResult.serviceable ? (
                  <div className="text-xs space-y-2 pt-2 border-t border-white/10 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>{deliveryResult.estimated_delivery_text}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-white/5 px-2 py-0.5 rounded">
                        {deliveryResult.zone || 'Express Route'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <span className="text-white font-medium">• Cash on Delivery (COD) Available</span>
                      <span className="text-emerald-400 font-medium">• Free Express Shipping over ₹999</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-0.5">
                      <span>Fulfillment Route: Poonchh Warehouse ({deliveryResult.origin_pincode || '284304'})</span>
                      <span className="text-zinc-400">Carrier: Delhivery Express</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-red-400 pt-2 border-t border-white/10">
                    {deliveryResult.error || 'Pincode not serviceable currently.'}
                  </div>
                )
              )}
            </div>

            {/* Value Props Strip */}
            <div className="grid grid-cols-3 gap-2 py-4 border-y border-white/10 text-center">
              <div className="flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                <div className="w-8 h-8 rounded-full border border-white/15 bg-white/5 flex items-center justify-center mb-1 text-white">
                  <Truck className="w-3.5 h-3.5 text-zinc-300" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Fast Dispatch</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1.5 p-2 border-x border-white/10 text-center">
                <div className="w-8 h-8 rounded-full border border-white/15 bg-white/5 flex items-center justify-center mb-1 text-white">
                  <RefreshCw className="w-3.5 h-3.5 text-zinc-300" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Exchange</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                <div className="w-8 h-8 rounded-full border border-white/15 bg-white/5 flex items-center justify-center mb-1 text-white">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Luxury Boxed</span>
              </div>
            </div>

            {/* Accordions */}
            <div className="divide-y divide-white/10 border-b border-white/10 text-xs">
              {/* Description */}
              <div>
                <button
                  onClick={() => toggleAccordion('desc')}
                  className="w-full py-3.5 flex items-center justify-between font-bold uppercase tracking-wider text-left text-white"
                >
                  <span>Description</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      openAccordion === 'desc' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openAccordion === 'desc' && (
                  <div className="pb-4 text-zinc-300 leading-relaxed space-y-3 font-normal">
                    <p>{product.description}</p>
                    {details && details.length > 0 && (
                      <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                        {details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Shipping & Delivery */}
              <div>
                <button
                  onClick={() => toggleAccordion('shipping')}
                  className="w-full py-3.5 flex items-center justify-between font-bold uppercase tracking-wider text-left text-white"
                >
                  <span>Shipping & Delivery</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      openAccordion === 'shipping' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openAccordion === 'shipping' && (
                  <div className="pb-4 text-zinc-400 leading-relaxed space-y-2">
                    <p>• Dispatched within 24 hours from our Mumbai studio.</p>
                    <p>• Estimated delivery: 2-4 business days across India.</p>
                    <p>• Orders above ₹3,000 are delivered in our signature Confelion rigid magnetic gift box.</p>
                  </div>
                )}
              </div>

              {/* Exchanges & Returns */}
              <div>
                <button
                  onClick={() => toggleAccordion('returns')}
                  className="w-full py-3.5 flex items-center justify-between font-bold uppercase tracking-wider text-left text-white"
                >
                  <span>Exchanges & Guarantee</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      openAccordion === 'returns' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openAccordion === 'returns' && (
                  <div className="pb-4 text-zinc-400 leading-relaxed space-y-2">
                    <p>• Doorstep pickup exchange for size adjustments.</p>
                    <p>• Item must be unwashed, unworn, with all original tags attached.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Rating Box */}
            <div className="p-4 bg-zinc-950 border border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <span className="text-xs font-bold text-white">{product.rating || '4.9'} / 5.0</span>
                <span className="text-[11px] text-zinc-400">· {product.reviews_count || 38} Verified Reviews</span>
              </div>
              <p className="mt-2 text-xs text-zinc-300 italic">
                "The fabric weight and silhouette are exceptional. The all-black aesthetic is completely unmatched."
              </p>
              <span className="mt-1 block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                — Aditya V., Verified Buyer
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* SIZE GUIDE MODAL */}
      {showSizeGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-black border border-white/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative shadow-2xl animate-scale-up">
            <button
              onClick={() => setShowSizeGuide(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1 text-zinc-400">
              <Ruler className="w-4 h-4 text-white" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Sizing Chart & Fit Guide</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mb-4">
              {product.size_chart_title || product.title} Measurements
            </h2>

            {/* If a custom size chart image is uploaded */}
            {product.size_chart_image ? (
              <div className="mb-6 border border-white/15 bg-zinc-950 p-2">
                <img
                  src={optimizeImageUrl(product.size_chart_image, { width: 800, height: 800, format: 'webp' })}
                  alt="Size Chart"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                  className="w-full max-h-96 object-contain mx-auto"
                />
              </div>
            ) : null}

            {/* Measurement Table */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  {isBottom ? 'Bottoms / Pants Garment Dimensions' : 'Tops / Shirts Garment Dimensions'}
                </span>
                <div className="flex border border-white/20">
                  <button
                    onClick={() => setSizeUnit('in')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase ${
                      sizeUnit === 'in' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Inches (in)
                  </button>
                  <button
                    onClick={() => setSizeUnit('cm')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase ${
                      sizeUnit === 'cm' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Centimeters (cm)
                  </button>
                </div>
              </div>

              <div className="border border-white/15 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 border-b border-white/10 uppercase text-[10px] font-bold tracking-wider text-zinc-300">
                    <tr>
                      <th className="py-3 px-4">Size</th>
                      {isBottom ? (
                        <>
                          <th className="py-3 px-4">Waist</th>
                          <th className="py-3 px-4">Total Length</th>
                          <th className="py-3 px-4">Inseam</th>
                          <th className="py-3 px-4">Hip / Thigh</th>
                          <th className="py-3 px-4">Leg Opening</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3 px-4">Chest / Bust</th>
                          <th className="py-3 px-4">Body Length</th>
                          <th className="py-3 px-4">Shoulder</th>
                          <th className="py-3 px-4">Sleeve</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 font-mono text-zinc-300">
                    {sizeTable.map((row, idx) => (
                      <tr 
                        key={idx} 
                        className={`transition-colors hover:bg-white/5 ${
                          selectedSize === row.size ? 'bg-white/10 text-white font-bold' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-sans font-bold text-white">{row.size}</td>
                        {isBottom ? (
                          <>
                            <td className="py-3 px-4">{convertVal(row.waist)}</td>
                            <td className="py-3 px-4">{convertVal(row.length)}</td>
                            <td className="py-3 px-4">{convertVal(row.inseam)}</td>
                            <td className="py-3 px-4">{convertVal(row.hip || row.thigh)}</td>
                            <td className="py-3 px-4">{convertVal(row.legOpening || row.opening || row.bottom)}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4">{convertVal(row.chest)}</td>
                            <td className="py-3 px-4">{convertVal(row.length)}</td>
                            <td className="py-3 px-4">{convertVal(row.shoulder)}</td>
                            <td className="py-3 px-4">{convertVal(row.sleeve)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fit Guidance Box */}
            <div className="p-4 bg-zinc-950 border border-white/10 mb-6 space-y-1.5 text-xs text-zinc-400">
              <span className="font-bold uppercase tracking-wider text-white block">Silhouette & Fit Note:</span>
              <p>• All Confelion apparel features a modern relaxed, drop-shoulder cut.</p>
              <p>• Fits true to size for a structured drape. For an exaggerated streetwear silhouette, choose one size up.</p>
            </div>

            <button
              onClick={() => setShowSizeGuide(false)}
              className="w-full py-3 bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
            >
              Back to Product
            </button>
          </div>
        </div>
      )}

      {/* Recommended Products Carousel */}
      <div className="py-12 sm:py-16 border-t border-white/10">
        <ProductGrid
          title="Pairs Well With"
          subtitle="Complete your all-black uniform"
          products={relatedProducts}
        />
      </div>
    </div>
  );
}
