import { createClient } from '@supabase/supabase-js';

// Zugangsdaten kommen zur Build-Zeit aus Vite-Env-Variablen (VITE_*).
// Der Anon-Key ist bewusst öffentlich – der Datenschutz kommt über die
// Row-Level-Security-Policies in Supabase (jeder Account sieht nur seine
// eigenen Zeilen). Fehlen die Variablen, läuft die App rein lokal weiter.
const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isCloudConfigured = Boolean(URL && ANON_KEY);

export const supabase = isCloudConfigured
  ? createClient(URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
