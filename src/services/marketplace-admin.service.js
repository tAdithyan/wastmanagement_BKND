import ApiError from '../utils/apiError.js';
import { Product, Order, StockAdjustment } from '../models/marketplace.model.js';
import { objectId, pageOptions } from './marketplace-catalog.service.js';
import { transaction } from './marketplace-order.service.js';

const inventoryStages = [
  { $unwind: '$sizes' }, { $match: { 'sizes.active': true } },
  { $set: {
    retailPacks: { $cond: [{ $eq: ['$inventoryStrategy', 'shared'] }, '$sizes.stockPacks', '$sizes.retailStock'] },
    wholesaleCartons: { $cond: [{ $eq: ['$inventoryStrategy', 'shared'] }, { $floor: { $divide: ['$sizes.stockPacks', '$sizes.packsPerCarton'] } }, '$sizes.wholesaleStock'] },
  } },
  { $set: { lowStock: { $cond: [{ $eq: ['$inventoryStrategy', 'shared'] }, { $lte: ['$sizes.stockPacks', '$sizes.lowStockThreshold'] }, { $or: [
    { $and: [{ $ne: ['$sellingMode', 'wholesale'] }, { $lte: ['$retailPacks', '$sizes.lowStockThreshold'] }] },
    { $and: [{ $ne: ['$sellingMode', 'retail'] }, { $lte: ['$wholesaleCartons', '$sizes.lowStockThreshold'] }] },
  ] }] } } },
];
export async function inventory(query) {
  const { page, limit } = pageOptions(query);
  const stages = [...inventoryStages];
  if (query.low === 'true') stages.push({ $match: { lowStock: true, status: 'active' } });
  const [result] = await Product.aggregate([...stages, { $sort: { name: 1, 'sizes.size': 1, _id: 1 } }, { $facet: {
    items: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { name: 1, status: 1, inventoryStrategy: 1, sellingMode: 1, sizes: 1, retailPacks: 1, wholesaleCartons: 1, lowStock: 1 } }], total: [{ $count: 'count' }],
  } }]);
  const total = result?.total[0]?.count || 0;
  return { items: result?.items || [], total, page, pages: Math.ceil(total / limit) };
}
export async function adjustInventory(productId, body, actor, key) {
  objectId(productId); objectId(body.variantId);
  if (!Number.isSafeInteger(body.delta) || body.delta === 0 || Math.abs(body.delta) > 1000000) throw new ApiError(400, 'Stock adjustment must be a nonzero whole number (maximum 1,000,000 units)');
  if (typeof body.reason !== 'string' || !body.reason.trim()) throw new ApiError(400, 'Enter a reason for this stock adjustment');
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new ApiError(400, 'An Idempotency-Key is required');
  await StockAdjustment.init();
  const previous = await StockAdjustment.findOne({ actor, idempotencyKey: key });
  if (previous) return previous;
  try {
    return await transaction(async session => {
      const previous = await StockAdjustment.findOne({ actor, idempotencyKey: key }).session(session);
      if (previous) return previous;
      const product = await Product.findById(productId).session(session);
      if (!product || !product.sizes.id(body.variantId)) throw new ApiError(404, 'Product size not found');
      const allowed = product.inventoryStrategy === 'shared' ? ['stockPacks'] : ['retailStock', 'wholesaleStock'];
      if (!allowed.includes(body.field)) throw new ApiError(400, 'Stock unit does not match the inventory strategy');
      const result = await Product.updateOne({ _id: productId, sizes: { $elemMatch: { _id: body.variantId, [body.field]: { $gte: Math.max(0, -body.delta), $lte: 100000000 - Math.max(0, body.delta) } } } }, { $inc: { [`sizes.$.${body.field}`]: body.delta, __v: 1 } }, { session });
      if (result.modifiedCount !== 1) throw new ApiError(409, 'Stock cannot become negative or exceed the inventory limit');
      const [record] = await StockAdjustment.create([{ productId, variantId: body.variantId, field: body.field, delta: body.delta, reason: body.reason.trim().slice(0, 500), actor, idempotencyKey: key }], { session });
      return record;
    });
  } catch (error) {
    if (error.code === 11000) { const prior = await StockAdjustment.findOne({ actor, idempotencyKey: key }); if (prior) return prior; }
    throw error;
  }
}
export async function marketplaceDashboard() {
  const now = new Date(), indiaOffset = 330 * 60000;
  const local = new Date(now.getTime() + indiaOffset);
  const today = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - indiaOffset);
  const [counts, sales, topSelling, recentOrders, low] = await Promise.all([
    Order.aggregate([{ $group: { _id: null, todayOrders: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, 1, 0] } },
      retailOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'retail'] }, 1, 0] } }, wholesaleOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'wholesale'] }, 1, 0] } },
      mixedOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'mixed'] }, 1, 0] } }, pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] } },
      totalSales: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] } },
    } }]),
    Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $unwind: '$items' }, { $group: { _id: '$items.purchaseMode', revenue: { $sum: '$items.subtotal' } } }]),
    Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $unwind: '$items' }, { $group: { _id: '$items.productId', name: { $first: '$items.productName' }, packs: { $sum: '$items.totalPacks' }, pieces: { $sum: '$items.totalPieces' }, revenue: { $sum: '$items.subtotal' } } }, { $sort: { revenue: -1 } }, { $limit: 10 }]),
    Order.find().sort({ createdAt: -1 }).limit(8), inventory({ low: 'true', limit: 10 }),
  ]);
  return { ...(counts[0] || {}), retailRevenue: sales.find(s => s._id === 'retail')?.revenue || 0, wholesaleRevenue: sales.find(s => s._id === 'wholesale')?.revenue || 0, lowStockProducts: low.total, lowStock: low.items, recentOrders, topSelling };
}
