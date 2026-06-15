import { useEffect, useState } from 'react';
import { stations } from '../data/stations.js';
import { useJourney } from '../state/useJourney.js';
import { useSwipe } from '../state/useSwipe.js';

// EnergyReactorOverlay — a full-screen "power console" for the Energy station,
// sibling to the Finance coin and Education book. Plain HTML/CSS overlay (not
// part of the 3D canvas) so the readouts stay razor-sharp.
//
// Behaviour
//   • Auto-opens when the visitor arrives at the Energy station in Tour view
//     (car stopped). Dismissed with × or ESC. Re-arms after leaving.
//   • You land on the IDLE control room (the role intro). Advancing (click the
//     core, →, the rail, or "next") brings one SYSTEM online at a time — each
//     system is one achievement, its metric counting up like a power readout
//     while the reactor core surges and the load bar fills. ← powers back down.
//
// The mechanic is deliberately different from the coin's flip: here progress
// MEANS something — every step energises another part of the plant.
//
// Content comes from the Energy station in src/data/stations.js (`role` and
// `systems`). Screen 0 is idle; screens 1…N are the systems.

const ENERGY_INDEX = Math.max(0, stations.findIndex((s) => s.id === 'projects'));
const STATION = stations[ENERGY_INDEX] ?? {};
const ROLE = STATION.role ?? {};
const SYSTEMS = STATION.systems ?? [];
const N = SYSTEMS.length; // number of systems
const SCREENS = N + 1; // +1 for the idle control room

export default function EnergyReactorOverlay() {
  const viewMode = useJourney((s) => s.viewMode);
  const currentIndex = useJourney((s) => s.currentIndex);
  const isDriving = useJourney((s) => s.isDriving);
  const reactorOpen = useJourney((s) => s.reactorOpen);
  const openReactor = useJourney((s) => s.openReactor);
  const closeReactor = useJourney((s) => s.closeReactor);
  const setActiveSystem = useJourney((s) => s.setActiveSystem);

  const atEnergy =
    viewMode === 'tour' && currentIndex === ENERGY_INDEX && !isDriving;

  // Auto-open once per arrival.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (atEnergy) {
      if (!armed) {
        setArmed(true);
        openReactor();
      }
    } else {
      setArmed(false);
      if (useJourney.getState().reactorOpen) closeReactor();
    }
  }, [atEnergy, armed, openReactor, closeReactor]);

  const [idx, setIdx] = useState(0); // 0 = idle, 1…N = systems online

  useEffect(() => {
    if (reactorOpen) {
      setIdx(0);
      setActiveSystem(0);
    }
  }, [reactorOpen, setActiveSystem]);

  const go = (target) => {
    const t = Math.max(0, Math.min(SCREENS - 1, target));
    if (t === idx) return;
    setIdx(t);
    setActiveSystem(t);
  };
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);
  const close = () => closeReactor();

  // Touch: swipe left/right brings the next/previous system online (mirrors arrows).
  const swipe = useSwipe({ onLeft: next, onRight: prev });

  useEffect(() => {
    if (!reactorOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reactorOpen, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!reactorOpen) return null;

  const canForward = idx < SCREENS - 1;
  const canBack = idx > 0;
  const online = idx > 0;
  const sys = online ? SYSTEMS[idx - 1] ?? {} : null;
  const progressPct = Math.round((idx / (SCREENS - 1)) * 100);
  const coreGlyph = online ? sys.glyph : '◍';

  return (
    <div className="reactor" role="dialog" aria-modal="true" aria-label="Energy reactor console" {...swipe}>
      <div className="reactor__backdrop" onClick={close} />

      <header className="reactor__chrome">
        <div className="reactor__title-bar">
          <span className="reactor__dot" aria-hidden />
          <span>
            Experience<span className="reactor__sep"> · </span>
            <span className="reactor__sub">
              {ROLE.title} · {ROLE.company}
            </span>
          </span>
        </div>
        <button className="reactor__close" onClick={close} aria-label="Close (ESC)">
          <span aria-hidden>✕</span>
          <kbd>ESC</kbd>
        </button>
      </header>

      <div className="reactor__stage">
        <div className={`reactor__console${online ? ' is-online' : ''}`}>
          {/* Load bar — one segment per system, lit cumulatively */}
          <div className="reactor__load" aria-hidden>
            {Array.from({ length: N }, (_, i) => (
              <span key={i} className={`reactor__seg${i < idx ? ' lit' : ''}`} />
            ))}
            <span className="reactor__load-label">
              {online ? `${idx} / ${N} systems online` : 'standby'}
            </span>
          </div>

          <div className="reactor__body">
            {/* Reactor core (left) */}
            <button
              className="reactor__core"
              onClick={canForward ? next : undefined}
              aria-label={canForward ? 'Bring next system online' : 'All systems online'}
            >
              <span className="reactor__ring reactor__ring--1" aria-hidden />
              <span className="reactor__ring reactor__ring--2" aria-hidden />
              <span className="reactor__ring reactor__ring--3" aria-hidden />
              <span className="reactor__orb" aria-hidden />
              <span className="reactor__glyph" key={idx} aria-hidden>{coreGlyph}</span>
              <span className="reactor__status">{online ? 'ONLINE' : 'IDLE'}</span>
            </button>

            {/* Readout (right) */}
            <div className="reactor__content" key={idx}>
              {online ? (
                <>
                  <div className="reactor__sysline">
                    SYSTEM {idx} / {N}<span className="reactor__on"> · ONLINE</span>
                  </div>
                  <div className="reactor__sysname">{sys.sys}</div>
                  <h2 className="reactor__heading">{sys.title}</h2>
                  <div className="reactor__metric">
                    <span className="reactor__num">
                      {sys.prefix}
                      <CountUp to={sys.metric} />
                      {sys.suffix}
                    </span>
                    <span className="reactor__mlabel">{sys.metricLabel}</span>
                  </div>
                  <div className="reactor__tags">
                    {(sys.tags ?? []).map((t) => (
                      <span className="reactor__tag" key={t}>{t}</span>
                    ))}
                  </div>
                  <p className="reactor__detail">{sys.detail}</p>
                </>
              ) : (
                <div className="reactor__idle">
                  <div className="reactor__sysline">CONTROL ROOM<span className="reactor__on reactor__on--idle"> · STANDBY</span></div>
                  <div className="reactor__legend">{ROLE.company}</div>
                  <h2 className="reactor__heading reactor__heading--role">{ROLE.title}</h2>
                  <div className="reactor__period">{ROLE.period}</div>
                  <p className="reactor__blurb">{ROLE.fullCompany}</p>
                  <div className="reactor__powerhint">Power up ›</div>
                </div>
              )}
            </div>
          </div>

          {/* One-shot surge flash on every screen change */}
          <span className="reactor__surge" key={`surge-${idx}`} aria-hidden />
        </div>
      </div>

      <nav className="reactor__rail" aria-label="Systems">
        {Array.from({ length: SCREENS }, (_, i) => (
          <button
            key={i}
            className={`reactor__node${i === idx ? ' is-active' : ''}${i > 0 && i <= idx ? ' is-lit' : ''}`}
            onClick={() => go(i)}
            aria-label={i === 0 ? 'Control room' : `System ${i}`}
            aria-current={i === idx}
          >
            {i === 0 ? '⏻' : i}
          </button>
        ))}
      </nav>

      <footer className="reactor__foot">
        <button className="reactor__nav" onClick={prev} disabled={!canBack} aria-label="Power down one">
          ‹
        </button>
        <span className="reactor__hint">
          {idx === 0
            ? 'Click the core to power up'
            : idx >= SCREENS - 1
              ? 'Full output · click ‹ to step back'
              : 'Click the core for the next system · ESC to close'}
        </span>
        <button className="reactor__nav" onClick={next} disabled={!canForward} aria-label="Bring next system online">
          ›
        </button>
        <div className="reactor__progress" aria-hidden>
          <span style={{ width: `${progressPct}%` }} />
        </div>
      </footer>
    </div>
  );
}

// Eased count-up that runs on mount (the readout remounts when its system
// changes, so the number ramps up as the system comes online).
function CountUp({ to, duration = 950 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{v}</>;
}
