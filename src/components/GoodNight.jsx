import { useState } from 'react';
import { GOOD_NIGHT_TASKS } from '../goodNight/tasks.js';
import { toIso } from '../utils/dates.js';

const STORAGE_KEY = 'trackli-good-night';

// Der „Abend“ gilt bis 5 Uhr früh – wer nach Mitternacht abhakt, gehört noch
// zum Vortag. Danach starten die Häkchen wieder leer.
function eveningKey() {
  const d = new Date();
  d.setHours(d.getHours() - 5);
  return toIso(d);
}

function loadDone() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw?.day === eveningKey() && Array.isArray(raw.done)) return raw.done;
  } catch {
    // Kaputter oder fehlender Eintrag: einfach leer starten.
  }
  return [];
}

function saveDone(done) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ day: eveningKey(), done }));
  } catch {
    // Ohne Speicher funktioniert die Liste trotzdem, nur ohne Merken.
  }
}

export default function GoodNight({ onHome }) {
  const [done, setDone] = useState(loadDone);
  const count = GOOD_NIGHT_TASKS.filter((t) => done.includes(t.id)).length;
  const allDone = count === GOOD_NIGHT_TASKS.length;

  function toggle(id) {
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveDone(next);
      return next;
    });
  }

  return (
    <div className="screen">
      <button type="button" className="fd-back" onClick={onHome}>← Übersicht</button>
      <div className="app-header" style={{ padding: '4px 0 12px' }}>
        <div className="eyebrow">5 Minuten vor dem Einschlafen</div>
        <h1 style={{ fontSize: '1.4rem' }}>Good Night</h1>
      </div>

      <p className="fd-intro">
        Kleine Handgriffe, damit der Tag leise ausklingt. Die Häkchen starten jeden Abend neu.
      </p>

      <ul className="todo-list">
        {GOOD_NIGHT_TASKS.map((t) => {
          const checked = done.includes(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                className={`card gn-task${checked ? ' gn-task--done' : ''}`}
                aria-pressed={checked}
                onClick={() => toggle(t.id)}
              >
                <span className="gn-check" aria-hidden="true">{checked ? '✓' : ''}</span>
                <span aria-hidden="true">{t.icon}</span>
                <span className="gn-text">
                  <span className="gn-title">{t.title}</span>
                  {t.hint && <span className="gn-hint">{t.hint}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="gn-progress">
        {allDone ? 'Alles erledigt – schlaft gut 🌙' : `${count} von ${GOOD_NIGHT_TASKS.length} erledigt`}
      </p>
    </div>
  );
}
