import { supabase, isCloudConfigured } from './supabase.js';
import { getUser } from './auth.js';

// Web-Push-Erinnerung: "Bis zur eingestellten Stunde noch nicht alle
// (aktiven) Parameter für heute eingetragen". Der eigentliche Versand läuft
// serverseitig (GitHub-Action-Cron, siehe scripts/send-daily-reminders.mjs)
// – hier wird nur die Browser-Subscription verwaltet und in Supabase
// abgelegt, damit der Cron-Job weiß, wohin er schicken soll.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Merkt sich lokal, welcher Endpoint zuletzt für dieses Gerät in Supabase
// gespeichert wurde – so erkennt syncSubscription() eine im Hintergrund vom
// Browser rotierte Subscription, ohne die Subscriptions anderer Geräte
// desselben Kontos anzufassen.
const LOCAL_ENDPOINT_KEY = 'trackli:push-endpoint';

export const isPushConfigured = Boolean(VAPID_PUBLIC_KEY);

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Push-Subscriptions verschicken den Public Key als Base64url-String, die
// Browser-API erwartet ihn aber als Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Aktuelle Browser-Subscription (falls vorhanden), sonst null. */
export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Fordert Benachrichtigungs-Erlaubnis an, abonniert Push beim Browser und
 * speichert die Subscription in Supabase (an den eigenen Account gebunden).
 * @returns {Promise<'granted'|'denied'|'unsupported'|'not_signed_in'>}
 */
export async function enableDailyReminder() {
  if (!isPushSupported() || !isPushConfigured) return 'unsupported';
  const user = await getUser();
  if (!user) return 'not_signed_in';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  if (isCloudConfigured) {
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'user_id,endpoint' }
    );
    if (error) throw error;
  }
  localStorage.setItem(LOCAL_ENDPOINT_KEY, json.endpoint);
  return 'granted';
}

/**
 * Gleicht die aktuelle Browser-Subscription mit der in Supabase gespeicherten
 * ab. Chrome/FCM rotiert die Subscription gelegentlich still im Hintergrund
 * (neuer Endpoint); ohne diesen Abgleich bleibt in Supabase der alte, tote
 * Endpoint stehen, bis ihn der Cron-Job irgendwann mit 404/410 löscht – und
 * die Erinnerung kommt nie mehr an. Am besten bei jedem App-Start bzw. beim
 * Zurückkehren in den Vordergrund aufrufen. Wirft nichts, meldet Fehler nur
 * in der Konsole (soll den normalen App-Start nicht stören).
 */
export async function syncSubscription() {
  if (!isPushSupported() || !isPushConfigured || !isCloudConfigured) return;
  try {
    const user = await getUser();
    if (!user) return;
    const sub = await getExistingSubscription();
    if (!sub) return;

    const json = sub.toJSON();
    const previousEndpoint = localStorage.getItem(LOCAL_ENDPOINT_KEY);
    if (previousEndpoint === json.endpoint) return;

    if (previousEndpoint) {
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', previousEndpoint);
    }
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'user_id,endpoint' }
    );
    if (error) throw error;
    localStorage.setItem(LOCAL_ENDPOINT_KEY, json.endpoint);
  } catch (err) {
    console.warn('Push-Subscription-Abgleich fehlgeschlagen:', err);
  }
}

/** Deaktiviert die Erinnerung wieder: Browser-Subscription + Supabase-Zeile löschen. */
export async function disableDailyReminder() {
  const sub = await getExistingSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  if (isCloudConfigured) {
    const user = await getUser();
    if (user) {
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
    }
  }
  localStorage.removeItem(LOCAL_ENDPOINT_KEY);
}

export async function isDailyReminderEnabled() {
  const sub = await getExistingSubscription();
  return Boolean(sub);
}

const DEFAULT_REMINDER_TIME = { hour: 20, minute: 0 };

/** Eingestellte Erinnerungszeit ({hour, minute}, minute ist 0 oder 30) des Kontos, sonst Default. */
export async function getReminderTime() {
  if (!isCloudConfigured) return DEFAULT_REMINDER_TIME;
  const user = await getUser();
  if (!user) return DEFAULT_REMINDER_TIME;
  const { data, error } = await supabase
    .from('notification_settings')
    .select('reminder_hour, reminder_minute')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_REMINDER_TIME;
  return { hour: data.reminder_hour, minute: data.reminder_minute };
}

/** Speichert die gewünschte Erinnerungszeit (Stunde 0–23, Minute 0 oder 30) des Kontos. */
export async function setReminderTime(hour, minute) {
  if (!isCloudConfigured) return;
  const user = await getUser();
  if (!user) throw new Error('Nicht angemeldet.');
  const { error } = await supabase.from('notification_settings').upsert(
    { user_id: user.id, reminder_hour: hour, reminder_minute: minute, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}
