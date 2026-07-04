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

export async function signUp(email, password) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!isCloudConfigured) return;
  await supabase.auth.signOut();
}

// Schickt eine „Passwort zurücksetzen"-E-Mail. Der Link darin führt zurück in
// die App (redirectTo); dort feuert dann ein PASSWORD_RECOVERY-Ereignis, worauf
// der Nutzer ein neues Passwort setzen kann.
export async function sendPasswordReset(email) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

// Setzt das Passwort des aktuell (auch per Recovery-Link) angemeldeten Kontos.
export async function updatePassword(newPassword) {
  if (!isCloudConfigured) throw new Error('Cloud nicht eingerichtet');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
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
