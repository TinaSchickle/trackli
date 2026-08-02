// Cron-Job (GitHub Actions, .github/workflows/mucus-reminder.yml): schickt
// eine Push-Erinnerung an Nutzer:innen, die bis zu ihrer in der App
// eingestellten Stunde (Tabelle notification_settings, Default 20 Uhr,
// Zeitzone Europe/Berlin) noch keinen Zervixschleim-Wert für heute
// eingetragen haben. Läuft stündlich; jeder Nutzer wird mit seiner eigenen
// Wunschstunde verglichen (umgeht Sommer-/Winterzeit-Verschiebungen, statt
// feste UTC-Cron-Zeiten pro Stunde pflegen zu müssen).
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

function localHourAndDate(tz) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { hour: Number(hour), isoDate: `${get('year')}-${get('month')}-${get('day')}` };
}

const { hour, isoDate } = localHourAndDate(REMINDER_TZ);

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Ermittelt, ob der aktuelle Zyklus des Nutzers Zervixschleim überhaupt trackt
 * und ob für "heute" bereits ein Wert (oder eine Ausklammerung) vorliegt. */
async function needsReminder(userId) {
  const { data: entries, error } = await supabase
    .from('entries')
    .select('date, data')
    .eq('user_id', userId)
    .eq('deleted', false)
    .order('date', { ascending: true })
    .limit(500);
  if (error) throw error;
  if (!entries?.length) return false;

  let cycleStartIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].data?.isPeriodStart) {
      cycleStartIdx = i;
      break;
    }
  }
  if (cycleStartIdx === -1) return false;

  const trackMucus = entries[cycleStartIdx].data?.trackMucus ?? true;
  if (!trackMucus) return false;

  const today = entries.find((e) => e.date === isoDate);
  const alreadyHandled =
    today && (Boolean(today.data?.cervicalMucus) || today.data?.mucusExcluded === true);
  return !alreadyHandled;
}

async function sendAndPrune(userId, subs) {
  for (const sub of subs) {
    const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: 'Zykluskalender',
          body: 'Heute noch kein Zervixschleim eingetragen – kurz nachtragen?',
        })
      );
      console.log(`Push gesendet an ${userId} (${sub.endpoint.slice(0, 40)}…)`);
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
  supabase.from('notification_settings').select('user_id, reminder_hour'),
]);
if (subError) throw subError;
if (settingsError) throw settingsError;

const hourByUser = new Map((settings ?? []).map((s) => [s.user_id, s.reminder_hour]));

const byUser = new Map();
for (const s of subscriptions ?? []) {
  if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
  byUser.get(s.user_id).push(s);
}

console.log(`${byUser.size} Nutzer:innen mit Push-Subscription, lokale Stunde ${hour} (${REMINDER_TZ}), Stand ${isoDate}…`);

for (const [userId, subs] of byUser) {
  const wantedHour = hourByUser.get(userId) ?? Number(DEFAULT_REMINDER_HOUR);
  if (!FORCE_RUN && hour !== wantedHour) {
    console.log(`${userId}: Wunschstunde ${wantedHour} Uhr, jetzt ${hour} Uhr – übersprungen.`);
    continue;
  }
  if (await needsReminder(userId)) {
    await sendAndPrune(userId, subs);
  } else {
    console.log(`${userId}: Eintrag heute vorhanden/nicht nötig – keine Erinnerung.`);
  }
}
