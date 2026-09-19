import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Category, Product, Cart, Order, Counter, StockAdjustment } from '../src/models/marketplace.model.js';
import { saveProduct } from '../src/services/marketplace-catalog.service.js';
import { changeCart, checkoutQuote, placeOrder, changeOrderStatus, orderDetail, getCart } from '../src/services/marketplace-order.service.js';
import { adjustInventory, marketplaceDashboard } from '../src/services/marketplace-admin.service.js';

const uri = process.env.MARKETPLACE_TEST_MONGO_URI;
test('real replica-set checkout: pricing, mixed stock, concurrency, idempotency, cancellation and authorization', { skip: !uri }, async () => {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(uri)) throw new Error('Integration tests require an isolated local MongoDB replica set');
  const dbName = 'marketplace_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect(uri, { dbName });
  try {
    await Promise.all([Category.init(), Product.init(), Cart.init(), Order.init(), Counter.init(), StockAdjustment.init()]);
    const category = await Category.create({ name: 'Baby Diapers', slug: 'baby-diapers' });
    const create = (stock = 100, strategy = 'shared') => saveProduct({
      name: 'Test diapers ' + randomUUID(), category: String(category._id), brand: 'Test', sellingMode: 'both', inventoryStrategy: strategy, status: 'active', images: [],
      sizes: [{ size: 'M', sku: 'TEST-M', piecesPerPack: 40, packsPerCarton: 8, retailPrice: 499, retailSalePrice: 449, wholesaleCartonPrice: 3120, minimumWholesaleQuantity: 5, stockPacks: stock, retailStock: stock, wholesaleStock: 10, wholesalePricingTiers: [{ minQuantity: 5, maxQuantity: 9, pricePerCarton: 3120 }, { minQuantity: 10, maxQuantity: null, pricePerCarton: 3000 }] }],
    });
    const user = () => new mongoose.Types.ObjectId();
    const body = { shippingAddress: { fullName: 'Test Customer', phone: '+919876543210', address: 'Test house', city: 'Kochi', district: 'Ernakulam', state: 'Kerala', pincode: '682001' }, paymentMethod: 'cod' };
    const add = (u, p, quantity, purchaseMode = 'retail') => changeCart(u, { productId: String(p._id), variantId: String(p.sizes[0]._id), quantity, purchaseMode, unitPrice: 1 });
    const p = await create(), u = user();
    await add(u, p, 2); await add(u, p, 5, 'wholesale');
    const quote = await checkoutQuote(u, body);
    assert.equal(quote.subtotal, 16498); assert.equal(quote.orderType, 'mixed');
    const idempotency = randomUUID();
    const orders = await Promise.all([placeOrder(u, { ...body, quoteToken: quote.quoteToken, totalAmount: 1 }, idempotency), placeOrder(u, { ...body, quoteToken: quote.quoteToken }, idempotency)]);
    assert.equal(String(orders[0]._id), String(orders[1]._id));
    assert.equal(await Order.countDocuments({ userId: u }), 1);
    assert.equal((await Product.findById(p._id)).sizes[0].stockPacks, 58);
    assert.equal((await getCart(u)).items.length, 0);
    assert.equal(orders[0].subtotal, 16498);
    await assert.rejects(orderDetail(String(orders[0]._id), user()), /not found/);
    await assert.rejects(changeOrderStatus(String(orders[0]._id), user(), 'cancelled'), /not found/);
    await Promise.all([changeOrderStatus(String(orders[0]._id), u, 'cancelled'), changeOrderStatus(String(orders[0]._id), u, 'cancelled')]);
    assert.equal((await Product.findById(p._id)).sizes[0].stockPacks, 100);

    const scarce = await create(1), a = user(), b = user();
    await add(a, scarce, 1); await add(b, scarce, 1);
    const qa = await checkoutQuote(a, body), qb = await checkoutQuote(b, body);
    const results = await Promise.allSettled([placeOrder(a, { ...body, quoteToken: qa.quoteToken }, randomUUID()), placeOrder(b, { ...body, quoteToken: qb.quoteToken }, randomUUID())]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await Product.findById(scarce._id)).sizes[0].stockPacks, 0);

    const mixed = await create(41), m = user();
    await add(m, mixed, 5, 'wholesale');
    await assert.rejects(add(m, mixed, 2), /shared stock/);
    await assert.rejects(add(user(), mixed, 4, 'wholesale'), /Minimum/);
    const separate = await create(2, 'separate'), su = user();
    await add(su, separate, 2); await add(su, separate, 5, 'wholesale');
    const sq = await checkoutQuote(su, body);
    const so = await placeOrder(su, { ...body, quoteToken: sq.quoteToken }, randomUUID());
    const sp = await Product.findById(separate._id);
    assert.equal(sp.sizes[0].retailStock, 0); assert.equal(sp.sizes[0].wholesaleStock, 5);
    const actor = user();
    for (const status of ['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered']) await changeOrderStatus(String(so._id), actor, status, true);
    await assert.rejects(changeOrderStatus(String(so._id), su, 'cancelled'), /cannot/);
    assert.equal((await Order.findById(so._id)).paymentStatus, 'paid');

    const mutable = await create(20), mu = user(); await add(mu, mutable, 1);
    const mq = await checkoutQuote(mu, body);
    await Product.updateOne({ _id: mutable._id }, { $set: { 'sizes.0.retailSalePrice': 450 }, $inc: { __v: 1 } });
    await assert.rejects(placeOrder(mu, { ...body, quoteToken: mq.quoteToken }, randomUUID()), /prices changed/);
    assert.equal((await Product.findById(mutable._id)).sizes[0].stockPacks, 20);
    const stockKey = randomUUID();
    await adjustInventory(String(mutable._id), { variantId: String(mutable.sizes[0]._id), field: 'stockPacks', delta: 5, reason: 'Delivery received' }, actor, stockKey);
    await adjustInventory(String(mutable._id), { variantId: String(mutable.sizes[0]._id), field: 'stockPacks', delta: 5, reason: 'Retry' }, actor, stockKey);
    assert.equal((await Product.findById(mutable._id)).sizes[0].stockPacks, 25);
    await assert.rejects(adjustInventory(String(mutable._id), { variantId: String(mutable.sizes[0]._id), field: 'stockPacks', delta: -26, reason: 'Invalid' }, actor, randomUUID()), /negative/);
    const overview = await marketplaceDashboard();
    assert.ok(overview.totalSales > 0); assert.ok(overview.retailRevenue > 0); assert.ok(overview.wholesaleRevenue > 0);
  } finally {
    // Only the unique database created by this test is removed.
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
