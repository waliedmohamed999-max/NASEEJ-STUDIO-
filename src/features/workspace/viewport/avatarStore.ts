import { create } from 'zustand'

/**
 * Custom avatar (.glb/.gltf) persisted in IndexedDB — model files are far too
 * large for localStorage. The live object URL lives in a small zustand store.
 */
const DB = 'naseej-avatars', STORE = 'files', KEY = 'current'

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((res, rej) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export interface AvatarRecord { blob: Blob; name: string; flip: boolean }

export const useAvatar = create<{
  url: string | null
  name: string | null
  flip: boolean
  loading: boolean
  error: string | null
  set: (p: Partial<{ url: string | null; name: string | null; flip: boolean; loading: boolean; error: string | null }>) => void
}>((set) => ({ url: null, name: null, flip: false, loading: false, error: null, set: (p) => set(p) }))

export async function saveAvatar(file: File) {
  const rec: AvatarRecord = { blob: file, name: file.name, flip: false }
  await tx('readwrite', (s) => s.put(rec, KEY))
  const prev = useAvatar.getState().url
  if (prev) URL.revokeObjectURL(prev)
  useAvatar.getState().set({ url: URL.createObjectURL(file), name: file.name, flip: false, error: null })
}

export async function restoreAvatar() {
  try {
    const rec = await tx<AvatarRecord | undefined>('readonly', (s) => s.get(KEY) as IDBRequest<AvatarRecord | undefined>)
    if (rec && !useAvatar.getState().url) useAvatar.getState().set({ url: URL.createObjectURL(rec.blob), name: rec.name, flip: rec.flip })
  } catch { /* IndexedDB unavailable (private mode) — built-in avatar only */ }
}

export async function setAvatarFlip(flip: boolean) {
  useAvatar.getState().set({ flip })
  try {
    const rec = await tx<AvatarRecord | undefined>('readonly', (s) => s.get(KEY) as IDBRequest<AvatarRecord | undefined>)
    if (rec) await tx('readwrite', (s) => s.put({ ...rec, flip }, KEY))
  } catch { /* ignore */ }
}

export async function clearAvatar() {
  const prev = useAvatar.getState().url
  if (prev) URL.revokeObjectURL(prev)
  useAvatar.getState().set({ url: null, name: null, flip: false, error: null })
  try { await tx('readwrite', (s) => s.delete(KEY)) } catch { /* ignore */ }
}
