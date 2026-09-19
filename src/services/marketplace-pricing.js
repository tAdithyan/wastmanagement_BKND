import ApiError from '../utils/apiError.js';

export const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1000000) throw new ApiError(400, `${label} must be a positive whole number (maximum 1,000,000)`);
  return value;
}
export function validateTiers(tiers, moq) {
  let end = moq - 1;
  let previousPrice = Infinity;
  for (const tier of tiers) {
    positiveInteger(tier.minQuantity, 'Tier minimum');
    if (tier.minQuantity !== end + 1) throw new ApiError(400, 'Wholesale tiers must be ordered and contiguous, starting at the MOQ');
    if (tier.maxQuantity != null) positiveInteger(tier.maxQuantity, 'Tier maximum');
    if (tier.maxQuantity != null && tier.maxQuantity < tier.minQuantity) throw new ApiError(400, 'Invalid tier range');
    if (!Number.isFinite(tier.pricePerCarton) || tier.pricePerCarton <= 0 || tier.pricePerCarton > previousPrice) throw new ApiError(400, 'Tier prices must be positive and must not increase with quantity');
    end = tier.maxQuantity ?? Infinity;
    previousPrice = tier.pricePerCarton;
  }
  if (tiers.length && end !== Infinity) throw new ApiError(400, 'The final pricing tier must have no maximum');
}
export function stockFor(product, variant, mode) {
  if (product.inventoryStrategy === 'shared') return mode === 'retail' ? variant.stockPacks : Math.floor(variant.stockPacks / variant.packsPerCarton);
  return mode === 'retail' ? variant.retailStock : variant.wholesaleStock;
}
export function priceLine(product, variantId, mode, quantity, checkStock = true) {
  if (!product || product.status !== 'active') throw new ApiError(400, 'Product is no longer available');
  if (!['retail', 'wholesale'].includes(mode) || ![mode, 'both'].includes(product.sellingMode)) throw new ApiError(400, 'This purchase mode is unavailable');
  const variant = product.sizes.find(v => String(v._id) === String(variantId) && v.active !== false);
  if (!variant) throw new ApiError(400, 'Product size is no longer available');
  positiveInteger(quantity, 'Quantity');
  if (mode === 'wholesale' && quantity < variant.minimumWholesaleQuantity) throw new ApiError(400, `Minimum order is ${variant.minimumWholesaleQuantity} cartons`);
  if (checkStock && quantity > stockFor(product, variant, mode)) throw new ApiError(409, `Insufficient stock for ${product.name} (${variant.size})`);
  const tier = mode === 'wholesale' ? variant.wholesalePricingTiers?.find(t => quantity >= t.minQuantity && (t.maxQuantity == null || quantity <= t.maxQuantity)) : null;
  const unitPrice = money(mode === 'retail' ? (variant.retailSalePrice ?? variant.retailPrice) : (tier?.pricePerCarton ?? variant.wholesaleCartonPrice));
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new ApiError(400, 'Product price is not configured');
  const totalPacks = quantity * (mode === 'wholesale' ? variant.packsPerCarton : 1);
  const totalPieces = totalPacks * variant.piecesPerPack;
  const subtotal = money(unitPrice * quantity);
  if (!Number.isSafeInteger(totalPieces) || !Number.isSafeInteger(Math.round(subtotal * 100))) throw new ApiError(400, 'Order quantity is too large');
  return {
    productId: product._id, variantId: variant._id, productName: product.name, size: variant.size, sku: variant.sku, image: product.images?.[0],
    purchaseMode: mode, quantity, unitPrice, subtotal, piecesPerPack: variant.piecesPerPack, packsPerCarton: variant.packsPerCarton,
    totalPacks, totalPieces, applicableTier: tier || null,
    inventoryStrategy: product.inventoryStrategy,
    stockField: product.inventoryStrategy === 'shared' ? 'stockPacks' : mode === 'retail' ? 'retailStock' : 'wholesaleStock',
    stockUnits: product.inventoryStrategy === 'shared' ? totalPacks : quantity,
    availableQuantity: stockFor(product, variant, mode), minimumQuantity: mode === 'wholesale' ? variant.minimumWholesaleQuantity : 1,
  };
}
