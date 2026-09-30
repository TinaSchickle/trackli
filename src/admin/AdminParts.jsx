import { useEffect, useState } from 'react';
import {
  listInviteCodes,
  createInviteCode,
  deleteInviteCode,
  createResetCode,
  deleteResetCode,
} from './api.js';

export const softText = { color: 'var(--color-text-soft)', fontSize: '0.85rem' };

// Zugangscodes: Die Admin erzeugt hier einen Code und gibt ihn an ein Paar
// weiter. Mit dem Code legt das Paar in der App selbst sein Konto an; danach
// ist der Code verbraucht.
export function InviteCodes() {
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    listInviteCodes()
      .then(setCodes)
      .catch((e) => setError(e?.message || String(e)));
  }

  useEffect(reload, []);

  async function handleCreate() {
    setError(null);
    setBusy(true);
    try {
      await createInviteCode();
      reload();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(code) {
    if (!window.confirm(`Code ${code} löschen?`)) return;
    try {
      await deleteInviteCode(code);
      reload();
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  // Eingelöste Codes stehen beim Konto, das damit angelegt wurde (Übersicht).
  const open = (codes ?? []).filter((c) => !c.used_at);

  return (
    <section style={{ marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>Zugangscodes</h3>
      <p style={softText}>
        Jeder Code gilt für genau ein Konto. Das Paar gibt ihn bei „Einloggen → Ich habe einen
        Zugangscode“ ein und legt dann Namen, Benutzername und Passwort selbst fest.
      </p>
      <button type="button" className="btn-primary" onClick={handleCreate} disabled={busy} style={{ marginBottom: 12 }}>
        {busy ? 'Erzeugt…' : 'Neuen Zugangscode erzeugen'}
      </button>
      {error && (
        <p style={{ color: 'var(--color-danger, #b3261e)', fontSize: '0.85rem' }}>
          {/invite_codes|schema cache/i.test(error)
            ? 'Die Zugangscodes sind in Supabase noch nicht eingerichtet (Abschnitt „Zugangscodes“ aus supabase-setup.sql ausführen).'
            : error}
        </p>
      )}
      {codes === null && !error && <p style={softText}>Lädt…</p>}
      {open.map((c) => (
        <div
          key={c.code}
          className="card"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}
        >
          <strong style={{ letterSpacing: '0.12em', fontSize: '1.05rem' }}>{c.code}</strong>
          <span style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              onClick={() => navigator.clipboard?.writeText(c.code)}
            >
              Kopieren
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              onClick={() => handleDelete(c.code)}
            >
              Löschen
            </button>
          </span>
        </div>
      ))}
      {codes && open.length === 0 && <p style={softText}>Keine offenen Codes.</p>}
    </section>
  );
}

const RESET_DAYS = 7;

// Passwort-Reset per Code: Die Admin erzeugt pro Konto einen Code und gibt ihn
// weiter; das Paar setzt damit in der App selbst ein neues Passwort. Danach
// ist der Code weg (Supabase löscht ihn beim Einlösen).
export function ResetCode({ userId, resetCode, onChange }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function run(fn) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      const m = e?.message || String(e);
      setMsg(
        /password_reset_codes|schema cache/i.test(m)
          ? 'Reset-Codes sind in Supabase noch nicht eingerichtet (SQL „Passwort-Reset-Codes“ ausführen).'
          : m
      );
    } finally {
      setBusy(false);
    }
  }

  const expires = resetCode
    ? new Date(new Date(resetCode.created_at).getTime() + RESET_DAYS * 86400000)
    : null;
  const expired = expires && expires < new Date();
  const btn = { fontSize: '0.8rem', padding: '4px 10px' };

  return (
    <div className="adm-reset">
      {resetCode ? (
        <>
          <div>
            Reset-Code: <strong style={{ letterSpacing: '0.12em' }}>{resetCode.code}</strong>
            <div style={softText}>
              {expired
                ? 'abgelaufen – bitte neu erzeugen'
                : `gültig bis ${expires.toLocaleDateString('de-DE')} · verschwindet, sobald eingelöst`}
            </div>
          </div>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" style={btn} onClick={() => navigator.clipboard?.writeText(resetCode.code)}>
              Kopieren
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={btn}
              disabled={busy}
              onClick={() => run(async () => onChange(await createResetCode(userId)))}
            >
              Neu erzeugen
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={btn}
              disabled={busy}
              onClick={() => run(async () => {
                await deleteResetCode(userId);
                onChange(null);
              })}
            >
              Löschen
            </button>
          </span>
        </>
      ) : (
        <button
          type="button"
          className="btn-secondary"
          style={btn}
          disabled={busy}
          onClick={() => run(async () => onChange(await createResetCode(userId)))}
        >
          {busy ? 'Erzeugt…' : 'Passwort-Reset-Code erzeugen'}
        </button>
      )}
      {msg && <div style={{ ...softText, width: '100%', color: 'var(--color-danger, #b3261e)' }}>{msg}</div>}
    </div>
  );
}
