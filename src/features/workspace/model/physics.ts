import type { Fabric } from '@/types'
import { clamp } from '@/lib/utils'

/**
 * Physical cloth properties derived from the library's textile specs.
 * Units follow common fabric-testing conventions; values are estimates from
 * construction, weight, drape and stretch — not lab measurements (KES-F / FAST).
 */
export interface FabricPhysics {
  /** Bending rigidity, µN·m (≈ 0.5 chiffon … 30+ coating) */
  bending: number
  /** g/m² */
  weight: number
  /** Elongation at 5 N/cm, % */
  stretchWarp: number
  stretchWeft: number
  /** Shear rigidity, N/m·deg (low = drapes on the bias easily) */
  shear: number
  /** Kinetic friction coefficient against skin */
  friction: number
  /** mm */
  thickness: number
}

const KNIT = new Set(['jersey', 'rib'])

export function fabricPhysics(f: Fabric): FabricPhysics {
  const knit = KNIT.has(f.construction)
  const weightK = f.gsm / 200
  // drape 5 → very low rigidity; heavier cloth is stiffer for the same drape class
  const bending = +(Math.pow(6 - f.drape, 2.1) * (0.35 + weightK * 0.65)).toFixed(2)
  const stretchWeft = +(f.stretchPct + (knit ? 8 : f.construction === 'crepe' ? 3 : 1.2)).toFixed(1)
  const stretchWarp = +(knit ? stretchWeft * 0.6 : f.stretchPct * 0.25 + (f.construction === 'satin' ? 0.8 : 1)).toFixed(1)
  const shearBase: Record<string, number> = { plain: 1.6, twill: 1.1, satin: 0.6, crepe: 0.7, jersey: 0.4, rib: 0.35, tweed: 1.8, chiffon: 0.3, velvet: 1.2, jacquard: 1.9 }
  const shear = +((shearBase[f.construction] ?? 1) * (0.5 + weightK * 0.5)).toFixed(2)
  const fricBase: Record<string, number> = { plain: 0.35, twill: 0.4, satin: 0.18, crepe: 0.42, jersey: 0.38, rib: 0.45, tweed: 0.6, chiffon: 0.3, velvet: 0.55, jacquard: 0.32 }
  const friction = fricBase[f.construction] ?? 0.4
  const thickBase: Record<string, number> = { velvet: 1.4, tweed: 1.6, rib: 1.1, jersey: 0.7 }
  const thickness = +clamp((thickBase[f.construction] ?? 0.2) + f.gsm / 520, 0.08, 3.5).toFixed(2)
  return { bending, weight: f.gsm, stretchWarp, stretchWeft, shear, friction, thickness }
}

/** Solver coefficients (0–1) for the position-based cloth solver. */
export function solverParams(p: FabricPhysics) {
  return {
    // structural compliance: stretchier → softer distance constraints
    stretch: clamp(1 - Math.max(p.stretchWarp, p.stretchWeft) / 120, 0.35, 1),
    bend: clamp(Math.log10(1 + p.bending) / 1.6, 0.02, 0.95),
    shear: clamp(p.shear / 2.5, 0.05, 0.9),
    // light fabrics float more (air drag); heavy ones fall fast
    damping: clamp(0.06 - p.weight / 12000, 0.012, 0.06),
    friction: p.friction,
    thickness: p.thickness / 1000 + 0.004,
  }
}
