import { supabase, isCloudConfigured } from './supabase.js';
import { getUser } from './auth.js';

// Web-Push-Erinnerung: "Bis zur eingestellten Stunde noch nicht alle
// (aktiven) Parameter für heute eingetragen". Der eigentliche Versand läuft
// serverseitig (GitHub-Action-Cron, siehe scripts/send-daily-reminders.mjs)
// – hier wird nur die Browser-Subscription verwaltet und in Supabase
// abgelegt, damit der Cron-Job weiß, wohin er schicken soll.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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
  return 'granted';
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
}

export async function isDailyReminderEnabled() {
  const sub = await getExistingSubscription();
  return Boolean(sub);
}

const DEFAULT_REMINDER_HOUR = 20;

/** Eingestellte Erinnerungsstunde (0–23) des angemeldeten Kontos, sonst Default. */
export async function getReminderHour() {
  if (!isCloudConfigured) return DEFAULT_REMINDER_HOUR;
  const user = await getUser();
  if (!user) return DEFAULT_REMINDER_HOUR;
  const { data, error } = await supabase
    .from('notification_settings')
    .select('reminder_hour')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.reminder_hour ?? DEFAULT_REMINDER_HOUR;
}

/** Speichert die gewünschte Erinnerungsstunde (0–23) des angemeldeten Kontos. */
export async function setReminderHour(hour) {
  if (!isCloudConfigured) return;
  const user = await getUser();
  if (!user) throw new Error('Nicht angemeldet.');
  const { error } = await supabase
    .from('notification_settings')
    .upsert({ user_id: user.id, reminder_hour: hour, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
