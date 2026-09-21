import {useEffect, useState} from "react"
import { useParams } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import Hero from "../components/Hero"
import ProductGrid from "../components/ProductGrid"
import Features from "../components/Features"
import ReviewsMarquee from "../components/ReviewsMarquee"

export default function PreviewPage() {
  const {token} = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/preview/data/${token}`, {signal: controller.signal})
      .then(r => {
        if (!r.ok) throw new Error('Preview not found or expired')
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Helmet><title>Loading Preview...</title></Helmet>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">Loading preview...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Helmet><title>Preview Error - CONFELION</title></Helmet>
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h1 className="text-xl font-black mb-2">Preview Unavailable</h1>
          <p className="text-zinc-500 text-sm mb-6">{error}</p>
          <Link to="/" className="inline-block bg-black text-white px-6 py-2.5 text-sm font-medium rounded-lg hover:bg-zinc-900 transition-colors">
            Go to Homepage
          </Link>
        </div>
      </div>
    )
  }

  const s = data.settings || {}
  const products = data.products || []

  const featuredHandles = (s.featured_products || "").split(",").map(h => h.trim()).filter(Boolean)
  const newArrivalsCount = parseInt(s.new_arrivals_count) || 8

  let featuredProducts, newProducts
  if (featuredHandles.length > 0) {
    featuredProducts = products.filter(p => featuredHandles.includes(p.handle))
    newProducts = products.filter(p => !featuredHandles.includes(p.handle)).slice(0, newArrivalsCount)
    if (featuredProducts.length === 0) {
      featuredProducts = products.slice(0, 4)
      newProducts = products.slice(4, 4 + newArrivalsCount)
    }
  } else {
    featuredProducts = products.slice(0, 4)
    newProducts = products.slice(4, 4 + newArrivalsCount)
  }

  return (
    <>
      <Helmet>
        <title>{data.title || "Website Preview"} - CONFELION</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/applogo.svg" type="image/svg+xml" />
      </Helmet>

      {/* Preview Mode Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-2.5 text-center relative z-[60]">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            PREVIEW MODE
          </span>
          <span className="text-xs text-white/80 hidden sm:inline">This is a client preview of your website</span>
          <span className="text-xs text-white/60 hidden md:inline">•</span>
          <span className="text-xs text-white/60 hidden md:inline">Expires: {new Date(data.expires_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="min-h-screen bg-white text-zinc-900">
        {/* Navigation */}
        <header className="border-b border-zinc-100 bg-white sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link to="/" className="shrink-0 hover:opacity-80 transition-opacity">
              <img src="/images/confelion-logo.png" alt={s.site_name || "CONFELION"} className="h-7 w-auto" />
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/" className="text-sm font-medium text-zinc-600 hover:text-black transition-colors">Home</Link>
              <Link to="/products" className="text-sm font-medium text-zinc-600 hover:text-black transition-colors">Shop</Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <Hero
          image={s.hero_image || "/images/hero-banner.svg"}
          headline={s.hero_headline || "Less is more."}
          subtext={s.hero_subtext || "Minimalist apparel, impeccable craftsmanship. The clothing is the hero."}
          buttonText={s.hero_button_text || "SHOP COLLECTION"}
          buttonLink={s.hero_button_link || "/products"}
        />

        {/* Featured Products */}
        {featuredProducts.length > 0 && (
          <ProductGrid
            products={featuredProducts}
            title="Featured Collection"
            className="py-12 md:py-16"
          />
        )}

        {/* New Arrivals */}
        {newProducts.length > 0 && (
          <ProductGrid
            products={newProducts}
            title="New Arrivals"
            className="py-12 md:py-16"
          />
        )}

        <Features />
        <ReviewsMarquee />
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-zinc-50/50">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <img src="/images/confelion-logo.png" alt={s.site_name || "CONFELION"} className="h-6 w-auto mb-3" />
              <p className="text-zinc-600 text-sm leading-relaxed max-w-sm">
                {s.footer_about || "Minimalist apparel, impeccable craftsmanship. The clothing is the hero."}
              </p>
              <div className="flex items-center gap-3 mt-4">
                {s.footer_instagram && (
                  <a href={s.footer_instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                    <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" strokeWidth="2"/><circle cx="12" cy="12" r="5" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>
                  </a>
                )}
                {s.footer_twitter && (
                  <a href={s.footer_twitter} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                    <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M23 3a10.9 10.9 0 01-3.14 1.53A4.48 4.48 0 0022.43.36a9.09 9.09 0 01-2.88 1.1A4.52 4.52 0 0012 7.53v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
                  </a>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-black text-sm tracking-wide mb-3">Shop</h4>
              <nav className="space-y-2">
                <Link to="/products" className="text-zinc-600 text-sm hover:text-black transition-colors block">All Products</Link>
                <Link to="/products?type=tee" className="text-zinc-600 text-sm hover:text-black transition-colors block">Tees</Link>
                <Link to="/products?type=shirt" className="text-zinc-600 text-sm hover:text-black transition-colors block">Shirts</Link>
              </nav>
            </div>
            <div>
              <h4 className="font-black text-sm tracking-wide mb-3">Help</h4>
              <nav className="space-y-2">
                <span className="text-zinc-600 text-sm block">Shipping: Free over ₹999</span>
                <span className="text-zinc-600 text-sm block">Returns: Easy 7-day</span>
              </nav>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-zinc-400">
            <span>© {new Date().getFullYear()} {s.site_name || "CONFELION"}. All rights reserved.</span>
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">PREVIEW MODE — Cart & checkout disabled</span>
          </div>
        </div>
      </footer>
    </>
  )
}
