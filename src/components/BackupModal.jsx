import { exportBackup } from '../utils/backup.js';

export default function BackupModal({ onClose }) {
  async function handleDownload() {
    await exportBackup();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Neuer Zyklus, neues Backup</h3>
        <p style={{ color: 'var(--color-text-soft)', fontSize: '0.92rem' }}>
          Deine Daten liegen nur auf diesem Gerät. Lade jetzt ein Backup als
          JSON-Datei herunter, um sie zu sichern.
        </p>
        <button className="btn-primary" onClick={handleDownload} style={{ marginBottom: 10 }}>
          Backup herunterladen
        </button>
        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>
          Später erinnern
        </button>
      </div>
    </div>
  );
}
