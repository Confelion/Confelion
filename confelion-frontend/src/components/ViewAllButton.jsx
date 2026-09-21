import { Link } from "react-router-dom"

export default function ViewAllButton({href = "/products", label = "View All Products"}) {
  return (
    <div className="cf-viewall-wrap" role="region" aria-label="View all products">
      <Link to={href} className="cf-viewall" aria-label={label}>
        <svg width="16" height="16" viewBox="0 0 24 24" style={{flexShrink: 0}} aria-hidden="true">
          <path fill="currentColor" d="M3 6h18v2H3zM3 11h12v2H3zM3 16h18v2H3z" />
        </svg>
        <span>{label}</span>
      </Link>
    </div>
  )
}
