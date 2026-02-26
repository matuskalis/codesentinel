import { describe, it, expect } from 'vitest'
import { SignJWT, jwtVerify, errors } from 'jose'

// ---------------------------------------------------------------------------
// JWT operations unit tests
//
// The session module (`@/lib/auth/session`) imports `next/headers` (cookies())
// and the database layer, which makes it difficult to test directly in a
// pure-unit-test context. Instead we test the underlying JWT signing and
// verification logic directly using the `jose` library, which is the same
// library the session module relies on.
// ---------------------------------------------------------------------------

const SECRET = new TextEncoder().encode('a]9xK!mP#2rT$vW5zA8cD3fG6hJ0lN4q') // 32-char secret

describe('JWT operations', () => {
  // -----------------------------------------------------------------------
  // Token creation and verification
  // -----------------------------------------------------------------------

  it('should create a valid JWT and verify it', async () => {
    const token = await new SignJWT({ userId: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(SECRET)

    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] })
    expect(payload.userId).toBe('user-123')
  })

  it('should include userId claim in the payload', async () => {
    const token = await new SignJWT({ userId: 'abc-def-ghi' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(SECRET)

    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] })
    expect(payload.userId).toBe('abc-def-ghi')
    expect(typeof payload.userId).toBe('string')
  })

  it('should set an expiration time', async () => {
    const token = await new SignJWT({ userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(SECRET)

    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] })
    expect(payload.exp).toBeDefined()
    // Expiration should be roughly 7 days in the future
    const now = Math.floor(Date.now() / 1000)
    const sevenDays = 7 * 24 * 60 * 60
    expect(payload.exp! - now).toBeGreaterThan(sevenDays - 60) // within 60s tolerance
    expect(payload.exp! - now).toBeLessThanOrEqual(sevenDays + 1)
  })

  it('should set the issued-at claim', async () => {
    const beforeCreation = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({ userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(SECRET)

    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] })
    expect(payload.iat).toBeDefined()
    expect(payload.iat!).toBeGreaterThanOrEqual(beforeCreation)
    expect(payload.iat!).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1)
  })

  it('should use HS256 algorithm in the protected header', async () => {
    const token = await new SignJWT({ userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(SECRET)

    const { protectedHeader } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] })
    expect(protectedHeader.alg).toBe('HS256')
  })

  // -----------------------------------------------------------------------
  // Token rejection: tampered
  // -----------------------------------------------------------------------

  it('should reject a tampered token', async () => {
    const token = await new SignJWT({ userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(SECRET)

    // Tamper with the signature portion
    const tampered = token.slice(0, -5) + 'xxxxx'
    await expect(jwtVerify(tampered, SECRET, { algorithms: ['HS256'] })).rejects.toThrow()
  })

  // -----------------------------------------------------------------------
  // Token rejection: expired
  // -----------------------------------------------------------------------

  it('should reject an expired token', async () => {
    const token = await new SignJWT({ userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('-1h') // already expired 1 hour ago
      .sign(SECRET)

    await expect(
      jwtVerify(token, SECRET, { algorithms: ['HS256'] })
    ).rejects.toThrow()
  })

  it('should throw JWTExpired for expired token', async () => {
    const token = await new SignJWT({ userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('-1h')
      .sign(SECRET)

    try {
      await jwtVerify(token, SECRET, { algorithms: ['HS256'] })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(errors.JWTExpired)
    }
  })

  // -----------------------------------------------------------------------
  // Token rejection: wrong secret
  // -----------------------------------------------------------------------

  it('should reject a token signed with a different secret', async () => {
    const otherSecret = new TextEncoder().encode('b]9xK!mP#2rT$vW5zA8cD3fG6hJ0lN4q')
    const token = await new SignJWT({ userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(otherSecret)

    await expect(
      jwtVerify(token, SECRET, { algorithms: ['HS256'] })
    ).rejects.toThrow()
  })

  // -----------------------------------------------------------------------
  // Token with different user IDs
  // -----------------------------------------------------------------------

  it('should correctly differentiate tokens for different users', async () => {
    const token1 = await new SignJWT({ userId: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(SECRET)

    const token2 = await new SignJWT({ userId: 'user-2' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(SECRET)

    const { payload: p1 } = await jwtVerify(token1, SECRET, { algorithms: ['HS256'] })
    const { payload: p2 } = await jwtVerify(token2, SECRET, { algorithms: ['HS256'] })

    expect(p1.userId).toBe('user-1')
    expect(p2.userId).toBe('user-2')
    expect(token1).not.toBe(token2)
  })

  // -----------------------------------------------------------------------
  // Token hash consistency (mirrors session.ts hashToken behavior)
  // -----------------------------------------------------------------------

  describe('token hashing', () => {
    it('should produce a consistent SHA-256 hash for a given token', async () => {
      const { createHash } = await import('crypto')

      const token = 'test-token-value'
      const hash1 = createHash('sha256').update(token).digest('hex')
      const hash2 = createHash('sha256').update(token).digest('hex')

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex is 64 chars
    })

    it('should produce different hashes for different tokens', async () => {
      const { createHash } = await import('crypto')

      const hash1 = createHash('sha256').update('token-a').digest('hex')
      const hash2 = createHash('sha256').update('token-b').digest('hex')

      expect(hash1).not.toBe(hash2)
    })
  })

  // -----------------------------------------------------------------------
  // Malformed token strings
  // -----------------------------------------------------------------------

  it('should reject a completely invalid token string', async () => {
    await expect(
      jwtVerify('not-a-jwt-at-all', SECRET, { algorithms: ['HS256'] })
    ).rejects.toThrow()
  })

  it('should reject an empty string token', async () => {
    await expect(
      jwtVerify('', SECRET, { algorithms: ['HS256'] })
    ).rejects.toThrow()
  })
})
