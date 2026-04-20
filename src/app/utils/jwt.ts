/**
 * Decodes the payload of a JWT without verifying its signature.
 * Returns null for malformed/missing tokens. Callers must never use
 * the result for authorization — only for UI hints like the current
 * user's id/name. Server-side verification remains authoritative.
 */
export function decodeJwtPayload<T = Record<string, any>>(
  token: string | null | undefined,
): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    // Base64url → base64, then decode.
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    return JSON.parse(atob(padded)) as T;
  } catch {
    return null;
  }
}
