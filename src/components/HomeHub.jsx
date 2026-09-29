import { getCoupleNames } from '../cloud/auth.js';
import { isCloudConfigured } from '../cloud/supabase.js';

// Kacheln der Startseite. Weitere Bereiche kommen hier einfach dazu;
// solange `active` false ist, wird die Kachel ausgegraut als „Bald" gezeigt.
export const HUB_TILES = [
  { key: 'trackli', title: 'Trackli', subtitle: 'Zykluskalender nach Sensiplan', icon: '🌙', active: true },
  { key: 'dates', title: 'Spaß-Dates', subtitle: 'Ideen für gemeinsame Zeit', icon: '🎈', active: false },
  { key: 'sexy', title: 'Sexy Time', subtitle: 'Nur für euch zwei', icon: '🔥', active: false },
];

export default function HomeHub({ user, onOpen, onAccount }) {
  const { her, him } = getCoupleNames(user);
  const names = [her, him].filter(Boolean).join(' & ');

  return (
    <div className="screen hub">
      <div className="hub-head">
        <h1 className="hub-greeting">
          Hi{names ? ` ${names}` : ''} <span className="hub-heart">&lt;3</span>
        </h1>
        {isCloudConfigured && user && (
          <button type="button" className="hub-account" onClick={onAccount}>
            Konto
          </button>
        )}
      </div>

      {isCloudConfigured && !user && (
        <button type="button" className="card hub-login" onClick={onAccount}>
          <strong>Anmelden</strong>
          <div>Melde dich an, um alle Bereiche zu nutzen.</div>
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
