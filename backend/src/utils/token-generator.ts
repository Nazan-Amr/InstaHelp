import crypto from 'crypto';

/**
 * Generate a cryptographically random token (128-bit base62 encoded)
 * Used for QR code tokens - non-guessable, URL-safe
 */
export function generateToken(): string {
  // Generate 128 bits (16 bytes) of random data
  const randomBytes = crypto.randomBytes(16);

  // Convert to base62 (0-9, A-Z, a-z) for URL-safe encoding
  const base62Chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  let result = '';
  let num = BigInt('0x' + randomBytes.toString('hex'));

  // Handle edge case where num is 0
  if (num === BigInt(0)) {
    return base62Chars[0];
  }

  while (num > 0) {
    result = base62Chars[Number(num % BigInt(62))] + result;
    num = num / BigInt(62);
  }

  return result;
}

/**
 * Validate token format (should be base62, reasonable length)
 */
export function isValidTokenFormat(token: string): boolean {
  const base62Regex = /^[0-9A-Za-z]+$/;
  return base62Regex.test(token) && token.length >= 20 && token.length <= 30;
}
