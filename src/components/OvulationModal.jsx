// Popup, sobald die doppelte Kontrolle (Temperatur + Schleim/Muttermund)
// erfüllt ist: der Eisprung hat stattgefunden.

export default function OvulationModal({ infertileFrom, method, onDismiss }) {
  return (
    <div className="modal-backdrop ov-backdrop" onClick={onDismiss}>
      <div className="modal-sheet ov-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ov-modal-icon" aria-hidden="true">🌸</div>
        <h2 style={{ fontSize: '1.2rem' }}>Eisprung hat stattgefunden*</h2>
        <p>
          Die doppelte Kontrolle ist erfüllt ({method}). Die unfruchtbare Phase
          beginnt am Abend des <strong>{infertileFrom}</strong>.
        </p>
        <p className="ov-modal-disclaimer">
          * Nach den uns vorliegenden Werten berechnet – keine Haftung,
          Softwarefehler vorbehalten.
        </p>
        <div className="ov-modal-actions">
          <button type="button" className="btn-primary" onClick={onDismiss}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
