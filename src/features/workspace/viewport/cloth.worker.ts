/**
 * Position-based cloth solver (Verlet integration + iterative distance constraints),
 * run off the main thread. Grid = rings × segments wrapped around the body.
 *  - structural / shear / bend constraints with fabric-derived stiffness
 *  - gravity, air damping, friction on contact
 *  - collisions: elliptical torso rings + posed limb capsules + floor
 * Reports positions, per-vertex strain (stretch over rest length) and contact pressure.
 */

interface Params { stretch: number; bend: number; shear: number; damping: number; friction: number; thickness: number }
type InitMsg = { type: 'init'; rings: number; segs: number; init: Float32Array; rest: Float32Array; pins: number; params: Params; torso: Float32Array }
type StepMsg = { type: 'step'; frames: number; capsules: Float32Array; id: number }

let R = 0, S = 0, N = 0
let pos = new Float32Array(0), prev = new Float32Array(0), pinPos = new Float32Array(0)
let pinned = new Uint8Array(0)
let ca = new Uint32Array(0), cb = new Uint32Array(0), cl = new Float32Array(0), ck = new Float32Array(0)
let structCount = 0
let params: Params = { stretch: 1, bend: 0.3, shear: 0.3, damping: 0.03, friction: 0.4, thickness: 0.005 }
let torso = new Float32Array(0)
let pressure = new Float32Array(0)
const G = -9.81
const DT = 1 / 120

const ctx = self as unknown as { postMessage: (m: unknown, transfer?: Transferable[]) => void; onmessage: ((e: MessageEvent) => void) | null }

ctx.onmessage = (e: MessageEvent) => {
  const m = e.data as InitMsg | StepMsg
  if (m.type === 'init') init(m)
  else step(m)
}

function idx(i: number, j: number) { return i * S + (((j % S) + S) % S) }

function init(m: InitMsg) {
  R = m.rings; S = m.segs; N = R * S
  pos = new Float32Array(m.init)
  prev = new Float32Array(m.init)
  pinPos = new Float32Array(m.init)
  pinned = new Uint8Array(N)
  for (let i = 0; i < Math.min(m.pins, R); i++) for (let j = 0; j < S; j++) pinned[idx(i, j)] = 1
  params = m.params
  torso = new Float32Array(m.torso)
  pressure = new Float32Array(N)
  const A: number[] = [], B: number[] = [], K: number[] = []
  const add = (a: number, b: number, k: number) => { A.push(a); B.push(b); K.push(k) }
  for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) {
    if (j + 1 <= S) add(idx(i, j), idx(i, j + 1), params.stretch)
    if (i + 1 < R) add(idx(i, j), idx(i + 1, j), params.stretch)
  }
  structCount = A.length
  for (let i = 0; i + 1 < R; i++) for (let j = 0; j < S; j++) {
    add(idx(i, j), idx(i + 1, j + 1), params.shear * 0.6)
    add(idx(i, j + 1), idx(i + 1, j), params.shear * 0.6)
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) {
    add(idx(i, j), idx(i, j + 2), params.bend * 0.5)
    if (i + 2 < R) add(idx(i, j), idx(i + 2, j), params.bend * 0.5)
  }
  ca = Uint32Array.from(A); cb = Uint32Array.from(B); ck = Float32Array.from(K)
  cl = new Float32Array(A.length)
  const rest = m.rest
  for (let c = 0; c < A.length; c++) {
    const a = A[c] * 3, b = B[c] * 3
    cl[c] = Math.hypot(rest[b] - rest[a], rest[b + 1] - rest[a + 1], rest[b + 2] - rest[a + 2])
  }
  ctx.postMessage({ type: 'ready' })
}

function collide(capsules: Float32Array) {
  const th = params.thickness
  const fr = params.friction
  const nT = torso.length / 3
  const topY = torso[0], botY = torso[(nT - 1) * 3]
  for (let v = 0; v < N; v++) {
    if (pinned[v]) continue
    const o = v * 3
    let x = pos[o], y = pos[o + 1], z = pos[o + 2]
    let depth = 0
    // torso: elliptical rings, interpolated by height (rings sorted top → bottom)
    if (y <= topY && y >= botY) {
      let k = 1
      while (k < nT - 1 && torso[k * 3] > y) k++
      const y0 = torso[(k - 1) * 3], y1 = torso[k * 3]
      const t = y0 === y1 ? 0 : (y - y0) / (y1 - y0)
      const rx = torso[(k - 1) * 3 + 1] + (torso[k * 3 + 1] - torso[(k - 1) * 3 + 1]) * t + th
      const rz = torso[(k - 1) * 3 + 2] + (torso[k * 3 + 2] - torso[(k - 1) * 3 + 2]) * t + th
      const e = (x / rx) ** 2 + (z / rz) ** 2
      if (e < 1 && e > 1e-8) {
        const s = 1 / Math.sqrt(e)
        depth = Math.max(depth, (s - 1) * Math.min(rx, rz))
        x *= s; z *= s
      }
    }
    // limbs: capsules [ax ay az bx by bz r]
    for (let c = 0; c < capsules.length; c += 7) {
      const ax = capsules[c], ay = capsules[c + 1], az = capsules[c + 2]
      const bx = capsules[c + 3], by = capsules[c + 4], bz = capsules[c + 5]
      const r = capsules[c + 6] + th
      const abx = bx - ax, aby = by - ay, abz = bz - az
      const L2 = abx * abx + aby * aby + abz * abz || 1e-9
      let tt = ((x - ax) * abx + (y - ay) * aby + (z - az) * abz) / L2
      tt = tt < 0 ? 0 : tt > 1 ? 1 : tt
      const px = ax + abx * tt, py = ay + aby * tt, pz = az + abz * tt
      const dx = x - px, dy = y - py, dz = z - pz
      const d = Math.hypot(dx, dy, dz)
      if (d < r && d > 1e-6) {
        const s = r / d
        depth = Math.max(depth, r - d)
        x = px + dx * s; y = py + dy * s; z = pz + dz * s
      }
    }
    if (y < 0.003) { y = 0.003; depth = Math.max(depth, 0.001) }
    if (depth > 0) {
      // friction: bleed tangential velocity
      prev[o] += (x - prev[o]) * fr
      prev[o + 1] += (y - prev[o + 1]) * fr
      prev[o + 2] += (z - prev[o + 2]) * fr
    }
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z
    pressure[v] = Math.max(pressure[v] * 0.9, depth)
  }
}

function step(m: StepMsg) {
  const damp = 1 - params.damping
  const g = G * DT * DT
  for (let f = 0; f < m.frames; f++) {
    for (let sub = 0; sub < 2; sub++) {
      for (let v = 0; v < N; v++) {
        const o = v * 3
        if (pinned[v]) { pos[o] = pinPos[o]; pos[o + 1] = pinPos[o + 1]; pos[o + 2] = pinPos[o + 2]; prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2]; continue }
        const x = pos[o], y = pos[o + 1], z = pos[o + 2]
        pos[o] += (x - prev[o]) * damp
        pos[o + 1] += (y - prev[o + 1]) * damp + g
        pos[o + 2] += (z - prev[o + 2]) * damp
        prev[o] = x; prev[o + 1] = y; prev[o + 2] = z
      }
      for (let it = 0; it < 6; it++) {
        for (let c = 0; c < ca.length; c++) {
          const a = ca[c], b = cb[c]
          const ao = a * 3, bo = b * 3
          const dx = pos[bo] - pos[ao], dy = pos[bo + 1] - pos[ao + 1], dz = pos[bo + 2] - pos[ao + 2]
          const L = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (L < 1e-9) continue
          const wa = pinned[a] ? 0 : 1, wb = pinned[b] ? 0 : 1
          const w = wa + wb
          if (!w) continue
          // cloth resists stretch far more than compression (it buckles instead)
          const diff = (L - cl[c]) / L
          const k = diff < 0 ? ck[c] * 0.25 : ck[c]
          const s = (diff * k) / w
          pos[ao] += dx * s * wa; pos[ao + 1] += dy * s * wa; pos[ao + 2] += dz * s * wa
          pos[bo] -= dx * s * wb; pos[bo + 1] -= dy * s * wb; pos[bo + 2] -= dz * s * wb
        }
        if (it === 2 || it === 5) collide(m.capsules)
      }
    }
  }
  // per-vertex strain from structural edges
  const strain = new Float32Array(N), cnt = new Uint8Array(N)
  for (let c = 0; c < structCount; c++) {
    const a = ca[c], b = cb[c]
    const ao = a * 3, bo = b * 3
    const L = Math.hypot(pos[bo] - pos[ao], pos[bo + 1] - pos[ao + 1], pos[bo + 2] - pos[ao + 2])
    const s = Math.max(0, L / cl[c] - 1)
    strain[a] += s; strain[b] += s; cnt[a]++; cnt[b]++
  }
  for (let v = 0; v < N; v++) if (cnt[v]) strain[v] /= cnt[v]
  const out = new Float32Array(pos)
  const pr = new Float32Array(pressure)
  ctx.postMessage({ type: 'state', id: m.id, pos: out, strain, pressure: pr }, [out.buffer, strain.buffer, pr.buffer])
}
