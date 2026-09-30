import { useEffect, useState } from 'react';
import { isCloudConfigured } from '../cloud/supabase.js';
import {
  signOut,
  isAdmin,
  updatePassword,
  getCoupleNames,
  displayLogin,
} from '../cloud/auth.js';
import {
  isPushSupported,
  isPushConfigured,
  enableDailyReminder,
  getReminderTime,
  DEFAULT_REMINDER_TIME,
  setReminderTime,
  getGoodNightTime,
  setGoodNightTime,
  DEFAULT_GOOD_NIGHT_TIME,
} from '../cloud/push.js';
import InfoToggle from './InfoToggle.jsx';
import LoginPanel from './LoginPanel.jsx';

const REMINDER_MODULES_INFO =
  'Geprüft werden alle nicht deaktivierten Module: Temperatur, Zervixschleim, Muttermund, Spucke-Test.';

// Alle Halbstundenschritte 00:00–23:30 als "H:M"-Wertepaare fürs Dropdown.
const REMINDER_SLOTS = Array.from({ length: 48 }, (_, i) => ({
  hour: Math.floor(i / 2),
  minute: i % 2 === 0 ? 0 : 30,
}));

const fmtTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

// Uhrzeit der Good-Night-Erinnerung (immer aktiv, nur die Zeit ist wählbar).
// Wie oben: erst „Übernehmen“ speichert, damit das Auswahlrad nicht
// zwischendurch speichert.
function GoodNightTimeSetting() {
  const [draft, setDraft] = useState(DEFAULT_GOOD_NIGHT_TIME);
  const [saved, setSaved] = useState(DEFAULT_GOOD_NIGHT_TIME);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getGoodNightTime()
      .then((t) => {
        setDraft(t);
        setSaved(t);
      })
      .catch((err) => setError(humanError(err)));
  }, []);

  async function apply() {
    setError(null);
    setSaving(true);
    try {
      await setGoodNightTime(draft.hour, draft.minute);
      setSaved(draft);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  }

  const changed = draft.hour !== saved.hour || draft.minute !== saved.minute;
  return (
    <div style={{ marginBottom: 12, fontSize: '0.9rem' }}>
      <label>
        Good Night: Erinnerung um{' '}
        <select
          value={`${draft.hour}:${draft.minute}`}
          onChange={(e) => {
            const [hour, minute] = e.target.value.split(':').map(Number);
            setDraft({ hour, minute });
          }}
          style={{ fontSize: '0.9rem' }}
        >
          {REMINDER_SLOTS.map(({ hour, minute }) => (
            <option key={`${hour}:${minute}`} value={`${hour}:${minute}`}>
              {fmtTime(hour, minute)}
            </option>
          ))}
        </select>{' '}
        Uhr
      </label>
      {changed && (
        <button
          type="button"
          className="btn-secondary"
          onClick={apply}
          disabled={saving}
          style={{ marginLeft: 8, fontSize: '0.8rem', padding: '2px 8px' }}
        >
          {saving ? 'Speichert…' : 'Übernehmen'}
        </button>
      )}
      {error && (
        <p style={{ color: 'var(--color-danger, #b3261e)', fontSize: '0.85rem', marginTop: 6, marginBottom: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}

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

// "Tina und Pascal" aus den Paar-Namen; ohne Namen der Login als Fallback.
function accountLabel(user) {
  const { her, him } = getCoupleNames(user);
  const names = [her, him].filter(Boolean).join(' und ');
  return names || displayLogin(user);
}

export default function AccountModal({
  user,
  syncing,
  lastSyncAt,
  syncError,
  recovery,
  onRecoveryDone,
  onClose,
  showGoodNight = false,
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Die Erinnerung ist immer aktiv; offen ist höchstens noch die
  // Benachrichtigungs-Erlaubnis dieses Geräts (braucht einen Klick).
  const [needsPermission, setNeedsPermission] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState(null);
  // reminderTime ist der Entwurf im Dropdown, savedReminderTime der zuletzt
  // tatsächlich gespeicherte Wert. Getrennt, damit ein Scrollen durchs native
  // Auswahlrad (feuert auf Android manchmal Zwischen-onChange-Events) nicht
  // sofort ungewollt speichert – erst der "Übernehmen"-Klick persistiert.
  const [reminderTime, setReminderTimeState] = useState(DEFAULT_REMINDER_TIME);
  const [savedReminderTime, setSavedReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [reminderTimeSaving, setReminderTimeSaving] = useState(false);

  useEffect(() => {
    if (isCloudConfigured && user) {
      if (isPushConfigured && isPushSupported()) {
        if (Notification.permission === 'granted') {
          // Subscription sicherstellen (idempotent), falls sie fehlt.
          enableDailyReminder().catch((err) => setReminderError(humanError(err)));
        } else {
          setNeedsPermission(true);
        }
      }
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

  async function handleAllowNotifications() {
    setReminderError(null);
    setReminderBusy(true);
    try {
      const result = await enableDailyReminder();
      if (result === 'granted') {
        setNeedsPermission(false);
      } else if (result === 'denied') {
        setReminderError('Benachrichtigungen wurden blockiert – Erlaubnis in den Handy-/Browser-Einstellungen für diese Seite ändern.');
      } else if (result === 'unsupported') {
        setReminderError('Push-Benachrichtigungen werden auf diesem Gerät/Browser nicht unterstützt (bei iPhone: App über „Zum Home-Bildschirm" installieren und von dort öffnen).');
      }
    } catch (err) {
      setReminderError(humanError(err));
    } finally {
      setReminderBusy(false);
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

  // Nach Rückkehr über den Zurücksetzen-Link: neues Passwort speichern.
  async function handleNewPassword(e) {
    e.preventDefault();
    setError(null);
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
              Angemeldet als <strong>{accountLabel(user)}</strong>
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
                <label style={{ display: 'block', fontSize: '0.9rem' }}>
                  <span>
                    Erinnere mich um{' '}
                    <select
                      value={`${reminderTime.hour}:${reminderTime.minute}`}
                      disabled={reminderBusy}
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
                    {(reminderTime.hour !== savedReminderTime.hour ||
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
                {showGoodNight && <GoodNightTimeSetting />}
                {needsPermission && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAllowNotifications}
                    disabled={reminderBusy}
                    style={{ width: '100%', marginTop: 6 }}
                  >
                    {reminderBusy ? 'Bitte warten…' : 'Benachrichtigungen auf diesem Gerät erlauben'}
                  </button>
                )}
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

        {isCloudConfigured && !user && !recovery && <LoginPanel />}

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
