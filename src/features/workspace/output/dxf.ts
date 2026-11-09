import { fabricById } from '@/data/fabrics'
import type { Style, Vec } from '../model/types'
import { edgeControls, flatten, pointOnEdge, seamAllowanceOutline, toTable, bbox } from '../model/geometry'

/**
 * DXF (R12 ASCII) following the AAMA/ASTM D6673 layer convention:
 *   1  = piece boundary (cut line, incl. seam allowance)
 *   14 = sew line          7 = grain line
 *   8  = internal lines (darts, pleats, placement, buttonholes)
 *   4  = notches           text on layer 1 (piece name, size, quantity, material)
 * Each piece is a BLOCK, inserted at its cutting-table position. Units: millimetres.
 * Grade rule tables (.RUL) are not emitted — the base size only.
 */
export function styleToDxf(style: Style): string {
  const out: string[] = []
  // Group codes 10–59 are reals; 60–79 / 90–99 are integers (CAD readers reject '70 1.000').
  const w = (...pairs: Array<string | number>) => {
    for (let i = 0; i < pairs.length; i += 2) {
      const code = Number(pairs[i]), v = pairs[i + 1]
      out.push(String(code), typeof v === 'number' ? (code >= 10 && code <= 59 ? v.toFixed(3) : String(Math.round(v))) : String(v))
    }
  }
  const mm = (v: Vec) => ({ x: v.x * 10, y: -v.y * 10 }) // cm → mm, y up
  const poly = (layer: string, pts: Vec[], closed: boolean) => {
    w(0, 'POLYLINE', 8, layer, 66, 1, 70, closed ? 1 : 0)
    for (const p of pts.map(mm)) w(0, 'VERTEX', 8, layer, 10, p.x, 20, p.y, 30, 0)
    w(0, 'SEQEND', 8, layer)
  }
  const line = (layer: string, a: Vec, b: Vec) => { const A = mm(a), B = mm(b); w(0, 'LINE', 8, layer, 10, A.x, 20, A.y, 30, 0, 11, B.x, 21, B.y, 31, 0) }
  const text = (layer: string, at: Vec, h: number, s: string) => { const P = mm(at); w(0, 'TEXT', 8, layer, 10, P.x, 20, P.y, 30, 0, 40, h, 1, s.replace(/[^\x20-\x7E]/g, '?')) }

  w(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC')
  w(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, 6)
  for (const l of ['1', '4', '7', '8', '14']) w(0, 'LAYER', 2, l, 70, 0, 62, 7, 6, 'CONTINUOUS')
  w(0, 'ENDTAB', 0, 'ENDSEC')

  const visible = style.pieces.filter((p) => p.visible)
  const blockName = (i: number) => `P${String(i + 1).padStart(2, '0')}_${style.pieces[i].name.en.replace(/[^A-Za-z0-9]+/g, '_')}`.slice(0, 31)

  w(0, 'SECTION', 2, 'BLOCKS')
  visible.forEach((p) => {
    const i = style.pieces.indexOf(p)
    w(0, 'BLOCK', 8, '1', 2, blockName(i), 70, 0, 10, 0, 20, 0, 30, 0)
    const sa = seamAllowanceOutline(p)
    poly('1', sa.length ? sa : flatten(p.points, 12), true)
    poly('14', flatten(p.points, 12), true)
    line('7', p.grain[0], p.grain[1])
    for (const it of p.internals) {
      if (it.kind === 'button') { const c = it.pts[0]; const r = (it.size ?? 18) / 20; poly('8', Array.from({ length: 16 }, (_, k) => ({ x: c.x + r * Math.cos((k / 16) * Math.PI * 2), y: c.y + r * Math.sin((k / 16) * Math.PI * 2) })), true) }
      else poly('8', it.pts, false)
    }
    for (const n of p.notches) {
      const e = p.points.findIndex((q) => q.id === n.edge)
      if (e < 0) continue
      const { p: at, tangent } = pointOnEdge(p.points, e, n.t)
      const nrm = { x: tangent.y, y: -tangent.x }
      line('4', at, { x: at.x + nrm.x * 0.6, y: at.y + nrm.y * 0.6 })
    }
    if (p.foldEdge) {
      const fi = p.points.findIndex((q) => q.id === p.foldEdge)
      if (fi >= 0) { const [a, , , b] = edgeControls(p.points, fi); line('8', a, b) }
    }
    const b = bbox(p.points)
    const fab = fabricById(p.material.fabricId)
    text('1', { x: b.cx - 8, y: b.cy }, 8, `Piece Name: ${p.name.en}`)
    text('1', { x: b.cx - 8, y: b.cy + 1.4 }, 6, `Size: ${style.baseSize}`)
    text('1', { x: b.cx - 8, y: b.cy + 2.6 }, 6, `Quantity: ${p.foldEdge ? '1 on fold' : p.cut}`)
    text('1', { x: b.cx - 8, y: b.cy + 3.8 }, 6, `Material: ${fab?.name.en ?? p.material.fabricId}`)
    text('1', { x: b.cx - 8, y: b.cy + 5.0 }, 6, `Style: ${style.name}`)
    w(0, 'ENDBLK', 8, '1')
  })
  w(0, 'ENDSEC')

  w(0, 'SECTION', 2, 'ENTITIES')
  visible.forEach((p) => {
    const i = style.pieces.indexOf(p)
    // place the block at the piece's table transform (translation + rotation; mirrored pieces flip X)
    const origin = mm(toTable(p, { x: 0, y: 0 }))
    w(0, 'INSERT', 8, '1', 2, blockName(i), 10, origin.x, 20, origin.y, 30, 0, 41, p.flipped ? -1 : 1, 42, 1, 50, -p.rotation)
  })
  w(0, 'ENDSEC', 0, 'EOF')
  return out.join('\r\n')
}
