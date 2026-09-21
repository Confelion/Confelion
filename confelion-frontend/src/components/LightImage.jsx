import {useState, useRef, useCallback} from "react"

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='%23f4f4f5'/%3E%3C/svg%3E"

export default function LightImage({src, alt, handle, title, tags, w = 400, h = 500, className = "", priority = false, style}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef(null)

  let light = null
  if (src) {
    if (src.includes("cdn.shopify.com")) {
      light = src + (src.includes("?") ? "&" : "?") + `width=${w}&height=${h}&crop=center&format=webp`
    } else {
      light = src
    }
  } else if (handle) {
    light = `https://image.pollinations.ai/p/${encodeURIComponent(`minimalist studio fashion ${title || handle} ${tags || ""} white background lightweight`.slice(0, 90))}?width=${w}&height=${h}&nologo=true&model=turbo`
  } else {
    light = PLACEHOLDER
  }

  const handleLoad = useCallback(() => setLoaded(true), [])
  const handleError = useCallback(() => {
    if (!error) setError(true)
    setLoaded(true)
  }, [error])

  const srcToUse = error ? PLACEHOLDER : light

  return (
    <div className={`relative overflow-hidden ${className}`} style={{contentVisibility: priority ? "visible" : "auto", ...style}}>
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-100" aria-hidden="true" />
      )}
      <img
        ref={imgRef}
        src={srcToUse}
        alt={alt || title || "product"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        width={w}
        height={h}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}
