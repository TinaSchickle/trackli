import { useEffect, useMemo, useState } from 'react';
import {
  CARDS,
  LOCATION_OPTIONS,
  DURATION_OPTIONS,
  FOOD_OPTIONS,
  optionFor,
  matchesFilters,
} from '../funDates/cards.js';
import { getDoneCardIds, setCardDone } from '../cloud/funDates.js';

// Lachende Gesichter für die verdeckten Karten, bis echte Bilder kommen.
const FACES = ['😄', '😂', '🤣', '😆', '😁', '😹', '😃', '😸'];

const QUESTIONS = [
  { key: 'locations', title: 'Worauf habt ihr heute Lust?', options: LOCATION_OPTIONS },
  { key: 'durations', title: 'Wie viel Zeit habt ihr?', options: DURATION_OPTIONS },
  { key: 'foods', title: 'Mit Essen oder ohne?', options: FOOD_OPTIONS },
];

// So lange „mischen“ die Karten als Stapel, bevor sie verteilt werden.
const SHUFFLE_MS = 900;
// So lange dreht sich eine angeklickte Karte um, bevor die Date-Seite kommt.
const FLIP_MS = 650;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const rand = (min, max) => min + Math.random() * (max - min);

function faceFor(cardId) {
  const idx = CARDS.findIndex((c) => c.id === cardId);
  return FACES[idx % FACES.length];
}

function CardIcons({ card }) {
  const loc = optionFor(LOCATION_OPTIONS, card.location);
  const dur = optionFor(DURATION_OPTIONS, card.duration);
  const food = optionFor(FOOD_OPTIONS, card.food);
  return (
    <div className="fd-icons">
      <span title={loc.label}>{loc.icon}</span>
      <span title={dur.label}>{dur.short}</span>
      <span title={food.label}>{food.icon}</span>
    </div>
  );
}

function PlaceholderImage({ label = 'Bild folgt' }) {
  return (
    <div className="fd-placeholder" role="img" aria-label={label}>
      <svg viewBox="0 0 64 48" width="44" height="33" aria-hidden="true">
        <rect x="2" y="2" width="60" height="44" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="20" cy="16" r="5" fill="currentColor" />
        <path d="M6 42 L24 24 L34 34 L42 26 L58 42 Z" fill="currentColor" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="fd-legend" aria-label="Legende">
      <div>
        {LOCATION_OPTIONS.map((o) => (
          <span key={o.value}>{o.icon} {o.label}</span>
        ))}
      </div>
      <div>
        {DURATION_OPTIONS.map((o) => (
          <span key={String(o.value)}><b>{o.short}</b> {o.label}</span>
        ))}
      </div>
      <div>
        {FOOD_OPTIONS.map((o) => (
          <span key={o.value}>{o.icon} {o.label}</span>
        ))}
      </div>
    </div>
  );
}

function Quiz({ onDone, onClose }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ locations: [], durations: [], foods: [] });
  const q = QUESTIONS[step];
  const selected = answers[q.key];
  const isLast = step === QUESTIONS.length - 1;

  function toggle(value) {
    setAnswers((prev) => {
      const list = prev[q.key];
      return {
        ...prev,
        [q.key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet fd-quiz" onClick={(e) => e.stopPropagation()}>
        <div className="fd-quiz-step">Frage {step + 1} von {QUESTIONS.length} · Mehrfachauswahl möglich</div>
        <h3>{q.title}</h3>
        <div className="fd-quiz-options">
          {q.options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              className={`fd-chip${selected.includes(o.value) ? ' is-on' : ''}`}
              aria-pressed={selected.includes(o.value)}
              onClick={() => toggle(o.value)}
            >
              <span aria-hidden="true">{o.icon}</span> {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={selected.length === 0}
          onClick={() => (isLast ? onDone(answers) : setStep(step + 1))}
        >
          {isLast ? 'Goooo 🚀' : 'Weiter'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
          style={{ width: '100%', marginTop: 10, border: 'none' }}
        >
          {step === 0 ? 'Abbrechen' : 'Zurück'}
        </button>
      </div>
    </div>
  );
}

function DateDetail({ card, done, busy, onToggleDone, onBack }) {
  const media = card.media ?? [];
  return (
    <div className="screen fd-detail">
      <button type="button" className="fd-back" onClick={onBack}>← Zurück</button>
      <h1 className="fd-detail-title">{card.title}</h1>
      <CardIcons card={card} />
      {card.intro && <p className="fd-intro">{card.intro}</p>}

      {media.length === 0 ? (
        <div className="fd-hero"><PlaceholderImage label="Bilder & Videos folgen" /></div>
      ) : (
        media.map((m, i) =>
          m.type === 'video' ? (
            <video key={i} className="fd-hero" src={m.src} controls playsInline />
          ) : (
            <img key={i} className="fd-hero" src={m.src} alt={m.caption ?? ''} />
          )
        )
      )}

      <section className="card fd-section">
        <h3>Das braucht ihr</h3>
        <ul>
          {card.materials.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>

      <section className="card fd-section">
        <h3>So geht's</h3>
        <ol className="fd-steps">
          {card.steps.map((s, i) => (
            <li key={i} className={s.soon ? 'is-soon' : ''}>
              {s.text}
              {s.note && <span className="fd-badge">{s.note}</span>}
              {s.soon && <span className="fd-badge">Kommt bald</span>}
            </li>
          ))}
        </ol>
      </section>

      <button
        type="button"
        className={done ? 'btn-secondary' : 'btn-primary'}
        disabled={busy}
        onClick={onToggleDone}
        style={{ width: '100%' }}
      >
        {done ? 'Wieder verdecken' : 'Haben wir gemacht ✓'}
      </button>
    </div>
  );
}

export default function FunDates({ user, onHome }) {
  const [doneIds, setDoneIds] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);
  // Nach „Goooo“: gemischte Karten samt Zufalls-Neigung/Startpunkt fürs Verteilen.
  const [deck, setDeck] = useState(null);
  const [dealKey, setDealKey] = useState(0);
  const [shuffling, setShuffling] = useState(false);
  const [flippingId, setFlippingId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [confirmBack, setConfirmBack] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoadError(null);
    getDoneCardIds(user)
      .then(setDoneIds)
      .catch(() => setLoadError('Erledigte Dates konnten nicht geladen werden.'));
  }, [user]);

  const openCard = useMemo(() => CARDS.find((c) => c.id === openId), [openId]);

  function handleGo(filters) {
    setQuizOpen(false);
    const matched = shuffle(CARDS.filter((c) => matchesFilters(c, filters)));
    setDeck(
      matched.map((c) => ({
        id: c.id,
        tilt: rand(-5, 5),
        fromX: rand(-160, 160),
        fromY: rand(-260, -80),
        fromR: rand(-45, 45),
      }))
    );
    setDealKey((k) => k + 1);
    setShuffling(true);
    setTimeout(() => setShuffling(false), SHUFFLE_MS);
  }

  function handleCardClick(id) {
    if (flippingId) return;
    if (doneIds.includes(id)) {
      setOpenId(id);
      return;
    }
    setFlippingId(id);
    setTimeout(() => {
      setFlippingId(null);
      setOpenId(id);
      window.scrollTo(0, 0);
    }, FLIP_MS);
  }

  async function handleToggleDone() {
    const done = !doneIds.includes(openId);
    setBusy(true);
    try {
      await setCardDone(user, openId, done);
      setDoneIds((prev) => (done ? [...prev, openId] : prev.filter((id) => id !== openId)));
    } catch {
      setLoadError('Speichern hat nicht geklappt. Bitte später nochmal versuchen.');
    } finally {
      setBusy(false);
    }
  }

  if (openCard) {
    return (
      <>
        <DateDetail
          card={openCard}
          done={doneIds.includes(openCard.id)}
          busy={busy}
          onToggleDone={handleToggleDone}
          onBack={() => setConfirmBack(true)}
        />
        {loadError && <p className="fd-error" style={{ padding: '0 20px' }}>{loadError}</p>}
        {confirmBack && (
          <div className="modal-backdrop" onClick={() => setConfirmBack(false)}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
              <h3>Anderes Date raussuchen?</h3>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setConfirmBack(false);
                  setOpenId(null);
                }}
              >
                Ja
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmBack(false)}
                style={{ width: '100%', marginTop: 10 }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="screen fd">
      <button type="button" className="fd-back" onClick={onHome}>← Übersicht</button>
      <div className="app-header" style={{ padding: '4px 0 12px' }}>
        <div className="eyebrow">Zeit zu zweit</div>
        <h1 style={{ fontSize: '1.4rem' }}>Spaß-Dates</h1>
      </div>

      <Legend />

      {deck && (
        <button type="button" className="btn-primary fd-go" onClick={() => setQuizOpen(true)}>
          Let's have fun 🎉
        </button>
      )}

      <div className="fd-board">
        {!deck && (
          <div className="fd-board-empty">
            <div className="fd-banner">May the Fun begin</div>
            <button type="button" className="btn-primary fd-go" onClick={() => setQuizOpen(true)}>
              Let's have fun 🎉
            </button>
          </div>
        )}

        {deck && shuffling && (
          <div className="fd-stack" aria-label="Karten werden gemischt">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="fd-stack-card" style={{ animationDelay: `${i * 60}ms` }}>
                <span>{FACES[i]}</span>
              </div>
            ))}
          </div>
        )}

        {deck && !shuffling && deck.length === 0 && (
          <div className="fd-board-empty">
            <div className="fd-note">
              Dazu passt gerade kein Date. Probiert andere Antworten!
            </div>
          </div>
        )}

        {deck && !shuffling && deck.length > 0 && (
          <div className="fd-grid" key={dealKey}>
            {deck.map((d, i) => {
              const card = CARDS.find((c) => c.id === d.id);
              const done = doneIds.includes(d.id);
              const flipped = done || flippingId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`fd-card${flipped ? ' is-flipped' : ''}${done ? ' is-done' : ''}`}
                  style={{
                    '--tilt': `${d.tilt}deg`,
                    '--from-x': `${d.fromX}px`,
                    '--from-y': `${d.fromY}px`,
                    '--from-r': `${d.fromR}deg`,
                    animationDelay: `${i * 90}ms`,
                  }}
                  onClick={() => handleCardClick(d.id)}
                  aria-label={done ? `${card.title} (schon gemacht)` : 'Verdeckte Date-Karte'}
                >
                  <span className="fd-pin" aria-hidden="true" />
                  <span className="fd-card-inner">
                    <span className="fd-face fd-back-face">
                      <span className="fd-emoji" aria-hidden="true">{faceFor(d.id)}</span>
                      <CardIcons card={card} />
                    </span>
                    <span className="fd-face fd-front-face">
                      {card.cover ? (
                        <img src={card.cover} alt="" className="fd-cover" />
                      ) : (
                        <PlaceholderImage />
                      )}
                      <span className="fd-card-title">{card.title}</span>
                      {done && <span className="fd-done-stamp">✓ gemacht</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loadError && <p className="fd-error">{loadError}</p>}

      {quizOpen && <Quiz onDone={handleGo} onClose={() => setQuizOpen(false)} />}
    </div>
  );
}
