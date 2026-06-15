# Cinematic Interactive Layer Design

Date: 2026-05-31

## Goal

Add a high-end interaction layer to the existing 3D portfolio without turning
the experience into a cluttered mini-game. The first implementation focuses on
three high-value stations: Welcome, Projects, and Contact. Other stations keep
the current navigation behavior and receive only shared baseline feedback.

The target feel is a hybrid of cinematic presentation and useful portfolio
actions: the site should feel premium when touched, but every major interaction
should help visitors understand Mingzhu's work or get in touch.

## Current Context

The app is a React + Vite + React Three Fiber portfolio. It already has:

- A 3D diorama with seven stations and a track-riding car.
- Overview and Tour camera modes.
- Station click navigation through Zustand state.
- Animated station-specific models/components:
  - Welcome monitor with an animated code screen.
  - Projects HUD with four project cards.
  - Volunteering ziggurat timeline.
  - Contact console with four circular contact controls.
- Keyboard controls for station movement and view mode switching.

The new work should extend these existing components rather than introduce a
separate app shell or a competing UI pattern.

## Interaction Principles

1. Interactions should be visible before they are required.
   Hover/focus affordances must make clickable 3D elements feel intentional.

2. Cinematic focus should clarify, not hide.
   When a focused interaction is active, nearby content may dim and the camera
   may move closer, but the user must always have a clear way to exit.

3. Useful actions should complete with feedback.
   Contact actions should show confirmation, project selection should show a
   clear active state, and Welcome cycling should visibly change the screen.

4. The first version should be advanced but bounded.
   Welcome, Projects, and Contact get deeper behavior. The remaining stations
   receive only shared baseline hover/click polish until later phases.

## Scope

### In Scope

- Add shared interaction state to the journey store.
- Add baseline station hover/focus affordances.
- Add focused interaction mode for the three priority stations.
- Make the Welcome monitor cycle through several persona/code screens.
- Make the Projects HUD cards selectable and visually focused.
- Make Contact console controls trigger real actions and visual feedback.
- Add keyboard escape behavior for leaving focused interaction mode.
- Preserve existing station navigation and view mode controls.
- Verify build and run the app for visual inspection.

### Out of Scope

- Full interactive behavior for Education, Finance, Energy, or Volunteering.
- Audio.
- Physics, first-person walking, or free camera exploration.
- A large HTML overlay case-study system.
- Replacing existing GLB models.
- Backend, analytics, or form submission.

## State Model

Extend `src/state/useJourney.js` with a small interaction state surface:

- `hoveredStationId`: station currently hovered in the 3D scene.
- `focusedStationId`: station currently in cinematic interaction focus.
- `activeWelcomePersona`: selected Welcome screen/persona id.
- `activeProjectIndex`: selected project card index for the Projects station.
- `contactFeedback`: recent contact action feedback, such as copied/opened.

Expected actions:

- `setHoveredStation(id | null)`
- `focusStation(id)`
- `clearFocus()`
- `cycleWelcomePersona()`
- `setActiveProject(index)`
- `triggerContactFeedback(payload)`
- `clearContactFeedback()`

The state remains intentionally shallow. Station content stays in
`src/data/stations.js`; interaction state stores only the current selection or
feedback.

## Baseline Station Feedback

All stations should gain a shared hover affordance:

- Platform ring and underglow become slightly brighter.
- The floating number/title or station sign can pulse subtly.
- Cursor changes remain active.
- Clicking a non-priority station keeps the existing `goTo(index)` behavior.

For priority stations, clicking while already on that station should enter
focused interaction mode instead of only re-selecting the station.

## Cinematic Focus Behavior

Focused mode is a lightweight state, not a separate route.

When `focusedStationId` is set:

- The focused station receives stronger beam/glow treatment.
- Non-focused stations dim more than ordinary Tour mode, but remain present.
- Camera moves slightly closer to the focused station.
- Overlay controls should remain usable, with an obvious exit affordance.
- `Escape` clears focus.
- Clicking empty space may clear focus if this can be added without disrupting
  existing station clicks.

The first implementation can reuse and extend the current Tour-mode spotlight
logic in `Stations.jsx` and `CameraRig.jsx`.

## Welcome Interaction

The Welcome monitor currently animates a single code sequence. It should become
a selectable/cycling identity display.

Behavior:

- Clicking the monitor or its screen while focused cycles to the next persona.
- Personas are configured in `stations.js`, for example:
  - Full-stack engineer
  - AI builder
  - Systems learner
  - Inclusive teaching / mentorship
- The screen animation uses the active persona to change code text, output
  label, accent line, or status message.
- Hover/focus makes the screen look touchable through a scanline, outline, or
  brighter glow.

Primary value:

- Visitors quickly understand the candidate identity, not just a decorative
  greeting.

## Projects Interaction

The Projects HUD currently displays four project cards. It should support
card-level focus.

Behavior:

- Hovering a card creates a clear local highlight.
- Clicking a card sets `activeProjectIndex`.
- The active card appears closer/brighter/larger.
- Non-active cards dim slightly and move back enough to make selection obvious.
- The selected card shows richer detail using existing project data:
  description, tags, and visual type.

Implementation note:

- The existing `HoloPortfolio.jsx` component already maps over four project
  cards. The change should keep that structure and pass active/hover state into
  each card rather than rewriting the whole HUD.

Primary value:

- Projects become inspectable instead of only decorative.

## Contact Interaction

The Contact console currently renders four circular controls. They should
become real actions with confirmation feedback.

Behavior:

- GitHub opens the configured GitHub URL.
- LinkedIn opens the configured LinkedIn URL.
- Email copies the email address to the clipboard, with fallback to a
  `mailto:` link if clipboard access is unavailable.
- Resume opens or downloads the configured resume URL if provided; otherwise it
  shows a clear "resume not configured" feedback state.
- Each action triggers a brief visual confirmation: pulse, signal burst, label
  change, or central hub transmission.

Data needs:

- Real GitHub URL.
- Real LinkedIn URL.
- Real email address.
- Resume PDF path or decision to leave resume disabled for now.

Until real values are provided, the implementation should keep placeholders but
make the data shape ready.

Primary value:

- Contact is not just visual; it converts visitor intent into action.

## Overlay Behavior

The HTML overlay should stay minimal. It should not become a large instruction
panel.

Needed changes:

- When focused, show a compact `Exit focus` control in the existing controls
  area.
- Contact feedback may appear as a small transient status line near the bottom
  controls or near the contact station only.
- Keyboard behavior:
  - `Escape` clears focus first.
  - If no focus is active and an interior room is ever re-enabled, Escape keeps
    its current room-exit meaning.

## Error Handling

- Clipboard failure should fall back to opening a `mailto:` URL for email.
- Missing contact URLs should not throw; they should show a brief unavailable
  feedback state.
- Project index should be clamped to the available project list.
- Focus state should clear safely if the current station changes.

## Testing And Verification

Manual verification:

- Hover each station and confirm shared feedback is visible.
- Click Welcome, Projects, and Contact while active and confirm focus behavior.
- Press Escape from focused mode.
- Click each project card and confirm the active project changes.
- Click each contact control and confirm feedback/action.
- Verify mobile and desktop layouts do not overlap.

Automated or build verification:

- Run `npm run build`.
- Existing unit tests can remain as-is unless state helpers are extracted.
- If state helper logic becomes non-trivial, add focused tests around clamping
  and action transitions.

## Implementation Order

1. Add interaction state and overlay focus exit behavior.
2. Add shared station hover/focus feedback.
3. Add Welcome persona cycling.
4. Add Projects card selection/focus.
5. Add Contact real actions and feedback.
6. Tune camera/focus treatment.
7. Build and visually verify.

## Open Configuration Needed

The implementation can start with placeholders, but final polish needs:

- GitHub URL.
- LinkedIn URL.
- Email address.
- Resume PDF path or confirmation that resume stays unavailable.
- Preferred persona labels for the Welcome station if the defaults need edits.
