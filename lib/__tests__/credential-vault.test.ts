import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  decryptCredential,
  encryptCredential,
  maskUsername,
} from '@/lib/credential-vault'

const KEY = 'a'.repeat(64) // 32 bytes hex

describe('credential vault crypto', () => {
  beforeEach(() => {
    process.env.HOP_CREDENTIAL_KEY = KEY
  })
  afterEach(() => {
    delete process.env.HOP_CREDENTIAL_KEY
  })

  it('round-trips username + password through AES-256-GCM', () => {
    const blob = encryptCredential('oliver@newth.ai', 'hunter2!')
    expect(blob).not.toBeNull()
    // Three base64url parts: iv.tag.ciphertext
    expect(blob!.split('.')).toHaveLength(3)
    expect(decryptCredential(blob!)).toEqual({ username: 'oliver@newth.ai', password: 'hunter2!' })
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptCredential('u', 'p')
    const b = encryptCredential('u', 'p')
    expect(a).not.toBe(b)
    expect(decryptCredential(a!)).toEqual(decryptCredential(b!))
  })

  it('fails closed with no key', () => {
    delete process.env.HOP_CREDENTIAL_KEY
    expect(encryptCredential('u', 'p')).toBeNull()
    expect(decryptCredential('iv.tag.ct')).toBeNull()
  })

  it('rejects a tampered blob (GCM auth failure)', () => {
    const blob = encryptCredential('u', 'p')!
    const [iv, tag, ct] = blob.split('.')
    // Flip a character in the ciphertext.
    const tampered = `${iv}.${tag}.${ct.startsWith('A') ? 'B' : 'A'}${ct.slice(1)}`
    expect(decryptCredential(tampered)).toBeNull()
  })

  it('rejects a malformed blob', () => {
    expect(decryptCredential('not-a-blob')).toBeNull()
    expect(decryptCredential('only.two')).toBeNull()
  })

  it('rejects a key of the wrong length', () => {
    process.env.HOP_CREDENTIAL_KEY = 'abcd'
    expect(encryptCredential('u', 'p')).toBeNull()
  })
})

describe('maskUsername', () => {
  it('masks emails keeping the domain', () => {
    expect(maskUsername('oliver@newth.ai')).toBe('ol…@newth.ai')
  })
  it('masks plain usernames', () => {
    expect(maskUsername('skyflyer')).toBe('sk…r')
  })
  it('handles very short usernames without leaking them whole', () => {
    expect(maskUsername('ab')).toBe('a…')
  })
})
