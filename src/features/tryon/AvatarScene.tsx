import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Body, Fabric, GarmentTemplate } from '@/types'
import type { SizeCode } from '@/data/garments'
import { fabricTextureCanvas } from '@/lib/textures'
import { zoneFits } from '@/lib/textile'
import {
  animateTube, buildBodyModel, buildGarment, buildTube, fabricBehaviour,
  type BodyModel, type Tube, type TubeRing,
} from './avatarModel'

export interface AvatarSceneProps {
  body: Body
  garment: GarmentTemplate
  fabric: Fabric
  color?: string | null
  size: SizeCode
  heatmap?: boolean
  autoRotate?: boolean
  /** smaller camera framing + no zoom, for embedded previews */
  compact?: boolean
  className?: string
}

const SKIN = '#d9cdbf'

export default function AvatarScene(props: AvatarSceneProps) {
  const model = useMemo(() => buildBodyModel(props.body), [props.body])
  const H = model.H
  return (
    <Canvas
      className={props.className}
      dpr={[1, 2]}
      shadows={false}
      camera={{ position: [0, H * 0.58, props.compact ? 3.1 : 3.6], fov: 32, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
    >
      <hemisphereLight args={['#fff8ee', '#8a7f72', 0.9]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 2.5, -2]} intensity={0.6} color="#cfd8ff" />
      <directionalLight position={[0, 1.5, -4]} intensity={0.5} />
      <group>
        <Mannequin m={model} />
        <Garment {...props} m={model} />
      </group>
      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={2.4} blur={2.4} far={1.2} />
      <OrbitControls
        target={[0, H * 0.52, 0]}
        enablePan={false}
        enableZoom={!props.compact}
        minDistance={1.4}
        maxDistance={5}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.62}
        autoRotate={props.autoRotate}
        autoRotateSpeed={1.4}
        enableDamping
      />
    </Canvas>
  )
}

/* ---------------- Mannequin ---------------- */

function useTube(build: () => Tube, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tube = useMemo(build, deps)
  useEffect(() => () => tube.geometry.dispose(), [tube])
  return tube
}

function Mannequin({ m }: { m: BodyModel }) {
  const torso = useTube(() => buildTube([...m.torso].reverse().map((r) => ({ ...r })), 48), [m])
  const legs = useTube(
    () => buildTube(m.leg.map((p) => ({ y: p.y, rx: p.r, rz: p.r * 0.96 })), 28),
    [m],
  )
  const arm = useTube(() => buildTube(m.arm.map((p) => ({ y: -p.d, rx: p.r, rz: p.r * 0.9 })), 24), [m])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62, metalness: 0 }), [])
  useEffect(() => () => mat.dispose(), [mat])

  return (
    <group>
      <mesh geometry={torso.geometry} material={mat} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={legs.geometry} material={mat} position={[s * m.legOffset, 0, 0]} />
          {/* foot */}
          <mesh material={mat} position={[s * m.legOffset, 0.025, 0.045]} scale={[0.045, 0.028, 0.11]}>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
          <group position={[s * m.shoulderJoint.x, m.shoulderJoint.y, 0]} rotation={[0, 0, s * m.armAngle]}>
            <mesh geometry={arm.geometry} material={mat} />
            <mesh material={mat} position={[0, -m.armLength - 0.05, 0]} scale={[0.028, 0.06, 0.016]}>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
            {/* shoulder cap */}
            <mesh material={mat} position={[0, -0.012, 0]} scale={[m.arm[0].r * 0.92, m.arm[0].r * 0.88, m.arm[0].r * 0.9]}>
              <sphereGeometry args={[1, 18, 14]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* head */}
      <mesh material={mat} position={[0, m.y.head, 0.008]} scale={[m.headR * 0.86, m.headR * 1.1, m.headR * 0.95]}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
    </group>
  )
}

/* ---------------- Garment ---------------- */

function Garment({ m, body, garment, fabric, color, size, heatmap = false }: AvatarSceneProps & { m: BodyModel }) {
  const fits = useMemo(() => zoneFits(body, garment, fabric, size), [body, garment, fabric, size])
  const build = useMemo(() => buildGarment(m, garment, fabric, size, body, fits, heatmap), [m, garment, fabric, size, body, fits, heatmap])
  const beh = useMemo(() => fabricBehaviour(fabric), [fabric])

  useEffect(() => () => {
    build.torso?.geometry.dispose()
    build.legs.forEach((t) => t.geometry.dispose())
    build.sleeves.forEach((t) => t.geometry.dispose())
  }, [build])

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(fabricTextureCanvas(fabric, { color: color ?? undefined, size: 256 }))
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [fabric, color])
  useEffect(() => () => texture.dispose(), [texture])

  const material = useMemo(() => {
    const translucent = fabric.opacity < 0.9
    const mat = new THREE.MeshPhysicalMaterial({
      map: heatmap ? null : texture,
      vertexColors: heatmap,
      color: '#ffffff',
      roughness: heatmap ? 0.7 : 1 - fabric.sheen * 0.62,
      metalness: 0,
      sheen: fabric.construction === 'velvet' ? 1 : 0.25 + fabric.sheen * 0.6,
      sheenRoughness: fabric.construction === 'velvet' ? 0.35 : 0.5,
      sheenColor: new THREE.Color(color ?? fabric.color).lerp(new THREE.Color('#ffffff'), 0.5),
      side: THREE.DoubleSide,
      transparent: translucent || heatmap,
      opacity: heatmap ? 0.94 : translucent ? Math.max(0.55, fabric.opacity + 0.15) : 1,
      depthWrite: !translucent,
    })
    return mat
  }, [texture, fabric, color, heatmap])
  useEffect(() => () => material.dispose(), [material])

  const tubes = useRef<Tube[]>([])
  tubes.current = [build.torso, ...build.legs].filter(Boolean) as Tube[]
  const sleeveTubes = build.sleeves

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (const tube of tubes.current) animateTube(tube, beh, t)
    if (garment.id === 'abaya') for (const s of sleeveTubes) animateTube(s, beh, t + 0.6, 0.6)
  })

  return (
    <group>
      {build.torso && <mesh geometry={build.torso.geometry} material={material} renderOrder={2} />}
      {build.legs.map((l, i) => <mesh key={i} geometry={l.geometry} material={material} renderOrder={2} />)}
      {build.sleeves.map((sl, i) => {
        const s = i === 0 ? -1 : 1
        return (
          <group key={i} position={[s * m.shoulderJoint.x, m.shoulderJoint.y, 0]} rotation={[0, 0, s * m.armAngle]}>
            <mesh geometry={sl.geometry} material={material} renderOrder={2} />
          </group>
        )
      })}
    </group>
  )
}

export type { TubeRing }
