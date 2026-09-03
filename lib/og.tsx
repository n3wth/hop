// lib/og.tsx — shared building blocks for dynamic Open Graph cards (next/og).
//
// The hop bunny mark + brand palette, factored out so every social card (the
// site default and the per-destination / per-program cards) renders the SAME
// mark in the SAME flat-editorial language. Satori (next/og) can't read CSS
// variables, so brand colors live here as literal hex mirrored from
// app/globals.css @theme — keep them in sync if the tokens move.

import { readFile } from 'node:fs/promises'
import { TEAL } from '@/lib/seo'

// Brand hex, mirrored from app/globals.css @theme (Satori needs literals).
export const OG = {
  cream: '#f3f1ec',
  paper: '#fbfaf6',
  ink: '#14201f', // --color-text
  ink2: '#4a5a58', // --color-text2
  ink3: '#5f6f6c', // --color-text3
  teal: TEAL, // #0d6e6e (--color-brand / strong value)
  tealDeep: '#0a5757',
  border: '#e2ddd2',
  good: '#0d6e6e', // green tier
  amber: '#8f5618', // amber tier
  muted: '#5f6f6c', // muted tier
} as const

// Value-tier → the hex hop uses for that cpp band. Mirrors lib/cpp tiers.
export function tierColor(t: 'green' | 'amber' | 'muted'): string {
  return t === 'green' ? OG.good : t === 'amber' ? OG.amber : OG.muted
}

// The full hop bunny — silhouette + carved negative space, mirrored from
// components/Logo.tsx (and app/opengraph-image.tsx) so the OG mark matches the
// live brand mark exactly. Satori renders <img src="data:…svg"> reliably.
const BUNNY_VIEWBOX = '0 0 462 466'
const BUNNY_INNER = `<path d="M114.94 64.5434C104.821 56.6099 86.3047 43.1079 84.5152 28.9884C83.9387 24.2849 85.3897 19.5579 88.5057 15.9874C98.0727 4.82442 129.861 1.31189 144.397 0.403892C197.493 -2.91311 248.285 14.2634 288.095 49.6209C292.145 53.2169 295.835 57.9589 300.155 61.2459C330.145 54.0364 361.78 59.1229 388 75.3729C408.865 88.2219 430.325 110.803 436.145 135.243C440.805 154.807 436.15 173.613 425.6 190.362C416.285 205.154 409.68 210.084 396.58 220.279C412.91 219.125 440.33 217.804 452.445 229.932C472.86 250.372 457.82 273.907 432.835 276.822C440.055 283.097 444.425 288.017 445.335 298.012C446.95 315.807 433.43 327.057 416.715 327.457C401.59 327.822 388.275 320.682 373.275 319.947C357.96 319.332 346.145 323.742 330.4 323.632L329.855 324.057C321.705 330.467 315.365 337.707 306.1 344.422C270.1 370.482 238.675 378.582 196.01 383.552C182.256 401.832 162.842 414.202 140.019 417.532L139.617 417.587C138.213 420.992 136.41 424.047 134.559 427.327C122.695 448.322 101.175 472.562 74.3802 462.832C68.3222 460.637 64.5497 456.462 61.4282 450.947C59.1072 453.042 56.8876 454.967 54.3831 456.672C40.8536 465.877 19.0267 469.962 6.81915 456.367C6.20415 455.682 5.80718 455.237 5.40018 454.407L4.72766 453.952C-7.15934 435.572 5.72515 420.747 17.4727 407.107C30.3957 392.097 34.1267 370.772 43.3457 353.787C49.7807 341.932 60.4317 338.267 73.0882 339.027C72.0067 333.442 71.3147 328.992 70.6172 323.342C45.2777 320.802 26.4377 300.272 29.0097 274.482C30.1607 262.282 36.1087 251.042 45.5462 243.227C62.5112 229.382 80.5157 231.387 98.1232 242.297C113.151 226.947 127.967 218.116 148.534 211.463C155.414 209.281 162.431 207.557 169.539 206.302C187.334 203.074 219.725 200.223 230.275 184.495C225.71 169.113 222.645 158.259 224.96 141.844C207.068 144.006 189.592 151.622 172.215 156.324C129.224 167.955 81.5512 162.612 44.3242 137.37C35.6672 131.5 32.6287 118.332 39.8227 110.411C57.4742 90.9744 89.7692 71.7629 114.94 64.5434Z" fill="__BODY__"/><path d="M6.31766 424.092C6.82566 428.382 7.45818 451.657 5.40018 454.407L4.72766 453.952C6.50166 444.892 4.75216 434.072 6.31766 424.092Z" fill="__BODY__"/><path d="M240.565 140.031C245.605 139.531 249.92 139.573 253.49 135.311C255.69 132.681 254.585 129.411 251.755 127.939C244.21 124.017 233.875 125.934 225.785 126.875C207.394 129.013 190.54 135.973 172.966 141.096C160.346 144.209 146.969 147.536 133.922 148.01C107.47 148.969 80.7152 141.93 57.7747 128.822C42.9162 120.332 55.4082 114.68 64.1547 107.673C112.204 69.1774 180.268 60.6284 238.315 78.5549C251.24 82.5384 262.215 88.5294 274.505 93.9024C275.475 94.3279 276.48 94.1319 277.435 93.7639C279.26 90.7234 277.43 88.5314 275.605 86.0709C303.065 72.3699 329.73 68.0414 359.58 77.9174C382.335 85.4449 406.77 105.389 417.795 127.049C418.18 127.805 418.34 128.36 418.595 129.162C416.6 131.358 415.48 129.542 413.53 131.553C410.62 134.56 408.99 140.594 404.03 140.509C399.58 140.433 390.38 133.329 386.525 136.784C377.445 144.927 396.485 152.803 400.905 155.265C400.67 182.507 373.805 188.891 356.635 169.826L356.04 169.163C361.585 165.55 364.42 160.723 355.515 159.089C349.665 158.015 337.42 169.159 337.64 175.022C337.865 180.976 343.88 181.348 348.13 176.101C350.705 179.256 353.125 182.402 356.425 184.83C371.545 195.953 392.52 194.461 404.345 179.581L405.89 177.798C408.43 180.215 410.565 180.821 413.835 181.852C401.52 201.493 380.3 216.578 357.715 221.642C350.97 223.182 344.085 224.022 337.165 224.142C331.75 224.217 313.635 221.912 311.38 223.152C310.375 224.792 310.6 223.927 310.675 225.837C313.11 230.227 320.99 232.642 325.66 233.977C342.21 238.702 353.72 236.202 369.7 232.272C367.275 240.097 364.835 248.452 361.485 255.912L360.545 255.742C354.05 254.557 341.49 248.507 335.645 252.382C334.475 253.157 333.79 254.242 333.55 255.622C333.185 257.697 333.7 260.287 334.985 261.977C341.585 270.627 382.79 272.327 395.065 275.092C405.12 277.357 416.205 281.402 424.055 288.307C427.885 291.677 431.06 296.367 430.61 301.697C430.3 305.117 428.565 308.247 425.825 310.312C414.34 319.082 388.36 304.417 374.01 305.092C361.965 304.512 350.195 307.777 338.335 308.852C326.215 309.957 315.015 306.377 304.85 299.967C300.895 297.472 290.84 287.962 286.455 292.217C274.67 303.652 304.46 316.797 311.925 320.297C285.975 343.087 259.865 356.682 225.89 364.052C220.095 365.312 211.002 367.002 205.246 367.252C209.299 354.472 213.855 336.577 209.012 323.382C207.715 319.842 202.194 318.867 199.322 320.967C198.243 321.752 196.671 323.117 196.556 324.547C195.926 329.882 196.772 335.252 196.365 340.647C195.027 359.447 185.77 376.787 170.9 388.362C155.532 400.092 135.513 405.062 116.358 402.612C104.021 401.032 95.1826 396.407 84.5406 390.487C79.1666 396.362 77.6867 403.737 73.9982 410.417C65.9277 425.037 54.8022 442.217 38.4802 448.447C27.5667 452.612 17.7627 451.002 14.7132 438.777C17.0472 428.372 23.6672 422.997 30.0292 415.027C37.5697 405.577 42.1407 395.687 46.4622 384.587C50.3997 375.252 52.4012 362.892 60.5292 356.122C67.7407 350.117 86.0507 359.537 89.7917 349.277C91.2822 345.192 86.5632 330.827 85.8667 325.617C81.1032 292.167 95.7572 258.912 123.66 239.857C132.549 233.712 142.836 228.552 153.231 225.547C160.218 223.582 167.291 221.937 174.43 220.627C193.018 217.135 237.845 212.196 244.395 187.682C245.91 182.006 241.2 170.602 240.725 164.813C239.39 155.66 239.48 149.094 240.565 140.031Z" fill="__CARVE__"/><path d="M172.219 87.8174C186.403 86.8864 207.939 90.1844 221.995 94.0299C228.13 95.7084 250.475 103.01 253.985 109.223C254.46 110.059 254.325 111.548 253.755 112.441C250.87 116.937 241.805 113.931 236.9 113.936C210.856 113.961 187.253 124.943 161.424 130.763C132.729 136.058 114.156 135.129 86.1362 125.278C83.5652 124.374 81.9127 123.448 80.7827 121.023C80.4287 115.374 89.7782 111.57 94.0407 109.092C118.777 94.7079 143.983 89.2264 172.219 87.8174Z" fill="__BODY__"/><path d="M324.055 112.259C338.845 111.373 354.4 117.703 361.805 132.011C364.465 137.154 357.55 140.035 352.745 138.718C346.495 137.007 339.57 136.164 333.19 138.195L332.53 138.413C329.39 139.997 324.415 143.087 320.765 140.663C318.43 139.114 319.48 135.599 321.03 133.756C325.675 128.22 333.615 126.904 340.415 126.226C332 121.66 328.05 123.038 319.235 121.201C317.475 120.834 316.035 119.752 315.165 118.113C314.76 113.269 320.655 112.669 324.055 112.259Z" fill="__BODY__"/><path d="M146.627 14.8064C148.73 14.6374 150.73 14.5924 152.836 14.5499C201.744 13.2504 249.09 31.8289 284.06 66.0429C277.76 68.7164 273.23 70.9994 267.47 74.6804C258.4 70.8634 252.545 67.9784 242.885 64.5649C204.379 53.8324 176.744 52.2554 137.433 59.0734C125.278 54.3054 103.906 40.3854 99.2127 28.2174C95.7892 19.3409 141.402 15.2134 146.627 14.8064Z" fill="__CARVE__"/><path d="M68.8831 248.227C77.1341 247.607 81.9352 250.287 88.6437 254.277C75.7952 274.657 73.2637 284.817 70.2492 308.342L64.7247 307.282C62.3572 306.417 60.5172 305.712 58.3452 304.422C51.4627 300.332 46.5187 293.642 44.6302 285.862C42.7152 277.642 44.1117 269.002 48.5177 261.802C53.3802 253.997 60.2291 250.247 68.8831 248.227Z" fill="__CARVE__"/><path d="M409.01 234.307C418.61 233.512 433.795 234.772 441.885 240.742C446.775 244.352 449.27 251.182 444.73 256.127C438.3 263.132 425.64 262.732 416.83 263.067C406.575 263.297 401.27 261.337 391.415 259.197C387.055 258.252 381.675 257.567 377.195 256.972C379.945 249.797 381.925 244.542 383.6 236.967C392.03 235.747 400.51 234.857 409.01 234.307Z" fill="__CARVE__"/><path d="M90.3487 410.522C101.145 415.457 110.428 417.702 122.214 418.302C117.449 427.352 109.669 437.872 101.52 444.142C95.1292 448.717 88.6116 452.062 80.6041 449.152C75.8286 447.637 73.8337 442.297 75.7732 437.737C78.5292 431.252 83.3176 425.112 86.5051 418.752C87.9151 415.942 89.1317 413.422 90.3487 410.522Z" fill="__CARVE__"/><path d="M421.945 139.921C425.13 143.568 423.225 167.203 418.775 170.909C416.79 171.275 415.89 170.695 413.905 169.963C409.505 166.748 411.72 158.637 412.12 153.405C417.53 148.586 418.475 146.041 421.945 139.921Z" fill="__CARVE__"/><path d="M404.345 179.581C403.01 178.124 400.475 177.067 401.005 174.801C402.615 174.908 404.51 176.726 405.89 177.798L404.345 179.581Z" fill="__BODY__"/><path d="M423.37 319.722C426.185 319.962 428.29 319.872 431.14 320.347L431.255 321.277C428.935 322.227 425.375 321.107 423.37 319.722Z" fill="__BODY__"/><path d="M82.9082 455.362C85.3332 454.927 88.1987 454.517 90.5222 455.417C87.3152 456.197 85.9552 456.507 82.9082 455.362Z" fill="__BODY__"/><path d="M45.4742 371.457L45.9017 371.822C46.5712 373.297 46.3072 375.122 46.2417 376.797L45.7272 376.397C44.9597 374.867 45.3337 373.242 45.4742 371.457Z" fill="__BODY__"/>`

// The bunny as a data-URI SVG, tinted for whatever panel it sits on.
// Defaults match the teal-panel treatment used on the site default card.
export function bunnyDataUri(body = '#eafaf7', carve = '#0a5e5e'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BUNNY_VIEWBOX}">${BUNNY_INNER.replace(
    /__BODY__/g,
    body,
  ).replace(/__CARVE__/g, carve)}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// The hop brand mark for a card corner: just the bunny, teal on the cream canvas
// (carve = canvas, so the negative space reads through). No wordmark — the mark
// stands alone. Large by default so it reads at small preview sizes.
export function Brand({ size = 120 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>, not next/image
  return <img src={bunnyDataUri(OG.teal, OG.cream)} width={size} height={size} alt="" />
}

// A small teal separator dot for the inline value line.
export function Dot() {
  return (
    <div style={{ display: 'flex', width: 7, height: 7, borderRadius: 4, background: OG.teal, margin: '0 18px' }} />
  )
}

// The brand fonts as Satori font descriptors — Bricolage Grotesque (display) and
// General Sans (body), matching app/globals.css. Vendored under lib/fonts (Satori
// needs TTF/OTF/WOFF, not the WOFF2 next/font ships). Read once and memoized;
// resolved via import.meta.url so Next traces the files into the function bundle.
type OgFont = { name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' }
let fontsPromise: Promise<OgFont[]> | null = null
export function ogFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(new URL('./fonts/BricolageGrotesque-700.woff', import.meta.url)),
      readFile(new URL('./fonts/GeneralSans-Regular.otf', import.meta.url)),
      readFile(new URL('./fonts/GeneralSans-Semibold.otf', import.meta.url)),
    ]).then(([display, body, bodySemi]) => [
      { name: 'Bricolage Grotesque', data: display, weight: 700, style: 'normal' },
      { name: 'General Sans', data: body, weight: 400, style: 'normal' },
      { name: 'General Sans', data: bodySemi, weight: 600, style: 'normal' },
    ])
  }
  return fontsPromise
}

// Font families to set on cards (Satori matches by these names + weight).
export const FONT_DISPLAY = 'Bricolage Grotesque'
export const FONT_BODY = 'General Sans'

// Reusable page-level OG card layout: bunny mark top-left, eyebrow + title +
// description stacked at the bottom. Flat editorial on cream canvas.
export interface PageOgCardProps {
  eyebrow: string
  title: string
  description: string
}

export function PageOgCard({ eyebrow, title, description }: PageOgCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: OG.cream,
        padding: 84,
        justifyContent: 'space-between',
        fontFamily: FONT_BODY,
      }}
    >
      <Brand size={80} />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            fontWeight: 600,
            color: OG.teal,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </div>

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 96,
            fontWeight: 700,
            color: OG.ink,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginTop: 16,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 32,
            color: OG.ink2,
            marginTop: 28,
            maxWidth: 900,
            lineHeight: 1.45,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  )
}
