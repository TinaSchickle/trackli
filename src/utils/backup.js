import { getAllEntries, getAllArchivedCharts } from '../db.js';

export async function exportBackup() {
  const [entries, archivedCharts] = await Promise.all([
    getAllEntries(),
    getAllArchivedCharts(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    entries,
    archivedCharts,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `zykluskalender-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
