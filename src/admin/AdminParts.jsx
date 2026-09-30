import { useEffect, useState } from 'react';
import {
  listInviteCodes,
  createInviteCode,
  deleteInviteCode,
  adminSetPassword,
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

// Passwort eines Kontos neu setzen (es gibt keine Reset-E-Mail).
export function ResetPassword({ user }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await adminSetPassword(user.id, pw);
      setMsg('Neues Passwort gesetzt – jetzt dem Paar weitergeben.');
      setPw('');
    } catch (err) {
      const m = err?.message || String(err);
      setMsg(/PASSWORD_TOO_SHORT/.test(m) ? 'Mindestens 6 Zeichen.' : m);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-secondary"
        style={{ fontSize: '0.8rem', padding: '4px 10px', marginTop: 8 }}
        onClick={() => setOpen(true)}
      >
        Passwort zurücksetzen
      </button>
    );
  }
  return (
    <form onSubmit={handleSave} style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      <input
        type="text"
        required
        minLength={6}
        autoComplete="off"
        placeholder="Neues Passwort"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        style={{ flex: 1, minWidth: 0 }}
      />
      <button type="submit" className="btn-secondary" disabled={busy} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
        {busy ? '…' : 'Setzen'}
      </button>
      {msg && <div style={{ ...softText, width: '100%' }}>{msg}</div>}
    </form>
  );
}

// Admin-Ansicht: Liste aller registrierten Konten (nur E-Mail + Anmeldedatum,
// keine Zyklusdaten). Die Daten liefert die "profiles"-Tabelle; welche Zeilen
// sichtbar sind, entscheidet die Row-Level-Security in Supabase.
