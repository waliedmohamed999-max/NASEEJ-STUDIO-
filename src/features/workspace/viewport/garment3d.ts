import * as THREE from 'three'
import { clamp } from '@/lib/utils'
import { ellipseAxes, type BodyModel } from '@/features/tryon/avatarModel'
import { envelopeRingAt } from './mannequin'
import type { GarmentSpec } from '../model/spec'

/**
 * Builds the 3D garment from pattern measurements (GarmentSpec).
 * Pattern y (cm) is mapped to avatar height through landmarks — HPS, underarm,
 * waist, hip — so a 42 cm bodice ends exactly at the avatar's waist whatever its height.
 * Rest geometry carries the pattern's true circumferences; the initial (display) shape is
 * pushed just outside the body. The difference between the two is real strain.
 */

export interface SimRing { y: number; rx: number; rz: number }

export interface Garment3D {
  /** Torso shell, rings top → bottom, root-local coordinates */
  rest: SimRing[]
  init: SimRing[]
  /** girth delta (cm) vs body per ring, for the ease map */
  ease: number[]
  /** fold weight per ring (0 = none, 1 = full) */
  fold: number[]
  pinRings: number
  /** ring index where the lower material starts (waist seam), or null */
  splitRing: number | null
  /** extra circumference beyond what hangs freely → parametric fold depth (m) */
  excess: number[]
  legs: { rings: Array<{ y: number; r: number }>; kneeY: number } | null
  sleeve: { rings: Array<{ d: number; r: number }>; bell: boolean } | null
  collar: { y0: number; y1: number; r: number } | null
  hood: boolean
  scarf: boolean
}

const perim = (rx: number, rz: number) => Math.PI * (3 * (rx + rz) - Math.sqrt((3 * rx + rz) * (rx + 3 * rz)))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Piecewise-linear map from pattern y (cm from HPS or waist) to avatar y (m). */
function makeYMap(m: BodyModel, from: 'hps' | 'waist') {
  const hps = m.y.shoulder + 0.016 * m.H
  const pts: Array<[number, number]> = from === 'hps'
    ? [[0, hps], [21, m.y.armpit - 0.01 * m.H], [42, m.y.waist], [62, m.y.hip]]
    : [[0, m.y.waist], [20, m.y.hip], [26, m.y.crotch + 0.01 * m.H]]
  return (cm: number) => {
    if (cm <= pts[0][0]) return pts[0][1] - (cm - pts[0][0]) / 100
    for (let i = 1; i < pts.length; i++) {
      if (cm <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (cm - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]))
    }
    const [lc, ly] = pts[pts.length - 1]
    return ly - (cm - lc) / 100
  }
}

export function buildGarment3D(m: BodyModel, spec: GarmentSpec, stiffness: number): Garment3D {
  const out: Garment3D = {
    rest: [], init: [], ease: [], fold: [], excess: [], pinRings: 3, splitRing: null,
    legs: null, sleeve: null, collar: null, hood: spec.collar === 'hood', scarf: spec.kind === 'scarf',
  }
  if (spec.kind === 'scarf') return out

  // Girth keyframes along pattern y (cm): [patternY, girthCm]
  let keys: Array<[number, number]> = []
  let from: 'hps' | 'waist' = 'hps'
  let totalLen = 0
  let splitAt: number | null = null
  if (spec.body) {
    const b = spec.body
    keys.push([0, 0], [8, b.bust * 0.92], [23, b.bust])
    if (spec.skirt) {
      keys.push([42, b.waist])
      const s = spec.skirt
      keys.push([42.01, s.waist], [62, Math.max(s.hip, s.waist)], [42 + s.length, Math.max(s.hem, s.hip)])
      totalLen = 42 + s.length
      splitAt = 42
    } else if (spec.trousers && spec.kind === 'jumpsuit') {
      keys.push([42, b.waist], [62, spec.trousers.hip], [42 + spec.trousers.rise, spec.trousers.hip])
      totalLen = 42 + spec.trousers.rise
      splitAt = 42
    } else {
      if (b.length > 42) keys.push([42, b.waist])
      if (b.length > 62) keys.push([62, b.hip])
      keys.push([b.length, b.hem])
      totalLen = b.length
    }
  } else if (spec.skirt) {
    from = 'waist'
    const s = spec.skirt
    keys = [[0, s.waist], [20, Math.max(s.hip, s.waist)], [s.length, Math.max(s.hem, s.hip)]]
    totalLen = s.length
  } else if (spec.trousers) {
    from = 'waist'
    const tr = spec.trousers
    keys = [[0, tr.waist], [18, tr.hip], [tr.rise + 1.5, tr.hip]]
    totalLen = tr.rise + 1.5
  }
  const girthAt = (cm: number) => {
    if (cm <= keys[0][0]) return keys[0][1]
    for (let i = 1; i < keys.length; i++) {
      if (cm <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], (cm - keys[i - 1][0]) / Math.max(0.01, keys[i][0] - keys[i - 1][0]))
    }
    return keys[keys.length - 1][1]
  }
  const ymap = makeYMap(m, from)
  const hipRing = envelopeRingAt(m, m.y.hip)
  const steps = Math.max(24, Math.min(72, Math.round(totalLen / 2)))
  const top = from === 'hps' ? 1.5 : 0
  for (let i = 0; i <= steps; i++) {
    const cm = lerp(top, totalLen, i / steps)
    const y = ymap(cm)
    const body = y < m.y.crotch + 0.03 * m.H ? hipRing : envelopeRingAt(m, y)
    const bodyP = perim(body.rx, body.rz) * 100 // cm
    let G = girthAt(cm)
    // neckline: the top rings open to the neck instead of collapsing to zero girth
    if (from === 'hps' && cm < 8) G = Math.max(G, lerp(m.neckR * 2 * Math.PI * 100 * 1.9, bodyP * 1.03, cm / 8))
    const k = body.rz / body.rx
    const [rx, rz] = ellipseAxes(G / 100, k)
    out.rest.push({ y, rx, rz })
    // display/initial shape: outside the body; fluid fabric hangs closer than its full cut
    const freeR = Math.max(rx, body.rx * 1.012 + 0.003)
    const below = y < m.y.hip
    const hang = below ? lerp(1, 0.35 + 0.65 * stiffness, clamp((m.y.hip - y) / 0.5, 0, 1)) : 1
    const ix = Math.max(body.rx * 1.012 + 0.003, body.rx + (freeR - body.rx) * hang)
    const iz = Math.max(body.rz * 1.012 + 0.003, (ix / rx) * rz)
    out.init.push({ y, rx: ix, rz: iz })
    out.excess.push(Math.max(0, (perim(rx, rz) - perim(ix, iz)) / (2 * Math.PI)))
    out.ease.push(G - bodyP)
    out.fold.push(below ? clamp((m.y.hip - y) / Math.max(0.05, m.y.hip - ymap(totalLen)), 0, 1) : 0)
    if (splitAt !== null && out.splitRing === null && cm >= splitAt) out.splitRing = i
  }
  // Smooth girth keyframes along the length (no hard ledges at seams / landmarks),
  // keeping the shell outside the body.
  for (let pass = 0; pass < 4; pass++) {
    for (const arr of [out.rest, out.init]) {
      const c = arr.map((r) => ({ ...r }))
      for (let i = 1; i < arr.length - 1; i++) {
        arr[i].rx = (c[i - 1].rx + 2 * c[i].rx + c[i + 1].rx) / 4
        arr[i].rz = (c[i - 1].rz + 2 * c[i].rz + c[i + 1].rz) / 4
      }
    }
    for (let i = 0; i < out.init.length; i++) {
      const y = out.init[i].y
      const b = y < m.y.crotch + 0.03 * m.H ? hipRing : envelopeRingAt(m, y)
      out.init[i].rx = Math.max(out.init[i].rx, b.rx * 1.01 + 0.003)
      out.init[i].rz = Math.max(out.init[i].rz, b.rz * 1.01 + 0.003)
    }
  }
  // Pin only the neckline (rings above the shoulder line); the rest falls onto the
  // shoulders and drapes over the deltoids, giving a natural rounded shoulder.
  out.pinRings = from === 'hps' ? Math.max(1, out.init.filter((r) => r.y >= m.y.shoulder + 0.006 * m.H).length) : 2

  // Trouser legs (per leg, around the leg axis)
  if (spec.trousers) {
    const tr = spec.trousers
    const crotchY = ymap(from === 'waist' ? tr.rise : tr.rise)
    const legTop = from === 'waist' ? crotchY : m.y.crotch
    const inseam = Math.max(0.05, (tr.length - tr.rise) / 100)
    const thighR = tr.thigh / (2 * Math.PI) / 100
    const hemR = tr.hem / (2 * Math.PI) / 100
    const rings: Array<{ y: number; r: number }> = []
    for (let i = 0; i <= 30; i++) {
      const y = legTop + 0.02 - (inseam + 0.02) * (i / 30)
      rings.push({ y, r: lerp(thighR, hemR, i / 30) })
    }
    out.legs = { rings, kneeY: m.y.knee }
  }

  // Sleeves (arm-local, d downward from the shoulder joint)
  if (spec.sleeve) {
    const s = spec.sleeve
    const len = Math.min(m.armLength * 1.02, s.cutOn ? s.length / 100 * 0.9 : Math.max(0.06, (s.length - 9) / 100))
    const top = s.bicep / (2 * Math.PI) / 100
    const bot = s.opening / (2 * Math.PI) / 100
    const rings: Array<{ d: number; r: number }> = []
    const capR = m.arm[0].r * 1.14
    // Sleeve head: a dome over the deltoid (like a set-in sleeve cap), then the sleeve body.
    const capH = 0.062
    for (let i = 0; i <= 10; i++) {
      const u = i / 10
      const d = -capH + capH * u
      rings.push({ d, r: capR * Math.sqrt(Math.max(0.0025, 1 - (1 - u) ** 2)) })
    }
    for (let i = 1; i <= 20; i++) {
      const t = i / 20
      const d = lerp(0, len, t)
      const blend = Math.min(1, t / 0.3)
      rings.push({ d, r: lerp(capR, Math.max(lerp(top, bot, t), capR * 0.9), Math.sin(blend * Math.PI / 2)) })
    }
    out.sleeve = { rings, bell: s.cutOn || bot > top * 1.2 }
  }

  if (spec.collar && spec.collar !== 'none' && spec.collar !== 'hood') {
    const h = spec.collar === 'polo' ? 0.045 : spec.collar === 'mandarin' ? 0.038 : 0.05
    out.collar = { y0: m.y.neck - 0.02, y1: m.y.neck - 0.02 + h, r: m.neckR * 1.32 }
  }
  return out
}

/* ---------------------------------------------------------------------- */
/* Fit-map colour ramps                                                    */
/* ---------------------------------------------------------------------- */
const C = (h: string) => new THREE.Color(h)
const RAMP_EASE: Array<[number, THREE.Color]> = [[-4, C('#d64545')], [0, C('#e3a33b')], [3, C('#3f9a62')], [14, C('#3f9a62')], [30, C('#3b6fd1')]]
const RAMP_STRAIN: Array<[number, THREE.Color]> = [[0, C('#3b6fd1')], [0.015, C('#3f9a62')], [0.05, C('#e3c13b')], [0.1, C('#e07a2f')], [0.18, C('#d64545')]]
const RAMP_PRESSURE: Array<[number, THREE.Color]> = [[0, C('#f2efe8')], [0.002, C('#e9c46a')], [0.006, C('#e07a2f')], [0.012, C('#b0263a')]]

function ramp(stops: Array<[number, THREE.Color]>, v: number) {
  if (v <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) return stops[i - 1][1].clone().lerp(stops[i][1], (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]))
  }
  return stops[stops.length - 1][1]
}
export const easeColor = (cm: number) => ramp(RAMP_EASE, cm)
export const strainColor = (s: number) => ramp(RAMP_STRAIN, s)
export const pressureColor = (p: number) => ramp(RAMP_PRESSURE, p)
export const LEGENDS = {
  strain: ['#3b6fd1', '#3f9a62', '#e3c13b', '#e07a2f', '#d64545'],
  pressure: ['#f2efe8', '#e9c46a', '#e07a2f', '#b0263a'],
  ease: ['#d64545', '#e3a33b', '#3f9a62', '#3b6fd1'],
}
