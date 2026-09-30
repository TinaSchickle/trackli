import { useEffect, useRef, useState } from 'react';
import {
  SECTIONS,
  OPEN_SECTIONS,
  TOTAL_QUESTIONS,
  XP_PER_QUESTION,
  questionLabel,
  isAnswered,
} from '../questionnaire/questions.js';
import { loadAnswers, saveAnswers } from '../cloud/questionnaire.js';
import { getCoupleNames } from '../cloud/auth.js';
import { formatDateDe } from '../utils/nfp.js';
import { todayIso } from '../utils/dates.js';

const CONFETTI_ICONS = ['🎉', '✨', '💖', '⭐', '🌸', '💫'];
const CONFETTI_MS = 1400;
const XP_POP_MS = 900;

function makeConfetti(count = 22) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 80 + Math.random() * 110;
    return {
      id: i,
      icon: CONFETTI_ICONS[i % CONFETTI_ICONS.length],
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist - 40),
      delay: Math.round(Math.random() * 200),
      size: 0.9 + Math.random() * 0.9,
    };
  });
}

function sectionDone(section, answers) {
  return section.questions.filter((q) => isAnswered(q, answers[q.id])).length;
}

function summary(q, value) {
  if (q.type === 'date') return formatDateDe(value);
  if (q.type === 'single') {
    const o = q.options.find((x) => x.value === value);
    return o ? `${o.icon} ${o.label}` : '';
  }
  return q.options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label)
    .join(', ');
}

function DateQuestion({ q, value, onAnswer }) {
  const [draft, setDraft] = useState(value ?? '');
  return (
    <div className="qn-date">
      <input type="date" value={draft} max={todayIso()} onChange={(e) => setDraft(e.target.value)} />
      <button type="button" className="btn-primary" disabled={!draft} onClick={() => onAnswer(draft)}>
        Weiter ✓
      </button>
    </div>
  );
}

function SingleQuestion({ q, value, onAnswer }) {
  return (
    <div className="qn-options">
      {q.options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`qn-option${value === o.value ? ' qn-option--on' : ''}`}
          onClick={() => onAnswer(o.value)}
        >
          <span className="qn-option-icon" aria-hidden="true">{o.icon}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function MultiQuestion({ q, value, onAnswer }) {
  const [picked, setPicked] = useState(Array.isArray(value) ? value : []);
  if (!q.options.length) return <p className="qn-soon">Die Auswahl folgt bald ✨</p>;

  function toggle(o) {
    setPicked((cur) => {
      if (cur.includes(o.value)) return cur.filter((v) => v !== o.value);
      // „Nichts Auffälliges“/„Weiß ich nicht“ schließen alles andere aus.
      if (o.exclusive) return [o.value];
      const exclusive = new Set(q.options.filter((x) => x.exclusive).map((x) => x.value));
      return [...cur.filter((v) => !exclusive.has(v)), o.value];
    });
  }

  return (
    <>
      <div className="qn-options">
        {q.options.map((o) => {
          const on = picked.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              className={`qn-option${on ? ' qn-option--on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(o)}
            >
              <span className="qn-check" aria-hidden="true">{on ? '✓' : ''}</span>
              <span className="qn-option-icon" aria-hidden="true">{o.icon}</span>
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="btn-primary qn-next"
        disabled={!picked.length}
        onClick={() => onAnswer(picked)}
      >
        Weiter ✓
      </button>
    </>
  );
}

const QUESTION_TYPES = { date: DateQuestion, single: SingleQuestion, multi: MultiQuestion };

function Question({ q, names, value, current, onAnswer, onCancel }) {
  const Body = QUESTION_TYPES[q.type];
  return (
    <div className={`qn-q${current ? ' qn-q--current' : ''}`}>
      <div className="qn-q-head">
        <span className="qn-q-icon" aria-hidden="true">{q.icon}</span>
        <span className="qn-q-label">{questionLabel(q, names)}</span>
        {current && <span className="qn-now">Jetzt dran</span>}
      </div>
      <Body q={q} value={value} onAnswer={onAnswer} />
      {onCancel && (
        <button type="button" className="qn-cancel" onClick={onCancel}>
          Abbrechen
        </button>
      )}
    </div>
  );
}

export default function Questionnaire({ user, onHome }) {
  const names = getCoupleNames(user);
  const [answers, setAnswers] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [editing, setEditing] = useState(null);
  const [openSection, setOpenSection] = useState(null);
  const [xpPop, setXpPop] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const timers = useRef([]);
  const lastSaved = useRef(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    let alive = true;
    setAnswers(null);
    loadAnswers(user)
      .then((a) => alive && setAnswers(a))
      .catch((e) => {
        if (!alive) return;
        setLoadError(e.message || 'Laden fehlgeschlagen');
        setAnswers({});
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  function later(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }

  async function persist(next) {
    lastSaved.current = next;
    setSaveState('saving');
    try {
      await saveAnswers(user, next);
      if (lastSaved.current === next) setSaveState('saved');
    } catch {
      if (lastSaved.current === next) setSaveState('error');
    }
  }

  function answer(section, q, value) {
    const wasNew = !isAnswered(q, answers[q.id]);
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    setEditing(null);
    persist(next);
    if (!wasNew) return;

    const popId = Date.now();
    setXpPop(popId);
    later(() => setXpPop((cur) => (cur === popId ? null : cur)), XP_POP_MS);

    const finishedSection = sectionDone(section, next) === section.questions.length;
    if (finishedSection) {
      const allDone = OPEN_SECTIONS.every((s) => sectionDone(s, next) === s.questions.length);
      setConfetti({ id: popId, items: makeConfetti(allDone ? 34 : 22), badge: section, allDone });
      later(() => setConfetti((cur) => (cur?.id === popId ? null : cur)), CONFETTI_MS + 1200);
      setOpenSection(null);
    }
  }

  if (!answers) {
    return (
      <div className="screen">
        <button type="button" className="fd-back" onClick={onHome}>← Übersicht</button>
        <p className="fd-intro">Fragebogen wird geladen …</p>
      </div>
    );
  }

  const answeredCount = OPEN_SECTIONS.reduce((n, s) => n + sectionDone(s, answers), 0);
  const xp = answeredCount * XP_PER_QUESTION;
  const maxXp = TOTAL_QUESTIONS * XP_PER_QUESTION;
  const pct = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);
  const activeSection = OPEN_SECTIONS.find((s) => sectionDone(s, answers) < s.questions.length);
  const shownSection = openSection ?? activeSection?.id;

  return (
    <div className="screen">
      <button type="button" className="fd-back" onClick={onHome}>← Übersicht</button>
      <div className="app-header" style={{ padding: '4px 0 12px' }}>
        <div className="eyebrow">Hier fängt alles an</div>
        <h1 style={{ fontSize: '1.4rem' }}>Fragebogen</h1>
      </div>

      <div className="card qn-hero">
        <div className="qn-hero-top">
          <div>
            <div className="qn-xp">
              {xp} <span>/ {maxXp} XP</span>
            </div>
            <div className="qn-hero-sub">
              {pct === 100 ? 'Alles geschafft – ihr seid großartig!' : `${answeredCount} von ${TOTAL_QUESTIONS} Fragen beantwortet`}
            </div>
          </div>
          <div className="qn-save" data-state={saveState} aria-live="polite">
            {saveState === 'saving' && 'Speichert …'}
            {saveState === 'saved' && 'Zwischengespeichert ✓'}
            {saveState === 'error' && (
              <button type="button" onClick={() => persist(answers)}>
                Nicht gespeichert – nochmal
              </button>
            )}
          </div>
        </div>
        <div className="qn-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="qn-bar-fill" style={{ width: `${pct}%` }} />
          {xpPop && (
            <span key={xpPop} className="qn-xp-pop" style={{ left: `calc(${pct}% - 24px)` }} aria-hidden="true">
              +{XP_PER_QUESTION} XP
            </span>
          )}
        </div>
        <div className="qn-badges">
          {SECTIONS.map((s) => {
            const earned = !s.comingSoon && sectionDone(s, answers) === s.questions.length;
            return (
              <div key={s.id} className={`qn-badge${earned ? ' qn-badge--earned' : ''}`} title={s.badge}>
                <span className="qn-badge-icon" aria-hidden="true">{earned ? s.icon : '🔒'}</span>
                <span className="qn-badge-name">{s.badge}</span>
              </div>
            );
          })}
        </div>
        {loadError && <p className="qn-error">Konnte gespeicherte Antworten nicht laden: {loadError}</p>}
      </div>

      {SECTIONS.map((section, sIdx) => {
        const done = sectionDone(section, answers);
        const complete = !section.comingSoon && done === section.questions.length;
        const open = !section.comingSoon && shownSection === section.id;
        const firstOpen = section.questions.find((q) => !isAnswered(q, answers[q.id]));
        return (
          <section
            key={section.id}
            className={`card qn-level${complete ? ' qn-level--done' : ''}${section.comingSoon ? ' qn-level--locked' : ''}`}
          >
            <button
              type="button"
              className="qn-level-head"
              disabled={section.comingSoon}
              aria-expanded={open}
              onClick={() => setOpenSection(open ? '__none' : section.id)}
            >
              <span className="qn-level-icon" aria-hidden="true">{section.comingSoon ? '🔒' : section.icon}</span>
              <span className="qn-level-text">
                <span className="qn-level-kicker">Level {sIdx + 1}</span>
                <span className="qn-level-title">{section.title}</span>
              </span>
              <span className="qn-level-count">
                {section.comingSoon ? 'Bald' : complete ? '🏅' : `${done}/${section.questions.length}`}
              </span>
            </button>
            {!section.comingSoon && (
              <div className="qn-dots" aria-hidden="true">
                {section.questions.map((q) => (
                  <span key={q.id} className={isAnswered(q, answers[q.id]) ? 'on' : ''} />
                ))}
              </div>
            )}
            {section.comingSoon && <p className="qn-soon">Die Fragen zu eurem Kinderwunsch folgen bald ✨</p>}

            {open && (
              <div className="qn-questions">
                {section.questions.map((q) => {
                  const value = answers[q.id];
                  const answered = isAnswered(q, value);
                  if (answered && editing !== q.id) {
                    return (
                      <button key={q.id} type="button" className="qn-done-row" onClick={() => setEditing(q.id)}>
                        <span className="qn-done-check" aria-hidden="true">✓</span>
                        <span className="qn-done-text">
                          <span className="qn-done-label">{questionLabel(q, names)}</span>
                          <span className="qn-done-value">{summary(q, value)}</span>
                        </span>
                        <span className="qn-edit">ändern</span>
                      </button>
                    );
                  }
                  return (
                    <Question
                      key={q.id}
                      q={q}
                      names={names}
                      value={value}
                      current={!answered && q === firstOpen}
                      onAnswer={(v) => answer(section, q, v)}
                      onCancel={answered ? () => setEditing(null) : null}
                    />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {confetti && (
        <div className="qn-celebrate" role="status" onClick={() => setConfetti(null)}>
          <div className="qn-celebrate-card">
            {confetti.items.map((c) => (
              <span
                key={c.id}
                className="qn-confetti"
                aria-hidden="true"
                style={{ '--dx': `${c.dx}px`, '--dy': `${c.dy}px`, animationDelay: `${c.delay}ms`, fontSize: `${c.size}rem` }}
              >
                {c.icon}
              </span>
            ))}
            <div className="qn-celebrate-icon" aria-hidden="true">{confetti.allDone ? '🏆' : confetti.badge.icon}</div>
            <div className="qn-celebrate-title">
              {confetti.allDone ? 'Fragebogen geschafft!' : `Level „${confetti.badge.title}“ geschafft!`}
            </div>
            <div className="qn-celebrate-sub">Abzeichen „{confetti.badge.badge}“ freigeschaltet</div>
          </div>
        </div>
      )}
    </div>
  );
}
