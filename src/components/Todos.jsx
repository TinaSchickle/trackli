import { TODO_ITEMS } from '../todos/items.js';

export default function Todos({ onHome }) {
  return (
    <div className="screen">
      <button type="button" className="fd-back" onClick={onHome}>← Übersicht</button>
      <div className="app-header" style={{ padding: '4px 0 12px' }}>
        <div className="eyebrow">Offene Punkte</div>
        <h1 style={{ fontSize: '1.4rem' }}>TODOs</h1>
      </div>

      {TODO_ITEMS.length === 0 ? (
        <p className="fd-intro">Gerade nichts offen.</p>
      ) : (
        <ul className="todo-list">
          {TODO_ITEMS.map((t) => (
            <li key={t.id} className="card todo-item">
              <span aria-hidden="true">{t.icon ?? '☐'}</span>
              <span>{t.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
