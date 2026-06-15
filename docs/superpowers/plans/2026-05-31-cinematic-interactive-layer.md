# Cinematic Interactive Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add high-end interactions for the Welcome, Projects, and Contact stations while preserving the existing 3D journey.

**Architecture:** Extend the existing Zustand journey store with a shallow interaction state, then let the current R3F station components subscribe to that state. Keep content in `src/data/stations.js`, keep 3D behavior inside the station components, and keep the HTML overlay limited to focus exit and transient feedback.

**Tech Stack:** React 18, Vite, React Three Fiber, drei, Three.js, Zustand.

---

## File Structure

- Modify `src/state/useJourney.js`: add focus, hover, selected project, Welcome persona, and contact feedback state/actions.
- Modify `src/data/stations.js`: add Welcome persona data and contact action URLs/values.
- Modify `src/ui/Overlay.jsx`: make Escape clear focus before other navigation, add compact exit focus control and contact feedback display.
- Modify `src/scene/Stations.jsx`: set hover state, enter focus for priority stations, clear focus on background click, and boost focused/hovered visuals.
- Modify `src/scene/CameraRig.jsx`: add closer camera framing for focused stations.
- Modify `src/scene/WelcomeMonitor.jsx`: render persona-specific screen animation and cycle persona on click.
- Modify `src/scene/HoloPortfolio.jsx`: make project cards hoverable/selectable and visually focus the active card.
- Modify `src/scene/ContactConsole.jsx`: make contact buttons clickable with real actions and feedback.

## Task 1: Interaction Store And Overlay

**Files:**
- Modify: `src/state/useJourney.js`
- Modify: `src/ui/Overlay.jsx`

- [ ] **Step 1: Add store state and actions**

Add these fields to the Zustand store:

```js
hoveredStationId: null,
focusedStationId: null,
activeWelcomePersona: 0,
activeProjectIndex: 0,
contactFeedback: null,
```

Add these actions:

```js
setHoveredStation: (hoveredStationId) => set({ hoveredStationId }),
focusStation: (focusedStationId) => set({ focusedStationId, viewMode: 'tour' }),
clearFocus: () => set({ focusedStationId: null }),
cycleWelcomePersona: () => {
  const personas = stations[0]?.personas ?? [];
  const total = Math.max(1, personas.length);
  set({ activeWelcomePersona: (get().activeWelcomePersona + 1) % total });
},
setActiveProject: (activeProjectIndex) => {
  const projects = stations.find((s) => s.id === 'experience')?.projects ?? [];
  const max = Math.max(0, projects.length - 1);
  set({ activeProjectIndex: Math.max(0, Math.min(max, activeProjectIndex)) });
},
triggerContactFeedback: (contactFeedback) => set({ contactFeedback }),
clearContactFeedback: () => set({ contactFeedback: null }),
```

Update `goTo`, `next`, and `prev` so station navigation clears focus.

- [ ] **Step 2: Update overlay controls**

In `Overlay.jsx`, subscribe to `focusedStationId`, `contactFeedback`, and `clearFocus`.

Update keyboard handling so `Escape` clears `focusedStationId` first, then handles interior room exit.

Add a compact `Exit focus` button to `.controls` when focused. Add a small feedback line near controls when `contactFeedback?.message` exists.

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: build exits successfully with Vite output.

## Task 2: Station Focus, Hover, And Camera

**Files:**
- Modify: `src/scene/Stations.jsx`
- Modify: `src/scene/CameraRig.jsx`

- [ ] **Step 1: Add priority station click behavior**

In `StationItem`, read `hoveredStationId`, `focusedStationId`, `setHoveredStation`, `focusStation`, and `clearFocus` from the journey store.

For station ids `welcome`, `experience`, and `contact`:

- If clicked while already current, call `focusStation(station.id)`.
- If clicked while not current, keep the existing `goTo(index)` behavior.
- Set hover state on pointer over/out.

- [ ] **Step 2: Add visual focus targets**

Treat a station as emphasized when it is current, hovered, or focused. Increase platform highlight, beam target, and dimming strength for focused mode. Keep non-focused stations visible.

- [ ] **Step 3: Add focused camera framing**

In `CameraRig.jsx`, when `focusedStationId` is set, frame that station with a closer tour-style camera:

```js
const focusedStation = stations.find((s) => s.id === focusedStationId);
if (focusedStation) {
  _targetPos.set(focusedStation.position[0] + sway * 0.45, 3.6, focusedStation.position[2] + 5.2);
  _lookTarget.set(focusedStation.position[0], 1.55, focusedStation.position[2]);
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: build exits successfully.

## Task 3: Welcome Persona Cycling

**Files:**
- Modify: `src/data/stations.js`
- Modify: `src/scene/WelcomeMonitor.jsx`

- [ ] **Step 1: Add persona content**

Add a `personas` array to the Welcome station with four entries:

```js
personas: [
  { label: 'Full-stack Engineer', file: 'stack.ts', code: 'buildProduct({ vue: true, react: true, java: true })', output: 'Full-stack systems with care' },
  { label: 'AI Builder', file: 'ai-lab.py', code: 'ship_ai_tool("learning copilot")', output: 'AI that helps people practice' },
  { label: 'Systems Learner', file: 'store.go', code: 'kv.Set("latency", "low")', output: 'Data structures, Go, Redis ideas' },
  { label: 'Inclusive Mentor', file: 'mentor.md', code: 'support learners with patience', output: 'Clear teaching, calmer teams' },
]
```

- [ ] **Step 2: Feed persona data into screen drawing**

In `WelcomeMonitor.jsx`, read `activeWelcomePersona`, `cycleWelcomePersona`, and `focusedStationId`. Use the selected persona to replace the current hard-coded `CODE`, `OUTPUT`, and filename text.

- [ ] **Step 3: Add click affordance**

When the Welcome monitor is focused, clicking the monitor cycles persona. Stop propagation so station navigation does not run twice.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: build exits successfully.

## Task 4: Projects Card Selection

**Files:**
- Modify: `src/scene/HoloPortfolio.jsx`

- [ ] **Step 1: Add active project state**

Read `activeProjectIndex`, `setActiveProject`, and `focusedStationId` from the journey store. Pass `active`, `muted`, `interactive`, and `onSelect` props into each `ProjectCard`.

- [ ] **Step 2: Add card pointer behavior**

In `ProjectCard`, add local hover state. On click, stop propagation and call `setActiveProject(i)`. On hover, set cursor to pointer.

- [ ] **Step 3: Add active visual treatment**

Active project card should move slightly forward, scale up, and brighten. Non-active cards should dim when the Projects station is focused. Existing animations stay intact.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: build exits successfully.

## Task 5: Contact Real Actions

**Files:**
- Modify: `src/data/stations.js`
- Modify: `src/scene/ContactConsole.jsx`

- [ ] **Step 1: Add contact action fields**

Extend each contact object with `action` and `href` where useful:

```js
{ slot: 'github', label: 'GITHUB', value: 'github.com/mingzhu', action: 'open', href: 'https://github.com/mingzhu' }
{ slot: 'linkedin', label: 'LINKEDIN', value: '/in/mingzhu', action: 'open', href: 'https://www.linkedin.com/in/mingzhu' }
{ slot: 'email', label: 'EMAIL', value: 'hi@mingzhu.dev', action: 'copy', href: 'mailto:hi@mingzhu.dev' }
{ slot: 'resume', label: 'RESUME', value: 'Download PDF', action: 'open', href: '' }
```

- [ ] **Step 2: Add click handling**

In `ContactButton`, call an `onAction(contact)` prop on click. Stop propagation.

In `ContactConsole`, implement:

- `open`: `window.open(contact.href, '_blank', 'noopener,noreferrer')` when `href` exists.
- `copy`: `navigator.clipboard.writeText(contact.value)` when clipboard exists, fallback to `window.location.href = contact.href`.
- Missing `href`: feedback message `Resume not configured yet`.

- [ ] **Step 3: Add feedback pulse**

Use `contactFeedback` to brighten the matching button and show a short label confirmation. Clear feedback with a timeout in the store caller.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: build exits successfully.

## Task 6: Final Verification

**Files:**
- Inspect all modified files.

- [ ] **Step 1: Run production build**

Run: `npm run build`

Expected: build exits successfully.

- [ ] **Step 2: Run local app**

Run: `npm run dev`

Expected: Vite serves the app on a local URL.

- [ ] **Step 3: Browser visual check**

Open the local URL in the in-app browser. Verify:

- Welcome, Projects, and Contact can enter focused mode.
- Escape exits focus.
- Welcome screen changes when clicked in focus.
- Project cards can be selected.
- Contact buttons trigger feedback and do not crash on placeholder resume.
- Existing station navigation still works.

- [ ] **Step 4: Report remaining configuration needs**

Tell the user the real GitHub, LinkedIn, email, and resume values still need to be provided if placeholders remain.
