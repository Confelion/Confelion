import {useState, useEffect, useCallback} from "react"
import { X } from 'lucide-react'

export default function InstagramPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storageKey = "cfInstagramPopupLastShown"
    const repeatAfterDays = 3
    const delayInMilliseconds = 3500

    const lastShown = localStorage.getItem(storageKey)
    const shouldShow = !lastShown || (Date.now() - Number(lastShown) > repeatAfterDays * 24 * 60 * 60 * 1000)

    if (shouldShow) {
      const timer = setTimeout(() => setIsVisible(true), delayInMilliseconds)
      return () => clearTimeout(timer)
    }
  }, [])

  const markAsSeen = useCallback(() => {
    localStorage.setItem("cfInstagramPopupLastShown", String(Date.now()))
  }, [])

  const closePopup = useCallback(() => {
    setIsVisible(false)
    markAsSeen()
  }, [markAsSeen])

  useEffect(() => {
    if (!isVisible) return
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closePopup()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isVisible, closePopup])

  if (!mounted || !isVisible) return null

  return (
    <div
      id="cfIgPopup"
      className="cf-popup-overlay cf-popup-visible"
      aria-hidden="false"
      onClick={(e) => e.target === e.currentTarget && closePopup()}
      role="dialog"
      aria-modal="true"
      aria-label="Follow Confelion on Instagram"
    >
      <div className="cf-popup-card">
        <button className="cf-popup-close" type="button" aria-label="Close popup" onClick={closePopup}>
          <X className="w-5 h-5" strokeWidth={2} />
        </button>

        <div className="cf-popup-image">
          <div className="cf-image-overlay" />
          <div className="cf-image-brand">
            <span>CONFELION</span>
            <small>LIMITED DROPS</small>
          </div>
        </div>

        <div className="cf-popup-content">
          <div className="cf-popup-eyebrow">STAY IN THE LOOP</div>
          <h2>Be first to know.</h2>
          <p>
            Limited drops, restocks and private offers — exclusively on Instagram.
          </p>
          <a
            className="cf-popup-primary"
            href="https://www.instagram.com/confelion__/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={markAsSeen}
          >
            <svg className="cf-instagram-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.4" cy="6.7" r="1" />
            </svg>
            <span>Follow @confelion__</span>
          </a>
          <button className="cf-popup-secondary" type="button" onClick={closePopup}>
            Continue shopping
          </button>
        </div>
      </div>
    </div>
  )
}