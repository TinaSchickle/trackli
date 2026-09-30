import { supabase, isCloudConfigured } from './supabase.js';

// Antworten des Fragebogens: { [questionId]: value }. Angemeldet liegt das in
// Supabase (Tabelle questionnaire_answers, per RLS nur fürs eigene Konto),
// sonst nur lokal im Browser. Jede Antwort wird sofort zwischengespeichert.

const LOCAL_KEY = 'trackli-questionnaire';

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writeLocal(answers) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(answers));
  } catch {
    // Speicher voll/blockiert – dann eben nur für diese Sitzung.
  }
}

export async function loadAnswers(user) {
  if (!isCloudConfigured || !user) return readLocal();
  const { data, error } = await supabase
    .from('questionnaire_answers')
    .select('answers')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.answers ?? {};
}

export async function saveAnswers(user, answers) {
  if (!isCloudConfigured || !user) {
    writeLocal(answers);
    return;
  }
  const { error } = await supabase
    .from('questionnaire_answers')
    .upsert({ user_id: user.id, answers, updated_at: new Date().toISOString() });
  if (error) throw error;
}
