/** Localised string. `en` is required; other locales fall back to it. */
export type LText = { en: string; ar?: string } & Partial<Record<string, string>>

export type Fiber =
  | 'cotton' | 'linen' | 'silk' | 'wool' | 'polyester' | 'viscose' | 'elastane'
  | 'nylon' | 'cashmere' | 'lyocell' | 'acetate' | 'hemp' | 'modal'

export type Construction =
  | 'plain' | 'twill' | 'satin' | 'crepe' | 'jersey' | 'rib' | 'tweed' | 'chiffon' | 'velvet' | 'jacquard'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** 1 (very low) – 5 (very high) */
export type Scale5 = 1 | 2 | 3 | 4 | 5

export type CareCode =
  | 'wash30' | 'wash40' | 'wash60' | 'handwash' | 'dryclean' | 'noBleach'
  | 'ironLow' | 'ironMedium' | 'ironHigh' | 'noTumble' | 'tumbleLow' | 'lineDry' | 'flatDry'

export interface Fabric {
  id: string
  slug: string
  name: LText
  /** Fiber composition in percent; values sum to 100. */
  composition: Partial<Record<Fiber, number>>
  construction: Construction
  /** Grams per square metre */
  gsm: number
  /** Usable width in cm */
  widthCm: number
  /** Mechanical stretch, % (weft direction) */
  stretchPct: number
  /** 1 = stiff / structured, 5 = fluid / liquid drape */
  drape: Scale5
  breathability: Scale5
  /** Residual shrinkage after first wash, % */
  shrinkagePct: number
  care: CareCode[]
  /** 0–100, composite of fiber impact, certifications and processing */
  sustainability: number
  certifications: string[]
  origin: string // ISO country code
  supplierId: string
  pricePerMeter: number // USD
  seasons: Season[]
  /** Base hex colour of the greige/standard colourway */
  color: string
  /** Visual sheen 0–1 (used for swatch + 3D material) */
  sheen: number
  /** Light transmission 0–1 */
  opacity: number
  description: LText
}

export type GarmentType = 'dress' | 'shirt' | 'abaya' | 'trousers' | 'jacket' | 'skirt'

export interface GarmentPiece {
  id: string
  name: LText
  /** SVG path in a 400×600 viewBox */
  path: string
  /** Share of the garment's total fabric area (0–1), used for consumption */
  areaShare: number
}

export interface GarmentTemplate {
  id: GarmentType
  name: LText
  pieces: GarmentPiece[]
  /** Optional stitch/detail lines drawn on top (SVG path) */
  details?: string
  /** Base consumption in metres at 150 cm width for size M */
  baseConsumptionM: number
  /** Ease added to body measurement at size M (cm) */
  ease: { bust: number; waist: number; hips: number }
  /** Garment covers which zones */
  covers: Array<'bust' | 'waist' | 'hips'>
  measurements: Array<{ key: string; label: LText; m: number }>
  defaultFabricId: string
  /** Hem silhouette flare, 0 (straight) – 1 (full circle) */
  flare: number
  /** Length as share of body height from shoulder (for 3D) */
  length: number
  sleeves: 'none' | 'short' | 'long'
}

export type SupplierType = 'mill' | 'converter' | 'manufacturer' | 'trader'

export interface Supplier {
  id: string
  name: string
  country: string
  city: string
  type: SupplierType
  specialties: LText[]
  moqMeters: number
  leadTimeDays: number
  certifications: string[]
  founded: number
  rating: number
  description: LText
}

export interface Course {
  id: string
  slug: string
  title: LText
  summary: LText
  level: 'beginner' | 'intermediate' | 'advanced'
  topic: 'fibers' | 'yarns' | 'weaving' | 'knitting' | 'dyeing' | 'finishing' | 'testing' | 'sustainability'
  lessons: Array<{ title: LText; minutes: number }>
}

export type PrintPattern = 'none' | 'stripes' | 'checks' | 'dots' | 'houndstooth' | 'floral' | 'geometric'

export interface Body {
  heightCm: number
  weightKg: number
  bustCm: number
  waistCm: number
  hipsCm: number
  shape: 'hourglass' | 'pear' | 'apple' | 'rectangle' | 'invertedTriangle'
}
