const TABS = [
  { key: 'entry', label: 'Eintrag', icon: '✏️' },
  { key: 'calendar', label: 'Kalender', icon: '📅' },
  { key: 'status', label: 'Status', icon: '🔎' },
  { key: 'evaluation', label: 'Auswertung', icon: '📖' },
  { key: 'rules', label: 'Regeln', icon: '📋' },
  { key: 'appRules', label: 'App', icon: '⚙️' },
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'archive', label: 'Verlauf', icon: '🗂️' },
];

export default function Nav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={active === t.key ? 'active' : ''}
            onClick={() => onChange(t.key)}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
