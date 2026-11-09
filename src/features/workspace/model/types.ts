import type { LText, PrintPattern } from '@/types'

/**
 * Pattern model. All geometry is in centimetres, piece-local, y pointing down
 * (the cutting-table convention). Piece outlines are the SEW line; seam allowance
 * is offset outward at render/export time.
 */
export interface Vec { x: number; y: number }

export interface PPoint {
  id: string
  x: number
  y: number
  /** Absolute (piece-local) Bézier handles. Null = sharp corner on that side. */
  hin: Vec | null
  hout: Vec | null
}

export type EdgeTag =
  | 'neck' | 'shoulder' | 'armhole' | 'side' | 'hem' | 'cf' | 'cb' | 'waist' | 'cap'
  | 'underarm' | 'inseam' | 'crotch' | 'opening' | 'fold' | 'band' | 'other'

export type PieceRole =
  | 'front' | 'back' | 'sleeve' | 'collar' | 'cuff' | 'skirtFront' | 'skirtBack'
  | 'trouserFront' | 'trouserBack' | 'waistband' | 'hood' | 'pocket' | 'facing' | 'yoke' | 'scarf' | 'other'

export type InternalKind = 'dart' | 'pleat' | 'tuck' | 'gather' | 'buttonhole' | 'button' | 'line' | 'placement'

export interface Internal {
  id: string
  kind: InternalKind
  /** dart: [leg1, apex, leg2]; pleat/tuck: [a, b] fold line; gather: [a, b] along edge; buttonhole/line: [a, b]; button: [c] */
  pts: Vec[]
  /** pleat/tuck depth (cm) or button diameter (mm) */
  size?: number
}

export interface Notch { id: string; edge: string; t: number }

export type RepeatType = 'full' | 'halfDrop' | 'mirror' | 'placement'

export interface Material {
  fabricId: string
  color: string | null
  print: PrintPattern
  printColor: string | null
  /** uploaded artwork id (style.artworks) — overrides `print` */
  artworkId: string | null
  repeat: RepeatType
  scale: number
  rotation: number
}

export type FabricLayer = 'shell' | 'lining' | 'interfacing' | 'contrast'

export interface PatternPiece {
  id: string
  name: LText
  role: PieceRole
  points: PPoint[]
  /** Table placement */
  x: number
  y: number
  rotation: number
  flipped: boolean
  /** Edge (by start-point id) cut on the fold; mirrored on unfold and counted double in girths */
  foldEdge: string | null
  /** Pieces cut (ignored if on fold) */
  cut: number
  seamAllowance: number
  /** Per-edge seam allowance override, keyed by edge start-point id */
  edgeSA: Record<string, number>
  edgeTags: Record<string, EdgeTag>
  /** Topstitched edges (start-point ids) */
  topstitch: string[]
  grain: [Vec, Vec]
  notches: Notch[]
  internals: Internal[]
  /** Horizontal measuring lines (local y) used to derive 3D girths */
  marks: Partial<Record<'bust' | 'waist' | 'hip' | 'thigh', number>>
  layer: FabricLayer
  material: Material
  /** girth share used by proportional grading (1 = the full grade on this piece's width) */
  gradeX: number
  gradeY: number
  visible: boolean
  locked: boolean
  group: string | null
}

export type StitchType = '301' | '401' | '504' | '514' | '406' | 'topstitch1' | 'topstitch2' | 'blind'

export interface Seam {
  id: string
  a: { piece: string; edge: string }
  b: { piece: string; edge: string }
  stitch: StitchType
}

export type GarmentKind = 'top' | 'dress' | 'skirt' | 'trousers' | 'jumpsuit' | 'scarf'

export interface TrimUse {
  id: string
  trimId: string
  qty: number
  color: string | null
  /** optional placement on a piece (piece-local cm) */
  piece: string | null
  at: Vec | null
}

export interface Colorway {
  id: string
  name: string
  /** pieceId → material overrides */
  overrides: Record<string, Partial<Pick<Material, 'color' | 'fabricId' | 'printColor'>>>
}

export interface Artwork { id: string; name: string; dataUrl: string; widthCm: number }

export type SizeSystem = 'EU' | 'US' | 'UK' | 'GCC'
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] as const
export type SizeKey = (typeof SIZES)[number]

export type StyleStatus = 'concept' | 'sampling' | 'approved'

export interface Style {
  id: string
  name: string
  templateId: string
  kind: GarmentKind
  category: string
  sizeSystem: SizeSystem
  baseSize: SizeKey
  pieces: PatternPiece[]
  seams: Seam[]
  trims: TrimUse[]
  colorways: Colorway[]
  activeColorway: string | null
  artworks: Artwork[]
  notes: string
  status: StyleStatus
  collectionId: string | null
  targetPrice: number | null
  /** user-drawn flat-sketch lines and callouts */
  annotations: Annotation[]
  /** design intent from the template that geometry alone can't express */
  meta: { sleeve: string; collar: string; closure: string; neckline: string }
  createdAt: number
  updatedAt: number
}

export interface StyleVersion { id: string; label: string; at: number; style: Style }

export interface Annotation {
  id: string
  view: 'front' | 'back'
  kind: 'line' | 'callout'
  /** flat-sketch coordinates (cm, HPS = 0, centre = 0) */
  pts: Vec[]
  text: string
}
