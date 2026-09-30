import { useEffect, useRef, useState } from 'react';
import {
  signIn,
  checkInviteCode,
  redeemInviteCode,
  checkResetCode,
  redeemResetCode,
  normalizeUsername,
  suggestUsername,
  USERNAME_PATTERN,
} from '../cloud/auth.js';

// Übersetzt die häufigsten Supabase-Auth-Fehler ins Deutsche.
function humanError(err) {
  const msg = (err && err.message) || String(err);
  if (/invalid login credentials/i.test(msg)) return 'Benutzername oder Passwort falsch.';
  if (/user already registered|already been registered/i.test(msg))
    return 'Diesen Benutzernamen gibt es schon. Bitte einen anderen wählen.';
  if (/INVALID_RESET_CODE/i.test(msg)) return 'Der Reset-Code ist ungültig oder abgelaufen.';
  if (/PASSWORD_TOO_SHORT/i.test(msg)) return 'Passwort zu kurz (mind. 6 Zeichen).';
  if (/INVALID_INVITE_CODE|database error saving new user/i.test(msg))
    return 'Der Zugangscode ist ungültig oder wurde schon benutzt.';
  if (/password should be at least/i.test(msg)) return 'Passwort zu kurz (mind. 6 Zeichen).';
  if (/email not confirmed/i.test(msg))
    return 'Konto angelegt, aber noch gesperrt. Schreib Tina, sie schaltet es frei.';
  if (/signups not allowed|signup is disabled/i.test(msg))
    return 'Registrieren ist gerade abgeschaltet. Schreib Tina.';
  if (/rate limit|too many/i.test(msg)) return 'Zu viele Versuche. Bitte kurz warten.';
  return msg;
}

const labelStyle = { display: 'block', fontSize: '0.85rem', marginBottom: 4 };
const inputStyle = { width: '100%', marginBottom: 12, boxSizing: 'border-box' };
const linkStyle = {
  display: 'block',
  background: 'transparent',
  border: 'none',
  padding: 0,
  marginBottom: 12,
  color: 'var(--color-text-soft)',
  fontSize: '0.85rem',
  textDecoration: 'underline',
  cursor: 'pointer',
};

// Abgemeldete Ansicht im Konto-Dialog:
//   'signin' – Benutzername + Passwort
//   'code'   – Zugangscode eingeben
//   'setup'  – nach gültigem Code: Namen, Benutzername, Passwort festlegen
//   'reset'  – Passwort vergessen: Reset-Code von Tina eingeben
//   'resetPw'– nach gültigem Reset-Code: neues Passwort festlegen
export default function LoginPanel() {
  const [step, setStep] = useState('signin');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [her, setHer] = useState('');
  const [him, setHim] = useState('');
  const [username, setUsername] = useState('');
  // Zuletzt automatisch vorgeschlagener Benutzername – solange das Feld genau
  // diesen Wert (oder nichts) enthält, darf der Vorschlag nachgeführt werden.
  const lastSuggestion = useRef('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [resetCode, setResetCode] = useState('');

  // Benutzername aus den Namen vorschlagen – erst wenn Ihr UND Sein Name
  // eingetragen sind, und nur solange das Feld leer ist bzw. noch den letzten
  // Vorschlag enthält (selbst Geändertes wird nie überschrieben).
  useEffect(() => {
    if (!her.trim() || !him.trim()) return;
    if (username.trim() && username !== lastSuggestion.current) return;
    const next = suggestUsername(her, him);
    lastSuggestion.current = next;
    setUsername(next);
    // Nur auf Namensänderungen reagieren; username wird bewusst nur gelesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [her, him]);

  function goTo(next) {
    setStep(next);
    setError(null);
    setPassword('');
    setPassword2('');
  }

  async function run(fn) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleSignIn(e) {
    e.preventDefault();
    // Nach Erfolg übernimmt der Auth-Listener in App (Dialog zu, Sync).
    run(() => signIn(login, password));
  }

  function handleCode(e) {
    e.preventDefault();
    run(async () => {
      if (await checkInviteCode(code)) goTo('setup');
      else setError('Der Zugangscode ist ungültig oder wurde schon benutzt.');
    });
  }

  function handleResetCode(e) {
    e.preventDefault();
    run(async () => {
      if (await checkResetCode(resetCode)) goTo('resetPw');
      else setError('Der Reset-Code ist ungültig oder abgelaufen.');
    });
  }

  function handleResetPassword(e) {
    e.preventDefault();
    if (password !== password2) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    // Nach Erfolg meldet redeemResetCode an; der Auth-Listener in App schließt
    // den Dialog.
    run(() => redeemResetCode(resetCode, password));
  }

  function handleSetup(e) {
    e.preventDefault();
    const name = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(name)) {
      setError('Benutzername: 3–30 Zeichen, nur Buchstaben a–z, Ziffern, Punkt, _ oder -.');
      return;
    }
    if (password !== password2) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    run(() => redeemInviteCode({ code, username: username.trim(), password, her, him }));
  }

  const errorEl = error && (
    <p style={{ color: 'var(--color-danger, #b3261e)', fontSize: '0.85rem', marginTop: 0 }}>{error}</p>
  );

  if (step === 'reset') {
    return (
      <>
        <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem', marginTop: 0 }}>
          Passwort vergessen? Fordere bei Tina einen <strong>Passwort-Reset-Code</strong> an und
          gib ihn hier ein.
        </p>
        <form onSubmit={handleResetCode}>
          <label style={labelStyle}>Passwort-Reset-Code</label>
          <input
            type="text"
            required
            autoComplete="off"
            autoCapitalize="characters"
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value.toUpperCase())}
            style={{ ...inputStyle, letterSpacing: '0.15em', fontWeight: 600 }}
          />
          {errorEl}
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginBottom: 10 }}>
            {busy ? 'Bitte warten…' : 'Weiter'}
          </button>
        </form>
        <button type="button" style={linkStyle} onClick={() => goTo('signin')}>
          Zurück zum Anmelden
        </button>
      </>
    );
  }

  if (step === 'resetPw') {
    return (
      <>
        <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem', marginTop: 0 }}>
          Code passt! Legt jetzt ein neues Passwort fest – gern wieder aus eurem Leitsatz.
        </p>
        <form onSubmit={handleResetPassword}>
          <label style={labelStyle}>Neues Passwort</label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <label style={labelStyle}>Neues Passwort wiederholen</label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.85rem', marginBottom: 14 }}>
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Passwort anzeigen
          </label>
          {errorEl}
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginBottom: 10 }}>
            {busy ? 'Bitte warten…' : 'Passwort speichern & anmelden'}
          </button>
        </form>
      </>
    );
  }

  if (step === 'code') {
    return (
      <>
        <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem', marginTop: 0 }}>
          Gib den Zugangscode ein, den du von Tina bekommen hast.
        </p>
        <form onSubmit={handleCode}>
          <label style={labelStyle}>Zugangscode</label>
          <input
            type="text"
            required
            autoComplete="off"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ ...inputStyle, letterSpacing: '0.15em', fontWeight: 600 }}
          />
          {errorEl}
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginBottom: 10 }}>
            {busy ? 'Bitte warten…' : 'Weiter'}
          </button>
        </form>
        <button type="button" style={linkStyle} onClick={() => goTo('signin')}>
          Ich habe schon ein Konto
        </button>
      </>
    );
  }

  if (step === 'setup') {
    return (
      <>
        <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem', marginTop: 0 }}>
          Code passt! Jetzt noch eure Namen und eure Zugangsdaten festlegen.
        </p>
        <form onSubmit={handleSetup}>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1, minWidth: 0, fontSize: '0.85rem' }}>
              Ihr Name
              <input
                type="text"
                required
                autoComplete="off"
                value={her}
                onChange={(e) => setHer(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </label>
            <label style={{ flex: 1, minWidth: 0, fontSize: '0.85rem' }}>
              Sein Name
              <input
                type="text"
                required
                autoComplete="off"
                value={him}
                onChange={(e) => setHim(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </label>
          </div>
          <label style={labelStyle}>Benutzername (zum Anmelden – könnt ihr ändern)</label>
          <input
            type="text"
            required
            // Nicht als Login-Feld markieren: sonst füllen Browser/Passwort-
            // Manager hier einen gespeicherten Namen ein und der Vorschlag
            // aus den beiden Namen käme nie.
            autoComplete="off"
            autoCapitalize="none"
            name="new-couple-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
          />

          <div className="login-task">
            <strong>Eure erste Aufgabe 💪</strong>
            <p>
              Was ist ein starker, positiver Leitsatz, der euch durch die nächsten Wochen tragen
              wird? Macht aus den Anfangsbuchstaben euer Passwort.
            </p>
            <p>
              Beispiel: <em>„Unsere Liebe gewinnt immer“</em> kann zu{' '}
              <code>ULgi888&lt;3</code> werden.
            </p>
            <details className="login-why">
              <summary>Warum?</summary>
              <p>
                Bei jedem Einloggen sagt ihr euch euren Leitsatz im Kopf vor. Was man oft
                wiederholt, fängt man an zu glauben – so wird er Stück für Stück Teil von euch.
              </p>
            </details>
          </div>

          <label style={labelStyle}>Passwort</label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <label style={labelStyle}>Passwort wiederholen</label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.85rem', marginBottom: 14 }}>
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Passwort anzeigen
          </label>
          {errorEl}
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginBottom: 10 }}>
            {busy ? 'Bitte warten…' : 'Konto anlegen & los'}
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem', marginTop: 0 }}>
        Melde dich mit deinem Benutzernamen an.
      </p>
      <form onSubmit={handleSignIn}>
        <label style={labelStyle}>Benutzername</label>
        <input
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          style={inputStyle}
        />
        <label style={labelStyle}>Passwort</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...inputStyle, marginBottom: 14 }}
        />
        {errorEl}
        <button className="btn-primary" type="submit" disabled={busy} style={{ marginBottom: 10 }}>
          {busy ? 'Bitte warten…' : 'Anmelden'}
        </button>
        <button type="button" style={linkStyle} onClick={() => goTo('reset')}>
          Passwort vergessen?
        </button>
      </form>
      <button className="btn-secondary" onClick={() => goTo('code')} style={{ width: '100%' }}>
        Ich habe einen Zugangscode
      </button>
    </>
  );
}
