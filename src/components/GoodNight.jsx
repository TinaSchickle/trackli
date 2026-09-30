import { useEffect, useRef, useState } from 'react';
import { GOOD_NIGHT_TASKS } from '../goodNight/tasks.js';
import { toIso } from '../utils/dates.js';
import { getDraw, saveDraw, markDrawDone } from '../cloud/goodNight.js';

// So lange dauert die Verwandlung, bis die Aufgabe erscheint.
const SPARKLE_MS = 3000;

// Der „Abend“ gilt bis 5 Uhr früh – wer nach Mitternacht nachschaut, gehört
// noch zum Vortag. Danach darf eine neue Aufgabe gezogen werden.
function eveningKey() {
  const d = new Date();
  d.setHours(d.getHours() - 5);
  return toIso(d);
}

// Feine Lichtpunkte, die langsam nach außen treiben – bei jedem Ziehen neu.
function makeSparkles() {
  return Array.from({ length: 22 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 90;
    return {
      id: i,
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      size: 2 + Math.random() * 3,
      delay: 300 + Math.round(Math.random() * 1400),
      duration: 1200 + Math.round(Math.random() * 900),
    };
  });
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.3 14.6A8.5 8.5 0 0 1 9.4 3.7a8.5 8.5 0 1 0 10.9 10.9Z" />
    </svg>
  );
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default function GoodNight({ user, onHome }) {
  // { evening, taskId, done, lastTaskId } – undefined solange geladen wird.
  const [state, setState] = useState(undefined);
  const [sparkling, setSparkling] = useState(false);
  const [sparkles, setSparkles] = useState([]);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const evening = eveningKey();
    getDraw(user, evening)
      .then((d) => alive.current && setState({ evening, ...d }))
      .catch(() => alive.current && setState({ evening, taskId: null, done: false, lastTaskId: null }));
  }, [user?.id]);

  const task = state && !sparkling && GOOD_NIGHT_TASKS.find((t) => t.id === state.taskId);

  // Zieht die Aufgabe des Abends – nicht dieselbe wie am Vorabend. Die
  // Verwandlung läuft immer volle 3 s, auch wenn das Speichern schneller ist.
  async function draw() {
    if (!state || sparkling || state.taskId) return;
    let pool = GOOD_NIGHT_TASKS;
    if (pool.length > 1) pool = pool.filter((t) => t.id !== state.lastTaskId);
    const next = pool[Math.floor(Math.random() * pool.length)];
    // Ist der Abend inzwischen vorbei (App über Nacht offen), neu zählen.
    const evening = eveningKey();
    setError('');
    setSparkles(makeSparkles());
    setSparkling(true);
    try {
      const [saved] = await Promise.all([saveDraw(user, evening, next.id, state.lastTaskId), wait(SPARKLE_MS)]);
      if (alive.current) setState((s) => ({ ...s, evening, ...saved }));
    } catch {
      if (alive.current) setError('Konnte nicht gespeichert werden – bitte nochmal versuchen.');
    } finally {
      if (alive.current) setSparkling(false);
    }
  }

  async function finish() {
    setState((s) => ({ ...s, done: true }));
    try {
      await markDrawDone(user, state.evening);
    } catch {
      setState((s) => ({ ...s, done: false }));
      setError('Konnte nicht gespeichert werden – bitte nochmal versuchen.');
    }
  }

  return (
    <div className="screen">
      <button type="button" className="fd-back" onClick={onHome}>← Übersicht</button>
      <div className="app-header" style={{ padding: '4px 0 12px' }}>
        <div className="eyebrow">5 Minuten vor dem Einschlafen</div>
        <h1 style={{ fontSize: '1.4rem' }}>Good Night</h1>
      </div>

      <p className="fd-intro">
        {task ? 'Eure Aufgabe für heute Abend:' : 'Jeden Abend wartet eine kleine Aufgabe auf euch. Tippt auf den Mond und lasst euch überraschen.'}
      </p>

      <div className="gn-stage">
        {state === undefined ? (
          <div className="gn-magic-label">Lädt …</div>
        ) : task ? (
          <div className="card gn-reveal">
            <div className="gn-reveal-icon" aria-hidden="true">{task.icon}</div>
            <div className="gn-reveal-title">{task.title}</div>
            {task.hint && <div className="gn-hint">{task.hint}</div>}
            <div className="gn-reveal-actions">
              {state.done ? (
                <div className="gn-done">Erledigt – schlaft gut 🌙</div>
              ) : (
                <button type="button" className="btn-primary" onClick={finish}>
                  Erledigt ✓
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="gn-magic-wrap">
            <div className="gn-orb">
              {sparkling && [0, 500, 1000].map((d) => (
                <span key={d} className="gn-ring" style={{ animationDelay: `${d}ms` }} aria-hidden="true" />
              ))}
              <button
                type="button"
                className={`gn-magic${sparkling ? ' gn-magic--go' : ''}`}
                onClick={draw}
                aria-label="Aufgabe für heute Abend ziehen"
              >
                <MoonIcon />
              </button>
              {sparkling &&
                sparkles.map((s) => (
                  <span
                    key={s.id}
                    className="gn-mote"
                    aria-hidden="true"
                    style={{
                      '--dx': `${s.dx}px`,
                      '--dy': `${s.dy}px`,
                      '--s': `${s.size}px`,
                      '--d': `${s.duration}ms`,
                      animationDelay: `${s.delay}ms`,
                    }}
                  />
                ))}
            </div>
            <div className="gn-magic-label">{sparkling ? 'Eure Aufgabe entsteht …' : 'Tippen für die Aufgabe von heute'}</div>
          </div>
        )}
      </div>
      {error && <p className="gn-magic-label" role="alert">{error}</p>}
    </div>
  );
}
