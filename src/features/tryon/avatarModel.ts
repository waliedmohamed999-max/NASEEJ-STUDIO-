import * as THREE from 'three'
import type { Body, Fabric, GarmentTemplate } from '@/types'
import { sizeChart, type SizeCode } from '@/data/garments'
import { clamp } from '@/lib/utils'
import type { FitStatus, ZoneFit } from '@/lib/textile'

/**
 * Parametric mannequin + garment geometry.
 *
 * The torso is a stack of elliptical rings whose circumferences come straight from
 * the user's bust / waist / hip measurements (Ramanujan's ellipse perimeter), so the
 * avatar's proportions are measured, not guessed. Garments reuse the same rings,
 * scaled by the garment's ease at each height, then add hem flare, folds and sway
 * derived from the fabric's drape and stretch.
 * Units: metres, y-up, origin between the feet.
 */

export interface Ring { y: number; rx: number; rz: number }

export interface BodyModel {
  H: number
  y: { ankle: number; knee: number; crotch: number; hip: number; waist: number; bust: number; armpit: number; shoulder: number; neck: number; chin: number; head: number }
  torso: Ring[]
  leg: Array<{ y: number; r: number }> // leg-local (absolute y)
  legOffset: number
  arm: Array<{ d: number; r: number }> // distance down the arm from the shoulder joint
  armLength: number
  armAngle: number
  shoulderJoint: { x: number; y: number }
  headR: number
  neckR: number
}

/** Ellipse semi-axes for a perimeter `C` and depth/width ratio `k`. */
export function ellipseAxes(C: number, k: number): [number, number] {
  // Ramanujan: P ≈ π[3(a+b) − √((3a+b)(a+3b))] with b = k·a → solve for a.
  const unit = Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k)))
  const a = C / unit
  return [a, a * k]
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function buildBodyModel(b: Body): BodyModel {
  const H = clamp(b.heightCm, 140, 205) / 100
  const bmi = b.weightKg / (H * H)
  const limb = Math.pow(clamp(bmi / 22, 0.8, 1.5), 0.75)
  const s = b.shape
  const shoulderK = s === 'invertedTriangle' ? 1.1 : s === 'pear' ? 0.95 : 1
  const thighK = s === 'pear' ? 1.1 : s === 'invertedTriangle' ? 0.93 : 1
  const waistDepth = s === 'apple' ? 0.92 : s === 'rectangle' ? 0.8 : 0.72

  const y = {
    ankle: 0.045 * H, knee: 0.285 * H, crotch: 0.47 * H, hip: 0.52 * H, waist: 0.625 * H,
    bust: 0.72 * H, armpit: 0.75 * H, shoulder: 0.815 * H, neck: 0.84 * H, chin: 0.87 * H, head: 0.935 * H,
  }
  const cm = (v: number) => v / 100
  const [hipX, hipZ] = ellipseAxes(cm(b.hipsCm), 0.76)
  const [waistX, waistZ] = ellipseAxes(cm(b.waistCm), waistDepth)
  const [bustX, bustZ] = ellipseAxes(cm(b.bustCm), 0.72)
  const shoulderHalf = (0.17 + (b.bustCm - 90) * 0.0011) * (H / 1.68) * shoulderK
  const neckR = 0.052 * Math.sqrt(limb)

  const torso: Ring[] = [
    { y: y.crotch - 0.012 * H, rx: hipX * 0.2, rz: hipZ * 0.2 },
    { y: y.crotch, rx: hipX * 0.78, rz: hipZ * 0.7 },
    { y: y.crotch + 0.025 * H, rx: hipX * 0.96, rz: hipZ * 0.94 },
    { y: y.hip, rx: hipX, rz: hipZ },
    { y: lerp(y.hip, y.waist, 0.5), rx: lerp(hipX, waistX, 0.55), rz: lerp(hipZ, waistZ, 0.55) },
    { y: y.waist, rx: waistX, rz: waistZ },
    { y: lerp(y.waist, y.bust, 0.65), rx: lerp(waistX, bustX, 0.7), rz: lerp(waistZ, bustZ, 0.6) },
    { y: y.bust, rx: bustX, rz: bustZ },
    { y: y.armpit, rx: Math.max(bustX * 0.98, shoulderHalf * 0.86), rz: bustZ * 0.86 },
    // trapezius slope; the rounded shoulder itself comes from the deltoid (arm)
    { y: y.shoulder - 0.022 * H, rx: shoulderHalf * 0.86, rz: bustZ * 0.62 },
    { y: y.shoulder, rx: shoulderHalf * 0.66, rz: bustZ * 0.5 },
    { y: y.shoulder + 0.012 * H, rx: shoulderHalf * 0.4, rz: neckR * 1.15 },
    { y: y.neck, rx: neckR, rz: neckR },
    { y: y.chin, rx: neckR * 0.95, rz: neckR * 0.95 },
  ]

  const thigh = hipX * 0.5 * thighK
  const legOffset = hipX * 0.47
  const leg = [
    { y: y.crotch + 0.01 * H, r: thigh },
    { y: lerp(y.knee, y.crotch, 0.6), r: thigh * 0.86 },
    { y: y.knee + 0.04 * H, r: 0.062 * limb },
    { y: y.knee, r: 0.053 * limb },
    { y: y.knee - 0.08 * H, r: 0.058 * limb },
    { y: y.ankle + 0.03 * H, r: 0.036 * limb },
    { y: y.ankle, r: 0.03 * limb },
  ]

  const armLength = 0.335 * H
  const arm = [
    { d: -0.02, r: 0.05 * limb },
    { d: 0.04, r: 0.046 * limb },
    { d: armLength * 0.45, r: 0.038 * limb },
    { d: armLength * 0.56, r: 0.033 * limb },
    { d: armLength * 0.72, r: 0.034 * limb },
    { d: armLength, r: 0.024 * limb },
  ]

  return {
    H, y, torso, leg, legOffset, arm, armLength,
    armAngle: THREE.MathUtils.degToRad(13),
    shoulderJoint: { x: shoulderHalf - 0.032 * limb, y: y.shoulder - 0.028 * H },
    headR: 0.074 * (H / 1.68),
    neckR,
  }
}

/** Interpolate the torso ring at height y (clamped to the torso range). */
export function torsoRingAt(m: BodyModel, y: number): Ring {
  const t = m.torso
  if (y <= t[0].y) return t[0]
  for (let i = 1; i < t.length; i++) {
    if (y <= t[i].y) {
      const a = t[i - 1], b = t[i]
      const k = (y - a.y) / (b.y - a.y)
      return { y, rx: lerp(a.rx, b.rx, k), rz: lerp(a.rz, b.rz, k) }
    }
  }
  return t[t.length - 1]
}

function radiusAlong<T extends { r: number }>(pts: T[], key: (p: T) => number, v: number, descending = false): number {
  const arr = descending ? [...pts].reverse() : pts
  if (v <= key(arr[0])) return arr[0].r
  for (let i = 1; i < arr.length; i++) {
    if (v <= key(arr[i])) {
      const a = arr[i - 1], b = arr[i]
      return lerp(a.r, b.r, (v - key(a)) / (key(b) - key(a)))
    }
  }
  return arr[arr.length - 1].r
}
export const legRadiusAt = (m: BodyModel, y: number) => radiusAlong(m.leg, (p) => p.y, y, true)
export const armRadiusAt = (m: BodyModel, d: number) => radiusAlong(m.arm, (p) => p.d, d)

/* ------------------------------------------------------------------------- */
/* Tube geometry: rings of elliptical cross-sections, optional animated folds */
/* ------------------------------------------------------------------------- */

export interface TubeRing { y: number; rx: number; rz: number; fold?: number; color?: THREE.Color; cx?: number }

export interface Tube {
  geometry: THREE.BufferGeometry
  /** Base data for per-frame fold animation */
  base: { rx: Float32Array; rz: Float32Array; theta: Float32Array; fold: Float32Array; y: Float32Array; cx: Float32Array }
}

/**
 * Build an elliptical tube. `tile` = metres per texture repeat. Seam sits at the back.
 * `closeTop`/`closeBottom` cap the ends (used for body parts, not garments).
 */
export function buildTube(rings: TubeRing[], segments = 48, tile = 0.14): Tube {
  const nR = rings.length, nS = segments + 1
  const count = nR * nS
  const pos = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const col = new Float32Array(count * 3)
  const base = {
    rx: new Float32Array(count), rz: new Float32Array(count), theta: new Float32Array(count),
    fold: new Float32Array(count), y: new Float32Array(count), cx: new Float32Array(count),
  }
  let vAcc = 0
  for (let i = 0; i < nR; i++) {
    const r = rings[i]
    if (i > 0) vAcc += Math.hypot(r.y - rings[i - 1].y, ((r.rx - rings[i - 1].rx) + (r.rz - rings[i - 1].rz)) / 2)
    const circ = Math.PI * (r.rx + r.rz)
    for (let j = 0; j < nS; j++) {
      const k = i * nS + j
      const theta = -Math.PI / 2 + (j / segments) * Math.PI * 2 // seam at back (−z)
      const cx = r.cx ?? 0
      pos[k * 3] = cx + Math.cos(theta) * r.rx
      pos[k * 3 + 1] = r.y
      pos[k * 3 + 2] = Math.sin(theta) * r.rz
      uv[k * 2] = ((j / segments) * circ) / tile
      uv[k * 2 + 1] = -vAcc / tile
      const c = r.color ?? WHITE
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b
      base.rx[k] = r.rx; base.rz[k] = r.rz; base.theta[k] = theta; base.fold[k] = r.fold ?? 0; base.y[k] = r.y; base.cx[k] = cx
    }
  }
  const idx: number[] = []
  for (let i = 0; i < nR - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * nS + j, b = a + nS, c = b + 1, d = a + 1
      // winding so normals face outward with rings ordered top → bottom
      idx.push(a, d, b, b, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return { geometry: g, base }
}

const WHITE = new THREE.Color(1, 1, 1)

/* ------------------------------------------------------------------------- */
/* Garment                                                                   */
/* ------------------------------------------------------------------------- */

export const FIT_COLORS: Record<FitStatus, THREE.Color> = {
  tight: new THREE.Color('#d64545'),
  good: new THREE.Color('#3f9a62'),
  loose: new THREE.Color('#3b6fd1'),
}

export interface FabricBehaviour {
  /** 0 = fluid … 1 = stiff */
  stiffness: number
  /** fold count around the hem */
  folds: number
  /** fold depth, metres at hem */
  foldDepth: number
  /** animation speed of sway */
  sway: number
  /** multiplier on garment flare */
  flareK: number
}

export function fabricBehaviour(f: Fabric): FabricBehaviour {
  const stiffness = (5 - f.drape) / 4 // drape 5 → 0, drape 1 → 1
  const weightK = clamp(f.gsm / 250, 0.25, 2)
  return {
    stiffness,
    folds: Math.round(16 - stiffness * 9),
    foldDepth: 0.008 + stiffness * 0.018 + (1 - stiffness) * 0.006,
    // light, fluid cloth moves more
    sway: (1 - stiffness) * (1.2 - Math.min(1, weightK) * 0.5),
    flareK: 0.45 + stiffness * 0.85,
  }
}

export interface GarmentBuild {
  torso: Tube | null
  legs: Tube[] // trousers
  sleeves: Tube[] // arm-local
  hemY: number
}

export function buildGarment(
  m: BodyModel, g: GarmentTemplate, f: Fabric, size: SizeCode, body: Body, fits: ZoneFit[], heatmap: boolean,
): GarmentBuild {
  const beh = fabricBehaviour(f)
  const chart = sizeChart.find((s) => s.size === size)!
  // Garment circumference per zone (cm) → scale factor over the body ring.
  const zoneScale = (zone: 'bust' | 'waist' | 'hips', bodyCm: number) => {
    const gc = chart[zone] + g.ease[zone]
    return Math.max(1.015, gc / bodyCm) // stretch over the body when tight
  }
  const sBust = zoneScale('bust', body.bustCm)
  const sWaist = zoneScale('waist', body.waistCm)
  const sHips = zoneScale('hips', body.hipsCm)

  const fitColor = (zone: 'bust' | 'waist' | 'hips') => FIT_COLORS[fits.find((x) => x.zone === zone)?.status ?? 'good']
  const colorAt = (y: number) => {
    if (!heatmap) return WHITE
    const zs: Array<[number, THREE.Color]> = []
    if (g.covers.includes('hips')) zs.push([m.y.hip, fitColor('hips')])
    if (g.covers.includes('waist')) zs.push([m.y.waist, fitColor('waist')])
    if (g.covers.includes('bust')) zs.push([m.y.bust, fitColor('bust')])
    if (y <= zs[0][0]) return zs[0][1]
    for (let i = 1; i < zs.length; i++) {
      if (y <= zs[i][0]) return zs[i - 1][1].clone().lerp(zs[i][1], (y - zs[i - 1][0]) / (zs[i][0] - zs[i - 1][0]))
    }
    return zs[zs.length - 1][1]
  }

  const scaleAt = (y: number) => {
    const { y: Y } = m
    if (y >= Y.bust) return lerp(sBust, 1.03, clamp((y - Y.bust) / (Y.shoulder - Y.bust), 0, 1))
    if (y >= Y.waist) return lerp(sWaist, sBust, (y - Y.waist) / (Y.bust - Y.waist))
    if (y >= Y.hip) return lerp(sHips, sWaist, (y - Y.hip) / (Y.waist - Y.hip))
    return sHips
  }

  const startsAtWaist = g.id === 'skirt' || g.id === 'trousers'
  const topY = startsAtWaist ? m.y.waist + 0.012 * m.H : m.y.shoulder + 0.01 * m.H
  const hemY = g.id === 'skirt' ? 0.22 * m.H : g.id === 'trousers' ? m.y.crotch - 0.02 * m.H : m.y.shoulder - g.length * m.H
  const hipRing = torsoRingAt(m, m.y.hip)
  const flare = g.flare * beh.flareK
  const steps = 64
  const rings: TubeRing[] = []
  for (let i = 0; i <= steps; i++) {
    const y = lerp(topY, hemY, i / steps)
    const below = y < m.y.hip
    const bodyRing = y < m.y.crotch + 0.03 * m.H ? hipRing : torsoRingAt(m, y)
    const s = scaleAt(y)
    let rx = bodyRing.rx * s, rz = bodyRing.rz * s
    let fold = 0
    if (below && g.id !== 'trousers') {
      const drop = m.y.hip - y
      const t = drop / Math.max(0.01, m.y.hip - hemY)
      const extra = drop * flare * 0.55
      rx += extra; rz += extra * 0.85
      // Straight garments (shirts, jackets) barely ripple; flared ones fold fully.
      fold = Math.pow(t, 1.3) * clamp(g.flare * 4, 0.1, 1)
    } else if (y > m.y.bust && !startsAtWaist) {
      // Neckline: open up near the top so the neck is visible.
      const t = clamp((y - (m.y.shoulder - 0.004 * m.H)) / (0.014 * m.H), 0, 1)
      rx = lerp(bodyRing.rx * s, m.neckR * 2.1, t)
      rz = lerp(bodyRing.rz * s, m.neckR * 1.8, t)
    }
    // Never sink inside the body
    const minR = y < m.y.crotch + 0.03 * m.H ? hipRing : torsoRingAt(m, y)
    rx = Math.max(rx, minR.rx * 1.012 + 0.003)
    rz = Math.max(rz, minR.rz * 1.012 + 0.003)
    rings.push({ y, rx, rz, fold, color: colorAt(y) })
  }
  const torso = buildTube(rings, 72)

  // Trouser legs
  const legs: Tube[] = []
  if (g.id === 'trousers') {
    for (const side of [-1, 1]) {
      const lr: TubeRing[] = []
      const top = m.y.crotch + 0.03 * m.H, bottom = 0.035 * m.H
      for (let i = 0; i <= 40; i++) {
        const y = lerp(top, bottom, i / 40)
        const t = i / 40
        const lrBody = legRadiusAt(m, y)
        const wide = lerp(legRadiusAt(m, top) * 1.12 + 0.01, 0.085 + flare * 0.12, t)
        const r = Math.max(lrBody * 1.05 + 0.006, wide)
        lr.push({ y, rx: r, rz: r * 0.95, fold: t * 0.5, color: colorAt(m.y.hip), cx: side * m.legOffset })
      }
      legs.push(buildTube(lr, 40))
    }
  }

  // Sleeves (arm-local coordinates: d downward from shoulder joint)
  const sleeves: Tube[] = []
  if (g.sleeves !== 'none') {
    const len = g.sleeves === 'short' ? m.armLength * 0.16 : m.armLength * (g.id === 'abaya' ? 0.98 : 0.93)
    const bell = g.id === 'abaya'
    const ease = g.id === 'jacket' ? 0.016 : g.id === 'shirt' ? 0.012 : 0.01
    for (let k = 0; k < 2; k++) {
      const sr: TubeRing[] = []
      const n = 24
      for (let i = 0; i <= n; i++) {
        const d = lerp(-0.035, len, i / n)
        const t = i / n
        let r = armRadiusAt(m, d) + ease
        if (bell) r = Math.max(r, lerp(0.07, 0.15 * (0.6 + beh.flareK * 0.4), Math.pow(t, 1.4)))
        sr.push({ y: -d, rx: r, rz: r * 0.92, fold: bell ? t * 0.6 : 0, color: colorAt(m.y.bust) })
      }
      sleeves.push(buildTube(sr, 28))
    }
  }

  return { torso, legs, sleeves, hemY }
}

/**
 * Per-frame fold + sway update. Mutates positions of a garment tube in place.
 * Fluid fabrics (low stiffness) ripple and swing; stiff ones hold their shape.
 */
export function animateTube(tube: Tube, beh: FabricBehaviour, time: number, amp = 1) {
  const pos = tube.geometry.attributes.position as THREE.BufferAttribute
  const { rx, rz, theta, fold, y, cx } = tube.base
  const arr = pos.array as Float32Array
  const n = rx.length
  const swing = Math.sin(time * 0.9) * 0.012 * beh.sway * amp
  const phase = time * (0.35 + beh.sway * 0.9)
  for (let k = 0; k < n; k++) {
    const w = fold[k]
    const th = theta[k]
    const ripple = w > 0 ? 1 + (w * beh.foldDepth * Math.sin(beh.folds * th + phase * beh.sway + y[k] * 3)) / Math.max(0.05, (rx[k] + rz[k]) / 2) : 1
    arr[k * 3] = cx[k] + Math.cos(th) * rx[k] * ripple + swing * w
    arr[k * 3 + 2] = Math.sin(th) * rz[k] * ripple + swing * w * 0.4
  }
  pos.needsUpdate = true
  tube.geometry.computeVertexNormals()
}
