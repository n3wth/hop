import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Card from '../../components/ui/Card'
import Eyebrow from '../../components/ui/Eyebrow'
import Stat from '../../components/ui/Stat'
import Field, { Input, Textarea, Select } from '../../components/ui/Field'

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

describe('Field, Input, Textarea, and Select primitives', () => {
  it('renders Input with standard and invalid classes', () => {
    const inputHtml = renderToStaticMarkup(React.createElement(Input, { placeholder: 'Test Input' }))
    expect(inputHtml).toContain('bg-paper')
    expect(inputHtml).toContain('rounded-[10px]')
    expect(inputHtml).toContain('border-border')
    expect(inputHtml).toContain('placeholder="Test Input"')

    const invalidHtml = renderToStaticMarkup(React.createElement(Input, { placeholder: 'Test Input', invalid: true }))
    expect(invalidHtml).toContain('border-weak')
  })

  it('renders Textarea with standard and invalid classes', () => {
    const textareaHtml = renderToStaticMarkup(React.createElement(Textarea, { placeholder: 'Test Textarea' }))
    expect(textareaHtml).toContain('bg-paper')
    expect(textareaHtml).toContain('rounded-[10px]')
    expect(textareaHtml).toContain('border-border')
    expect(textareaHtml).toContain('placeholder="Test Textarea"')

    const invalidHtml = renderToStaticMarkup(React.createElement(Textarea, { placeholder: 'Test Textarea', invalid: true }))
    expect(invalidHtml).toContain('border-weak')
  })

  it('renders Select with options list', () => {
    const selectHtml = renderToStaticMarkup(React.createElement(Select, {
      options: [['opt1', 'Label 1'], ['opt2', 'Label 2']]
    }))
    expect(selectHtml).toContain('relative')
    expect(selectHtml).toContain('<select')
    expect(selectHtml).toContain('border-border')
    expect(selectHtml).toContain('appearance-none')
    expect(selectHtml).toContain('value="opt1"')
    expect(selectHtml).toContain('Label 1')
  })

  it('renders Field and wires child id, htmlFor, and error attributes', () => {
    const fieldHtml = renderToStaticMarkup(React.createElement(
      Field,
      {
        label: 'Email Address',
        error: 'Invalid email',
        id: 'email-id',
      },
      React.createElement(Input, { placeholder: 'Email' })
    ))

    expect(fieldHtml).toContain('for="email-id"')
    expect(fieldHtml).toContain('Email Address')
    expect(fieldHtml).toContain('id="email-id"')
    expect(fieldHtml).toContain('aria-describedby="email-id-error"')
    expect(fieldHtml).toContain('role="alert"')
    expect(fieldHtml).toContain('Invalid email')
  })
})

