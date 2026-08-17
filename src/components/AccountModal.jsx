import { useEffect, useState } from 'react';
import { isCloudConfigured } from '../cloud/supabase.js';
import {
  signIn,
  signUp,
  signOut,
  isAdmin,
  sendPasswordReset,
  updatePassword,
} from '../cloud/auth.js';
import {
  isPushSupported,
  isPushConfigured,
  isDailyReminderEnabled,
  enableDailyReminder,
  disableDailyReminder,
  getReminderTime,
  setReminderTime,
} from '../cloud/push.js';
import InfoToggle from './InfoToggle.jsx';

const REMINDER_MODULES_INFO =
  'Geprüft werden alle nicht deaktivierten Module: Temperatur, Zervixschleim, Muttermund, Spucke-Test.';

// Alle Halbstundenschritte 00:00–23:30 als "H:M"-Wertepaare fürs Dropdown.
const REMINDER_SLOTS = Array.from({ length: 48 }, (_, i) => ({
  hour: Math.floor(i / 2),
  minute: i % 2 === 0 ? 0 : 30,
}));

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
  recovery,
  onRecoveryDone,
  onClose,
}) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState(null);
  // reminderTime ist der Entwurf im Dropdown, savedReminderTime der zuletzt
  // tatsächlich gespeicherte Wert. Getrennt, damit ein Scrollen durchs native
  // Auswahlrad (feuert auf Android manchmal Zwischen-onChange-Events) nicht
  // sofort ungewollt speichert – erst der "Übernehmen"-Klick persistiert.
  const [reminderTime, setReminderTimeState] = useState({ hour: 20, minute: 0 });
  const [savedReminderTime, setSavedReminderTime] = useState({ hour: 20, minute: 0 });
  const [reminderTimeSaving, setReminderTimeSaving] = useState(false);

  useEffect(() => {
    if (isCloudConfigured && user) {
      isDailyReminderEnabled().then(setReminderOn).catch((err) => setReminderError(humanError(err)));
      getReminderTime()
        .then((t) => {
          setReminderTimeState(t);
          setSavedReminderTime(t);
        })
        .catch((err) => setReminderError(humanError(err)));
    }
  }, [user]);

  // Nur der Entwurf im Dropdown – gespeichert wird erst per "Übernehmen"
  // (handleApplyReminderTime), siehe Kommentar beim reminderTime-State.
  function handleChangeTime(e) {
    const [hour, minute] = e.target.value.split(':').map(Number);
    setReminderTimeState({ hour, minute });
  }

  async function handleApplyReminderTime() {
    setReminderError(null);
    setReminderTimeSaving(true);
    try {
      await setReminderTime(reminderTime.hour, reminderTime.minute);
      setSavedReminderTime(reminderTime);
    } catch (err) {
      setReminderError(humanError(err));
    } finally {
      setReminderTimeSaving(false);
    }
  }

  async function handleToggleReminder() {
    setReminderError(null);
    setReminderBusy(true);
    try {
      if (reminderOn) {
        await disableDailyReminder();
        setReminderOn(false);
      } else {
        const result = await enableDailyReminder();
        if (result === 'granted') {
          setReminderOn(true);
        } else if (result === 'denied') {
          setReminderError('Benachrichtigungen wurden blockiert – Erlaubnis in den Handy-/Browser-Einstellungen für diese Seite ändern.');
        } else if (result === 'unsupported') {
          setReminderError('Push-Benachrichtigungen werden auf diesem Gerät/Browser nicht unterstützt (bei iPhone: App über „Zum Home-Bildschirm" installieren und von dort öffnen).');
        }
      }
    } catch (err) {
      setReminderError(humanError(err));
    } finally {
      setReminderBusy(false);
    }
  }

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

  // „Passwort vergessen": Zurücksetzen-E-Mail anfordern.
  async function handleForgot() {
    setError(null);
    setInfo(null);
    const mail = email.trim();
    if (!mail) {
      setError('Bitte zuerst deine E-Mail oben eingeben.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(mail);
      setInfo(
        'Wir haben dir eine E-Mail geschickt. Öffne den Link darin, um ein neues Passwort zu setzen.'
      );
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  // Nach Rückkehr über den Zurücksetzen-Link: neues Passwort speichern.
  async function handleNewPassword(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await updatePassword(password);
      setPassword('');
      onRecoveryDone?.(); // zeigt danach die „Angemeldet als …"-Ansicht
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Konto</h3>

        {!isCloudConfigured && (
          <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem' }}>
            Die Cloud-Synchronisierung ist noch nicht eingerichtet. Deine Daten
            liegen aktuell nur auf diesem Gerät. Sobald die Supabase-Zugangsdaten
            hinterlegt sind, kannst du dich hier anmelden und auf mehreren Geräten
            auf dieselben Daten zugreifen.
          </p>
        )}

        {isCloudConfigured && recovery && (
          <>
            <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem', marginTop: 0 }}>
              Wähle jetzt ein neues Passwort für dein Konto.
            </p>
            <form onSubmit={handleNewPassword}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
                Neues Passwort
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', marginBottom: 14, boxSizing: 'border-box' }}
              />
              {error && (
                <p style={{ color: 'var(--color-danger, #b3261e)', fontSize: '0.85rem', marginTop: 0 }}>
                  {error}
                </p>
              )}
              <button className="btn-primary" type="submit" disabled={busy} style={{ marginBottom: 10 }}>
                {busy ? 'Bitte warten…' : 'Neues Passwort speichern'}
              </button>
            </form>
          </>
        )}

        {isCloudConfigured && user && !recovery && (
          <>
            <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem', marginTop: 0 }}>
              Angemeldet als <strong>{user.email}</strong>
              {isAdmin(user) && ' (Administrator)'}.
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
            {isPushConfigured && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={reminderOn}
                    disabled={reminderBusy || !isPushSupported()}
                    onChange={handleToggleReminder}
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <span style={{ minWidth: 0 }}>
                    Erinnere mich um{' '}
                    <select
                      value={`${reminderTime.hour}:${reminderTime.minute}`}
                      disabled={!reminderOn || reminderBusy}
                      onChange={handleChangeTime}
                      style={{ fontSize: '0.9rem' }}
                    >
                      {REMINDER_SLOTS.map(({ hour, minute }) => (
                        <option key={`${hour}:${minute}`} value={`${hour}:${minute}`}>
                          {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
                        </option>
                      ))}
                    </select>{' '}
                    Uhr, falls bis dahin noch Parameter für den Tag fehlen.
                    {reminderOn &&
                      (reminderTime.hour !== savedReminderTime.hour ||
                        reminderTime.minute !== savedReminderTime.minute) && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleApplyReminderTime}
                          disabled={reminderTimeSaving || reminderBusy}
                          style={{ marginLeft: 8, fontSize: '0.8rem', padding: '2px 8px' }}
                        >
                          {reminderTimeSaving ? 'Speichert…' : 'Übernehmen'}
                        </button>
                      )}
                  </span>
                </label>
                {/* Eigene Zeile, rechtsbündig: hält .info-details' right:0-Popover
                    innerhalb des Modals, statt es mitten im umbrechenden Satz zu
                    verankern (dort konnte es über den Bildschirmrand hinausragen). */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <InfoToggle text={REMINDER_MODULES_INFO} />
                </div>
                {reminderError && (
                  <p style={{ color: 'var(--color-danger, #b3261e)', fontSize: '0.85rem', marginTop: 6, marginBottom: 0 }}>
                    {reminderError}
                  </p>
                )}
              </div>
            )}
            <button
              className="btn-secondary"
              onClick={handleSignOut}
              disabled={busy}
              style={{ width: '100%' }}
            >
              Abmelden
            </button>
          </>
        )}

        {isCloudConfigured && !user && !recovery && (
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
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={busy}
                  style={{
                    display: 'block',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    marginBottom: 12,
                    color: 'var(--color-text-soft)',
                    fontSize: '0.85rem',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Passwort vergessen?
                </button>
              )}
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
