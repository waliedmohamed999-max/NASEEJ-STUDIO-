import type { GarmentTemplate } from '../types/index.ts'

/**
 * Flat-sketch garment templates, front view, drawn in a 400×600 viewBox.
 * Pieces are filled with fabric in the Design Studio; `details` are stitch lines.
 */
const circle = (x: number, y: number, r = 3) =>
  `M${x - r} ${y} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`

export const garments: GarmentTemplate[] = [
  {
    id: 'dress',
    name: { en: 'A-line Dress', ar: 'فستان بقصة A' },
    pieces: [
      { id: 'bodice', name: { en: 'Bodice', ar: 'الصدرية' }, areaShare: 0.28,
        path: 'M170 60 Q200 88 230 60 L275 72 L272 112 Q262 160 258 232 L142 232 Q138 160 128 112 L125 72 Z' },
      { id: 'skirt', name: { en: 'Skirt', ar: 'التنورة' }, areaShare: 0.62,
        path: 'M142 232 L258 232 L326 520 Q200 544 74 520 Z' },
      { id: 'sleeves', name: { en: 'Cap sleeves', ar: 'أكمام قصيرة' }, areaShare: 0.1,
        path: 'M125 72 L94 92 L108 132 L128 112 Z M275 72 L306 92 L292 132 L272 112 Z' },
    ],
    details: 'M142 232 L258 232 M172 140 L177 205 M228 140 L223 205 M200 232 L200 530',
    baseConsumptionM: 2.4,
    ease: { bust: 6, waist: 4, hips: 14 },
    covers: ['bust', 'waist', 'hips'],
    measurements: [
      { key: 'bust', label: { en: 'Bust', ar: 'الصدر' }, m: 96 },
      { key: 'waist', label: { en: 'Waist', ar: 'الخصر' }, m: 76 },
      { key: 'hem', label: { en: 'Hem sweep', ar: 'محيط الذيل' }, m: 240 },
      { key: 'length', label: { en: 'Length (HPS)', ar: 'الطول من الكتف' }, m: 112 },
      { key: 'shoulder', label: { en: 'Shoulder width', ar: 'عرض الكتفين' }, m: 37 },
    ],
    defaultFabricId: 'fab-viscose-crepe',
    flare: 0.55, length: 0.62, sleeves: 'short',
  },
  {
    id: 'shirt',
    name: { en: 'Classic Shirt', ar: 'قميص كلاسيكي' },
    pieces: [
      { id: 'body', name: { en: 'Body', ar: 'الجسم' }, areaShare: 0.58,
        path: 'M168 52 Q200 68 232 52 L282 72 L280 140 L278 470 Q200 482 122 470 L120 140 L118 72 Z' },
      { id: 'sleeves', name: { en: 'Sleeves', ar: 'الأكمام' }, areaShare: 0.3,
        path: 'M118 72 L88 88 L58 330 L92 338 L120 160 Z M282 72 L312 88 L342 330 L308 338 L280 160 Z' },
      { id: 'cuffs', name: { en: 'Cuffs', ar: 'الأساور' }, areaShare: 0.04,
        path: 'M58 330 L92 338 L88 368 L54 360 Z M342 330 L308 338 L312 368 L346 360 Z' },
      { id: 'collar', name: { en: 'Collar', ar: 'الياقة' }, areaShare: 0.08,
        path: 'M178 40 Q200 48 222 40 L238 56 L212 98 L200 82 L188 98 L162 56 Z' },
    ],
    details: `M200 84 L200 476 M222 132 L258 132 L258 174 L240 182 L222 174 Z ${[130, 190, 250, 310, 370, 430].map((y) => circle(206, y, 2.6)).join(' ')}`,
    baseConsumptionM: 1.8,
    ease: { bust: 12, waist: 16, hips: 10 },
    covers: ['bust', 'waist', 'hips'],
    measurements: [
      { key: 'chest', label: { en: 'Chest', ar: 'الصدر' }, m: 104 },
      { key: 'waist', label: { en: 'Waist', ar: 'الخصر' }, m: 92 },
      { key: 'length', label: { en: 'Back length', ar: 'طول الظهر' }, m: 74 },
      { key: 'sleeve', label: { en: 'Sleeve length', ar: 'طول الكم' }, m: 61 },
      { key: 'collar', label: { en: 'Collar', ar: 'الياقة' }, m: 38 },
    ],
    defaultFabricId: 'fab-cotton-poplin',
    flare: 0.05, length: 0.36, sleeves: 'long',
  },
  {
    id: 'abaya',
    name: { en: 'Flowing Abaya', ar: 'عباية منسدلة' },
    pieces: [
      { id: 'body', name: { en: 'Body', ar: 'الجسم' }, areaShare: 0.66,
        path: 'M172 50 Q200 66 228 50 L270 64 L304 562 Q200 578 96 562 L130 64 Z' },
      { id: 'sleeves', name: { en: 'Bell sleeves', ar: 'أكمام واسعة' }, areaShare: 0.28,
        path: 'M130 64 L96 80 L28 300 L92 320 L128 150 Z M270 64 L304 80 L372 300 L308 320 L272 150 Z' },
      { id: 'band', name: { en: 'Front band', ar: 'شريط الأمام' }, areaShare: 0.06,
        path: 'M190 58 L186 568 L214 568 L210 58 Z' },
    ],
    details: 'M172 50 Q200 66 228 50 M40 270 L98 290 M360 270 L302 290',
    baseConsumptionM: 3.6,
    ease: { bust: 26, waist: 34, hips: 28 },
    covers: ['bust', 'waist', 'hips'],
    measurements: [
      { key: 'bust', label: { en: 'Bust', ar: 'الصدر' }, m: 118 },
      { key: 'hips', label: { en: 'Hips', ar: 'الأرداف' }, m: 126 },
      { key: 'hem', label: { en: 'Hem sweep', ar: 'محيط الذيل' }, m: 220 },
      { key: 'length', label: { en: 'Length', ar: 'الطول' }, m: 142 },
      { key: 'sleeve', label: { en: 'Sleeve opening', ar: 'فتحة الكم' }, m: 56 },
    ],
    defaultFabricId: 'fab-nida',
    flare: 0.35, length: 0.8, sleeves: 'long',
  },
  {
    id: 'trousers',
    name: { en: 'Wide-leg Trousers', ar: 'سروال واسع' },
    pieces: [
      { id: 'waistband', name: { en: 'Waistband', ar: 'حزام الخصر' }, areaShare: 0.06,
        path: 'M120 40 L280 40 L282 68 L118 68 Z' },
      { id: 'legs', name: { en: 'Legs', ar: 'الساقان' }, areaShare: 0.94,
        path: 'M118 68 L282 68 L294 200 L304 562 L218 562 L204 232 L200 212 L196 232 L182 562 L96 562 L106 200 Z' },
    ],
    details: 'M200 68 L200 196 Q197 210 186 205 M130 72 Q152 112 140 142 M270 72 Q248 112 260 142 M150 234 L140 560 M250 234 L260 560',
    baseConsumptionM: 1.4,
    ease: { bust: 0, waist: 2, hips: 8 },
    covers: ['waist', 'hips'],
    measurements: [
      { key: 'waist', label: { en: 'Waist', ar: 'الخصر' }, m: 74 },
      { key: 'hips', label: { en: 'Hips', ar: 'الأرداف' }, m: 104 },
      { key: 'rise', label: { en: 'Front rise', ar: 'الارتفاع الأمامي' }, m: 29 },
      { key: 'inseam', label: { en: 'Inseam', ar: 'طول الساق الداخلي' }, m: 78 },
      { key: 'legOpening', label: { en: 'Leg opening', ar: 'فتحة الساق' }, m: 56 },
    ],
    defaultFabricId: 'fab-wool-gabardine',
    flare: 0.15, length: 0.0, sleeves: 'none',
  },
  {
    id: 'jacket',
    name: { en: 'Tailored Jacket', ar: 'جاكيت مفصّل' },
    pieces: [
      { id: 'body', name: { en: 'Body', ar: 'الجسم' }, areaShare: 0.58,
        path: 'M170 54 L120 70 L118 150 L122 440 L200 456 L278 440 L282 150 L280 70 L230 54 L200 122 Z' },
      { id: 'sleeves', name: { en: 'Sleeves', ar: 'الأكمام' }, areaShare: 0.3,
        path: 'M120 70 L90 86 L66 352 L102 358 L119 160 Z M280 70 L310 86 L334 352 L298 358 L281 160 Z' },
      { id: 'lapels', name: { en: 'Lapels', ar: 'طيّات الصدر' }, areaShare: 0.08,
        path: 'M172 54 L146 86 L162 98 L150 122 L200 262 L200 122 Z M228 54 L254 86 L238 98 L250 122 L200 262 L200 122 Z' },
      { id: 'pockets', name: { en: 'Pocket flaps', ar: 'أغطية الجيوب' }, areaShare: 0.04,
        path: 'M136 330 L182 330 L182 346 L136 346 Z M218 330 L264 330 L264 346 L218 346 Z' },
    ],
    details: `M200 262 L200 454 M222 172 L256 168 ${circle(206, 300, 4)} ${circle(206, 352, 4)} M142 160 Q150 260 146 440 M258 160 Q250 260 254 440`,
    baseConsumptionM: 1.9,
    ease: { bust: 10, waist: 12, hips: 8 },
    covers: ['bust', 'waist', 'hips'],
    measurements: [
      { key: 'chest', label: { en: 'Chest', ar: 'الصدر' }, m: 100 },
      { key: 'waist', label: { en: 'Waist', ar: 'الخصر' }, m: 86 },
      { key: 'shoulder', label: { en: 'Shoulder width', ar: 'عرض الكتفين' }, m: 39 },
      { key: 'length', label: { en: 'Back length', ar: 'طول الظهر' }, m: 70 },
      { key: 'sleeve', label: { en: 'Sleeve length', ar: 'طول الكم' }, m: 60 },
    ],
    defaultFabricId: 'fab-wool-tweed',
    flare: 0.04, length: 0.34, sleeves: 'long',
  },
  {
    id: 'skirt',
    name: { en: 'Midi Skirt', ar: 'تنورة متوسطة' },
    pieces: [
      { id: 'waistband', name: { en: 'Waistband', ar: 'حزام الخصر' }, areaShare: 0.08,
        path: 'M136 60 L264 60 L266 86 L134 86 Z' },
      { id: 'body', name: { en: 'Skirt body', ar: 'جسم التنورة' }, areaShare: 0.92,
        path: 'M134 86 L266 86 L304 430 Q200 446 96 430 Z' },
    ],
    details: 'M170 86 L154 436 M230 86 L246 436 M200 86 L200 440',
    baseConsumptionM: 1.1,
    ease: { bust: 0, waist: 2, hips: 10 },
    covers: ['waist', 'hips'],
    measurements: [
      { key: 'waist', label: { en: 'Waist', ar: 'الخصر' }, m: 74 },
      { key: 'hips', label: { en: 'Hips', ar: 'الأرداف' }, m: 106 },
      { key: 'hem', label: { en: 'Hem sweep', ar: 'محيط الذيل' }, m: 160 },
      { key: 'length', label: { en: 'Length', ar: 'الطول' }, m: 72 },
    ],
    defaultFabricId: 'fab-wool-crepe',
    flare: 0.3, length: 0.0, sleeves: 'none',
  },
]

export const garmentById = (id: string) => garments.find((g) => g.id === id)

/** Body-measurement size chart (cm) used for size recommendation and grading. */
export const sizeChart = [
  { size: 'XS', bust: 82, waist: 64, hips: 88 },
  { size: 'S', bust: 86, waist: 68, hips: 92 },
  { size: 'M', bust: 90, waist: 72, hips: 96 },
  { size: 'L', bust: 96, waist: 78, hips: 102 },
  { size: 'XL', bust: 102, waist: 84, hips: 108 },
  { size: 'XXL', bust: 110, waist: 92, hips: 116 },
] as const

export type SizeCode = (typeof sizeChart)[number]['size']
