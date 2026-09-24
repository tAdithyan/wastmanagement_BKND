import { Router, raw } from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { requireMarketplaceAdmin } from '../middlewares/marketplace.middleware.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import { Product, Category } from '../models/marketplace.model.js';
import { listProducts, saveProduct, objectId, slugify, publicProduct } from '../services/marketplace-catalog.service.js';
import { priceLine } from '../services/marketplace-pricing.js';
import { getCart, changeCart, checkoutQuote, placeOrder, listOrders, orderDetail, orderByQrToken, changeOrderStatus } from '../services/marketplace-order.service.js';
import { inventory, adjustInventory, marketplaceDashboard } from '../services/marketplace-admin.service.js';
import { MAX_PRODUCT_IMAGE_BYTES, uploadProductImage } from '../services/marketplace-image.service.js';

export const marketplace = Router();
export const marketplaceAdmin = Router();
const activeUser = (req, res, next) => req.user.is_active === false ? next(new ApiError(403, 'Account is inactive')) : next();
const orderScannerAccess = (req, res, next) => ['ROL_1', 'ROL_2', 'ROL_3', 'ROL_4', 'SuperAdmin', 'Admin'].includes(req.user?.role)
  ? next() : next(new ApiError(403, 'Order scanner access is restricted to authorized staff'));
marketplace.use(protect, activeUser);
marketplaceAdmin.use(protect, activeUser, requireMarketplaceAdmin);
export const endpoint = handler => async (req, res, next) => {
  try { res.json(new ApiResponse(200, await handler(req))); }
  catch (error) {
    if (error.code === 11000) return next(new ApiError(409, 'This record already exists. Refresh and try again.'));
    if (error.name === 'VersionError') return next(new ApiError(409, 'Data changed. Refresh and try again.'));
    if (error.name === 'ValidationError' || error.name === 'CastError') return next(new ApiError(400, error.message));
    next(error);
  }
};
marketplace.get('/categories', endpoint(() => Category.find({ active: true }).sort({ name: 1 })));
marketplace.get('/products', endpoint(req => listProducts(req.query)));
marketplace.get('/products/:id', endpoint(async req => {
  const product = await Product.findOne({ _id: objectId(req.params.id), status: 'active' }).populate('category');
  if (!product || !product.category?.active) throw new ApiError(404, 'Product not available');
  return publicProduct(product);
}));
marketplace.post('/quote', endpoint(async req => {
  const product = await Product.findById(objectId(req.body.productId));
  if (!product || !await Category.exists({ _id: product.category, active: true })) throw new ApiError(400, 'Product not available');
  return priceLine(product, objectId(req.body.variantId), req.body.purchaseMode, req.body.quantity);
}));
marketplaceAdmin.get('/products', endpoint(req => listProducts(req.query, true)));
marketplaceAdmin.post('/images', raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_PRODUCT_IMAGE_BYTES }), endpoint(req => uploadProductImage(req.body)));
marketplaceAdmin.post('/products', endpoint(req => saveProduct(req.body)));
marketplaceAdmin.put('/products/:id', endpoint(req => saveProduct(req.body, req.params.id)));
marketplaceAdmin.patch('/products/:id/status', endpoint(async req => {
  if (!['draft', 'active', 'archived'].includes(req.body.status)) throw new ApiError(400, 'Invalid status');
  const product = await Product.findByIdAndUpdate(objectId(req.params.id), { $set: { status: req.body.status }, $inc: { __v: 1 } }, { new: true });
  if (!product) throw new ApiError(404, 'Product not found');
  return product;
}));
marketplaceAdmin.get('/categories', endpoint(() => Category.find().sort({ name: 1 })));
const saveCategory = async req => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 100) : '';
  const slug = slugify(name);
  if (!name || !slug) throw new ApiError(400, 'Category name is required');
  if (!req.params.id) return Category.create({ name, slug, active: req.body.active !== false });
  const category = await Category.findByIdAndUpdate(objectId(req.params.id), { name, slug, active: req.body.active !== false }, { new: true, runValidators: true });
  if (!category) throw new ApiError(404, 'Category not found');
  return category;
};
marketplaceAdmin.post('/categories', endpoint(saveCategory));
marketplaceAdmin.put('/categories/:id', endpoint(saveCategory));
marketplaceAdmin.get('/inventory', endpoint(req => inventory(req.query)));
marketplaceAdmin.patch('/inventory/:id', endpoint(req => adjustInventory(req.params.id, req.body, req.user._id, req.get('Idempotency-Key'))));
marketplaceAdmin.get('/dashboard', endpoint(() => marketplaceDashboard()));
marketplace.get('/cart', endpoint(req => getCart(req.user._id)));
marketplace.post('/cart', endpoint(req => changeCart(req.user._id, req.body)));
marketplace.put('/cart/:itemId', endpoint(req => changeCart(req.user._id, req.body, req.params.itemId)));
marketplace.delete('/cart/:itemId', endpoint(req => changeCart(req.user._id, {}, req.params.itemId, true)));
marketplace.post('/checkout-quote', endpoint(req => checkoutQuote(req.user._id, req.body)));
marketplace.post('/orders', endpoint(req => placeOrder(req.user._id, req.body, req.get('Idempotency-Key'))));
marketplace.get('/orders', endpoint(req => listOrders(req.user._id, req.query)));
marketplace.get('/orders/scan/:token', orderScannerAccess, endpoint(req => orderByQrToken(req.params.token)));
marketplace.patch('/orders/scan/:token/status', orderScannerAccess, endpoint(async req => {
  const order = await orderByQrToken(req.params.token);
  return changeOrderStatus(order._id, req.user._id, req.body.status, true, req.body.codCollected === true);
}));
marketplace.get('/orders/:id', endpoint(req => orderDetail(req.params.id, req.user._id)));
marketplace.post('/orders/:id/cancel', endpoint(req => changeOrderStatus(req.params.id, req.user._id, 'cancelled')));
marketplaceAdmin.get('/orders', endpoint(req => listOrders(req.user._id, req.query, true)));
marketplaceAdmin.get('/orders/:id', endpoint(req => orderDetail(req.params.id, req.user._id, true)));
marketplaceAdmin.patch('/orders/:id/status', endpoint(req => {
  return changeOrderStatus(req.params.id, req.user._id, req.body.status, true, req.body.codCollected === true);
}));
