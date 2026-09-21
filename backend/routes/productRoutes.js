const {aiUrl,shopifyLight}=require('../../utils/aiImage')
module.exports=db=>{
const r=require('express').Router()
const light=p=>({...p,ai_image:aiUrl(p.handle,p.title,p.tags),light_image:shopifyLight(p.image_url||p.light_image||''), image_url:p.image_url||null})

r.get('/',(q,s)=>{
  try{
    const {category, type, tags, q: search, sort} = q.query
    let where = 'WHERE p.published = 1'
    const params = []

    if(category){
      where += ' AND p.vendor = ?'
      params.push(category)
    }
    if(type){
      where += ' AND p.type = ?'
      params.push(type)
    }
    if(tags){
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
      if(tagList.length > 0){
        where += ' AND (' + tagList.map(() => 'p.tags LIKE ?').join(' OR ') + ')'
        tagList.forEach(tag => params.push(`%${tag}%`))
      }
    }
    if(search){
      where += ' AND (p.title LIKE ? OR p.tags LIKE ? OR p.vendor LIKE ? OR p.type LIKE ?)'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm)
    }

    let orderBy = 'ORDER BY p.id DESC'
    switch(sort){
      case 'price-asc':
        orderBy = 'ORDER BY COALESCE((SELECT price FROM variants WHERE product_id=p.id LIMIT 1), 0) ASC'
        break
      case 'price-desc':
        orderBy = 'ORDER BY COALESCE((SELECT price FROM variants WHERE product_id=p.id LIMIT 1), 0) DESC'
        break
      case 'name-asc':
        orderBy = 'ORDER BY p.title ASC'
        break
      case 'name-desc':
        orderBy = 'ORDER BY p.title DESC'
        break
      case 'newest':
      default:
        orderBy = 'ORDER BY p.id DESC'
        break
    }

    const rows = db.prepare(`
      SELECT p.*,
        (SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY position ASC, id ASC LIMIT 1) as image_url,
        (SELECT price FROM variants WHERE product_id=p.id LIMIT 1) as price,
        (SELECT compare_at_price FROM variants WHERE product_id=p.id LIMIT 1) as compare_at_price
      FROM products p
      ${where}
      ${orderBy}
    `).all(...params).map(light)
    
    s.json(rows)
  }catch(e){ s.status(500).json({error:e.message}) }
})

r.get('/:handle',(q,s)=>{
 const p=db.prepare('SELECT * FROM products WHERE handle=?').get(q.params.handle)
 if(!p) return s.status(404).json({error:'Not found'})
 p.ai_image=aiUrl(p.handle,p.title,p.tags)
 const imgs=db.prepare('SELECT * FROM product_images WHERE product_id=?').all(p.id).map(i=>({...i,light_url:shopifyLight(i.image_url),ai_url:aiUrl(p.handle,p.title,p.tags)}))
 s.json({product:p,variants:db.prepare('SELECT * FROM variants WHERE product_id=?').all(p.id),productImages:imgs,options:db.prepare('SELECT * FROM options WHERE product_id=?').all(p.id)})
})
r.get('/:handle/variants',(q,s)=>{
 const p=db.prepare('SELECT id FROM products WHERE handle=?').get(q.params.handle)
 if(!p) return s.status(404).json({error:'Not found'})
 s.json(db.prepare('SELECT * FROM variants WHERE product_id=?').all(p.id))
})
r.get('/:handle/options',(q,s)=>{
 const p=db.prepare('SELECT id FROM products WHERE handle=?').get(q.params.handle)
 if(!p) return s.status(404).json({error:'Not found'})
 s.json(db.prepare('SELECT * FROM options WHERE product_id=?').all(p.id))
})
r.get('/cart',(q,s)=>s.json({items:[]}))
r.post('/cart',(q,s)=>s.json({success:true}))
r.post('/checkout',(q,s)=>s.json({success:true,orderId:Math.floor(Math.random()*1e6)}))
return r}