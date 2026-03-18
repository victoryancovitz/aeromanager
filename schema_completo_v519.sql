-- ═══════════════════════════════════════════════════════════════
-- AeroManager — Schema Completo v5.19 rev3
-- ORDEM CORRETA: ADD COLUMN → FK → INDEX → TRIGGER
-- Cole no SQL Editor do Supabase e execute
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;


-- ═══════════════════════════════════════════════════════════════
-- PARTE 1 — Tabelas (CREATE TABLE IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════

create table if not exists aircraft (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid references auth.users(id) on delete cascade not null,
  registration         text not null,
  type                 text not null default 'single_engine',
  manufacturer         text, model text, year int,
  engine_model         text, engine_tbo_hours numeric,
  prop_model           text, prop_tbo_hours numeric,
  apu_model            text, apu_tbo_hours numeric,
  apu_total_hours      numeric default 0, apu_cycles int default 0,
  base_airframe_hours  numeric default 0,
  total_flight_hours   numeric default 0,
  total_engine_hours   numeric default 0,
  total_cycles         int default 0,
  fuel_type            text default 'avgas_100ll',
  fuel_capacity_liters numeric, fuel_bias_manual numeric,
  home_base            text, monthly_fixed numeric default 0,
  performance_profiles jsonb default '[]',
  climb_profiles       jsonb default '[]',
  anac_config          jsonb default '{"status":"nao_configurado"}',
  is_active            boolean default true,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create table if not exists flights (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid references auth.users(id) on delete cascade not null,
  aircraft_id          uuid references aircraft(id) on delete set null,
  date                 date not null,
  departure_icao       text, destination_icao text, alternate_icao text,
  takeoff_utc          text, landing_utc text,
  flight_time_minutes  int default 0, flight_time_day int default 0,
  flight_time_night    int default 0, flight_time_ifr int default 0,
  distance_nm          numeric default 0,
  cruise_altitude_ft   int default 0, max_altitude_ft int default 0,
  fuel_added_liters    numeric default 0, fuel_price_per_liter numeric default 0,
  fuel_vendor          text, flight_conditions text default 'vfr',
  purpose              text default 'leisure', cycles int default 1,
  phase_climb_min      int default 0, phase_cruise_min int default 0,
  phase_descent_min    int default 0,
  source               text default 'manual', gps_track_points int default 0,
  logbook_notes        text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- costs: colunas novas incluídas direto (sem FK ainda — tabelas referenciadas vêm depois)
create table if not exists costs (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  aircraft_id       uuid references aircraft(id) on delete set null,
  flight_id         uuid references flights(id) on delete set null,
  category          text not null,
  cost_type         text default 'variable',
  amount_brl        numeric not null default 0,
  description       text, reference_date date, vendor text, receipt_url text,
  recurrence        text default 'once',
  recurrence_day    int, recurrence_end date, billing_period text,
  category_id       uuid,       -- FK adicionada na Parte 4
  engine_event_id   uuid,       -- FK adicionada na Parte 4
  airport_id        uuid,       -- FK adicionada na Parte 4
  invoice_number    text,
  is_template       boolean default false, template_id uuid,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists maintenance (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  aircraft_id           uuid references aircraft(id) on delete cascade,
  item_type             text default 'inspection', name text not null,
  interval_hours        numeric, interval_days int,
  last_done_hours       numeric, last_done_date date,
  next_due_hours        numeric, next_due_date date,
  status                text default 'current',
  estimated_cost_brl    numeric default 0, notes text,
  deferred_until_date   date, deferred_until_hours numeric, deferral_ref text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create table if not exists missions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  aircraft_id uuid references aircraft(id) on delete set null,
  name text not null, type text default 'round_trip',
  status text default 'planned', purpose text default 'leisure',
  date_start date, date_end date,
  legs jsonb default '[]', passengers jsonb default '[]', notes text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists fuel_prices (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  icao             text not null, price_per_liter numeric not null,
  liters           numeric default 0, fuel_type text default 'avgas_100ll',
  vendor           text, date date not null,
  flight_id        uuid references flights(id) on delete set null,
  notes            text, recorded_at timestamptz default now()
);

create table if not exists user_settings (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade not null unique,
  api_key          text, fuel_unit text default 'liters', currency text default 'BRL',
  anac_credentials jsonb default '{}', integrations jsonb default '{}',
  profile          jsonb default '{}',
  updated_at       timestamptz default now()
);

create table if not exists oil_logs (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  aircraft_id    uuid references aircraft(id) on delete cascade,
  date           date not null, hours_at_check numeric not null,
  qt_added       numeric not null, qt_after numeric, notes text,
  created_at     timestamptz default now()
);

create table if not exists crew_members (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  full_name    text not null, display_name text,
  role         text default 'captain', nationality text,
  dob          date, anac_code text, is_self boolean default false, notes text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists crew_documents (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  crew_member_id    uuid references crew_members(id) on delete cascade not null,
  doc_type          text not null, doc_number text,
  issuing_country   text, issuing_authority text,
  issue_date        date, expiry_date date,
  raw_data          jsonb default '{}', notes text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists airports (
  id                serial primary key,
  icao              text unique, iata text, name text not null,
  city              text, state text, country text default 'BR',
  latitude          numeric, longitude numeric, elevation_ft int,
  airport_type      text, municipality text,
  scheduled_service boolean default false,
  created_at        timestamptz default now()
);

create table if not exists components (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  aircraft_id   uuid references aircraft(id) on delete cascade,
  nomenclature  text not null,
  pn text, ns text, tlv text, tbo text,
  tsn text, tso text, csn text, cso text,
  due_hours     text, due_date date, due_condition text,
  shop          text, category text default 'other', notes text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists airports_db (
  id                    uuid primary key default uuid_generate_v4(),
  icao                  text not null, iata text, name text not null,
  city text, state text, country text default 'BR',
  type                  text default 'public',    -- public|private|military|helipad
  anac_category         text, lat numeric, lng numeric,
  landing_fee_brl       numeric, landing_fee_per_ton boolean default false,
  parking_fee_brl_hour  numeric, hangar_fee_brl_day numeric,
  atis_fee_brl          numeric, handling_fee_brl numeric,
  fuel_avgas_brl_l      numeric, fuel_jeta1_brl_l numeric,
  has_tower   boolean default false, has_app     boolean default false,
  has_afis    boolean default false, has_customs boolean default false,
  has_mro     boolean default false, has_catering boolean default false,
  has_avgas   boolean default false, has_jeta1   boolean default false,
  source      text default 'user', verified boolean default false, notes text,
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(icao, country)
);

create table if not exists airport_overrides (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  airport_id            uuid references airports_db(id) on delete cascade not null,
  landing_fee_brl       numeric, parking_fee_brl_hour numeric,
  hangar_fee_brl_day    numeric, atis_fee_brl numeric,
  fuel_avgas_brl_l      numeric, fuel_jeta1_brl_l numeric,
  notes                 text, updated_at timestamptz default now(),
  unique(user_id, airport_id)
);

create table if not exists engine_events (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid references auth.users(id) on delete cascade not null,
  aircraft_id             uuid references aircraft(id) on delete cascade not null,
  engine_position         int default 1,
  event_type              text not null,
  event_date              date not null,
  airframe_hours_at_event numeric, engine_tsn numeric, engine_tso numeric, engine_csn int,
  amount_brl              numeric, currency text default 'BRL', counterparty text,
  program_name            text, program_coverage text, program_rate_per_hour numeric,
  rental_start            date, rental_end date,
  rental_rate_type        text, rental_rate numeric,
  work_order              text, shop_name text, doc_ref text, notes text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create table if not exists cost_categories (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid references auth.users(id) on delete cascade not null,
  name               text not null,
  group_type         text default 'other',
  color              text, icon text,
  sort_order         int default 0,
  default_recurrence text default 'once',
  is_default         boolean default false,
  created_at         timestamptz default now(),
  unique(user_id, name)
);

create table if not exists organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null, type text not null,
  cnpj        text, icao_base text, description text,
  phone       text, email text, website text, logo_url text,
  verified    boolean default false,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists org_members (
  id        uuid primary key default uuid_generate_v4(),
  org_id    uuid references organizations(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete cascade,
  role      text default 'member',
  joined_at timestamptz default now(),
  unique(org_id, user_id)
);


-- ═══════════════════════════════════════════════════════════════
-- PARTE 2 — ALTER TABLE (bancos existentes)
-- DEVE vir ANTES dos índices e FKs que dependem dessas colunas
-- ═══════════════════════════════════════════════════════════════

-- aircraft: APU
alter table aircraft add column if not exists apu_model       text;
alter table aircraft add column if not exists apu_tbo_hours   numeric;
alter table aircraft add column if not exists apu_total_hours numeric default 0;
alter table aircraft add column if not exists apu_cycles      int default 0;

-- user_settings: perfil
alter table user_settings add column if not exists profile jsonb default '{}';

-- maintenance: deferimento
alter table maintenance add column if not exists deferred_until_date  date;
alter table maintenance add column if not exists deferred_until_hours numeric;
alter table maintenance add column if not exists deferral_ref         text;

-- components: updated_at
alter table components add column if not exists updated_at timestamptz default now();

-- costs: todos os campos novos
alter table costs add column if not exists recurrence       text default 'once';
alter table costs add column if not exists recurrence_day   int;
alter table costs add column if not exists recurrence_end   date;
alter table costs add column if not exists billing_period   text;
alter table costs add column if not exists category_id      uuid;
alter table costs add column if not exists engine_event_id  uuid;
alter table costs add column if not exists airport_id       uuid;
alter table costs add column if not exists invoice_number   text;
alter table costs add column if not exists is_template      boolean default false;
alter table costs add column if not exists template_id      uuid;

-- cost_categories: default_recurrence
alter table cost_categories add column if not exists default_recurrence text default 'once';


-- ═══════════════════════════════════════════════════════════════
-- PARTE 3 — RLS
-- ═══════════════════════════════════════════════════════════════

alter table aircraft          enable row level security;
alter table flights           enable row level security;
alter table costs             enable row level security;
alter table maintenance       enable row level security;
alter table missions          enable row level security;
alter table fuel_prices       enable row level security;
alter table user_settings     enable row level security;
alter table oil_logs          enable row level security;
alter table crew_members      enable row level security;
alter table crew_documents    enable row level security;
alter table airports          enable row level security;
alter table components        enable row level security;
alter table airports_db       enable row level security;
alter table airport_overrides enable row level security;
alter table engine_events     enable row level security;
alter table cost_categories   enable row level security;
alter table organizations     enable row level security;
alter table org_members       enable row level security;

-- Remove policies existentes para recriar sem conflito
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where tablename in (
      'aircraft','flights','costs','maintenance','missions',
      'fuel_prices','user_settings','oil_logs','crew_members','crew_documents',
      'airports','components','airports_db','airport_overrides',
      'engine_events','cost_categories','organizations','org_members'
    )
  loop
    execute format('drop policy if exists %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy "users_own_aircraft"           on aircraft          for all using (auth.uid() = user_id);
create policy "users_own_flights"            on flights           for all using (auth.uid() = user_id);
create policy "users_own_costs"              on costs             for all using (auth.uid() = user_id);
create policy "users_own_maintenance"        on maintenance       for all using (auth.uid() = user_id);
create policy "users_own_missions"           on missions          for all using (auth.uid() = user_id);
create policy "users_own_fuel_prices"        on fuel_prices       for all using (auth.uid() = user_id);
create policy "users_own_settings"           on user_settings     for all using (auth.uid() = user_id);
create policy "users_own_oil_logs"           on oil_logs          for all using (auth.uid() = user_id);
create policy "users_own_crew_members"       on crew_members      for all using (auth.uid() = user_id);
create policy "users_own_crew_documents"     on crew_documents    for all using (auth.uid() = user_id);
create policy "airports_anac_public_read"    on airports          for select using (true);
create policy "users_own_components"         on components        for all using (auth.uid() = user_id);
create policy "airports_db_read_all"         on airports_db       for select using (true);
create policy "airports_db_insert_auth"      on airports_db       for insert with check (auth.uid() is not null);
create policy "airports_db_update_own"       on airports_db       for update using (created_by = auth.uid());
create policy "airports_db_delete_own"       on airports_db       for delete using (created_by = auth.uid());
create policy "users_own_airport_overrides"  on airport_overrides for all using (auth.uid() = user_id);
create policy "users_own_engine_events"      on engine_events     for all using (auth.uid() = user_id);
create policy "users_own_cost_categories"    on cost_categories   for all using (auth.uid() = user_id);
create policy "orgs_read_all"                on organizations     for select using (true);
create policy "orgs_insert_auth"             on organizations     for insert with check (auth.uid() = created_by);
create policy "orgs_update_owner"            on organizations     for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from org_members
      where org_id = organizations.id
        and user_id = auth.uid()
        and role in ('owner','admin')
    )
  );
create policy "users_own_org_members"        on org_members       for all using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════
-- PARTE 4 — FKs diferidas de costs
-- Agora seguro: tabelas e colunas já existem
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'costs_category_id_fkey'
  ) then
    alter table costs add constraint costs_category_id_fkey
      foreign key (category_id) references cost_categories(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'costs_engine_event_id_fkey'
  ) then
    alter table costs add constraint costs_engine_event_id_fkey
      foreign key (engine_event_id) references engine_events(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'costs_airport_id_fkey'
  ) then
    alter table costs add constraint costs_airport_id_fkey
      foreign key (airport_id) references airports_db(id);
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- PARTE 5 — Índices
-- Agora seguro: todas as colunas já existem (Parte 2)
-- ═══════════════════════════════════════════════════════════════

create index if not exists idx_aircraft_user              on aircraft(user_id);
create index if not exists idx_flights_user               on flights(user_id);
create index if not exists idx_flights_aircraft           on flights(aircraft_id);
create index if not exists idx_flights_date               on flights(date desc);
create index if not exists idx_costs_user                 on costs(user_id);
create index if not exists idx_costs_aircraft             on costs(aircraft_id);
create index if not exists idx_costs_recurrence           on costs(recurrence);
create index if not exists idx_costs_category_id          on costs(category_id);
create index if not exists idx_maintenance_user           on maintenance(user_id);
create index if not exists idx_maintenance_aircraft       on maintenance(aircraft_id);
create index if not exists idx_missions_user              on missions(user_id);
create index if not exists idx_fuel_prices_user           on fuel_prices(user_id);
create index if not exists idx_fuel_prices_icao           on fuel_prices(icao);
create index if not exists idx_oil_logs_aircraft          on oil_logs(aircraft_id);
create index if not exists idx_crew_members_user          on crew_members(user_id);
create index if not exists idx_crew_docs_member           on crew_documents(crew_member_id);
create index if not exists idx_airports_icao              on airports(icao);
create index if not exists idx_airports_country           on airports(country);
create index if not exists idx_airports_name              on airports(name);
create index if not exists idx_components_user            on components(user_id);
create index if not exists idx_components_aircraft        on components(aircraft_id);
create index if not exists idx_components_category        on components(category);
create index if not exists idx_airports_db_icao           on airports_db(icao);
create index if not exists idx_airports_db_country        on airports_db(country);
create index if not exists idx_airports_db_type           on airports_db(type);
create index if not exists idx_airport_overrides_user     on airport_overrides(user_id);
create index if not exists idx_engine_events_aircraft     on engine_events(aircraft_id);
create index if not exists idx_engine_events_type         on engine_events(event_type);
create index if not exists idx_engine_events_date         on engine_events(event_date desc);
create index if not exists idx_cost_categories_user       on cost_categories(user_id);
create index if not exists idx_org_members_user           on org_members(user_id);
create index if not exists idx_org_members_org            on org_members(org_id);


-- ═══════════════════════════════════════════════════════════════
-- PARTE 6 — Triggers de updated_at
-- ═══════════════════════════════════════════════════════════════

drop trigger if exists trg_aircraft_updated          on aircraft;
drop trigger if exists trg_flights_updated           on flights;
drop trigger if exists trg_costs_updated             on costs;
drop trigger if exists trg_maintenance_updated       on maintenance;
drop trigger if exists trg_missions_updated          on missions;
drop trigger if exists trg_crew_members_updated      on crew_members;
drop trigger if exists trg_crew_documents_updated    on crew_documents;
drop trigger if exists trg_components_updated        on components;
drop trigger if exists trg_airports_db_updated       on airports_db;
drop trigger if exists trg_airport_overrides_updated on airport_overrides;
drop trigger if exists trg_engine_events_updated     on engine_events;
drop trigger if exists trg_organizations_updated     on organizations;
drop trigger if exists trg_user_settings_updated     on user_settings;

create trigger trg_aircraft_updated          before update on aircraft          for each row execute function update_updated_at();
create trigger trg_flights_updated           before update on flights            for each row execute function update_updated_at();
create trigger trg_costs_updated             before update on costs              for each row execute function update_updated_at();
create trigger trg_maintenance_updated       before update on maintenance        for each row execute function update_updated_at();
create trigger trg_missions_updated          before update on missions           for each row execute function update_updated_at();
create trigger trg_crew_members_updated      before update on crew_members       for each row execute function update_updated_at();
create trigger trg_crew_documents_updated    before update on crew_documents     for each row execute function update_updated_at();
create trigger trg_components_updated        before update on components         for each row execute function update_updated_at();
create trigger trg_airports_db_updated       before update on airports_db        for each row execute function update_updated_at();
create trigger trg_airport_overrides_updated before update on airport_overrides  for each row execute function update_updated_at();
create trigger trg_engine_events_updated     before update on engine_events      for each row execute function update_updated_at();
create trigger trg_organizations_updated     before update on organizations      for each row execute function update_updated_at();
create trigger trg_user_settings_updated     before update on user_settings      for each row execute function update_updated_at();


-- ═══════════════════════════════════════════════════════════════
-- PARTE 7 — Realtime
-- ═══════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['aircraft','flights','costs','maintenance','missions'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when others then null;
    end;
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- FIM — AeroManager v5.19 rev3
-- 18 tabelas · 23 políticas RLS · 32 índices · 13 triggers
-- ═══════════════════════════════════════════════════════════════
