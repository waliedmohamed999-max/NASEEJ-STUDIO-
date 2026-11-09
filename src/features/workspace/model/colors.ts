/**
 * Generic textile colour catalogue in a TCX-style notation: `NS LL-HHCC`
 * LL = lightness band (11 lightest … 19 darkest), HH = hue family (00–63), CC = chroma.
 * Codes are computed from the colour itself — not licensed Pantone data.
 */
export interface TextileColor { code: string; name: { en: string; ar: string }; hex: string; family: string }

const raw: Array<[string, string, string, string]> = [
  // neutrals
  ['Chalk', 'طباشيري', '#F2EFE8', 'neutral'], ['Ivory', 'عاجي', '#EEE6D3', 'neutral'], ['Ecru', 'إيكرو', '#E3D8C1', 'neutral'],
  ['Oatmeal', 'شوفاني', '#D6C8AE', 'neutral'], ['Stone', 'حجري', '#BDB3A2', 'neutral'], ['Greige', 'رمادي بيج', '#A99F91', 'neutral'],
  ['Taupe', 'توب', '#8B7D6E', 'neutral'], ['Mushroom', 'فطري', '#7A6E66', 'neutral'], ['Flint', 'صواني', '#6A6763', 'neutral'],
  ['Graphite', 'غرافيت', '#47474A', 'neutral'], ['Charcoal', 'فحمي', '#2F2F31', 'neutral'], ['Jet', 'كهرماني أسود', '#1A1A1A', 'neutral'],
  // browns & camels
  ['Sand', 'رملي', '#D2B48C', 'brown'], ['Camel', 'جملي', '#B08D57', 'brown'], ['Caramel', 'كراميل', '#A8713D', 'brown'],
  ['Cognac', 'كونياك', '#8A4B2A', 'brown'], ['Tobacco', 'تبغي', '#6E4B31', 'brown'], ['Chocolate', 'شوكولاتة', '#4A2E22', 'brown'],
  ['Espresso', 'إسبريسو', '#3A2A22', 'brown'],
  // reds & pinks
  ['Blush', 'وردي خجول', '#E9CFC8', 'red'], ['Dusty Rose', 'وردي مغبر', '#C99A96', 'red'], ['Terracotta', 'تيراكوتا', '#B4532A', 'red'],
  ['Rust', 'صدئي', '#9A4426', 'red'], ['Brick', 'طوبي', '#8E3B30', 'red'], ['Oxblood', 'دم الثور', '#5E1E22', 'red'],
  ['Bordeaux', 'بوردو', '#6E1E2E', 'red'], ['Cardinal', 'قرمزي', '#A3242E', 'red'], ['Coral', 'مرجاني', '#E07A5F', 'red'],
  ['Fuchsia', 'فوشيا', '#B5306E', 'red'],
  // yellows & oranges
  ['Butter', 'زبدي', '#EFDFA8', 'yellow'], ['Saffron', 'زعفراني', '#E1A43C', 'yellow'], ['Mustard', 'خردلي', '#C49A2C', 'yellow'],
  ['Ochre', 'مغرة', '#B07C2A', 'yellow'], ['Apricot', 'مشمشي', '#E9A578', 'yellow'], ['Tangerine', 'يوسفي', '#DD6B2E', 'yellow'],
  // greens
  ['Pistachio', 'فستقي', '#C3CFA2', 'green'], ['Sage', 'مريمية', '#9DAA8F', 'green'], ['Olive', 'زيتوني', '#6B6F4E', 'green'],
  ['Khaki', 'كاكي', '#8E8459', 'green'], ['Moss', 'طحلبي', '#5C6B3A', 'green'], ['Bottle', 'أخضر زجاجي', '#2E4A37', 'green'],
  ['Emerald', 'زمردي', '#2E5E4E', 'green'], ['Forest', 'غابي', '#22392C', 'green'], ['Mint', 'نعناعي', '#BFDCCB', 'green'],
  // blues
  ['Powder', 'أزرق بودرة', '#C9D6E3', 'blue'], ['Sky', 'سماوي', '#9DB8D3', 'blue'], ['Chambray', 'شامبري', '#7E97B4', 'blue'],
  ['Denim', 'دنيم', '#4A6283', 'blue'], ['Cobalt', 'كوبالت', '#2F4E9A', 'blue'], ['Teal', 'أزرق مخضر', '#2C6467', 'blue'],
  ['Petrol', 'بترولي', '#24434F', 'blue'], ['Navy', 'كحلي', '#22314A', 'blue'], ['Midnight', 'منتصف الليل', '#1A2233', 'blue'],
  // purples
  ['Lilac', 'ليلكي', '#CBBBD6', 'purple'], ['Lavender', 'لافندر', '#A99BC0', 'purple'], ['Mauve', 'موف', '#9C7A8C', 'purple'],
  ['Plum', 'برقوقي', '#5E2E4A', 'purple'], ['Aubergine', 'باذنجاني', '#3E2236', 'purple'],
  // metallic / special
  ['Champagne', 'شامبانيا', '#D9C3A5', 'metallic'], ['Antique Gold', 'ذهبي عتيق', '#A6823F', 'metallic'], ['Bronze', 'برونزي', '#8C6A3E', 'metallic'],
  ['Pewter', 'قصديري', '#8A8A88', 'metallic'], ['Pearl', 'لؤلؤي', '#EAE4DA', 'metallic'],
]

function hexToHsl(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h /= 6
  }
  return { h, s, l }
}

function codeFor(hex: string) {
  const { h, s, l } = hexToHsl(hex)
  const LL = 11 + Math.round((1 - l) * 8)
  const HH = String(Math.round(h * 63)).padStart(2, '0')
  const CC = String(Math.round(s * 99)).padStart(2, '0')
  return `NS ${LL}-${HH}${CC}`
}

export const COLOR_CATALOGUE: TextileColor[] = raw.map(([en, ar, hex, family]) => ({ code: codeFor(hex), name: { en, ar }, hex, family }))

export const nearestCatalogue = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  let best = COLOR_CATALOGUE[0], d0 = Infinity
  for (const c of COLOR_CATALOGUE) {
    const m = parseInt(c.hex.slice(1), 16)
    const d = (r - ((m >> 16) & 255)) ** 2 * 0.3 + (g - ((m >> 8) & 255)) ** 2 * 0.59 + (b - (m & 255)) ** 2 * 0.11
    if (d < d0) { d0 = d; best = c }
  }
  return best
}
