import { useEffect, useState } from 'react';
import { isCloudConfigured } from '../cloud/supabase.js';
import {
  listUsers,
  isAdmin,
  displayLogin,
  listInviteCodes,
  createInviteCode,
  deleteInviteCode,
  adminSetPassword,
} from '../cloud/auth.js';

const softText = { color: 'var(--color-text-soft)', fontSize: '0.85rem' };

// Zugangscodes: Die Admin erzeugt hier einen Code und gibt ihn an ein Paar
// weiter. Mit dem Code legt das Paar in der App selbst sein Konto an; danach
// ist der Code verbraucht.
function InviteCodes() {
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

  const open = (codes ?? []).filter((c) => !c.used_at);
  const used = (codes ?? []).filter((c) => c.used_at);

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
      {used.length > 0 && (
        <p style={softText}>
          Verbraucht: {used.map((c) => `${c.code} (${new Date(c.used_at).toLocaleDateString('de-DE')})`).join(', ')}
        </p>
      )}
    </section>
  );
}

// Passwort eines Kontos neu setzen (es gibt keine Reset-E-Mail).
function ResetPassword({ user }) {
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
export default function UsersTab({ currentUser }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!isCloudConfigured) {
      setUsers([]);
      return;
    }
    listUsers()
      .then((u) => alive && setUsers(u))
      .catch((e) => alive && setError(e?.message || String(e)));
    return () => {
      alive = false;
    };
  }, []);

  if (!isCloudConfigured) {
    return (
      <div className="text-tab">
        <p style={{ color: 'var(--color-text-soft)' }}>
          Die Cloud ist nicht eingerichtet – es gibt keine registrierten Nutzer.
        </p>
      </div>
    );
  }

  if (error) {
    // Häufigster Fall: die "profiles"-Tabelle wurde in Supabase noch nicht
    // angelegt (der profiles-Teil aus supabase-setup.sql wurde nie ausgeführt).
    // Supabase meldet das als "schema cache"-Fehler. Dann eine klare Anleitung
    // statt der rohen Fehlermeldung zeigen.
    const missingTable = /schema cache|public\.profiles/i.test(error);
    return (
      <div className="text-tab">
        {missingTable ? (
          <>
            <p style={{ color: 'var(--color-danger, #b3261e)' }}>
              Die Nutzerliste ist in der Cloud noch nicht eingerichtet.
            </p>
            <p style={{ color: 'var(--color-text-soft)', fontSize: '0.9rem' }}>
              Führe im Supabase-Dashboard unter „SQL Editor“ den{' '}
              <code>profiles</code>-Teil aus <code>supabase-setup.sql</code> aus
              (Tabelle, Policy und Trigger). Danach erscheinen die registrierten
              Konten hier automatisch.
            </p>
          </>
        ) : (
          <p style={{ color: 'var(--color-danger, #b3261e)' }}>
            Nutzer konnten nicht geladen werden: {error}
          </p>
        )}
      </div>
    );
  }

  if (users === null) {
    return (
      <div className="text-tab">
        <p style={{ color: 'var(--color-text-soft)' }}>Lädt…</p>
      </div>
    );
  }

  return (
    <div className="text-tab">
      <InviteCodes />
      <h3 style={{ marginTop: 0 }}>Registrierte Nutzer ({users.length})</h3>
      <p style={{ color: 'var(--color-text-soft)', fontSize: '0.9rem' }}>
        Nur Benutzername und Anmeldedatum – die Zyklusdaten der Nutzer bleiben privat.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {users.map((u) => {
          const you = u.id === currentUser?.id;
          return (
            <li
              key={u.id}
              className="card"
              style={{ marginBottom: 8 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
              <span style={{ wordBreak: 'break-all' }}>
                {displayLogin(u.email) || '(ohne Benutzername)'}
                {you && (
                  <span style={{ color: 'var(--color-text-soft)', fontSize: '0.85rem' }}>
                    {' '}
                    · du
                  </span>
                )}
                {isAdmin(u) && (
                  <span style={{ color: 'var(--color-text-soft)', fontSize: '0.85rem' }}>
                    {' '}
                    · Admin
                  </span>
                )}
              </span>
              <span
                style={{
                  color: 'var(--color-text-soft)',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {u.created_at
                  ? new Date(u.created_at).toLocaleDateString('de-DE')
                  : ''}
              </span>
              </div>
              {!you && <ResetPassword user={u} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
