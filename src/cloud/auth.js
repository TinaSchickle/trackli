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

// Ruft cb bei jeder Anmelde-/Abmelde-Änderung mit dem aktuellen User (oder null).
// Gibt eine Abmelde-Funktion zurück.
export function onAuthChange(cb) {
  if (!isCloudConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
