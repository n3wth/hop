'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DuffelCardForm,
  useDuffelCardFormActions,
  createThreeDSecureSession,
} from '@duffel/components'
import type { CheckoutOffer, CheckoutPassenger } from '@/lib/types'
import { startPaymentSession, placeOrder } from '@/app/actions/checkout'
import Icon from '@/components/Icon'
import BrandIcon from '@/components/BrandIcon'

// Native cash checkout — itinerary summary, passenger details, the Duffel hosted
// card form, and the pay action. Flat, on-brand. The card form runs in a
// PCI-scoped iframe; the temp card + 3DS session are produced client-side, then
// the order is created by a server action (the price is re-verified there).

type Title = CheckoutPassenger['title']
type Gender = CheckoutPassenger['gender']

interface PassengerDraft {
  title: Title
  givenName: string
  familyName: string
  bornOn: string
  gender: Gender
  email: string
  phoneNumber: string
}

function emptyPassenger(email?: string, name?: string): PassengerDraft {
  // Prefill the first traveler's name from the signed-in profile (best-effort
  // split on the last space — the user can correct it). Saves typing for the
  // common case of booking for yourself.
  let givenName = ''
  let familyName = ''
  const trimmed = name?.trim()
  if (trimmed) {
    const parts = trimmed.split(/\s+/)
    givenName = parts.slice(0, -1).join(' ') || parts[0]
    familyName = parts.length > 1 ? parts[parts.length - 1] : ''
  }
  return {
    title: 'mr',
    givenName,
    familyName,
    bornOn: '',
    gender: 'm',
    email: email ?? '',
    phoneNumber: '',
  }
}

function money(amount: string, currency: string): string {
  const n = Number(amount)
  if (isNaN(n)) return `${amount} ${currency}`
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency}`
  }
}

function timeOf(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function dateOf(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

const CARD_STYLES = {
  input: {
    default: {
      'background-color': '#fbfaf6',
      border: '1.5px solid #e2ddd2',
      'border-radius': '11px',
      color: '#14201f',
      'font-size': '15px',
      padding: '11px 13px',
    },
    focus: {
      border: '1.5px solid #0d6e6e',
      outline: 'none',
      'box-shadow': '0 0 0 3px rgba(13, 110, 110, 0.12)',
    },
  },
  label: {
    color: '#4a5a58',
    'font-size': '12.5px',
    'font-weight': '600',
    'letter-spacing': '0.01em',
  },
  inputErrorMessage: { color: '#a8513a', 'font-size': '12px' },
}

export default function CheckoutForm({
  offer,
  defaultEmail,
  defaultName,
}: {
  offer: CheckoutOffer
  defaultEmail?: string
  defaultName?: string
}) {
  const router = useRouter()
  const count = Math.max(1, offer.passengerCount)
  const [passengers, setPassengers] = useState<PassengerDraft[]>(() =>
    Array.from({ length: count }, (_, i) =>
      emptyPassenger(i === 0 ? defaultEmail : undefined, i === 0 ? defaultName : undefined),
    ),
  )

  const cardActions = useDuffelCardFormActions()
  const [clientKey, setClientKey] = useState<string | null>(null)
  const [cardValid, setCardValid] = useState(false)
  const [pending, startTransition] = useTransition()
  const [stage, setStage] = useState<'idle' | 'starting' | 'carding' | 'authing' | 'ordering'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)

  const total = money(offer.totalAmount, offer.totalCurrency)

  function update(i: number, patch: Partial<PassengerDraft>) {
    setPassengers((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  }

  // Lazily mint the component client key the first time the card form is needed.
  async function ensureClientKey(): Promise<string | null> {
    if (clientKey) return clientKey
    setStage('starting')
    const res = await startPaymentSession()
    if (!res.ok) {
      setError(res.reason)
      setStage('idle')
      return null
    }
    setClientKey(res.data)
    return res.data
  }

  function validate(): string | null {
    for (const [i, p] of passengers.entries()) {
      const who = count > 1 ? `Passenger ${i + 1}: ` : ''
      if (!p.givenName.trim()) return `${who}first name is required`
      if (!p.familyName.trim()) return `${who}last name is required`
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.bornOn)) return `${who}date of birth is required`
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) return `${who}a valid email is required`
      if (!/^\+?[0-9 ]{7,}$/.test(p.phoneNumber)) return `${who}a valid phone number is required`
    }
    return null
  }

  // The card form yields a temporary card id; from there we run 3DS, then hand
  // off to the server action to create the order.
  async function onCardCreated(cardId: string) {
    try {
      setStage('authing')
      const key = clientKey
      if (!key) throw new Error('Payment session expired — try again')
      const session = await createThreeDSecureSession(key, cardId, offer.id, [], true)
      if (session.status !== 'ready_for_payment') {
        setError('Card authentication did not complete. Try a different card.')
        setStage('idle')
        return
      }
      submitOrder(session.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment authentication failed')
      setStage('idle')
    }
  }

  function submitOrder(threeDSecureSessionId: string) {
    setStage('ordering')
    startTransition(async () => {
      const res = await placeOrder({
        offerId: offer.id,
        passengers: passengers.map((p) => ({ ...p, id: '' })),
        threeDSecureSessionId,
      })
      if (!res.ok) {
        setError(res.reason)
        setStage('idle')
        return
      }
      router.push(`/book/confirmation?order=${encodeURIComponent(res.data.id)}`)
    })
  }

  // Pay button: validate passengers, ensure the card form is mounted + valid,
  // then trigger the temp-card creation (its success callback drives the rest).
  async function onPay() {
    setError(null)
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }
    const key = await ensureClientKey()
    if (!key) return
    if (!cardValid) {
      setError('Enter your card details to continue')
      setStage('idle')
      return
    }
    setStage('carding')
    cardActions.createCardForTemporaryUse()
  }

  const busy = pending || stage !== 'idle'
  const stageLabel: Record<typeof stage, string> = {
    idle: 'Pay',
    starting: 'Starting secure session…',
    carding: 'Securing your card…',
    authing: 'Authenticating…',
    ordering: 'Booking…',
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
      {/* LEFT — passenger + payment */}
      <div className="min-w-0">
        <h1 className="font-display text-[30px] font-semibold tracking-[-0.02em] text-text sm:text-[34px]">
          Book this flight
        </h1>
        <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.55] text-text2">
          Enter traveler details and pay securely. You&apos;ll get a confirmation with your booking
          reference.
        </p>

        {/* passengers */}
        <div className="mt-8 space-y-5">
          {passengers.map((p, i) => (
            <section key={i} className="rounded-[18px] border border-border bg-surface p-6 sm:p-7">
              <div className="mb-6 flex items-center gap-3 border-b border-hair pb-4">
                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-brand-light text-[13px] font-semibold tabular-nums text-brand">
                  {i + 1}
                </span>
                <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text">
                  {count > 1 ? `Traveler ${i + 1}` : 'Traveler'}
                </h2>
                {i === 0 ? (
                  <span className="ml-auto text-[12px] font-medium text-text3">
                    As shown on passport
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-12 gap-x-4 gap-y-5">
                <Field className="col-span-12 sm:col-span-3" label="Title">
                  <Select
                    value={p.title}
                    onChange={(v) => update(i, { title: v as Title })}
                    options={[
                      ['mr', 'Mr'],
                      ['ms', 'Ms'],
                      ['mrs', 'Mrs'],
                      ['miss', 'Miss'],
                    ]}
                  />
                </Field>
                <Field className="col-span-6 sm:col-span-5" label="First name">
                  <Input
                    value={p.givenName}
                    onChange={(v) => update(i, { givenName: v })}
                    autoComplete="given-name"
                  />
                </Field>
                <Field className="col-span-6 sm:col-span-4" label="Last name">
                  <Input
                    value={p.familyName}
                    onChange={(v) => update(i, { familyName: v })}
                    autoComplete="family-name"
                  />
                </Field>

                <Field className="col-span-7 sm:col-span-4" label="Date of birth">
                  <Input type="date" value={p.bornOn} onChange={(v) => update(i, { bornOn: v })} />
                </Field>
                <Field className="col-span-5 sm:col-span-2" label="Gender">
                  <Select
                    value={p.gender}
                    onChange={(v) => update(i, { gender: v as Gender })}
                    options={[
                      ['m', 'M'],
                      ['f', 'F'],
                    ]}
                  />
                </Field>
                <Field className="col-span-12 sm:col-span-6" label="Phone">
                  <Input
                    type="tel"
                    value={p.phoneNumber}
                    onChange={(v) => update(i, { phoneNumber: v })}
                    placeholder="+1 415 555 0100"
                    autoComplete="tel"
                  />
                </Field>

                <Field className="col-span-12" label="Email">
                  <Input
                    type="email"
                    value={p.email}
                    onChange={(v) => update(i, { email: v })}
                    autoComplete="email"
                  />
                </Field>
              </div>
            </section>
          ))}
        </div>

        {/* payment */}
        <section className="mt-5 rounded-[18px] border border-border bg-surface p-6 sm:p-7">
          <div className="mb-6 flex items-center gap-3 border-b border-hair pb-4">
            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-brand-light text-brand">
              <Icon name="lock" size={15} />
            </span>
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text">
              Payment
            </h2>
            <span className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-text3">
              <Icon name="shield" size={13} className="text-brand" />
              Encrypted
            </span>
          </div>

          {clientKey ? (
            <DuffelCardForm
              ref={cardActions.ref}
              clientKey={clientKey}
              intent="to-create-card-for-temporary-use"
              styles={CARD_STYLES}
              onValidateSuccess={() => setCardValid(true)}
              onValidateFailure={() => setCardValid(false)}
              onCreateCardForTemporaryUseSuccess={(data) => onCardCreated(data.id)}
              onCreateCardForTemporaryUseFailure={() => {
                setError('We couldn’t process that card. Check the details and try again.')
                setStage('idle')
              }}
            />
          ) : (
            <button
              type="button"
              onClick={ensureClientKey}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-border bg-paper px-4 py-3.5 text-[14px] font-semibold text-text2 transition-colors hover:border-brand hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stage === 'starting' ? (
                <span className="h-[16px] w-[16px] animate-spin rounded-full border-2 border-text3/40 border-t-text2 motion-reduce:animate-none" />
              ) : (
                <Icon name="credit_card" size={16} />
              )}
              {stage === 'starting' ? 'Loading secure form…' : 'Add card details'}
            </button>
          )}

          <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-[1.5] text-text3">
            <Icon name="info" size={13} className="mt-px flex-shrink-0" />
            <span>
              Card details go straight to Duffel&apos;s PCI-compliant form — hop never sees your
              number. Test mode, so no real charge.
            </span>
          </p>
        </section>

        {error ? (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-[12px] border border-weak/20 bg-weak-bg px-4 py-3.5 text-[13.5px] leading-[1.5] text-weak"
          >
            <Icon name="error" size={16} className="mt-px flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onPay}
          disabled={busy}
          aria-busy={busy}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-[13px] bg-brand px-6 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? (
            <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
          ) : (
            <Icon name="lock" size={17} />
          )}
          {busy ? stageLabel[stage] : `Pay ${total}`}
        </button>

        <p className="mt-3 text-center text-[12px] text-text3">
          By booking you agree to the airline&apos;s fare rules. Confirmation sent to your email.
        </p>
      </div>

      {/* RIGHT — itinerary summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[18px] border border-border bg-paper p-6">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text3">
            Your itinerary
          </div>
          <div className="flex items-center gap-3 border-b border-border pb-5 pt-3">
            <BrandIcon code={offer.airlineCode} name={offer.airline} size={40} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-text">{offer.airline}</div>
              <div className="text-[12px] text-text3">{offer.route}</div>
            </div>
          </div>

          <div className="space-y-5 py-5">
            {offer.segments.map((s, i) => (
              <div key={i}>
                {dateOf(s.departingAt) ? (
                  <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-text3">
                    {dateOf(s.departingAt)}
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <div className="w-[64px]">
                    <div className="font-display text-[17px] font-semibold leading-none tracking-[-0.01em] text-text">
                      {s.origin ?? '—'}
                    </div>
                    <div className="mt-1.5 text-[11px] tabular-nums text-text3">
                      {timeOf(s.departingAt)}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col items-center">
                    <div className="flex w-full items-center gap-1.5 text-brand">
                      <span className="h-px flex-1 bg-border" />
                      <Icon name="flight" size={14} className="rotate-90" />
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    {s.flightNumber ? (
                      <span className="mt-1 text-[10px] tabular-nums text-text3">
                        {s.flightNumber}
                      </span>
                    ) : null}
                  </div>
                  <div className="w-[64px] text-right">
                    <div className="font-display text-[17px] font-semibold leading-none tracking-[-0.01em] text-text">
                      {s.destination ?? '—'}
                    </div>
                    <div className="mt-1.5 text-[11px] tabular-nums text-text3">
                      {timeOf(s.arrivingAt)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 border-t border-border pt-5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-text2">
                Fare{count > 1 ? ` × ${count} travelers` : ''}
              </span>
              <span className="tabular-nums text-text2">{total}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-text2">Taxes &amp; fees</span>
              <span className="text-text3">Included</span>
            </div>
            <div className="flex items-center justify-between border-t border-hair pt-3">
              <span className="text-[13px] font-semibold text-text">Total due</span>
              <span className="font-display text-[22px] font-semibold tabular-nums tracking-[-0.01em] text-text">
                {total}
              </span>
            </div>
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-hair pt-4 text-[11.5px] font-medium text-text3">
            <Icon name="lock" size={12} className="text-brand" />
            Secure checkout
          </p>
        </div>
      </aside>
    </div>
  )
}

// --- field primitives — flat, brand tokens --------------------------------

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <span className="text-[12.5px] font-semibold tracking-[0.01em] text-text2">{label}</span>
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[11px] border-[1.5px] border-border bg-paper px-3 py-[10px] text-[14.5px] text-text outline-none transition-colors placeholder:text-text3 focus:border-brand focus:ring-[3px] focus:ring-brand/15"
    />
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<[string, string]>
}) {
  // Custom-styled native select: appearance-none kills the OS chrome, and we draw
  // our own chevron so it matches the Inputs exactly (same height, border, font).
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-[11px] border-[1.5px] border-border bg-paper px-3 py-[10px] pr-9 text-[14.5px] text-text outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand/15"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        size={18}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text3"
      />
    </div>
  )
}
