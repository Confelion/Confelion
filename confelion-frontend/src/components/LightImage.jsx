import { useState, useRef, useCallback } from "react";
import { optimizeImageUrl, PLACEHOLDER_IMAGE } from "../utils/imageOptimizer";

export default function LightImage({
  src,
  alt,
  handle,
  title,
  w = 400,
  h = 500,
  className = "",
  priority = false,
  style
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  const light = error ? PLACEHOLDER_IMAGE : optimizeImageUrl(src, { width: w, height: h });

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => {
    if (!error) setError(true);
    setLoaded(true);
  }, [error]);

  return (
    <div
      className={`relative overflow-hidden bg-zinc-950 ${className}`}
      style={{ contentVisibility: priority ? "visible" : "auto", ...style }}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-900 animate-pulse" aria-hidden="true" />
      )}
      <img
        ref={imgRef}
        src={light}
        alt={alt || title || "product"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        width={w}
        height={h}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
