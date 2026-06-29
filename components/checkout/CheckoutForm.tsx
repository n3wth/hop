'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DuffelCardForm,
  useDuffelCardFormActions,
  createThreeDSecureSession,
} from '@duffel/components'
import type { CheckoutOffer, CheckoutPassenger } from '@/lib/types'
import { startPaymentSession, placeOrder, refreshOffer } from '@/app/actions/checkout'
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

// Strip everything but digits and a leading +, so spaces/dashes/parens entered
// by the user don't fail the phone check (and so we hand Duffel a clean number).
function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const plus = trimmed.startsWith('+') ? '+' : ''
  return plus + trimmed.replace(/[^\d]/g, '')
}

// Today / a sane floor for the date-of-birth picker (no future DOBs; nobody is
// 120+). Both as YYYY-MM-DD for the native date input's min/max.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
const TODAY_ISO = isoDate(new Date())
const DOB_MIN_ISO = (() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 120)
  return isoDate(d)
})()

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
      // Traveler 1 gets the signed-in name; everyone's contact defaults to the
      // signed-in email (one shared contact is the common case) until edited.
      emptyPassenger(defaultEmail, i === 0 ? defaultName : undefined),
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

  // The live offer + its held price. When the price expires mid-checkout we
  // re-fetch in place and update the total, rather than failing the order with a
  // raw rejection.
  const [activeOffer, setActiveOffer] = useState<CheckoutOffer>(offer)
  const [expired, setExpired] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Per-field refs so a validation failure can move focus to the first bad input
  // (React 19: refs are written in render via the callback, read only in handlers).
  const fieldRefs = useRef<Map<string, HTMLElement>>(new Map())
  const setFieldRef = (key: string) => (el: HTMLElement | null) => {
    if (el) fieldRefs.current.set(key, el)
    else fieldRefs.current.delete(key)
  }
  // Which field is currently flagged invalid (for aria-invalid).
  const [invalidKey, setInvalidKey] = useState<string | null>(null)

  const total = money(activeOffer.totalAmount, activeOffer.totalCurrency)
  const priceHeld = (() => {
    if (!activeOffer.expiresAt || expired) return null
    const d = new Date(activeOffer.expiresAt)
    if (isNaN(d.getTime())) return null
    return `Price held until ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  })()

  // Watch the held price: when it lapses, surface the expiry state. Re-checks on
  // a timer so the user sees it even if they sit on the page.
  useEffect(() => {
    const at = activeOffer.expiresAt ? new Date(activeOffer.expiresAt).getTime() : NaN
    if (isNaN(at)) return
    const tick = () => setExpired(Date.now() >= at)
    tick()
    const id = window.setInterval(tick, 15_000)
    return () => window.clearInterval(id)
  }, [activeOffer.expiresAt])

  async function refreshExpiredOffer() {
    setRefreshing(true)
    setError(null)
    const res = await refreshOffer(activeOffer.id)
    setRefreshing(false)
    if (!res.ok) {
      setError('This fare is no longer available. Run the search again to grab a fresh price.')
      return
    }
    setActiveOffer(res.data)
    setExpired(false)
  }

  function update(i: number, patch: Partial<PassengerDraft>) {
    setPassengers((prev) => {
      const next = prev.map((p, j) => (j === i ? { ...p, ...patch } : p))
      // Travelers 2..N default their contact (email/phone) to traveler 1 when
      // they haven't entered their own — most bookings share one contact.
      if (i === 0 && (patch.email !== undefined || patch.phoneNumber !== undefined)) {
        const lead = next[0]
        for (let j = 1; j < next.length; j++) {
          const prevLead = prev[0]
          if (patch.email !== undefined && next[j].email === (prevLead.email ?? '')) {
            next[j] = { ...next[j], email: lead.email }
          }
          if (
            patch.phoneNumber !== undefined &&
            next[j].phoneNumber === (prevLead.phoneNumber ?? '')
          ) {
            next[j] = { ...next[j], phoneNumber: lead.phoneNumber }
          }
        }
      }
      return next
    })
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

  function validate(): { message: string; key: string } | null {
    for (const [i, p] of passengers.entries()) {
      const who = count > 1 ? `Passenger ${i + 1}: ` : ''
      const fail = (field: string, message: string) => ({ message: `${who}${message}`, key: `${i}:${field}` })
      if (!p.givenName.trim()) return fail('givenName', 'first name is required')
      if (!p.familyName.trim()) return fail('familyName', 'last name is required')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.bornOn)) return fail('bornOn', 'date of birth is required')
      if (p.bornOn > TODAY_ISO) return fail('bornOn', 'date of birth can’t be in the future')
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) return fail('email', 'a valid email is required')
      if (!/^\+?\d{7,}$/.test(normalizePhone(p.phoneNumber)))
        return fail('phoneNumber', 'a valid phone number is required')
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
      const session = await createThreeDSecureSession(key, cardId, activeOffer.id, [], true)
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
        offerId: activeOffer.id,
        passengers: passengers.map((p) => ({
          ...p,
          phoneNumber: normalizePhone(p.phoneNumber),
          id: '',
        })),
        threeDSecureSessionId,
      })
      if (!res.ok) {
        // A lapsed price is recoverable — surface the expiry path, not a raw error.
        if (/expir|no longer|not available/i.test(res.reason)) {
          setExpired(true)
          setError('The held price just lapsed. Refresh the price to continue.')
        } else {
          setError(res.reason)
        }
        setStage('idle')
        return
      }
      router.push(`/book/confirmation?order=${encodeURIComponent(res.data.id)}`)
    })
  }

  // Pay submit: validate passengers (focusing the first bad field), ensure the
  // card form is mounted + valid, then trigger the temp-card creation (its
  // success callback drives the rest).
  async function onPay(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    setError(null)

    // Held price lapsed — refresh before we try to book.
    if (expired) {
      await refreshExpiredOffer()
      return
    }

    const invalid = validate()
    if (invalid) {
      setError(invalid.message)
      setInvalidKey(invalid.key)
      const el = fieldRefs.current.get(invalid.key)
      el?.focus()
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    setInvalidKey(null)

    const key = await ensureClientKey()
    if (!key) return

    // Card form not mounted / incomplete yet → bring it into view and prompt to
    // finish. (The card fields live in a PCI iframe we can't focus into, so we
    // scroll to the section and let the user complete it.)
    if (!cardValid) {
      setError('Add your card to finish')
      setStage('idle')
      window.requestAnimationFrame(() => {
        document
          .getElementById('hop-card-form')
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
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
      {/* LEFT — passenger + payment. A real form so Enter submits and the Pay
          button is type=submit. noValidate: we run our own validation + focus. */}
      <form onSubmit={onPay} noValidate className="min-w-0">
        <h1 className="font-display text-[30px] font-semibold tracking-[-0.02em] text-text sm:text-[34px]">
          Book this flight
        </h1>
        <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.55] text-text2">
          Enter traveler details and pay securely. You&apos;ll get a confirmation with your booking
          reference.
        </p>

        {/* mobile-only condensed itinerary + total (the full summary is the
            right rail on large screens). */}
        <div className="mt-6 rounded-[14px] border border-border bg-paper p-4 lg:hidden">
          <div className="flex items-center gap-3">
            <BrandIcon code={activeOffer.airlineCode} name={activeOffer.airline} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-text">
                {activeOffer.airline}
              </div>
              <div className="text-[12px] text-text3">{activeOffer.route}</div>
            </div>
            <div className="text-right">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text3">
                Total due
              </div>
              <div className="font-display text-[18px] font-semibold tabular-nums tracking-[-0.01em] text-text">
                {total}
              </div>
            </div>
          </div>
          {priceHeld ? (
            <div className="mt-3 border-t border-hair pt-2.5 text-[11.5px] text-text3">
              {priceHeld}
            </div>
          ) : null}
        </div>

        {expired ? (
          <div
            role="alert"
            className="mt-6 flex flex-wrap items-center gap-3 rounded-[12px] border border-ok/25 bg-ok-bg px-4 py-3.5 text-[13px] leading-[1.5] text-text"
          >
            <Icon name="schedule" size={16} className="flex-shrink-0 text-text2" />
            <span className="flex-1">The held price lapsed. Refresh to get the latest fare.</span>
            <button
              type="button"
              onClick={refreshExpiredOffer}
              disabled={refreshing}
              className="rounded-[9px] border-[1.5px] border-text px-3 py-1.5 text-[12.5px] font-semibold text-text transition-colors hover:bg-text hover:text-white disabled:opacity-60"
            >
              {refreshing ? 'Refreshing…' : 'Refresh price'}
            </button>
          </div>
        ) : null}

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
                    required
                    invalid={invalidKey === `${i}:givenName`}
                    inputRef={setFieldRef(`${i}:givenName`)}
                  />
                </Field>
                <Field className="col-span-6 sm:col-span-4" label="Last name">
                  <Input
                    value={p.familyName}
                    onChange={(v) => update(i, { familyName: v })}
                    autoComplete="family-name"
                    required
                    invalid={invalidKey === `${i}:familyName`}
                    inputRef={setFieldRef(`${i}:familyName`)}
                  />
                </Field>

                <Field className="col-span-7 sm:col-span-4" label="Date of birth">
                  <Input
                    type="date"
                    value={p.bornOn}
                    onChange={(v) => update(i, { bornOn: v })}
                    required
                    min={DOB_MIN_ISO}
                    max={TODAY_ISO}
                    invalid={invalidKey === `${i}:bornOn`}
                    inputRef={setFieldRef(`${i}:bornOn`)}
                  />
                </Field>
                <Field className="col-span-5 sm:col-span-3" label="Gender">
                  <Select
                    value={p.gender}
                    onChange={(v) => update(i, { gender: v as Gender })}
                    options={[
                      ['m', 'Male'],
                      ['f', 'Female'],
                    ]}
                    selectRef={setFieldRef(`${i}:gender`)}
                  />
                </Field>
                <Field className="col-span-12 sm:col-span-5" label="Phone">
                  <Input
                    type="tel"
                    value={p.phoneNumber}
                    onChange={(v) => update(i, { phoneNumber: v })}
                    placeholder="+1 415 555 0100"
                    autoComplete="tel"
                    required
                    invalid={invalidKey === `${i}:phoneNumber`}
                    inputRef={setFieldRef(`${i}:phoneNumber`)}
                  />
                </Field>

                <Field className="col-span-12" label="Email">
                  <Input
                    type="email"
                    value={p.email}
                    onChange={(v) => update(i, { email: v })}
                    autoComplete="email"
                    required
                    invalid={invalidKey === `${i}:email`}
                    inputRef={setFieldRef(`${i}:email`)}
                  />
                </Field>

                <p className="col-span-12 -mt-1 text-[11.5px] leading-[1.45] text-text3">
                  Name, date of birth and gender must match your travel document (passport or ID),
                  exactly as they appear there.
                </p>
              </div>
            </section>
          ))}
        </div>

        {/* payment */}
        <section
          id="hop-card-form"
          className="mt-5 scroll-mt-24 rounded-[18px] border border-border bg-surface p-6 sm:p-7"
        >
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
              // Duffel's component API requires the actions ref as a prop.
              // eslint-disable-next-line react-hooks/refs
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
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-[13px] bg-brand px-6 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? (
            <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
          ) : (
            <Icon name="lock" size={17} />
          )}
          {busy ? stageLabel[stage] : expired ? 'Refresh price' : `Pay ${total}`}
        </button>

        {/* Status region — announces the current stage to assistive tech. */}
        <p aria-live="polite" className="sr-only">
          {busy ? stageLabel[stage] : ''}
        </p>

        <p className="mt-3 text-center text-[12px] text-text3">
          By booking you agree to the airline&apos;s fare rules. Confirmation sent to your email.
        </p>
      </form>

      {/* RIGHT — itinerary summary (hidden on mobile; condensed version sits
          above the form there). */}
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <div className="rounded-[18px] border border-border bg-paper p-6">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text3">
            Your itinerary
          </div>
          <div className="flex items-center gap-3 border-b border-border pb-5 pt-3">
            <BrandIcon code={activeOffer.airlineCode} name={activeOffer.airline} size={40} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-text">
                {activeOffer.airline}
              </div>
              <div className="text-[12px] text-text3">{activeOffer.route}</div>
            </div>
          </div>

          <div className="space-y-5 py-5">
            {activeOffer.segments.map((s, i) => (
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

          <div className="border-t border-border pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-text">
                Total due
                {count > 1 ? <span className="font-normal text-text3"> · {count} travelers</span> : null}
              </span>
              <span className="font-display text-[22px] font-semibold tabular-nums tracking-[-0.01em] text-text">
                {total}
              </span>
            </div>
            <div className="mt-1 text-[11.5px] text-text3">Taxes &amp; fees included</div>
            {priceHeld ? <div className="mt-2 text-[11.5px] text-text3">{priceHeld}</div> : null}
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
  required,
  invalid,
  inputRef,
  min,
  max,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  required?: boolean
  invalid?: boolean
  inputRef?: (el: HTMLInputElement | null) => void
  min?: string
  max?: string
}) {
  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      aria-required={required || undefined}
      aria-invalid={invalid || undefined}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-[11px] border-[1.5px] bg-paper px-3 py-[10px] text-[14.5px] text-text outline-none transition-colors placeholder:text-text3 focus:border-brand ${
        invalid ? 'border-weak' : 'border-border'
      }`}
    />
  )
}

function Select({
  value,
  onChange,
  options,
  selectRef,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<[string, string]>
  selectRef?: (el: HTMLSelectElement | null) => void
}) {
  // Custom-styled native select: appearance-none kills the OS chrome, and we draw
  // our own chevron so it matches the Inputs exactly (same height, border, font).
  return (
    <div className="relative">
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-[11px] border-[1.5px] border-border bg-paper px-3 py-[10px] pr-9 text-[14.5px] text-text outline-none transition-colors focus:border-brand"
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
