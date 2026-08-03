-- Trackli – Cloud-Sync-Schema für Supabase.
-- Einmalig im Supabase-Dashboard unter "SQL Editor" ausführen.
--
-- Idee: Es gibt eine Tabelle je Datenart. Jede Zeile gehört einem Nutzer
-- (user_id). Row-Level-Security sorgt dafür, dass jeder Account NUR seine
-- eigenen Zeilen sieht und ändern kann. Der eigentliche Eintrag steckt als
-- JSON in "data", "updated_at" (ms seit 1970) entscheidet beim Abgleich, welche
-- Version gewinnt. "deleted" markiert Löschungen (Tombstone), damit sie auf
-- andere Geräte übertragen werden.
--
-- Voraussetzung: In den Projekt-API-Einstellungen ist "Automatically expose
-- new tables" AUS (empfohlener Sicherheits-Default von Supabase). Deshalb
-- vergibt dieses Skript die Tabellenrechte unten explizit selbst, statt sich
-- auf die automatische Freigabe zu verlassen.

-- ── Einträge (Tagesdaten) ────────────────────────────────────────────────────
create table if not exists public.entries (
  user_id     uuid   not null references auth.users (id) on delete cascade,
  date        text   not null,          -- ISO-Datum, natürlicher Schlüssel
  data        jsonb  not null,          -- kompletter Eintrag
  updated_at  bigint not null,          -- ms-Zeitstempel für "neueste gewinnt"
  deleted     boolean not null default false,
  primary key (user_id, date)
);

alter table public.entries enable row level security;

drop policy if exists "entries sind privat" on public.entries;
create policy "entries sind privat"
  on public.entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tabellenzugriff für eingeloggte Nutzer freischalten (nötig, da "Automatically
-- expose new tables" ausgeschaltet ist). Welche Zeilen sichtbar sind, regelt
-- weiterhin allein die RLS-Policy oben.
grant select, insert, update, delete on public.entries to authenticated;

-- ── Archivierte Zyklus-Charts ────────────────────────────────────────────────
create table if not exists public.archived_charts (
  user_id     uuid   not null references auth.users (id) on delete cascade,
  id          text   not null,          -- Chart-id, natürlicher Schlüssel
  data        jsonb  not null,
  updated_at  bigint not null,
  deleted     boolean not null default false,
  primary key (user_id, id)
);

alter table public.archived_charts enable row level security;

drop policy if exists "charts sind privat" on public.archived_charts;
create policy "charts sind privat"
  on public.archived_charts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.archived_charts to authenticated;

-- ── Nutzerliste für den Admin ────────────────────────────────────────────────
-- "auth.users" ist mit dem öffentlichen Anon-Key nicht abfragbar. Damit der
-- Admin im "User"-Tab alle registrierten Konten sehen kann (nur E-Mail +
-- Anmeldedatum, keine Zyklusdaten), spiegeln wir die nötigen Felder in eine
-- eigene Tabelle "profiles". Eine RLS-Policy erlaubt jedem, nur seine eigene
-- Zeile zu lesen – und dem Admin alle.
--
-- WICHTIG: Trägt hier dieselbe Admin-E-Mail ein wie im Frontend
-- (src/cloud/auth.js → ADMIN_EMAILS).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles sichtbar" on public.profiles;
create policy "profiles sichtbar"
  on public.profiles
  for select
  using (
    id = auth.uid()
    or lower(auth.jwt() ->> 'email') = 'tina.schickle@gmx.de'
  );

grant select on public.profiles to authenticated;

-- Neue Registrierungen automatisch in "profiles" spiegeln.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bereits bestehende Konten einmalig nachtragen (der Trigger greift nur bei
-- neuen Registrierungen).
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ── Push-Subscriptions (Erinnerung "heute fehlen noch Module") ──────────────
-- Ein Gerät = eine Zeile (Web-Push-Endpoint + Verschlüsselungs-Keys). Der
-- eigentliche Versand läuft über einen GitHub-Actions-Cron mit dem Secret-Key
-- (siehe scripts/send-daily-reminders.mjs) und umgeht damit RLS bewusst – der
-- Browser selbst darf nur seine eigene(n) Subscription(en) verwalten.
create table if not exists public.push_subscriptions (
  user_id     uuid   not null references auth.users (id) on delete cascade,
  endpoint    text   not null,
  p256dh      text   not null,
  auth        text   not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions sind privat" on public.push_subscriptions;
create policy "push subscriptions sind privat"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ── Erinnerungs-Uhrzeit (pro Nutzer, nicht pro Gerät) ────────────────────────
-- Halbstundenschritte: reminder_minute ist entweder 0 oder 30.
create table if not exists public.notification_settings (
  user_id         uuid    primary key references auth.users (id) on delete cascade,
  reminder_hour   smallint not null default 20 check (reminder_hour between 0 and 23),
  reminder_minute smallint not null default 0 check (reminder_minute in (0, 30)),
  updated_at      timestamptz not null default now()
);

-- Für bereits bestehende Zeilen aus einer früheren Version des Schemas.
alter table public.notification_settings
  add column if not exists reminder_minute smallint not null default 0;
alter table public.notification_settings
  drop constraint if exists notification_settings_reminder_minute_check;
alter table public.notification_settings
  add constraint notification_settings_reminder_minute_check check (reminder_minute in (0, 30));

alter table public.notification_settings enable row level security;

drop policy if exists "notification settings sind privat" on public.notification_settings;
create policy "notification settings sind privat"
  on public.notification_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.notification_settings to authenticated;

-- ── Rechte für den Erinnerungs-Cron (service_role) ───────────────────────────
-- Der GitHub-Actions-Cron (scripts/send-daily-reminders.mjs) verbindet sich
-- mit dem Service-Role-Key, um über ALLE Nutzer:innen zu prüfen (RLS wird
-- dabei bewusst umgangen). "service_role" umgeht zwar RLS, braucht aber
-- trotzdem eigene GRANTs auf Tabellenebene – ohne diese schlägt der Cron mit
-- "permission denied for table ..." (Fehlercode 42501) fehl, obwohl der Key
-- selbst korrekt ist.
grant select on public.entries to service_role;
grant select, delete on public.push_subscriptions to service_role;
grant select on public.notification_settings to service_role;
