import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { BodyModel, Ring } from '@/features/tryon/avatarModel'
import { proceduralEnvelopeAt } from './mannequin'
import { useAvatar } from './avatarStore'

/**
 * A real human model (.glb / .gltf) in place of the procedural figure.
 *  1. Scaled to the size's body height, feet on the floor, torso centred on the axis.
 *  2. Its actual surface is sliced into 1 cm bands; each torso band becomes an
 *     ellipse that contains every surface point (arms excluded by width), and that
 *     measured envelope replaces the procedural one for garment fitting and cloth
 *     collision — so the dress drapes on *this* body.
 * Expected input: an unclothed (or underwear) figure in an A-pose, facing +Z
 * (use “turn 180°” otherwise). Static: poses apply to the built-in figure only.
 */
export function CustomAvatar({ url, flip, m, onEnvelope }: {
  url: string; flip: boolean; m: BodyModel; onEnvelope: (fn: ((y: number) => Ring | null) | null) => void
}) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null)

  useEffect(() => {
    let alive = true
    useAvatar.getState().set({ loading: true, error: null })
    new GLTFLoader().load(url, (gltf) => {
      if (!alive) return
      const root = gltf.scene
      fit(root, m, flip)
      root.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false }
      })
      onEnvelope(measureEnvelope(root, m))
      setObj(root)
      useAvatar.getState().set({ loading: false })
    }, undefined, (err) => {
      if (!alive) return
      useAvatar.getState().set({ loading: false, error: String((err as Error)?.message ?? err) })
      onEnvelope(null)
    })
    return () => { alive = false; onEnvelope(null) }
  }, [url, flip, m]) // eslint-disable-line react-hooks/exhaustive-deps

  return obj ? <primitive object={obj} /> : null
}

/** Every vertex in world space (skinned meshes in their current pose). */
function worldVertices(root: THREE.Object3D, cap = 250_000) {
  const out: THREE.Vector3[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return
    const pos = mesh.geometry.attributes.position
    const step = Math.max(1, Math.ceil(pos.count / cap))
    const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null
    for (let i = 0; i < pos.count; i += step) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i)
      if (skinned) skinned.applyBoneTransform(i, v)
      out.push(v.applyMatrix4(mesh.matrixWorld))
    }
  })
  return out
}

/**
 * T-pose → A-pose: rotate each upper-arm bone in world space until the arm hangs
 * at the built-in figure's angle, so sleeves and arm colliders line up.
 * Works with common rigs (Mixamo, MakeHuman/MPFB, Blender/Unity humanoid names).
 */
function toAPose(root: THREE.Object3D, armAngle: number) {
  root.updateMatrixWorld(true)
  const bones: THREE.Bone[] = []
  root.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone) })
  // upper arm = the first 'arm' segment: LeftArm, upperarm_l, Upper_Arm.R, arm.L … (not forearm, hand, armature)
  const isUpperArm = (n: string) => /arm/i.test(n) && !/fore|lower|hand|twist|shoulder|clavicle|armature|roll/i.test(n)
  for (const bone of bones) {
    const name = bone.name.replace(/^mixamorig:?/i, '')
    if (!isUpperArm(name)) continue
    const child = bone.children.find((c) => (c as THREE.Bone).isBone)
    if (!child) continue
    const a = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)
    const b = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld)
    const dir = b.clone().sub(a).normalize()
    if (Math.abs(dir.y) > 0.75) continue // already hanging down
    const side = Math.sign(dir.x) || 1
    const target = new THREE.Vector3(side * Math.sin(armAngle), -Math.cos(armAngle), dir.z * 0.3).normalize()
    const qWorld = new THREE.Quaternion().setFromUnitVectors(dir, target)
    const parentQ = new THREE.Quaternion()
    bone.parent?.getWorldQuaternion(parentQ)
    const boneQ = new THREE.Quaternion()
    bone.getWorldQuaternion(boneQ)
    bone.quaternion.copy(parentQ.clone().invert().multiply(qWorld).multiply(boneQ))
    bone.updateMatrixWorld(true)
  }
  root.updateMatrixWorld(true)
}

function fit(root: THREE.Object3D, m: BodyModel, flip: boolean) {
  if (flip) root.rotation.y = Math.PI
  toAPose(root, m.armAngle)
  root.updateMatrixWorld(true)
  let verts = worldVertices(root, 60_000)
  const box = new THREE.Box3().setFromPoints(verts)
  const h = box.max.y - box.min.y || 1
  const s = m.H / h
  root.scale.multiplyScalar(s)
  root.updateMatrixWorld(true)
  verts = worldVertices(root, 60_000)
  const b2 = new THREE.Box3().setFromPoints(verts)
  // centre on the torso (between waist and bust), not the bbox, so arms don't skew it
  const torso = verts.filter((v) => v.y > m.y.waist && v.y < m.y.bust && Math.abs(v.x - (b2.min.x + b2.max.x) / 2) < 0.16)
  const tb = torso.length ? new THREE.Box3().setFromPoints(torso) : b2
  root.position.x -= (tb.min.x + tb.max.x) / 2
  root.position.z -= (tb.min.z + tb.max.z) / 2
  root.position.y -= b2.min.y
  root.updateMatrixWorld(true)
}

/** All triangles in world space (skinned), as flat xyz triples. */
function worldTriangles(root: THREE.Object3D) {
  const tris: number[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return
    const pos = mesh.geometry.attributes.position
    const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null
    const world = new Float32Array(pos.count * 3)
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      if (skinned) skinned.applyBoneTransform(i, v)
      v.applyMatrix4(mesh.matrixWorld)
      world[i * 3] = v.x; world[i * 3 + 1] = v.y; world[i * 3 + 2] = v.z
    }
    const idx = mesh.geometry.index
    const count = idx ? idx.count : pos.count
    for (let k = 0; k < count; k++) {
      const vi = idx ? idx.getX(k) : k
      tris.push(world[vi * 3], world[vi * 3 + 1], world[vi * 3 + 2])
    }
  })
  return Float32Array.from(tris)
}

/** Dense cross-section contour at height y: triangle/plane intersections sampled every 3 mm. */
function sliceAt(tris: Float32Array, y: number) {
  const out: THREE.Vector3[] = []
  const p: number[][] = []
  for (let t = 0; t < tris.length; t += 9) {
    p.length = 0
    for (let e = 0; e < 3; e++) {
      const a = t + e * 3, b = t + ((e + 1) % 3) * 3
      const ya = tris[a + 1], yb = tris[b + 1]
      if ((ya <= y && yb > y) || (yb <= y && ya > y)) {
        const k = (y - ya) / (yb - ya)
        p.push([tris[a] + (tris[b] - tris[a]) * k, tris[a + 2] + (tris[b + 2] - tris[a + 2]) * k])
      }
    }
    if (p.length < 2) continue
    const [[x0, z0], [x1, z1]] = p
    const L = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.ceil(L / 0.003))
    for (let i = 0; i <= n; i++) out.push(new THREE.Vector3(x0 + (x1 - x0) * (i / n), y, z0 + (z1 - z0) * (i / n)))
  }
  return out
}

function measureEnvelope(root: THREE.Object3D, m: BodyModel): (y: number) => Ring | null {
  const tris = worldTriangles(root)
  const y0 = m.y.crotch - 0.01, y1 = m.y.chin
  const step = 0.01
  const n = Math.ceil((y1 - y0) / step) + 1
  const bands: Array<Ring | null> = []
  for (let i = 0; i < n; i++) {
    const y = y0 + i * step
    const proc = proceduralEnvelopeAt(m, y)
    const band = sliceAt(tris, y).filter((v) => Math.abs(v.x) < proc.rx * 2.2)
    // Separate torso from arms: grow outward from the centre in 5 mm bins and stop
    // at the first gap of ≥ 1 cm (the space between body and hanging arm).
    const BIN = 0.005, NB = Math.ceil((proc.rx * 2.2) / BIN)
    const occ = new Uint8Array(NB * 2 + 1)
    for (const v of band) occ[Math.max(0, Math.min(NB * 2, Math.round(v.x / BIN) + NB))] = 1
    let lo = NB, hi = NB, gap = 0
    for (let i = NB; i <= NB * 2; i++) { if (occ[i]) { hi = i; gap = 0 } else if (++gap >= 2 && i - NB > 4) break }
    gap = 0
    for (let i = NB; i >= 0; i--) { if (occ[i]) { lo = i; gap = 0 } else if (++gap >= 2 && NB - i > 4) break }
    const xl = (lo - NB - 0.5) * BIN, xr = (hi - NB + 0.5) * BIN
    const pts = band.filter((v) => v.x >= xl && v.x <= xr)
    if (pts.length < 12) { bands.push(null); continue }
    let rx = 0, rz = 0
    for (const p of pts) { rx = Math.max(rx, Math.abs(p.x)); rz = Math.max(rz, Math.abs(p.z)) }
    let k = 1
    for (const p of pts) k = Math.max(k, Math.sqrt((p.x / rx) ** 2 + (p.z / rz) ** 2))
    bands.push({ y, rx: rx * k + 0.002, rz: rz * k + 0.002 })
  }
  // fill gaps from neighbours, then smooth
  for (let i = 0; i < n; i++) if (!bands[i]) bands[i] = bands[i - 1] ?? bands.find(Boolean) ?? null
  for (let pass = 0; pass < 2; pass++) {
    const c = bands.map((b) => (b ? { ...b } : null))
    for (let i = 1; i < n - 1; i++) {
      const a = c[i - 1], b = c[i], d = c[i + 1]
      if (a && b && d) bands[i] = { y: b.y, rx: Math.max(b.rx, (a.rx + 2 * b.rx + d.rx) / 4), rz: Math.max(b.rz, (a.rz + 2 * b.rz + d.rz) / 4) }
    }
  }
  return (y: number) => {
    if (y < y0 || y > y1) return null
    const f = (y - y0) / step
    const i = Math.floor(f), t = f - i
    const a = bands[Math.min(n - 1, i)], b = bands[Math.min(n - 1, i + 1)]
    if (!a || !b) return null
    return { y, rx: a.rx + (b.rx - a.rx) * t, rz: a.rz + (b.rz - a.rz) * t }
  }
}
