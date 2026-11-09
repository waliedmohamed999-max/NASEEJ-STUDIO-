import {
  MousePointer2, Spline, PenTool, Waves, CirclePlus, CircleMinus, Scissors, FlipHorizontal2, FoldVertical, Ruler,
  MoveDiagonal, Triangle, AlignVerticalSpaceAround, Rows3, Activity, Hash, ArrowUpDown, RectangleHorizontal, Circle, Link2, Gem, Hand,
  type LucideIcon,
} from 'lucide-react'
import type { Tool } from './store'

export interface ToolDef { id: Tool; icon: LucideIcon; key: string; group: 'edit' | 'construct' | 'mark' | 'nav' }

export const TOOLS: ToolDef[] = [
  { id: 'select', icon: MousePointer2, key: 'V', group: 'edit' },
  { id: 'point', icon: Spline, key: 'A', group: 'edit' },
  { id: 'pen', icon: PenTool, key: 'P', group: 'edit' },
  { id: 'curve', icon: Waves, key: 'C', group: 'edit' },
  { id: 'addPoint', icon: CirclePlus, key: '=', group: 'edit' },
  { id: 'deletePoint', icon: CircleMinus, key: '-', group: 'edit' },
  { id: 'cut', icon: Scissors, key: 'K', group: 'construct' },
  { id: 'mirror', icon: FlipHorizontal2, key: 'M', group: 'construct' },
  { id: 'fold', icon: FoldVertical, key: 'F', group: 'construct' },
  { id: 'sew', icon: Link2, key: 'S', group: 'construct' },
  { id: 'dart', icon: Triangle, key: 'D', group: 'mark' },
  { id: 'pleat', icon: AlignVerticalSpaceAround, key: 'Q', group: 'mark' },
  { id: 'tuck', icon: Rows3, key: 'T', group: 'mark' },
  { id: 'gather', icon: Activity, key: 'W', group: 'mark' },
  { id: 'notch', icon: Hash, key: 'N', group: 'mark' },
  { id: 'grain', icon: ArrowUpDown, key: 'G', group: 'mark' },
  { id: 'buttonhole', icon: RectangleHorizontal, key: 'B', group: 'mark' },
  { id: 'button', icon: Circle, key: 'O', group: 'mark' },
  { id: 'trim', icon: Gem, key: 'Y', group: 'mark' },
  { id: 'measure', icon: MoveDiagonal, key: 'U', group: 'nav' },
  { id: 'ruler', icon: Ruler, key: 'L', group: 'nav' },
  { id: 'hand', icon: Hand, key: 'H', group: 'nav' },
]

export const SHORTCUTS: Array<{ group: 'tools' | 'edit' | 'view'; keys: string; label: string }> = [
  ...TOOLS.map((t) => ({ group: 'tools' as const, keys: t.key, label: `tool.${t.id}` })),
  { group: 'edit', keys: 'Ctrl Z', label: 'menu.undo' },
  { group: 'edit', keys: 'Ctrl Shift Z', label: 'menu.redo' },
  { group: 'edit', keys: 'Ctrl S', label: 'menu.saveVersion' },
  { group: 'edit', keys: 'Ctrl D', label: 'menu.duplicate' },
  { group: 'edit', keys: 'Del', label: 'menu.delete' },
  { group: 'edit', keys: 'Ctrl A', label: 'menu.selectAll' },
  { group: 'edit', keys: 'Ctrl G', label: 'menu.group' },
  { group: 'edit', keys: 'Ctrl Shift G', label: 'menu.ungroup' },
  { group: 'edit', keys: 'R', label: 'insp.rotation' },
  { group: 'edit', keys: '← ↑ → ↓', label: 'insp.position' },
  { group: 'view', keys: 'Alt 1 / 2 / 3', label: 'menu.panes3' },
  { group: 'view', keys: 'Tab', label: 'menu.inspector' },
  { group: 'view', keys: 'Ctrl Enter', label: 'menu.runSim' },
  { group: 'view', keys: 'Ctrl 0', label: 'status_bar.zoom' },
  { group: 'view', keys: '?', label: 'menu.shortcuts' },
]
