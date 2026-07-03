// Wiederverwendbarer Umschalter (Temperatur · Zervixschleim · Muttermund),
// genutzt in Regeln (Auswertungserklärung) und How To (Mess-Anleitung).

export default function SignSwitch({ options, value, onChange }) {
  return (
    <div className="seg-switch" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          className={`seg-switch-btn${value === o.key ? ' active' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {o.icon && <span aria-hidden="true">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const SIGN_OPTIONS = [
  { key: 'temp', label: 'Temperatur', icon: '🌡️' },
  { key: 'mucus', label: 'Schleim', icon: '💧' },
  { key: 'cervix', label: 'Muttermund', icon: '👆' },
];
