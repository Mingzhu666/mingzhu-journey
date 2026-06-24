import { stationPosition, STATION_COUNT } from '../scene/path.js';

// Station definitions. Positions are derived from the master path in
// `src/scene/path.js` so every station naturally sits on the winding
// curve — you don't have to hand-place them. Edit the `masterPath`
// function in path.js to reshape the entire route at once.
//
// What you DO edit here: per-station copy and color theme.
//
// When you swap in Blender models later, set `model` to the .glb path
// (e.g. '/models/welcome.glb') and the placeholder geometry will be
// replaced automatically (see Stations.jsx for the swap point).

// --- Unified building brightness (单一亮度基准) -----------------------------
// One shared visual-balance for every matte GLB building. The per-station
// values that used to live on each entry (materialLift 1.5–1.92, keyLight
// 1.42–1.78, platformGlow 1.58–2.0 …) were tuned against the old per-station
// warm key lights, which were removed in the unified-lighting pass. Under the
// single global moonlight every building gets IDENTICAL treatment; tweak the
// numbers here and the whole row moves together.
//   windowGlow   — window plane opacity multiplier
//   platformGlow — platform underglow: matte base 0.018 × this ⇒ ~0.031
//
// materialLift is NOT shared: each GLB's textures have different albedo, so
// an identical multiplier renders at different brightness. Per-station lifts
// below were calibrated against MEASURED screen luminance (headless render,
// mean luminance of lit pixels per building) to land every station in the
// same band (~52): welcome 46, education 38, finance 52, projects 62,
// energy 69, volunteer 33, contact 64 at uniform lift 1.9.
const MATTE_BUILDING_BALANCE = {
  windowGlow: 1.18,
  platformGlow: 1.7,
};

const stationDefs = [
  {
    id: 'welcome',
    // URL deep-link slug. Visiting /welcome (or any slug below) loads that
    // building directly in Tour view; the overview/home is '/'. Matching is
    // case-insensitive on read, but the address bar shows this exact casing.
    // See src/state/urlSync.js.
    slug: 'welcome',
    title: 'Welcome',
    subtitle: "Hello, I'm Mingzhu",
    description:
      'Full-stack engineer (6+ yrs) across Vue/TypeScript, React/Next, Java & Go with ELK observability — plus 8+ years of inclusive teaching and volunteering. Click the monitor to explore.',
    color: '#7dd3ff',
    accent: '#22d3ee',
    model: '/models/monitor.min.glb',
    buildingGlow: false,
    // measured 46 @ lift 1.9 → push toward the 52 band
    visualBalance: { ...MATTE_BUILDING_BALANCE, materialLift: 2.2 },
    platformArrival: {
      innerRingOff: 0.13,
      innerRingOn: 0.92,
      outerRingOff: 0.08,
      outerRingOn: 0.68,
      underglowOff: 0.006,
      underglowOn: 0.13,
      stripOff: 0.045,
      stripOn: 0.42,
      pulseOn: 0.32,
    },
    modelScale: 4.45, // tuned by eye — adjust if your replacement model is sized differently
    tiltY: 0.30, // ~17° — angled slightly right so the row isn't all head-on
    // modelRotation: [0, Math.PI, 0], // uncomment if it's facing backwards
    // modelOffset: [0, 0, 0],         // uncomment to fine-tune position
    // Interactive screen overlay placement. All values are in MODEL-LOCAL
    // units (before modelScale is applied), so they feel intuitive: position
    // is where the screen sits on the monitor, size is how big the canvas is
    // on the monitor's face, rotation is for tilt if your screen isn't
    // perfectly facing +Z. Nudge until the animation lines up with the
    // monitor's display surface.
    screen: {
      position: [0, 0.55, 0.13], // just barely in front of the monitor's display face
      rotation: [0, 0, 0],
      size: [0.58, 0.34],
    },
    // Each persona is one "facet" of the intro. In tour view, clicking the
    // monitor cycles through them — the screen "runs" the command, then the
    // hero metric counts up. `metric`/`suffix` drive the count-up animation;
    // `headline` + `sub` are the supporting copy. (See WelcomeMonitor.jsx.)
    // `cmd` is the command a visitor types (or taps) to "run" this facet on
    // the monitor; `aliases` are extra accepted spellings. See WelcomeMonitor.jsx
    // and the welcome* actions in src/state/useJourney.js.
    personas: [
      {
        label: 'Full-stack Engineer',
        cmd: 'whoami',
        aliases: ['stack', 'me'],
        file: 'whoami.ts',
        code: 'whoami()',
        metric: 6,
        suffix: '+ yrs',
        headline: 'full-stack engineering',
        sub: 'Vue · TypeScript · React/Next · Java · Go',
      },
      {
        label: 'Shipping Impact',
        cmd: 'impact',
        aliases: ['metrics', 'results'],
        file: 'impact.ts',
        code: 'measure(impact)',
        metric: 30,
        suffix: '%',
        headline: 'faster feature delivery',
        sub: '+25% team productivity · Pinia + modular design',
      },
      {
        label: 'Engineering Quality',
        cmd: 'coverage',
        aliases: ['quality', 'tests', 'test'],
        file: 'quality.ts',
        code: 'run(coverage)',
        metric: 80,
        suffix: '%',
        headline: 'core test coverage',
        sub: 'ELK observability · reliable releases',
      },
      {
        label: 'Community Volunteer',
        cmd: 'volunteer',
        aliases: ['teach'],
        file: 'volunteer.md',
        code: 'teach(people)',
        metric: 8,
        suffix: '+ yrs',
        headline: 'volunteering & teaching',
        sub: 'seniors · autism support · community learning',
      },
    ],
  },
  {
    id: 'about',
    slug: 'EDUCATION',
    title: 'Education',
    subtitle: 'Academic Journey',
    description:
      'Two postgraduate degrees — an incoming M.S. in Computer Science at Northeastern University (USA, 2026–2028) and a completed Master of IT & Systems at the University of Tasmania (Australia, GPA 6.73/7.0), with leadership and community honours. Click the book to flip through them.',
    color: '#aeb7ff',
    accent: '#8b9cff',
    model: '/models/utas.min.glb',
    buildingGlow: false,
    // darkest matte texture: measured 38 @ lift 1.9, 42 @ 2.6 — the texture
    // has no bright features, so the response is shallow; 3.0 lands ~mid-40s
    visualBalance: { ...MATTE_BUILDING_BALANCE, materialLift: 3.0 },
    modelScale: [4.0, 6.0, 4.0], // UTAS — Y is 6.0 (X/Z stay 4.0), a mild vertical stretch. Bump Y up for taller, down for shorter; set all three equal for undistorted uniform scaling.
    tiltY: -0.28, // ~-16° — leans left
    // modelRotation: [0, Math.PI, 0], // uncomment if the building faces away from the camera
    // modelRotation: [0, Math.PI, 0], // uncomment if facing wrong way
    // modelOffset: [0, 0, 0],
    // A neon "EDUCATION" sign mounted on the front face, covering the UTAS
    // text baked into the model's texture (which can't be edited cleanly).
    // The building is ~3.96 W × 3.0 H × 1.84 D in-scene; UTAS sits upper-left
    // on the front face, so the sign defaults there. NUDGE THESE while watching
    // `npm run dev`:
    //   • position [x, y, z]: x = left(−)/right(+), y = up, z = front depth.
    //   • If the sign lands on the BACK of the building, the front face is −z:
    //     set position z negative (e.g. -0.95) and rotation [0, Math.PI, 0].
    //   • width/height: sign size.  color: neon tint.
    faceSign: {
      text: 'EDUCATION',
      position: [-0.38, 2.28, 0.95],
      rotation: [0, 0, 0],
      width: 2.0,
      height: 0.44,
      color: '#b98cff',
    },
    platformArrival: {
      innerRingOff: 0.12,
      innerRingOn: 0.9,
      outerRingOff: 0.075,
      outerRingOn: 0.64,
      underglowOff: 0.006,
      underglowOn: 0.12,
      stripOff: 0.04,
      stripOn: 0.38,
      pulseOn: 0.3,
    },
    //
    // A physical book sits on the UTAS rooftop. Click it in Tour view to
    // turn the page; each spread is one school achievement. The book seats
    // itself on the roof automatically (height from the model's bounding
    // box) — these knobs just nudge it. See src/scene/EducationBook.jsx.
    // === EDIT achievements → your real ones. Values below are PLACEHOLDERS. ===
    book: {
      school: 'Academic Journey', // shown as the page header (running title)
      // Placement on the rooftop, local to the station:
      //   offset:  [x: +right/-left, y: +up nudge, z: +toward camera]
      //   rotation:[x: lean back/forward, y: turn, z: roll] (radians)
      offset: [0, 1.05, 0],
      scale: 2.1,
      rotation: [-0.55, 0, 0],
      // Each entry = one page spread. `tag` is the page category (shown as
      // the right-page header), `title` the headline, `lines` the details.
      // Two postgraduate degrees, most-recent first — kept in sync with the
      // full-screen tour overlay (src/ui/EducationBookOverlay.jsx).
      achievements: [
        {
          tag: 'Northeastern · USA',
          title: 'M.S. Computer Science',
          year: 'Sep 2026 – Dec 2028',
          lines: [
            'Northeastern University, United States',
            'Systems, algorithms & applied software engineering',
            'Upcoming',
          ],
        },
        {
          tag: 'UTAS · Australia',
          title: 'M. IT & Systems',
          year: 'Jan 2018 – Dec 2019',
          lines: [
            'University of Tasmania · GPA 6.73 / 7.0',
            "Vice-Chancellor's Leadership Award",
            'International Student Shine Awards',
            'City of Hobart Student Ambassador',
          ],
        },
      ],
    },
  },
  {
    id: 'skills',
    slug: 'FNZ',
    title: 'Finance',
    subtitle: 'First Role · FNZ',
    description:
      'Software Engineer Intern at FNZ, a global wealth-management fintech. A commemorative coin is minted for each thing I shipped — arrive to flip through them.',
    color: '#b6c6ff',
    accent: '#8fa3ff',
    // OVERVIEW is unchanged: the finance building stays the landmark here.
    // The full-screen "coin" experience (src/ui/FinanceCoinOverlay.jsx) only
    // takes over once the car arrives in TOUR view — exactly like the
    // Education book. No in-scene object change is needed for that overlay.
    model: '/models/finance.min.glb',
    buildingGlow: false,
    // measured 52 @ lift 1.9 — this is the row's reference brightness
    visualBalance: { ...MATTE_BUILDING_BALANCE, materialLift: 1.9 },
    modelScale: 4.5,
    tiltY: 0.42, // ~24° — biggest tilt, very sideways
    // The role this station represents. Shown on the "title" coin (the obverse
    // you land on) and in the overlay header.
    role: {
      company: 'FNZ',
      title: 'Software Engineer Intern',
      period: 'Mar 2022 – Feb 2023',
      blurb: 'Global wealth-management fintech',
    },
    // Each entry is one minted coin. `mint` is the small top legend, `glyph`
    // the embossed symbol, `title` the headline. `metric`/`suffix`/`metricLabel`
    // drive the count-up (omit when there is no clean number — an `outcome`
    // chip is shown instead). `tags` are the tech; `detail` is the supporting
    // copy. Edit these to refine the wording.
    coins: [
      {
        mint: 'UI SYSTEMS',
        glyph: '◧',
        title: 'React Component Library',
        metric: 50,
        suffix: '%',
        metricLabel: 'UI/UX consistency',
        tags: ['React.js', 'styled-components'],
        detail:
          'Partnered with the in-house design team to build a standardized, reusable component library — buttons, modals, form inputs — that lifted UI/UX consistency and cut design-to-development time.',
      },
      {
        mint: 'DATA LAYER',
        glyph: '⛁',
        title: 'MySQL Stored Procedures',
        outcome: 'Faster queries',
        tags: ['MySQL', 'SQL', 'Indexing'],
        detail:
          'Rewrote inefficient SQL, eliminated unnecessary joins, and refined indexing strategy — reducing query execution time and raising data-processing efficiency and maintainability.',
      },
      {
        mint: 'QUALITY',
        glyph: '✓',
        title: 'TDD & BDD',
        outcome: 'Fewer bugs',
        tags: ['TDD', 'BDD', 'Testing'],
        detail:
          'Drove test-driven and behaviour-driven development to resolve critical UI-rendering and core-functionality bugs — improving stability and significantly reducing user-reported issues.',
      },
      {
        mint: 'API LAYER',
        glyph: '◈',
        title: 'GraphQL API Layer',
        outcome: 'Smaller payloads',
        tags: ['GraphQL', 'API'],
        detail:
          'Introduced GraphQL for the financial-investment interface — designing precise queries and resolvers for selective data fetching, improving retrieval efficiency and flexibility while shrinking network payloads.',
      },
      {
        mint: 'REFACTOR',
        glyph: '⟲',
        title: 'Legacy C# / VB.NET Revamp',
        outcome: 'Less tech debt',
        tags: ['C#', 'VB.NET', 'SOLID'],
        detail:
          'Revamped a legacy C# and VB.NET project with SOLID principles — modularizing business logic, removing hundreds of lines of redundant code, and updating libraries to boost reliability and cut technical debt.',
      },
    ],
  },
  {
    id: 'projects',
    slug: 'AEMO',
    title: 'Energy',
    subtitle: 'Second Role · AEMO',
    description:
      'Software Engineer at the Australian Energy Market Operator. A power console where each step brings one system online — arrive to power up the plant.',
    color: '#ff65f2',
    accent: '#b75cff',
    // OVERVIEW is unchanged: the energy building stays the landmark here. The
    // full-screen "reactor console" (src/ui/EnergyReactorOverlay.jsx) only
    // takes over once the car arrives in TOUR view — same pattern as the
    // Finance coin and Education book. Each system you bring online is one
    // achievement, with its metric counting up like a power readout.
    model: '/models/energy.min.glb',
    buildingGlow: false,
    // bright texture: measured 62 @ lift 1.9 → dial back to the band
    visualBalance: { ...MATTE_BUILDING_BALANCE, materialLift: 1.6 },
    modelScale: 4.5,
    tiltY: -0.18, // ~-10° — slight left tilt
    // The role this station represents. Shown on the idle "control room"
    // screen (the face you land on) and in the overlay header.
    role: {
      company: 'AEMO',
      fullCompany: 'Australian Energy Market Operator',
      title: 'Software Engineer',
      period: 'Jun 2023 – May 2026',
      blurb: "Australia's national energy market operator",
    },
    // Each entry is one system you "bring online". `sys` is the short status
    // label, `glyph` the readout symbol, `title` the headline. `metric` +
    // `suffix` drive the count-up; `prefix` is shown before it ('+', '−', or
    // '' for a level). `metricLabel` describes the number; `tags` are the
    // tech; `detail` is the supporting copy. Edit to refine the wording.
    systems: [
      {
        sys: 'FRONTEND',
        glyph: '⬡',
        title: 'Reactive Vue + TypeScript SPA',
        prefix: '+',
        metric: 30,
        suffix: '%',
        metricLabel: 'faster feature delivery',
        tags: ['Vue.js', 'TypeScript'],
        detail:
          'Built a high-performance reactive single-page app with reusable components and strong typing — speeding iterations and lifting code maintainability and quality.',
      },
      {
        sys: 'OBSERVABILITY',
        glyph: '▤',
        title: 'Log4js + ELK Logging',
        prefix: '−',
        metric: 40,
        suffix: '%',
        metricLabel: 'mean time to resolution',
        tags: ['Log4js', 'ELK', 'Kibana'],
        detail:
          'Stood up Log4js with the ELK stack — capturing API, database and user-interaction data with real-time aggregation and Kibana dashboards, cutting MTTR and production incidents.',
      },
      {
        sys: 'QUALITY',
        glyph: '◎',
        title: 'Jest Framework + Jenkins CI',
        prefix: '',
        metric: 80,
        suffix: '%',
        metricLabel: 'core component coverage',
        tags: ['Jest', 'Jenkins', 'CI'],
        detail:
          'Architected a Jest testing framework around critical business logic and edge cases, and partnered with DevOps on Jenkins CI pipelines to automate test execution and reporting.',
      },
      {
        sys: 'ROUTING',
        glyph: '⇆',
        title: 'Vue Router 4 Refactor',
        prefix: '−',
        metric: 30,
        suffix: '%',
        metricLabel: 'smaller initial bundle',
        tags: ['Vue Router 4', 'Composition API'],
        detail:
          "Refactored the portal's routing to Vue Router 4 with the composition API (useRoute / useRouter) and optimized lazy-loading — shrinking the initial bundle and speeding route resolution.",
      },
      {
        sys: 'STATE',
        glyph: '⬢',
        title: 'Pinia State Management',
        prefix: '+',
        metric: 25,
        suffix: '%',
        metricLabel: 'developer productivity',
        tags: ['Pinia', 'State'],
        detail:
          'Spearheaded Pinia integration with centralized stores for user sessions, exemption data and app settings — an efficient data flow that sped the whole team up.',
      },
    ],
  },
  {
    id: 'experience',
    slug: 'PROJECTS',
    title: 'Projects',
    subtitle: 'Selected Work',
    description:
      'A showcase of recent projects spanning AI, systems, and the web.',
    color: '#35b8ff',
    accent: '#3b82f6',
    // OVERVIEW: replaced the old projects tower with an uploaded Blender
    // building GLB — same family as the Volunteering one (dark scanned
    // structure with baked BLUE neon), Draco-compressed + WebP-optimised from
    // the original ~87 MB export → ~17 MB. Treated exactly like the
    // Volunteering building: a matte GLB that self-illuminates from its own
    // base-color texture so the blue neon glows under Bloom. The `projects`
    // data below is untouched — it still drives the full-screen tour showcase
    // (ProjectsShowcaseOverlay).
    model: '/models/projects_building.min.glb',
    buildingGlow: false,
    // Light up the building's OWN baked blue neon: emissive driven from the
    // base-color texture (see GLBBuilding in Stations.jsx). Higher = more glow.
    emissiveFromAlbedo: 1.0,
    // Sit noticeably dimmer (60%) while the car is elsewhere, easing back to
    // full brightness when the car parks at this station (same as Volunteering).
    awayDim: 0.6,
    // Model albedo is fairly dark, so a high-ish matte-row lift. Nudge this one
    // number up for a brighter building, down for darker.
    visualBalance: { ...MATTE_BUILDING_BALANCE, materialLift: 2.4 },
    // Model is ~1.092 units tall with its base already at y=0. modelScale 5.0
    // → ~5.5 units local, a landmark sized like the Volunteering building.
    modelScale: 5.0,
    platformScale: [1.3, 1, 1.3], // pedestal widened to the building's footprint
    tiltY: 0.2, // ~11° — gentle right tilt for the diorama layering
    // modelOffset: [0, 0, 0], // origin already sits at the base, no lift needed
    // The four projects shown in the full-screen tour showcase
    // (src/ui/ProjectsShowcaseOverlay.jsx). Each has its own bespoke animated
    // visual chosen by `visual`:
    //   'pte'     — Apple-style app UI mock (sidebar + category tiles + EN/Chinese)
    //   'journey' — a mini neon map of THIS portfolio (a car on a track)
    //   'redis'   — a RESP terminal + key cells lighting up
    //   'gpt'     — token attention lines + generated text typing out
    // `kind` is the one-line descriptor, `stack` the tech pills, `highlights`
    // the 2–3 bullet points, `note` an optional easter-egg badge, and `repo`
    // the GitHub URL (renders a "View on GitHub" link in the showcase; omit to
    // hide the link for a project that has no public repo).
    projects: [
      {
        num: '01',
        // Sub-route slug → /PROJECTS/PTE (see src/state/urlSync.js).
        slug: 'PTE',
        title: 'PTE Master',
        kind: 'AI-Driven Adaptive Learning Platform',
        stack: ['Next.js 16', 'React 19', 'TypeScript', 'Framer Motion', 'Tailwind', 'i18n'],
        highlights: [
          'Apple-inspired UI — a collapsible sidebar, animated category views, and detailed module panels covering 20+ PTE modules across Speaking, Writing, Reading & Listening.',
          'Bilingual i18n via React Context + a custom useLanguage hook — seamless English / Chinese switching across every component and the structured course data.',
          'Fluid page transitions and micro-interactions with Framer Motion spring physics — AnimatePresence route transitions and gesture-driven hover / tap.',
        ],
        visual: 'pte',
        repo: 'https://github.com/Mingzhu666/pte-matser',
      },
      {
        num: '02',
        slug: 'JOURNEY',
        title: "Mingzhu's Journey",
        kind: 'Interactive 3D Portfolio',
        stack: ['React', 'Three.js', 'WebGL', 'R3F', 'GSAP', 'Zustand'],
        highlights: [
          'Built an interactive 3D portfolio with React Three Fiber — a car drives a Catmull-Rom spline through 7 neon stations, with Zustand syncing the 3D scene to a live UI overlay without prop-drilling.',
          'Designed a dual-mode cinematic camera (overview + follow-cam) as unit-tested pure functions, with GSAP-eased cut-free transitions and aspect-aware framing for mobile.',
          'Engineered a high-performance rendering pipeline — adaptive quality tiers per device, shadow-map freezing, tuned Bloom post-processing, Draco-compressed models, and WebGL crash recovery.',
        ],
        visual: 'journey',
        note: "You're inside it right now.",
        repo: 'https://github.com/Mingzhu666/mingzhu-journey',
      },
      {
        num: '03',
        slug: 'REDIS',
        title: 'RedisLite',
        kind: 'In-Memory Store · Go',
        stack: ['Go', 'RESP', 'Goroutines', 'AOF', 'TTL'],
        highlights: [
          'A Redis-like in-memory store with a custom RESP parser, core commands, and a goroutine-based concurrent server — many clients connect safely at low latency.',
          'AOF persistence, TTL expiry, and background cleanup workers keep it responsive under load while balancing durability and memory.',
          'Higher throughput by keeping maintenance work off the request path.',
        ],
        visual: 'redis',
        repo: 'https://github.com/Mingzhu666/redisgo',
      },
      {
        num: '04',
        slug: 'NANOGPT',
        title: 'NanoGPT',
        kind: 'Language Model from Scratch · PyTorch',
        stack: ['PyTorch', 'Transformer', 'Attention', 'Tokenizer'],
        highlights: [
          'A GPT-style language model built from scratch — transformer blocks, attention, and tokenization — trained on text like Tiny Shakespeare for sequence modeling and generation.',
          'An inference pipeline for prompt-based, real-time text generation.',
          'Tuned training dynamics and optimization to improve text coherence.',
        ],
        visual: 'gpt',
        repo: 'https://github.com/Mingzhu666/GPT-like-Language-Model-from-Scratch',
      },
    ],
  },
  {
    id: 'achievements',
    slug: 'Volunteer',
    title: 'Volunteering',
    subtitle: 'Community Impact',
    description:
      'Crisis support, autism advocacy, and youth tech mentorship across six years and three organisations.',
    color: '#fde047',
    accent: '#facc15',
    // Uploaded Blender building GLB (Draco-compressed + WebP textures, web-
    // optimised from the original 78 MB export → ~3.8 MB). Replaces the old
    // neon tower. It's a normal matte GLB building now — no `component`
    // override — so it gets the SAME treatment as the other matte stations
    // (Finance / Energy / Projects): global moonlight, the shared platform-
    // arrival rings, tour focus/dim, slide-away, and the floating label. The
    // code-drawn pink "VOLUNTEER" sign + rebuilt neon shaders that belonged to
    // the old tower are gone (per request). The Volunteer Impact Board
    // (roles / noticeBoard below) still shows as a Tour-mode HTML overlay
    // (see src/ui/Overlay.jsx), so no written content is lost.
    model: '/models/volunteer_building.v2.min.glb', // .v2 filename forces a fresh load past the browser cache
    buildingGlow: false,
    // Light up the building's OWN baked red neon: drives emissive from its
    // base-color texture (see GLBBuilding in Stations.jsx), so the dark scanned
    // building reads as a crisp, glowing landmark instead of a muddy mass.
    // Higher = more glow.
    emissiveFromAlbedo: 1.0,
    // Sit noticeably dimmer (60%) while the car is elsewhere, easing back to
    // full brightness when the car parks at this station. Affects both the
    // neon (emissive) and the diffuse, so the whole building darkens. See
    // StationItem in Stations.jsx. 1 = no dimming; lower = darker when away.
    awayDim: 0.6,
    // Model is ~1.144 units tall with its base already at y=0 (origin at the
    // bottom-centre after the GLB's +90° X convert-rotation). modelScale sizes
    // it in the row: 6.0 → ~6.9 units tall, a monumental building that stands
    // taller than its neighbours. No modelOffset needed (base already on y=0).
    modelScale: 6.0,
    platformScale: [1.25, 1, 1.25], // pedestal sized to the building
    // Matte-row visual balance (same family as Finance/Energy). The model's
    // albedo is fairly dark, so materialLift sits a touch high; nudge this one
    // number up for a brighter building, down for darker.
    visualBalance: { ...MATTE_BUILDING_BALANCE, materialLift: 2.4 },
    tiltY: 0.32, // ~18° — monumental building, can tilt freely
    // modelRotation: [0, Math.PI, 0], // uncomment if the building faces backwards
    // Three roles displayed as a vertical timeline. Each card sits on
    // alternating sides of the central glowing pillar. `icon` selects
    // the right-side glyph: 'heart' | 'infinity' | 'code'.
    roles: [
      {
        org: 'Lifeline Tasmania',
        years: '2018 – 2022',
        role: 'Crisis support volunteer',
        icon: 'heart',
      },
      {
        org: 'Aspect',
        years: '2022 – 2026',
        role: 'Autism Spectrum Australia',
        icon: 'infinity',
      },
      {
        org: 'The Youngsters',
        years: '2025 – 2026',
        role: 'Technical support',
        icon: 'code',
      },
    ],
    noticeBoard: [
      {
        org: 'The Youngsters',
        years: '2025 – 2026',
        role: 'Technical Support',
        bullets: [
          'Ran 3–5 weekly 1:1 senior sessions across phones, tablets & PCs — explaining the “why” behind each fix and cutting repeat questions ~40%.',
          'Set up complete home offices and coached Teams, Slack & Zoom for reliable remote work.',
          'Ran library & pop-up help desks and authored simple visual guides so troubleshooting scaled beyond 1:1.',
        ],
      },
      {
        org: 'Aspect',
        years: '2022 – 2026',
        role: 'Autism Spectrum Australia',
        bullets: [
          'Co-facilitated weekly 2-hour groups (6–8 children, Levels 1–3), building independent-living skills with sensory-aware methods.',
          'Created calm, autism-friendly routines — modelling and positive reinforcement for turn-taking, plus gentle de-escalation during overload.',
          'Partnered with staff to keep school, sport & community sessions predictable, inclusive and smoothly paced.',
        ],
      },
      {
        org: 'Lifeline Tasmania',
        years: '2018 – 2022',
        role: 'Volunteer Systems + Community Ops',
        bullets: [
          'Built a web volunteer-management system (onboarding, rosters, hours) — admin from 5+ to <2 hrs/week, data errors down 30%.',
          'Automated reminders, availability matching & reporting on MySQL — one-click compliance cut prep ~90 → <10 min/week.',
          'Supported op-shop & fundraising operations — sorting, merchandising, transactions and event setup.',
        ],
      },
    ],
  },
  {
    id: 'contact',
    slug: 'CONNECT',
    title: "Let's Connect",
    subtitle: "Let's Connect & Collaborate",
    description:
      'Open to roles, collaborations, and conversations. Find me on GitHub, LinkedIn, or just say hi.',
    color: '#8db7ff',
    accent: '#3b82f6',
    // OVERVIEW: a custom "Connect Hub" GLB building marks this final station
    // (uploaded from Blender). It ships its own baked neon — Glow_* emissive
    // materials with KHR_materials_emissive_strength (the CONNECT / GITHUB /
    // LINKEDIN / EMAIL / RESUME panels and screen) — so we keep its materials
    // exactly as authored (`preserveModelMaterials`) and let Bloom make them
    // glow. The functional, clickable links still live in the full-screen
    // ConnectOverlay (src/ui/ConnectOverlay.jsx), which auto-opens on arrival
    // in Tour view and reads the `contacts` array below — so nothing is lost.
    model: '/models/connect.v3.glb', // uploaded replacement model — .v3 filename forces a fresh load past the browser cache
    preserveModelMaterials: true,
    // Self-lit neon building made of ~227 tiny meshes — skip real shadows.
    // Forcing all of them to cast/receive floods the shadow map every frame
    // and causes shadow-acne flicker on the thin glow/text panels in Tour view.
    modelCastShadow: false,
    modelReceiveShadow: false,
    // Per-material emissive dimming (the GLB bakes its own neon). The icon
    // meshes were given their own `Glow_Icon` material in the GLB so they can
    // stay bright while the surrounding structure is toned right down. Keep the
    // ICONS and TEXT at their readable brightness; let everything else on the
    // building only faintly glow. Lower a value for less glow, raise toward 1
    // for more.
    modelEmissiveScale: {
      // Pushed into HDR (final emissive = strength × scale × emissiveScale > 1)
      // so the neon crosses the Bloom luminance threshold (0.72) and gains the
      // same soft halo/glow every OTHER building has. Before, these were scaled
      // so low (~0.5) that the hub rendered as crisp, halo-less lines and looked
      // "not part of the set". e.g. Glow_Text → 5.4 × 0.55 × 0.6 ≈ 1.78.
      Glow_Text: 0.55, // CONNECT / GITHUB / LINKEDIN / EMAIL / RESUME labels
      Glow_Sub: 0.7, // sub-labels (the handle / value lines)
      Glow_Blue: 0.7, // channel icons + corner posts + side/top edge accents
      PanelText: 0.7, // side billboard — title / bars / text
      NeonBlue: 0.7, // side billboard frame
      TipLight: 0.85, // tower spire-tip beacon
    },
    // EDGES / CORNERS ONLY: keep only the 4 vertical corner posts (corner_glow_*)
    // + side/top accents lit. Hide the full front border frame (brd_*), the
    // header underline, the front hlines and the soft blue SURFACE fill
    // (Glow_Blue_Soft) — so the face has no rectangle and no flat fill, just the
    // corner-edge glow. (Also avoids the thin front lines' close-up shimmer.)
    //
    // Also hide the OLD hub's duplicate connect panel — the "previous design"
    // remnant sitting low on the pillar (its dark screen + the neon RESUME /
    // GITHUB / LINKEDIN / EMAIL labels and sub-labels). Those materials belong
    // ONLY to that old panel; the big new billboard uses PanelText / NeonBlue,
    // so it stays. (The panel's icons share the structural Glow_Blue material,
    // so they're hidden by node name in modelHideMeshes below.)
    modelHideMaterials: ['Glow_Blue_Soft', 'Screen_BG', 'Glow_Text', 'Glow_Sub'],
    modelHideMeshes: [
      // The uploaded model ships a 90×90 ground plane that would carpet the
      // entire diorama — hide it so this station's own platform shows through.
      'Ground',
      // The thin white spikes at the top of the tower (read as "antennas"):
      // the four corner spires AND the central spire + its glowing tip beacon
      // (the bright dot at the very top). All removed per request.
      'CornerSpire_-1_-1',
      'CornerSpire_-1_1',
      'CornerSpire_1_-1',
      'CornerSpire_1_1',
      'Spire',
      'SpireTip',
      // The model's own wide square plaza/podium base. Removed per request so
      // the tower + Connect hub stand directly on the station's round platform
      // and the building reads larger instead of being dwarfed by its base.
      'PlazaBottom',
      'PlazaStep',
      'Podium',
      'brd_top',
      'brd_bot',
      'brd_l',
      'brd_r',
      'hdr_uln',
      // GLTFLoader strips '.' from node names, so 'hline_front_1.15' loads as
      // 'hline_front_115' etc.
      'hline_front_115',
      'hline_front_33',
      // The old hub panel's channel icons (next to its RESUME / GITHUB /
      // LINKEDIN / EMAIL labels). Part of the same "previous design" remnant;
      // hidden by node name since they share the structural Glow_Blue material.
      // (GLTFLoader strips '.', so 'ic_gh.001' loads as 'ic_gh001'.)
      'ic_d_t', 'ic_d_b', 'ic_d_l', 'ic_d_r', 'ic_d_1', 'ic_d_2', 'ic_d_3',
      'ic_li_t', 'ic_li_b', 'ic_li_l', 'ic_li_r', 'ic_li_in',
      'ic_e_t', 'ic_e_b', 'ic_e_l', 'ic_e_r', 'ic_e_v1', 'ic_e_v2',
      'ic_gh', 'ic_gh001',
    ],
    buildingGlow: false,
    visualBalance: {
      // Unified-brightness pass: matte underglow base 0.018 × 1.7 ≈ 0.031,
      // same platform brightness as every other station.
      platformGlow: 1.7,
      // Label beam: 0.68 × 0.97 ≈ 0.66, matching the row.
      labelGlow: 0.97,
      // Per-model neon normalizer for the authored emissive text/icons
      // (combined with the modelEmissiveScale map above). Measured 64 @ 0.28,
      // 60 @ 0.22 → 0.19 lands near the 52 band. If the CONNECT HUB text
      // gets hard to read from overview, raise this before anything else.
      // Lifted 0.19 → 0.6 so the hub's neon reaches HDR and crosses the Bloom
      // threshold (0.72) — giving it the same soft glow/halo as the other
      // buildings, instead of the crisp halo-less look it had before.
      emissiveScale: 0.6,
    },
    // No parked throbbing here: the oscillating arrival rings read as "light
    // jitter" up close against this building's static neon text. Rings still
    // appear on arrival, they just hold steady instead of pulsing.
    platformArrival: { pulse: false },
    // ARRIVAL TEXT BRIGHTEN (车到了让建筑物上的字更亮一点): when the car parks at
    // this final station the baked neon TEXT lifts to `multiplier`× its normal
    // emissive, then eases back to exactly its authored brightness once the car
    // drives away (走后恢复一样). Only the listed materials are affected — the
    // CONNECT / GITHUB / LINKEDIN / EMAIL / RESUME labels and their sub-lines.
    // The icons (Glow_Icon) ride along too so the panels read as a set. The
    // ease + restore is handled in Stations.jsx (StationItem useFrame); this is
    // pure data, so tune `multiplier` here. Raise for a stronger pop, lower for
    // a subtler lift; 1 disables the effect.
    arrivalTextBoost: {
      materials: ['Glow_Text', 'Glow_Sub', 'PanelText'],
      multiplier: 2.4,
    },
    // Replacement model. The GLB bakes a +90° X rotation on its root node, so
    // three.js renders it standing upright with its BASE already at Y=0 and
    // already centred in X/Z — no grounding lift or depth offset needed.
    // modelScale 6.5 makes it ~5.6 units tall so its top reaches the label's
    // marker dot (~Y 5.57) — building + "LET'S CONNECT" read as one unit, no
    // floating gap. Raise for bigger / a tighter join, lower to pull it down.
    modelScale: 6.5,
    // X nudges it left/right on the platform (− = left), Y up/down (raise if it
    // looks sunken, lower if it floats), Z toward/away from camera. Centred at 0
    // so the building lines up directly under the overhead "LET'S CONNECT" label.
    modelOffset: [0, 0, 0],
    // Full left lean (~-16°), matching the EDUCATION station, for the poster
    // row. This is now safe even in the close TOUR shot because (a) the panel
    // below sits COPLANAR with the recessed bay floor — no depth gap, no
    // parallax — and (b) the tour camera shoots the panel along its own facing
    // normal (see CameraRig.jsx), so it reads flat & centred regardless of tilt.
    tiltY: -0.28,
    // Neon info panel that recreates the old Connect-hub lettering (the new GLB
    // ships none), styled like the EDUCATION faceSign. Rendered by
    // src/scene/ConnectFaceSign.jsx, in the building's local space; +z faces
    // forward. Measured from the GLB: the recessed display-bay FLOOR sits at
    // z≈1.08, its centre at X≈-0.065 / Y≈2.83, and the frame opening is ~2.34 ×
    // 3.06. The panel is placed COPLANAR with that floor (z 1.13 = floor + a hair
    // so it doesn't z-fight) — it now reads as the screen's own content with no
    // depth gap, so it stays centred on the bay from every camera angle. Sized
    // smaller than the frame opening so it sits inside with an even margin.
    connectPanel: {
      title: 'CONNECT HUB',
      rows: [
        { icon: 'doc', label: 'RESUME', sub: 'Download PDF' },
        { icon: 'github', label: 'GITHUB', sub: 'View Profile' },
        { icon: 'linkedin', label: 'LINKEDIN', sub: 'View Profile' },
        { icon: 'mail', label: 'EMAIL', sub: 'Send Email' },
      ],
      position: [-0.065, 2.83, 1.13],
      rotation: [0, 0, 0],
      width: 1.95,
      height: 2.6,
      // No dark cover plate — the building already has its own recessed display
      // bay, so the bare neon text/icons sit directly on it (one layer, not two).
      backing: false,
    },
    // The 4 round buttons arranged in a cross around the central
    // armillary sphere. `slot` controls position:
    //   github   — left of sphere
    //   linkedin — right of sphere
    //   resume   — above sphere (label sits above its button)
    //   email    — below sphere
    // Edit `value` to your real handles before shipping.
    contacts: [
      {
        slot: 'github',
        label: 'GITHUB',
        value: 'github.com/Mingzhu666',
        action: 'open',
        href: 'https://github.com/Mingzhu666',
      },
      {
        slot: 'linkedin',
        label: 'LINKEDIN',
        value: '/in/mingzhuwan',
        action: 'open',
        href: 'https://www.linkedin.com/in/mingzhuwan',
      },
      {
        slot: 'email',
        label: 'EMAIL',
        value: 'mingzhuwan@gmail.com',
        action: 'copy',
        href: 'mailto:mingzhuwan@gmail.com',
      },
      {
        slot: 'resume',
        label: 'RESUME',
        value: 'Download PDF',
        action: 'open',
        href: '/resume.pdf', // placeholder PDF in public/ — swap for your real résumé
      },
    ],
  },
];

if (stationDefs.length !== STATION_COUNT) {
  // Helpful dev-time guard: keep stationDefs and STATION_COUNT in sync.
  // eslint-disable-next-line no-console
  console.warn(
    `[stations] STATION_COUNT (${STATION_COUNT}) does not match stationDefs length (${stationDefs.length}). ` +
      'Update STATION_COUNT in src/scene/path.js or trim stationDefs to match.',
  );
}

export const stations = stationDefs.map((def, i) => {
  const pos = stationPosition(i);
  return {
    ...def,
    index: i + 1,
    position: [pos.x, pos.y, pos.z],
  };
});
