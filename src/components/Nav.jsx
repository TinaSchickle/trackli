// access:
//   'public' – ohne Anmeldung sichtbar
//   'user'   – nur für angemeldete Nutzer
//   'admin'  – nur für Administratoren
export const TABS = [
  { key: 'entry', label: 'Eintrag', icon: '✏️', access: 'user' },
  { key: 'calendar', label: 'Kalender', icon: '📅', access: 'user' },
  { key: 'status', label: 'Status', icon: '🔎', access: 'user' },
  { key: 'evaluation', label: 'Regeln', icon: '📖', access: 'public' },
  { key: 'rules', label: "So geht's", icon: '📋', access: 'public' },
  { key: 'appRules', label: 'App', icon: '⚙️', access: 'admin' },
  { key: 'users', label: 'User', icon: '👥', access: 'admin' },
  { key: 'dashboard', label: 'Dashboard', icon: '📊', access: 'user' },
];

// Welche Tabs für den aktuellen Anmeldezustand sichtbar sind.
export function visibleTabs({ authed, admin }) {
  return TABS.filter((t) => {
    if (t.access === 'public') return true;
    if (t.access === 'admin') return admin;
    return authed; // 'user'
  });
}

export default function Nav({ tabs = TABS, active, onChange }) {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {tabs.map((t) => (
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
