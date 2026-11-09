import type { Style, Vec } from '../model/types'
import { bbox, flatten, pointOnEdge, seamAllowanceOutline, toTable } from '../model/geometry'

/**
 * 1:1 printable pattern on A4 tiles (vector). Prints at 100 % ("actual size"):
 * a 5 × 5 cm test square on page A1 verifies scale. Tiles overlap by 1 cm with
 * alignment crosses and a row/column grid label on each page.
 */
export async function exportTiledPdf(style: Style) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = 210, PH = 297, M = 10, OVER = 10
  const TW = PW - 2 * M, TH = PH - 2 * M
  const pieces = style.pieces.filter((p) => p.visible)
  // world (table) mm coordinates
  const world = pieces.map((p) => {
    const sa = seamAllowanceOutline(p)
    return {
      p,
      cut: (sa.length ? sa : flatten(p.points, 14)).map((v) => mm(toTable(p, v))),
      sew: flatten(p.points, 14).map((v) => mm(toTable(p, v))),
      grain: p.grain.map((v) => mm(toTable(p, v))) as [Vec, Vec],
      notches: p.notches.map((n) => {
        const i = p.points.findIndex((q) => q.id === n.edge)
        if (i < 0) return null
        const { p: at, tangent } = pointOnEdge(p.points, i, n.t)
        const out = { x: at.x + tangent.y * (p.edgeSA[n.edge] ?? p.seamAllowance), y: at.y - tangent.x * (p.edgeSA[n.edge] ?? p.seamAllowance) }
        return [mm(toTable(p, at)), mm(toTable(p, out))] as [Vec, Vec]
      }).filter(Boolean) as Array<[Vec, Vec]>,
      internals: p.internals.map((it) => it.pts.map((v) => mm(toTable(p, v)))),
      label: mm(toTable(p, { x: bbox(p.points).cx, y: bbox(p.points).cy })),
    }
  })
  const all = world.flatMap((x) => x.cut)
  const b = bbox(all)
  const ox = b.minX - 15, oy = b.minY - 15
  const cols = Math.max(1, Math.ceil((b.w + 30) / (TW - OVER)))
  const rows = Math.max(1, Math.ceil((b.h + 30) / (TH - OVER)))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r || c) doc.addPage()
      const tx = M - (ox + c * (TW - OVER)), ty = M - (oy + r * (TH - OVER))
      const P = (v: Vec) => [v.x + tx, v.y + ty] as const
      const path = (pts: Vec[], closed: boolean) => {
        if (pts.length < 2) return
        const [x0, y0] = P(pts[0])
        const segs = pts.slice(1).map((v, i) => [v.x - pts[i].x, v.y - pts[i].y])
        doc.lines(segs as number[][], x0, y0, [1, 1], 'S', closed)
      }
      // content (jsPDF draws outside the page harmlessly; the 10 mm margin holds the overlap)
      for (const wp of world) {
        doc.setDrawColor(26, 26, 26); doc.setLineWidth(0.35); doc.setLineDashPattern([], 0)
        path(wp.cut, true)
        doc.setLineWidth(0.2); doc.setLineDashPattern([2, 1.2], 0)
        path(wp.sew, true)
        doc.setLineDashPattern([], 0)
        path(wp.grain, false)
        for (const n of wp.notches) path(n, false)
        doc.setDrawColor(110, 106, 99)
        for (const it of wp.internals) path(it, false)
        doc.setFontSize(9); doc.setTextColor(26, 26, 26)
        const [lx, ly] = P(wp.label)
        doc.text(`${wp.p.name.en} — ${style.baseSize} — ${wp.p.foldEdge ? 'CUT 1 ON FOLD' : `CUT ${wp.p.cut}`}`, lx, ly, { align: 'center' })
      }
      // page furniture
      doc.setFillColor(255, 255, 255)
      doc.rect(0, 0, PW, M, 'F'); doc.rect(0, PH - M, PW, M, 'F'); doc.rect(0, 0, M, PH, 'F'); doc.rect(PW - M, 0, M, PH, 'F')
      doc.setDrawColor(176, 141, 87); doc.setLineWidth(0.2); doc.setLineDashPattern([1, 1], 0)
      doc.rect(M, M, TW, TH)
      doc.setLineDashPattern([], 0)
      for (const [x, y] of [[M, M], [PW - M, M], [M, PH - M], [PW - M, PH - M]]) { doc.line(x - 4, y, x + 4, y); doc.line(x, y - 4, x, y + 4) }
      const label = `${String.fromCharCode(65 + r)}${c + 1}`
      doc.setFontSize(8); doc.setTextColor(110, 106, 99)
      doc.text(`NASEEJ STUDIO · ${style.name.replace(/[^\x20-\x7E]/g, '')} · ${label} (row ${r + 1}/${rows}, col ${c + 1}/${cols}) · print at 100% / actual size`, M, M - 3)
      doc.setFontSize(28); doc.setTextColor(226, 221, 210)
      doc.text(label, PW - M - 2, PH - M - 4, { align: 'right' })
      if (!r && !c) {
        doc.setDrawColor(26, 26, 26); doc.setLineWidth(0.3)
        doc.rect(M + 5, PH - M - 60, 50, 50)
        doc.setFontSize(8); doc.setTextColor(26, 26, 26)
        doc.text('5 cm test square', M + 5, PH - M - 62)
      }
    }
  }
  doc.save(`${slug(style.name)}-pattern-1to1.pdf`)
}

const mm = (v: Vec): Vec => ({ x: v.x * 10, y: v.y * 10 })
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/gi, '-').replace(/^-|-$/g, '') || 'style'
