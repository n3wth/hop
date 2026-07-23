import { Response } from 'hop'

export function Markdown() {
  return (
    <Response>
      {`**United MileagePlus** gets you to Tokyo for **70,000 miles** one-way in business — a 5.4¢/pt value.\n\n- Cash fare: $3,800\n- Points fare: 70,000 miles + $43 taxes\n\nThat's well above hop's 2.5¢ points threshold, so we'd use points here.`}
    </Response>
  )
}
