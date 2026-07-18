import * as crypto from 'crypto';

export const SECRET_KEY = 'ideation_goat_super_secret_sandbox_key';

export interface VerificationResult {
  status: 'authenticated' | 'unauthorized' | 'expired' | 'invalid_issuer' | 'invalid_token';
  user_id?: string;
  roles?: string[];
  permissions?: string[];
  authorized: boolean;
  reason: string;
}

/**
 * Utility helper to generate signed mock JWT tokens for identity validation tests.
 */
export function generateMockJwtToken(
  userId: string,
  roles: string[],
  permissions: string[],
  expiresInSeconds: number = 3600
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    roles,
    permissions,
    iss: 'IdeationGOAT-Auth',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };

  const base64UrlEncode = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(unsignedToken)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signature}`;
}

/**
 * Verifies a JWT token signature, expiration, and required permission scopes.
 */
export function verifySandboxIdentity(token: string, requiredPermission?: string): VerificationResult {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {
        status: 'invalid_token',
        authorized: false,
        reason: 'Authentication Failed: Token signature validation error. Invalid format.'
      };
    }

    const [headerB64, payloadB64, signature] = parts;
    const unsignedToken = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(unsignedToken)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSig) {
      return {
        status: 'invalid_token',
        authorized: false,
        reason: 'Authentication Failed: Token signature validation error. Signature mismatch.'
      };
    }

    const decodeBase64Url = (str: string) => {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      return Buffer.from(base64, 'base64').toString('utf8');
    };

    const payload = JSON.parse(decodeBase64Url(payloadB64));

    // Check issuer
    if (payload.iss !== 'IdeationGOAT-Auth') {
      return {
        status: 'invalid_issuer',
        authorized: false,
        reason: 'Authentication Failed: Untrusted token issuer.'
      };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        status: 'expired',
        authorized: false,
        reason: 'Authentication Failed: Token signature has expired.'
      };
    }

    // Check permissions scope
    const userPermissions = payload.permissions || [];
    let authorized = true;
    let reason = 'Token is valid and active.';

    if (requiredPermission && !userPermissions.includes(requiredPermission)) {
      authorized = false;
      reason = `Access Denied: Missing required permission scope '${requiredPermission}'.`;
    }

    return {
      status: authorized ? 'authenticated' : 'unauthorized',
      user_id: payload.sub,
      roles: payload.roles || [],
      permissions: userPermissions,
      authorized,
      reason
    };
  } catch (err: any) {
    return {
      status: 'invalid_token',
      authorized: false,
      reason: `Authentication Failed: Token signature validation error. ${err.message}`
    };
  }
}
