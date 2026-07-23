import { LegalShell } from 'hop'

export function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Terms of Service"
      intro="The rules for using hop — plain language, no fine-print surprises."
      lastUpdated="July 1, 2026"
    >
      <p>
        By using hop you agree to these terms. We compute cents-per-point value from your real
        loyalty balances and public award/cash pricing — we never fabricate a number.
      </p>
      <p>
        You&rsquo;re responsible for the accuracy of the loyalty programs you connect. hop is not a
        travel agency and does not guarantee award availability.
      </p>
    </LegalShell>
  )
}

export function SupportPage() {
  return (
    <LegalShell eyebrow="Help" title="Support" intro="Answers to the questions we hear most.">
      <p>Reach us at support@hop.flights — we typically reply within one business day.</p>
    </LegalShell>
  )
}
