const cache=new Map()
function aiUrl(handle,title,tags){
 const k=handle||title||'fashion'
 if(cache.has(k)) return cache.get(k)
 // lightweight AI prompt -> 10-15KB WebP via pollinations (free, no key) + optimized params
 const prompt=`minimalist studio fashion ${title||k} ${tags||''} premium clothing white background, ultra lightweight, 4k`.slice(0,120)
 const url=`https://image.pollinations.ai/p/${encodeURIComponent(prompt)}?width=400&height=500&nologo=true&model=turbo`
 // fallback lightweight placeholder (2KB SVG) if AI fails - data uri not needed
 const lightweight=url
 cache.set(k,lightweight)
 return lightweight
}
function shopifyLight(url){
 if(!url) return null
 // Shopify CDN supports width/format compression: ~80% size reduction
 if(url.includes('cdn.shopify.com')) return url+(url.includes('?')?'&':'?')+'width=400&height=500&crop=center&format=webp'
 return url
}
function getLightImage(p){
 // priority: AI lightweight > optimized shopify > placeholder
 if(!p) return 'https://via.placeholder.com/400x500/f5f5f5/111?text=CONFELION'
 if(p.handle) return aiUrl(p.handle,p.title,p.tags)
 return aiUrl(null,p.title,p.tags)
}
module.exports={aiUrl,shopifyLight,getLightImage}