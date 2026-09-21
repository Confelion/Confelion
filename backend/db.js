const D=require('better-sqlite3');let db
function needsMigration(table){
  try{
    const row=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table)
    if(!row||!row.sql) return false
    // if table has FK but missing CASCADE -> needs migration
    if(row.sql.includes('FOREIGN KEY') && !row.sql.includes('ON DELETE CASCADE')) return true
    return false
  }catch{return false}
}
function migrateFKs(){
  const targets=[
    {name:'options', newName:'_options_new', sql:`CREATE TABLE _options_new(id INTEGER PRIMARY KEY,product_id INTEGER,name TEXT,value TEXT,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE)`},
    {name:'variants', newName:'_variants_new', sql:`CREATE TABLE _variants_new(id INTEGER PRIMARY KEY,product_id INTEGER,sku TEXT,price REAL,compare_at_price REAL,inventory_quantity INTEGER,inventory_policy TEXT,requires_shipping INTEGER,taxable INTEGER,barcode TEXT,cost_per_item REAL,status TEXT,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE)`},
    {name:'product_images', newName:'_product_images_new', sql:`CREATE TABLE _product_images_new(id INTEGER PRIMARY KEY,product_id INTEGER,image_url TEXT,position INTEGER,alt_text TEXT,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE)`},
    {name:'variant_images', newName:'_variant_images_new', sql:`CREATE TABLE _variant_images_new(id INTEGER PRIMARY KEY,variant_id INTEGER,image_url TEXT,position INTEGER,alt_text TEXT,FOREIGN KEY(variant_id) REFERENCES variants(id) ON DELETE CASCADE)`}
  ]
  const needAny=targets.some(t=>needsMigration(t.name))
  if(!needAny) return
  console.log('Migrating FKs to ON DELETE CASCADE...')
  db.pragma('foreign_keys=OFF')
  try{
    db.exec('BEGIN TRANSACTION')
    for(const t of targets){
      if(!needsMigration(t.name)) continue
      // create new table
      db.exec(t.sql)
      // copy data (cols may differ if schema mismatch like AUTOINCREMENT vs not, but column names same)
      const cols=db.prepare(`PRAGMA table_info(${t.name})`).all().map(c=>c.name).join(',')
      if(cols) db.exec(`INSERT INTO ${t.newName} (${cols}) SELECT ${cols} FROM ${t.name}`)
      db.exec(`DROP TABLE ${t.name}`)
      db.exec(`ALTER TABLE ${t.newName} RENAME TO ${t.name}`)
      console.log(`  fixed ${t.name}`)
    }
    db.exec('COMMIT')
  }catch(e){
    try{db.exec('ROLLBACK')}catch{}
    console.error('FK migration failed', e.message)
  } finally {
    db.pragma('foreign_keys=ON')
  }
}
exports.initDatabase=()=>{db=new D('confelion.db');db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');db.exec(`
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,handle TEXT UNIQUE,title TEXT,vendor TEXT,product_category TEXT,type TEXT,tags TEXT,published INTEGER,created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS options(id INTEGER PRIMARY KEY,product_id INTEGER,name TEXT,value TEXT,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS variants(id INTEGER PRIMARY KEY,product_id INTEGER,sku TEXT,price REAL,compare_at_price REAL,inventory_quantity INTEGER,inventory_policy TEXT,requires_shipping INTEGER,taxable INTEGER,barcode TEXT,cost_per_item REAL,status TEXT,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS product_images(id INTEGER PRIMARY KEY,product_id INTEGER,image_url TEXT,position INTEGER,alt_text TEXT,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS variant_images(id INTEGER PRIMARY KEY,variant_id INTEGER,image_url TEXT,position INTEGER,alt_text TEXT,FOREIGN KEY(variant_id) REFERENCES variants(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT,email TEXT UNIQUE,password TEXT,role TEXT DEFAULT 'user',created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,user_id INTEGER,total REAL,status TEXT DEFAULT 'pending',payment_id TEXT,razorpay_order_id TEXT,shipping_address TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY,order_id INTEGER,product_id INTEGER,variant_id INTEGER,quantity INTEGER,price REAL,size TEXT,image_url TEXT,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL,FOREIGN KEY(variant_id) REFERENCES variants(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY,key TEXT UNIQUE,value TEXT,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS preview_tokens(id INTEGER PRIMARY KEY,token TEXT UNIQUE NOT NULL,title TEXT,created_by INTEGER,expires_at DATETIME,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS media_assets(id INTEGER PRIMARY KEY AUTOINCREMENT,hash TEXT UNIQUE NOT NULL,original_name TEXT,r2_key TEXT UNIQUE NOT NULL,public_url TEXT NOT NULL,mime_type TEXT,file_size INTEGER,width INTEGER,height INTEGER,folder TEXT DEFAULT 'uploads',created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_media_hash ON media_assets(hash);
CREATE INDEX IF NOT EXISTS idx_media_folder ON media_assets(folder);`)
migrateFKs()
try{
  const adminEmail = "confelion@gmail.com"
  const adminPassHash = "$2b$10$HVrOMZr0QxviNg5VMIMT3.Nf46Zy0ZXCdtkJ1jbyd0AMQHkL2Ek3i" // confelionmain123
  const existingAdmin = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail)
  if (!existingAdmin) {
    db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)").run("Confelion Admin", adminEmail, adminPassHash, "admin")
  } else {
    db.prepare("UPDATE users SET password=?, role=?, name=? WHERE email=?").run(adminPassHash, "admin", "Confelion Admin", adminEmail)
  }
}catch(e){console.warn('Admin user seed note:', e.message)}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("announcement_text","Free shipping on orders over ₹999  •  Easy 30-day returns  •  COD available")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("announcement_bg","#18181b")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("announcement_text_color","#ffffff")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("announcement_accent_color","#10b981")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("site_name","CONFELION")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("site_tagline","Minimalist apparel, impeccable craftsmanship")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("hero_headline","Less is more.")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("hero_subtext","Minimalist apparel, impeccable craftsmanship. The clothing is the hero.")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("hero_button_text","SHOP COLLECTION")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("hero_button_link","/products")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("hero_image","/images/hero-banner.svg")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("announcement_image","")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("announcement_link","")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("footer_about","Minimalist apparel, impeccable craftsmanship. The clothing is the hero.")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("footer_instagram","")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("footer_twitter","")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("featured_products","")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("new_arrivals_count","8")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("size_chart_image","")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("footer_trust_1_title","FAST DISPATCH")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("footer_trust_1_text","Dispatched in 24 hours. Free express shipping.")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("footer_trust_2_title","3-DAY EXCHANGE")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("footer_trust_2_text","Hassle-free size exchange guarantee.")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("footer_trust_3_title","LUXURY PACKAGING")}catch{}
try{db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run("footer_trust_3_text","Rigid magnetic box on orders above ₹3,000.")}catch{}
console.log('DB ready')}
exports.getDb=()=>{if(!db)throw Error('DB not init');return db}