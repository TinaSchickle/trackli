import { supabase, isCloudConfigured } from './supabase.js';

// Speichert, welche Spaß-Dates schon gemacht wurden. Angemeldet liegt das in
// Supabase (Tabelle fun_dates_done, per RLS nur fürs eigene Konto sichtbar),
// sonst nur lokal im Browser.

const LOCAL_KEY = 'funDatesDone';

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? [];
  } catch {
    return [];
  }
}

function writeLocal(ids) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
  } catch {
    // Speicher blockiert (z. B. privater Modus) – dann eben nur für diese Sitzung.
  }
}

// Liefert die IDs aller erledigten Karten.
export async function getDoneCardIds(user) {
  if (!isCloudConfigured || !user) return readLocal();
  const { data, error } = await supabase.from('fun_dates_done').select('card_id');
  if (error) throw error;
  return (data ?? []).map((r) => r.card_id);
}

// Markiert eine Karte als erledigt (done=true) oder deckt sie wieder zu.
export async function setCardDone(user, cardId, done) {
  if (!isCloudConfigured || !user) {
    const ids = readLocal().filter((id) => id !== cardId);
    if (done) ids.push(cardId);
    writeLocal(ids);
    return;
  }
  const { error } = done
    ? await supabase
        .from('fun_dates_done')
        .upsert({ user_id: user.id, card_id: cardId }, { onConflict: 'user_id,card_id' })
    : await supabase.from('fun_dates_done').delete().eq('card_id', cardId);
  if (error) throw error;
}
