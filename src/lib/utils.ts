import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { LText } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Pick a localised string, falling back to English. */
export function lt(text: LText | undefined, lang: string): string {
  if (!text) return ''
  return text[lang] ?? text.en
}

export function formatNumber(n: number, lang: string, digits = 0) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : lang, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n)
}

export function formatCurrency(n: number, lang: string, currency = 'USD') {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : lang, {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(n)
}

export function countryName(code: string, lang: string) {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const uid = () => Math.random().toString(36).slice(2, 10)

/** Mulberry32 — small deterministic PRNG so swatches are stable between renders. */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour; amt in −1…1. */
export function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex)
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
