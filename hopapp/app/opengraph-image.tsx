import { ImageResponse } from 'next/og'
import { DEFAULT_TITLE, TAGLINE, TEAL, CREAM, INK } from '@/lib/seo'

// Default social card for the whole site (1200×630). Flat, on-brand: cream bg,
// the hop leaping-bunny silhouette in teal, the wordmark, and the tagline.
// No emoji, no gradients/shadows. Wired as both og:image and twitter:image via
// the opengraph-image file convention (Next mirrors it to twitter automatically).

export const alt = 'hop — points vs cash, settled'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// The leaping bunny silhouette (same path as public/favicon-bunny.svg), inlined
// as an SVG data URI. Satori renders <img src=data:…> reliably, sidestepping
// raw SVG-element quirks. Tinted teal via the path fill.
const BUNNY_PATH =
  'M114.94 64.5434C104.821 56.6099 86.3047 43.1079 84.5152 28.9884C83.9387 24.2849 85.3897 19.5579 88.5057 15.9874C98.0727 4.82442 129.861 1.31189 144.397 0.403892C197.493 -2.91311 248.285 14.2634 288.095 49.6209C292.145 53.2169 295.835 57.9589 300.155 61.2459C330.145 54.0364 361.78 59.1229 388 75.3729C408.865 88.2219 430.325 110.803 436.145 135.243C440.805 154.807 436.15 173.613 425.6 190.362C416.285 205.154 409.68 210.084 396.58 220.279C412.91 219.125 440.33 217.804 452.445 229.932C472.86 250.372 457.82 273.907 432.835 276.822C440.055 283.097 444.425 288.017 445.335 298.012C446.95 315.807 433.43 327.057 416.715 327.457C401.59 327.822 388.275 320.682 373.275 319.947C357.96 319.332 346.145 323.742 330.4 323.632L329.855 324.057C321.705 330.467 315.365 337.707 306.1 344.422C270.1 370.482 238.675 378.582 196.01 383.552C182.256 401.832 162.842 414.202 140.019 417.532L139.617 417.587C138.213 420.992 136.41 424.047 134.559 427.327C122.695 448.322 101.175 472.562 74.3802 462.832C68.3222 460.637 64.5497 456.462 61.4282 450.947C59.1072 453.042 56.8876 454.967 54.3831 456.672C40.8536 465.877 19.0267 469.962 6.81915 456.367C6.20415 455.682 5.80718 455.237 5.40018 454.407L4.72766 453.952C-7.15934 435.572 5.72515 420.747 17.4727 407.107C30.3957 392.097 34.1267 370.772 43.3457 353.787C49.7807 341.932 60.4317 338.267 73.0882 339.027C72.0067 333.442 71.3147 328.992 70.6172 323.342C45.2777 320.802 26.4377 300.272 29.0097 274.482C30.1607 262.282 36.1087 251.042 45.5462 243.227C62.5112 229.382 80.5157 231.387 98.1232 242.297C113.151 226.947 127.967 218.116 148.534 211.463C155.414 209.281 162.431 207.557 169.539 206.302C187.334 203.074 219.725 200.223 230.275 184.495C225.71 169.113 222.645 158.259 224.96 141.844C207.068 144.006 189.592 151.622 172.215 156.324C129.224 167.955 81.5512 162.612 44.3242 137.37C35.6672 131.5 32.6287 118.332 39.8227 110.411C57.4742 90.9744 89.7692 71.7629 114.94 64.5434Z'

const bunnySrc = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 462 466"><path fill="${TEAL}" d="${BUNNY_PATH}"/></svg>`,
)}`

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CREAM,
          padding: '80px 88px',
        }}
      >
        {/* top row: wordmark + bunny */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              fontStyle: 'italic',
              color: TEAL,
              letterSpacing: '-0.02em',
            }}
          >
            hop
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bunnySrc} width={150} height={151} alt="" />
        </div>

        {/* headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.04,
              letterSpacing: '-0.03em',
              maxWidth: 980,
            }}
          >
            {DEFAULT_TITLE}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 64, height: 6, background: TEAL, borderRadius: 3 }} />
            <div style={{ fontSize: 38, fontWeight: 500, color: TEAL }}>
              {TAGLINE}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
