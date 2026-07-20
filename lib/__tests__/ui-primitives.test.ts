import { describe, it, expect } from 'vitest'
import React from 'react'
import Stat from '../../components/ui/Stat'

describe('Stat primitive', () => {
  it('renders value and label verbatim', () => {
    const el = Stat({ value: '123', label: 'points' })
    expect(el.props.className).toContain('items-end')
    expect(el.props.className).toContain('text-end')
    
    // Check children of the value block
    const valueChild = el.props.children[0]
    expect(valueChild.props.className).toContain('hop-num')
    expect(valueChild.props.className).toContain('text-[18px]')
    expect(valueChild.props.className).toContain('text-text')
    expect(valueChild.props.children).toBe('123')

    // Check children of the label block
    const labelChild = el.props.children[1]
    expect(labelChild.props.className).toContain('tracking-[var(--track-label)]')
    expect(labelChild.props.className).toContain('text-text3')
    expect(labelChild.props.children).toBe('points')
  })

  it('supports sm and lg sizes', () => {
    const smEl = Stat({ value: '123', label: 'points', size: 'sm' })
    const smValueChild = smEl.props.children[0]
    expect(smValueChild.props.className).toContain('text-[15px]')

    const lgEl = Stat({ value: '123', label: 'points', size: 'lg' })
    const lgValueChild = lgEl.props.children[0]
    expect(lgValueChild.props.className).toContain('text-[24px]')
  })

  it('supports onDark theme coloring', () => {
    const el = Stat({ value: '123', label: 'points', onDark: true })
    const valueChild = el.props.children[0]
    const labelChild = el.props.children[1]
    expect(valueChild.props.className).toContain('text-white')
    expect(labelChild.props.className).toContain('text-hero-body')
  })

  it('supports custom alignments', () => {
    const leftEl = Stat({ value: '123', label: 'points', align: 'left' })
    expect(leftEl.props.className).toContain('items-start')
    expect(leftEl.props.className).toContain('text-start')

    const centerEl = Stat({ value: '123', label: 'points', align: 'center' })
    expect(centerEl.props.className).toContain('items-center')
    expect(centerEl.props.className).toContain('text-center')
  })
})
