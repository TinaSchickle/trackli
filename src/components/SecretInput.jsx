// Passwortfeld, das Browser möglichst NICHT als Passwortfeld erkennen – damit
// sie weder „Passwort speichern?“ anbieten noch es automatisch einsetzen. Das
// Paar soll seinen Leitsatz bei jedem Login selbst im Kopf wiederholen.
//
// Trick: ein normales Textfeld, das per CSS (-webkit-text-security) Punkte
// statt Zeichen zeigt. Browser ohne diese CSS-Eigenschaft bekommen ein echtes
// Passwortfeld – lieber speicherbar als im Klartext sichtbar.
// Eine Garantie gibt es nicht: externe Passwort-Manager entscheiden selbst.
const MASK_SUPPORTED =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  (CSS.supports('-webkit-text-security', 'disc') || CSS.supports('text-security', 'disc'));

export default function SecretInput({ value, onChange, show = false, style, ...rest }) {
  if (!MASK_SUPPORTED) {
    return (
      <input
        type={show ? 'text' : 'password'}
        autoComplete="off"
        value={value}
        onChange={onChange}
        style={style}
        {...rest}
      />
    );
  }
  return (
    <input
      type="text"
      // Keine Hinweise auf „Passwort“ für Browser und gängige Passwort-Manager.
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      data-lpignore="true"
      data-1p-ignore="true"
      data-bwignore="true"
      data-form-type="other"
      value={value}
      onChange={onChange}
      style={{ ...style, WebkitTextSecurity: show ? 'none' : 'disc', textSecurity: show ? 'none' : 'disc' }}
      {...rest}
    />
  );
}
