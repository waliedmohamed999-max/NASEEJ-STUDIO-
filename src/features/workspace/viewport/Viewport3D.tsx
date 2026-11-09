import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Pause, Play, RotateCw, Sparkles, Undo2, Bookmark } from 'lucide-react'
import { fabricById } from '@/data/fabrics'
import { cn } from '@/lib/utils'
import { toast } from '@/stores/ui'
import type { Body } from '@/types'
import { buildBodyModel, buildTube, type BodyModel, type Tube, type TubeRing } from '@/features/tryon/avatarModel'
import { useWorkspace, useActiveStyle, type Lighting, type Pose, type FitMap } from '../store'
import { useTransient, effectiveMaterial, materialTile, tileCm } from '../render'
import { gradeStyle, BODY } from '../model/grading'
import { deriveSpec } from '../model/spec'
import { fabricPhysics, solverParams } from '../model/physics'
import type { Style } from '../model/types'
import { buildGarment3D, easeColor, strainColor, pressureColor, LEGENDS, type Garment3D } from './garment3d'
import { buildArm, buildHair, buildHead, buildLeg, buildTorso, envelopeRingAt, normalMapFor, shadeBackFaces } from './mannequin'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { registerViewport } from './simApi'

/* ------------------------------------------------------------------ */
/* Presets                                                            */
/* ------------------------------------------------------------------ */
const SKINS = ['#d9cdbf', '#f1d6c4', '#e0b899', '#c99a74', '#a87655', '#7d5238', '#4f3324']
const HAIR_COLOR = '#2b2019'
const BG: Record<Lighting, string> = {
  studio: 'radial-gradient(120% 90% at 50% 30%, #fbf9f5 0%, #ece6dc 70%, #e2dbcf 100%)',
  daylight: 'linear-gradient(180deg, #eef3f7 0%, #f6f3ec 60%, #e9e3d7 100%)',
  runway: 'radial-gradient(80% 70% at 50% 25%, #2a2826 0%, #121212 70%)',
  atelier: 'radial-gradient(110% 90% at 30% 20%, #efe2cc 0%, #d8c6a8 55%, #b9a382 100%)',
}
const SEGS = 88
const SIM_FRAMES = 360

interface Angles { hipL: number; hipR: number; kneeL: number; kneeR: number; armL: number; armR: number; yaw: number; rootY: number; rootZ: number }

function poseAngles(pose: Pose, t: number, m: BodyModel): Angles {
  const thigh = (m.y.crotch + 0.02 * m.H) - m.y.knee
  const shin = m.y.knee - m.y.ankle
  const base: Angles = { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, armL: 0, armR: 0, yaw: 0, rootY: 0, rootZ: 0 }
  if (pose === 'walking') {
    const ph = t * Math.PI * 2 * 0.9
    const s = Math.sin(ph)
    return {
      ...base,
      hipL: -0.36 * s, hipR: 0.36 * s,
      kneeL: 0.55 * Math.max(0, Math.sin(ph + 1.9)), kneeR: 0.55 * Math.max(0, Math.sin(ph + 1.9 + Math.PI)),
      armL: 0.3 * s, armR: -0.3 * s,
      rootY: -0.012 * (1 - Math.abs(Math.cos(ph))),
    }
  }
  if (pose === 'turning') return { ...base, yaw: 0.65, hipL: -0.12, kneeL: 0.14, hipR: 0.04, armL: 0.1, armR: -0.06 }
  if (pose === 'sitting') {
    const hipJointY = m.y.crotch + 0.02 * m.H
    return { ...base, hipL: -1.48, hipR: -1.48, kneeL: 1.48, kneeR: 1.48, armL: -0.25, armR: -0.25, rootY: shin + m.y.ankle - hipJointY + 0.02, rootZ: -thigh * 0.45 }
  }
  return base
}

function mixAngles(a: Angles, b: Angles, t: number): Angles {
  const out = { ...a }
  for (const k of Object.keys(a) as Array<keyof Angles>) out[k] = a[k] + (b[k] - a[k]) * t
  return out
}

/** Limb capsules in root-local space for the cloth solver. */
function capsules(m: BodyModel, a: Angles): Float32Array {
  const out: number[] = []
  const hipY = m.y.crotch + 0.02 * m.H
  const thigh = hipY - m.y.knee, shin = m.y.knee - m.y.ankle
  const thighR = m.leg[0].r * 0.95
  for (const [side, hip, knee] of [[-1, a.hipL, a.kneeL], [1, a.hipR, a.kneeR]] as const) {
    const h = new THREE.Vector3(side * m.legOffset, hipY, 0)
    const k = h.clone().add(new THREE.Vector3(0, -Math.cos(hip), -Math.sin(hip)).multiplyScalar(thigh))
    const an = k.clone().add(new THREE.Vector3(0, -Math.cos(hip + knee), -Math.sin(hip + knee)).multiplyScalar(shin))
    out.push(h.x, h.y, h.z, k.x, k.y, k.z, thighR, k.x, k.y, k.z, an.x, an.y, an.z, 0.05)
  }
  for (const [side, sw] of [[-1, a.armL], [1, a.armR]] as const) {
    const th = side * m.armAngle
    const sh = new THREE.Vector3(side * m.shoulderJoint.x, m.shoulderJoint.y, 0)
    const dir = new THREE.Vector3(Math.sin(th), -Math.cos(th) * Math.cos(sw), -Math.cos(th) * Math.sin(sw))
    const wr = sh.clone().add(dir.multiplyScalar(m.armLength))
    out.push(sh.x, sh.y, sh.z, wr.x, wr.y, wr.z, m.arm[0].r * 0.98)
  }
  return Float32Array.from(out)
}

/* ------------------------------------------------------------------ */
/* Simulation client                                                  */
/* ------------------------------------------------------------------ */
interface SimState { pos: Float32Array; strain: Float32Array; pressure: Float32Array }

class ClothClient {
  worker: Worker | null = null
  busy = false
  id = 0
  latest: SimState | null = null
  onState: ((s: SimState) => void) | null = null
  start(g: Garment3D, params: ReturnType<typeof solverParams>, torso: Float32Array) {
    this.stop()
    this.worker = new Worker(new URL('./cloth.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e) => {
      if (e.data.type === 'state') { this.busy = false; this.latest = e.data; this.onState?.(e.data) }
    }
    const R = g.init.length
    const init = new Float32Array(R * SEGS * 3), rest = new Float32Array(R * SEGS * 3)
    for (let i = 0; i < R; i++) for (let j = 0; j < SEGS; j++) {
      const th = -Math.PI / 2 + (j / SEGS) * Math.PI * 2
      const o = (i * SEGS + j) * 3
      const n = g.fold[i] * 0.002 * Math.sin(j * 2.3 + i) // break symmetry so folds can form
      init[o] = Math.cos(th) * (g.init[i].rx + n); init[o + 1] = g.init[i].y; init[o + 2] = Math.sin(th) * (g.init[i].rz + n)
      rest[o] = Math.cos(th) * g.rest[i].rx; rest[o + 1] = g.rest[i].y; rest[o + 2] = Math.sin(th) * g.rest[i].rz
    }
    this.worker.postMessage({ type: 'init', rings: R, segs: SEGS, init, rest, pins: g.pinRings, params, torso })
  }
  step(frames: number, caps: Float32Array) {
    if (!this.worker || this.busy) return false
    this.busy = true
    this.worker.postMessage({ type: 'step', frames, capsules: caps, id: ++this.id })
    return true
  }
  stop() { this.worker?.terminate(); this.worker = null; this.busy = false; this.latest = null }
}

/* ------------------------------------------------------------------ */

export default function Viewport3D() {
  const { t } = useTranslation('ws')
  const style = useActiveStyle()
  const w = useWorkspace()
  const tr = useTransient()
  const [autoRotate, setAutoRotate] = useState(false)
  const [live, setLive] = useState(false)
  const [phase, setPhase] = useState(0)
  const [camGoal, setCamGoal] = useState<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const [bookmarks, setBookmarks] = useState<Array<{ pos: THREE.Vector3; target: THREE.Vector3 }>>([])
  const simCmd = useRef<{ run: number; reset: number }>({ run: 0, reset: 0 })
  const [, force] = useState(0)

  useEffect(() => {
    registerViewport({
      run: () => { simCmd.current.run++; force((n) => n + 1) },
      reset: () => { simCmd.current.reset++; force((n) => n + 1) },
    })
    return () => registerViewport(null)
  }, [])

  if (!style) return null
  const body = bodyFor(w.viewSize)
  const H = body.heightCm / 100
  const views = {
    front: { pos: new THREE.Vector3(0, H * 0.6, 3.6), target: new THREE.Vector3(0, H * 0.52, 0) },
    three: { pos: new THREE.Vector3(2.5, H * 0.62, 2.6), target: new THREE.Vector3(0, H * 0.52, 0) },
    side: { pos: new THREE.Vector3(3.6, H * 0.6, 0), target: new THREE.Vector3(0, H * 0.52, 0) },
    back: { pos: new THREE.Vector3(0, H * 0.6, -3.6), target: new THREE.Vector3(0, H * 0.52, 0) },
    detail: { pos: new THREE.Vector3(0.5, H * 0.8, 1.5), target: new THREE.Vector3(0, H * 0.74, 0) },
  }
  const dark = w.lighting === 'runway'

  return (
    <div className="relative h-full w-full" style={{ background: BG[w.lighting] }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: views.front.pos.toArray(), fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}>
        <StudioEnvironment preset={w.lighting} />
        <Lights preset={w.lighting} />
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.0005, 0]} receiveShadow><planeGeometry args={[6, 6]} /><shadowMaterial opacity={dark ? 0.45 : 0.16} /></mesh>
        <Scene style={style} body={body} pose={w.pose} playing={w.playing} phase={phase} live={live}
          fitMap={w.fitMap} skin={w.skin} hair={w.hair} simCmd={simCmd.current} viewSize={w.viewSize} />
        <ContactShadows position={[0, 0.001, 0]} opacity={dark ? 0.6 : 0.32} scale={3} blur={2.6} far={1.4} />
        <Controls H={H} autoRotate={autoRotate} goal={camGoal} onArrive={() => setCamGoal(null)} views={views} bg={BG[w.lighting]} />
      </Canvas>

      {/* top toolbar */}
      <div className={cn('absolute inset-x-2 top-7 flex flex-wrap items-center gap-1.5 text-[11px]', dark && 'text-white')}>
        <button className="ws-btn" data-variant="accent" onClick={() => { simCmd.current.run++; force((n) => n + 1) }} disabled={tr.simStatus === 'running'} title="Ctrl+Enter">
          <Sparkles />{tr.simStatus === 'running' ? t('sim.simulating', { p: Math.round(tr.simProgress * 100) }) : t('sim.simulate')}
        </button>
        {tr.simStatus === 'settled' && <button className="ws-btn" onClick={() => { simCmd.current.reset++; setLive(false); force((n) => n + 1) }}><Undo2 />{t('sim.reset')}</button>}
        <label className="flex items-center gap-1 rounded border border-border bg-background/80 px-1.5 py-0.5 text-foreground">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-[var(--accent)]" />{t('sim.live')}
        </label>
        <MiniSelect label={t('sim.pose')} value={w.pose} onChange={(v) => w.set({ pose: v as Pose, playing: v === 'walking' })}
          options={(['standing', 'walking', 'turning', 'sitting'] as const).map((v) => [v, t(`sim.poses.${v}`)])} />
        <MiniSelect label={t('sim.lighting')} value={w.lighting} onChange={(v) => w.set({ lighting: v as Lighting })}
          options={(['studio', 'daylight', 'runway', 'atelier'] as const).map((v) => [v, t(`sim.lights.${v}`)])} />
        <MiniSelect label={t('sim.fitMap')} value={w.fitMap} onChange={(v) => w.set({ fitMap: v as FitMap })}
          options={(['off', 'strain', 'pressure', 'ease'] as const).map((v) => [v, t(`sim.maps.${v}`)])} />
        <MiniSelect label={t('sim.hair')} value={w.hair} onChange={(v) => w.set({ hair: v as typeof w.hair })}
          options={(['none', 'bun', 'bob', 'long'] as const).map((v) => [v, t(`sim.hairs.${v}`)])} />
        <span className="flex items-center gap-0.5 rounded border border-border bg-background/80 px-1 py-0.5" role="radiogroup" aria-label={t('sim.skin')}>
          {SKINS.map((c) => (
            <button key={c} role="radio" aria-checked={w.skin === c} aria-label={c} onClick={() => w.set({ skin: c })}
              className={cn('size-3.5 rounded-full border border-black/15', w.skin === c && 'ring-1 ring-accent ring-offset-1')} style={{ background: c }} />
          ))}
        </span>
      </div>

      {/* camera bar */}
      <div className="absolute end-2 top-16 flex flex-col gap-1 text-[10px]">
        {(Object.keys(views) as Array<keyof typeof views>).map((k) => (
          <button key={k} className="ws-btn !h-6 !px-2" onClick={() => setCamGoal(views[k])}>{t(`sim.views.${k}`)}</button>
        ))}
        {bookmarks.map((b, i) => <button key={i} className="ws-btn !h-6 !px-2" onClick={() => setCamGoal(b)}>★ {i + 1}</button>)}
        <button className="ws-btn !h-6 !px-2" title={t('sim.bookmark')} aria-label={t('sim.bookmark')}
          onClick={() => { const c = cameraState.current; if (c) setBookmarks((bs) => [...bs.slice(-4), c]) }}><Bookmark className="!size-3" /></button>
        <button className="ws-btn !h-6 !px-2" aria-pressed={autoRotate} data-variant={autoRotate ? 'solid' : undefined} onClick={() => setAutoRotate((a) => !a)} title={t('sim.turntable')} aria-label={t('sim.turntable')}>
          <RotateCw className="!size-3" />
        </button>
      </div>

      {/* legend */}
      {w.fitMap !== 'off' && (
        <div className="absolute bottom-12 start-2 rounded border border-border bg-background/90 p-2 text-[10px]">
          <p className="mb-1 text-muted-foreground">{t(`sim.maps.${w.fitMap}`)}</p>
          <div className="flex h-2 w-40 overflow-hidden rounded" style={{ background: `linear-gradient(90deg, ${LEGENDS[w.fitMap].join(',')})` }} />
          <div className="mt-0.5 flex justify-between text-muted-foreground num" dir="ltr">
            {w.fitMap === 'strain' && <><span>0%</span><span>5%</span><span>18%+</span></>}
            {w.fitMap === 'pressure' && <><span>0</span><span>6 mm</span><span>12 mm+</span></>}
            {w.fitMap === 'ease' && <><span>−4 cm</span><span>+3</span><span>+30 cm</span></>}
          </div>
        </div>
      )}

      {/* timeline */}
      <div className="absolute inset-x-0 bottom-0 flex h-9 items-center gap-2 border-t border-border bg-surface/90 px-2 backdrop-blur">
        <button className="ws-icon-btn" onClick={() => w.set({ playing: !w.playing, pose: w.pose === 'walking' ? w.pose : 'walking' })} aria-label={w.playing ? t('sim.pause') : t('sim.play')} title={w.playing ? t('sim.pause') : t('sim.play')}>
          {w.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <input type="range" min={0} max={1} step={0.005} value={phase} onChange={(e) => { setPhase(Number(e.target.value)); if (w.playing) w.set({ playing: false }) }}
          className="flex-1 accent-[var(--accent)]" aria-label="Timeline" />
        <span className="num w-10 text-end text-[10px] text-muted-foreground">{Math.round(phase * 100)}%</span>
        <span className="text-[10px] text-muted-foreground">{t('sim.size')} {w.viewSize}</span>
      </div>
    </div>
  )
}

const cameraState: { current: { pos: THREE.Vector3; target: THREE.Vector3 } | null } = { current: null }

function bodyFor(size: keyof typeof BODY): Body {
  const b = BODY[size]
  const h = b.height / 100
  return { heightCm: b.height, weightKg: Math.round(21.5 * h * h + (b.bust - 90) * 0.45), bustCm: b.bust, waistCm: b.waist, hipsCm: b.hip, shape: 'hourglass' }
}

function MiniSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="flex items-center gap-1 rounded border border-border bg-background/80 ps-1.5 text-foreground">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-6 bg-transparent pe-1 text-[11px] outline-none" aria-label={label}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Lighting                                                           */
/* ------------------------------------------------------------------ */
function Lights({ preset }: { preset: Lighting }) {
  switch (preset) {
    case 'daylight': return (<>
      <hemisphereLight args={['#dfeaff', '#b8a98f', 1.15]} />
      <KeyLight position={[1.5, 6, 3]} intensity={2.1} color="#fffaf0" />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#cfe0ff" />
    </>)
    case 'runway': return (<>
      <ambientLight intensity={0.12} />
      <spotLight position={[0, 5.5, 2.5]} angle={0.42} penumbra={0.7} intensity={60} color="#fff3e2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <directionalLight position={[-2.5, 2, -3]} intensity={1.4} color="#9fb4ff" />
      <directionalLight position={[2.5, 2, -3]} intensity={1.1} color="#ffd8b0" />
    </>)
    case 'atelier': return (<>
      <hemisphereLight args={['#ffe9c9', '#5c4a36', 0.6]} />
      <KeyLight position={[-4, 3, 1.5]} intensity={2.2} color="#ffd9a3" />
      <directionalLight position={[2, 1.5, 2]} intensity={0.35} color="#fff4e6" />
    </>)
    default: return (<>
      <hemisphereLight args={['#fff8ee', '#8a7f72', 0.95]} />
      <KeyLight position={[2.5, 4, 3]} intensity={1.7} />
      <directionalLight position={[-3, 2.5, -2]} intensity={0.6} color="#cfd8ff" />
      <directionalLight position={[0, 1.5, -4]} intensity={0.5} />
    </>)
  }
}

function KeyLight(props: { position: [number, number, number]; intensity: number; color?: string }) {
  return (
    <directionalLight {...props} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.025}
      shadow-camera-left={-1.3} shadow-camera-right={1.3} shadow-camera-top={2.2} shadow-camera-bottom={-0.2} shadow-camera-near={0.5} shadow-camera-far={14} />
  )
}

/** Image-based lighting from a procedural studio room (no network), tuned per preset. */
function StudioEnvironment({ preset }: { preset: Lighting }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture
    scene.environment = env
    scene.environmentIntensity = ({ studio: 0.32, daylight: 0.45, runway: 0.14, atelier: 0.26 } as const)[preset]
    return () => { scene.environment = null; env.dispose(); pmrem.dispose() }
  }, [gl, scene, preset])
  return null
}

/* ------------------------------------------------------------------ */
/* Camera controls, bookmarks, turntable and capture API              */
/* ------------------------------------------------------------------ */
function Controls({ H, autoRotate, goal, onArrive, views, bg }: {
  H: number; autoRotate: boolean; goal: { pos: THREE.Vector3; target: THREE.Vector3 } | null; onArrive: () => void
  views: Record<string, { pos: THREE.Vector3; target: THREE.Vector3 }>; bg: string
}) {
  const ref = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera, gl, scene, size } = useThree()
  useFrame(() => {
    const c = ref.current
    if (!c) return
    cameraState.current = { pos: camera.position.clone(), target: c.target.clone() }
    if (goal) {
      camera.position.lerp(goal.pos, 0.14)
      c.target.lerp(goal.target, 0.14)
      c.update()
      if (camera.position.distanceTo(goal.pos) < 0.01) onArrive()
    }
  })
  // expose rendering/recording to menus and exporters
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const solidBg = bg.match(/#[0-9a-f]{6}/gi)?.[0] ?? '#f7f4ee'
    const renderAt = (wpx: number, hpx: number) => {
      const prevPR = gl.getPixelRatio()
      const prevAspect = cam.aspect
      gl.setPixelRatio(1)
      gl.setSize(wpx, hpx, false)
      cam.aspect = wpx / hpx
      cam.updateProjectionMatrix()
      gl.render(scene, cam)
      const c = document.createElement('canvas')
      c.width = wpx; c.height = hpx
      const ctx = c.getContext('2d')!
      ctx.fillStyle = solidBg
      ctx.fillRect(0, 0, wpx, hpx)
      ctx.drawImage(gl.domElement, 0, 0, wpx, hpx)
      gl.setPixelRatio(prevPR)
      gl.setSize(size.width, size.height, false)
      cam.aspect = prevAspect
      cam.updateProjectionMatrix()
      return c.toDataURL('image/png')
    }
    registerViewport({
      renderPng: async (wpx, hpx) => renderAt(wpx, hpx),
      recordTurntable: async (seconds) => {
        const c = ref.current
        if (!c || typeof MediaRecorder === 'undefined') return null
        const stream = gl.domElement.captureStream(30)
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
        const chunks: Blob[] = []
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
        const prevAuto = c.autoRotate, prevSpeed = c.autoRotateSpeed
        c.autoRotate = true
        c.autoRotateSpeed = 60 / seconds
        rec.start(250)
        await new Promise((r) => setTimeout(r, seconds * 1000))
        rec.stop()
        await new Promise((r) => { rec.onstop = r })
        c.autoRotate = prevAuto
        c.autoRotateSpeed = prevSpeed
        return new Blob(chunks, { type: 'video/webm' })
      },
      captureViews: async () => {
        const c = ref.current
        if (!c) return []
        const out: string[] = []
        const saved = { pos: camera.position.clone(), target: c.target.clone() }
        for (const k of ['front', 'three', 'side', 'back']) {
          camera.position.copy(views[k].pos); c.target.copy(views[k].target); c.update()
          await new Promise((r) => requestAnimationFrame(() => r(null)))
          out.push(renderAt(1200, 1600))
        }
        camera.position.copy(saved.pos); c.target.copy(saved.target); c.update()
        return out
      },
    })
  }, [camera, gl, scene, size, views, bg])
  return (
    <OrbitControls ref={ref} makeDefault target={[0, H * 0.52, 0]} enablePan enableDamping minDistance={0.6} maxDistance={7}
      autoRotate={autoRotate} autoRotateSpeed={1.2} maxPolarAngle={Math.PI * 0.62} />
  )
}

/* ------------------------------------------------------------------ */
/* Scene: posed mannequin + garment + simulation                      */
/* ------------------------------------------------------------------ */
function Scene({ style, body, pose, playing, phase, live, fitMap, skin, hair, simCmd, viewSize }: {
  style: Style; body: Body; pose: Pose; playing: boolean; phase: number; live: boolean; fitMap: FitMap; skin: string
  hair: 'none' | 'bun' | 'bob' | 'long'; simCmd: { run: number; reset: number }; viewSize: string
}) {
  const { t } = useTranslation('ws')
  const m = useMemo(() => buildBodyModel(body), [body.heightCm, body.bustCm, body.waistCm, body.hipsCm, body.weightKg]) // eslint-disable-line react-hooks/exhaustive-deps
  const graded = useMemo(() => gradeStyle(style, viewSize as Style['baseSize']), [style, viewSize])
  const spec = useMemo(() => deriveSpec(graded), [graded])
  const pieceOf = (id?: string) => graded.pieces.find((p) => p.id === id)
  const upper = pieceOf(spec.materials.upper)
  const mainFabric = fabricById(upper?.material.fabricId ?? 'fab-cotton-poplin') ?? fabricById('fab-cotton-poplin')!
  const phys = useMemo(() => fabricPhysics(mainFabric), [mainFabric])
  const stiffness = Math.min(1, Math.log10(1 + phys.bending) / 1.5)
  const g3 = useMemo(() => buildGarment3D(m, spec, stiffness), [m, spec, stiffness])
  const anglesRef = useRef<Angles>(poseAngles(pose, 0, m))
  const timeRef = useRef(phase)
  const tr = useTransient()

  /* ---------- materials ---------- */
  const mats = useMemo(() => {
    const mk = (pid?: string, baseTile?: number) => {
      const p = pieceOf(pid) ?? upper
      if (!p) return new THREE.MeshStandardMaterial({ color: '#ccc' })
      const mat = effectiveMaterial(graded, p)
      const fab = fabricById(mat.fabricId) ?? mainFabric
      const tile = materialTile(mat, graded.artworks)
      const tex = new THREE.CanvasTexture(tile.canvas)
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      const k = baseTile ? baseTile / tileCm(mat, graded.artworks) : 1
      tex.repeat.set(k, k / tile.aspect)
      tex.rotation = (mat.rotation * Math.PI) / 180
      tex.anisotropy = 8
      const nmap = normalMapFor(tile.canvas, fab.construction === 'satin' || fab.construction === 'chiffon' ? 1.0 : fab.construction === 'crepe' ? 1.4 : 2.2).clone()
      nmap.repeat.copy(tex.repeat); nmap.rotation = tex.rotation; nmap.needsUpdate = true
      const translucent = fab.opacity < 0.9
      return shadeBackFaces(new THREE.MeshPhysicalMaterial({
        map: fitMap === 'off' ? tex : null, vertexColors: fitMap !== 'off', color: '#fff',
        normalMap: nmap, normalScale: new THREE.Vector2(0.32, 0.32),
        roughness: Math.min(0.95, 0.98 - fab.sheen * 0.6), sheen: fab.construction === 'velvet' ? 1 : 0.12 + fab.sheen * 0.55, sheenRoughness: 0.5,
        sheenColor: new THREE.Color(mat.color ?? fab.color).multiplyScalar(1.35),
        side: THREE.DoubleSide, transparent: translucent, opacity: translucent ? Math.max(0.55, fab.opacity + 0.15) : 1, depthWrite: !translucent,
      }))
    }
    const baseTile = upper ? tileCm(effectiveMaterial(graded, upper), graded.artworks) : 12
    return {
      upper: mk(spec.materials.upper), lower: mk(spec.materials.lower ?? spec.materials.upper, baseTile),
      sleeve: mk(spec.materials.sleeve ?? spec.materials.upper), collar: mk(spec.materials.collar ?? spec.materials.upper),
      tile: baseTile / 100,
    }
  }, [graded, spec, fitMap, tr.texVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { for (const k of ['upper', 'lower', 'sleeve', 'collar'] as const) { mats[k].map?.dispose(); mats[k].dispose() } }, [mats])

  /* ---------- torso garment geometry ---------- */
  const torsoTube = useMemo<Tube | null>(() => {
    if (!g3.init.length) return null
    const rings: TubeRing[] = g3.init.map((r, i) => ({ y: r.y, rx: r.rx, rz: r.rz, fold: g3.fold[i] }))
    const tube = buildTube(rings, SEGS, mats.tile)
    const perRing = SEGS * 6
    const split = g3.splitRing
    if (split !== null && split > 0) {
      tube.geometry.addGroup(0, split * perRing, 0)
      tube.geometry.addGroup(split * perRing, (rings.length - 1 - split) * perRing, 1)
    } else tube.geometry.addGroup(0, (rings.length - 1) * perRing, 0)
    return tube
  }, [g3, mats.tile])
  useEffect(() => () => torsoTube?.geometry.dispose(), [torsoTube])
  const excessV = useMemo(() => {
    if (!torsoTube) return new Float32Array(0)
    const arr = new Float32Array(torsoTube.base.rx.length)
    for (let i = 0; i < g3.init.length; i++) for (let j = 0; j <= SEGS; j++) arr[i * (SEGS + 1) + j] = g3.excess[i]
    return arr
  }, [torsoTube, g3])

  /* ---------- static fit-map colours (before simulation) ---------- */
  useEffect(() => {
    if (!torsoTube) return
    const col = torsoTube.geometry.attributes.color as THREE.BufferAttribute
    for (let i = 0; i < g3.init.length; i++) {
      const pi = Math.PI * (3 * (g3.init[i].rx + g3.init[i].rz) - Math.sqrt((3 * g3.init[i].rx + g3.init[i].rz) * (g3.init[i].rx + 3 * g3.init[i].rz)))
      const pr = Math.PI * (3 * (g3.rest[i].rx + g3.rest[i].rz) - Math.sqrt((3 * g3.rest[i].rx + g3.rest[i].rz) * (g3.rest[i].rx + 3 * g3.rest[i].rz)))
      const c = fitMap === 'ease' ? easeColor(g3.ease[i]) : fitMap === 'strain' ? strainColor(Math.max(0, pi / pr - 1)) : pressureColor(Math.max(0, (pi - pr) / (2 * Math.PI)))
      for (let j = 0; j <= SEGS; j++) col.setXYZ(i * (SEGS + 1) + j, c.r, c.g, c.b)
    }
    col.needsUpdate = true
  }, [torsoTube, g3, fitMap])

  /* ---------- simulation ---------- */
  const client = useRef<ClothClient | null>(null)
  const simFrames = useRef(0)
  const [simOn, setSimOn] = useState(false)
  const lastRun = useRef(simCmd.run), lastReset = useRef(simCmd.reset)
  const torsoColl = useMemo(() => {
    // collision envelope of the anatomical torso, sorted top → bottom
    const y0 = m.torso[0].y, y1 = m.torso[m.torso.length - 1].y
    const out: number[] = []
    for (let i = 0; i <= 70; i++) { const e = envelopeRingAt(m, y1 - ((y1 - y0) * i) / 70); out.push(e.y, e.rx, e.rz) }
    return Float32Array.from(out)
  }, [m])
  const manual = useRef(false)
  const startSim = (isManual = false) => {
    manual.current = isManual
    if (!torsoTube) return
    client.current?.stop()
    const c = new ClothClient()
    c.onState = (s) => applySim(s)
    c.start(g3, solverParams(phys), torsoColl)
    client.current = c
    simFrames.current = 0
    setSimOn(true)
    tr.set({ simStatus: 'running', simProgress: 0 })
  }
  const stopSim = () => {
    client.current?.stop(); client.current = null
    setSimOn(false)
    tr.set({ simStatus: 'idle', simProgress: 0 })
  }
  useEffect(() => {
    if (simCmd.run !== lastRun.current) { lastRun.current = simCmd.run; startSim(true) }
    if (simCmd.reset !== lastReset.current) { lastReset.current = simCmd.reset; stopSim() }
  })
  // Auto-drape: every new or edited garment is settled by the solver, so cloth always hangs under gravity.
  useEffect(() => {
    stopSim()
    const id = setTimeout(() => startSim(false), 250)
    return () => clearTimeout(id)
  }, [g3]) // eslint-disable-line react-hooks/exhaustive-deps
  // Poses that change the silhouette re-drape the cloth against the new limb positions.
  const firstPose = useRef(true)
  useEffect(() => {
    if (firstPose.current) { firstPose.current = false; return }
    if (pose === 'sitting' || pose === 'turning') startSim()
  }, [pose]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => client.current?.stop(), [])
  useEffect(() => { if (live && !simOn && torsoTube) startSim() }, [live]) // eslint-disable-line react-hooks/exhaustive-deps

  const applySim = (s: SimState) => {
    if (!torsoTube) return
    const pos = torsoTube.geometry.attributes.position as THREE.BufferAttribute
    const col = torsoTube.geometry.attributes.color as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const R = g3.init.length
    const mode = useWorkspace.getState().fitMap
    for (let i = 0; i < R; i++) for (let j = 0; j <= SEGS; j++) {
      const src = (i * SEGS + (j % SEGS)), dst = i * (SEGS + 1) + j
      arr[dst * 3] = s.pos[src * 3]; arr[dst * 3 + 1] = s.pos[src * 3 + 1]; arr[dst * 3 + 2] = s.pos[src * 3 + 2]
      if (mode === 'strain' || mode === 'pressure') {
        const c = mode === 'strain' ? strainColor(s.strain[src]) : pressureColor(s.pressure[src])
        col.setXYZ(dst, c.r, c.g, c.b)
      }
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    torsoTube.geometry.computeVertexNormals()
    simFrames.current += 12
    const st = useTransient.getState()
    if (st.simStatus === 'running') {
      const p = Math.min(1, simFrames.current / SIM_FRAMES)
      st.set({ simProgress: p })
      if (p >= 1) { st.set({ simStatus: 'settled' }); if (manual.current) toast(t('toast.simDone')) }
    }
  }

  /* ---------- per-frame: pose, parametric drape, sim stepping ---------- */
  const rootRef = useRef<THREE.Group>(null)
  const joints = useRef<Record<string, THREE.Group | null>>({})
  useFrame((_, dt) => {
    if (playing) timeRef.current = (timeRef.current + dt * 0.55) % 1
    else timeRef.current = phase
    // While a drape is settling, blend in from standing so limbs sweep the cloth
    // (starting inside it would push vertices out the wrong side).
    const target = poseAngles(pose, timeRef.current, m)
    const settlingNow = !!client.current && useTransient.getState().simStatus === 'running'
    const blend = settlingNow ? Math.min(1, simFrames.current / (SIM_FRAMES * 0.45)) : 1
    const a = blend >= 1 ? target : mixAngles(poseAngles('standing', 0, m), target, blend * blend * (3 - 2 * blend))
    anglesRef.current = a
    const J = joints.current
    if (rootRef.current) { rootRef.current.position.set(0, a.rootY, a.rootZ); rootRef.current.rotation.y = a.yaw }
    J.thighL?.rotation.set(a.hipL, 0, 0); J.thighR?.rotation.set(a.hipR, 0, 0)
    J.kneeL?.rotation.set(a.kneeL, 0, 0); J.kneeR?.rotation.set(a.kneeR, 0, 0)
    J.armL?.rotation.set(a.armL, 0, -m.armAngle); J.armR?.rotation.set(a.armR, 0, m.armAngle)

    const c = client.current
    if (c) {
      const settling = useTransient.getState().simStatus === 'running'
      if (settling || live || (pose === 'walking' && playing)) c.step(settling ? 12 : 2, capsules(m, a))
    } else if (torsoTube) {
      animateParametric(torsoTube, excessV, timeRef.current, pose, stiffness, playing)
    }
  })

  const legTubes = useMemo(() => splitLeg(m, g3), [m, g3])
  useEffect(() => () => { legTubes.thighG?.geometry.dispose(); legTubes.shinG?.geometry.dispose() }, [legTubes])
  const bodyGeo = useMemo(() => ({ torso: buildTorso(m), head: buildHead(m), arm: buildArm(m), leg: buildLeg(m) }), [m])
  useEffect(() => () => {
    bodyGeo.torso.dispose(); bodyGeo.head.dispose()
    Object.values(bodyGeo.arm).forEach((x) => x.dispose())
    bodyGeo.leg.thigh.dispose(); bodyGeo.leg.shin.dispose(); bodyGeo.leg.foot.dispose()
  }, [bodyGeo])
  const hairGeo = useMemo(() => buildHair(m, hair), [m, hair])
  useEffect(() => () => hairGeo.forEach((x) => x.dispose()), [hairGeo])
  const sleeveTube = useMemo(() => g3.sleeve ? buildTube(g3.sleeve.rings.map((r) => ({ y: -r.d, rx: r.r + 0.008, rz: (r.r + 0.008) * 0.92, fold: g3.sleeve!.bell ? 0.4 : 0 })), 32, mats.tile) : null, [g3, mats.tile, m])
  const collarTube = useMemo(() => g3.collar ? buildTube([{ y: g3.collar.y1, rx: g3.collar.r * 1.05, rz: g3.collar.r * 1.05 }, { y: g3.collar.y0, rx: g3.collar.r, rz: g3.collar.r }], 40, mats.tile) : null, [g3, mats.tile])
  // satin-resin mannequin finish
  const skinMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: skin, roughness: 0.52, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color('#fff4ea'),
    clearcoat: 0.12, clearcoatRoughness: 0.55, side: THREE.DoubleSide,
  }), [skin])
  const hairMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: HAIR_COLOR, roughness: 0.5, sheen: 0.8, sheenRoughness: 0.35, sheenColor: new THREE.Color('#8a6a52'), side: THREE.DoubleSide }), [])
  useEffect(() => () => { sleeveTube?.geometry.dispose(); collarTube?.geometry.dispose() }, [sleeveTube, collarTube])
  // every mesh casts and receives soft shadows (cloth self-shadowing reads as depth)
  useEffect(() => { rootRef.current?.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } }) })

  const hipY = m.y.crotch + 0.02 * m.H
  const thighLen = hipY - m.y.knee
  const torsoMats = useMemo(() => [mats.upper, mats.lower], [mats])

  return (
    <group ref={rootRef}>
      {/* body */}
      <mesh geometry={bodyGeo.torso} material={skinMat} />
      <mesh geometry={bodyGeo.head} material={skinMat} />
      {hairGeo.map((h, i) => <mesh key={i} geometry={h} material={hairMat} />)}
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <group ref={(g) => { joints.current[s < 0 ? 'thighL' : 'thighR'] = g }} position={[s * m.legOffset, hipY, 0]}>
            <mesh geometry={bodyGeo.leg.thigh} material={skinMat} />
            {legTubes.thighG && <mesh geometry={legTubes.thighG.geometry} material={mats.lower} />}
            <group ref={(g) => { joints.current[s < 0 ? 'kneeL' : 'kneeR'] = g }} position={[0, -thighLen, 0]}>
              <mesh geometry={bodyGeo.leg.shin} material={skinMat} />
              {legTubes.shinG && <mesh geometry={legTubes.shinG.geometry} material={mats.lower} />}
              <mesh geometry={bodyGeo.leg.foot} material={skinMat} />
            </group>
          </group>
          <group ref={(g) => { joints.current[s < 0 ? 'armL' : 'armR'] = g }} position={[s * m.shoulderJoint.x, m.shoulderJoint.y, 0]}>
            <mesh geometry={bodyGeo.arm.arm} material={skinMat} />
            <group scale={[s, 1, 1]}>
              <mesh geometry={bodyGeo.arm.palm} material={skinMat} />
              <mesh geometry={bodyGeo.arm.thumb} material={skinMat} />
            </group>
            {sleeveTube && <mesh geometry={sleeveTube.geometry} material={mats.sleeve} />}
          </group>
        </group>
      ))}
      {/* garment */}
      {torsoTube && <mesh geometry={torsoTube.geometry} material={torsoMats} renderOrder={2} />}
      {collarTube && <mesh geometry={collarTube.geometry} material={mats.collar} />}
      {g3.hood && (
        <mesh material={mats.collar} position={[0, m.y.head - 0.02, -0.03]} scale={[m.headR * 1.25, m.headR * 1.35, m.headR * 1.2]}>
          <sphereGeometry args={[1, 32, 20, Math.PI * 0.15, Math.PI * 1.7, 0, Math.PI * 0.62]} />
        </mesh>
      )}
      {g3.scarf && <Scarf m={m} mat={mats.upper} />}
      {pose === 'sitting' && (
        <mesh position={[0, (hipY + anglesRef.current.rootY - 0.06) / 2, 0.02]}>
          <boxGeometry args={[0.44, Math.max(0.1, hipY + anglesRef.current.rootY - 0.06), 0.42]} />
          <meshStandardMaterial color="#8c7a63" roughness={0.8} />
        </mesh>
      )}
    </group>
  )
}

/** Parametric drape between simulations: folds sized by the cut's excess fullness, swing while walking. */
function animateParametric(tube: Tube, excess: Float32Array, t: number, pose: Pose, stiffness: number, playing: boolean) {
  const pos = tube.geometry.attributes.position as THREE.BufferAttribute
  const arr = pos.array as Float32Array
  const { rx, rz, theta, fold, y } = tube.base
  const folds = Math.round(16 - stiffness * 9)
  const ph = t * Math.PI * 2 * 0.9
  const swing = pose === 'walking' ? Math.sin(ph) * 0.035 * (1 - stiffness * 0.6) : 0
  const time = playing ? t * 6 : 0
  for (let k = 0; k < rx.length; k++) {
    const w = fold[k]
    const amp = w > 0 ? Math.min(0.06, excess[k] * 0.55 + 0.004) * w : 0
    const r = 1 + (amp * Math.sin(folds * theta[k] + time * (1 - stiffness) + y[k] * 3)) / Math.max(0.05, (rx[k] + rz[k]) / 2)
    arr[k * 3] = Math.cos(theta[k]) * rx[k] * r
    arr[k * 3 + 1] = y[k]
    arr[k * 3 + 2] = Math.sin(theta[k]) * rz[k] * r + swing * w
  }
  pos.needsUpdate = true
  tube.geometry.computeVertexNormals()
}

function splitLeg(m: BodyModel, g3: Garment3D) {
  const hipY = m.y.crotch + 0.02 * m.H
  const kneeY = m.y.knee
  const thighRings = m.leg.filter((p) => p.y >= kneeY - 0.01).map((p) => ({ y: p.y - hipY, rx: p.r, rz: p.r * 0.96 }))
  const shinRings = m.leg.filter((p) => p.y <= kneeY + 0.01).map((p) => ({ y: p.y - kneeY, rx: p.r, rz: p.r * 0.96 }))
  void thighRings; void shinRings
  const out: { thighG: Tube | null; shinG: Tube | null } = { thighG: null, shinG: null }
  if (g3.legs) {
    const legBodyR = (y: number) => {
      let best = m.leg[0]
      for (const p of m.leg) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p
      return best.r
    }
    const ring = (r: { y: number; r: number }, base: number) => {
      const rr = Math.max(r.r, legBodyR(r.y) * 1.03 + 0.004)
      return { y: r.y - base, rx: rr, rz: rr * 0.95 }
    }
    const top = g3.legs.rings.filter((r) => r.y >= kneeY - 0.02)
    const bot = g3.legs.rings.filter((r) => r.y <= kneeY + 0.02)
    if (top.length > 1) out.thighG = buildTube(top.map((r) => ring(r, hipY)), 36)
    if (bot.length > 1) out.shinG = buildTube(bot.map((r) => ring(r, kneeY)), 36)
  }
  return out
}

function Scarf({ m, mat }: { m: BodyModel; mat: THREE.Material }) {
  const r = m.headR
  const cape = useMemo(() => buildTube([
    { y: m.y.chin + 0.01, rx: m.neckR * 1.5, rz: m.neckR * 1.5 },
    { y: m.y.neck - 0.02, rx: m.neckR * 2.6, rz: m.neckR * 2.4 },
    { y: m.y.shoulder - 0.03, rx: m.shoulderJoint.x * 1.25, rz: m.torso[9].rz * 1.35 },
    { y: m.y.bust + 0.02, rx: m.shoulderJoint.x * 1.32, rz: m.torso[7].rz * 1.4 },
  ], 48), [m])
  useEffect(() => () => cape.geometry.dispose(), [cape])
  return (
    <group>
      <mesh material={mat} position={[0, m.y.head, 0]} scale={[r * 1.02, r * 1.2, r * 1.08]}>
        <sphereGeometry args={[1, 32, 22, Math.PI * 0.72, Math.PI * 1.56, 0, Math.PI * 0.82]} />
      </mesh>
      <mesh geometry={cape.geometry} material={mat} />
    </group>
  )
}
