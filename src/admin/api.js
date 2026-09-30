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

export async function createInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  const { error } = await supabase.from('invite_codes').insert({ code });
  if (error) throw error;
  return code;
}

export async function deleteInviteCode(code) {
  const { error } = await supabase.from('invite_codes').delete().eq('code', code);
  if (error) throw error;
}

// Nur Admin: Passwort eines Kontos neu setzen (es gibt keine Reset-E-Mail).
export async function adminSetPassword(userId, password) {
  const { error } = await supabase.rpc('admin_set_password', { p_user: userId, p_password: password });
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
