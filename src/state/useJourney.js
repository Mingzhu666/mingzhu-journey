import { create } from 'zustand';
import { stations } from '../data/stations.js';

// Tiny global store for the journey.
//
// Why zustand? It lets the UI overlay (regular React) and the 3D scene
// (R3F) read the same state without prop-drilling, and updates from
// either side trigger re-renders on the other. Less wiring, more shipping.

export const useJourney = create((set, get) => ({
  // Index of the station the car is currently heading to (or parked at).
  currentIndex: 0,

  // Whether the car is actively driving to the target right now.
  isDriving: false,

  // Camera view mode:
  //   'overview' — wide cinematic shot framing all 7 stations at once,
  //                like the reference diorama image. Default on load.
  //   'tour'     — cinematic follow-cam that tracks the car closely.
  viewMode: 'overview',

  // True after the loading cover has actually disappeared. Arrival effects
  // that need to be seen on first load wait for this instead of animating
  // behind the cover.
  sceneReady: false,

  // When set to a string like 'welcome', the main diorama is hidden and
  // the corresponding interior scene takes over the canvas. ESC exits.
  interiorRoom: null,

  // ---- Education full-screen book ----
  // When true, a full-screen realistic hardcover book (HTML overlay) takes
  // over the screen at the Education station. It auto-opens on arrival in
  // Tour view and is dismissed with ESC or the close button. While open,
  // the regular overlay suppresses arrow-key navigation so the page-turn
  // controls own the keyboard. See src/ui/EducationBookOverlay.jsx.
  bookOpen: false,

  // ---- Finance full-screen coin ----
  // Parallel to bookOpen: a full-screen "commemorative coin" overlay (HTML)
  // takes over at the Finance station. It auto-opens on arrival in Tour view
  // and is dismissed with ESC or the close button. `activeCoinIndex` is the
  // coin currently facing the visitor. See src/ui/FinanceCoinOverlay.jsx.
  coinOpen: false,
  activeCoinIndex: 0,

  // ---- Energy full-screen reactor console ----
  // Parallel to coinOpen: a full-screen "power console" overlay takes over at
  // the Energy station. It auto-opens on arrival in Tour view and is dismissed
  // with ESC or the close button. `activeSystemIndex` is the system currently
  // online/shown. See src/ui/EnergyReactorOverlay.jsx.
  reactorOpen: false,
  activeSystemIndex: 0,

  // ---- Projects full-screen showcase ----
  // Parallel to coinOpen/reactorOpen: a full-screen holographic showcase takes
  // over at the Projects station. Auto-opens on arrival in Tour view, dismissed
  // with ESC or the close button. `activeShowcaseIndex` is the focused project.
  // See src/ui/ProjectsShowcaseOverlay.jsx.
  showcaseOpen: false,
  activeShowcaseIndex: 0,

  // ---- Contact full-screen uplink hub ----
  // Parallel to the other overlays: a full-screen "uplink" console takes over
  // at the Contact station. Auto-opens on arrival in Tour view, dismissed with
  // ESC or the close button. See src/ui/ConnectOverlay.jsx.
  connectOpen: false,

  // Lightweight interaction state shared by the 3D scene and HTML overlay.
  hoveredStationId: null,
  activeWelcomePersona: 0,
  activeProjectIndex: 0,
  contactFeedback: null,

  // ---- Welcome-station terminal ----
  // The monitor at station 1 behaves like a tiny REPL: visitors type (or
  // tap) a command and the screen "runs" it. State here is shared so the
  // HTML overlay can capture keystrokes while the 3D scene renders them.
  //   welcomeInput  — the buffer the visitor is typing
  //   welcomeMode   — 'idle' | 'result' | 'help' | 'error'
  //   welcomeRunCmd — last command actually run (for the result view)
  //   welcomeError  — the unrecognised command, when mode === 'error'
  //   welcomeRunSeq — bumped on every run; resets the count-up animation
  welcomeInput: '',
  welcomeMode: 'idle',
  welcomeRunCmd: null,
  welcomeError: null,
  welcomeRunSeq: 0,

  setDriving: (isDriving) => set({ isDriving }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSceneReady: (sceneReady = true) => set({ sceneReady }),
  toggleViewMode: () =>
    set({ viewMode: get().viewMode === 'overview' ? 'tour' : 'overview' }),
  enterRoom: (roomId) => set({ interiorRoom: roomId }),
  exitRoom: () => set({ interiorRoom: null }),
  openBook: () => set({ bookOpen: true }),
  closeBook: () => set({ bookOpen: false }),
  openCoin: () => set({ coinOpen: true }),
  closeCoin: () => set({ coinOpen: false }),
  setActiveCoin: (activeCoinIndex) => {
    const coins = stations.find((s) => s.id === 'skills')?.coins ?? [];
    // +1 for the leading "title" coin (the obverse you land on).
    const total = Math.max(1, coins.length + 1);
    const wrapped = ((activeCoinIndex % total) + total) % total;
    set({ activeCoinIndex: wrapped });
  },
  openReactor: () => set({ reactorOpen: true }),
  closeReactor: () => set({ reactorOpen: false }),
  setActiveSystem: (activeSystemIndex) => {
    const systems = stations.find((s) => s.id === 'projects')?.systems ?? [];
    // +1 for the leading "idle/control-room" screen you land on.
    const total = Math.max(1, systems.length + 1);
    const wrapped = ((activeSystemIndex % total) + total) % total;
    set({ activeSystemIndex: wrapped });
  },
  openShowcase: () => set({ showcaseOpen: true }),
  closeShowcase: () => set({ showcaseOpen: false }),
  openConnect: () => set({ connectOpen: true }),
  closeConnect: () => set({ connectOpen: false }),
  setActiveShowcase: (activeShowcaseIndex) => {
    const projects = stations.find((s) => s.id === 'experience')?.projects ?? [];
    const total = Math.max(1, projects.length);
    const wrapped = ((activeShowcaseIndex % total) + total) % total;
    set({ activeShowcaseIndex: wrapped });
  },
  setHoveredStation: (hoveredStationId) => set({ hoveredStationId }),
  cycleWelcomePersona: () => {
    const personas = stations[0]?.personas ?? [];
    const total = Math.max(1, personas.length);
    set({ activeWelcomePersona: (get().activeWelcomePersona + 1) % total });
  },

  // Append a character to the terminal buffer (cap the length so it can't
  // overflow the screen line).
  welcomeType: (ch) => {
    const next = (get().welcomeInput + ch).slice(0, 22);
    set({ welcomeInput: next });
  },
  welcomeBackspace: () =>
    set({ welcomeInput: get().welcomeInput.slice(0, -1) }),
  welcomeSetInput: (welcomeInput) => set({ welcomeInput }),

  // Reset the welcome terminal to its first-load state. Called every time the
  // visitor (re-)arrives at the welcome station so it always opens on the full
  // intro card — no leftover command result from a previous visit.
  welcomeReset: () =>
    set({
      welcomeInput: '',
      welcomeMode: 'idle',
      welcomeRunCmd: null,
      welcomeError: null,
      activeWelcomePersona: 0,
    }),

  // Run a command. Uses the passed string, or the current buffer. Maps the
  // command to a persona facet, or to the help / error views.
  welcomeRun: (raw) => {
    const personas = stations[0]?.personas ?? [];
    const input = String(raw ?? get().welcomeInput).trim().toLowerCase();
    const bump = get().welcomeRunSeq + 1;
    // Always clear the buffer after a run.
    if (!input) {
      set({ welcomeInput: '' });
      return;
    }
    if (input === 'help' || input === 'ls' || input === '?') {
      set({ welcomeInput: '', welcomeMode: 'help', welcomeRunCmd: 'help', welcomeError: null, welcomeRunSeq: bump });
      return;
    }
    if (input === 'clear' || input === 'cls') {
      set({ welcomeInput: '', welcomeMode: 'idle', welcomeRunCmd: null, welcomeError: null, welcomeRunSeq: bump });
      return;
    }
    const idx = personas.findIndex(
      (p) => p.cmd === input || (p.aliases ?? []).includes(input),
    );
    if (idx >= 0) {
      set({
        welcomeInput: '',
        activeWelcomePersona: idx,
        welcomeMode: 'result',
        welcomeRunCmd: personas[idx].cmd ?? input,
        welcomeError: null,
        welcomeRunSeq: bump,
      });
    } else {
      set({ welcomeInput: '', welcomeMode: 'error', welcomeRunCmd: null, welcomeError: input, welcomeRunSeq: bump });
    }
  },
  setActiveProject: (activeProjectIndex) => {
    const projects = stations.find((s) => s.id === 'experience')?.projects ?? [];
    const max = Math.max(0, projects.length - 1);
    set({ activeProjectIndex: Math.max(0, Math.min(max, activeProjectIndex)) });
  },
  triggerContactFeedback: (contactFeedback) => set({ contactFeedback }),
  clearContactFeedback: () => set({ contactFeedback: null }),

  goTo: (index) => {
    const total = stations.length;
    const clamped = Math.max(0, Math.min(total - 1, index));
    if (clamped === get().currentIndex) return;
    set({ currentIndex: clamped });
  },

  next: () => {
    const { currentIndex, isDriving } = get();
    if (isDriving) return;
    if (currentIndex >= stations.length - 1) return;
    set({ currentIndex: currentIndex + 1 });
  },

  prev: () => {
    const { currentIndex, isDriving } = get();
    if (isDriving) return;
    if (currentIndex <= 0) return;
    set({ currentIndex: currentIndex - 1 });
  },
}));
