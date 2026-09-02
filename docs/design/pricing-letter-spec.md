# hop Pro plan sheet: one-page letter PDF spec

A printable, single-page summary of the Free and Pro plans. Uses: the second-family judge's
review copy, Holly's support desk reference, and a leave-behind. Content is copied verbatim
from `pricing-pro-copy.md`; if the two disagree, the markdown wins.

## Page

- Size: US Letter, 8.5 x 11 in, portrait. One page. Overflow is a defect, cut content.
- Margins: 0.75 in all sides. Live area 7 x 9.5 in.
- Grid: 12 columns, 0.2 in gutter. Two content columns of 6 each below the header.
- Colour: true black `#000000` on white `#FFFFFF`. No greys for text. No fills, tints,
  shadows, gradients, or icons.
- Rules: 1 px hairlines, black. Used only where listed below.
- Export: Chromium print to PDF from an HTML page at 100 percent scale, `@page { size:
  letter; margin: 0.75in }`, backgrounds off. Embed the fonts. Target under 300 KB.

## Type

| Role | Face | Weight | Size / leading | Tracking |
|---|---|---|---|---|
| Title | Satoshi | 600 | 28 / 32 pt | -0.01 em |
| Section heading | Satoshi | 600 | 13 / 16 pt | 0 |
| Plan name | Satoshi | 500 | 16 / 20 pt | 0 |
| Price | Satoshi | 600 | 24 / 28 pt | -0.01 em |
| Body and table cells | Geist | Medium 500 | 10 / 14.5 pt | 0 |
| Footnote | Geist | Medium 500 | 8.5 / 12 pt | 0 |
| Codes only | Geist Mono | 400 | 9 / 14.5 pt | 0 |

Satoshi never exceeds 600. No italics anywhere. No bold inside body text; emphasis comes
from the section heading. Geist Mono appears only in the error-code column. City names,
never airport codes, in any example.

## Layout, top to bottom

1. Header, full width. Left: `hop` wordmark set as plain Satoshi 600, 13 pt, no logo
   art. Right: `Pricing · September 2026`, Geist 8.5 pt. Hairline below, full width, 12 pt
   space under it.

2. Title block, full width, 24 pt below the hairline.
   - Title: `Search is free. Pro is $49 a year.`
   - Subline, Geist 10 pt, max width 5 in: `The verdict never goes behind a paywall. Pro
     lifts the 3-alert cap: hop re-runs your saved routes and emails you when points beat
     cash on your terms.`

3. Plan table, full width, 28 pt below the subline. Three columns: row label 2.4 in, Free
   2.3 in, Pro 2.3 in. Header row: blank, `Free`, `Pro` in plan-name style with the price
   under each (`$0`, `forever`; `$49`, `a year`). Hairline under the header row and under
   the last row only. No vertical rules. Row leading 22 pt.

   | | Free | Pro |
   |---|---|---|
   | Search and the verdict | Included | Included |
   | Active route alerts | 3 | Unlimited |
   | Agent calls a day | 25 | 1,000 |
   | Billing | None | Once a year through Stripe |
   | Cancel | n/a | Any time. Pro runs to the end of the paid year. |

   Under the table, footnote style: `Early price. Stays $49 for as long as you keep the
   subscription.`

4. Two columns, 28 pt below the footnote, 0.4 in gutter between them.

   Left column, heading `What an alert is`:
   `A route you ask hop to watch, in plain English: San Francisco to Tokyo in business,
   under 70,000 miles. hop re-runs the verdict on a schedule and emails you when points
   beat cash on your terms.`

   Then heading `What an agent call is`, 16 pt below:
   `hop's engine is also an MCP server, so an agent like Claude can price trips and check
   your balances. Each tool call counts toward the daily quota. Using the site yourself
   never counts.`

   Right column, heading `If something goes wrong`. A four-row mini table, code column in
   Geist Mono, message column in Geist. Hairline above and below the block only.

   | Code | You see |
   |---|---|
   | `stripe` | Couldn't open checkout. Nothing was charged. Try again in a minute. |
   | `rate-limited` | Too many tries. Wait a minute and try again. |
   | `no-customer` | There's no subscription on this account. Get Pro from Pricing first. |
   | Paid, still Free | Payment received. Pro switches on within a minute. Refresh to check. |

   Under it, body style: `Card declines and bank verification happen on Stripe's page.
   Nothing is charged until Stripe says so.`

5. Footer, pinned to the bottom of the live area. Hairline above, full width, 10 pt space.
   Left, Geist 8.5 pt: `Questions or a wrong charge: hop@n3wth.com from the address on your
   account. A person replies.` Right, Geist 8.5 pt: `hop.flights/pricing`.

## Rules of the sheet

- Every number on the page is one of 3, 25, 1,000, 49. Nothing else numeric appears
  except the date in the header.
- No sentence promises the weekly digest, a price drop alert, or a refund window.
- If a section overflows, cut the right-column mini table first, then the second left
  paragraph. Never shrink type below the scale above.
- Redeploying the sheet means regenerating from the markdown, not editing the PDF.
