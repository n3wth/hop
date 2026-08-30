// lib/climate-normals.ts — GENERATED, committed seed data. Do not hand-edit.
//
// Monthly climate normals (Jan→Dec) per destination IATA code: mean daily
// temperature (°F) and mean monthly precipitation total (mm), averaged over
// 2010–2020 from ERA5 reanalysis via the Open-Meteo Archive API (open-meteo.com,
// CC-BY 4.0). Generated OFFLINE by scripts/gen-climate-normals.mjs and committed,
// so the live site never calls Open-Meteo (keeps static builds deterministic and
// stays clear of the API's non-commercial live-use terms). Re-run the script to
// refresh. Coordinates are recorded for provenance only.
//
// THESIS: this is real measured data. lib/climate.ts derives the "when to go"
// verdict from it deterministically — nothing here or there is LLM-generated.

import type { MonthlyNormals } from './climate'

export interface DestCoord {
  lat: number
  lon: number
  /** The geocoder match this normal was sampled at, for provenance. */
  matched: string
}

export const DEST_COORDS: Record<string, DestCoord> = {
  NRT: { lat: 35.6895, lon: 139.6917, matched: "Tokyo, Japan" },
  KIX: { lat: 35.0211, lon: 135.7539, matched: "Kyoto, Japan" },
  ICN: { lat: 37.566, lon: 126.9784, matched: "Seoul, South Korea" },
  BKK: { lat: 13.754, lon: 100.5014, matched: "Bangkok, Thailand" },
  SIN: { lat: 1.2897, lon: 103.8501, matched: "Singapore, Singapore" },
  DPS: { lat: -8.65, lon: 115.2167, matched: "Denpasar, Indonesia" },
  SYD: { lat: -33.8678, lon: 151.2073, matched: "Sydney, Australia" },
  ZQN: { lat: -45.0302, lon: 168.6627, matched: "Queenstown, New Zealand" },
  CPT: { lat: -33.9258, lon: 18.4232, matched: "Cape Town, South Africa" },
  RAK: { lat: 31.6342, lon: -7.9999, matched: "Marrakesh, Morocco" },
  IST: { lat: 41.0138, lon: 28.9497, matched: "Istanbul, Republic of Türkiye" },
  ATH: { lat: 37.9838, lon: 23.7278, matched: "Athens, Greece" },
  CDG: { lat: 48.8534, lon: 2.3488, matched: "Paris, France" },
  BCN: { lat: 41.3888, lon: 2.159, matched: "Barcelona, Spain" },
  LIS: { lat: 38.7251, lon: -9.1498, matched: "Lisbon, Portugal" },
  FCO: { lat: 41.8919, lon: 12.5113, matched: "Rome, Italy" },
  KEF: { lat: 64.1355, lon: -21.8954, matched: "Reykjavik, Iceland" },
  YVR: { lat: 49.2497, lon: -123.1193, matched: "Vancouver, Canada" },
  MEX: { lat: 19.4285, lon: -99.1277, matched: "Mexico City, Mexico" },
  CTG: { lat: 10.3982, lon: -75.4933, matched: "Cartagena, Colombia" },
  LIM: { lat: -12.0432, lon: -77.0282, matched: "Lima, Peru" },
  EZE: { lat: -34.6131, lon: -58.3772, matched: "Buenos Aires, Argentina" },
  HNL: { lat: 21.3069, lon: -157.8583, matched: "Honolulu, United States" },
  OGG: { lat: 20.8893, lon: -156.4729, matched: "Kahului, United States" },
  HND: { lat: 35.6895, lon: 139.6917, matched: "Tokyo, Japan" },
  HKG: { lat: 22.2783, lon: 114.1747, matched: "Hong Kong" },
  FRA: { lat: 50.1155, lon: 8.6842, matched: "Frankfurt am Main, Germany" },
  DOH: { lat: 25.2855, lon: 51.531, matched: "Doha, Qatar" },
  ITM: { lat: 34.6938, lon: 135.5011, matched: "Osaka, Japan" },
  NCE: { lat: 43.7031, lon: 7.2661, matched: "Nice, France" },
  AMS: { lat: 52.374, lon: 4.8897, matched: "Amsterdam, The Netherlands" },
  MEL: { lat: -37.814, lon: 144.9633, matched: "Melbourne, Australia" },
  GRU: { lat: -23.5475, lon: -46.6361, matched: "São Paulo, Brazil" },
}

export const CLIMATE_NORMALS: Record<string, MonthlyNormals> = {
  NRT: { tempF: [38.5, 40.5, 47, 55.5, 65.2, 70.9, 77.8, 80.4, 73.6, 63.4, 53.1, 43], precipMM: [54, 82, 113, 125, 118, 176, 152, 111, 200, 227, 93, 66] },
  KIX: { tempF: [37.7, 39.5, 45.9, 54.6, 64.4, 71.4, 78.4, 80.9, 73.2, 62.7, 52, 41.8], precipMM: [58, 80, 123, 155, 143, 220, 262, 162, 234, 197, 77, 76] },
  ICN: { tempF: [25.6, 30.8, 40.2, 51.2, 62.6, 71.8, 76.5, 77.8, 68.8, 56.3, 42.9, 28.8], precipMM: [17, 30, 30, 75, 87, 91, 340, 240, 109, 55, 52, 24] },
  BKK: { tempF: [79.2, 81.8, 84.1, 86.2, 85.8, 83.7, 82.6, 82.1, 81.4, 80.6, 81, 78.9], precipMM: [24, 16, 37, 66, 123, 135, 146, 154, 275, 217, 51, 15] },
  SIN: { tempF: [79.2, 79.8, 80.9, 81.3, 81.8, 81.9, 81.3, 81.1, 81.1, 80.7, 79.8, 79.4], precipMM: [186, 120, 178, 242, 265, 193, 155, 160, 170, 243, 333, 307] },
  DPS: { tempF: [79.2, 79.3, 79.5, 79.7, 79.4, 78, 76.6, 76.1, 76.8, 78.3, 79.4, 79.3], precipMM: [361, 340, 270, 212, 159, 96, 78, 43, 76, 91, 214, 380] },
  SYD: { tempF: [73.2, 72.4, 70.1, 65.5, 59.5, 55.5, 54.1, 55.3, 59.9, 64.2, 67.4, 70.4], precipMM: [78, 104, 100, 67, 39, 72, 39, 41, 44, 58, 83, 59] },
  ZQN: { tempF: [59.6, 59.9, 56.7, 50.5, 44.5, 38.7, 37, 39.1, 42.4, 47.1, 52.7, 58], precipMM: [136, 102, 101, 113, 136, 92, 123, 77, 127, 141, 113, 129] },
  CPT: { tempF: [70.8, 70.6, 68.1, 63.8, 59.8, 55.8, 55.1, 55.4, 57.7, 61.5, 64.3, 68.4], precipMM: [13, 10, 16, 31, 56, 103, 78, 80, 41, 31, 29, 16] },
  RAK: { tempF: [51.2, 53.9, 59.1, 64.3, 70.9, 76.4, 82.9, 84.2, 76.5, 69.8, 59.2, 53.3], precipMM: [30, 23, 37, 29, 18, 5, 3, 8, 14, 19, 47, 17] },
  IST: { tempF: [43.3, 45, 48, 54, 63.3, 71.8, 76.5, 77.3, 71.5, 61.9, 55.4, 47.5], precipMM: [107, 70, 68, 43, 43, 42, 21, 16, 39, 92, 52, 96] },
  ATH: { tempF: [47.3, 50, 53.6, 60.3, 68.9, 77, 82.4, 82.2, 75.4, 65.8, 58.1, 50.6], precipMM: [57, 66, 51, 28, 26, 25, 7, 4, 22, 31, 51, 75] },
  CDG: { tempF: [39.9, 40.5, 45.6, 51.8, 57.4, 64.1, 68.5, 67.6, 62, 55, 46.9, 41.8], precipMM: [54, 52, 53, 42, 68, 65, 49, 59, 43, 57, 61, 78] },
  BCN: { tempF: [47.2, 48.1, 52.1, 57, 62.8, 70.4, 75.9, 75.8, 70.3, 63.8, 55, 49], precipMM: [49, 39, 53, 60, 45, 33, 26, 43, 82, 109, 70, 25] },
  LIS: { tempF: [52.6, 52.8, 55.6, 59.1, 64, 67.8, 71.1, 72.3, 70.3, 65.5, 58.1, 54.1], precipMM: [61, 55, 67, 61, 48, 10, 2, 3, 27, 72, 99, 65] },
  FCO: { tempF: [45.3, 46.8, 51.3, 57.5, 63.4, 72.4, 78, 78.6, 70.6, 62.8, 55.1, 47.3], precipMM: [75, 92, 93, 67, 74, 35, 27, 20, 80, 113, 148, 82] },
  KEF: { tempF: [31.4, 32, 33.5, 38.1, 43.6, 50, 52.9, 51.5, 46.5, 40.3, 34.9, 30.4], precipMM: [143, 132, 122, 121, 95, 77, 91, 95, 144, 127, 117, 124] },
  YVR: { tempF: [38.9, 38.7, 42.6, 47.4, 54.7, 59.1, 64.7, 65.7, 59.7, 50.9, 43, 38.3], precipMM: [266, 179, 256, 157, 93, 78, 40, 50, 147, 233, 309, 277] },
  MEX: { tempF: [55.7, 59.5, 62.4, 65.4, 66.3, 64, 61.5, 61.9, 61.1, 59.8, 58.2, 57.2], precipMM: [23, 25, 35, 42, 75, 165, 209, 191, 187, 78, 37, 12] },
  CTG: { tempF: [80.9, 81.4, 81.6, 81.9, 81.5, 81.7, 81.7, 81.4, 81, 80.2, 80.1, 80.7], precipMM: [8, 5, 21, 69, 154, 151, 150, 175, 168, 236, 201, 62] },
  LIM: { tempF: [72.1, 73.9, 73.3, 70.6, 67.5, 64.8, 62.9, 62.3, 63.2, 64.1, 66, 68.9], precipMM: [13, 23, 25, 5, 1, 1, 1, 1, 1, 3, 1, 7] },
  EZE: { tempF: [75.9, 74.4, 69.7, 64.4, 58.2, 52.6, 50.7, 53.8, 57.4, 61.9, 68.4, 73.8], precipMM: [88, 109, 86, 96, 82, 58, 85, 66, 86, 116, 82, 82] },
  HNL: { tempF: [72.8, 72.3, 72.3, 74.2, 75.6, 77, 78.1, 78.8, 78.8, 78, 76, 74.1], precipMM: [30, 42, 51, 31, 34, 26, 25, 31, 25, 40, 27, 59] },
  OGG: { tempF: [72.9, 72.9, 73.1, 75.1, 76.5, 77.9, 79.2, 79.6, 79.5, 78.5, 76.4, 74.2], precipMM: [37, 58, 34, 32, 18, 8, 13, 37, 17, 27, 23, 55] },
  HND: { tempF: [38.5, 40.5, 47, 55.5, 65.2, 70.9, 77.8, 80.4, 73.6, 63.4, 53.1, 43], precipMM: [54, 82, 113, 125, 118, 176, 152, 111, 200, 227, 93, 66] },
  HKG: { tempF: [60.6, 63, 67.7, 72.9, 78.7, 81.9, 82.6, 82.4, 81, 76.4, 71, 62.2], precipMM: [37, 36, 82, 147, 261, 334, 265, 323, 246, 102, 51, 31] },
  FRA: { tempF: [35.8, 36.4, 43, 51.3, 57.8, 65.3, 69.2, 68.3, 60.6, 51.9, 43.2, 38.1], precipMM: [65, 43, 40, 39, 73, 62, 60, 64, 46, 53, 57, 82] },
  DOH: { tempF: [64.2, 65.9, 71.9, 80.4, 89.7, 94.4, 96.3, 95.8, 92.3, 86, 76.4, 67.7], precipMM: [7, 9, 8, 7, 1, 0, 0, 0, 0, 1, 15, 9] },
  ITM: { tempF: [40.1, 41.4, 47.5, 56.2, 65.8, 72.7, 79.7, 82.6, 75.3, 64.7, 54, 44.1], precipMM: [54, 75, 112, 135, 137, 214, 233, 127, 214, 187, 79, 74] },
  NCE: { tempF: [47.2, 47, 51.7, 57.4, 63, 71, 76.2, 76.2, 70.2, 62.7, 54.8, 49.3], precipMM: [68, 81, 89, 77, 71, 49, 29, 24, 39, 123, 181, 88] },
  AMS: { tempF: [38.7, 38.7, 42.8, 49.1, 54.9, 60.6, 64.3, 64.1, 59.2, 53.2, 45.5, 41.7], precipMM: [67, 61, 52, 46, 55, 72, 85, 91, 70, 80, 59, 80] },
  MEL: { tempF: [69.1, 68.5, 65.6, 59.9, 54.4, 49.9, 49.5, 50.2, 53.8, 58.3, 62.2, 65.5], precipMM: [50, 49, 43, 53, 58, 51, 48, 57, 63, 60, 69, 58] },
  GRU: { tempF: [72.6, 72.9, 70.4, 68, 63.7, 62, 61.5, 62.8, 66.6, 68.2, 68.1, 71.5], precipMM: [219, 152, 137, 63, 49, 57, 47, 35, 74, 95, 149, 161] },
}

export const GENERATED_AT = "2026-07-19T00:00:00.000Z"
