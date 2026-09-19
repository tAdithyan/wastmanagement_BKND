import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MAX_PRODUCT_IMAGE_BYTES, validateProductImage, uploadProductImage } from '../src/services/marketplace-image.service.js';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
test('validates image bytes and size instead of trusting the extension', () => {
  assert.equal(validateProductImage(png), 'image/png');
  assert.equal(validateProductImage(Buffer.from([255, 216, 255, 0])), 'image/jpeg');
  assert.equal(validateProductImage(Buffer.from('RIFF0000WEBP')), 'image/webp');
  assert.throws(() => validateProductImage(Buffer.from('<svg></svg>')), /JPG, PNG or WebP/);
  assert.throws(() => validateProductImage({}), /Select an image/);
  assert.throws(() => validateProductImage(Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1)), /5 MB/);
});
test('uploads with a server-side signature and returns only image metadata', async () => {
  const keys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const previous = keys.map(key => process.env[key]);
  try {
    keys.forEach(key => delete process.env[key]);
    await assert.rejects(uploadProductImage(png), /not configured/);
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    const result = await uploadProductImage(png, async (url, options) => {
      assert.equal(url, 'https://api.cloudinary.com/v1_1/test-cloud/image/upload');
      const form = options.body;
      const publicId = form.get('public_id');
      assert.match(publicId, /^marketplace\/products\//);
      assert.equal(form.get('signature'), createHash('sha256').update(`public_id=${publicId}&timestamp=${form.get('timestamp')}test-secret`).digest('hex'));
      assert.equal(form.get('api_key'), 'test-key');
      assert.equal(form.has('api_secret'), false);
      assert.deepEqual(Buffer.from(await form.get('file').arrayBuffer()), png);
      return { ok: true, json: async () => ({ resource_type: 'image', format: 'png', secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/example.png', public_id: publicId, width: 10, height: 10 }) };
    });
    assert.ok(result.url); assert.equal(result.width, 10); assert.equal(result.apiKey, undefined);
    await assert.rejects(uploadProductImage(png, async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'sensitive-provider-error' } }) })), /rejected the upload credentials/);
    await assert.rejects(uploadProductImage(png, async () => { throw new Error('network'); }), /could not reach/);
    await assert.rejects(uploadProductImage(png, async () => ({ ok: true, json: async () => ({ resource_type: 'raw' }) })), /invalid image response/);
  } finally {
    keys.forEach((key, i) => previous[i] == null ? delete process.env[key] : process.env[key] = previous[i]);
  }
});
