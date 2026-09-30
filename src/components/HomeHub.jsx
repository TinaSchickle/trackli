import { getCoupleNames } from '../cloud/auth.js';
import { isCloudConfigured } from '../cloud/supabase.js';

// Kacheln der Startseite. Weitere Bereiche kommen hier einfach dazu;
// solange `active` false ist, wird die Kachel ausgegraut als „Bald" gezeigt.
export const HUB_TILES = [
  { key: 'questionnaire', title: 'Fragebogen', subtitle: 'Hier fängt alles an', icon: '📝', active: false },
  { key: 'trackli', title: 'Trackli', subtitle: 'Zykluskalender nach Sensiplan', icon: '🌙', active: true },
  { key: 'dates', title: 'Spaß-Dates', subtitle: 'Ideen für gemeinsame Zeit', icon: '🎈', active: true },
  { key: 'sexy', title: 'Sexy Time', subtitle: 'Nur für euch zwei', icon: '🔥', active: false },
];

export default function HomeHub({ user, onOpen, onAccount }) {
  const { her, him } = getCoupleNames(user);
  const names = [her, him].filter(Boolean).join(' & ');

  // Ohne Anmeldung keine Kacheln zeigen (die dahinterliegenden Bereiche sind
  // eh gesperrt) – stattdessen nur ein zentrierter Einloggen-Button.
  if (isCloudConfigured && !user) {
    return (
      <div className="screen hub hub-loggedout">
        <button type="button" className="hub-login-btn" onClick={onAccount}>
          Einloggen
        </button>
      </div>
    );
  }

  return (
    <div className="screen hub">
      {/* Oben rechts: Zahnrad (Konto) bzw. „Einloggen“. Der Dialog dahinter
          bietet Anmelden und Registrieren an. */}
      {isCloudConfigured && (
        <div className="hub-topbar">
          {user ? (
            <button
              type="button"
              className="hub-account is-icon"
              onClick={onAccount}
              aria-label="Konto & Einstellungen"
              title="Konto & Einstellungen"
            >
              ⚙️
            </button>
          ) : (
            <button type="button" className="hub-account" onClick={onAccount}>
              Einloggen
            </button>
          )}
        </div>
      )}

      <h1 className="hub-greeting">
        Hi{names ? ` ${names}` : ''} <span className="hub-heart">&lt;3</span>
      </h1>

      {isCloudConfigured && user && !names && (
        <button type="button" className="hub-hint" onClick={onAccount}>
          Tragt über ⚙️ eure Namen ein, dann begrüßen wir euch persönlich.
        </button>
      )}

      <div className="hub-grid">
        {HUB_TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`hub-tile${t.active ? '' : ' is-inactive'}`}
            disabled={!t.active}
            onClick={() => onOpen(t.key)}
          >
            <span className="hub-tile-icon" aria-hidden="true">{t.icon}</span>
            <span className="hub-tile-title">{t.title}</span>
            <span className="hub-tile-sub">{t.active ? t.subtitle : 'Bald verfügbar'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
