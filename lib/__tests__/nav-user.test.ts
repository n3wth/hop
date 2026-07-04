import { describe, expect, it } from 'vitest'
import { gravatarUrl, toNavUser } from '@/lib/nav-user'

describe('toNavUser', () => {
  it('passes null/undefined through (signed out)', () => {
    expect(toNavUser(null)).toBeNull()
    expect(toNavUser(undefined)).toBeNull()
  })

  it('keeps the IdP picture when present', () => {
    const u = toNavUser({ name: 'Oliver', email: 'o@example.com', picture: 'https://idp/pic.jpg' })
    expect(u?.picture).toBe('https://idp/pic.jpg')
    expect(u?.initial).toBe('O')
  })

  it('falls back to gravatar when there is no picture', () => {
    const u = toNavUser({ name: 'Oliver', email: 'o@example.com', picture: null })
    expect(u?.picture).toBe(gravatarUrl('o@example.com'))
    expect(u?.picture).toContain('gravatar.com/avatar/')
    expect(u?.picture).toContain('d=404')
  })

  it('normalizes the email before hashing (case/whitespace-insensitive)', () => {
    expect(gravatarUrl('  O@Example.COM ')).toBe(gravatarUrl('o@example.com'))
  })

  it('has no picture at all without an email', () => {
    const u = toNavUser({ name: 'Oliver', email: null, picture: null })
    expect(u?.picture).toBeUndefined()
  })

  it('derives the initial from name, then email, then U', () => {
    expect(toNavUser({ email: 'zed@example.com' })?.initial).toBe('Z')
    expect(toNavUser({})?.initial).toBe('U')
  })
})
