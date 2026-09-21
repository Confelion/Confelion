import {useEffect, useState, useRef} from "react"
import {Link} from "react-router-dom"
import {fetchAPI} from "../lib/api"

function buildFilterUrl(filter) {
  const params = new URLSearchParams()
  if (filter.type) params.set("type", filter.type)
  if (filter.tags) params.set("tags", filter.tags)
  if (filter.category) params.set("category", filter.category)
  const qs = params.toString()
  return `/products${qs ? `?${qs}` : ""}`
}

export default function CollectionStrip() {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    const fetchCollections = async () => {
      try {
        const products = await fetchAPI('/api/products')

        const typeCount = {}
        const catCount = {}
        const tagCount = {}
        products.forEach(p => {
          if (p.type) typeCount[p.type] = (typeCount[p.type] || 0) + 1
          if (p.vendor) catCount[p.vendor] = (catCount[p.vendor] || 0) + 1
          if (p.tags) {
            p.tags.split(",").forEach(t => {
              const tag = t.trim()
              if (tag) tagCount[tag] = (tagCount[tag] || 0) + 1
            })
          }
        })

        const dynamicCollections = []

        Object.entries(typeCount)
          .sort((a, b) => b[1] - a[1])
          .forEach(([type]) => {
            dynamicCollections.push({
              text: type.toUpperCase(),
              filter: {type},
              accent: dynamicCollections.length === 0,
            })
          })

        Object.entries(catCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .forEach(([cat]) => {
            dynamicCollections.push({
              text: cat.toUpperCase(),
              filter: {category: cat},
              accent: false,
            })
          })

        const popularTags = ["tee", "shirt", "jeans", "baggy", "formal", "waffle", "knit", "cotton", "linen", "oversized"]
        Object.entries(tagCount)
          .filter(([tag]) => popularTags.includes(tag.toLowerCase()))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .forEach(([tag]) => {
            dynamicCollections.push({
              text: tag.toUpperCase(),
              filter: {tags: tag},
              accent: false,
            })
          })

        if (dynamicCollections.length === 0) {
          dynamicCollections.push(
            {text: "TEES", filter: {type: "tee"}, accent: true},
            {text: "SHIRTS", filter: {type: "shirt"}, accent: false},
            {text: "JEANS", filter: {tags: "jeans"}, accent: false},
            {text: "BAGGY", filter: {tags: "baggy"}, accent: false},
            {text: "FORMAL", filter: {tags: "formal"}, accent: false}
          )
        }

        setCollections(dynamicCollections.slice(0, 8))
      } catch (e) {
        console.error("Failed to fetch collections", e)
        setCollections([
          {text: "TEES", filter: {type: "tee"}, accent: true},
          {text: "SHIRTS", filter: {type: "shirt"}, accent: false},
          {text: "JEANS", filter: {tags: "jeans"}, accent: false},
          {text: "BAGGY", filter: {tags: "baggy"}, accent: false},
          {text: "FORMAL", filter: {tags: "formal"}, accent: false}
        ])
      } finally {
        setLoading(false)
      }
    }
    fetchCollections()
  }, [])

  if (loading) {
    return (
      <section className="cf-wrapper" aria-labelledby="collection-heading">
        <div id="collection-heading" className="cf-heading">COLLECTION</div>
        <div className="cf-strip">
          <div className="cf-strip__track" role="list">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="cf-strip__item skeleton" style={{width: "120px"}} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="cf-wrapper" aria-labelledby="collection-heading">
      <div id="collection-heading" className="cf-heading">COLLECTION</div>
      <div className="cf-strip">
        <div className="cf-strip__track" id="cfTrack" role="list">
          {collections.map((item, index) => (
            <Link
              key={index}
              to={buildFilterUrl(item.filter)}
              className={`cf-strip__item ${item.accent ? "cf-strip__item--accent" : ""}`}
              role="listitem"
            >
              {item.text}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
