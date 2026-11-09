import type { LText } from '@/types'

export type TrimCat = 'button' | 'zipper' | 'snap' | 'rivet' | 'lace' | 'ribbon' | 'piping' | 'patch' | 'label'

export interface Trim {
  id: string
  cat: TrimCat
  name: LText
  /** industry size notation: ligne for buttons, gauge for zips, mm, cm width */
  spec: string
  material: string
  unit: 'pc' | 'm'
  cost: number // USD per unit
  color: string
}

const T = (id: string, cat: TrimCat, en: string, ar: string, spec: string, material: string, unit: 'pc' | 'm', cost: number, color: string): Trim =>
  ({ id, cat, name: { en, ar }, spec, material, unit, cost, color })

/** Generic trims catalogue (no licensed brand data). */
export const TRIMS: Trim[] = [
  T('btn-shirt-18l', 'button', '4-hole shirt button', 'زر قميص بأربع ثقوب', '18L (11.5 mm)', 'Corozo', 'pc', 0.12, '#efe9dc'),
  T('btn-mop-16l', 'button', 'Mother-of-pearl button', 'زر صدف', '16L (10 mm)', 'Mother of pearl', 'pc', 0.45, '#f4f0e8'),
  T('btn-horn-32l', 'button', 'Horn coat button', 'زر معطف من القرن', '32L (20 mm)', 'Horn', 'pc', 0.9, '#5a4632'),
  T('btn-shank-24l', 'button', 'Metal shank button', 'زر معدني بساق', '24L (15 mm)', 'Brass', 'pc', 0.38, '#b08d57'),
  T('btn-covered-20l', 'button', 'Self-covered button', 'زر مغطى بالقماش', '20L (12.7 mm)', 'Self fabric', 'pc', 0.25, '#1a1a1a'),
  T('zip-invisible', 'zipper', 'Invisible zip', 'سحاب مخفي', '#3, 55 cm', 'Nylon coil', 'pc', 0.55, '#1a1a1a'),
  T('zip-metal-5', 'zipper', 'Metal jeans zip', 'سحاب جينز معدني', '#5, 18 cm', 'Brass', 'pc', 0.7, '#b08d57'),
  T('zip-open-vislon', 'zipper', 'Open-end moulded zip', 'سحاب مفتوح', '#5, 60 cm', 'Polyacetal', 'pc', 1.4, '#1a1a1a'),
  T('snap-press-12', 'snap', 'Press stud', 'كبسة ضغط', '12 mm', 'Stainless steel', 'pc', 0.15, '#9a9a9a'),
  T('snap-sew-on', 'snap', 'Sew-on snap', 'كبسة تُخاط', '8 mm', 'Nickel-free brass', 'pc', 0.08, '#9a9a9a'),
  T('rivet-copper', 'rivet', 'Copper rivet', 'مسمار نحاسي', '9 mm', 'Copper', 'pc', 0.06, '#a0613a'),
  T('rivet-gunmetal', 'rivet', 'Gunmetal rivet', 'مسمار رمادي داكن', '8 mm', 'Brass, gunmetal finish', 'pc', 0.07, '#4a4a4a'),
  T('lace-chantilly', 'lace', 'Chantilly lace edging', 'دانتيل شانتيلي', '6 cm', 'Nylon / viscose', 'm', 4.8, '#f4f0e8'),
  T('lace-guipure', 'lace', 'Guipure lace trim', 'دانتيل جيبور', '3 cm', 'Polyester', 'm', 3.2, '#efe9dc'),
  T('ribbon-grosgrain', 'ribbon', 'Grosgrain ribbon', 'شريط جروجرين', '25 mm', 'Polyester', 'm', 0.6, '#1a1a1a'),
  T('ribbon-satin', 'ribbon', 'Double-face satin ribbon', 'شريط ساتان مزدوج', '15 mm', 'Polyester', 'm', 0.5, '#b08d57'),
  T('piping-cord', 'piping', 'Cord piping', 'بايبينغ بحبل', '3 mm cord', 'Cotton', 'm', 0.9, '#b08d57'),
  T('piping-gold', 'piping', 'Gold metallic piping (bisht)', 'بايبينغ ذهبي (بشت)', '4 mm', 'Metallic lurex', 'm', 2.4, '#c9a24a'),
  T('patch-monogram', 'patch', 'Embroidered monogram patch', 'رقعة مونوغرام مطرزة', '5 × 5 cm', 'Embroidery on twill', 'pc', 1.1, '#6b6f4e'),
  T('patch-floral', 'patch', 'Floral appliqué', 'رقعة زهرية', '8 × 6 cm', 'Embroidery on tulle', 'pc', 1.9, '#7d5a6b'),
  T('label-main', 'label', 'Woven main label', 'ملصق رئيسي منسوج', '5 × 2 cm', 'Damask polyester', 'pc', 0.09, '#1a1a1a'),
  T('label-care', 'label', 'Printed care label', 'ملصق عناية مطبوع', '3 × 7 cm', 'Satin polyester', 'pc', 0.03, '#f4f0e8'),
  T('label-size', 'label', 'Size tab', 'ملصق المقاس', '1.5 × 2 cm', 'Damask polyester', 'pc', 0.02, '#1a1a1a'),
]

export const trimById = (id: string) => TRIMS.find((t) => t.id === id)
