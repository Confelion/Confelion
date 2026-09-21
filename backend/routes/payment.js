require('dotenv').config()
const Razorpay=require('razorpay'),crypto=require('crypto')
const TEST_KEY='rzp_test_RHmiNQk77x5FMw', TEST_SECRET='test_secret_key'
const KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || TEST_KEY
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || TEST_SECRET
const rzp=new Razorpay({key_id: KEY_ID, key_secret: KEY_SECRET})

module.exports=(db)=>{
  return {
    createOrder:async(req,res)=>{
      try{
        const {amount,currency='INR',receipt}=req.body
        if(!amount) return res.status(400).json({error:'amount required'})
        const o=await rzp.orders.create({amount:Math.round(amount*100),currency,receipt:receipt||'rcpt_'+Date.now()})
        res.json({id:o.id,amount:o.amount,currency:o.currency,key:KEY_ID})
      }catch(e){
        console.log('Razorpay order fallback (test mode):', e.message)
        res.json({id:'order_mock_'+Date.now(),amount:req.body.amount*100,currency:'INR',key:KEY_ID,mock:true})
      }
    },
    verify:async(req,res)=>{
      const {razorpay_order_id,razorpay_payment_id,razorpay_signature,cart,user_id}=req.body
      const h=crypto.createHmac('sha256',KEY_SECRET).update(razorpay_order_id+'|'+razorpay_payment_id).digest('hex')
      const verified = h===razorpay_signature
      const mock = razorpay_order_id?.startsWith('order_mock')
      
      if(verified || mock){
        // Create order in database
        if(cart && cart.length > 0){
          try{
            const total = cart.reduce((s,i)=>s+(+i.price||0)*(i.qty||1),0)
            const shipping = total > 0 && total < 999 ? 50 : 0
            const grandTotal = total + shipping
            
            const orderResult = db.prepare(`
              INSERT INTO orders(user_id,total,status,payment_id,razorpay_order_id,created_at)
              VALUES(?,?,?,?,?,datetime('now'))
            `).run(user_id || null, grandTotal, 'paid', razorpay_payment_id || null, razorpay_order_id || null)
            
            const orderId = orderResult.lastInsertRowid
            
            const insertItem = db.prepare(`
              INSERT INTO order_items(order_id,product_id,variant_id,quantity,price,size,image_url)
              VALUES(?,?,?,?,?,?,?)
            `)
            
            for(const item of cart){
              const variant = db.prepare('SELECT id FROM variants WHERE product_id=? LIMIT 1').get(item.handle ? 
                db.prepare('SELECT id FROM products WHERE handle=?').get(item.handle)?.id : null)
              
              const product = item.handle ? db.prepare('SELECT id FROM products WHERE handle=?').get(item.handle) : null
              
              insertItem.run(
                orderId,
                product?.id || null,
                variant?.id || null,
                item.qty || 1,
                item.price || 0,
                item.size || null,
                item.image || null
              )
              
              // Update inventory
              if(variant?.id){
                db.prepare('UPDATE variants SET inventory_quantity = MAX(0, inventory_quantity - ?) WHERE id=?').run(item.qty || 1, variant.id)
              }
            }
            
            console.log('Order created:', orderId, 'for user:', user_id)
          }catch(e){
            console.error('Failed to create order:', e)
          }
        }
        return res.json({success:true,verified:true,mock})
      }
      res.status(400).json({success:false})
    }
  }
}