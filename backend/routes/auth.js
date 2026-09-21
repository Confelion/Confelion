const bcrypt=require('bcryptjs'),{sign}=require('../middleware/auth')
module.exports=db=>{
 const r=require('express').Router()
 r.post('/signup',async(req,res)=>{
  const {name,email,password,role}=req.body
  if(!email||!password) return res.status(400).json({error:'email+password required'})
  const h=await bcrypt.hash(password,10)
  try{
   const s=db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run(name||email.split('@')[0],email,h,role==='admin'?'admin':'user')
   const u=db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(s.lastInsertRowid)
   const t=sign({id:u.id,email:u.email,role:u.role})
   res.json({user:u,token:t})
  }catch(e){res.status(409).json({error:'Email exists'})}
 })
 r.post('/login',async(req,res)=>{
  const {email,password}=req.body
  const u=db.prepare('SELECT * FROM users WHERE email=?').get(email)
  if(!u) return res.status(401).json({error:'Invalid credentials'})
  if(!await bcrypt.compare(password,u.password)) return res.status(401).json({error:'Invalid credentials'})
  const t=sign({id:u.id,email:u.email,role:u.role})
  res.json({user:{id:u.id,name:u.name,email:u.email,role:u.role},token:t})
 })
 r.get('/me',require('../middleware/auth').auth,(req,res)=>{
  const u=db.prepare('SELECT id,name,email,role,created_at FROM users WHERE id=?').get(req.user.id)
  res.json(u)
 })
 return r
}