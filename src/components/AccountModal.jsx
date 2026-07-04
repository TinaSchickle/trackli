import { useState } from 'react';
import { isCloudConfigured } from '../cloud/supabase.js';
import { signIn, signUp, signOut, isAdmin } from '../cloud/auth.js';

// Übersetzt die häufigsten Supabase-Auth-Fehler ins Deutsche.
function humanError(err) {
  const msg = (err && err.message) || String(err);
  if (/invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort falsch.';
  if (/user already registered/i.test(msg)) return 'Für diese E-Mail gibt es schon ein Konto. Melde dich an.';
  if (/password should be at least/i.test(msg)) return 'Passwort zu kurz (mind. 6 Zeichen).';
  if (/email not confirmed/i.test(msg)) return 'Bitte bestätige zuerst deine E-Mail (Link im Postfach).';
  if (/rate limit|too many/i.test(msg)) return 'Zu viele Versuche. Bitte kurz warten.';
  return msg;
}

export default function AccountModal({
  user,
  syncing,
  lastSyncAt,
  syncError,
  onSyncNow,
  onClose,
}) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { session } = await signUp(email.trim(), password);
        // Ist E-Mail-Bestätigung aktiv, gibt es noch keine Session.
        if (!session) {
          setInfo('Konto angelegt. Bestätige den Link, den wir dir per E-Mail geschickt haben, und melde dich dann an.');
          setMode('signin');
        }
        // Bei Erfolg mit Session übernimmt der Auth-Listener in App (Sync + Reload).
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Konto &amp; Sync</h3>

        {!isCloudConfigured && (
          <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem' }}>
            Die Cloud-Synchronisierung ist noch nicht eingerichtet. Deine Daten
            liegen aktuell nur auf diesem Gerät. Sobald die Supabase-Zugangsdaten
            hinterlegt sind, kannst du dich hier anmelden und auf mehreren Geräten
            auf dieselben Daten zugreifen.
          </p>
        )}

        {isCloudConfigured && user && (
          <>
            <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem', marginTop: 0 }}>
              Angemeldet als <strong>{user.email}</strong>
              {isAdmin(user) && ' (Administrator)'}. Deine Daten werden
              zwischen deinen Geräten synchronisiert.
            </p>
            <div
              style={{
                fontSize: '0.85rem',
                color: syncError ? 'var(--color-danger, #b3261e)' : 'var(--color-text-soft)',
                marginBottom: 12,
              }}
            >
              {syncing
                ? 'Synchronisiere…'
                : syncError
                  ? `Letzter Sync fehlgeschlagen: ${syncError}`
                  : lastSyncAt
                    ? `Zuletzt synchronisiert: ${new Date(lastSyncAt).toLocaleString('de-DE')}`
                    : 'Noch nicht synchronisiert.'}
            </div>
            <button
              className="btn-primary"
              onClick={onSyncNow}
              disabled={syncing}
              style={{ marginBottom: 10 }}
            >
              Jetzt synchronisieren
            </button>
            <button
              className="btn-secondary"
              onClick={handleSignOut}
              disabled={busy}
              style={{ width: '100%', marginBottom: 10 }}
            >
              Abmelden
            </button>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-soft)' }}>
              Beim Abmelden werden die lokalen Daten auf diesem Gerät entfernt.
              Sie bleiben in der Cloud gespeichert und stehen nach der nächsten
              Anmeldung wieder zur Verfügung.
            </p>
          </>
        )}

        {isCloudConfigured && !user && (
          <>
            <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem', marginTop: 0 }}>
              {mode === 'signin'
                ? 'Melde dich an, um deine Daten auf mehreren Geräten zu nutzen.'
                : 'Lege ein Konto an. Deine bereits auf diesem Gerät gespeicherten Einträge werden dabei in die Cloud übernommen.'}
            </p>
            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
                E-Mail
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
              />
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
                Passwort
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', marginBottom: 14, boxSizing: 'border-box' }}
              />
              {error && (
                <p style={{ color: 'var(--color-danger, #b3261e)', fontSize: '0.85rem', marginTop: 0 }}>
                  {error}
                </p>
              )}
              {info && (
                <p style={{ color: 'var(--color-text-soft)', fontSize: '0.85rem', marginTop: 0 }}>
                  {info}
                </p>
              )}
              <button className="btn-primary" type="submit" disabled={busy} style={{ marginBottom: 10 }}>
                {busy ? 'Bitte warten…' : mode === 'signin' ? 'Anmelden' : 'Konto anlegen'}
              </button>
            </form>
            <button
              className="btn-secondary"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setInfo(null);
              }}
              style={{ width: '100%' }}
            >
              {mode === 'signin' ? 'Neues Konto anlegen' : 'Ich habe schon ein Konto'}
            </button>
          </>
        )}

        <button
          className="btn-secondary"
          onClick={onClose}
          style={{ width: '100%', marginTop: 10, border: 'none' }}
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
