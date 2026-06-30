// SVG sprite sheet — rendered once in the root layout (display:none) so every
// <Icon> on the page references a shared <symbol> instead of inlining its path
// string. Icons used multiple times per page (flight×10, swap_horiz×12, etc.)
// no longer duplicate their path data in the HTML.
//
// display:none on the outer <svg> hides it visually while keeping the symbols
// reachable by <use href="#icon-*"> in the same document. This is well-supported
// in all modern browsers (Chromium 50+, Firefox 46+, Safari 10+).
//
// Server component — no client JS, renders static markup.

import { ICONS } from './Icon'

export default function IconSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'none' }}
    >
      <defs>
        {(Object.keys(ICONS) as Array<keyof typeof ICONS>).map((name) => (
          <symbol key={name} id={`icon-${name}`} viewBox="0 -960 960 960">
            <path d={ICONS[name]} />
          </symbol>
        ))}
      </defs>
    </svg>
  )
}
