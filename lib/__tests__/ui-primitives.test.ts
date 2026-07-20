import { describe, it, expect } from 'vitest'
import React from 'react'
import Card from '../../components/ui/Card'
import Eyebrow from '../../components/ui/Eyebrow'

describe('Card primitive', () => {
  it('renders default surface and radius', () => {
    const el = Card({ surface: 'surface', radius: 'md', children: 'test' })
    expect(el.props.className).toContain('bg-surface')
    expect(el.props.className).toContain('rounded-[var(--radius)]')
    expect(el.props.className).toContain('border border-border')
  })

  it('renders paper surface and lg radius', () => {
    const el = Card({ surface: 'paper', radius: 'lg', children: 'test' })
    expect(el.props.className).toContain('bg-paper')
    expect(el.props.className).toContain('rounded-[var(--radius-lg)]')
  })

  it('adds interactive classes when interactive is true', () => {
    const el = Card({ interactive: true, children: 'test' })
    expect(el.props.className).toContain('hover:border-brand')
    expect(el.props.className).toContain('cursor-pointer')
  })

  it('supports custom tag name', () => {
    const el = Card({ as: 'section', children: 'test' })
    expect(el.type).toBe('section')
  })
})

describe('Eyebrow primitive', () => {
  it('renders with standard uppercase uppercase and track tracking', () => {
    const el = Eyebrow({ children: 'hello' })
    expect(el.props.className).toContain('uppercase')
    expect(el.props.className).toContain('tracking-[var(--track-eyebrow)]')
    expect(el.props.className).toContain('text-text3')
  })

  it('renders with onDark color', () => {
    const el = Eyebrow({ onDark: true, children: 'hello' })
    expect(el.props.className).toContain('text-hero-eyebrow')
  })

  it('supports custom tag name', () => {
    const el = Eyebrow({ as: 'div', children: 'hello' })
    expect(el.type).toBe('div')
  })
})
