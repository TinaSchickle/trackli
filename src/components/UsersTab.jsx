import { useEffect, useState } from 'react';
import { isCloudConfigured } from '../cloud/supabase.js';
import { listUsers, isAdmin } from '../cloud/auth.js';

// Admin-Ansicht: Liste aller registrierten Konten (nur E-Mail + Anmeldedatum,
// keine Zyklusdaten). Die Daten liefert die "profiles"-Tabelle; welche Zeilen
// sichtbar sind, entscheidet die Row-Level-Security in Supabase.
export default function UsersTab({ currentUser }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!isCloudConfigured) {
      setUsers([]);
      return;
    }
    listUsers()
      .then((u) => alive && setUsers(u))
      .catch((e) => alive && setError(e?.message || String(e)));
    return () => {
      alive = false;
    };
  }, []);

  if (!isCloudConfigured) {
    return (
      <div className="text-tab">
        <p style={{ color: 'var(--color-text-soft)' }}>
          Die Cloud ist nicht eingerichtet – es gibt keine registrierten Nutzer.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-tab">
        <p style={{ color: 'var(--color-danger, #b3261e)' }}>
          Nutzer konnten nicht geladen werden: {error}
        </p>
      </div>
    );
  }

  if (users === null) {
    return (
      <div className="text-tab">
        <p style={{ color: 'var(--color-text-soft)' }}>Lädt…</p>
      </div>
    );
  }

  return (
    <div className="text-tab">
      <h3 style={{ marginTop: 0 }}>Registrierte Nutzer ({users.length})</h3>
      <p style={{ color: 'var(--color-text-soft)', fontSize: '0.9rem' }}>
        Nur E-Mail und Anmeldedatum – die Zyklusdaten der Nutzer bleiben privat.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {users.map((u) => {
          const you = u.id === currentUser?.id;
          return (
            <li
              key={u.id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <span style={{ wordBreak: 'break-all' }}>
                {u.email || '(ohne E-Mail)'}
                {you && (
                  <span style={{ color: 'var(--color-text-soft)', fontSize: '0.85rem' }}>
                    {' '}
                    · du
                  </span>
                )}
                {isAdmin(u) && (
                  <span style={{ color: 'var(--color-text-soft)', fontSize: '0.85rem' }}>
                    {' '}
                    · Admin
                  </span>
                )}
              </span>
              <span
                style={{
                  color: 'var(--color-text-soft)',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {u.created_at
                  ? new Date(u.created_at).toLocaleDateString('de-DE')
                  : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
