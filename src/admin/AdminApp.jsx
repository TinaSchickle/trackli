import { useEffect, useState } from 'react';
import { isCloudConfigured } from '../cloud/supabase.js';
import { getUser, onAuthChange, isAdmin, signIn, signOut, displayLogin } from '../cloud/auth.js';
import { adminOverview, adminSetTiles } from './api.js';
import { HUB_TILES } from '../tiles.js';
import { CARDS } from '../funDates/cards.js';
import { InviteCodes, ResetPassword, softText } from './AdminParts.jsx';

// Eigene Admin-Seite (admin.html), getrennt von der App der Paare: Der Code
// hier wird dort nie geladen. Die eigentliche Absicherung liegt trotzdem in
// Supabase – admin_overview(), tile_access-Schreibrechte, Zugangscodes und
// Passwort-Reset prüfen serverseitig per is_admin().

function formatDate(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString('de-DE', { dateStyle: 'medium' });
}

function LoginForm() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(login, password);
    } catch {
      setError('Anmeldung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card adm-login" onSubmit={handleSubmit}>
      <h2>Admin-Anmeldung</h2>
      <label>
        E-Mail
        <input type="email" required autoComplete="email" value={login} onChange={(e) => setLogin(e.target.value)} />
      </label>
      <label>
        Passwort
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="adm-error">{error}</p>}
      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Bitte warten…' : 'Anmelden'}
      </button>
    </form>
  );
}

function TileToggles({ row, onChange }) {
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  async function toggle(key) {
    const next = row.tiles.includes(key) ? row.tiles.filter((t) => t !== key) : [...row.tiles, key];
    setSaving(key);
    setError(null);
    try {
      await adminSetTiles(row.user_id, next);
      onChange(next);
    } catch {
      setError('Speichern fehlgeschlagen.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="adm-tiles">
        {HUB_TILES.map((t) => {
          const on = row.tiles.includes(t.key);
          return (
            <button
              key={t.key}
              type="button"
              className={`adm-tile${on ? ' is-on' : ''}`}
              aria-pressed={on}
              disabled={saving !== null}
              onClick={() => toggle(t.key)}
              title={t.active ? '' : 'Kachel ist noch in Arbeit (für alle ausgegraut)'}
            >
              <span aria-hidden="true">{t.icon}</span> {t.title}
              {!t.active && <span className="adm-soon">bald</span>}
              {saving === t.key && ' …'}
            </button>
          );
        })}
      </div>
      {error && <p className="adm-error">{error}</p>}
    </div>
  );
}

function CoupleCard({ row, onTilesChange }) {
  const names = [row.her_name, row.his_name].filter(Boolean).join(' & ');
  const admin = isAdmin({ email: row.email });
  return (
    <article className="card adm-couple">
      <header className="adm-couple-head">
        <div>
          <h3>{names || <span style={softText}>(noch keine Namen)</span>}</h3>
          <div style={softText}>
            {row.username || displayLogin(row.email)}
            {admin && ' · Admin'}
          </div>
        </div>
        <dl className="adm-meta">
          <div>
            <dt>Dabei seit</dt>
            <dd>{formatDate(row.created_at)}</dd>
          </div>
          <div>
            <dt>Zuletzt angemeldet</dt>
            <dd>{formatDate(row.last_sign_in_at, true)}</dd>
          </div>
        </dl>
      </header>

      <section>
        <h4>Sichtbare Kacheln</h4>
        {admin ? (
          <p style={softText}>Admin sieht immer alle Kacheln.</p>
        ) : (
          <TileToggles row={row} onChange={onTilesChange} />
        )}
      </section>

      <section>
        <h4>Fortschritt</h4>
        <div className="adm-progress">
          <span>🎈 Spaß-Dates</span>
          <progress max={CARDS.length} value={Number(row.dates_done)} />
          <span>
            {row.dates_done} / {CARDS.length} gemacht · {row.dates_selfies} 📸
          </span>
        </div>
      </section>

      {!admin && <ResetPassword user={{ id: row.user_id }} />}
    </article>
  );
}

function Overview() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  function reload() {
    setError(null);
    adminOverview()
      .then(setRows)
      .catch((e) => {
        const m = e?.message || String(e);
        setError(
          /admin_overview|schema cache|function/i.test(m)
            ? 'Die Admin-Übersicht ist in Supabase noch nicht eingerichtet (Abschnitt „Admin-Seite“ aus supabase-setup.sql ausführen).'
            : m
        );
      });
  }

  useEffect(reload, []);

  if (error) return <p className="adm-error">{error}</p>;
  if (!rows) return <p style={softText}>Lädt…</p>;

  const couples = rows.filter((r) => !isAdmin({ email: r.email }));
  return (
    <>
      <div className="adm-section-head">
        <h2>Paare ({couples.length})</h2>
        <button type="button" className="btn-secondary" onClick={reload}>
          Aktualisieren
        </button>
      </div>
      <p style={softText}>
        Ohne Zyklusdaten und ohne Selfies – die bleiben privat beim Paar. Neue Paare sehen
        zuerst nur den Fragebogen.
      </p>
      <div className="adm-grid">
        {rows.map((r) => (
          <CoupleCard
            key={r.user_id}
            row={r}
            onTilesChange={(tiles) =>
              setRows((prev) => prev.map((p) => (p.user_id === r.user_id ? { ...p, tiles } : p)))
            }
          />
        ))}
      </div>
    </>
  );
}

export default function AdminApp() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    if (!isCloudConfigured) {
      setUser(null);
      return undefined;
    }
    getUser().then(setUser);
    return onAuthChange((u) => setUser(u));
  }, []);

  let content;
  if (!isCloudConfigured) {
    content = <p className="adm-error">Supabase ist in diesem Build nicht eingerichtet.</p>;
  } else if (user === undefined) {
    content = <p style={softText}>Lädt…</p>;
  } else if (!user) {
    content = <LoginForm />;
  } else if (!isAdmin(user)) {
    content = (
      <div className="card adm-login">
        <h2>Kein Zugriff</h2>
        <p style={softText}>Dieses Konto hat keine Admin-Rechte.</p>
        <button className="btn-secondary" type="button" onClick={signOut}>
          Abmelden
        </button>
      </div>
    );
  } else {
    content = (
      <>
        <Overview />
        <div className="card adm-codes">
          <InviteCodes />
        </div>
      </>
    );
  }

  return (
    <div className="adm-shell">
      <header className="adm-header">
        <div>
          <div className="eyebrow">Trackli</div>
          <h1>Admin</h1>
        </div>
        {user && (
          <button type="button" className="btn-secondary" onClick={signOut}>
            Abmelden
          </button>
        )}
      </header>
      {content}
    </div>
  );
}
