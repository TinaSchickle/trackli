import { supabase, isCloudConfigured } from './supabase.js';
import { getUser } from './auth.js';

// Web-Push-Erinnerung: "Bis 20 Uhr noch kein Zervixschleim eingetragen".
// Der eigentliche Versand läuft serverseitig (GitHub-Action-Cron, siehe
// scripts/send-mucus-reminders.mjs) – hier wird nur die Browser-Subscription
// verwaltet und in Supabase abgelegt, damit der Cron-Job weiß, wohin er
// schicken soll.

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
export async function enableMucusReminder() {
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
export async function disableMucusReminder() {
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

export async function isMucusReminderEnabled() {
  const sub = await getExistingSubscription();
  return Boolean(sub);
}
