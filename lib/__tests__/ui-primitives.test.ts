import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import React from 'react'
import Card from '../../components/ui/Card'
import Eyebrow from '../../components/ui/Eyebrow'
import Stat from '../../components/ui/Stat'
import { Field, Input, Textarea, Select } from '../../components/ui/Field'

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

describe('Field/Input/Textarea/Select primitives', () => {
  const originalUseId = React.useId

  beforeAll(() => {
    React.useId = () => 'test-id'
  })

  afterAll(() => {
    React.useId = originalUseId
  })

  it('renders Field with label and error', () => {
    const inputEl = React.createElement(Input, { value: 'test', onChange: () => {} })
    const el = Field({ label: 'Name', error: 'Required', children: inputEl })
    
    // Field should have label child
    const labelChild = el.props.children[0]
    expect(labelChild.props.children).toBe('Name')
    
    // Field should wire id
    const inputChild = el.props.children[1]
    expect(inputChild.props.id).toBeDefined()
    expect(labelChild.props.htmlFor).toBe(inputChild.props.id)
    
    // Field should render error
    const errorChild = el.props.children[2]
    expect(errorChild.props.role).toBe('alert')
    expect(errorChild.props.children).toBe('Required')
  })

  it('renders Input with invalid style', () => {
    const Component = Input as unknown as React.FC<{ invalid?: boolean; value?: string; onChange?: () => void }>
    const el = React.createElement(Component, { invalid: true, value: 'test', onChange: () => {} })
    const rendered = (Input as unknown as { render: (p: Record<string, unknown>, r: unknown) => React.ReactElement }).render(el.props, null)
    expect((rendered.props as { className: string }).className).toContain('border-weak')
    expect((rendered.props as { className: string }).className).toContain('no-inner-ring')
  })

  it('renders Textarea with invalid style', () => {
    const rendered = (Textarea as unknown as { render: (p: Record<string, unknown>, r: unknown) => React.ReactElement }).render({ invalid: true, value: 'test', onChange: () => {} }, null)
    expect((rendered.props as { className: string }).className).toContain('border-weak')
  })

  it('renders Select with options', () => {
    const rendered = (Select as unknown as { render: (p: Record<string, unknown>, r: unknown) => React.ReactElement }).render({
      value: 'mr',
      onChange: () => {},
      options: [
        ['mr', 'Mr'],
        ['ms', 'Ms'],
      ],
    }, null)
    
    const children = (rendered.props as { children: React.ReactElement[] }).children
    const selectEl = children[0]
    expect((selectEl.props as { className: string }).className).toContain('no-inner-ring')
    
    const selectChildren = (selectEl.props as { children: [unknown, React.ReactElement[]] }).children
    const optionMr = selectChildren[1][0]
    expect((optionMr.props as { value: string; children: string }).value).toBe('mr')
    expect((optionMr.props as { value: string; children: string }).children).toBe('Mr')
  })
})
