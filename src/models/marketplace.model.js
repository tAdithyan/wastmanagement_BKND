import mongoose from 'mongoose';

const { Schema } = mongoose;
const integer = { type: Number, min: 0, default: 0, validate: Number.isSafeInteger };
const money = { type: Number, min: 0, default: 0 };
const tierSchema = new Schema({
  minQuantity: { ...integer, min: 1, required: true },
  maxQuantity: { type: Number, default: null, min: 1, validate: v => v == null || Number.isSafeInteger(v) },
  pricePerCarton: { ...money, required: true },
}, { _id: false });
const variantSchema = new Schema({
  size: { type: String, required: true, trim: true },
  weightRange: String,
  sku: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
  piecesPerPack: { ...integer, min: 1, default: 1 },
  retailPrice: money,
  retailSalePrice: { type: Number, min: 0, default: null },
  stockPacks: integer,
  retailStock: integer,
  packsPerCarton: { ...integer, min: 1, default: 1 },
  wholesalePricePerPack: money,
  wholesaleCartonPrice: money,
  wholesaleStock: integer,
  minimumWholesaleQuantity: { ...integer, min: 1, default: 1 },
  wholesalePricingTiers: [tierSchema],
  lowStockThreshold: { ...integer, default: 10 },
});
const productSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true },
  brand: { type: String, trim: true },
  category: { type: Schema.Types.ObjectId, ref: 'MarketplaceCategory', required: true, index: true },
  shortDescription: String,
  description: String,
  images: [String],
  diaperType: String,
  sellingMode: { type: String, enum: ['retail', 'wholesale', 'both'], default: 'both' },
  inventoryStrategy: { type: String, enum: ['shared', 'separate'], default: 'shared' },
  sizes: [variantSchema],
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
}, { timestamps: true, optimisticConcurrency: true });
const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });
const cartItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'MarketplaceProduct', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  purchaseMode: { type: String, enum: ['retail', 'wholesale'], required: true },
  quantity: { ...integer, min: 1, required: true },
});
const cartSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  items: [cartItemSchema],
}, { timestamps: true, optimisticConcurrency: true });
const addressSchema = new Schema({
  fullName: String, phone: String, address: String, city: String, district: String, state: String, pincode: String,
}, { _id: false });
const businessSchema = new Schema({
  businessName: String, contactPerson: String, phone: String, email: String, GSTIN: String,
  billingAddress: String, shippingAddress: addressSchema,
}, { _id: false });
const orderItemSchema = new Schema({
  productId: Schema.Types.ObjectId, variantId: Schema.Types.ObjectId,
  productName: String, size: String, sku: String, image: String,
  purchaseMode: { type: String, enum: ['retail', 'wholesale'] },
  inventoryStrategy: String, stockField: String, stockUnits: Number,
  quantity: Number, piecesPerPack: Number, packsPerCarton: Number,
  unitPrice: Number, subtotal: Number, totalPacks: Number, totalPieces: Number,
  applicableTier: tierSchema,
}, { _id: false });
export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const orderSchema = new Schema({
  orderId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  idempotencyKey: { type: String, required: true },
  items: [orderItemSchema],
  orderType: { type: String, enum: ['retail', 'wholesale', 'mixed'] },
  subtotal: money, discount: money, deliveryCharge: money, tax: money, totalAmount: money,
  shippingAddress: addressSchema,
  businessInfo: businessSchema,
  paymentMethod: { type: String, enum: ['cod', 'wallet'], default: 'wallet' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'cancelled', 'refunded'], default: 'pending' },
  orderStatus: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
  statusHistory: [{ status: String, at: Date, actor: Schema.Types.ObjectId }],
}, { timestamps: true, optimisticConcurrency: true });
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
const counterSchema = new Schema({ _id: String, value: { type: Number, default: 0 } });

export const Product = mongoose.models.MarketplaceProduct || mongoose.model('MarketplaceProduct', productSchema);
export const Category = mongoose.models.MarketplaceCategory || mongoose.model('MarketplaceCategory', categorySchema);
export const Cart = mongoose.models.MarketplaceCart || mongoose.model('MarketplaceCart', cartSchema);
export const Order = mongoose.models.MarketplaceOrder || mongoose.model('MarketplaceOrder', orderSchema);
export const Counter = mongoose.models.MarketplaceCounter || mongoose.model('MarketplaceCounter', counterSchema);
const adjustmentSchema = new Schema({
  productId: Schema.Types.ObjectId, variantId: Schema.Types.ObjectId, field: String, delta: Number,
  reason: String, actor: Schema.Types.ObjectId, idempotencyKey: String,
}, { timestamps: true });
adjustmentSchema.index({ actor: 1, idempotencyKey: 1 }, { unique: true });
export const StockAdjustment = mongoose.models.MarketplaceStockAdjustment || mongoose.model('MarketplaceStockAdjustment', adjustmentSchema);
