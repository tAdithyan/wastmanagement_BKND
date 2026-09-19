import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceLine, validateTiers, stockFor } from '../src/services/marketplace-pricing.js';
import { calculateDelivery } from '../src/services/marketplace-delivery.service.js';
import { requireMarketplaceAdmin } from '../src/middlewares/marketplace.middleware.js';

const tiers = [{ minQuantity: 5, maxQuantity: 9, pricePerCarton: 3120 }, { minQuantity: 10, maxQuantity: 24, pricePerCarton: 3000 }, { minQuantity: 25, maxQuantity: 49, pricePerCarton: 2880 }, { minQuantity: 50, maxQuantity: null, pricePerCarton: 2750 }];
const variant = { _id: 'v1', size: 'M', sku: 'BABY-M', active: true, piecesPerPack: 40, packsPerCarton: 8, retailPrice: 499, retailSalePrice: 449, wholesaleCartonPrice: 3120, minimumWholesaleQuantity: 5, wholesalePricingTiers: tiers, stockPacks: 8000, retailStock: 20, wholesaleStock: 15 };
const product = { _id: 'p1', name: 'Baby diapers', status: 'active', sellingMode: 'both', inventoryStrategy: 'shared', sizes: [variant] };
test('marketplace admin APIs reject customers, agents, client admins and inactive admins', () => {
  for (const role of ['ROL_3', 'ROL_4', 'ROL_5', 'ROL_6', 'CLIENT_ADMIN', undefined]) {
    let result;
    requireMarketplaceAdmin({ user: { role } }, {}, error => { result = error; });
    assert.equal(result.statusCode, 403);
  }
  for (const role of ['ROL_1', 'ROL_2', 'Admin', 'SuperAdmin']) {
    let result;
    requireMarketplaceAdmin({ user: { role } }, {}, error => { result = error; });
    assert.equal(result, undefined);
    requireMarketplaceAdmin({ user: { role, is_active: false } }, {}, error => { result = error; });
    assert.equal(result.statusCode, 403);
  }
});
test('retail uses packs and wholesale uses cartons with exact tier boundaries', () => {
  const retail = priceLine(product, 'v1', 'retail', 2);
  assert.equal(retail.subtotal, 898); assert.equal(retail.totalPieces, 80); assert.equal(retail.totalPacks, 2);
  for (const [quantity, expected] of [[5, 3120], [9, 3120], [10, 3000], [24, 3000], [25, 2880], [49, 2880], [50, 2750]]) {
    const line = priceLine(product, 'v1', 'wholesale', quantity);
    assert.equal(line.unitPrice, expected); assert.equal(line.subtotal, expected * quantity);
    assert.equal(line.totalPacks, quantity * 8); assert.equal(line.totalPieces, quantity * 320);
  }
});
test('rejects invalid quantities, MOQ, unavailable variants, modes and stock', () => {
  for (const quantity of [0, -1, .5, '5', Infinity, 1000001]) assert.throws(() => priceLine(product, 'v1', 'retail', quantity));
  assert.throws(() => priceLine(product, 'v1', 'wholesale', 4), /Minimum/);
  assert.throws(() => priceLine(product, 'unknown', 'retail', 1), /size/);
  assert.throws(() => priceLine({ ...product, status: 'draft' }, 'v1', 'retail', 1), /available/);
  assert.throws(() => priceLine({ ...product, sellingMode: 'retail' }, 'v1', 'wholesale', 5), /mode/);
  assert.throws(() => priceLine(product, 'v1', 'retail', 8001), /stock/);
  assert.equal(stockFor({ ...product, inventoryStrategy: 'separate' }, variant, 'wholesale'), 15);
  assert.equal(priceLine({ ...product, inventoryStrategy: 'separate' }, 'v1', 'wholesale', 5).stockUnits, 5);
});
test('tier ranges must cover MOQ onward without gaps, overlaps or increasing prices', () => {
  validateTiers(tiers, 5);
  assert.throws(() => validateTiers([{ ...tiers[0], minQuantity: 6 }], 5));
  assert.throws(() => validateTiers([tiers[0], { ...tiers[1], minQuantity: 9 }], 5));
  assert.throws(() => validateTiers([tiers[0], { minQuantity: 10, maxQuantity: null, pricePerCarton: 4000 }], 5));
  assert.throws(() => validateTiers([tiers[0]], 5));
});
test('delivery rules centralize mode, location, free delivery and tax', () => {
  const context = { orderType: 'mixed', subtotal: 1000, shippingAddress: { district: 'Ernakulam' }, items: [{ purchaseMode: 'wholesale', quantity: 5 }] };
  const rules = { default: { baseCharge: 50 }, mixed: { perCarton: 10 }, districts: { ernakulam: { taxRate: 5 } } };
  assert.deepEqual(calculateDelivery(context, rules), { deliveryCharge: 100, tax: 50, discount: 0 });
  assert.equal(calculateDelivery(context, { default: { baseCharge: 50, freeAbove: 1000 } }).deliveryCharge, 0);
  assert.throws(() => calculateDelivery(context, { default: { taxRate: -1 } }));
});
