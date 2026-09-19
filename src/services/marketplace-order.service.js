import mongoose from 'mongoose';
import User from '../models/user.model.js';
import { createHash } from 'node:crypto';
import ApiError from '../utils/apiError.js';
import { Cart, Product, Category, Order, Counter } from '../models/marketplace.model.js';
import { objectId, pageOptions } from './marketplace-catalog.service.js';
import { money, priceLine, positiveInteger } from './marketplace-pricing.js';
import { calculateDelivery } from './marketplace-delivery.service.js';

export async function transaction(work) {
  await Promise.all([Cart.init(), Product.init(), Order.init(), Counter.init()]);
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session)); }
  catch (error) {
    if (error.code === 20 || /Transaction numbers are only allowed/.test(error.message)) throw new ApiError(503, 'Marketplace checkout requires a MongoDB replica set. Contact your administrator.');
    throw error;
  } finally { await session.endSession(); }
}
export async function priceCart(cart, session = null, strict = false) {
  const items = [], stocks = new Map();
  for (const item of cart?.items || []) {
    let product;
    try {
      product = await Product.findById(item.productId).session(session);
      if (!product || !await Category.exists({ _id: product.category, active: true }).session(session)) throw new ApiError(400, 'Product or category is unavailable');
      const line = priceLine(product, item.variantId, item.purchaseMode, item.quantity);
      const key = `${line.productId}:${line.variantId}:${line.stockField}`;
      const total = (stocks.get(key) || 0) + line.stockUnits;
      const available = product.sizes.id(item.variantId)[line.stockField];
      if (total > available) throw new ApiError(409, 'Combined retail and wholesale quantities exceed the shared stock');
      stocks.set(key, total);
      items.push({ ...line, _id: item._id });
    } catch (error) {
      if (strict || !error.statusCode || error.statusCode >= 500) throw error;
      items.push({ ...item.toObject(), productName: product?.name || 'Unavailable item', image: product?.images?.[0], size: product?.sizes.id(item.variantId)?.size, error: error.message });
    }
  }
  const modes = new Set(items.map(i => i.purchaseMode));
  const subtotal = money(items.reduce((sum, item) => sum + (item.subtotal || 0), 0));
  if (!Number.isSafeInteger(Math.round(subtotal * 100))) throw new ApiError(400, 'Order total exceeds the supported limit');
  return { items, subtotal, orderType: modes.size > 1 ? 'mixed' : items[0]?.purchaseMode || 'retail', canCheckout: items.length > 0 && items.every(i => !i.error) };
}
export async function getCart(userId) { return priceCart(await Cart.findOne({ userId })); }
export async function changeCart(userId, body, itemId, remove = false) {
  return transaction(async session => {
    let cart = await Cart.findOne({ userId }).session(session);
    if (!cart) {
      if (itemId) throw new ApiError(404, 'Cart item not found');
      cart = new Cart({ userId, items: [] });
    }
    if (itemId) {
      const item = cart.items.id(objectId(itemId));
      if (!item) throw new ApiError(404, 'Cart item not found');
      if (remove) item.deleteOne();
      else item.quantity = positiveInteger(body.quantity, 'Quantity');
    } else {
      const productId = objectId(body.productId), variantId = objectId(body.variantId);
      const quantity = positiveInteger(body.quantity, 'Quantity');
      const existing = cart.items.find(i => String(i.productId) === productId && String(i.variantId) === variantId && i.purchaseMode === body.purchaseMode);
      if (existing) existing.quantity = positiveInteger(existing.quantity + quantity, 'Quantity');
      else {
        if (cart.items.length >= 50) throw new ApiError(400, 'A cart can contain up to 50 different items');
        cart.items.push({ productId, variantId, purchaseMode: body.purchaseMode, quantity });
      }
    }
    // Removal remains possible even if another item has become unavailable.
    const result = await priceCart(cart, session, !remove);
    await cart.save({ session });
    return result;
  });
}
export function validateAddress(input) {
  const address = {};
  for (const key of ['fullName', 'phone', 'address', 'city', 'district', 'state', 'pincode']) {
    address[key] = typeof input?.[key] === 'string' ? input[key].trim() : '';
    if (!address[key] || address[key].length > 500) throw new ApiError(400, `Delivery ${key} is required (maximum 500 characters)`);
  }
  if (!/^[1-9]\d{5}$/.test(address.pincode) || !/^\+?[\d\s()-]{8,20}$/.test(address.phone)) throw new ApiError(400, 'Enter a valid phone number and six-digit PIN code');
  return address;
}
function businessInfo(input) {
  if (!input) return undefined;
  const result = {};
  for (const key of ['businessName', 'contactPerson', 'phone', 'email', 'GSTIN', 'billingAddress']) {
    if (typeof input[key] === 'string') result[key] = input[key].trim().slice(0, 500);
  }
  return result;
}
async function buildQuote(userId, body, session = null) {
  if (body.paymentMethod && body.paymentMethod !== 'wallet') throw new ApiError(400, 'Please pay using your wallet');
  const shippingAddress = validateAddress(body.shippingAddress);
  const cart = await Cart.findOne({ userId }).session(session);
  const priced = await priceCart(cart, session, true);
  if (!priced.items.length) throw new ApiError(400, 'Your cart is empty');
  const totals = calculateDelivery({ ...priced, shippingAddress });
  const quote = { ...priced, ...totals, totalAmount: money(priced.subtotal - totals.discount + totals.deliveryCharge + totals.tax), shippingAddress, paymentMethod: 'wallet' };
  if (!Number.isSafeInteger(Math.round(quote.totalAmount * 100))) throw new ApiError(400, 'Order total exceeds the supported limit');
  const quoteToken = createHash('sha256').update(JSON.stringify({ items: quote.items, subtotal: quote.subtotal, totalAmount: quote.totalAmount, shippingAddress })).digest('hex');
  const user = await User.findById(userId).select('wallet').session(session);
  if (!user) throw new ApiError(404, 'Customer not found');
  return { cart, quote: { ...quote, quoteToken, walletBalance: money(user.wallet || 0), walletShortfall: money(Math.max(0, quote.totalAmount - (user.wallet || 0))) } };
}
export async function checkoutQuote(userId, body) { return (await buildQuote(userId, body)).quote; }
export async function placeOrder(userId, body, key) {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new ApiError(400, 'A valid Idempotency-Key header is required');
  await Order.init();
  const previous = await Order.findOne({ userId, idempotencyKey: key });
  if (previous) return previous;
  try {
    return await transaction(async session => {
      const existing = await Order.findOne({ userId, idempotencyKey: key }).session(session);
      if (existing) return existing;
      const { cart, quote } = await buildQuote(userId, body, session);
      if (body.quoteToken !== quote.quoteToken) throw new ApiError(409, 'Your cart or prices changed. Review the updated totals before placing the order.');
      for (const item of quote.items) {
        const field = `sizes.$.${item.stockField}`;
        const result = await Product.updateOne({ _id: item.productId, status: 'active', sizes: { $elemMatch: { _id: item.variantId, [item.stockField]: { $gte: item.stockUnits }, active: true } } }, { $inc: { [field]: -item.stockUnits, __v: 1 } }, { session });
        if (result.modifiedCount !== 1) throw new ApiError(409, 'Stock changed. Refresh your cart and try again.');
      }
      const debit = await User.updateOne({ _id: userId, wallet: { $gte: quote.totalAmount } }, { $inc: { wallet: -quote.totalAmount } }, { session });
      if (debit.matchedCount !== 1) throw new ApiError(409, 'Insufficient wallet balance. Add money to your wallet and review your order again.');
      const year = new Date().getUTCFullYear();
      const counter = await Counter.findOneAndUpdate({ _id: `orders-${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true, session });
      const [order] = await Order.create([{ ...quote, paymentStatus: 'paid', orderId: `ORD-${year}-${String(counter.value).padStart(6, '0')}`, userId, idempotencyKey: key, businessInfo: businessInfo(body.businessInfo), statusHistory: [{ status: 'pending', at: new Date(), actor: userId }] }], { session });
      const cleared = await Cart.deleteOne({ _id: cart._id, __v: cart.__v }, { session });
      if (cleared.deletedCount !== 1) throw new ApiError(409, 'Your cart changed. Try again.');
      return order;
    });
  } catch (error) {
    if (error.code === 11000) {
      const previous = await Order.findOne({ userId, idempotencyKey: key });
      if (previous) return previous;
    }
    throw error;
  }
}
const transitions = { pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'], processing: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: ['out_for_delivery'], out_for_delivery: ['delivered'], delivered: [], cancelled: [] };
export function canTransition(from, to, admin) { return admin ? transitions[from]?.includes(to) : ['pending', 'confirmed'].includes(from) && to === 'cancelled'; }
export async function changeOrderStatus(id, userId, status, admin = false, codCollected = false) {
  return transaction(async session => {
    const order = await Order.findOne({ _id: objectId(id), ...(admin ? {} : { userId }) }).session(session);
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.orderStatus === status) return order;
    if (!canTransition(order.orderStatus, status, admin)) throw new ApiError(400, 'This order cannot move to the requested status');
    if (status === 'delivered' && order.paymentMethod === 'cod' && !codCollected) throw new ApiError(400, 'Confirm Cash on Delivery collection before marking delivered');
    if (status === 'cancelled') {
      for (const item of order.items) {
        const updated = await Product.updateOne({ _id: item.productId, 'sizes._id': item.variantId }, { $inc: { [`sizes.$.${item.stockField}`]: item.stockUnits, __v: 1 } }, { session });
        if (updated.modifiedCount !== 1) throw new ApiError(409, 'Inventory could not be restored. Contact your administrator.');
      }
      if (order.paymentMethod === 'wallet' && order.paymentStatus === 'paid') {
        const refund = await User.updateOne({ _id: order.userId }, { $inc: { wallet: order.totalAmount } }, { session });
        if (refund.matchedCount !== 1) throw new ApiError(409, 'Wallet refund could not be completed');
        order.paymentStatus = 'refunded';
      } else order.paymentStatus = 'cancelled';
    }
    // COD collection must be confirmed by the administrator when marking delivered.
    if (status === 'delivered') order.paymentStatus = 'paid';
    order.orderStatus = status;
    order.statusHistory.push({ status, at: new Date(), actor: userId });
    await order.save({ session });
    return order;
  });
}
export async function listOrders(userId, query, admin = false) {
  const { page, limit } = pageOptions(query);
  const filter = admin ? {} : { userId };
  if (['retail', 'wholesale', 'mixed'].includes(query.type)) filter.orderType = query.type;
  if (Object.hasOwn(transitions, query.status)) filter.orderStatus = query.status;
  const [items, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), Order.countDocuments(filter)]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}
export async function orderDetail(id, userId, admin = false) {
  const order = await Order.findOne({ _id: objectId(id), ...(admin ? {} : { userId }) });
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
}
