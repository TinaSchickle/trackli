import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CARDS,
  LOCATION_OPTIONS,
  QUIZ_LOCATION_OPTIONS,
  QUIZ_FOOD_OPTIONS,
  DURATION_OPTIONS,
  FOOD_OPTIONS,
  optionFor,
  matchesFilters,
} from '../funDates/cards.js';
import { SEXY_CARDS } from '../sexyTime/cards.js';
import {
  getDoneCards,
  markCardDone,
  unmarkCardDone,
  compressImage,
  getSavedCard,
  saveCard,
  clearSavedCard,
} from '../cloud/funDates.js';

// Die Pinnwand gibt es zweimal: Spaß-Dates (mit Quiz + Erinnerungs-Selfie)
// und Sexy Time (alle Karten ohne Filter, abhaken ohne Foto).
const VARIANTS = {
  dates: {
    eyebrow: 'Zeit zu zweit',
    title: 'Spaß-Dates',
    cards: CARDS,
    withQuiz: true,
    withSelfie: true,
    // Lachende Gesichter für die verdeckten Karten, bis echte Bilder kommen.
    faces: ['😄', '😂', '🤣', '😆', '😁', '😹', '😃', '😸'],
    banner: 'May the Fun begin',
    notes: [
      { text: 'Neues Abenteuer!', color: '#fff27a', pin: 'red' },
      { text: 'Nur wir zwei ♥', color: '#ffc4d6', pin: 'blue' },
    ],
    againLabel: "Let's have fun 🎉",
  },
  sexy: {
    eyebrow: 'Nur für euch zwei',
    title: 'Sexy Time',
    cards: SEXY_CARDS,
    withQuiz: false,
    withSelfie: false,
    faces: ['😘', '😏', '🔥', '💋', '🥰', '😍'],
    banner: "Let's get closer",
    notes: [
      { text: 'Heute Nacht?', color: '#ffc4d6', pin: 'red' },
      { text: 'Nur wir zwei ♥', color: '#ff9fb0', pin: 'brass' },
    ],
    againLabel: 'Neu mischen 🔥',
  },
};

const QUESTIONS = [
  { key: 'locations', title: 'Worauf habt ihr heute Lust?', options: QUIZ_LOCATION_OPTIONS },
  { key: 'durations', title: 'Wie viel Zeit habt ihr?', options: DURATION_OPTIONS },
  { key: 'foods', title: 'Mit Essen oder ohne?', options: QUIZ_FOOD_OPTIONS },
];

// Pinnwand-Deko: Nadelfarben.
const PIN_COLORS = ['red', 'blue', 'brass', 'green', 'red'];
// Hintergrund der „Fotos“ auf den verdeckten Karten.
const PHOTO_BGS = [
  'linear-gradient(160deg, #ffd9a0, #f49a6c)',
  'linear-gradient(160deg, #bfe3f5, #7fb2d6)',
  'linear-gradient(160deg, #d8f0c0, #8cc47a)',
  'linear-gradient(160deg, #ffd1e0, #e889a8)',
  'linear-gradient(160deg, #fff0a8, #f0c75a)',
  'linear-gradient(160deg, #e2d4ff, #a58ee0)',
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

function CardIcons({ card }) {
  // Sexy-Time-Karten haben keine Filter-Infos.
  if (!card.location) return null;
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

// Fenster nach „✓ Erinnerungs-Selfie“: Foto machen (Kamera) oder hochladen,
// Vorschau, dann speichern. Abhaken geht auch ohne Foto.
function SelfieModal({ alreadyDone, onSave, onClose }) {
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const small = await compressImage(file);
      setBlob(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setError('Das Bild konnte nicht gelesen werden. Bitte ein anderes probieren.');
    }
  }

  async function save(withPhoto) {
    setBusy(true);
    setError(null);
    try {
      await onSave(withPhoto ? blob : null);
    } catch {
      setError('Speichern hat nicht geklappt. Bitte nochmal versuchen.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal-sheet fd-selfie" onClick={(e) => e.stopPropagation()}>
        <h3>Erinnerungs-Selfie 📸</h3>
        <p className="fd-intro" style={{ marginBottom: 12 }}>
          Haltet den Moment fest – das Foto kommt dann auf eure Karte an der Pinnwand.
        </p>

        <div className="fd-selfie-frame">
          {preview ? <img src={preview} alt="Vorschau eures Selfies" /> : <PlaceholderImage label="Noch kein Foto" />}
        </div>

        <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={handleFile} />
        <input ref={uploadRef} type="file" accept="image/*" hidden onChange={handleFile} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} disabled={busy} onClick={() => cameraRef.current.click()}>
            📷 {preview ? 'Neu aufnehmen' : 'Foto machen'}
          </button>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} disabled={busy} onClick={() => uploadRef.current.click()}>
            🖼️ Hochladen
          </button>
        </div>

        {error && <p className="fd-error" style={{ marginTop: 0 }}>{error}</p>}

        <button type="button" className="btn-primary" disabled={!blob || busy} onClick={() => save(true)}>
          {busy ? 'Speichert…' : 'Speichern ✓'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={alreadyDone ? onClose : () => save(false)}
          style={{ width: '100%', marginTop: 10, border: 'none' }}
        >
          {alreadyDone ? 'Abbrechen' : 'Ohne Foto abhaken'}
        </button>
      </div>
    </div>
  );
}

function DateDetail({ card, done, selfie, withSelfie, saved, busy, onDone, onUndo, onSave, onUnsave, onBack }) {
  const media = card.media ?? [];
  const steps = card.steps ?? [];
  // Erst nur „Das braucht ihr“ zeigen; der Rest kommt nach „Wir sind bereit“.
  const [ready, setReady] = useState(false);

  const materials = (
    <section className="card fd-section">
      <h3>Das braucht ihr</h3>
      <ul>
        {card.materials.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </section>
  );

  if (!ready) {
    return (
      <div className="screen fd-detail">
        <button type="button" className="fd-back" onClick={onBack}>← Zurück</button>
        <h1 className="fd-detail-title">{card.title}</h1>
        <CardIcons card={card} />
        {materials}
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setReady(true);
            window.scrollTo(0, 0);
          }}
        >
          Wir sind bereit ✨
        </button>
        {saved ? (
          <div className="fd-saved-note">
            📌 Gemerkt – ihr findet das Date oben auf der Pinnwand-Seite.
            <button type="button" className="fd-link" disabled={busy} onClick={onUnsave}>
              Nicht mehr merken
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={onSave}
            style={{ width: '100%', marginTop: 10 }}
          >
            📌 Erst vorbereiten – Date merken
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="screen fd-detail">
      <button type="button" className="fd-back" onClick={onBack}>← Zurück</button>
      <h1 className="fd-detail-title">{card.title}</h1>
      <CardIcons card={card} />
      {card.intro && <p className="fd-intro">{card.intro}</p>}

      {selfie && (
        <figure className="fd-memory">
          <img src={selfie} alt="Euer Erinnerungs-Selfie" />
          <figcaption>Eure Erinnerung ♥</figcaption>
        </figure>
      )}

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

      {materials}

      <section className="card fd-section">
        <h3>So geht's</h3>
        {steps.length === 0 ? (
          <p className="fd-intro" style={{ margin: 0 }}>Die Anleitung kommt bald.</p>
        ) : (
          <ol className="fd-steps">
            {steps.map((s, i) => (
              <li key={i} className={s.soon ? 'is-soon' : ''}>
                {s.text}
                {s.note && <span className="fd-badge">{s.note}</span>}
                {s.soon && <span className="fd-badge">Kommt bald</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {done ? (
        <>
          {withSelfie && (
            <button type="button" className="btn-primary" disabled={busy} onClick={onDone} style={{ marginBottom: 10 }}>
              📸 {selfie ? 'Selfie ändern' : 'Selfie hinzufügen'}
            </button>
          )}
          <button type="button" className="btn-secondary" disabled={busy} onClick={onUndo} style={{ width: '100%' }}>
            Wieder verdecken
          </button>
        </>
      ) : (
        <button type="button" className="btn-primary" disabled={busy} onClick={onDone}>
          {withSelfie ? '✓ Erinnerungs-Selfie' : '✓ Gemacht'}
        </button>
      )}
    </div>
  );
}

export default function FunDates({ user, onHome, variant = 'dates' }) {
  const v = VARIANTS[variant];
  const cards = v.cards;
  // { [cardId]: selfieUrl | null } – alle erledigten Karten.
  const [doneMap, setDoneMap] = useState({});
  const [selfieOpen, setSelfieOpen] = useState(false);
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
  // Das eine gemerkte Date { variant, cardId } (zum Vorbereiten + Zurückspringen).
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    setLoadError(null);
    getDoneCards(user)
      .then(setDoneMap)
      .catch(() => setLoadError('Erledigte Dates konnten nicht geladen werden.'));
    // Fehler hier nur still schlucken – ohne gemerktes Date geht alles andere.
    getSavedCard(user)
      .then(setSaved)
      .catch(() => setSaved(null));
  }, [user, variant]);

  const openCard = useMemo(() => cards.find((c) => c.id === openId), [cards, openId]);
  // Gemerkt sein kann nur ein Date über beide Kacheln – hier zählt es nur,
  // wenn es zu dieser Kachel gehört.
  const savedId = saved?.variant === variant ? saved.cardId : null;
  const savedCard = useMemo(() => cards.find((c) => c.id === savedId), [cards, savedId]);

  async function runSaved(action, next) {
    setBusy(true);
    try {
      await action();
      setSaved(next);
    } catch {
      setLoadError('Speichern hat nicht geklappt. Bitte später nochmal versuchen.');
    } finally {
      setBusy(false);
    }
  }

  function handleSave() {
    if (saved && saved.cardId !== openId) {
      const other = VARIANTS[saved.variant];
      const title = other?.cards.find((c) => c.id === saved.cardId)?.title;
      if (title) {
        const where = saved.variant === variant ? '' : ` (${other.title})`;
        const ok = window.confirm(
          `Ihr habt schon „${title}“${where} gemerkt. Es kann immer nur ein Date gemerkt sein – stattdessen dieses merken?`
        );
        if (!ok) return;
      }
    }
    runSaved(() => saveCard(user, variant, openId), { variant, cardId: openId });
  }

  const handleUnsave = () => runSaved(() => clearSavedCard(user), null);

  function openSaved() {
    setOpenId(savedId);
    window.scrollTo(0, 0);
  }

  // Ohne Quiz (Sexy Time) werden einfach alle Karten gemischt und verteilt.
  function handleStart() {
    if (v.withQuiz) setQuizOpen(true);
    else handleGo(null);
  }

  function handleGo(filters) {
    setQuizOpen(false);
    const matched = shuffle(filters ? cards.filter((c) => matchesFilters(c, filters)) : cards);
    setDeck(
      matched.map((c) => ({
        id: c.id,
        pin: PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)],
        pinX: rand(35, 65),
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
    if (id in doneMap) {
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

  // Aus dem Selfie-Fenster: abhaken (mit oder ohne Foto). Fehler zeigt das
  // Fenster selbst an, deshalb hier weiterwerfen.
  async function handleSaveSelfie(blob) {
    const url = await markCardDone(user, openId, blob);
    setDoneMap((prev) => ({ ...prev, [openId]: blob ? url : prev[openId] ?? null }));
    setSelfieOpen(false);
    // Erledigt – dann braucht es auch nicht mehr gemerkt zu sein.
    if (openId === savedId) {
      clearSavedCard(user).then(() => setSaved(null), () => {});
    }
  }

  // Ohne Selfie-Funktion: direkt abhaken.
  async function handleMarkDone() {
    setBusy(true);
    try {
      await handleSaveSelfie(null);
    } catch {
      setLoadError('Speichern hat nicht geklappt. Bitte später nochmal versuchen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUndo() {
    const msg = v.withSelfie ? 'Karte wieder verdecken? Ein Selfie dazu wird gelöscht.' : 'Karte wieder verdecken?';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await unmarkCardDone(user, openId);
      setDoneMap((prev) => {
        const next = { ...prev };
        delete next[openId];
        return next;
      });
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
          done={openCard.id in doneMap}
          selfie={doneMap[openCard.id]}
          withSelfie={v.withSelfie}
          saved={openCard.id === savedId}
          busy={busy}
          onDone={v.withSelfie ? () => setSelfieOpen(true) : handleMarkDone}
          onUndo={handleUndo}
          onSave={handleSave}
          onUnsave={handleUnsave}
          onBack={() => setConfirmBack(true)}
        />
        {selfieOpen && <SelfieModal alreadyDone={openCard.id in doneMap} onSave={handleSaveSelfie} onClose={() => setSelfieOpen(false)} />}
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
                onClick={onHome}
                style={{ width: '100%', marginTop: 10 }}
              >
                Zurück zur Übersicht
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
        <div className="eyebrow">{v.eyebrow}</div>
        <h1 style={{ fontSize: '1.4rem' }}>{v.title}</h1>
      </div>

      {savedCard && (
        <button type="button" className="fd-saved-go" onClick={openSaved}>
          <span className="fd-sticky-pin is-red" aria-hidden="true" />
          <span className="fd-saved-label">Euer gemerktes Date</span>
          Weiter mit: {savedCard.title} →
        </button>
      )}

      {v.withQuiz && <Legend />}

      {deck && (
        <button type="button" className="btn-primary fd-go" onClick={handleStart}>
          {v.againLabel}
        </button>
      )}

      <div className="fd-frame">
      <div className="fd-board">
        {!deck && (
          <div className="fd-board-empty">
            <span className="fd-sticky is-deco is-start" style={{ '--note': v.notes[0].color, '--rot': '-8deg' }}>
              <span className={`fd-sticky-pin is-${v.notes[0].pin}`} />{v.notes[0].text}
            </span>
            <button type="button" className="fd-banner" onClick={handleStart}>
              <span className="fd-tape is-left" />
              {v.banner}
              <span className="fd-banner-hint">hier klicken 👆</span>
              <span className="fd-tape is-right" />
            </button>
            <span className="fd-sticky is-deco is-end" style={{ '--note': v.notes[1].color, '--rot': '6deg' }}>
              <span className={`fd-sticky-pin is-${v.notes[1].pin}`} />{v.notes[1].text}
            </span>
          </div>
        )}

        {deck && shuffling && (
          <div className="fd-stack" aria-label="Karten werden gemischt">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="fd-stack-card" style={{ animationDelay: `${i * 60}ms` }}>
                <span>{v.faces[i % v.faces.length]}</span>
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
              const card = cards.find((c) => c.id === d.id);
              const idx = cards.indexOf(card);
              const done = d.id in doneMap;
              const photo = doneMap[d.id] || card.cover;
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
                  <span className={`fd-pin is-${d.pin}`} style={{ left: `${d.pinX}%` }} aria-hidden="true" />
                  <span className="fd-card-inner">
                    <span className="fd-face fd-back-face">
                      <span className="fd-photo" style={{ background: PHOTO_BGS[idx % PHOTO_BGS.length] }}>
                        <span className="fd-emoji" aria-hidden="true">{v.faces[idx % v.faces.length]}</span>
                      </span>
                      <span className="fd-caption"><CardIcons card={card} /></span>
                    </span>
                    <span className="fd-face fd-front-face">
                      <span className="fd-photo">
                        {photo ? (
                          <img src={photo} alt="" className="fd-cover" />
                        ) : (
                          <PlaceholderImage />
                        )}
                      </span>
                      <span className="fd-caption fd-card-title">{card.title}</span>
                      {done && <span className="fd-done-stamp">✓ gemacht</span>}
                    </span>
                  </span>
                  {d.id === savedId && <span className="fd-saved-flag">📌 gemerkt</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {loadError && <p className="fd-error">{loadError}</p>}

      {quizOpen && <Quiz onDone={handleGo} onClose={() => setQuizOpen(false)} />}
    </div>
  );
}
