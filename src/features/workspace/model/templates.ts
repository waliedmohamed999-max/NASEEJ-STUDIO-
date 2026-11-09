import type { LText } from '@/types'
import type { GarmentKind } from './types'
import type { TemplateParams } from './blocks'

export const CATEGORIES = [
  { id: 'womenswear', name: { en: 'Womenswear', ar: 'أزياء نسائية' } },
  { id: 'menswear', name: { en: 'Menswear', ar: 'أزياء رجالية' } },
  { id: 'modest', name: { en: 'Modest Fashion', ar: 'الأزياء المحتشمة' } },
  { id: 'streetwear', name: { en: 'Streetwear', ar: 'أزياء الشارع' } },
  { id: 'tailoring', name: { en: 'Tailoring', ar: 'التفصيل' } },
  { id: 'evening', name: { en: 'Evening & Bridal', ar: 'السهرة والزفاف' } },
  { id: 'active', name: { en: 'Activewear', ar: 'ملابس رياضية' } },
  { id: 'basics', name: { en: 'Basics', ar: 'الأساسيات' } },
] as const
export type CategoryId = (typeof CATEGORIES)[number]['id']

export interface Template {
  id: string
  cat: CategoryId
  name: LText
  kind: GarmentKind
  fabric: string
  /** which base blocks the draft uses (shown in the gallery) */
  blocks: Array<'bodice' | 'sleeve' | 'skirt' | 'trouser' | 'collar' | 'hood' | 'kimono' | 'rect'>
  p: TemplateParams
}

const E = (bust: number, waist: number, hip: number) => ({ bust, waist, hip })
const t = (id: string, cat: CategoryId, en: string, ar: string, kind: GarmentKind, fabric: string, blocks: Template['blocks'], p: TemplateParams): Template =>
  ({ id, cat, name: { en, ar }, kind, fabric, blocks, p })

export const TEMPLATES: Template[] = [
  // ---------------- Womenswear (10)
  t('w-sheath', 'womenswear', 'Sheath Dress', 'فستان ضيّق', 'dress', 'fab-wool-crepe', ['bodice'], { ease: E(5, 4, 5), length: 98, darts: true, neckline: 'scoop', sleeve: 'none', closure: 'zip' }),
  t('w-aline', 'womenswear', 'A-line Dress', 'فستان بقصة A', 'dress', 'fab-viscose-crepe', ['bodice', 'sleeve', 'skirt'], { ease: E(6, 4, 14), waistSeam: true, skirtType: 'aline', skirtLength: 64, darts: true, sleeve: 'cap' }),
  t('w-wrap', 'womenswear', 'Wrap Dress', 'فستان ملفوف', 'dress', 'fab-cotton-jersey', ['bodice', 'sleeve', 'skirt'], { ease: E(4, 4, 12), waistSeam: true, skirtType: 'aline', skirtLength: 66, neckline: 'v', sleeve: 'elbow', closure: 'open' }),
  t('w-shift', 'womenswear', 'Shift Dress', 'فستان مستقيم', 'dress', 'fab-linen', ['bodice', 'sleeve'], { ease: E(12, 20, 12), length: 95, neckline: 'boat', sleeve: 'short' }),
  t('w-shirtdress', 'womenswear', 'Shirt Dress', 'فستان قميصي', 'dress', 'fab-cotton-poplin', ['bodice', 'sleeve', 'collar'], { ease: E(12, 14, 12), length: 108, closure: 'buttons', collar: 'shirt', sleeve: 'long', cuffs: true, hemFlare: 3 }),
  t('w-slip', 'womenswear', 'Bias Slip Dress', 'فستان سليب مائل', 'dress', 'fab-silk-charmeuse', ['bodice'], { ease: E(4, 6, 8), length: 118, neckline: 'v', sleeve: 'none', hemFlare: 6 }),
  t('w-blouse', 'womenswear', 'Peasant Blouse', 'بلوزة فلاحية', 'top', 'fab-crepe-de-chine', ['bodice', 'sleeve'], { ease: E(14, 20, 14), length: 64, neckline: 'scoop', sleeve: 'threeQuarter' }),
  t('w-cami', 'womenswear', 'Camisole', 'كامي', 'top', 'fab-silk-charmeuse', ['bodice'], { ease: E(6, 8, 8), length: 56, neckline: 'v', sleeve: 'none' }),
  t('w-pencil', 'womenswear', 'Pencil Skirt', 'تنورة قلم', 'skirt', 'fab-wool-crepe', ['skirt'], { ease: E(0, 2, 4), length: 62, skirtType: 'pencil' }),
  t('w-aline-skirt', 'womenswear', 'A-line Midi Skirt', 'تنورة متوسطة بقصة A', 'skirt', 'fab-cotton-twill', ['skirt'], { ease: E(0, 2, 8), length: 70, skirtType: 'aline', pockets: true }),

  // ---------------- Menswear (8)
  t('m-oxford', 'menswear', 'Oxford Shirt', 'قميص أكسفورد', 'top', 'fab-cotton-poplin', ['bodice', 'sleeve', 'collar'], { ease: E(18, 22, 16), length: 76, closure: 'buttons', collar: 'shirt', sleeve: 'long', cuffs: true, pockets: true }),
  t('m-camp', 'menswear', 'Camp Collar Shirt', 'قميص بياقة مفتوحة', 'top', 'fab-lyocell-twill', ['bodice', 'sleeve', 'collar'], { ease: E(20, 24, 18), length: 72, closure: 'buttons', collar: 'lapel', sleeve: 'short' }),
  t('m-polo', 'menswear', 'Polo Shirt', 'قميص بولو', 'top', 'fab-cotton-jersey', ['bodice', 'sleeve', 'collar'], { ease: E(12, 16, 12), length: 72, collar: 'polo', sleeve: 'short' }),
  t('m-tee', 'menswear', 'Crew Tee', 'تيشيرت دائري', 'top', 'fab-cotton-jersey', ['bodice', 'sleeve'], { ease: E(12, 18, 12), length: 72, sleeve: 'short' }),
  t('m-chino', 'menswear', 'Chino', 'سروال شينو', 'trousers', 'fab-cotton-twill', ['trouser'], { ease: E(0, 2, 8), length: 104, legShape: 'slim', darts: false, pockets: false }),
  t('m-trouser', 'menswear', 'Straight Trouser', 'سروال مستقيم', 'trousers', 'fab-wool-gabardine', ['trouser'], { ease: E(0, 2, 8), length: 104, legShape: 'straight', darts: true }),
  t('m-overshirt', 'menswear', 'Overshirt', 'قميص خارجي', 'top', 'fab-hemp-canvas', ['bodice', 'sleeve', 'collar'], { ease: E(22, 26, 20), length: 74, closure: 'buttons', collar: 'shirt', sleeve: 'long', cuffs: true, pockets: true }),
  t('m-bomber', 'menswear', 'Bomber Jacket', 'جاكيت بومبر', 'top', 'fab-duchess-satin', ['bodice', 'sleeve', 'collar'], { ease: E(22, 24, 18), length: 64, closure: 'zip', collar: 'polo', sleeve: 'long', cuffs: true }),

  // ---------------- Modest fashion (12)
  t('mo-abaya-classic', 'modest', 'Classic Closed Abaya', 'عباية كلاسيكية مغلقة', 'dress', 'fab-nida', ['bodice', 'sleeve'], { ease: E(26, 34, 28), length: 142, sleeve: 'long', hemFlare: 8 }),
  t('mo-abaya-open', 'modest', 'Open Front Abaya', 'عباية مفتوحة', 'dress', 'fab-nida', ['bodice', 'sleeve'], { ease: E(28, 36, 30), length: 142, sleeve: 'bell', closure: 'open', hemFlare: 10 }),
  t('mo-bisht', 'modest', 'Bisht Abaya', 'عباية بشت', 'dress', 'fab-nida', ['kimono'], { ease: E(40, 50, 44), length: 140, sleeve: 'butterfly', closure: 'open', hemFlare: 6 }),
  t('mo-kimono', 'modest', 'Kimono Abaya', 'عباية كيمونو', 'dress', 'fab-viscose-crepe', ['kimono'], { ease: E(30, 38, 32), length: 140, sleeve: 'kimono', closure: 'open', hemFlare: 6 }),
  t('mo-butterfly', 'modest', 'Butterfly Abaya', 'عباية فراشة', 'dress', 'fab-silk-chiffon', ['kimono'], { ease: E(44, 54, 48), length: 140, sleeve: 'butterfly', hemFlare: 10 }),
  t('mo-kaftan', 'modest', 'Kaftan', 'قفطان', 'dress', 'fab-crepe-de-chine', ['kimono'], { ease: E(36, 44, 38), length: 136, sleeve: 'batwing', neckline: 'v', slits: true }),
  t('mo-jalabiya', 'modest', 'Modern Jalabiya', 'جلابية عصرية', 'dress', 'fab-linen', ['bodice', 'sleeve', 'collar'], { ease: E(22, 30, 24), length: 138, sleeve: 'long', collar: 'mandarin', closure: 'buttons', hemFlare: 6 }),
  t('mo-maxi', 'modest', 'Modest Maxi Dress', 'فستان ماكسي محتشم', 'dress', 'fab-viscose-crepe', ['bodice', 'sleeve', 'skirt'], { ease: E(10, 10, 18), waistSeam: true, skirtType: 'gathered', skirtLength: 100, sleeve: 'long', neckline: 'high' }),
  t('mo-tunic', 'modest', 'Long Tunic', 'تونيك طويل', 'top', 'fab-lyocell-twill', ['bodice', 'sleeve', 'collar'], { ease: E(18, 24, 20), length: 96, sleeve: 'long', collar: 'mandarin', slits: true }),
  t('mo-hijab', 'modest', 'Rectangle Hijab', 'حجاب مستطيل', 'scarf', 'fab-silk-chiffon', ['rect'], { scarf: { w: 180, h: 70 } }),
  t('mo-shayla', 'modest', 'Shayla', 'شيلة', 'scarf', 'fab-nida', ['rect'], { scarf: { w: 180, h: 50 } }),
  t('mo-square', 'modest', 'Square Scarf', 'وشاح مربع', 'scarf', 'fab-crepe-de-chine', ['rect'], { scarf: { w: 110, h: 110 } }),

  // ---------------- Streetwear (8)
  t('s-hoodie', 'streetwear', 'Hoodie', 'هودي', 'top', 'fab-cotton-jersey', ['bodice', 'sleeve', 'hood'], { ease: E(24, 30, 22), length: 68, sleeve: 'long', collar: 'hood', cuffs: true, pockets: true }),
  t('s-sweat', 'streetwear', 'Crew Sweatshirt', 'سويت شيرت', 'top', 'fab-cotton-jersey', ['bodice', 'sleeve'], { ease: E(22, 28, 20), length: 66, sleeve: 'long', cuffs: true }),
  t('s-oversize-tee', 'streetwear', 'Oversized Tee', 'تيشيرت واسع', 'top', 'fab-cotton-jersey', ['bodice', 'sleeve'], { ease: E(30, 36, 28), length: 74, sleeve: 'elbow', neckline: 'crew' }),
  t('s-cargo', 'streetwear', 'Cargo Pants', 'بنطال كارجو', 'trousers', 'fab-cotton-twill', ['trouser'], { ease: E(0, 4, 14), length: 102, legShape: 'wide', pockets: true }),
  t('s-jogger', 'streetwear', 'Joggers', 'بنطال جوجر', 'trousers', 'fab-cotton-jersey', ['trouser'], { ease: E(0, 4, 12), length: 96, legShape: 'jogger' }),
  t('s-denim-jacket', 'streetwear', 'Denim Jacket', 'جاكيت دنيم', 'top', 'fab-raw-denim', ['bodice', 'sleeve', 'collar'], { ease: E(16, 20, 16), length: 58, closure: 'buttons', collar: 'shirt', sleeve: 'long', cuffs: true, pockets: true }),
  t('s-coach', 'streetwear', 'Coach Jacket', 'جاكيت كوتش', 'top', 'fab-cotton-twill', ['bodice', 'sleeve', 'collar'], { ease: E(24, 28, 20), length: 70, closure: 'buttons', collar: 'shirt', sleeve: 'long' }),
  t('s-track', 'streetwear', 'Track Jacket', 'جاكيت رياضي', 'top', 'fab-modal-rib', ['bodice', 'sleeve', 'collar'], { ease: E(14, 18, 14), length: 64, closure: 'zip', collar: 'mandarin', sleeve: 'long', cuffs: true }),

  // ---------------- Tailoring (8)
  t('t-blazer', 'tailoring', 'Single-breasted Blazer', 'بليزر بصف أزرار', 'top', 'fab-wool-tweed', ['bodice', 'sleeve', 'collar'], { ease: E(10, 12, 8), length: 72, closure: 'buttons', collar: 'lapel', neckline: 'v', sleeve: 'long', darts: true, pockets: true }),
  t('t-trouser', 'tailoring', 'Tailored Trouser', 'سروال مفصّل', 'trousers', 'fab-wool-gabardine', ['trouser'], { ease: E(0, 2, 6), length: 104, legShape: 'straight', darts: true }),
  t('t-waistcoat', 'tailoring', 'Waistcoat', 'صديري', 'top', 'fab-wool-gabardine', ['bodice'], { ease: E(6, 8, 6), length: 58, closure: 'buttons', neckline: 'v', sleeve: 'none', darts: true }),
  t('t-trench', 'tailoring', 'Trench Coat', 'معطف ترنش', 'dress', 'fab-wool-gabardine', ['bodice', 'sleeve', 'collar'], { ease: E(16, 20, 18), length: 110, closure: 'buttons', collar: 'lapel', neckline: 'v', sleeve: 'long', hemFlare: 6, pockets: true }),
  t('t-overcoat', 'tailoring', 'Overcoat', 'معطف طويل', 'dress', 'fab-cashmere-coating', ['bodice', 'sleeve', 'collar'], { ease: E(18, 22, 20), length: 108, closure: 'buttons', collar: 'lapel', neckline: 'v', sleeve: 'long', pockets: true }),
  t('t-cigarette', 'tailoring', 'Cigarette Trouser', 'سروال سيجارة', 'trousers', 'fab-wool-crepe', ['trouser'], { ease: E(0, 2, 4), length: 92, legShape: 'slim', darts: true }),
  t('t-skirt', 'tailoring', 'Tailored Skirt', 'تنورة مفصّلة', 'skirt', 'fab-wool-tweed', ['skirt'], { ease: E(0, 2, 4), length: 58, skirtType: 'straight' }),
  t('t-wide', 'tailoring', 'Wide-leg Trouser', 'سروال واسع', 'trousers', 'fab-wool-crepe', ['trouser'], { ease: E(0, 2, 10), length: 106, legShape: 'wide', darts: true }),

  // ---------------- Evening & Bridal (8)
  t('e-column', 'evening', 'Column Gown', 'فستان عمودي', 'dress', 'fab-silk-charmeuse', ['bodice'], { ease: E(4, 4, 6), length: 148, darts: true, neckline: 'boat', sleeve: 'none', closure: 'zip' }),
  t('e-ballgown', 'evening', 'Ball Gown', 'فستان منفوش', 'dress', 'fab-duchess-satin', ['bodice', 'skirt'], { ease: E(3, 2, 20), waistSeam: true, skirtType: 'gathered', skirtLength: 108, darts: true, neckline: 'square', closure: 'zip' }),
  t('e-mermaid', 'evening', 'Mermaid Gown', 'فستان حورية', 'dress', 'fab-duchess-satin', ['bodice', 'skirt'], { ease: E(3, 2, 4), waistSeam: true, skirtType: 'mermaid', skirtLength: 108, darts: true, neckline: 'v', closure: 'zip' }),
  t('e-cocktail', 'evening', 'Cocktail Dress', 'فستان كوكتيل', 'dress', 'fab-cotton-velvet', ['bodice', 'skirt'], { ease: E(4, 3, 16), waistSeam: true, skirtType: 'circle', skirtLength: 52, darts: true, neckline: 'scoop' }),
  t('e-bridal', 'evening', 'Bridal A-line', 'فستان زفاف A', 'dress', 'fab-duchess-satin', ['bodice', 'sleeve', 'skirt'], { ease: E(3, 2, 30), waistSeam: true, skirtType: 'aline', skirtLength: 112, darts: true, sleeve: 'long', neckline: 'boat', closure: 'buttons' }),
  t('e-kaftan', 'evening', 'Evening Kaftan', 'قفطان سهرة', 'dress', 'fab-jacquard', ['kimono'], { ease: E(34, 40, 36), length: 140, sleeve: 'kimono', neckline: 'v' }),
  t('e-pleated', 'evening', 'Pleated Evening Dress', 'فستان سهرة بكسرات', 'dress', 'fab-silk-chiffon', ['bodice', 'sleeve', 'skirt'], { ease: E(5, 4, 12), waistSeam: true, skirtType: 'pleated', skirtLength: 108, pleats: 8, sleeve: 'bell', neckline: 'v' }),
  t('e-jumpsuit', 'evening', 'Evening Jumpsuit', 'جمبسوت سهرة', 'jumpsuit', 'fab-silk-charmeuse', ['bodice', 'trouser'], { ease: E(5, 6, 10), trouserLength: 106, legShape: 'wide', neckline: 'v', sleeve: 'none' }),

  // ---------------- Activewear (6)
  t('a-bra', 'active', 'Sports Bra', 'حمالة رياضية', 'top', 'fab-modal-rib', ['bodice'], { ease: E(-6, -4, 0), length: 34, neckline: 'scoop', sleeve: 'none' }),
  t('a-legging', 'active', 'Leggings', 'ليقنز', 'trousers', 'fab-modal-rib', ['trouser'], { ease: E(0, -4, -8), length: 92, legShape: 'legging' }),
  t('a-bike', 'active', 'Bike Shorts', 'شورت دراجة', 'trousers', 'fab-modal-rib', ['trouser'], { ease: E(0, -4, -8), length: 46, legShape: 'legging' }),
  t('a-run-tee', 'active', 'Running Tee', 'تيشيرت جري', 'top', 'fab-cotton-jersey', ['bodice', 'sleeve'], { ease: E(6, 10, 6), length: 66, sleeve: 'short', neckline: 'crew' }),
  t('a-track-pant', 'active', 'Track Pants', 'بنطال رياضي', 'trousers', 'fab-cotton-jersey', ['trouser'], { ease: E(0, 4, 12), length: 100, legShape: 'straight' }),
  t('a-zip-hoodie', 'active', 'Zip Hoodie', 'هودي بسحاب', 'top', 'fab-cotton-jersey', ['bodice', 'sleeve', 'hood'], { ease: E(18, 22, 16), length: 66, closure: 'zip', collar: 'hood', sleeve: 'long', cuffs: true }),

  // ---------------- Basics (8)
  t('b-tee', 'basics', 'Essential Tee', 'تيشيرت أساسي', 'top', 'fab-cotton-jersey', ['bodice', 'sleeve'], { ease: E(8, 14, 8), length: 64, sleeve: 'short' }),
  t('b-tank', 'basics', 'Tank Top', 'توب بدون أكمام', 'top', 'fab-modal-rib', ['bodice'], { ease: E(2, 4, 2), length: 62, neckline: 'scoop', sleeve: 'none' }),
  t('b-longsleeve', 'basics', 'Long-sleeve Tee', 'تيشيرت بأكمام طويلة', 'top', 'fab-cotton-jersey', ['bodice', 'sleeve'], { ease: E(6, 12, 6), length: 64, sleeve: 'long' }),
  t('b-turtle', 'basics', 'Turtleneck', 'كنزة برقبة عالية', 'top', 'fab-modal-rib', ['bodice', 'sleeve', 'collar'], { ease: E(2, 6, 4), length: 62, neckline: 'high', collar: 'polo', sleeve: 'long' }),
  t('b-cardigan', 'basics', 'Cardigan', 'كارديغان', 'top', 'fab-modal-rib', ['bodice', 'sleeve'], { ease: E(12, 16, 12), length: 64, closure: 'buttons', neckline: 'v', sleeve: 'long', cuffs: true }),
  t('b-shorts', 'basics', 'Easy Shorts', 'شورت مريح', 'trousers', 'fab-linen', ['trouser'], { ease: E(0, 6, 14), length: 44, legShape: 'wide' }),
  t('b-slipskirt', 'basics', 'Slip Skirt', 'تنورة سليب', 'skirt', 'fab-silk-charmeuse', ['skirt'], { ease: E(0, 4, 10), length: 72, skirtType: 'aline', waistband: true }),
  t('b-pj', 'basics', 'Pyjama Trouser', 'بنطال بيجاما', 'trousers', 'fab-cotton-poplin', ['trouser'], { ease: E(0, 8, 18), length: 100, legShape: 'wide' }),
]

export const templateById = (id: string) => TEMPLATES.find((x) => x.id === id)

/** The original 6 Design Studio garments map onto these templates (project migration). */
export const LEGACY_TEMPLATE: Record<string, string> = {
  dress: 'w-aline', shirt: 'm-oxford', abaya: 'mo-abaya-classic', trousers: 't-wide', jacket: 't-blazer', skirt: 'w-aline-skirt',
}
