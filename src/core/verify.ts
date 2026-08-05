import crypto from "node:crypto";

/**
 * Constant-time string comparison, used to validate the secret token that
 * Terros webhook URLs carry (Terros does not HMAC-sign webhook bodies, so the
 * unguessable URL token is the shared secret).
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
