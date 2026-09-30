import { supabase, isCloudConfigured } from '../cloud/supabase.js';

// Alle Admin-Aufrufe – nur von der Admin-Seite geladen, nie von der App der
// Paare. Supabase prüft jeden davon selbst per is_admin() (RLS bzw. Check in
// der SQL-Funktion); ohne Admin-Konto schlagen sie fehl.

// Nur Admin (RLS): alle Codes, neueste zuerst.
export async function listInviteCodes() {
  if (!isCloudConfigured) return [];
  const { data, error } = await supabase
    .from('invite_codes')
    .select('code, created_at, used_at, used_by')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Ohne leicht verwechselbare Zeichen (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export async function createInviteCode() {
  const code = randomCode();
  const { error } = await supabase.from('invite_codes').insert({ code });
  if (error) throw error;
  return code;
}

export async function deleteInviteCode(code) {
  const { error } = await supabase.from('invite_codes').delete().eq('code', code);
  if (error) throw error;
}

// ── Passwort-Reset-Codes (ein Code pro Konto, 7 Tage gültig) ─────────────────
export async function listResetCodes() {
  if (!isCloudConfigured) return [];
  const { data, error } = await supabase.from('password_reset_codes').select('code, user_id, created_at');
  if (error) throw error;
  return data ?? [];
}

// Erzeugt einen neuen Reset-Code für das Konto (ersetzt einen vorhandenen).
export async function createResetCode(userId) {
  const row = { user_id: userId, code: randomCode(), created_at: new Date().toISOString() };
  const { error } = await supabase.from('password_reset_codes').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
  return row;
}

export async function deleteResetCode(userId) {
  const { error } = await supabase.from('password_reset_codes').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function adminOverview() {
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) throw error;
  return data ?? [];
}

export async function adminSetTiles(userId, tiles) {
  const { error } = await supabase
    .from('tile_access')
    .upsert({ user_id: userId, tiles, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
