import ApiError from '../utils/apiError.js';
import { money } from './marketplace-pricing.js';

// Rules stay on the server. Extend this service with weight/zone rules as needed.
export function calculateDelivery({ orderType, subtotal, items, shippingAddress }, config) {
  let rules = config;
  try { rules ??= JSON.parse(process.env.MARKETPLACE_DELIVERY_RULES || '{}'); }
  catch { throw new ApiError(503, 'Marketplace delivery configuration is invalid'); }
  const district = String(shippingAddress?.district || '').trim().toLowerCase();
  const rule = { ...(rules.default || {}), ...(rules[orderType] || {}), ...(rules.districts?.[district] || {}) };
  const number = (value, fallback = 0) => {
    const result = value ?? fallback;
    if (typeof result !== 'number' || !Number.isFinite(result) || result < 0) throw new ApiError(503, 'Marketplace delivery configuration is invalid');
    return result;
  };
  const cartons = items.filter(i => i.purchaseMode === 'wholesale').reduce((sum, i) => sum + i.quantity, 0);
  let deliveryCharge = money(number(rule.baseCharge) + cartons * number(rule.perCarton));
  if (rule.freeAbove != null && subtotal >= number(rule.freeAbove)) deliveryCharge = 0;
  const taxRate = number(rule.taxRate);
  if (taxRate > 100) throw new ApiError(503, 'Marketplace tax rate is invalid');
  return { deliveryCharge, tax: money(subtotal * taxRate / 100), discount: 0 };
}
