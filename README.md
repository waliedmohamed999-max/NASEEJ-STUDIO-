# NASEEJ STUDIO — From Fiber to Fit

Fashion design studio, textile engineering hub and virtual try-on, in English and Arabic (RTL).

**Stack:** React 19 + TypeScript, Vite, Tailwind CSS v4, shadcn-style UI on Radix, React Three Fiber, Zustand, i18next, Supabase.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build
npm run seed:generate  # regenerate supabase/seed.sql from src/data
```

The app runs with no configuration: without Supabase env vars it uses the bundled seed data and stores projects and looks in `localStorage`.

## Status

| Module | State |
|---|---|
| Landing page | Done, with a live 3D try-on demo, pricing, testimonials and CTA |
| Fabric Library | Done: search, filters, sort, detail view, compare up to 4 |
| Design Studio (Atelier) | Desktop-style workspace — see below |
| Virtual Try-On, avatar | Done: measured 3D avatar, fabric-aware drape, fit heatmap, size recommendation, save/share/compare looks |
| Virtual Try-On, photo | Flow done; uses the in-browser **mock** provider until a real AI provider is configured |
| Virtual Try-On, AR | Camera preview works; MediaPipe pose tracking is next |
| Academy, Marketplace, Community, Dashboard, Try-On API | Preview pages built on seed data; full build next |
| Auth, roles, admin | Schema and RLS are in place; UI is next |

## Atelier workspace (`/studio`)

Full-screen pattern-to-3D workspace in `src/features/workspace/`:

- **model/** — pattern geometry kernel (Bézier pieces in cm, seam-allowance offsetting, split/mirror/unfold/cut), parametric base blocks, 68 templates in 8 categories, EU/US/UK/GCC grade rules, pattern → 3D measurement derivation (`spec.ts`), fabric physics, trims and colour catalogue.
- **panes/** — 2D pattern table (22 tools), flat sketch with annotation layer.
- **viewport/** — R3F viewport, pattern-driven garment, posable avatar, and a position-based cloth solver in a Web Worker (`cloth.worker.ts`).
- **panels/** — template gallery, trims, colourways, moodboard, collection planner.
- **output/** — DXF (AAMA layers), 1:1 tiled PDF, PNG/4K, WebM turntable, and bilingual HTML tech pack + lookbook printed to PDF.

**Real human avatars:** in the 3D pane, upload any realistic human model (.glb/.gltf — e.g. exported from MakeHuman/MPFB, Character Creator or Daz; unclothed or underwear, facing +Z). It is scaled to the size's height, arms are brought from T-pose to A-pose through its skeleton, and its surface is sliced into 1 cm cross-sections whose envelope drives garment fitting and cloth collision. The file is kept in IndexedDB. Imported avatars are static (poses apply to the built-in figure).

Old Design Studio projects are migrated automatically on first open. Press **?** in the workspace for all shortcuts.

**Known limits:** the 3D garment is a single shell sized from pattern girths (pieces are not stitched together in 3D as in CLO/Browzwear); only the body/skirt shell is simulated (no self-collision); grading is proportional rather than per-point rules; DXF holds the base size only (no .RUL); turntable video is WebM.

## Structure

```
src/
  data/            seed data: 21 fabrics, 5 suppliers, 6 garments, 3 courses (bilingual)
  types/           domain types
  lib/
    textures.ts    procedural fabric swatches drawn from weave type, colour and sheen (no image assets)
    textile.ts     GSM/oz, yarn counts (Ne/Nm/Tex/Denier), shrinkage, consumption, cost, fit & size logic
  i18n/            i18next setup + locales/en.json, locales/ar.json
  services/
    supabase.ts    client (null when env vars are missing)
    data/          repository with seed fallback + React hooks
    tryon/         TryOnProvider interface, mock + HTTP providers, registry
  stores/          zustand: studio (with history), try-on, compare, theme, toasts
  features/
    landing/  fabrics/  studio/  tryon/  placeholder/
  components/ui    Button, Slider, Tabs, Dialog, Segmented…
supabase/
  migrations/0001_init.sql   roles, profiles, catalogue, projects, looks, requests, messaging, community, RLS, storage
  seed.sql                   generated; do not edit by hand
```

## How the try-on avatar works

`features/tryon/avatarModel.ts` builds the torso from elliptical cross-sections. Their perimeters match the entered bust, waist and hip measurements (Ramanujan's approximation). Height sets the landmark heights, and weight (via BMI) sets limb thickness. The garment reuses the same rings, scaled by `size chart + garment ease`. The fabric then changes how it hangs:

- **Drape** (1–5) controls hem flare, fold count and depth, and sway speed. Stiff tweed holds its shape; nida crepe falls and moves.
- **Stretch** lets a garment go tighter before the heatmap marks a zone as tight.
- **Sheen / opacity** drive the physical material (satin gloss, velvet sheen, sheer chiffon).

## Plugging in a real try-on AI

1. Implement `TryOnProvider` (`src/services/tryon/types.ts`), or use the generic `httpProvider`.
2. Register it in `src/services/tryon/index.ts`.
3. Set `VITE_TRYON_PROVIDER` (and `VITE_TRYON_API_URL`). Keep vendor API keys server-side, for example in a Supabase Edge Function that proxies the vendor.

## Adding a language

Add `src/i18n/locales/<code>.json`, import it in `src/i18n/index.ts` and append it to `languages` with its `dir`. Content in `src/data` uses `{ en, ar, … }` objects that fall back to English.

## Notes

- PDF tech sheets are generated in English, because jsPDF's built-in fonts can't shape Arabic. Tech packs are usually English anyway. Arabic style names fall back to the style ID.
- Testimonials and supplier names are placeholder content.
