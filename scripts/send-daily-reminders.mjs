// Cron-Job (GitHub Actions, .github/workflows/daily-reminder.yml): schickt
// eine Push-Erinnerung an Nutzer:innen, die bis zu ihrer in der App
// eingestellten Uhrzeit (Tabelle notification_settings, Halbstundenschritte,
// Default 20:00, Zeitzone Europe/Berlin) noch nicht für alle
// nicht-deaktivierten Module (Temperatur, Zervixschleim, Muttermund,
// Spucke-Test) einen Wert für heute eingetragen haben. Läuft alle 30 Minuten;
// jeder Nutzer wird mit seiner eigenen Wunschzeit verglichen (umgeht
// Sommer-/Winterzeit-Verschiebungen, statt feste UTC-Cron-Zeiten pflegen zu
// müssen).
//
// Braucht den Supabase SERVICE ROLE Key (umgeht RLS bewusst, um über alle
// Nutzer:innen zu prüfen) – NIEMALS im Frontend verwenden, nur hier als
// GitHub-Actions-Secret.

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  REMINDER_TZ = 'Europe/Berlin',
  REMINDER_HOUR: DEFAULT_REMINDER_HOUR = '20', // Fallback für Nutzer ohne eigene Einstellung
  REMINDER_MINUTE: DEFAULT_REMINDER_MINUTE = '0',
  FORCE_RUN,
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    console.log(`${name} nicht gesetzt – übersprungen.`);
    process.exit(0);
  }
}
requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);
requireEnv('VAPID_PUBLIC_KEY', VAPID_PUBLIC_KEY);
requireEnv('VAPID_PRIVATE_KEY', VAPID_PRIVATE_KEY);
requireEnv('VAPID_SUBJECT', VAPID_SUBJECT);

function localTimeAndDate(tz) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  // Auf den Halbstunden-Slot runden (0 oder 30) – toleriert kleine Verzögerungen
  // beim GitHub-Actions-Cron, ohne den falschen Nutzer zu treffen.
  const minuteSlot = Number(get('minute')) < 30 ? 0 : 30;
  return { hour: Number(hour), minute: minuteSlot, isoDate: `${get('year')}-${get('month')}-${get('day')}` };
}

const { hour, minute, isoDate } = localTimeAndDate(REMINDER_TZ);

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Ein Modul pro nicht-deaktivierbarem Auswertungs-Zeichen. "excludedField"
// ist null bei Modulen ohne eigenes "ausklammern"-Flag (Spucke/Farnkraut).
const MODULES = [
  { track: 'trackTemp', field: 'temperature', excludedField: 'tempExcluded', label: 'Temperatur',
    isFilled: (v) => typeof v === 'number' && !Number.isNaN(v) },
  { track: 'trackMucus', field: 'cervicalMucus', excludedField: 'mucusExcluded', label: 'Zervixschleim',
    isFilled: Boolean },
  { track: 'trackCervix', field: 'cervixState', excludedField: 'cervixExcluded', label: 'Muttermund',
    isFilled: Boolean },
  { track: 'trackFerning', field: 'ferning', excludedField: null, label: 'Spucke-Test',
    isFilled: Boolean },
];

/** Liefert die Namen aller heute noch fehlenden, aber aktiven Module – leer, wenn nichts fehlt. */
async function missingModulesToday(userId) {
  const { data: entries, error } = await supabase
    .from('entries')
    .select('date, data')
    .eq('user_id', userId)
    .eq('deleted', false)
    .order('date', { ascending: true })
    .limit(500);
  if (error) throw error;
  if (!entries?.length) return [];

  let cycleStartIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].data?.isPeriodStart) {
      cycleStartIdx = i;
      break;
    }
  }
  if (cycleStartIdx === -1) return [];

  const startData = entries[cycleStartIdx].data ?? {};
  const today = entries.find((e) => e.date === isoDate)?.data ?? {};

  const missing = [];
  for (const m of MODULES) {
    const active = startData[m.track] ?? true;
    if (!active) continue;
    const excluded = m.excludedField ? today[m.excludedField] === true : false;
    if (excluded) continue;
    if (!m.isFilled(today[m.field])) missing.push(m.label);
  }
  return missing;
}

async function sendAndPrune(userId, subs, missing) {
  const body =
    missing.length === 1
      ? `Heute fehlt noch: ${missing[0]}.`
      : `Heute fehlen noch: ${missing.join(', ')}.`;
  for (const sub of subs) {
    const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    try {
      await webpush.sendNotification(subscription, JSON.stringify({ title: 'Zykluskalender', body }));
      console.log(`Push gesendet an ${userId} (${sub.endpoint.slice(0, 40)}…): ${body}`);
    } catch (err) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        console.log(`Subscription abgelaufen, entferne: ${sub.endpoint.slice(0, 40)}…`);
        await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', sub.endpoint);
      } else {
        console.error(`Fehler beim Senden an ${userId}:`, err?.message || err);
      }
    }
  }
}

const [{ data: subscriptions, error: subError }, { data: settings, error: settingsError }] = await Promise.all([
  supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth'),
  supabase.from('notification_settings').select('user_id, reminder_hour, reminder_minute'),
]);
if (subError) throw subError;
if (settingsError) throw settingsError;

const timeByUser = new Map(
  (settings ?? []).map((s) => [s.user_id, { hour: s.reminder_hour, minute: s.reminder_minute }])
);

const byUser = new Map();
for (const s of subscriptions ?? []) {
  if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
  byUser.get(s.user_id).push(s);
}

const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
console.log(`${byUser.size} Nutzer:innen mit Push-Subscription, lokale Zeit ${fmt(hour, minute)} (${REMINDER_TZ}), Stand ${isoDate}…`);

for (const [userId, subs] of byUser) {
  const wanted = timeByUser.get(userId) ?? { hour: Number(DEFAULT_REMINDER_HOUR), minute: Number(DEFAULT_REMINDER_MINUTE) };
  if (!FORCE_RUN && (hour !== wanted.hour || minute !== wanted.minute)) {
    console.log(`${userId}: Wunschzeit ${fmt(wanted.hour, wanted.minute)}, jetzt ${fmt(hour, minute)} – übersprungen.`);
    continue;
  }
  const missing = await missingModulesToday(userId);
  if (missing.length) {
    await sendAndPrune(userId, subs, missing);
  } else {
    console.log(`${userId}: heute nichts offen – keine Erinnerung.`);
  }
}
