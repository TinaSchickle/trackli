// Popup, sobald die doppelte Kontrolle (Temperatur + Schleim/Muttermund)
// erfüllt ist: der Eisprung hat stattgefunden.

export default function OvulationModal({ infertileFrom, method, onKeepLogging, onFinish }) {
  return (
    <div className="modal-backdrop ov-backdrop" onClick={onKeepLogging}>
      <div className="modal-sheet ov-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ov-modal-icon" aria-hidden="true">🌸</div>
        <h2 style={{ fontSize: '1.2rem' }}>Eisprung hat stattgefunden</h2>
        <p>
          Die doppelte Kontrolle ist erfüllt ({method}). Die unfruchtbare Phase
          beginnt am Abend des <strong>{infertileFrom}</strong>.
        </p>
        <p style={{ color: 'var(--color-text-soft)', fontSize: '0.9rem' }}>
          Möchtest du den Zykluskalender abschließen oder weiter Werte im aktuellen
          Zyklus eintragen? (Der Zyklus wird zum nächsten Zyklusstart ohnehin geschlossen.)
        </p>
        <div className="ov-modal-actions">
          <button type="button" className="btn-secondary" onClick={onKeepLogging}>
            Weiter Werte eintragen
          </button>
          <button type="button" className="btn-primary" onClick={onFinish}>
            Zykluskalender abschließen
          </button>
        </div>
      </div>
    </div>
  );
}
