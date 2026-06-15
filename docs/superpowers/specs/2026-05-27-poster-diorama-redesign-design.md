# Poster Diorama Redesign Design

## Goal

Move the portfolio overview toward the supplied reference image: a dark, crisp, neon low-poly city diorama with seven clearly readable station buildings across the first viewport.

## Visual Direction

- The overview should read as a horizontal poster, not a wide empty 3D floor.
- Each station should feel like a small lit city module with its own platform, label beam, signage, and nearby low-poly filler buildings.
- The sky and ground should be deep blue-black, with less grey fog and fewer mid-tone washes.
- Buildings should have stronger silhouettes through local warm key lights, cool rim lights, station-colored underglow, and material brightening for imported GLBs.
- The station labels should mimic the reference: large `01`-style numbers, white uppercase titles, muted subtitle copy, a vertical glowing line, and a dot near the building.

## Scope

This pass changes the visual system only. It keeps the current React, R3F, Zustand, station data, overview/tour navigation, car, and interaction model.

In scope:

- Overview camera tightening and recentering.
- Environment, fog, background, and post-processing changes.
- Station platform and label redesign.
- Procedural low-poly city filler around every station.
- Station signage panels.
- GLB material enhancement for better readability.
- A small pure helper for station poster label formatting, with a Node test.

Out of scope:

- Replacing all GLB models.
- Creating a static generated image background.
- Changing the navigation model or content architecture.

## Verification

- `node --test src/scene/stationVisuals.test.mjs`
- `npm run build`
- Browser screenshot of `http://localhost:5180/` in overview mode, checked for nonblank canvas, visible seven-station composition, clearer buildings, and a look closer to the reference.
