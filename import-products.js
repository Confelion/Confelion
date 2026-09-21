const fs = require('fs');
const csv = require('csv/sync');

const db = require('better-sqlite3')('confelion.db');

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handle TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    vendor TEXT,
    product_category TEXT,
    type TEXT,
    tags TEXT,
    published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    sku TEXT,
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    inventory_quantity INTEGER DEFAULT 0,
    inventory_policy TEXT DEFAULT 'deny',
    requires_shipping INTEGER DEFAULT 1,
    taxable INTEGER DEFAULT 1,
    barcode TEXT,
    cost_per_item DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS variant_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    position INTEGER DEFAULT 1,
    alt_text TEXT,
    FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    position INTEGER DEFAULT 1,
    alt_text TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`);

console.log('Database tables created.');

const csvContent = fs.readFileSync('products_export_1 (2).csv', 'utf-8');
const records = csv.parse(csvContent, { columns: true, skipComments: true });

console.log(`Total rows parsed: ${records.length}`);

let productCount = 0;
let variantCount = 0;
const productMap = new Map();

for (const row of records) {
  const handle = row.Handle ? row.Handle.trim() : '';
  const title = row.Title ? row.Title.trim() : '';
  const vendor = row.Vendor ? row.Vendor.trim() : '';
  const productCategory = row['Product Category'] ? row['Product Category'].trim() : '';
  const type = row.Type ? row.Type.trim() : '';
  const tags = row.Tags ? row.Tags.trim() : '';
  const published = row.Published === 'true' ? 1 : 0;

  if (!handle) continue;

  let productId;
  if (productMap.has(handle)) {
    productId = productMap.get(handle);
  } else {
    const productStmt = db.prepare(
      'INSERT OR IGNORE INTO products (handle, title, vendor, product_category, type, tags, published) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const productResult = productStmt.run(handle, title, vendor, productCategory, type, tags, published);
    productId = productResult.lastInsertRowid;
    productMap.set(handle, productId);
    productCount++;
  }

  // Extract option info
  const option1Name = row['Option1 Name'] ? row['Option1 Name'].trim() : '';
  const option1Value = row['Option1 Value'] ? row['Option1 Value'].trim() : '';
  const option2Name = row['Option2 Name'] ? row['Option2 Name'].trim() : '';
  const option2Value = row['Option2 Value'] ? row['Option2 Value'].trim() : '';
  const option3Name = row['Option3 Name'] ? row['Option3 Name'].trim() : '';
  const option3Value = row['Option3 Value'] ? row['Option3 Value'].trim() : '';

  if (option1Name) {
    const optionStmt = db.prepare('INSERT OR IGNORE INTO options (product_id, name, value) VALUES (?, ?, ?)');
    optionStmt.run(productId, option1Name, option1Value);
  }
  if (option2Name) {
    const optionStmt = db.prepare('INSERT OR IGNORE INTO options (product_id, name, value) VALUES (?, ?, ?)');
    optionStmt.run(productId, option2Name, option2Value);
  }
  if (option3Name) {
    const optionStmt = db.prepare('INSERT OR IGNORE INTO options (product_id, name, value) VALUES (?, ?, ?)');
    optionStmt.run(productId, option3Name, option3Value);
  }

  // Extract variant data from this row
  const variantSku = row['Variant SKU'] ? row['Variant SKU'].trim() : '';
  const variantPrice = row['Variant Price'] ? parseFloat(row['Variant Price']) : 0;
  const variantCompareAtPrice = row['Variant Compare At Price'] ? parseFloat(row['Variant Compare At Price']) : 0;
  const variantInventoryQty = row['Variant Inventory Qty'] ? parseInt(row['Variant Inventory Qty'], 10) : 0;
  const variantInventoryPolicy = row['Variant Inventory Policy'] ? row['Variant Inventory Policy'].trim() : 'deny';
  const variantRequiresShipping = row['Variant Requires Shipping'] === 'true' ? 1 : 0;
  const variantTaxable = row['Variant Taxable'] === 'true' ? 1 : 0;
  const barcode = row['Variant Barcode'] ? row['Variant Barcode'].trim() : '';
  const costPerItem = row['Cost per item'] ? parseFloat(row['Cost per item']) : 0;

  const variantStmt = db.prepare(
    'INSERT INTO variants (product_id, sku, price, compare_at_price, inventory_quantity, inventory_policy, requires_shipping, taxable, cost_per_item, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  variantStmt.run(productId, variantSku, variantPrice, variantCompareAtPrice, variantInventoryQty, variantInventoryPolicy, variantRequiresShipping, variantTaxable, costPerItem, 'active');
  variantCount++;

  // Extract product images from Body (HTML)
  const bodyHtml = row['Body (HTML)'] ? row['Body (HTML)'].trim() : '';

  function extractImageUrls(html) {
    const urls = [];
    const matches = html.match(/src="([^"]+)"/g) || [];
    for (const match of matches) {
      const url = match.replace('src="', '').replace('"', '');
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
    return urls;
  }

  function extractImageAlt(html) {
    const matches = html.match(/alt="([^"]+)"/g) || [];
    if (matches.length > 0) {
      return matches[0].replace('alt="', '').replace('"', '');
    }
    return '';
  }

  const productImages = extractImageUrls(bodyHtml);
  const productImageAlt = extractImageAlt(bodyHtml);

  for (let j = 0; j < productImages.length; j++) {
    const imgStmt = db.prepare(
      'INSERT OR IGNORE INTO product_images (product_id, image_url, position, alt_text) VALUES (?, ?, ?, ?)'
    );
    imgStmt.run(productId, productImages[j], j + 1, productImageAlt || `Product image ${j + 1}`);
  }

  productCount++;
  if (productCount % 10 === 0) {
    console.log(`Processed ${productCount} products...`);
  }
}

console.log(`Import complete: ${productCount} products, ${variantCount} variants imported.`);

db.close();