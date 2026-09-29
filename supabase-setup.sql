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

-- ── Spaß-Dates: erledigte Dates ──────────────────────────────────────────────
-- Welche Date-Karten ein Konto schon „gemacht“ hat (werden dann aufgedeckt an
-- der Pinnwand gezeigt). Die Karten selbst stehen im Code (src/funDates/cards.js),
-- hier liegt nur ihre ID.
create table if not exists public.fun_dates_done (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  card_id  text        not null,
  done_at  timestamptz not null default now(),
  primary key (user_id, card_id)
);

alter table public.fun_dates_done enable row level security;

drop policy if exists "fun dates sind privat" on public.fun_dates_done;
create policy "fun dates sind privat"
  on public.fun_dates_done
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.fun_dates_done to authenticated;

-- ── Zugangscodes (Registrierung nur mit Code von der Admin) ─────────────────
-- Konten entstehen ausschließlich über einen einmaligen Zugangscode. Das Paar
-- gibt Code, Namen, Benutzername und Passwort in der App ein; die App legt das
-- Konto per signUp an (technische E-Mail: <benutzername>@users.trackli.app,
-- dorthin wird nie etwas verschickt). Der Trigger unten lässt einen neuen
-- Nutzer nur zu, wenn ein gültiger, unbenutzter Code mitkommt, und entwertet
-- ihn dabei – ohne Code (auch über „Add user“ im Dashboard) geht nichts.
--
-- Supabase-Einstellungen dafür (Authentication → Sign In / Providers → Email):
--   „Allow new users to sign up“  = AN  (der Trigger ist die Sperre)
--   „Confirm email“               = AUS (es gibt keine echte E-Mail)
create table if not exists public.invite_codes (
  code        text primary key,
  created_at  timestamptz not null default now(),
  used_at     timestamptz,
  used_by     uuid          -- bewusst ohne FK: wird im BEFORE-Trigger gesetzt
);

alter table public.invite_codes enable row level security;

drop policy if exists "invite codes nur admin" on public.invite_codes;
create policy "invite codes nur admin"
  on public.invite_codes
  for all
  using (lower(auth.jwt() ->> 'email') = 'tina.schickle@gmx.de')
  with check (lower(auth.jwt() ->> 'email') = 'tina.schickle@gmx.de');

grant select, insert, update, delete on public.invite_codes to authenticated;

-- Vorab-Prüfung in der App („Code ok?“), bevor Namen/Passwort abgefragt werden.
create or replace function public.invite_code_valid(p_code text)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.invite_codes
    where code = upper(trim(p_code)) and used_at is null
  );
$$;

grant execute on function public.invite_code_valid(text) to anon, authenticated;

-- Die eigentliche Sperre: jeder neue auth-User braucht einen gültigen Code.
create or replace function public.redeem_invite_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
begin
  update public.invite_codes
     set used_at = now(), used_by = new.id
   where code = v_code and used_at is null;
  if not found then
    raise exception 'INVALID_INVITE_CODE';
  end if;
  new.raw_user_meta_data := new.raw_user_meta_data - 'invite_code';
  return new;
end;
$$;

drop trigger if exists before_auth_user_created on auth.users;
create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.redeem_invite_code();

-- Passwort zurücksetzen durch die Admin (es gibt keine E-Mail für einen
-- Reset-Link). Prüft selbst, dass die Aufruferin Admin ist.
create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if lower(auth.jwt() ->> 'email') <> 'tina.schickle@gmx.de' then
    raise exception 'NOT_ADMIN';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where id = p_user;
end;
$$;

revoke execute on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
