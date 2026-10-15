import { createHmac } from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET || 'restohub-super-secret-key-change-in-production-2024';

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

export function signPayload<T extends Record<string, unknown>>(data: T, salt = 'oauth'): string {
  const payloadStr = JSON.stringify(data);
  const payloadB64 = base64UrlEncode(payloadStr);
  const signature = createHmac('sha256', SECRET + salt)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifyPayload<T extends Record<string, unknown>>(token: string, salt = 'oauth'): T | null {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;
    const expectedSig = createHmac('sha256', SECRET + salt)
      .update(payloadB64)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    const data = JSON.parse(base64UrlDecode(payloadB64)) as T;
    return data;
  } catch {
    return null;
  }
}

export function createAuthCode(userId: number, redirectUri: string): string {
  return signPayload({
    userId,
    redirectUri,
    exp: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
  }, 'auth_code');
}

export function verifyAuthCode(code: string, redirectUri?: string): { userId: number } | null {
  const data = verifyPayload<{ userId: number; redirectUri: string; exp: number }>(code, 'auth_code');
  if (!data) return null;
  if (data.exp && data.exp < Date.now()) return null;
  if (redirectUri && data.redirectUri && data.redirectUri !== redirectUri) {
    // If redirect_uri is provided, verify matching origin or exact match
    try {
      const u1 = new URL(data.redirectUri).origin;
      const u2 = new URL(redirectUri).origin;
      if (u1 !== u2 && data.redirectUri !== redirectUri) return null;
    } catch {
      if (data.redirectUri !== redirectUri) return null;
    }
  }
  return { userId: data.userId };
}

export function createAccessToken(user: { id: number; email: string; name: string; role: string }): string {
  return signPayload({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  }, 'access_token');
}

export function verifyAccessToken(token: string): { id: number; email: string; name: string; role: string } | null {
  const data = verifyPayload<{ id: number; email: string; name: string; role: string; exp: number }>(token, 'access_token');
  if (!data) return null;
  if (data.exp && data.exp < Date.now()) return null;
  return { id: data.id, email: data.email, name: data.name, role: data.role };
}
