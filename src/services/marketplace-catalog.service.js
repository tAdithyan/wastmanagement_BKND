import mongoose from 'mongoose';
import ApiError from '../utils/apiError.js';
import { Product, Category } from '../models/marketplace.model.js';
import { money, positiveInteger, validateTiers, stockFor } from './marketplace-pricing.js';

export const objectId = value => {
  if (!mongoose.isValidObjectId(value) || typeof value !== 'string') throw new ApiError(400, 'Invalid identifier');
  return value;
};
export const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const pageOptions = query => ({ page: Math.max(1, Math.min(100000, Number.parseInt(query.page) || 1)), limit: Math.max(1, Math.min(50, Number.parseInt(query.limit) || 20)) });
const text = (value, max = 5000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const amount = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000000) throw new ApiError(400, `${label} must be a valid nonnegative amount`);
  return money(value);
};
const stock = (value = 0) => { if (!Number.isSafeInteger(value) || value < 0 || value > 100000000) throw new ApiError(400, 'Stock must be a nonnegative whole number'); return value; };

export async function saveProduct(body, id) {
  const product = id ? await Product.findById(objectId(id)) : new Product();
  if (!product) throw new ApiError(404, 'Product not found');
  if (id && body.__v !== product.__v) throw new ApiError(409, 'Product changed. Reload before saving.');
  const category = await Category.findById(objectId(body.category));
  if (!category || !category.active) throw new ApiError(400, 'Select an active category');
  const mode = body.sellingMode;
  if (!['retail', 'wholesale', 'both'].includes(mode)) throw new ApiError(400, 'Invalid selling mode');
  const strategy = body.inventoryStrategy || 'shared';
  if (!['shared', 'separate'].includes(strategy)) throw new ApiError(400, 'Invalid inventory strategy');
  if (id && strategy !== product.inventoryStrategy) throw new ApiError(400, 'Inventory strategy cannot change after creation. Archive this product and create a new one.');
  if (!Array.isArray(body.sizes) || !body.sizes.length || body.sizes.length > 30) throw new ApiError(400, 'Add between 1 and 30 variants');
  const seen = new Set();
  const variants = body.sizes.map(v => {
    const old = v._id ? product.sizes.id(objectId(v._id)) : null;
    if (v._id && !old) throw new ApiError(400, 'Unknown variant');
    const size = text(v.size, 40), sku = text(v.sku, 100);
    if (!size || !sku || seen.has(size.toLowerCase()) || seen.has('sku:' + sku.toLowerCase())) throw new ApiError(400, 'Each size and SKU must be present and unique within the product');
    seen.add(size.toLowerCase()); seen.add('sku:' + sku.toLowerCase());
    const packsPerCarton = positiveInteger(v.packsPerCarton ?? 1, 'Packs per carton');
    const minimumWholesaleQuantity = positiveInteger(v.minimumWholesaleQuantity ?? 1, 'Wholesale MOQ');
    if (v.wholesalePricingTiers != null && (!Array.isArray(v.wholesalePricingTiers) || v.wholesalePricingTiers.length > 20)) throw new ApiError(400, 'Use at most 20 wholesale pricing tiers');
    const tiers = (v.wholesalePricingTiers || []).map(t => ({ minQuantity: t.minQuantity, maxQuantity: t.maxQuantity ?? null, pricePerCarton: amount(t.pricePerCarton, 'Tier price') }));
    validateTiers(tiers, minimumWholesaleQuantity);
    const retailPrice = amount(v.retailPrice ?? 0, 'Retail price');
    const retailSalePrice = v.retailSalePrice == null ? null : amount(v.retailSalePrice, 'Sale price');
    const wholesaleCartonPrice = amount(v.wholesaleCartonPrice ?? 0, 'Carton price');
    if (mode !== 'wholesale' && (retailPrice <= 0 || (retailSalePrice != null && (retailSalePrice <= 0 || retailSalePrice > retailPrice)))) throw new ApiError(400, 'Retail price must be positive; sale price cannot exceed it');
    if (mode !== 'retail' && wholesaleCartonPrice <= 0) throw new ApiError(400, 'Wholesale carton price must be positive');
    return {
      _id: old?._id || new mongoose.Types.ObjectId(), size, sku, active: v.active !== false, weightRange: text(v.weightRange, 100),
      piecesPerPack: positiveInteger(v.piecesPerPack, 'Pieces per pack'), packsPerCarton, minimumWholesaleQuantity,
      retailPrice, retailSalePrice, wholesaleCartonPrice, wholesalePricePerPack: money(wholesaleCartonPrice / packsPerCarton), wholesalePricingTiers: tiers,
      // Existing stock is adjusted only through the atomic inventory API.
      stockPacks: old?.stockPacks ?? stock(v.stockPacks), retailStock: old?.retailStock ?? stock(v.retailStock), wholesaleStock: old?.wholesaleStock ?? stock(v.wholesaleStock),
      lowStockThreshold: stock(v.lowStockThreshold ?? 10),
    };
  });
  for (const old of product.sizes) if (!variants.some(v => String(v._id) === String(old._id))) variants.push({ ...old.toObject(), active: false });
  if (!variants.some(v => v.active)) throw new ApiError(400, 'Keep at least one active variant');
  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length > 10 || images.some(url => typeof url !== 'string' || !/^https:\/\/[^\s]+$/i.test(url) || url.length > 2000)) throw new ApiError(400, 'Use up to 10 HTTPS image URLs');
  const name = text(body.name, 180);
  const slug = slugify(body.slug || name);
  if (!name || !slug) throw new ApiError(400, 'Product name and slug are required');
  if (!['active', 'draft', 'archived'].includes(body.status)) throw new ApiError(400, 'Invalid product status');
  Object.assign(product, { name, slug, brand: text(body.brand, 100), category: category._id, sellingMode: mode, inventoryStrategy: strategy,
    shortDescription: text(body.shortDescription, 300), description: text(body.description), diaperType: text(body.diaperType, 100), images,
    sizes: variants, featured: body.featured === true, status: body.status });
  await product.save();
  return product;
}
export function publicProduct(product) {
  const p = product.toObject ? product.toObject() : product;
  return { ...p, sizes: p.sizes.filter(v => v.active !== false).map(v => ({ ...v, availableRetailPacks: stockFor(p, v, 'retail'), availableWholesaleCartons: stockFor(p, v, 'wholesale') })) };
}
export async function listProducts(query, admin = false) {
  const { page, limit } = pageOptions(query);
  const filter = admin ? {} : { status: 'active', category: { $in: await Category.find({ active: true }).distinct('_id') } };
  if (query.category) {
    const categoryId = objectId(query.category);
    if (!admin && !await Category.exists({ _id: categoryId, active: true })) return { items: [], page, pages: 0, total: 0 };
    filter.category = categoryId;
  }
  if (['retail', 'wholesale'].includes(query.mode)) filter.sellingMode = { $in: [query.mode, 'both'] };
  if (admin && ['active', 'draft', 'archived'].includes(query.status)) filter.status = query.status;
  if (query.featured === 'true') filter.featured = true;
  if (typeof query.search === 'string' && query.search.trim()) {
    const search = query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: search, $options: 'i' } }, { brand: { $regex: search, $options: 'i' } }];
  }
  const [items, total] = await Promise.all([Product.find(filter).populate('category').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), Product.countDocuments(filter)]);
  return { items: admin ? items : items.map(publicProduct), page, pages: Math.ceil(total / limit), total };
}
