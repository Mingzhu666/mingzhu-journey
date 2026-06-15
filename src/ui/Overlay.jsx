import { useEffect } from 'react';
import { stations } from '../data/stations.js';
import { useJourney } from '../state/useJourney.js';
import { useDeviceProfile } from '../state/useDeviceProfile.js';

// The HTML overlay that floats above the 3D canvas. It pulls the
// current station's content from `stations.js` and reflects driving
// state from the Zustand store, so the UI and the 3D scene never get
// out of sync.

export default function Overlay() {
  const currentIndex = useJourney((s) => s.currentIndex);
  const isDriving = useJourney((s) => s.isDriving);
  const viewMode = useJourney((s) => s.viewMode);
  const interiorRoom = useJourney((s) => s.interiorRoom);
  const bookOpen = useJourney((s) => s.bookOpen);
  const coinOpen = useJourney((s) => s.coinOpen);
  const reactorOpen = useJourney((s) => s.reactorOpen);
  const showcaseOpen = useJourney((s) => s.showcaseOpen);
  const connectOpen = useJourney((s) => s.connectOpen);
  const contactFeedback = useJourney((s) => s.contactFeedback);
  const next = useJourney((s) => s.next);
  const prev = useJourney((s) => s.prev);
  const goTo = useJourney((s) => s.goTo);
  const setViewMode = useJourney((s) => s.setViewMode);
  const exitRoom = useJourney((s) => s.exitRoom);
  const welcomeType = useJourney((s) => s.welcomeType);
  const welcomeBackspace = useJourney((s) => s.welcomeBackspace);
  const welcomeRun = useJourney((s) => s.welcomeRun);
  const { isTouch } = useDeviceProfile();

  const atFirst = currentIndex === 0;
  const atLast = currentIndex === stations.length - 1;
  const inInterior = Boolean(interiorRoom);
  const currentStation = stations[currentIndex];
  const showVolunteerBoard =
    viewMode === 'tour' && !isDriving && currentStation?.id === 'achievements';

  // The welcome monitor behaves like a terminal. While we're parked at
  // station 1 in tour mode, keystrokes type into it instead of driving
  // shortcuts (arrows still navigate so visitors can leave).
  const welcomeTerminalActive = viewMode === 'tour' && currentIndex === 0;

  // Keyboard navigation — arrows for stations, V to toggle view mode,
  // ESC to exit interior room. Plus terminal capture on the welcome station.
  useEffect(() => {
    const onKey = (e) => {
      // While a full-screen overlay is open (Education book, Finance coin,
      // Energy reactor, Projects showcase, or the Connect hub) it owns the
      // keyboard (ESC closes / arrows turn). Don't let station nav fire here,
      // or an arrow press would leave the station and snap it shut.
      if (bookOpen || coinOpen || reactorOpen || showcaseOpen || connectOpen) return;

      if (e.key === 'Escape' && inInterior) {
        exitRoom();
        return;
      }
      // Disable normal navigation while inside a room
      if (inInterior) return;

      // ---- Enter ⏎ starts the tour ----
      // While in the wide "overview" camera, pressing Enter drops the visitor
      // into the cinematic tour so the current station's interaction opens —
      // no need to click the Tour toggle. preventDefault() stops a focused
      // toggle/nav button from also firing its own click. We only do this in
      // overview, so the welcome terminal (tour-only, station 1) still owns
      // Enter once you're inside.
      if (e.key === 'Enter' && viewMode === 'overview') {
        e.preventDefault();
        setViewMode('tour');
        return;
      }

      // ---- ESC ⎋ exits the tour ----
      // Mirror of Enter. While in the cinematic tour, ESC pulls the camera
      // back out to the wide overview. A full-screen station overlay (book,
      // coin, reactor, showcase, connect) owns ESC to close itself first —
      // those return at the top of this handler — so this only fires on the
      // plain tour stations (welcome, achievements). Press ESC to close an
      // overlay, ESC again to leave the tour.
      if (e.key === 'Escape' && viewMode === 'tour') {
        e.preventDefault();
        setViewMode('overview');
        return;
      }

      // ---- Welcome terminal capture ----
      if (welcomeTerminalActive && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'Enter') {
          e.preventDefault();
          welcomeRun();
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          welcomeBackspace();
          return;
        }
        // Printable command characters go into the buffer. This also
        // swallows 'v', so it won't toggle the view mid-command.
        if (e.key.length === 1 && /[a-zA-Z0-9 _?-]/.test(e.key)) {
          e.preventDefault();
          welcomeType(e.key.toLowerCase());
          return;
        }
        // Arrows fall through below so visitors can still navigate away.
      }

      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'v' || e.key === 'V') {
        setViewMode(viewMode === 'overview' ? 'tour' : 'overview');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    next,
    prev,
    setViewMode,
    viewMode,
    inInterior,
    exitRoom,
    welcomeTerminalActive,
    welcomeRun,
    welcomeBackspace,
    welcomeType,
    bookOpen,
    coinOpen,
    reactorOpen,
    showcaseOpen,
    connectOpen,
  ]);

  // ---- Touch: horizontal swipe drives the car between stations ----
  // Mirrors the ← / → arrow keys for touch visitors. The track runs left↔right,
  // so a horizontal swipe matches the car's motion. We read live state from the
  // store inside the handler (not deps) so it stays a single passive listener
  // for the whole session and never fights the overlays: while any full-screen
  // station overlay is open (they own their own swipe), or while driving / in a
  // room, station-nav swipes are ignored. Short taps (3D chips, buttons) never
  // reach the threshold.
  useEffect(() => {
    let s = null;
    const onStart = (e) => {
      const t = e.touches && e.touches[0];
      s = t ? { x: t.clientX, y: t.clientY, multi: e.touches.length > 1 } : null;
    };
    const onEnd = (e) => {
      const st = s;
      s = null;
      if (!st || st.multi) return;
      const js = useJourney.getState();
      if (
        js.bookOpen ||
        js.coinOpen ||
        js.reactorOpen ||
        js.showcaseOpen ||
        js.connectOpen ||
        js.interiorRoom ||
        js.isDriving
      ) {
        return;
      }
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - st.x;
      const dy = t.clientY - st.y;
      // Horizontal intent only: clear horizontal travel that beats vertical.
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) js.next();
      else js.prev();
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  // ---- Interior room mode: minimal UI overlay ----
  if (inInterior) {
    return (
      <div className="ui interior" aria-hidden={false}>
        <div className="brand">
          <span className="dot" aria-hidden />
          <span>
            <span className="name">Mingzhu</span> · Welcome Room
          </span>
        </div>
        <div className="controls">
          <button className="primary" onClick={exitRoom} aria-label="Exit room (ESC)">
            ← Exit room
            <kbd className="inline-kbd">ESC</kbd>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`ui ${viewMode}`} aria-hidden={false}>
      {/* Brand (top-left) */}
      <div className="brand">
        <span className="dot" aria-hidden />
        <span>
          <span className="name">Mingzhu</span> · Portfolio
        </span>
      </div>

      {/* Progress (top-center) */}
      <nav className="progress" aria-label="Station navigation">
        {stations.map((s, i) => (
          <button
            key={s.id}
            className={i === currentIndex ? 'active' : ''}
            onClick={() => goTo(i)}
            disabled={isDriving}
            aria-label={`Go to station ${s.index}: ${s.title}`}
          >
            <span className="pdot" />
            <span className="plabel">{s.title}</span>
          </button>
        ))}
      </nav>

      {/* View mode toggle (top-right) */}
      <div className="view-toggle" role="tablist" aria-label="Camera view mode">
        <button
          role="tab"
          aria-selected={viewMode === 'overview'}
          className={viewMode === 'overview' ? 'active' : ''}
          onClick={() => setViewMode('overview')}
        >
          Overview
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'tour'}
          className={viewMode === 'tour' ? 'active' : ''}
          onClick={() => setViewMode('tour')}
        >
          Tour
        </button>
      </div>

      {/* Enter-to-tour hint (overview only) — premium, contextual cue that
          pressing Enter drops you into the cinematic tour for this station.
          Clicking it does the same thing. */}
      {viewMode === 'overview' && !isDriving && (
        <button
          type="button"
          className="kbd-hint kbd-hint--enter"
          onClick={() => setViewMode('tour')}
          aria-label={`Press Enter to explore ${currentStation?.title ?? 'this station'}`}
        >
          <span className="kbd-hint__key" aria-hidden="true">
            <span className="kbd-hint__keylabel">{isTouch ? 'Tap' : 'Enter'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 10 4 15 9 20" />
              <path d="M20 4v7a4 4 0 0 1-4 4H4" />
            </svg>
          </span>
          <span className="kbd-hint__label">
            Explore <b>{currentStation?.title ?? 'this station'}</b>
          </span>
        </button>
      )}

      {/* ESC-to-exit hint (tour only, when no full-screen station overlay is
          open — those show their own ESC-to-close cue). Mirror of the Enter
          hint: pressing ESC (or clicking) pulls back out to the overview. */}
      {viewMode === 'tour' &&
        !isDriving &&
        !bookOpen &&
        !coinOpen &&
        !reactorOpen &&
        !showcaseOpen &&
        !connectOpen && (
          <button
            type="button"
            className="kbd-hint kbd-hint--exit"
            onClick={() => setViewMode('overview')}
            aria-label="Press Escape to return to the overview"
          >
            <span className="kbd-hint__key" aria-hidden="true">
              <span className="kbd-hint__keylabel">{isTouch ? 'Tap' : 'Esc'}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </span>
            <span className="kbd-hint__label">
              Back to <b>overview</b>
            </span>
          </button>
        )}

      {showVolunteerBoard && <VolunteerImpactBoard station={currentStation} />}

      {/* Controls (bottom-right) — station navigation.
          ("Enter room" button removed; interior welcome room is disabled.) */}
      <div className="controls">
        {contactFeedback?.message && (
          <div className={`contact-feedback ${contactFeedback.kind ?? 'info'}`}>
            {contactFeedback.message}
          </div>
        )}
        <button onClick={prev} disabled={atFirst || isDriving} aria-label="Previous station">
          ← Prev
        </button>
        <button
          className="primary"
          onClick={next}
          disabled={atLast || isDriving}
          aria-label="Next station"
        >
          {isDriving ? 'Driving…' : atLast ? 'End of tour' : 'Next station'}
          <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}

function VolunteerImpactBoard({ station }) {
  const notes = station.noticeBoard ?? [];

  return (
    <section className="volunteer-fullscreen" aria-label="Volunteer impact board">
      <div className="volunteer-fullscreen__panel">
        <div className="volunteer-fullscreen__header">
          <span>Volunteer Impact Board</span>
          <small>Community Support · Inclusion · Practical Systems</small>
        </div>
        <div className="volunteer-fullscreen__notes">
          {notes.map((note, i) => (
            <article className="volunteer-note" data-tone={i % 3} key={note.org}>
              <span className="volunteer-note__corner volunteer-note__corner--tl" aria-hidden />
              <span className="volunteer-note__corner volunteer-note__corner--br" aria-hidden />
              <p className="volunteer-note__years">{note.years}</p>
              <h2>{note.org}</h2>
              <p className="volunteer-note__role">{note.role}</p>
              <ul className="volunteer-note__points">
                {(note.bullets ?? []).map((b, bi) => (
                  <li key={bi} style={{ animationDelay: `${0.12 + bi * 0.08}s` }}>
                    <span className="volunteer-note__marker" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
