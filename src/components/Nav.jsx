const TABS = [
  { key: 'entry', label: 'Eintrag' },
  { key: 'calendar', label: 'Kalender' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'archive', label: 'Verlauf' },
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
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
