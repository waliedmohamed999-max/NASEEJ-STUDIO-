/**
 * Bridge between menus/shortcuts and the mounted 3D viewport. The viewport
 * registers its implementations on mount; calls are no-ops while it's hidden.
 */
export interface ViewportApi {
  run: () => void
  reset: () => void
  renderPng: (w: number, h: number) => Promise<string | null>
  recordTurntable: (seconds: number) => Promise<Blob | null>
  captureViews: () => Promise<string[]>
}
const noop: ViewportApi = {
  run: () => {}, reset: () => {},
  renderPng: async () => null, recordTurntable: async () => null, captureViews: async () => [],
}
export const simApi: ViewportApi = { ...noop }
/** Partial registrations merge (the scene registers sim controls, the camera registers capture). */
export function registerViewport(api: Partial<ViewportApi> | null) {
  Object.assign(simApi, api ?? noop)
}
