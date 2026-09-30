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

// Vorschlag aus den beiden Vornamen, z. B. „Tina“ + „Pascal“ → „TinaUndPascal“.
// Umlaute werden umschrieben, alles außer Buchstaben/Ziffern fällt weg.
export function suggestUsername(her, him) {
  const clean = (n) =>
    n
      .trim()
      .split(/\s+/)[0]
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[^A-Za-z0-9]/g, '');
  const cap = (n) => n.charAt(0).toUpperCase() + n.slice(1);
  const a = cap(clean(her));
  const b = cap(clean(him));
  return a && b ? `${a}Und${b}` : a || b;
}

export function loginToEmail(login) {
  const v = login.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${LOGIN_DOMAIN}`;
}

// Anzeigename des Kontos: Benutzername, sonst die E-Mail (Alt-/Admin-Konten).
export function displayLogin(emailOrUser) {
  const chosen = typeof emailOrUser === 'object' ? emailOrUser?.user_metadata?.username : null;
  if (chosen) return chosen;
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

// ── Passwort-Reset per Code (von der Admin erzeugt) ──────────────────────────
export async function checkResetCode(code) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const { data, error } = await supabase.rpc('reset_code_valid', { p_code: normalizeCode(code) });
  if (error) throw error;
  return data === true;
}

// Setzt mit dem Code ein neues Passwort und meldet danach direkt an.
export async function redeemResetCode(code, password) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const { data: email, error } = await supabase.rpc('redeem_reset_code', {
    p_code: normalizeCode(code),
    p_password: password,
  });
  if (error) throw error;
  await signIn(email, password);
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
  // Groß-/Kleinschreibung bleibt für die Anzeige erhalten; angemeldet wird
  // unabhängig davon (loginToEmail macht alles klein).
  const name = username.trim();
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
