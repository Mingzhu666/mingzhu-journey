# Premium Architecture Upgrade Design

## Goal

Upgrade the portfolio diorama's architecture from low-poly placeholders into a premium, curated 3D scene while preserving the current interaction model.

The result should feel like a high-end night exhibition: each station reads as a designed architectural object, the distant city adds depth without clutter, and the existing overview, tour, station clicks, overlays, car journey, labels, and keyboard navigation continue to work.

## Visual Direction

Use a hybrid direction:

- **Museum diorama for stations.** Each station should feel like a crafted exhibit with a clear plinth, architectural silhouette, restrained detail, and intentional accent lighting.
- **Premium skyline for depth.** Bring back a distant city layer, but replace rough block towers with a cleaner skyline: varied silhouettes, setbacks, crowns, spires, window rhythm, and haze.
- **Dark cinematic restraint.** Keep the current blue-black neon world, but reduce noisy filler. Use cool metal, smoky glass, graphite stone, thin cyan lines, and small warm gold accents.

## Scope

In scope:

- Rebuild the distant `BackgroundCity` into a more sophisticated skyline module.
- Re-enable the distant city only if it improves composition in browser screenshots.
- Upgrade station-adjacent mini towers and pines into more polished architectural dressing.
- Add shared procedural building primitives where they reduce rough repetition.
- Improve material treatment for GLB models through cloned material tuning, not destructive asset edits.
- Redesign procedural station buildings that still read rough, especially `VolunteerTimeline`, `ContactConsole`, and fallback station buildings if visible.
- Keep all current station data, overlays, car movement, view modes, click targets, labels, and journey state.
- Verify with desktop and mobile browser screenshots.

Out of scope:

- Changing portfolio content, station order, or interaction flow.
- Removing existing GLB models unless a replacement is strictly better and still preserves station semantics.
- Adding heavy new runtime dependencies or network-loaded assets.
- Requiring Blender-only manual edits before the app can run.

## Architecture

Keep the current React Three Fiber composition:

- `Scene.jsx` remains the scene root.
- `Stations.jsx` remains responsible for station platform, dressing, labels, and model loading.
- `BackgroundCity.jsx` owns the distant skyline.
- `Environment.jsx` and `Ground.jsx` provide lighting, fog, and stage context.
- Existing station-specific components keep their interaction responsibilities.

Add small local helper components rather than a broad rendering framework. Preferred primitives include:

- stepped tower masses
- beveled or faceted crowns
- thin light strips
- glass facade planes
- roof antennas or spires
- plinth rings and shadow plates
- sparse warm window grids

## Component Design

### Distant Skyline

Replace simple repeated boxes with layered architectural silhouettes:

- Back layer: low-opacity dark massing in fog.
- Mid layer: 10-14 distinct towers with varied height, width, setbacks, crowns, and spires.
- Detail layer: window bands and tiny emissive accents with low opacity.
- Haze layer: subtle horizontal glow behind the station row.

The skyline must sit behind stations and never compete with labels or station models.

### Station Dressing

Replace rough mini towers with refined micro-architecture:

- small plinth buildings around each station
- consistent facade materials
- station-colored accent strips
- warm secondary windows
- fewer pines, only where they frame instead of clutter

The welcome station remains visually clean so the monitor screen stays readable.

### GLB Treatment

Preserve existing GLBs and their interaction hooks. Improve them through cloned material tuning:

- slight color lift for readability
- controlled metalness and roughness
- subtle station-color emissive only where appropriate
- optional shadow and backdrop improvements

No destructive edits to `.glb` files are required for the first implementation pass.

### Procedural Landmark Polish

For procedural stations, favor strong silhouettes over decorative noise:

- Volunteering should read as a memorial civic landmark or timeline monument.
- Contact should read as a premium communication observatory, not a flat HUD.
- Fallback buildings should be polished enough to stand in if a GLB fails.

## Data Flow

No state changes are required.

The existing data flow remains:

- `stations.js` provides station metadata and model settings.
- `useJourney` controls current station, hover, tour/overview mode, driving state, and overlays.
- `Stations.jsx` reads station metadata and renders the station.
- Overlays still activate from the same station/view-mode conditions.

## Error Handling

The visual upgrade should not introduce fragile loading paths.

- If a GLB fails or is missing, existing procedural fallbacks should remain valid.
- New skyline and dressing geometry should be deterministic and local.
- Avoid large texture files or external assets that can fail independently.

## Testing And Verification

Run:

- `node --test src/scene/stationVisuals.test.mjs`
- `node --test src/scene/overviewCamera.test.mjs`
- `npm run build`

Browser verification:

- Desktop overview: all seven stations visible, richer architecture, no black canvas.
- Desktop tour: active station still focuses correctly, overlays still open.
- Mobile overview: composition remains readable and labels do not collide badly.
- Canvas pixel check: screenshot must contain nonblack rendered pixels.

## Acceptance Criteria

- The first-screen overview feels intentionally designed, not rough placeholder geometry.
- Stations still look like the same portfolio sections but more premium.
- The distant skyline adds depth and polish without stealing focus.
- Existing interactions are preserved: station clicks, hover cursor, overview/tour toggle, car travel, overlays, and intro/loader flow.
- No new visual element blocks or pierces the welcome monitor, station labels, or overlay triggers.
