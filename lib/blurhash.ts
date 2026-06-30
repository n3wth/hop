// Decodes a BlurHash string (which Unsplash returns for every photo) into a tiny
// blurred placeholder — used as the background of an image frame so a photo fades
// up from a colored blur of itself instead of a flat tile or a pop-in. Pure,
// dependency-free, server-safe. We emit an inline SVG data URI (a coarse color
// grid under a heavy Gaussian blur), so there's no raster encoder and no client
// JS: a still-loading <img> is transparent, so the placeholder shows through, and
// the photo simply paints over it when it arrives.
//
// Algorithm is the reference BlurHash decode (github.com/woltapp/blurhash).

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

function decode83(str: string): number {
  let value = 0
  for (const c of str) {
    const i = DIGITS.indexOf(c)
    if (i === -1) return NaN
    value = value * 83 + i
  }
  return value
}

function sRGBToLinear(v: number): number {
  const x = v / 255
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

function linearToSRGB(v: number): number {
  const x = Math.max(0, Math.min(1, v))
  return x <= 0.0031308
    ? Math.round(x * 12.92 * 255)
    : Math.round((1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255)
}

function signPow(v: number, exp: number): number {
  return Math.sign(v) * Math.pow(Math.abs(v), exp)
}

function hex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((x) => linearToSRGB(x).toString(16).padStart(2, '0')).join('')
}

interface Decoded {
  numX: number
  numY: number
  colors: number[][] // linear RGB per component
}

function decodeComponents(hash: string, punch = 1): Decoded | null {
  if (!hash || hash.length < 6) return null
  const sizeFlag = decode83(hash[0])
  if (Number.isNaN(sizeFlag)) return null
  const numY = Math.floor(sizeFlag / 9) + 1
  const numX = (sizeFlag % 9) + 1
  if (hash.length !== 4 + 2 * numX * numY) return null
  const quantMax = decode83(hash[1])
  if (Number.isNaN(quantMax)) return null
  const maximumValue = ((quantMax + 1) / 166) * punch

  const colors: number[][] = []
  for (let i = 0; i < numX * numY; i++) {
    if (i === 0) {
      const v = decode83(hash.substring(2, 6))
      colors.push([sRGBToLinear(v >> 16), sRGBToLinear((v >> 8) & 255), sRGBToLinear(v & 255)])
    } else {
      const v = decode83(hash.substring(4 + i * 2, 6 + i * 2))
      if (Number.isNaN(v)) return null
      const qR = Math.floor(v / (19 * 19))
      const qG = Math.floor(v / 19) % 19
      const qB = v % 19
      colors.push([
        signPow((qR - 9) / 9, 2) * maximumValue,
        signPow((qG - 9) / 9, 2) * maximumValue,
        signPow((qB - 9) / 9, 2) * maximumValue,
      ])
    }
  }
  return { numX, numY, colors }
}

// The average (DC) color of a BlurHash, as a hex string. Null on a bad hash.
export function averageColorHex(hash: string): string | null {
  const d = decodeComponents(hash)
  if (!d) return null
  return hex(d.colors[0])
}

// A blurred placeholder for a BlurHash as an SVG data URI (coarse color grid +
// heavy blur). `w`×`h` is the sample grid — small keeps the URI light; the blur
// makes it smooth regardless. Null on a bad hash.
export function blurhashToDataUri(hash: string, w = 8, h = 6): string | null {
  const d = decodeComponents(hash)
  if (!d) return null
  const { numX, numY, colors } = d

  const cellW = 100 / w
  const cellH = 100 / h
  let rects = ''
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0
      for (let j = 0; j < numY; j++) {
        for (let i = 0; i < numX; i++) {
          const basis = Math.cos((Math.PI * (x + 0.5) * i) / w) * Math.cos((Math.PI * (y + 0.5) * j) / h)
          const c = colors[i + j * numX]
          r += c[0] * basis
          g += c[1] * basis
          b += c[2] * basis
        }
      }
      rects += `<rect x="${(x * cellW).toFixed(2)}" y="${(y * cellH).toFixed(2)}" width="${cellW.toFixed(2)}" height="${cellH.toFixed(2)}" fill="${hex([r, g, b])}"/>`
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    `<filter id="b"><feGaussianBlur stdDeviation="8"/></filter>` +
    `<g filter="url(#b)">${rects}</g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
