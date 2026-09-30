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
// Pro Kachel (variant: 'dates' | 'sexy') kann genau ein Date gemerkt sein,
// damit das Paar erst vorbereiten und später direkt wieder hinspringen kann.
// Angemeldet in Supabase (Tabelle fun_dates_saved, RLS), sonst lokal.

const SAVED_KEY = 'funDatesSaved';

function readSavedLocal() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writeSavedLocal(map) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(map));
  } catch {
    // Speicher voll/blockiert – dann eben nur für diese Sitzung.
  }
}

// Liefert die ID des gemerkten Dates oder null.
export async function getSavedCard(user, variant) {
  if (!isCloudConfigured || !user) return readSavedLocal()[variant] ?? null;
  const { data, error } = await supabase
    .from('fun_dates_saved')
    .select('card_id')
    .eq('variant', variant)
    .maybeSingle();
  if (error) throw error;
  return data?.card_id ?? null;
}

// Merkt ein Date (ersetzt ein vorher gemerktes).
export async function saveCard(user, variant, cardId) {
  if (!isCloudConfigured || !user) {
    writeSavedLocal({ ...readSavedLocal(), [variant]: cardId });
    return;
  }
  const { error } = await supabase
    .from('fun_dates_saved')
    .upsert(
      { user_id: user.id, variant, card_id: cardId, saved_at: new Date().toISOString() },
      { onConflict: 'user_id,variant' }
    );
  if (error) throw error;
}

export async function clearSavedCard(user, variant) {
  if (!isCloudConfigured || !user) {
    const map = readSavedLocal();
    delete map[variant];
    writeSavedLocal(map);
    return;
  }
  const { error } = await supabase.from('fun_dates_saved').delete().eq('variant', variant);
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
