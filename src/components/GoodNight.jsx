import { useEffect, useRef, useState } from 'react';
import { GOOD_NIGHT_TASKS } from '../goodNight/tasks.js';
import { toIso } from '../utils/dates.js';

const STORAGE_KEY = 'trackli-good-night';
const SPARKLE_MS = 1100;
const SPARKLE_ICONS = ['✨', '⭐', '💫', '🌟', '✦'];

// Der „Abend“ gilt bis 5 Uhr früh – wer nach Mitternacht nachschaut, gehört
// noch zum Vortag. Danach darf eine neue Aufgabe gezogen werden.
function eveningKey() {
  const d = new Date();
  d.setHours(d.getHours() - 5);
  return toIso(d);
}

// Gespeichert: { day, taskId, done, lastTaskId } – eine Aufgabe pro Abend.
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    if (raw.day === eveningKey() && GOOD_NIGHT_TASKS.some((t) => t.id === raw.taskId)) return raw;
    return { lastTaskId: raw.taskId ?? raw.lastTaskId ?? null };
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ohne Speicher klappt es trotzdem, nur ohne Merken.
  }
}

// Zufällige Flugbahnen für die Sparkles.
function makeSparkles() {
  return Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 70;
    return {
      id: i,
      icon: SPARKLE_ICONS[i % SPARKLE_ICONS.length],
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      delay: Math.round(Math.random() * 180),
      size: 0.9 + Math.random() * 0.9,
    };
  });
}

export default function GoodNight({ onHome }) {
  const [state, setState] = useState(loadState);
  const [sparkling, setSparkling] = useState(false);
  const [sparkles, setSparkles] = useState([]);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const task = !sparkling && GOOD_NIGHT_TASKS.find((t) => t.id === state.taskId);

  function update(next) {
    setState(next);
    saveState(next);
  }

  // Zieht die Aufgabe des Abends – nicht dieselbe wie am Vorabend.
  function draw() {
    if (sparkling || state.taskId) return;
    let pool = GOOD_NIGHT_TASKS;
    if (pool.length > 1) pool = pool.filter((t) => t.id !== state.lastTaskId);
    const next = pool[Math.floor(Math.random() * pool.length)];
    setSparkles(makeSparkles());
    setSparkling(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      update({ day: eveningKey(), taskId: next.id, done: false, lastTaskId: state.lastTaskId ?? null });
      setSparkling(false);
    }, SPARKLE_MS);
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
        {task ? (
          <div className="card gn-reveal">
            <div className="gn-reveal-icon" aria-hidden="true">{task.icon}</div>
            <div className="gn-reveal-title">{task.title}</div>
            {task.hint && <div className="gn-hint">{task.hint}</div>}
            <div className="gn-reveal-actions">
              {state.done ? (
                <div className="gn-done">Erledigt – schlaft gut 🌙</div>
              ) : (
                <button type="button" className="btn-primary" onClick={() => update({ ...state, done: true })}>
                  Erledigt ✓
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="gn-magic-wrap">
            <button
              type="button"
              className={`gn-magic${sparkling ? ' gn-magic--go' : ''}`}
              onClick={draw}
              aria-label="Aufgabe für heute Abend ziehen"
            >
              <span aria-hidden="true">🌙</span>
            </button>
            {sparkling &&
              sparkles.map((s) => (
                <span
                  key={s.id}
                  className="gn-sparkle"
                  aria-hidden="true"
                  style={{
                    '--dx': `${s.dx}px`,
                    '--dy': `${s.dy}px`,
                    animationDelay: `${s.delay}ms`,
                    fontSize: `${s.size}rem`,
                  }}
                >
                  {s.icon}
                </span>
              ))}
            <div className="gn-magic-label">{sparkling ? 'Moment …' : 'Tippen für die Aufgabe von heute'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
