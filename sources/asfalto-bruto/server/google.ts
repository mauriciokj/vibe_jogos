import { createRemoteJWKSet, createLocalJWKSet, jwtVerify } from 'jose';
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 5000 });
export function googleVerifier(clientId: string, keyset: ReturnType<typeof createRemoteJWKSet> | ReturnType<typeof createLocalJWKSet> = keys) {
  return async (credential: string, nonce: string) => {
    const { payload } = await jwtVerify(credential, keyset, {
      audience: clientId, issuer: ['accounts.google.com', 'https://accounts.google.com'],
      algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'nonce'], maxTokenAge: '10m',
    });
    if (payload.nonce !== nonce || !payload.sub || payload.sub.length > 255) throw new Error('Invalid identity');
    // Google subject is stable; email, photo and real name are not stored or made public.
    return payload.sub;
  };
}
