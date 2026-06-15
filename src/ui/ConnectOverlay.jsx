import { useEffect, useRef, useState } from 'react';
import { stations } from '../data/stations.js';
import { useJourney } from '../state/useJourney.js';

// ConnectOverlay — a full-screen "uplink hub" for the Contact station, sibling
// to the Finance coin / Energy reactor / Projects showcase. Plain HTML/CSS
// overlay (not the 3D canvas) so the links are real, crisp, and clickable.
//
// Behaviour
//   • Auto-opens when the visitor arrives at the Contact station in Tour view
//     (car stopped). Dismissed with × or ESC. Re-arms after leaving.
//   • A pulsing beacon (you) sits at the centre; four channels orbit it,
//     joined by light beams. Hover lights a beam; clicking "establishes the
//     uplink" (typed status) AND performs the real action — open GitHub /
//     LinkedIn, copy the email, or download the résumé.
//
// These are FUNCTIONAL CTAs: open/resume are real <a> links (so popup blockers
// stay happy), email copies to the clipboard. Content comes from the Contact
// station in src/data/stations.js (`contacts`).

const CONTACT_INDEX = Math.max(0, stations.findIndex((s) => s.id === 'contact'));
const STATION = stations[CONTACT_INDEX] ?? {};
const CONTACTS = STATION.contacts ?? [];
// Lay the four channels out around the beacon (percent of the hub box). Keyed
// by slot so order in the data doesn't matter.
const SLOT_POS = {
  github: { x: 22, y: 26 },
  linkedin: { x: 78, y: 26 },
  email: { x: 22, y: 74 },
  resume: { x: 78, y: 74 },
};

export default function ConnectOverlay() {
  const viewMode = useJourney((s) => s.viewMode);
  const currentIndex = useJourney((s) => s.currentIndex);
  const isDriving = useJourney((s) => s.isDriving);
  const connectOpen = useJourney((s) => s.connectOpen);
  const openConnect = useJourney((s) => s.openConnect);
  const closeConnect = useJourney((s) => s.closeConnect);

  const atContact =
    viewMode === 'tour' && currentIndex === CONTACT_INDEX && !isDriving;

  const armed = useRef(false);
  useEffect(() => {
    if (atContact) {
      if (!armed.current) {
        armed.current = true;
        openConnect();
      }
    } else {
      armed.current = false;
      if (useJourney.getState().connectOpen) closeConnect();
    }
  }, [atContact, openConnect, closeConnect]);

  const [hovered, setHovered] = useState(null);
  const [status, setStatus] = useState(null); // { slot, label, phase, copied }
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);
  useEffect(() => {
    if (connectOpen) {
      setStatus(null);
      setHovered(null);
      clearTimers();
    }
  }, [connectOpen]);

  const fire = (c) => {
    clearTimers();
    const copied = c.action === 'copy';
    if (copied && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(c.value ?? '').catch(() => {});
    }
    setStatus({ slot: c.slot, label: c.label, phase: 'connecting', copied });
    timers.current.push(
      setTimeout(() => setStatus({ slot: c.slot, label: c.label, phase: 'done', copied }), 620),
    );
    timers.current.push(setTimeout(() => setStatus(null), 3200));
  };

  useEffect(() => {
    if (!connectOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeConnect();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [connectOpen, closeConnect]);

  if (!connectOpen) return null;

  const liveSlot = status?.slot ?? hovered;
  const statusText = status
    ? status.phase === 'connecting'
      ? `establishing uplink to ${status.label}…`
      : status.copied
        ? 'email copied to clipboard ✓'
        : `${status.label} linked ✓`
    : 'awaiting uplink — pick a channel';

  return (
    <div className="connect" role="dialog" aria-modal="true" aria-label="Let's connect">
      <div className="connect__backdrop" onClick={closeConnect} />

      <header className="connect__chrome">
        <div className="connect__title">
          <span className="connect__dot" aria-hidden />
          <span>
            Experience<span className="connect__sep"> · </span>
            <span className="connect__sub">Let&rsquo;s Connect</span>
          </span>
        </div>
        <button className="connect__close" onClick={closeConnect} aria-label="Close (ESC)">
          <span aria-hidden>✕</span>
          <kbd>ESC</kbd>
        </button>
      </header>

      <div className="connect__stage">
        <div className="connect__hub">
          {/* Beams */}
          <svg className="connect__beams" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {CONTACTS.map((c) => {
              const pos = SLOT_POS[c.slot];
              if (!pos) return null;
              const live = liveSlot === c.slot;
              return (
                <line
                  key={c.slot}
                  x1="50"
                  y1="50"
                  x2={pos.x}
                  y2={pos.y}
                  className={`connect__beam${live ? ' is-live' : ''}`}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          {/* Central beacon (you) */}
          <div className="connect__core" aria-hidden>
            <span className="connect__pulse" />
            <span className="connect__pulse connect__pulse--2" />
            <span className="connect__beacon">
              <span className="connect__beacon-id">MZ</span>
            </span>
            <span className="connect__beacon-label">
              <i className="connect__online" /> ONLINE
            </span>
          </div>

          {/* Channels */}
          {CONTACTS.map((c) => {
            const pos = SLOT_POS[c.slot] ?? { x: 50, y: 50 };
            const common = {
              className: `connect__node connect__node--${c.slot}${liveSlot === c.slot ? ' is-live' : ''}`,
              style: { left: `${pos.x}%`, top: `${pos.y}%` },
              onMouseEnter: () => setHovered(c.slot),
              onMouseLeave: () => setHovered((s) => (s === c.slot ? null : s)),
            };
            const inner = (
              <>
                <span className="connect__icon"><ChannelIcon slot={c.slot} /></span>
                <span className="connect__node-text">
                  <span className="connect__node-label">{c.label}</span>
                  <span className="connect__node-value">
                    {status?.slot === c.slot && status.copied && status.phase === 'done'
                      ? 'Copied!'
                      : c.value}
                  </span>
                </span>
              </>
            );
            return c.action === 'copy' ? (
              <button key={c.slot} {...common} onClick={() => fire(c)}>
                {inner}
              </button>
            ) : (
              <a
                key={c.slot}
                {...common}
                href={c.href || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => fire(c)}
              >
                {inner}
              </a>
            );
          })}
        </div>
      </div>

      <footer className="connect__foot">
        <div className={`connect__status${status ? ' is-active' : ''}`}>
          <span className="connect__status-prompt">›</span>
          <span className="connect__status-text">{statusText}</span>
          {status?.phase === 'connecting' && <span className="connect__status-cur" />}
        </div>
        <div className="connect__hint">Click a channel to connect · ESC to close</div>
      </footer>
    </div>
  );
}

function ChannelIcon({ slot }) {
  switch (slot) {
    case 'github':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path
            fill="currentColor"
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
          />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path
            fill="currentColor"
            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"
          />
        </svg>
      );
    case 'email':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3.5 6.5 12 13l8.5-6.5" />
        </svg>
      );
    case 'resume':
    default:
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5" />
          <path d="M9.5 13h6M9.5 16.5h6" />
        </svg>
      );
  }
}
