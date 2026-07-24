import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Card from '../../components/ui/Card'
import Eyebrow from '../../components/ui/Eyebrow'
import Stat from '../../components/ui/Stat'
import Field, { Input, Textarea, Select } from '../../components/ui/Field'
import Button from '../../components/ui/Button'

describe('Button primitive', () => {
  it('renders primary, secondary, ghost, and ink variants', () => {
    const primaryHtml = renderToStaticMarkup(React.createElement(Button, { variant: 'primary' }, 'Click'))
    expect(primaryHtml).toContain('bg-brand')
    expect(primaryHtml).toContain('text-white')

    const secondaryHtml = renderToStaticMarkup(React.createElement(Button, { variant: 'secondary' }, 'Click'))
    expect(secondaryHtml).toContain('border-border')
    expect(secondaryHtml).toContain('bg-paper')

    const ghostHtml = renderToStaticMarkup(React.createElement(Button, { variant: 'ghost' }, 'Click'))
    expect(ghostHtml).toContain('bg-transparent')
    expect(ghostHtml).toContain('hover:bg-surface')

    const inkHtml = renderToStaticMarkup(React.createElement(Button, { variant: 'ink' }, 'Click'))
    expect(inkHtml).toContain('border-[1.5px]')
    expect(inkHtml).toContain('border-text')
  })

  it('supports sizes sm, md, lg and fullWidth', () => {
    const smHtml = renderToStaticMarkup(React.createElement(Button, { size: 'sm' }, 'Click'))
    expect(smHtml).toContain('px-3')

    const lgHtml = renderToStaticMarkup(React.createElement(Button, { size: 'lg' }, 'Click'))
    expect(lgHtml).toContain('px-6')

    const fullHtml = renderToStaticMarkup(React.createElement(Button, { fullWidth: true }, 'Click'))
    expect(fullHtml).toContain('w-full')
  })

  it('supports onDark theme', () => {
    const darkHtml = renderToStaticMarkup(React.createElement(Button, { variant: 'primary', onDark: true }, 'Click'))
    expect(darkHtml).toContain('bg-white')
    expect(darkHtml).toContain('text-brand')
  })

  it('renders a button element by default and an anchor when href is given', () => {
    const btnHtml = renderToStaticMarkup(React.createElement(Button, {}, 'Click'))
    expect(btnHtml).toContain('<button type="button"')

    const anchorHtml = renderToStaticMarkup(React.createElement(Button, { href: 'https://example.com', native: true }, 'Link'))
    expect(anchorHtml).toContain('<a href="https://example.com"')
  })
})

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

describe('Field primitive', () => {
  it('renders Field with label, hint, error, and required indicator', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Field,
        { label: 'Email', hint: 'We send receipts here', error: 'Invalid email', required: true, id: 'email-field' },
        React.createElement(Input, { id: 'email-field', type: 'email' })
      )
    )
    expect(html).toContain('Email')
    expect(html).toContain('*')
    expect(html).toContain('We send receipts here')
    expect(html).toContain('Invalid email')
    expect(html).toContain('text-red-600')
  })

  it('renders Input with default and error border styling', () => {
    const defaultHtml = renderToStaticMarkup(React.createElement(Input, { placeholder: 'Enter text' }))
    expect(defaultHtml).toContain('border-border')

    const errorHtml = renderToStaticMarkup(React.createElement(Input, { invalid: true }))
    expect(errorHtml).toContain('border-red-500')
  })

  it('renders Textarea with resize-y and error state', () => {
    const html = renderToStaticMarkup(React.createElement(Textarea, { rows: 4, invalid: true }))
    expect(html).toContain('resize-y')
    expect(html).toContain('border-red-500')
  })

  it('renders Select with custom caret arrow', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Select,
        {},
        React.createElement('option', { value: 'a' }, 'Option A')
      )
    )
    expect(html).toContain('appearance-none')
    expect(html).toContain('<svg')
  })
})
