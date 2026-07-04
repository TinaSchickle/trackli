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
