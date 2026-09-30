import { useEffect, useState } from 'react';
import { isCloudConfigured } from '../cloud/supabase.js';
import { getUser, onAuthChange, isAdmin, signIn, signOut, displayLogin } from '../cloud/auth.js';
import { adminOverview, adminSetTiles, listInviteCodes, listResetCodes } from './api.js';
import { HUB_TILES } from '../tiles.js';
import { CARDS } from '../funDates/cards.js';
import { InviteCodes, ResetCode, softText } from './AdminParts.jsx';

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

// Übersicht: eine Zeile pro Nutzer, eine Spalte pro Kachel. Ein Klick auf
// ein Feld schaltet die Kachel für diesen Nutzer an/aus (sofort gespeichert).
function TileMatrix({ rows, onTilesChange }) {
  const [saving, setSaving] = useState(null); // "userId:tileKey"
  const [error, setError] = useState(null);

  async function toggle(row, key) {
    const next = row.tiles.includes(key) ? row.tiles.filter((t) => t !== key) : [...row.tiles, key];
    setSaving(`${row.user_id}:${key}`);
    setError(null);
    try {
      await adminSetTiles(row.user_id, next);
      onTilesChange(row.user_id, next);
    } catch {
      setError('Speichern fehlgeschlagen – bitte nochmal versuchen.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="card adm-matrix-card">
      <div className="adm-matrix-scroll">
        <table className="adm-matrix">
          <thead>
            <tr>
              <th scope="col">Nutzer</th>
              {HUB_TILES.map((t) => (
                <th key={t.key} scope="col">
                  <span aria-hidden="true">{t.icon}</span>
                  <br />
                  {t.title}
                  {!t.active && <div className="adm-soon">noch in Arbeit</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const admin = isAdmin({ email: row.email });
              const names = [row.her_name, row.his_name].filter(Boolean).join(' & ');
              return (
                <tr key={row.user_id}>
                  <th scope="row">
                    {names || row.username || displayLogin(row.email)}
                    <div style={softText}>
                      {names ? row.username || displayLogin(row.email) : ''}
                      {admin && (names ? ' · ' : '') + 'Admin'}
                    </div>
                  </th>
                  {HUB_TILES.map((t) => {
                    const on = admin || row.tiles.includes(t.key);
                    const busy = saving === `${row.user_id}:${t.key}`;
                    return (
                      <td key={t.key}>
                        <button
                          type="button"
                          className={`adm-cell${on ? ' is-on' : ''}`}
                          aria-pressed={on}
                          aria-label={`${t.title} für ${names || row.username || row.email} ${on ? 'sichtbar' : 'ausgeblendet'}`}
                          title={admin ? 'Admin sieht immer alle Kacheln' : on ? 'Sichtbar – klicken zum Ausblenden' : 'Ausgeblendet – klicken zum Freischalten'}
                          disabled={admin || saving !== null}
                          onClick={() => toggle(row, t.key)}
                        >
                          {busy ? '…' : on ? '✓' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="adm-error">{error}</p>}
    </div>
  );
}

// inviteCode: der Zugangscode, mit dem dieses Konto angelegt wurde (oder null).
function CoupleCard({ row, inviteCode, resetCode, onResetCodeChange }) {
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
          {inviteCode && (
            <div>
              <dt>Zugangscode</dt>
              <dd>
                <strong style={{ letterSpacing: '0.08em' }}>{inviteCode.code}</strong>
                <span style={softText}> · eingelöst {formatDate(inviteCode.used_at)}</span>
              </dd>
            </div>
          )}
        </dl>
      </header>

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

      {!admin && (
        <section>
          <h4>Passwort vergessen?</h4>
          <ResetCode userId={row.user_id} resetCode={resetCode} onChange={onResetCodeChange} />
        </section>
      )}
    </article>
  );
}

function Overview() {
  const [rows, setRows] = useState(null);
  const [codeByUser, setCodeByUser] = useState({});
  const [resetByUser, setResetByUser] = useState({});
  const [error, setError] = useState(null);

  function reload() {
    setError(null);
    // Codes dazuladen, um jedem Konto seinen eingelösten Code zuzuordnen.
    Promise.all([adminOverview(), listInviteCodes().catch(() => []), listResetCodes().catch(() => [])])
      .then(([overview, codes, resets]) => {
        setCodeByUser(Object.fromEntries(codes.filter((c) => c.used_by).map((c) => [c.used_by, c])));
        setResetByUser(Object.fromEntries(resets.map((r) => [r.user_id, r])));
        setRows(overview);
      })
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
      <h3 className="adm-subhead">Welche Kacheln sieht wer?</h3>
      <p style={softText}>
        Farbig mit ✓ = sichtbar. Klicken schaltet um und speichert sofort; das Paar sieht es beim
        nächsten Öffnen der App. Neue Paare sehen zuerst nur den Fragebogen.
      </p>
      <TileMatrix
        rows={rows}
        onTilesChange={(userId, tiles) =>
          setRows((prev) => prev.map((p) => (p.user_id === userId ? { ...p, tiles } : p)))
        }
      />

      <h3 className="adm-subhead">Details & Fortschritt</h3>
      <p style={softText}>Ohne Zyklusdaten und ohne Selfies – die bleiben privat beim Paar.</p>
      <div className="adm-grid">
        {rows.map((r) => (
          <CoupleCard
            key={r.user_id}
            row={r}
            inviteCode={codeByUser[r.user_id] ?? null}
            resetCode={resetByUser[r.user_id] ?? null}
            onResetCodeChange={(rc) => setResetByUser((prev) => ({ ...prev, [r.user_id]: rc }))}
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
