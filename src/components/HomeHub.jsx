import { getCoupleNames } from '../cloud/auth.js';
import { isCloudConfigured } from '../cloud/supabase.js';
import { HUB_TILES } from '../tiles.js';


// allowedTiles: Kachel-Keys, die dieses Konto sehen darf (null = alle,
// undefined = wird noch geladen). Gesetzt wird das pro Paar auf der
// Admin-Seite; neue Paare sehen nur den Fragebogen.
export default function HomeHub({ user, allowedTiles, onOpen, onAccount }) {
  const { her, him } = getCoupleNames(user);
  const names = [her, him].filter(Boolean).join(' & ');

  // Ohne Anmeldung keine Kacheln zeigen (die dahinterliegenden Bereiche sind
  // eh gesperrt) – stattdessen nur ein zentrierter Einloggen-Button.
  if (isCloudConfigured && !user) {
    return (
      <div className="screen hub hub-loggedout">
        <h1 className="hub-welcome">
          Herzlich willkommen
          <br />
          bei Trackli
        </h1>
        <p className="hub-welcome-sub">
          Schön, dass ihr da seid <span className="hub-heart">&lt;3</span>
        </p>
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
        Hi{names ? ` ${names}` : ''} <span className="hub-heart" role="img" aria-label="Pärchen">💑</span>
      </h1>

      {isCloudConfigured && user && !names && (
        <button type="button" className="hub-hint" onClick={onAccount}>
          Tragt über ⚙️ eure Namen ein, dann begrüßen wir euch persönlich.
        </button>
      )}

      <div className="hub-grid">
        {(allowedTiles === undefined
          ? []
          : HUB_TILES.filter((t) => allowedTiles === null || allowedTiles.includes(t.key))
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            className={`hub-tile${t.active ? '' : ' is-inactive'}${t.featured ? ' is-featured' : ''}`}
            disabled={!t.active}
            onClick={() => onOpen(t.key)}
          >
            <span className="hub-tile-icon" aria-hidden="true">{t.icon}</span>
            <span className="hub-tile-title">{t.title}</span>
            <span className="hub-tile-sub">
              {t.active ? t.subtitle : t.featured ? `${t.subtitle} · bald verfügbar` : 'Bald verfügbar'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
