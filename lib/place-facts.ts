// lib/place-facts.ts — GENERATED, committed seed data. Do not hand-edit.
//
// Real, looked-up facts per destination IATA code: currency, primary language,
// timezone, plus a USD FX snapshot. Sources, all keyless/free: currency code +
// the fact itself from Wikidata (CC0); timezone from Open-Meteo geocoding; FX
// (latest + ~1 year ago) from Frankfurter (ECB data). Currency display names and
// the primary language are curated for accuracy/voice (Wikidata's raw language
// list is noisy) — see scripts/gen-place-facts.mjs. Generated OFFLINE and
// committed, so the live site never calls these APIs.
//
// THESIS: real data, looked up and date-stamped — never generated. lib/place-info
// turns it into terse chips + a computed "how far your dollar goes" line.

export interface PlaceFacts {
  /** ISO 3166-1 alpha-2, uppercase. */
  iso2: string
  /** ISO 4217 currency code, or null if unknown. */
  currencyCode: string | null
  /** Primary language a traveler meets. */
  language: string
  /** IANA timezone, e.g. 'Asia/Tokyo'. */
  timezone: string | null
  /** Standard-time UTC offset label, e.g. 'UTC+9'. */
  utcOffset: string | null
}

export interface Currency {
  name: string
  symbol: string
}

export interface FxSnapshot {
  /** Rates are units of the currency per 1 USD. */
  date: string
  agoDate: string
  rates: Record<string, number>
  agoRates: Record<string, number>
}

export const CURRENCY: Record<string, Currency> = {
  ARS: { name: "Argentine peso", symbol: "AR$" },
  AUD: { name: "Australian dollar", symbol: "A$" },
  BRL: { name: "Brazilian real", symbol: "R$" },
  CAD: { name: "Canadian dollar", symbol: "CA$" },
  COP: { name: "Colombian peso", symbol: "COL$" },
  EUR: { name: "Euro", symbol: "€" },
  HKD: { name: "Hong Kong dollar", symbol: "HK$" },
  IDR: { name: "Indonesian rupiah", symbol: "Rp" },
  ISK: { name: "Icelandic króna", symbol: "kr" },
  JPY: { name: "Japanese yen", symbol: "¥" },
  KRW: { name: "South Korean won", symbol: "₩" },
  MAD: { name: "Moroccan dirham", symbol: "DH" },
  MXN: { name: "Mexican peso", symbol: "MX$" },
  NZD: { name: "New Zealand dollar", symbol: "NZ$" },
  PEN: { name: "Peruvian sol", symbol: "S/" },
  QAR: { name: "Qatari riyal", symbol: "QR" },
  SGD: { name: "Singapore dollar", symbol: "S$" },
  THB: { name: "Thai baht", symbol: "฿" },
  TRY: { name: "Turkish lira", symbol: "₺" },
  USD: { name: "US dollar", symbol: "$" },
  ZAR: { name: "South African rand", symbol: "R" },
}

export const PLACE_FACTS: Record<string, PlaceFacts> = {
  NRT: { iso2: "JP", currencyCode: "JPY", language: "Japanese", timezone: "Asia/Tokyo", utcOffset: "UTC+9" },
  KIX: { iso2: "JP", currencyCode: "JPY", language: "Japanese", timezone: "Asia/Tokyo", utcOffset: "UTC+9" },
  ICN: { iso2: "KR", currencyCode: "KRW", language: "Korean", timezone: "Asia/Seoul", utcOffset: "UTC+9" },
  BKK: { iso2: "TH", currencyCode: "THB", language: "Thai", timezone: "Asia/Bangkok", utcOffset: "UTC+7" },
  SIN: { iso2: "SG", currencyCode: "SGD", language: "English", timezone: "Asia/Singapore", utcOffset: "UTC+8" },
  DPS: { iso2: "ID", currencyCode: "IDR", language: "Indonesian", timezone: "Asia/Makassar", utcOffset: "UTC+8" },
  SYD: { iso2: "AU", currencyCode: "AUD", language: "English", timezone: "Australia/Sydney", utcOffset: "UTC+11" },
  ZQN: { iso2: "NZ", currencyCode: "NZD", language: "English", timezone: "Pacific/Auckland", utcOffset: "UTC+13" },
  CPT: { iso2: "ZA", currencyCode: "ZAR", language: "English", timezone: "Africa/Johannesburg", utcOffset: "UTC+2" },
  RAK: { iso2: "MA", currencyCode: "MAD", language: "Arabic", timezone: "Africa/Casablanca", utcOffset: "UTC+1" },
  IST: { iso2: "TR", currencyCode: "TRY", language: "Turkish", timezone: "Europe/Istanbul", utcOffset: "UTC+3" },
  ATH: { iso2: "GR", currencyCode: "EUR", language: "Greek", timezone: "Europe/Athens", utcOffset: "UTC+2" },
  CDG: { iso2: "FR", currencyCode: "EUR", language: "French", timezone: "Europe/Paris", utcOffset: "UTC+1" },
  BCN: { iso2: "ES", currencyCode: "EUR", language: "Spanish", timezone: "Europe/Madrid", utcOffset: "UTC+1" },
  LIS: { iso2: "PT", currencyCode: "EUR", language: "Portuguese", timezone: "Europe/Lisbon", utcOffset: "UTC+0" },
  FCO: { iso2: "IT", currencyCode: "EUR", language: "Italian", timezone: "Europe/Rome", utcOffset: "UTC+1" },
  KEF: { iso2: "IS", currencyCode: "ISK", language: "Icelandic", timezone: "Atlantic/Reykjavik", utcOffset: "UTC+0" },
  YVR: { iso2: "CA", currencyCode: "CAD", language: "English", timezone: "America/Vancouver", utcOffset: "UTC-8" },
  MEX: { iso2: "MX", currencyCode: "MXN", language: "Spanish", timezone: "America/Mexico_City", utcOffset: "UTC-6" },
  CTG: { iso2: "CO", currencyCode: "COP", language: "Spanish", timezone: "America/Bogota", utcOffset: "UTC-5" },
  LIM: { iso2: "PE", currencyCode: "PEN", language: "Spanish", timezone: "America/Lima", utcOffset: "UTC-5" },
  EZE: { iso2: "AR", currencyCode: "ARS", language: "Spanish", timezone: "America/Argentina/Buenos_Aires", utcOffset: "UTC-3" },
  HNL: { iso2: "US", currencyCode: "USD", language: "English", timezone: "Pacific/Honolulu", utcOffset: "UTC-10" },
  OGG: { iso2: "US", currencyCode: "USD", language: "English", timezone: "Pacific/Honolulu", utcOffset: "UTC-10" },
  HND: { iso2: "JP", currencyCode: "JPY", language: "Japanese", timezone: "Asia/Tokyo", utcOffset: "UTC+9" },
  HKG: { iso2: "HK", currencyCode: "HKD", language: "Cantonese", timezone: "Asia/Hong_Kong", utcOffset: "UTC+8" },
  FRA: { iso2: "DE", currencyCode: "EUR", language: "German", timezone: "Europe/Berlin", utcOffset: "UTC+1" },
  DOH: { iso2: "QA", currencyCode: "QAR", language: "Arabic", timezone: "Asia/Qatar", utcOffset: "UTC+3" },
  ITM: { iso2: "JP", currencyCode: "JPY", language: "Japanese", timezone: "Asia/Tokyo", utcOffset: "UTC+9" },
  NCE: { iso2: "FR", currencyCode: "EUR", language: "French", timezone: "Europe/Paris", utcOffset: "UTC+1" },
  AMS: { iso2: "NL", currencyCode: "EUR", language: "Dutch", timezone: "Europe/Amsterdam", utcOffset: "UTC+1" },
  MEL: { iso2: "AU", currencyCode: "AUD", language: "English", timezone: "Australia/Melbourne", utcOffset: "UTC+11" },
  GRU: { iso2: "BR", currencyCode: "BRL", language: "Portuguese", timezone: "America/Sao_Paulo", utcOffset: "UTC-3" },
}

export const FX: FxSnapshot = {
  date: "2026-06-29",
  agoDate: "2025-06-27",
  rates: { AUD: 1.4493, BRL: 5.1639, CAD: 1.4204, EUR: 0.87673, HKD: 7.8423, IDR: 17853, ISK: 126.25, JPY: 161.86, KRW: 1543.75, MXN: 17.4754, NZD: 1.7688, SGD: 1.2935, THB: 33.245, TRY: 46.642, ZAR: 16.4153 },
  agoRates: { AUD: 1.5304, BRL: 5.4784, CAD: 1.3651, EUR: 0.85441, HKD: 7.85, IDR: 16213, ISK: 121.33, JPY: 144.6, KRW: 1360.82, MXN: 18.8619, NZD: 1.6505, SGD: 1.2759, THB: 32.625, TRY: 39.886, ZAR: 17.8025 },
}

export const GENERATED_AT = "2026-07-19T00:00:00.000Z"
