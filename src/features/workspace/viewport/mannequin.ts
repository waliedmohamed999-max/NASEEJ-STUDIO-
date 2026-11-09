import * as THREE from 'three'
import { torsoRingAt, type BodyModel, type Ring } from '@/features/tryon/avatarModel'

/**
 * Fashion-mannequin geometry. Every part is a loft: a path with elliptical
 * cross-sections plus anatomical modulation (bust, glutes, shoulder blades, spine,
 * collarbones, calves, face). The same modulation defines the body *envelope*
 * used by the cloth solver and garment fitting, so cloth never sinks into the bust.
 */

const g = (x: number) => Math.exp(-0.5 * x * x)
const FRONT = Math.PI / 2
const BACK = -Math.PI / 2
const wrapD = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d }

/* ------------------------------------------------------------------ */
/* Torso surface                                                      */
/* ------------------------------------------------------------------ */
export function torsoBump(m: BodyModel, y: number, th: number) {
  const H = m.H
  const bustR = torsoRingAt(m, m.y.bust), hipR = torsoRingAt(m, m.y.hip)
  const Ab = 0.16 * bustR.rz, Ag = 0.17 * hipR.rz
  const yb = (y - (m.y.bust - 0.004 * H)) / (0.032 * H)
  const bust = Ab * g(yb) * (g(wrapD(th, FRONT - 0.5) / 0.32) + g(wrapD(th, FRONT + 0.5) / 0.32))
  const glutes = Ag * g((y - (m.y.hip - 0.035 * H)) / (0.045 * H)) * (g(wrapD(th, BACK - 0.55) / 0.42) + g(wrapD(th, BACK + 0.55) / 0.42))
  const blades = 0.007 * g((y - m.y.armpit) / (0.035 * H)) * (g(wrapD(th, BACK - 0.75) / 0.3) + g(wrapD(th, BACK + 0.75) / 0.3))
  const spine = -0.005 * g(wrapD(th, BACK) / 0.11) * (y > m.y.waist - 0.05 * H && y < m.y.armpit ? 1 : 0.3)
  const belly = 0.009 * g((y - (m.y.waist - 0.05 * H)) / (0.05 * H)) * g(wrapD(th, FRONT) / 0.75)
  const collar = 0.004 * g((y - (m.y.shoulder - 0.012 * H)) / (0.012 * H)) * (g(wrapD(th, FRONT - 0.6) / 0.25) + g(wrapD(th, FRONT + 0.6) / 0.25))
  return bust + glutes + blades + spine + belly + collar
}

/** Base ellipse slightly reduced where the bust is added back, keeping the measured girth. */
function baseScale(m: BodyModel, y: number) {
  return 1 - 0.055 * g((y - m.y.bust) / (0.032 * m.H))
}

export function torsoRadius(m: BodyModel, y: number, th: number) {
  const r = torsoRingAt(m, y)
  const s = baseScale(m, y)
  const c = Math.cos(th), sn = Math.sin(th)
  const base = (r.rx * r.rz) / Math.sqrt((r.rz * c) ** 2 + (r.rx * sn) ** 2)
  return base * s + torsoBump(m, y, th)
}

/** Smallest ellipse containing the modulated torso at height y (for cloth & garment fitting). */
export function envelopeRingAt(m: BodyModel, y: number): Ring {
  let rx = 0, rz = 0
  const rs: number[] = []
  for (let k = 0; k < 72; k++) {
    const th = (k / 72) * Math.PI * 2
    const r = torsoRadius(m, y, th)
    rs.push(r)
    rx = Math.max(rx, Math.abs(Math.cos(th) * r))
    rz = Math.max(rz, Math.abs(Math.sin(th) * r))
  }
  // an ellipse through the extreme points can still cut the bust/glute bumps at oblique angles
  let k = 1
  for (let i = 0; i < 72; i++) {
    const th = (i / 72) * Math.PI * 2
    const c = Math.cos(th), sn = Math.sin(th)
    const e = (rx * rz) / Math.sqrt((rz * c) ** 2 + (rx * sn) ** 2)
    k = Math.max(k, rs[i] / e)
  }
  return { y, rx: rx * k, rz: rz * k }
}

/* ------------------------------------------------------------------ */
/* Generic loft                                                       */
/* ------------------------------------------------------------------ */
export interface Section { p: THREE.Vector3; rx: number; ry: number; mod?: (th: number) => number }

/**
 * Loft elliptical sections along a path. `ref` picks the frame: the section's
 * x-radius lies along cross(ref, tangent). Ends can be capped. Normals face outward.
 */
export function loft(secs: Section[], segs = 40, ref = new THREE.Vector3(0, 0, 1), caps: [boolean, boolean] = [false, false]) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  const n = secs.length
  const nS = segs + 1
  let vAcc = 0
  for (let i = 0; i < n; i++) {
    const s = secs[i]
    const t = secs[Math.min(n - 1, i + 1)].p.clone().sub(secs[Math.max(0, i - 1)].p).normalize()
    const nx = new THREE.Vector3().crossVectors(ref, t).normalize()
    const nb = new THREE.Vector3().crossVectors(t, nx).normalize()
    if (i > 0) vAcc += s.p.distanceTo(secs[i - 1].p)
    for (let j = 0; j < nS; j++) {
      const th = -Math.PI / 2 + (j / segs) * Math.PI * 2
      const k = 1 + (s.mod ? s.mod(th) : 0)
      const v = s.p.clone().addScaledVector(nx, Math.cos(th) * s.rx * k).addScaledVector(nb, Math.sin(th) * s.ry * k)
      pos.push(v.x, v.y, v.z)
      uv.push(j / segs, vAcc * 4)
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) {
    const a = i * nS + j, b = a + nS
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const addCap = (ring: number, flip: boolean) => {
    const c = secs[ring].p
    const ci = pos.length / 3
    pos.push(c.x, c.y, c.z); uv.push(0.5, 0.5)
    for (let j = 0; j < segs; j++) {
      const a = ring * nS + j, b = a + 1
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b)
    }
  }
  if (caps[0]) addCap(0, false)
  if (caps[1]) addCap(n - 1, true)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  // ensure normals point away from the path
  const p = geo.attributes.position as THREE.BufferAttribute
  const nrm = geo.attributes.normal as THREE.BufferAttribute
  const mid = Math.floor(n / 2) * nS + Math.floor(segs / 4)
  const out = new THREE.Vector3(p.getX(mid), p.getY(mid), p.getZ(mid)).sub(secs[Math.floor(n / 2)].p)
  if (out.dot(new THREE.Vector3(nrm.getX(mid), nrm.getY(mid), nrm.getZ(mid))) < 0) {
    const ix = geo.index!.array as Uint32Array | Uint16Array
    for (let q = 0; q < ix.length; q += 3) { const tmp = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = tmp }
    geo.index!.needsUpdate = true
    geo.computeVertexNormals()
  }
  return geo
}

/** Catmull–Rom style smooth resampling of a scalar table. */
function smoothAt(xs: number[], ys: number[], x: number) {
  if (x <= xs[0]) return ys[0]
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1]
  let i = 1
  while (xs[i] < x) i++
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
  const p0 = ys[Math.max(0, i - 2)], p1 = ys[i - 1], p2 = ys[i], p3 = ys[Math.min(ys.length - 1, i + 1)]
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

/* ------------------------------------------------------------------ */
/* Parts                                                              */
/* ------------------------------------------------------------------ */
export function buildTorso(m: BodyModel) {
  // torso ring y's are sorted bottom → top already
  const y0 = m.torso[0].y, y1 = m.torso[m.torso.length - 1].y
  const secs: Section[] = []
  const N = 90
  for (let i = 0; i <= N; i++) {
    const y = y0 + (y1 - y0) * (i / N)
    const r = torsoRingAt(m, y)
    const s = baseScale(m, y)
    secs.push({
      p: new THREE.Vector3(0, y, 0), rx: r.rx * s, ry: r.rz * s,
      // radial modulation relative to the base ellipse
      mod: (th) => {
        const c = Math.cos(th), sn = Math.sin(th)
        const base = (r.rx * r.rz * s) / Math.sqrt((r.rz * c) ** 2 + (r.rx * sn) ** 2)
        return torsoBump(m, y, th) / base
      },
    })
  }
  // loft frame for an upward path with ref z: x-radius along -x, y-radius along +z → θ=π/2 is front
  return loft(secs, 72, new THREE.Vector3(0, 0, 1), [true, true])
}

export function buildHead(m: BodyModel) {
  const R = m.headR
  const c = m.y.head
  // [yRel, width, depth, forward offset] in head radii
  const prof: Array<[number, number, number, number]> = [
    [-1.32, 0.46, 0.5, -0.05], [-1.12, 0.5, 0.62, 0.05], [-1.0, 0.6, 0.78, 0.13], [-0.82, 0.72, 0.84, 0.12],
    [-0.5, 0.82, 0.92, 0.06], [-0.15, 0.86, 0.98, 0.02], [0.2, 0.86, 1.0, -0.01], [0.55, 0.8, 0.95, -0.04],
    [0.82, 0.62, 0.76, -0.06], [0.98, 0.34, 0.42, -0.06], [1.04, 0.08, 0.1, -0.06],
  ]
  const ys = prof.map((p) => p[0])
  const secs: Section[] = []
  for (let i = 0; i <= 40; i++) {
    const yr = -1.32 + (2.36 * i) / 40
    const w = smoothAt(ys, prof.map((p) => p[1]), yr), d = smoothAt(ys, prof.map((p) => p[2]), yr), f = smoothAt(ys, prof.map((p) => p[3]), yr)
    secs.push({
      p: new THREE.Vector3(0, c + yr * R, f * R), rx: w * R, ry: d * R,
      mod: (th) => {
        const front = g(wrapD(th, FRONT) / 0.16)
        const nose = 0.13 * g((yr + 0.2) / 0.16) * front * Math.max(0, 1 - (yr + 0.36) * -2)
        const chin = 0.05 * g((yr + 0.86) / 0.08) * g(wrapD(th, FRONT) / 0.35)
        const brow = 0.025 * g((yr - 0.12) / 0.07) * g(wrapD(th, FRONT) / 0.6)
        const eyes = -0.03 * g((yr - 0.02) / 0.07) * (g(wrapD(th, FRONT - 0.42) / 0.15) + g(wrapD(th, FRONT + 0.42) / 0.15))
        return nose + chin + brow + eyes
      },
    })
  }
  return loft(secs, 64, new THREE.Vector3(0, 0, 1), [true, true])
}

/** Arm in arm-local space (joint at origin, pointing −y), including a mitten hand and thumb. */
export function buildArm(m: BodyModel) {
  const L = m.armLength
  const r0 = m.arm[0].r
  const tbl: Array<[number, number, number]> = [ // d, radius, depth ratio
    [-0.035, r0 * 0.9, 1], [0.0, r0 * 1.02, 1], [0.05, r0 * 0.98, 0.95], [L * 0.3, r0 * 0.84, 0.9],
    [L * 0.46, r0 * 0.7, 0.86], [L * 0.53, r0 * 0.66, 0.82], [L * 0.62, r0 * 0.74, 0.78], [L * 0.85, r0 * 0.58, 0.72], [L, r0 * 0.47, 0.62],
  ]
  const ds = tbl.map((x) => x[0])
  const secs: Section[] = []
  for (let i = 0; i <= 44; i++) {
    const d = -0.035 + ((L + 0.035) * i) / 44
    const r = smoothAt(ds, tbl.map((x) => x[1]), d), k = smoothAt(ds, tbl.map((x) => x[2]), d)
    secs.push({ p: new THREE.Vector3(0, -d, 0), rx: r * k, ry: r })
  }
  const arm = loft(secs, 32, new THREE.Vector3(0, 0, 1), [true, false])
  // hand: palm + fingers as one flattened, slightly cupped mitten
  const hs: Section[] = []
  const hand: Array<[number, number, number]> = [[0, 0.016, 0.026], [0.03, 0.014, 0.036], [0.07, 0.012, 0.04], [0.1, 0.01, 0.036], [0.14, 0.008, 0.028], [0.165, 0.005, 0.016]]
  for (const [d, th, w] of hand) hs.push({ p: new THREE.Vector3(-0.004 * (d / 0.165), -(L + d), 0.004), rx: th, ry: w })
  const palm = loft(hs, 28, new THREE.Vector3(0, 0, 1), [false, true])
  const thumb = loft([
    { p: new THREE.Vector3(0.002, -(L + 0.025), 0.026), rx: 0.009, ry: 0.01 },
    { p: new THREE.Vector3(0.006, -(L + 0.055), 0.04), rx: 0.008, ry: 0.0085 },
    { p: new THREE.Vector3(0.008, -(L + 0.085), 0.045), rx: 0.006, ry: 0.0065 },
  ], 16, new THREE.Vector3(1, 0, 0), [true, true])
  return { arm, palm, thumb }
}

/** Thigh in hip-joint space, shin & foot in knee space. */
export function buildLeg(m: BodyModel) {
  const hipY = m.y.crotch + 0.02 * m.H
  const thighLen = hipY - m.y.knee
  const shinLen = m.y.knee - m.y.ankle
  const tr = m.leg[0].r
  const thighTbl: Array<[number, number]> = [[0.08, tr * 1.12], [0, tr * 1.02], [-thighLen * 0.35, tr * 0.9], [-thighLen * 0.75, tr * 0.7], [-thighLen, m.leg[3].r * 1.02]]
  const tys = thighTbl.map((x) => x[0]).reverse(), trs = thighTbl.map((x) => x[1]).reverse()
  const ts: Section[] = []
  for (let i = 0; i <= 30; i++) {
    const y = 0.08 - ((0.08 + thighLen + 0.01) * i) / 30
    const r = smoothAt(tys, trs, y)
    ts.push({ p: new THREE.Vector3(0, y, 0.004 * Math.sin((i / 30) * Math.PI)), rx: r * 0.96, ry: r, mod: (th) => 0.06 * g(wrapD(th, FRONT) / 0.6) * Math.sin((i / 30) * Math.PI) })
  }
  const thigh = loft(ts, 36, new THREE.Vector3(0, 0, 1), [true, true])
  const kr = m.leg[3].r
  const shinTbl: Array<[number, number]> = [[0.02, kr * 1.02], [0, kr], [-0.07, kr * 1.02], [-shinLen * 0.3, kr * 1.05], [-shinLen * 0.65, kr * 0.78], [-shinLen + 0.025, m.leg[6].r * 1.05], [-shinLen, m.leg[6].r]]
  const sys = shinTbl.map((x) => x[0]).reverse(), srs = shinTbl.map((x) => x[1]).reverse()
  const ss: Section[] = []
  for (let i = 0; i <= 30; i++) {
    const y = 0.02 - ((0.02 + shinLen) * i) / 30
    const r = smoothAt(sys, srs, y)
    const calf = 0.18 * g((y + shinLen * 0.3) / (shinLen * 0.18))
    ss.push({ p: new THREE.Vector3(0, y, 0), rx: r * 0.92, ry: r, mod: (th) => calf * g(wrapD(th, BACK) / 0.7) })
  }
  const shin = loft(ss, 32, new THREE.Vector3(0, 0, 1), [true, true])
  const ground = -m.y.knee
  const footTbl: Array<[number, number, number, number]> = [ // z, width, height, y-centre above ground
    [-0.055, 0.02, 0.022, 0.03], [-0.045, 0.031, 0.033, 0.036], [-0.01, 0.034, 0.038, 0.042], [0.04, 0.04, 0.03, 0.03],
    [0.09, 0.045, 0.02, 0.019], [0.13, 0.04, 0.014, 0.014], [0.155, 0.026, 0.009, 0.011],
  ]
  const fs: Section[] = footTbl.map(([z, w, h, yc]) => ({ p: new THREE.Vector3(0, ground + yc, z), rx: w, ry: h }))
  const foot = loft(fs, 28, new THREE.Vector3(0, 1, 0), [true, true])
  return { thigh, shin, foot, thighLen, hipY }
}

/** Hair shells sized to the lofted head. */
export function buildHair(m: BodyModel, kind: 'none' | 'bun' | 'bob' | 'long') {
  if (kind === 'none') return []
  const R = m.headR
  const c = m.y.head
  const parts: THREE.BufferGeometry[] = []
  const cap = new THREE.SphereGeometry(1, 56, 32, 0, Math.PI * 2, 0, Math.PI * (kind === 'bun' ? 0.5 : 0.56))
  cap.scale(R * 0.95, R * 1.1, R * 1.1)
  cap.rotateX(-0.5)
  cap.translate(0, c + R * 0.06, -R * 0.07)
  parts.push(cap)
  if (kind === 'bun') {
    const bun = new THREE.SphereGeometry(R * 0.36, 28, 20)
    bun.scale(1, 0.85, 0.9)
    bun.translate(0, c + R * 0.62, -R * 0.82)
    parts.push(bun)
  }
  if (kind === 'bob') {
    const bob = new THREE.CylinderGeometry(R * 0.95, R * 1.02, R * 1.05, 48, 1, true, Math.PI * 0.6, Math.PI * 1.8)
    bob.translate(0, c - R * 0.2, -R * 0.05)
    parts.push(bob)
  }
  if (kind === 'long') {
    const back = loft([
      { p: new THREE.Vector3(0, c + R * 0.2, -R * 0.35), rx: R * 0.88, ry: R * 0.62 },
      { p: new THREE.Vector3(0, c - R * 1.0, -R * 0.62), rx: R * 0.92, ry: R * 0.34 },
      { p: new THREE.Vector3(0, c - R * 2.6, -R * 0.95), rx: R * 0.8, ry: R * 0.2 },
      { p: new THREE.Vector3(0, c - R * 3.0, -R * 1.0), rx: R * 0.55, ry: R * 0.12 },
    ], 40, new THREE.Vector3(0, 0, 1), [false, true])
    parts.push(back)
  }
  return parts
}

/* ------------------------------------------------------------------ */
/* Fabric relief: normal map from the weave texture (Sobel on luminance) */
/* ------------------------------------------------------------------ */
const nmCache = new WeakMap<HTMLCanvasElement, THREE.CanvasTexture>()
export function normalMapFor(src: HTMLCanvasElement, strength = 2.2) {
  const hit = nmCache.get(src)
  if (hit) return hit
  const W = src.width, H = src.height
  const sd = src.getContext('2d')!.getImageData(0, 0, W, H).data
  const lum = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) lum[i] = (sd[i * 4] * 0.3 + sd[i * 4 + 1] * 0.59 + sd[i * 4 + 2] * 0.11) / 255
  const out = document.createElement('canvas')
  out.width = W; out.height = H
  const ctx = out.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const at = (x: number, y: number) => lum[((y + H) % H) * W + ((x + W) % W)]
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))
    const v = new THREE.Vector3(-dx * strength, -dy * strength, 1).normalize()
    const o = (y * W + x) * 4
    img.data[o] = (v.x * 0.5 + 0.5) * 255; img.data[o + 1] = (v.y * 0.5 + 0.5) * 255; img.data[o + 2] = (v.z * 0.5 + 0.5) * 255; img.data[o + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(out)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  nmCache.set(src, tex)
  return tex
}

/** Darken back faces so the inside of a garment reads as fabric, not a hole. */
export function shadeBackFaces<T extends THREE.Material>(mat: T): T {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb *= 0.58;',
    )
  }
  mat.customProgramCacheKey = () => 'backshade'
  return mat
}
