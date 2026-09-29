import { supabase, isCloudConfigured } from './supabase.js';

// Dünne Hülle um Supabase-Auth, damit der Rest der App nichts über den
// konkreten Anbieter wissen muss.

// Administrator-Konten. Ein Admin sieht zusätzlich den „App"-Tab. Die Liste
// steht bewusst im Frontend (keine Rechte-Vergabe, nur Sichtbarkeit von Tabs) –
// die Datentrennung selbst regelt weiterhin die Row-Level-Security in Supabase.
const ADMIN_EMAILS = ['tina.schickle@gmx.de'];

export function isAdmin(user) {
  const email = user?.email?.toLowerCase();
  return Boolean(email && ADMIN_EMAILS.includes(email));
}

// Liste aller registrierten Nutzer (nur E-Mail + Anmeldedatum). Liefert dank
// Row-Level-Security nur dann alle Zeilen zurück, wenn das angemeldete Konto
// Admin ist – sonst nur die eigene Zeile.
export async function listUsers() {
  if (!isCloudConfigured) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getSession() {
  if (!isCloudConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

// ── Benutzername statt E-Mail ────────────────────────────────────────────────
// Supabase braucht intern eine E-Mail. Paare melden sich aber nur mit
// Benutzername an – daraus wird still eine technische Adresse gebildet, an die
// nie etwas verschickt wird. Enthält die Eingabe ein „@“ (z. B. das Admin-
// Konto), wird sie unverändert als E-Mail benutzt.
const LOGIN_DOMAIN = 'users.trackli.app';

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export function normalizeUsername(name) {
  return name.trim().toLowerCase();
}

export function loginToEmail(login) {
  const v = login.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${LOGIN_DOMAIN}`;
}

// Anzeigename des Kontos: Benutzername, sonst die E-Mail (Alt-/Admin-Konten).
export function displayLogin(emailOrUser) {
  const email = typeof emailOrUser === 'string' ? emailOrUser : emailOrUser?.email;
  if (!email) return '';
  return email.endsWith('@' + LOGIN_DOMAIN) ? email.slice(0, -(LOGIN_DOMAIN.length + 1)) : email;
}

// Die Namen des Paares (sie + er) liegen in den user_metadata des Kontos.
export function getCoupleNames(user) {
  const meta = user?.user_metadata ?? {};
  return { her: meta.her_name?.trim() || '', him: meta.his_name?.trim() || '' };
}

// login = Benutzername (oder E-Mail beim Admin-Konto).
export async function signIn(login, password) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(login),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!isCloudConfigured) return;
  await supabase.auth.signOut();
}

// ── Zugangscodes ─────────────────────────────────────────────────────────────
// Registrieren geht nur mit einem Code von der Admin. Die eigentliche Sperre
// sitzt in Supabase (Trigger redeem_invite_code, siehe supabase-setup.sql);
// die Vorab-Prüfung hier ist nur für eine freundliche Rückmeldung.
export function normalizeCode(code) {
  return code.trim().toUpperCase();
}

export async function checkInviteCode(code) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const { data, error } = await supabase.rpc('invite_code_valid', { p_code: normalizeCode(code) });
  if (error) throw error;
  return data === true;
}

// Legt mit einem Zugangscode das Konto an und meldet direkt an.
export async function redeemInviteCode({ code, username, password, her, him }) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const name = normalizeUsername(username);
  const { data, error } = await supabase.auth.signUp({
    email: loginToEmail(name),
    password,
    options: {
      data: {
        invite_code: normalizeCode(code),
        username: name,
        her_name: her.trim(),
        his_name: him.trim(),
      },
    },
  });
  if (error) throw error;
  // Ohne Session ist in Supabase noch „Confirm email“ aktiv – dann gleich
  // anmelden versuchen, damit die Fehlermeldung verständlich wird.
  if (!data.session) await signIn(name, password);
  return data;
}

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

// Setzt das Passwort des aktuell (auch per Recovery-Link) angemeldeten Kontos.
export async function updatePassword(newPassword) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// Ändert die Namen des Paares im angemeldeten Konto.
export async function updateCoupleNames({ her, him }) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const { error } = await supabase.auth.updateUser({
    data: { her_name: her.trim(), his_name: him.trim() },
  });
  if (error) throw error;
}

// Ruft cb bei jeder Anmelde-/Abmelde-Änderung mit (user, event) auf.
// event ist z.B. 'SIGNED_IN', 'SIGNED_OUT' oder 'PASSWORD_RECOVERY'.
// Gibt eine Abmelde-Funktion zurück.
export function onAuthChange(cb) {
  if (!isCloudConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    cb(session?.user ?? null, event);
  });
  return () => data.subscription.unsubscribe();
}
