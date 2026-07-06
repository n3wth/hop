import { describe, expect, it } from 'vitest'
import { firstName, gravatarUrl, toNavUser } from '@/lib/nav-user'

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

describe('firstName', () => {
  it('capitalizes a lowercase stored name (e.g. from an email/password sign-up)', () => {
    expect(firstName({ name: 'oliver', email: 'oliver@newth.ai' })).toBe('Oliver')
  })

  it('takes the first token of a full name and capitalizes it', () => {
    expect(firstName({ name: 'oliver newth', email: 'oliver@newth.ai' })).toBe('Oliver')
  })

  it('leaves an already-capitalized name unchanged', () => {
    expect(firstName({ name: 'Oliver', email: 'oliver@newth.ai' })).toBe('Oliver')
  })

  it('never re-derives from email when a real name is present', () => {
    expect(firstName({ name: 'Oliver', email: 'someoneelse@example.com' })).toBe('Oliver')
  })

  it('falls back to the capitalized email local part when there is no name', () => {
    expect(firstName({ name: null, email: 'zed@example.com' })).toBe('Zed')
    expect(firstName({ email: 'zed@example.com' })).toBe('Zed')
  })

  it('normalizes local-part separators before taking the first word', () => {
    expect(firstName({ email: 'john.smith@example.com' })).toBe('John')
    expect(firstName({ email: 'john_smith@example.com' })).toBe('John')
    expect(firstName({ email: 'john-smith@example.com' })).toBe('John')
  })

  it('is undefined with no name and no email', () => {
    expect(firstName({})).toBeUndefined()
    expect(firstName(null)).toBeUndefined()
    expect(firstName(undefined)).toBeUndefined()
  })
})
