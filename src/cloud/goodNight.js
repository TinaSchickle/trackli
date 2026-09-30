import { supabase, isCloudConfigured } from './supabase.js';

// Good Night: pro Abend genau eine gezogene Aufgabe. Angemeldet liegt sie in
// Supabase (Tabelle good_night_draws, RLS nur fürs eigene Konto) – so sehen
// beide Handys des Paars dieselbe Aufgabe. Ohne Anmeldung nur lokal.
//
// Ein „Abend“ ist ein Datum (YYYY-MM-DD); was vor 5 Uhr früh passiert, zählt
// noch zum Vortag – das rechnet die Komponente aus.

const LOCAL_KEY = 'trackli-good-night';

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writeLocal(state) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {
    // Speicher voll/blockiert – dann eben nur für diese Sitzung.
  }
}

// Liefert { taskId, done } für diesen Abend (bzw. taskId null) plus
// lastTaskId = die Aufgabe des letzten Abends davor.
export async function getDraw(user, evening) {
  if (!isCloudConfigured || !user) {
    const raw = readLocal();
    if (raw.day === evening) return { taskId: raw.taskId, done: !!raw.done, lastTaskId: raw.lastTaskId ?? null };
    return { taskId: null, done: false, lastTaskId: raw.taskId ?? raw.lastTaskId ?? null };
  }
  const { data, error } = await supabase
    .from('good_night_draws')
    .select('evening, task_id, done')
    .lte('evening', evening)
    .order('evening', { ascending: false })
    .limit(2);
  if (error) throw error;
  const rows = data ?? [];
  const today = rows[0]?.evening === evening ? rows[0] : null;
  const before = today ? rows[1] : rows[0];
  return { taskId: today?.task_id ?? null, done: !!today?.done, lastTaskId: before?.task_id ?? null };
}

// Legt die Aufgabe des Abends fest. Hat das andere Handy schneller gezogen,
// gewinnt dessen Aufgabe – zurück kommt immer die tatsächlich gespeicherte.
export async function saveDraw(user, evening, taskId, lastTaskId) {
  if (!isCloudConfigured || !user) {
    writeLocal({ day: evening, taskId, done: false, lastTaskId });
    return { taskId, done: false };
  }
  const { error } = await supabase
    .from('good_night_draws')
    .upsert({ user_id: user.id, evening, task_id: taskId }, { onConflict: 'user_id,evening', ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: readErr } = await supabase
    .from('good_night_draws')
    .select('task_id, done')
    .eq('evening', evening)
    .single();
  if (readErr) throw readErr;
  return { taskId: data.task_id, done: !!data.done };
}

export async function markDrawDone(user, evening) {
  if (!isCloudConfigured || !user) {
    writeLocal({ ...readLocal(), done: true });
    return;
  }
  const { error } = await supabase
    .from('good_night_draws')
    .update({ done: true })
    .eq('evening', evening);
  if (error) throw error;
}
