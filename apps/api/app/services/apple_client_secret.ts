import { importPKCS8, SignJWT } from 'jose'

/** Default client-secret JWT lifetime (5 minutes). Apple allows up to ~6 months. */
export const APPLE_CLIENT_SECRET_TTL_SECONDS = 5 * 60

export type AppleClientSecretInput = {
  /** Services ID used as OAuth client_id / JWT `sub` (e.g. com.atasoif.web). */
  clientId: string
  /** Apple Developer Team ID (JWT `iss`). */
  teamId: string
  /** Key ID of the .p8 Sign in with Apple key (JWT header `kid`). */
  keyId: string
  /** PEM contents of the .p8 private key (literal newlines or `\n` escapes). */
  privateKey: string
  /** Lifetime in seconds from `iat`. Capped well below Apple's 6-month max. */
  expiresInSeconds?: number
  /** Injectable clock for tests (unix seconds). */
  nowSeconds?: number
}

/**
 * Normalize a PEM from env: Dokploy / single-line secrets often store `\n` escapes.
 * Never log the returned value.
 */
export function normalizeApplePrivateKeyPem(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim()
}

/**
 * Build Apple's OAuth client_secret as a short-lived ES256 JWT signed with the .p8 key.
 * @see https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
 */
export async function generateAppleClientSecret(input: AppleClientSecretInput): Promise<string> {
  const clientId = input.clientId.trim()
  const teamId = input.teamId.trim()
  const keyId = input.keyId.trim()
  const privateKeyPem = normalizeApplePrivateKeyPem(input.privateKey)

  if (!clientId || !teamId || !keyId || !privateKeyPem) {
    throw new Error('Apple client secret requires clientId, teamId, keyId, and privateKey')
  }

  const ttl = Math.min(
    Math.max(input.expiresInSeconds ?? APPLE_CLIENT_SECRET_TTL_SECONDS, 60),
    15_777_000
  )
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const key = await importPKCS8(privateKeyPem, 'ES256')

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(key)
}
