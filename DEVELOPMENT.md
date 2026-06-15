# Development Log & Design Notes

This file is the project's "designer's commentary" — it explains *why*
things are the way they are, the order they evolved in, and what's still
open. The `README.md` covers *how to run and customize* the project; this
document covers *the thinking behind it*.

If you're reading this months from now (or showing it to an interviewer),
start here.

---

## 1. Concept

An interactive 3D portfolio diorama. Seven low-poly stations arranged in
a row inside a dark neon world, with a small car that drives along a
winding glowing road in front of them. Each station represents one
section of the portfolio (Welcome → About → Skills → Projects →
Experience → Achievements → Contact). Clicking "Next station" makes the
car drive smoothly to the next stop along the rail. There are two camera
modes: a wide overview that captures the whole diorama like a poster,
and a cinematic tour that follows the car at each station.

The visual reference is the "Interactive Developer Diorama Resume"
poster — low-poly neon cities, glowing roads, futuristic isometric feel.

---

## 2. Tech Stack & Why

| Tool | Why |
| --- | --- |
| **React 18 + Vite** | Standard modern frontend shell. Vite gives near-instant HMR which matters a lot when tuning visuals one screw at a time. |
| **React Three Fiber (R3F)** | Declarative Three.js. Component-based scene composition reads much better than the imperative `scene.add(mesh)` style. Pays off massively when stations are conditional and animated. |
| **drei** | Helpers on top of R3F: `<Text>`, `<Stars>`, `useGLTF`, `useProgress`. Each saved meaningful boilerplate. |
| **@react-three/postprocessing** | Bloom is the single biggest contributor to the "expensive neon" feel. The postprocessing wrapper makes it one component. |
| **GSAP** | Drives the car's animation along the track. Lerp would work but GSAP's easing functions (`power2.inOut`) give the "weighted vehicle" feel. |
| **Zustand** | Tiny global store shared between the 3D scene and the HTML overlay. Avoids prop drilling without bringing Redux complexity. |

Notable deliberate choices:

- **No OrbitControls.** This is a guided experience, not a sandbox. The
  user navigates by clicking stations or arrow keys — the camera is fully
  art-directed.
- **Vite over Next.js.** No SSR needed, no routing complexity, faster
  HMR. Next would be overkill for a single-page interactive scene.

---

## 3. System Architecture

### Data flow

```
            stations.js  ─────────►  Stations.jsx  (renders buildings)
                  │
                  │ provides station list
                  ▼
              path.js  ──────────►  track.js  ──────►  Track.jsx (rail)
            (geometry)              (curve)              Car.jsx (rider)
                  ▲                    ▲
                  │                    │ getPoint(t)
                  │                    │
              CameraRig.jsx ──────────┘
                  ▲
                  │ reads progress/index
                  │
              useJourney  ◄──────  Overlay.jsx  (buttons / progress dots)
              (zustand)
```

Two parallel pipelines feed each other:
- **Geometric pipeline** (`path.js` → `track.js` → renderers) — produces
  the curves, samples them, and renders the visible track + car.
- **State pipeline** (`useJourney` zustand store) — coordinates which
  station is active and whether the car is currently driving.

The 3D scene reads from both. The HTML overlay reads from `useJourney`.
They stay in sync because both observe the same store.

### File map (annotated)

```
src/
  main.jsx                 React entry point
  App.jsx                  Canvas + Overlay + Loader; sets up renderer
  styles.css               UI overlay styling (glassmorphism, controls)

  state/
    useJourney.js          Zustand: currentIndex, isDriving, progress, viewMode

  data/
    stations.js            Per-station copy, color, and model config.
                           Positions are DERIVED from path.js so you don't
                           hand-place stations.

  scene/
    path.js                The two parametric curves: where stations sit,
                           and where the road winds.
    track.js               Builds Catmull-Rom curves from path.js samples;
                           caches station t-values.

    Scene.jsx              Composition root for all 3D objects.
    Environment.jsx        Fog, stars, hemisphere + key lighting + accents.
    Ground.jsx             Floor plate + faint grid.
    AmbientProps.jsx       Trees, rocks, lampposts — deterministic seed.
    Track.jsx              Visible rail: tube + halo + marker lights +
                           flowing energy comets.
    Stations.jsx           Platforms + procedural buildings + GLB loader.
    Car.jsx                Low-poly car, GSAP tween along curve, wheel roll.
    CameraRig.jsx          Two-mode cinematic camera (overview / tour).
    PostFX.jsx             Bloom + Vignette + Chromatic Aberration.
    WelcomeMonitor.jsx     Special component for station 1: idle sway +
                           CanvasTexture screen animation.

  ui/
    Overlay.jsx            HTML chrome: brand, progress dots, view toggle,
                           station card, prev/next buttons.
    Loader.jsx             Fade-out boot screen with hard-timeout fallback.

public/
  models/                  User-supplied .glb files (loaded by stations).
```

---

## 4. Key Design Decisions

### 4.1 Two curves, not one

Originally the car drove on a curve that passed *through* the seven
stations. It worked but read as "buildings sitting in the middle of the
road" — like a tutorial level rather than a portfolio piece.

We later split into **two curves** (`path.js`):
- `stationPosition(i)` — stations sit in a near-row behind the world center.
- `masterPath(s)` — the car drives on a separate winding ribbon in front.

When the car "visits" station `k`, it parks at the point on the rail
where x-aligns with the station's x. So visually: car parked in front
of the building, not on top of it.

This is closer to the reference poster's composition (road in
foreground, stations in midground, props in background).

### 4.2 Parametric path beats hand-placed control points

The track is built from a single math function that combines three sine
harmonics: a low-frequency S-sweep, a mid-frequency asymmetric wave, and
a high-frequency wiggle. Sampling this function at 240 points gives the
Catmull-Rom curve to drive on.

Why? Two reasons:
1. **No "zigzag" feel.** Connecting hand-placed station points with
   Catmull-Rom produces visible tight bends at every station. A pure
   function produces continuous smooth curves.
2. **One knob reshapes everything.** Want a more dramatic road? Change
   `TRACK_Z_MAIN` in `path.js`. Want stations more spread out? Change
   `STATION_X_MIN/MAX`. Geometry, station t-values, and visible rail
   all update automatically.

### 4.3 Zustand instead of context / props

The 3D scene runs inside R3F's `<Canvas>`, which is a separate React
reconciler. State that needs to be shared with the HTML overlay outside
the canvas would otherwise require lifting up + prop drilling
through `App.jsx`. Zustand's external store is read by both worlds with
identical hooks.

Specifically `useJourney` holds:
- `currentIndex` — which station is the target/parked-at
- `isDriving` — whether the GSAP tween is currently running
- `viewMode` — 'overview' or 'tour'
- `progress` — per-frame normalized t along the track (pushed from Car)

### 4.4 Camera rig: lerp-based, two-mode, art-directed

The camera has two modes:
- **Overview** — wide 3/4 isometric shot, computed each frame from
  viewport aspect ratio so all 7 stations + the full track always fit.
  Slow horizontal drift adds parallax without altering composition.
- **Tour** — follow-cam. Sits diagonally above-and-behind the car when
  parked, pulls back and lifts higher while driving.

Every frame the rig computes target position + target lookAt and
**lerps the camera toward them**. Never a hard cut. The eased motion is
what makes mode-switching feel like a film cut between two takes.

### 4.5 Bloom is doing most of the work

The "expensive neon" aesthetic is 90% post-processing:

```
EffectComposer
├── Bloom (threshold 0.4, intensity 0.85, mipmap blur)
├── ChromaticAberration (subtle 0.0003px offset)
└── Vignette (gentle, darkness 0.55)
```

We started with `threshold 0.18` (everything blooms) and it washed out
the diorama. Raising the threshold to `0.4` means only genuinely bright
emissives bloom — track rail, station window glow, headlights, the big
output text — keeping form readable.

### 4.6 Interactive welcome monitor

Station 1 has a special component (`WelcomeMonitor.jsx`) rather than
using the generic `<GLBBuilding>`. It does two things:

1. **Idle sway.** A subtle Y-rotation sine wave (period ~12s) makes the
   monitor feel alive.
2. **Animated screen.** A `CanvasTexture` driven from `useFrame`
   redraws the screen on a 9-second loop: empty → typewriter
   `print("I'm Mingzhu")` with syntax highlighting → `▶ Running…` →
   large glowing output → fade.

We **only redraw the canvas when visible content would change** (new
character typed, phase transition, cursor blink toggle). During the
result phase the canvas isn't redrawn at all — just rendered as-is.
This keeps the animation cheap.

The overlay is positioned via `station.screen.{position,rotation,size}`
in model-local space (pre-scaling), so it scales with the monitor.

### 4.7 GLB loader infrastructure

Each station can either render a procedural placeholder (cones, boxes)
or load a user-supplied `.glb`. The switch is in `stations.js`:

```js
{
  model: '/models/monitor.min.glb',
  modelScale: 4,
  modelRotation: [0, Math.PI, 0],  // optional
  modelOffset: [0, 0, 0],          // optional
}
```

`GLBBuilding` in `Stations.jsx` loads, clones (so each station has its
own instance), enables shadows on every mesh, and applies per-station
scale/rotation/offset. Models are preloaded via `useGLTF.preload()` so
the first visit to each station doesn't stall.

---

## 5. Stations Status

| # | ID | Title | Model | Interactive? | Notes |
|---|----|-------|-------|--------------|-------|
| 01 | welcome | Welcome | `monitor.min.glb` (~620 KB, scale 4.45) | Sway + animated screen | Screen overlay at `[0, 0.55, 0.13]`, size `[0.58, 0.34]`. Tuned by eye. |
| 02 | about | Education | `utas.min.glb` (~14 MB, scale `[4,6,4]`) | Full-screen book overlay | Education content lives in `book.achievements`. |
| 03 | skills | Finance | `finance.min.glb` (~724 KB, scale 4.5) | Full-screen coin overlay | FNZ role + shipped work lives in `role` and `coins`. |
| 04 | projects | Energy | `energy.min.glb` (~636 KB, scale 4.5) | Full-screen reactor overlay | AEMO role + systems live in `role` and `systems`. |
| 05 | experience | Projects | `projects.min.glb` (~12 MB, scale 3.5) | Full-screen showcase overlay | Selected projects live in `projects`. |
| 06 | achievements | Volunteering | — (procedural building) | Subtle sway, lit windows, pulsing top beacon | "Memorial Ziggurat": 3 stacked solid tiers (oldest at bottom), each carrying a memorial plaque + lit window slits. Spire + floating beacon on top. Material/architectural feel, not floating HUD. |
| 07 | contact | Let's Connect | — (procedural HUD) | Armillary sphere rotation, signal rings, tether pulses, scanning button rings | "Contact Console": square pedestal + armillary sphere + 4 round contact buttons in a cross. Edit `contacts` array for real handles. |

**File size note.** The currently shipped public GLBs total ~28 MB after
removing raw exports and backups. `utas.min.glb` and `projects.min.glb`
are now the largest remaining assets; see §7 for the next optimization pass.

---

## 6. Customization Guide

The README covers most of this. The bits worth highlighting here:

### Tuning per-station

Everything per-station lives in `src/data/stations.js`. Each station
object accepts:

```js
{
  id, title, subtitle, description, color, accent,  // metadata
  model: '/models/foo.glb',                          // optional GLB
  modelScale: 4,                                     // number or [x,y,z]
  modelRotation: [0, Math.PI, 0],                    // radians
  modelOffset: [0, 0.5, 0],                          // world offset on top of base lift
  screen: { position, rotation, size },              // welcome-only (interactive overlay)
}
```

### Reshaping the whole layout

`src/scene/path.js` is the single source of truth for diorama geometry.
Top-of-file constants:

- `STATION_X_MIN / MAX` — how far apart stations are spread horizontally.
- `STATION_Z_BASE / WIGGLE` — how far back stations sit + how much they wave.
- `TRACK_X_MIN / MAX` — track extent (bleeds slightly past stations).
- `TRACK_Z_BASE / MAIN / WAVE / DETAIL` — the road's distance from
  stations and its three wave harmonics.

Changing any of these regenerates the curves, station t-values, and
overall composition automatically.

### Tweaking the track look

`src/scene/Track.jsx` defines four visual layers. Adjust:
- `radius` in the inner `TubeGeometry` for rail thickness.
- `radius` in the outer halo for the glow spread.
- `COMET_COUNT` / `COMET_SPEED` / `COMET_COLOR` for the flowing pulses.
- The marker accents inside the `markerPositions.map(...)`.

### Camera

`src/scene/CameraRig.jsx`:
- `OVERVIEW_SPAN` — how much horizontal world the overview captures.
- `OVERVIEW_TILT_RAD` — tilt below horizontal (currently 30°).
- `OVERVIEW_LOOK` — where the camera centers (currently slightly forward
  of world center to balance back/front composition).
- Inside the tour branch, `distance` and `height` control follow-cam.

---

## 7. Performance Notes

### Current bottleneck: remaining large GLB files

Raw Blender exports and backups have been removed from `public/models`.
The remaining bottlenecks are the larger shipped models, especially
`utas.min.glb` and `projects.min.glb`. Three independent fixes, usually
visually invisible at our render scale:

1. **Draco compression** — lossless geometry compression. Export GLB
   with Compression enabled. Typically 80–90% smaller, *zero* visual
   loss.
2. **Texture downscaling** — resize embedded images to 1024×1024 or
   even 512×512 in Blender's Image Editor before exporting. Our models
   render at ~200×150 px on screen; 4K textures are 99% wasted bytes.
3. **Decimate modifier** — if a model has too many tris, Decimate at
   30% ratio. For low-poly aesthetic this often *improves* the look.

After all three: expect the larger models to land closer to 1–3 MB each.
Total shipped model size should comfortably stay under 20 MB.

**Suggested follow-up:** once all 7 GLBs are in, write a one-line
batch script using `gltf-pipeline` to Draco-compress them all:

```bash
npx gltf-pipeline -i input.glb -o output.glb -d
```

### Render performance

- `dpr={[1, 1.75]}` in `<Canvas>` caps retina rendering at 1.75× —
  prevents 5K screens from melting GPUs.
- Shadow map is 2048² with a tight orthographic frustum — only one
  directional light casts shadows.
- The car's CanvasTexture redraws *only when visible content changes*,
  so it's not 60 redraws/s.
- Bloom uses mipmap blur (cheap), not the older kernel approach.

---

## 8. Development History

Chronological log of major iterations, for context.

### v0.1 — Project scaffold
- Vite + React + R3F + drei + postprocessing + GSAP + Zustand wired up.
- Single HTML entry, modular component tree, sensible Canvas defaults.

### v0.2 — Seven stations on a Catmull-Rom track
- Initial zigzag layout (station Z alternating ±4).
- Car drove through stations with GSAP tween.
- Procedural placeholder buildings for all 7 stations.

### v0.3 — Camera & UI
- Lerp-based cinematic camera (tour mode only at first).
- HTML overlay: brand, progress dots, station card, prev/next.
- Keyboard navigation (←/→).

### v0.4 — Visibility pass
- Fog start pushed from z=18 to z=55 (was washing out distant
  stations).
- Added `ambientLight` floor + brighter hemisphere + directional fill
  light.
- Raised Bloom threshold from 0.18 to 0.4 (no more haze on everything).
- Bumped station label fonts up so they read at overview distance.

### v0.5 — Overview / Tour camera modes
- Added `viewMode` state; default 'overview' for poster-like landing.
- Overview camera auto-fits to viewport aspect ratio.
- Top-right segmented control + `V` keyboard shortcut.

### v0.6 — Winding track (parametric path)
- Replaced hand-placed Catmull-Rom-through-stations with a single
  parametric `masterPath(s)` (3 sine harmonics).
- Curve sampled at 240 points for smoothness.
- Eliminated zigzag feel; track became a continuous flowing ribbon.

### v0.7 — GLB loader + Welcome interactivity
- Added `useGLTF`-based `<GLBBuilding>` with per-station scale /
  rotation / offset.
- Station 1 got its own `<WelcomeMonitor>`: idle sway + animated
  CanvasTexture screen (`print("I'm Mingzhu")` typewriter → run →
  big glowing output).
- Stations 1–4 received user-supplied GLBs (monitor, university,
  finance, energy).

### v0.17 — VolunteerTimeline redesign #2: Memorial Ziggurat

User feedback: "05 / 06 / 07 still feel similar — they're all
floating panels with glow effects. Can 06 be an actual BUILDING
with weight and presence?"

Threw out the Crystal Constellation. Replaced with a chunky
architectural structure that visually rhymes with stations 1–4
(the user-supplied GLB buildings) instead of with the other HUD
stations:

- **3 stacked ziggurat tiers.** Square cross-section, decreasing
  width going up (2.2 → 1.7 → 1.25). Each tier is a real solid
  block with `meshStandardMaterial` (not emissive — it responds to
  scene lighting like architecture should).
- **Memorial plaques** embedded into the front face of each tier
  (sized proportionally to the tier). Plaque = metal frame +
  inset dark panel + golden inscribed text (year, org, role) +
  small engraved icon + 4 corner rivets.
- **Architectural under-eave lighting** — a thin emissive accent
  band beneath each tier's overhanging cap, like real recessed
  building lighting.
- **Window slits** — small lit rectangles on the left and right
  sides of each tier, suggesting "lit interior". 6 slits per side
  per tier × 3 tiers.
- **Spire + floating beacon** on top: a 4-sided pyramidal spire
  with a gold sphere at its apex, a bright orb hovering above
  with a halo + thin upward beam (the "memorial flame").
- **Foundation with corner obelisks** — wider base plate with 4
  small obelisks at the corners (capped with pyramids + gold
  tips) plus a stepped approach at the front carrying a small
  inscribed sigil.
- **Header redesigned as a stone tablet** — replaced the
  HUD-style hex frame with a chunky metal/stone tablet with
  diamond ornaments at the ends. Matches the monument vibe.

Net effect: 06 now reads as a CIVIC LANDMARK in the diorama row,
not a holographic interface. The user's volunteer history feels
weighty and permanent, which is the right emotional register for
the content.

### v0.16 — ContactConsole (station 7)

Third and final procedural HUD station, designed to share no
geometry vocabulary with stations 5 or 6 so the trio reads as
three deliberately distinct chapters:

| Station | Card shape       | Layout            | Central object       | Pedestal     | Color   |
| ------- | ---------------- | ----------------- | -------------------- | ------------ | ------- |
| 05      | rectangular      | 2×2 grid          | wireframe cube       | circular     | cyan    |
| 06      | (no card)        | 3D zigzag         | wireframe octahedrons| hexagonal    | gold    |
| 07      | round disc       | 4-way cross       | armillary sphere     | square       | blue    |

Specific design:
- **Square pedestal** with a 5×5 circuit-board grid pattern on top,
  4 corner "bolts" (cylinder + glowing dot), and bright accent
  strips running along each top edge.
- **Armillary sphere** at the hub: three perpendicular torus rings
  (equator + 2 meridians) rotating together, two bright "axis
  poles" on the equator, a pulsing solid bright core inside a soft
  blue glow sphere.
- **Sonar signal rings** continuously expand outward from the
  sphere in the horizontal plane, fading as they grow.
- **Four contact buttons** at the cardinal directions around the
  sphere (left: GitHub, right: LinkedIn, top: Resume, bottom:
  Email). Each is a round disc with a dashed scanning ring on top,
  a thin inner ring, a centered procedural icon, a bold label, and
  a smaller accent-colored value (URL / email / etc). Subtle
  vertical bob.
- **Tether lines** from the sphere to each button, with a white
  pulse traveling outward along each line.
- **Header**: just 4 corner brackets (no full frame) plus a single
  dot-row decoration above the title.

Icons:
- GitHub: a tiny 3-node graph (git branch motif).
- LinkedIn: stylized "in" text.
- Email: envelope outline + V-fold flap.
- Resume: document outline + 3 horizontal text lines.

Honest workflow note for the user: this station is a strong case
for procedural code over a Blender GLB, because every label is
information that changes over time (your real GitHub URL, your
real email) and baking it into a model would mean re-exporting on
every edit. If a specific physical form for the console is
desired, a Blender model could be loaded alongside this component
— the buttons + sphere would render on top.

### v0.15 — VolunteerTimeline redesign: Crystal Constellation

User feedback: "the building looks too similar to 05 (HoloPortfolio).
Same visual vocabulary — hex card frames, central pillar, corner
crosses — even though the layout is different."

Rewrote station 6 from scratch with a fundamentally different visual
language while keeping the color world and glow aesthetic:

- **Crystals instead of cards.** Three wireframe octahedrons floating
  in 3D space, each housing an icon (heart / infinity / code) and a
  bright inner core. No cards, no rectangles.
- **Triangular composition instead of vertical pillar.** The crystals
  sit at `(-1.05, 1.25)`, `(+1.05, 2.45)`, `(-0.35, 3.55)` — a 3D
  zigzag rising upward. Glowing beams connect them in chronological
  order (1→2→3) with a data pulse traveling along each beam.
- **Open typography instead of hex-framed labels.** Role text floats
  in clean space below each crystal: year (with thin underline) →
  org name (flanked by stylized `[ ]` brackets) → role caption. No
  background panel, no notched frame.
- **Hexagonal-prism pedestal** with a "holographic projector"
  pattern on top (bright central disc + concentric pulsing rings).
  Six small accent markers at the hex vertices.
- **Line-flanked header.** Two horizontal accent rules above and
  below the title, joined by vertical connectors and small square
  caps at the corners.
- **Volumetric motes.** 18 deterministic-seeded tiny dots drift
  upward through the air around the crystals, suggesting a real
  holographic projector emitting particles. Fades in/out at top
  and bottom so they appear continuous.

### v0.14 — VolunteerTimeline (station 6)

A second purely procedural HUD station, sharing the same design system
as HoloPortfolio (hex frames, corner crosses, tick rows) but with a
new layout vocabulary: a vertical timeline.

Composition:
- A glowing yellow pillar runs floor-to-header.
- Three role cards sit on alternating sides (left/right/left) at
  fixed heights along the pillar.
- Each card is connected to the pillar by a short beam terminating
  at a glowing node with a halo ring and a small arrowhead.
- Energy pulses travel continuously up the pillar (4 dots, ~3.4s
  per traversal), giving the timeline an "ongoing" feel rather than
  feeling static.
- Header: "VOLUNTEERING" with the same triple-frame + tick rows
  treatment as the project portfolio header.

Each card carries:
- A year badge (small hex pill, top-left)
- Org name (large white text)
- One-line role caption (small grey text)
- A right-side procedural icon (heart / infinity / code)

Icons:
- Heart (Lifeline): two spheres + cone, with a heartbeat pulse via
  `scale = 1 + sin(t * 3) * 0.08`.
- Infinity (Aspect): two horizontal torus rings with a soft wobble.
- Code (The Youngsters): emissive `</>` text glyph.

Helpers (HexFrame, CornerCrosses, TickRow) were duplicated from
HoloPortfolio for now. A future cleanup could factor them into a
shared `hudPrimitives.jsx` if a third procedural station appears.

### v0.13 — Buildings fill the frame (Z-stagger + scale up + flatter camera)

User feedback: "the upper part of the screen is a huge empty dark
area, can the buildings be staggered front-back and made bigger to
dominate the frame?"

Fixed by attacking the empty-sky problem from three angles at once:

- **Buildings scaled up 25%.** All four GLB stations went from
  `modelScale: 4` → `5`; HoloPortfolio went 0.78 → 0.95 to match.
- **Stations Z-staggered.** `STATION_Z_WIGGLE` 0.18 → 1.5 so the row
  has real front-to-back depth (stations alternate ~3 units in Z).
  This creates parallax in the overview shot — closer stations read
  larger, farther ones smaller — and uses the vertical screen space
  the camera was previously spending on empty sky.
- **Track pushed forward** to stay in front of the new front-row
  stations: `TRACK_Z_BASE` 1.2 → 2.5.
- **Camera flattened.** `OVERVIEW_TILT_RAD` 22° → 14° (much less
  bird's-eye), `OVERVIEW_LOOK.y` 1.6 → 2.5 (looking at building
  middles instead of platform tops), `OVERVIEW_SPAN` 40 → 38
  (slightly tighter horizontal crop).

### v0.12 — Contrast pass (sky darker, buildings brighter)

Side-by-side again with the reference, the scene still felt grey and
washed out. Root cause: too much global ambient/hemisphere light was
turning the dark areas mid-tone. Fixed by re-balancing light budgets:

- **Global ambient slashed.** `ambientLight` 0.35 → 0.08,
  `hemisphereLight` 0.7 → 0.25. The spaces between stations are now
  genuinely dark, not "grey-ish dark".
- **Per-station lights tripled.** Key light 1.1 → 3.2, rim 0.9 →
  2.4, bounce 0.5 → 1.3 (active 1.4 → 2.4). The buildings get a real
  spotlight feel — light comes from the station, falls off into
  darkness, neighbors don't bleed in.
- **Track demoted further.** Rail emissive intensity 0.7 → 0.3,
  color shifted to dark slate, tube radius 0.05 → 0.035, halo
  opacity 0.025 → 0.012, comets reduced from 6 to 3 and recoloured
  even cooler. Reads as "subtle path lights" not "neon highway".
- **Tighter composition.** Station X range ±22 → ±19, track range
  ±28 → ±23, `OVERVIEW_SPAN` 48 → 40. Buildings fill ~85% of the
  frame width — they're unambiguously the subject.
- **Bloom dialed back.** Intensity 0.85 → 0.7, threshold 0.4 →
  0.45. Stops bloom from smearing over the buildings and reducing
  contrast.

### v0.11 — Buildings as visual hero

Feedback from a side-by-side with the reference poster: stations were
too small in the frame, the rail was over-glowing, and the diorama
felt cluttered rather than premium. Re-balanced:

- **Camera tightened.** `OVERVIEW_SPAN` 62 → 48, `OVERVIEW_TILT` 30°
  → 22°, look target lowered. Buildings now fill ~80% of the frame
  width.
- **Stations aligned into a true row.** `STATION_Z_WIGGLE` 0.55 →
  0.18; the row reads as a dignified procession instead of a zigzag.
- **Track dimmed dramatically.** Rail emissive intensity 2.4 → 0.7,
  color shifted from saturated cyan to a slate-blue, halo opacity
  0.07 → 0.025, marker accents replaced with subdued dark ticks,
  comet count 10 → 6, size 0.085 → 0.05, color softened to a cooler
  off-white-blue.
- **Per-station 3-light setup.** Each station now has a warm key
  light, a station-color rim/back light, and a small ground bounce
  tinted with its accent color. This is what makes the GLB buildings
  actually READ in the dark scene — they no longer rely on whatever
  emissive happened to bake into the Blender export.
- **Labels smaller.** Station number 0.62 → 0.36, title 0.36 → 0.2.
  Buildings dominate; labels become supporting captions.

### v0.10 — HoloPortfolio visual polish + sizing

- Added `modelScale` support to `HoloPortfolio` (default 0.78) so the
  HUD fits comfortably inside the Tour camera frame.
- Triple-layered card frames (outer faded + main bright + inner faded)
  for HUD-style depth.
- Corner `+` crosses anchored at each card's 4 corners.
- Top-right tick-cluster ornament on every card.
- Bottom carousel-style dot indicator on every card (each card uses a
  different dot count for variety).
- Top-row horizontal divider line between title row and description.
- Center cube upgraded to four nested elements: scanning reticle ring,
  octahedron energy cage, wireframe cube on counter-rotation, solid
  inner cube + pulsing white sphere core.
- Animated **data pulses** travel from the cube along each of the 4
  cross arms (2 pulses per arm, looping with phase offset), giving a
  "data flowing through the network" feel.
- Header upgraded: bigger nested frame pair, side hexagonal accent
  panels with pulsing dots, dashed-line connectors between accents
  and main frame, plus tick-mark rows above/below.

### v0.9 — Holographic Project Portfolio (station 5)

- Built `<HoloPortfolio>` — a fully procedural HUD-style station, no GLB.
- A 2×2 grid of project cards with hexagonal-notched frames, each card
  with number + title + tag pills + description + a unique mini-visual
  on the right (tablet screen, rotating cube, database slab stack,
  transformer-block diagram).
- Central glowing cube where the cards' connecting lines intersect.
  Wireframe cube rotates on two axes; inner solid cube pulses.
- Circular pedestal with 5 concentric arc-rings rotating at different
  speeds + alternating directions, plus a central vertical beam.
- "PROJECT PORTFOLIO" hex-frame header floating above the cards.
- Four footer badges around the pedestal arc: INNOVATION · CODE ·
  CREATIVITY · IMPACT, each with a tiny stylized glyph.
- Idle Y-sway on the whole rig (same vocabulary as the Welcome monitor).
- Added a `component: 'holoPortfolio'` field convention so any station
  can opt into a custom procedural renderer instead of GLB.

Decision: kept this purely procedural rather than baking it into a GLB
because content (project copy/tags) changes more often than visual
structure; in-engine text stays crisp at any zoom; total weight is a
few KB instead of MB; and the rotating/pulsing parts read as
genuinely "running", not pre-rendered.

### v0.8 — Track / station separation
- Pulled the track out from running through stations into a separate
  curve in front of them.
- Stations rearranged into a near-row at z ≈ -0.8.
- Track winds in foreground at z ≈ 0–2 (close enough to feel like the
  car is parked outside each building).
- Track visuals upgraded: thicker rail + outer halo + marker lights +
  10 flowing energy comets along the curve.
- AmbientProps moved off the track's path (back band + far-horizon
  band only).
- Overview composition adjusted: lookAt biased forward to z=0.5 so
  both back row and front rail compose nicely.

---

## 9. Roadmap & Open Questions

### Pending decisions

- **Per-station content rewrite.** Several stations still have
  placeholder copy that doesn't match the model they were given (e.g.
  Skills station says "React · TypeScript…" but now shows a finance
  building). Once all models are placed, do a content sweep.

### Remaining work

- **Stations 5, 6, 7** — awaiting user-supplied GLBs.
- **Interactive elements per station** — only Welcome has one. Each
  station should ideally have its own small "wow moment":
  - University (About): floating diploma / GPA stat / quote
  - Finance (Skills/Finance): ticker scrolling with company logos
  - Energy (Projects): rotating gear / energy flow particles
  - 5, 6, 7: TBD based on theme
- **GLB optimization pass** — see §7. Strongly recommended before
  showing to anyone over a slow connection.
- **Deploy** — Vercel or Netlify. Vite produces a static `dist/` so
  any static host works.

### Nice-to-haves

- Sound design — soft synth tone when arriving at a station, subtle
  ambient hum.
- Mobile responsiveness pass — UI mostly works but car/camera tuned
  for desktop.
- Persistent URL state — `?station=3` so links can deep-link into a
  specific station.
- Accessibility — keyboard focus management, ARIA labels for the
  station nav, prefers-reduced-motion respect.
