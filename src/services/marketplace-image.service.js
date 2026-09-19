import { createHash, randomUUID } from 'node:crypto';
import ApiError from '../utils/apiError.js';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export function validateProductImage(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new ApiError(400, 'Select an image to upload');
  if (buffer.length > MAX_PRODUCT_IMAGE_BYTES) throw new ApiError(413, 'Each image must be 5 MB or smaller');
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new ApiError(400, 'Use a JPG, PNG or WebP image');
}

export async function uploadProductImage(buffer, fetchImpl = fetch) {
  const mime = validateProductImage(buffer);
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud || !apiKey || !secret || !/^[a-zA-Z0-9_-]+$/.test(cloud)) {
    throw new ApiError(503, 'Image uploads are not configured. Add the Cloudinary credentials to the backend.');
  }
  const publicId = `marketplace/products/${randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  // Sign the upload server-side; the API secret is never returned to the browser.
  const signature = createHash('sha256').update(`public_id=${publicId}&timestamp=${timestamp}${secret}`).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), 'product-image');
  form.append('public_id', publicId);
  form.append('timestamp', timestamp);
  form.append('api_key', apiKey);
  form.append('signature', signature);
  let response, result;
  try {
    response = await fetchImpl(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(60000),
    });
    result = await response.json();
  } catch {
    throw new ApiError(502, 'Image upload could not reach Cloudinary. Please try again.');
  }
  if (!response.ok) {
    throw new ApiError(502, response.status === 401 || response.status === 403
      ? 'Cloudinary rejected the upload credentials. Check the backend Cloudinary settings.'
      : 'Cloudinary could not upload this image. Try another image or check your Cloudinary account.');
  }
  if (result.resource_type !== 'image' || !['jpg', 'jpeg', 'png', 'webp'].includes(result.format) || typeof result.secure_url !== 'string' || !result.secure_url.startsWith('https://res.cloudinary.com/')) {
    throw new ApiError(502, 'Cloudinary returned an invalid image response');
  }
  return { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height };
}
