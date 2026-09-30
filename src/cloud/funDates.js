import { supabase, isCloudConfigured } from './supabase.js';

// Speichert, welche Spaß-Dates schon gemacht wurden – samt optionalem
// Erinnerungs-Selfie. Angemeldet liegt das in Supabase (Tabelle
// fun_dates_done + privater Storage-Bucket, beides per RLS nur fürs eigene
// Konto), sonst nur lokal im Browser.

const LOCAL_KEY = 'funDatesDone';
const BUCKET = 'fun-date-selfies';
// So lange gelten die Links auf die privaten Selfies.
const SIGNED_URL_SECONDS = 60 * 60 * 6;

// Lokal: { [cardId]: dataUrl | null }. Ältere Versionen speicherten nur ein
// Array von IDs – das wird hier mit übernommen.
function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY));
    if (Array.isArray(raw)) return Object.fromEntries(raw.map((id) => [id, null]));
    return raw ?? {};
  } catch {
    return {};
  }
}

function writeLocal(map) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {
    // Speicher voll/blockiert – dann eben nur für diese Sitzung.
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Liefert { [cardId]: selfieUrl | null } für alle erledigten Karten.
export async function getDoneCards(user) {
  if (!isCloudConfigured || !user) return readLocal();
  const { data, error } = await supabase.from('fun_dates_done').select('card_id, selfie_path');
  if (error) throw error;
  const rows = data ?? [];
  const paths = rows.map((r) => r.selfie_path).filter(Boolean);
  const urls = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of signed ?? []) if (s.signedUrl) urls[s.path] = s.signedUrl;
  }
  return Object.fromEntries(rows.map((r) => [r.card_id, urls[r.selfie_path] ?? null]));
}

// Hakt eine Karte ab (optional mit Selfie als JPEG-Blob). Liefert die URL des
// Selfies zurück (oder null).
export async function markCardDone(user, cardId, selfieBlob) {
  if (!isCloudConfigured || !user) {
    const map = readLocal();
    map[cardId] = selfieBlob ? await blobToDataUrl(selfieBlob) : map[cardId] ?? null;
    writeLocal(map);
    return map[cardId];
  }
  let selfiePath = null;
  let url = null;
  if (selfieBlob) {
    selfiePath = `${user.id}/${cardId}.jpg`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(selfiePath, selfieBlob, { upsert: true, contentType: 'image/jpeg' });
    if (upErr) throw upErr;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(selfiePath, SIGNED_URL_SECONDS);
    // Cache-Buster, damit ein ersetztes Foto sofort neu geladen wird.
    url = data?.signedUrl ? `${data.signedUrl}&v=${Date.now()}` : null;
  }
  // Ohne neues Foto selfie_path gar nicht mitschicken, damit ein vorhandenes
  // Selfie beim erneuten Abhaken nicht verloren geht.
  const row = { user_id: user.id, card_id: cardId };
  if (selfiePath) row.selfie_path = selfiePath;
  const { error } = await supabase.from('fun_dates_done').upsert(row, { onConflict: 'user_id,card_id' });
  if (error) throw error;
  return url;
}

// Deckt eine Karte wieder zu und löscht ein evtl. vorhandenes Selfie.
export async function unmarkCardDone(user, cardId) {
  if (!isCloudConfigured || !user) {
    const map = readLocal();
    delete map[cardId];
    writeLocal(map);
    return;
  }
  await supabase.storage.from(BUCKET).remove([`${user.id}/${cardId}.jpg`]);
  const { error } = await supabase.from('fun_dates_done').delete().eq('card_id', cardId);
  if (error) throw error;
}

// ── Gemerktes Date ─────────────────────────────────────────────────────────
// Über Spaß-Dates und Sexy Time hinweg kann genau EIN Date gemerkt sein,
// damit das Paar erst vorbereiten und später direkt wieder hinspringen kann.
// Gespeichert wird { variant: 'dates' | 'sexy', cardId }.
// Angemeldet in Supabase (Tabelle fun_dates_saved, RLS), sonst lokal.

const SAVED_KEY = 'funDatesSaved';

function readSavedLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY));
    if (!raw) return null;
    if (raw.cardId) return raw;
    // Ältere Version: { [variant]: cardId } – den ersten Eintrag übernehmen.
    const [variant, cardId] = Object.entries(raw)[0] ?? [];
    return cardId ? { variant, cardId } : null;
  } catch {
    return null;
  }
}

function writeSavedLocal(saved) {
  try {
    if (saved) localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    else localStorage.removeItem(SAVED_KEY);
  } catch {
    // Speicher voll/blockiert – dann eben nur für diese Sitzung.
  }
}

// Liefert { variant, cardId } oder null.
export async function getSavedCard(user) {
  if (!isCloudConfigured || !user) return readSavedLocal();
  const { data, error } = await supabase
    .from('fun_dates_saved')
    .select('variant, card_id')
    .order('saved_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row ? { variant: row.variant, cardId: row.card_id } : null;
}

// Merkt ein Date und ersetzt dabei jedes vorher gemerkte (auch aus der
// anderen Kachel).
export async function saveCard(user, variant, cardId) {
  if (!isCloudConfigured || !user) {
    writeSavedLocal({ variant, cardId });
    return;
  }
  const { error: delErr } = await supabase.from('fun_dates_saved').delete().eq('user_id', user.id);
  if (delErr) throw delErr;
  const { error } = await supabase
    .from('fun_dates_saved')
    .insert({ user_id: user.id, variant, card_id: cardId });
  if (error) throw error;
}

export async function clearSavedCard(user) {
  if (!isCloudConfigured || !user) {
    writeSavedLocal(null);
    return;
  }
  const { error } = await supabase.from('fun_dates_saved').delete().eq('user_id', user.id);
  if (error) throw error;
}

// Verkleinert ein Foto aufs Handy-taugliche Maß und macht ein JPEG daraus
// (typisch 100–300 KB statt mehrerer MB direkt aus der Kamera).
export async function compressImage(file, maxSide = 1280, quality = 0.82) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  let source = bitmap;
  let w;
  let h;
  if (bitmap) {
    w = bitmap.width;
    h = bitmap.height;
  } else {
    // Fallback für Browser ohne createImageBitmap-Unterstützung des Formats.
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    source = img;
    w = img.naturalWidth;
    h = img.naturalHeight;
  }
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden'))), 'image/jpeg', quality)
  );
}
