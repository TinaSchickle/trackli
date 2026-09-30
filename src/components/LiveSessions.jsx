import { useState } from 'react';
import { LIVE_IDEAS } from '../liveSessions/ideas.js';

export default function LiveSessions({ onHome }) {
  const [openId, setOpenId] = useState(null);
  const open = LIVE_IDEAS.find((i) => i.id === openId);

  return (
    <div className="screen">
      <button type="button" className="fd-back" onClick={onHome}>← Übersicht</button>
      <div className="app-header" style={{ padding: '4px 0 12px' }}>
        <div className="eyebrow">Ideensammlung</div>
        <h1 style={{ fontSize: '1.4rem' }}>Live Sessions</h1>
      </div>

      {LIVE_IDEAS.length === 0 ? (
        <p className="fd-intro">Noch keine Ideen gesammelt.</p>
      ) : (
        <div className="hub-grid">
          {LIVE_IDEAS.map((idea) => (
            <button key={idea.id} type="button" className="hub-tile" onClick={() => setOpenId(idea.id)}>
              <span className="hub-tile-icon" aria-hidden="true">{idea.icon ?? '💡'}</span>
              <span className="hub-tile-title">{idea.title}</span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="modal-backdrop" onClick={() => setOpenId(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{open.icon ?? '💡'} {open.title}</h3>
            {open.notes?.length ? (
              <ul className="live-notes">
                {open.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="fd-intro">Noch keine Notizen.</p>
            )}
            <button type="button" className="btn-secondary" onClick={() => setOpenId(null)} style={{ width: '100%', marginTop: 14 }}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
