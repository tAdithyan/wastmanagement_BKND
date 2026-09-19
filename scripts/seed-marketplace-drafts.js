import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { Category, Product } from '../src/models/marketplace.model.js';
import { saveProduct, slugify } from '../src/services/marketplace-catalog.service.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const samples = [
  { name: 'Sample Baby Tape Diapers', category: 'Baby Diapers', diaperType: 'Tape diapers', size: 'M', pieces: 40, packs: 8, retail: 499, sale: 449, carton: 3120 },
  { name: 'Sample Baby Diaper Pants', category: 'Diaper Pants', diaperType: 'Diaper pants', size: 'L', pieces: 36, packs: 8, retail: 549, sale: 499, carton: 3520 },
  { name: 'Sample Newborn Diapers', category: 'Newborn Diapers', diaperType: 'Newborn tape diapers', size: 'NB', pieces: 24, packs: 12, retail: 299, sale: 269, carton: 2760 },
  { name: 'Sample Adult Diapers', category: 'Adult Diapers', diaperType: 'Adult tape diapers', size: 'L', pieces: 10, packs: 10, retail: 499, sale: 449, carton: 3900 },
  { name: 'Sample Disposable Underpads', category: 'Underpads', diaperType: 'Underpads', size: '60 × 90 cm', pieces: 10, packs: 10, retail: 349, sale: 299, carton: 2500 },
];

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI must be configured in Backend/.env');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  await Promise.all([Category.init(), Product.init()]);
  for (const [index, sample] of samples.entries()) {
    const slug = slugify(sample.name);
    const existing = await Product.findOne({ slug });
    if (existing) {
      console.log(JSON.stringify({ action: 'already exists; unchanged', name: existing.name, status: existing.status }));
      continue;
    }
    const category = await Category.findOneAndUpdate(
      { slug: slugify(sample.category) },
      { $setOnInsert: { name: sample.category, active: true } },
      { upsert: true, new: true, runValidators: true }
    );
    if (!category.active) throw new Error(`Category '${sample.category}' is inactive; no changes made to it`);
    const product = await saveProduct({
      name: sample.name, slug, brand: 'Sample brand', category: String(category._id),
      shortDescription: 'Sample draft — replace the example details, prices and photos before publishing.',
      description: 'Demonstration product only. Pack contents, sizes and prices are illustrative. Confirm the actual supplier specifications, upload the correct product photos, and add real inventory before making this product active.',
      images: [], diaperType: sample.diaperType, sellingMode: 'both', inventoryStrategy: 'shared',
      status: 'draft', featured: false,
      sizes: [{
        size: sample.size, sku: `SAMPLE-${String(index + 1).padStart(3, '0')}`, weightRange: '',
        piecesPerPack: sample.pieces, packsPerCarton: sample.packs,
        retailPrice: sample.retail, retailSalePrice: sample.sale,
        wholesaleCartonPrice: sample.carton, minimumWholesaleQuantity: 5,
        stockPacks: 0, retailStock: 0, wholesaleStock: 0, lowStockThreshold: 10,
        wholesalePricingTiers: [
          { minQuantity: 5, maxQuantity: 9, pricePerCarton: sample.carton },
          { minQuantity: 10, maxQuantity: null, pricePerCarton: Math.round(sample.carton * .95) },
        ],
      }],
    });
    console.log(JSON.stringify({ action: 'created', name: product.name, status: product.status, stockPacks: product.sizes[0].stockPacks }));
  }
  const saved = await Product.find({ slug: { $in: samples.map(s => slugify(s.name)) } }).select('name status sizes.stockPacks').lean();
  console.log(JSON.stringify({ verifiedProducts: saved.length, products: saved.map(p => ({ name: p.name, status: p.status, stockPacks: p.sizes.map(v => v.stockPacks) })) }));
}

try { await main(); }
catch (error) {
  // Do not print connection strings or provider credentials on failure.
  console.error(error.name === 'MongoServerSelectionError' ? 'Database connection failed. Check network access and MongoDB configuration.' : error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[database URI redacted]'));
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
