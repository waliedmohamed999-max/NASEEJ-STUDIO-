import { create } from 'zustand'
import i18n from '@/i18n'
import { toast } from '@/stores/ui'
import { useWorkspace } from '../store'
import { simApi } from '../viewport/simApi'
import { styleToDxf } from './dxf'
import { exportTiledPdf, slug } from './tiledPdf'

export type ExportKind = 'techpack' | 'lookbook' | 'dxf' | 'tiled' | 'png' | 'png4k' | 'turntable'

/** Print-view overlay state: the tech pack / lookbook render as HTML pages and print to PDF. */
export const useOutput = create<{ mode: 'techpack' | 'lookbook' | null; renders: string[]; open: (m: 'techpack' | 'lookbook', r: string[]) => void; close: () => void }>((set) => ({
  mode: null, renders: [],
  open: (mode, renders) => set({ mode, renders }),
  close: () => set({ mode: null, renders: [] }),
}))

const t = (k: string) => i18n.t(k, { ns: 'ws' })

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const downloadUrl = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove() }

/** The 3D pane must be mounted for renders; open it if needed and give it a moment. */
async function ensure3D() {
  const w = useWorkspace.getState()
  if (!w.panes.includes('3d')) {
    const panes = [...w.panes, '3d' as const]
    w.set({ panes, paneSizes: panes.map(() => 1 / panes.length) })
    await new Promise((r) => setTimeout(r, 1800))
  }
}

export async function runExport(kind: ExportKind): Promise<void> {
  const style = useWorkspace.getState().active()
  if (!style) return
  const base = slug(style.name)
  switch (kind) {
    case 'dxf':
      downloadBlob(new Blob([styleToDxf(style)], { type: 'application/dxf' }), `${base}-${style.baseSize}-aama.dxf`)
      break
    case 'tiled':
      await exportTiledPdf(style)
      break
    case 'png':
    case 'png4k': {
      await ensure3D()
      const url = kind === 'png4k' ? await simApi.renderPng(3840, 2160) : await simApi.renderPng(1920, 1080)
      if (!url) throw new Error(t('out.noRender'))
      downloadUrl(url, `${base}-${kind === 'png4k' ? '4k' : 'render'}.png`)
      break
    }
    case 'turntable': {
      if (typeof MediaRecorder === 'undefined') throw new Error(t('toast.unsupported'))
      await ensure3D()
      toast(t('toast.recording'))
      const blob = await simApi.recordTurntable(8)
      if (!blob) throw new Error(t('toast.unsupported'))
      downloadBlob(blob, `${base}-turntable.webm`)
      break
    }
    case 'techpack':
    case 'lookbook': {
      await ensure3D()
      toast(t('out.renders'))
      const renders = await simApi.captureViews()
      useOutput.getState().open(kind, renders)
      return
    }
  }
  toast(t('toast.exported'))
}
