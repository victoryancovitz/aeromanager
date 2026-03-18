-- ═══════════════════════════════════════════════════════════
-- AeroManager — Schema definitivo v5.9
-- Cole no SQL Editor do Supabase apenas o que ainda não existe
-- ═══════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ── Tabelas ──────────────────────────────────────────────────

create table if not exists aircraft (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  registration text not null,
  type text not null default 'single_engine',
  manufacturer text, model text, year int,
  engine_model text, engine_tbo_hours numeric,
  prop_model text, prop_tbo_hours numeric,
  base_airframe_hours numeric default 0,
  total_flight_hours numeric default 0,
  total_engine_hours numeric default 0,
  total_cycles int default 0,
  fuel_type text default 'avgas_100ll',
  fuel_capacity_liters numeric,
  home_base text, monthly_fixed numeric default 0,
  performance_profiles jsonb default '[]',
  climb_profiles jsonb default '[]',
  fuel_bias_manual numeric,
  anac_config jsonb default '{"status":"nao_configurado"}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists flights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  aircraft_id uuid references aircraft(id) on delete set null,
  date date not null,
  departure_icao text, destination_icao text, alternate_icao text,
  takeoff_utc text, landing_utc text,
  flight_time_minutes int default 0,
  flight_time_day int default 0,
  flight_time_night int default 0,
  flight_time_ifr int default 0,
  distance_nm numeric default 0,
  cruise_altitude_ft int default 0,
  max_altitude_ft int default 0,
  fuel_added_liters numeric default 0,
  fuel_price_per_liter numeric default 0,
  fuel_vendor text, flight_conditions text default 'vfr',
  purpose text default 'leisure', cycles int default 1,
  phase_climb_min int default 0,
  phase_cruise_min int default 0,
  phase_descent_min int default 0,
  source text default 'manual',
  gps_track_points int default 0,
  logbook_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists costs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  aircraft_id uuid references aircraft(id) on delete set null,
  flight_id uuid references flights(id) on delete set null,
  category text not null, cost_type text default 'variable',
  amount_brl numeric not null default 0,
  description text, reference_date date, vendor text, receipt_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists maintenance (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  aircraft_id uuid references aircraft(id) on delete cascade,
  item_type text default 'inspection', name text not null,
  interval_hours numeric, interval_days int,
  last_done_hours numeric, last_done_date date,
  next_due_hours numeric, next_due_date date,
  status text default 'current',
  estimated_cost_brl numeric default 0, notes text,
  deferred_until_date date,
  deferred_until_hours numeric,
  deferral_ref text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists missions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  aircraft_id uuid references aircraft(id) on delete set null,
  name text not null, type text default 'round_trip',
  status text default 'planned', purpose text default 'leisure',
  date_start date, date_end date,
  legs jsonb default '[]', passengers jsonb default '[]', notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists fuel_prices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  icao text not null, price_per_liter numeric not null,
  liters numeric default 0, fuel_type text default 'avgas_100ll',
  vendor text, date date not null,
  flight_id uuid references flights(id) on delete set null,
  notes text, recorded_at timestamptz default now()
);

create table if not exists user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  api_key text, fuel_unit text default 'liters', currency text default 'BRL',
  anac_credentials jsonb default '{}', integrations jsonb default '{}',
  updated_at timestamptz default now()
);

create table if not exists oil_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  aircraft_id uuid references aircraft(id) on delete cascade,
  date date not null, hours_at_check numeric not null,
  qt_added numeric not null, qt_after numeric, notes text,
  created_at timestamptz default now()
);

create table if not exists crew_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  full_name text not null, display_name text,
  role text default 'captain', nationality text,
  dob date, anac_code text, is_self boolean default false, notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crew_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  crew_member_id uuid references crew_members(id) on delete cascade not null,
  doc_type text not null, doc_number text,
  issuing_country text, issuing_authority text,
  issue_date date, expiry_date date,
  raw_data jsonb default '{}', notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists airports (
  id serial primary key,
  icao text unique, iata text,
  name text not null, city text, state text,
  country text default 'BR',
  latitude numeric, longitude numeric,
  elevation_ft int, airport_type text, municipality text,
  scheduled_service boolean default false,
  created_at timestamptz default now()
);

-- ── RLS ──────────────────────────────────────────────────────

alter table aircraft       enable row level security;
alter table flights        enable row level security;
alter table costs          enable row level security;
alter table maintenance    enable row level security;
alter table missions       enable row level security;
alter table fuel_prices    enable row level security;
alter table user_settings  enable row level security;
alter table oil_logs       enable row level security;
alter table crew_members   enable row level security;
alter table crew_documents enable row level security;
alter table airports       enable row level security;

do $$ begin
  drop policy if exists "users_own_aircraft"       on aircraft;
  drop policy if exists "users_own_flights"        on flights;
  drop policy if exists "users_own_costs"          on costs;
  drop policy if exists "users_own_maintenance"    on maintenance;
  drop policy if exists "users_own_missions"       on missions;
  drop policy if exists "users_own_fuel_prices"    on fuel_prices;
  drop policy if exists "users_own_settings"       on user_settings;
  drop policy if exists "users_own_oil_logs"       on oil_logs;
  drop policy if exists "users_own_crew_members"   on crew_members;
  drop policy if exists "users_own_crew_documents" on crew_documents;
  drop policy if exists "airports_public_read"     on airports;
end $$;

create policy "users_own_aircraft"       on aircraft       for all using (auth.uid() = user_id);
create policy "users_own_flights"        on flights        for all using (auth.uid() = user_id);
create policy "users_own_costs"          on costs          for all using (auth.uid() = user_id);
create policy "users_own_maintenance"    on maintenance    for all using (auth.uid() = user_id);
create policy "users_own_missions"       on missions       for all using (auth.uid() = user_id);
create policy "users_own_fuel_prices"    on fuel_prices    for all using (auth.uid() = user_id);
create policy "users_own_settings"       on user_settings  for all using (auth.uid() = user_id);
create policy "users_own_oil_logs"       on oil_logs       for all using (auth.uid() = user_id);
create policy "users_own_crew_members"   on crew_members   for all using (auth.uid() = user_id);
create policy "users_own_crew_documents" on crew_documents for all using (auth.uid() = user_id);
create policy "airports_public_read"     on airports       for select using (true);

-- ── Índices ──────────────────────────────────────────────────

create index if not exists idx_aircraft_user        on aircraft(user_id);
create index if not exists idx_flights_user         on flights(user_id);
create index if not exists idx_flights_aircraft     on flights(aircraft_id);
create index if not exists idx_flights_date         on flights(date desc);
create index if not exists idx_costs_user           on costs(user_id);
create index if not exists idx_costs_aircraft       on costs(aircraft_id);
create index if not exists idx_maintenance_user     on maintenance(user_id);
create index if not exists idx_maintenance_aircraft on maintenance(aircraft_id);
create index if not exists idx_missions_user        on missions(user_id);
create index if not exists idx_fuel_prices_user     on fuel_prices(user_id);
create index if not exists idx_fuel_prices_icao     on fuel_prices(icao);
create index if not exists idx_oil_logs_aircraft    on oil_logs(aircraft_id);
create index if not exists idx_crew_members_user    on crew_members(user_id);
create index if not exists idx_crew_docs_member     on crew_documents(crew_member_id);
create index if not exists idx_airports_icao        on airports(icao);
create index if not exists idx_airports_country     on airports(country);
create index if not exists idx_airports_name        on airports(name);

-- ── Triggers ─────────────────────────────────────────────────

drop trigger if exists trg_aircraft_updated       on aircraft;
drop trigger if exists trg_flights_updated        on flights;
drop trigger if exists trg_costs_updated          on costs;
drop trigger if exists trg_maintenance_updated    on maintenance;
drop trigger if exists trg_missions_updated       on missions;
drop trigger if exists trg_crew_members_updated   on crew_members;
drop trigger if exists trg_crew_documents_updated on crew_documents;

create trigger trg_aircraft_updated       before update on aircraft       for each row execute function update_updated_at();
create trigger trg_flights_updated        before update on flights         for each row execute function update_updated_at();
create trigger trg_costs_updated          before update on costs           for each row execute function update_updated_at();
create trigger trg_maintenance_updated    before update on maintenance     for each row execute function update_updated_at();
create trigger trg_missions_updated       before update on missions        for each row execute function update_updated_at();
create trigger trg_crew_members_updated   before update on crew_members    for each row execute function update_updated_at();
create trigger trg_crew_documents_updated before update on crew_documents  for each row execute function update_updated_at();

-- ── Realtime ─────────────────────────────────────────────────

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

-- ── Diferimento (garante colunas mesmo em bancos antigos) ────

alter table maintenance add column if not exists deferred_until_date  date;
alter table maintenance add column if not exists deferred_until_hours numeric;
alter table maintenance add column if not exists deferral_ref         text;

-- ── Mapa de Controle de Componentes (MCC) ────────────────────
create table if not exists components (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  aircraft_id uuid references aircraft(id) on delete cascade,
  nomenclature text not null,
  pn text,                    -- Part Number
  ns text,                    -- Serial Number
  tlv text,                   -- Tempo Limite de Vida
  tbo text,                   -- Time Between Overhaul
  tsn text,                   -- Time Since New
  tso text,                   -- Time Since Overhaul
  csn text,                   -- Cycles Since New
  cso text,                   -- Cycles Since Overhaul
  due_hours text,             -- Vencimento em horas (HS/T)
  due_date date,              -- Vencimento por data
  due_condition text,         -- "On condition", "N/A"
  shop text,                  -- Oficina responsável
  category text default 'other',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_components_user     on components(user_id);
create index if not exists idx_components_aircraft on components(aircraft_id);

alter table components enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'components' and policyname = 'users_own_components'
  ) then
    create policy "users_own_components" on components for all using (auth.uid() = user_id);
  end if;
end $$;

drop trigger if exists trg_components_updated on components;
create trigger trg_components_updated before update on components
  for each row execute function update_updated_at();

-- ── APU fields for aircraft ───────────────────────────────────
alter table aircraft add column if not exists apu_model text;
alter table aircraft add column if not exists apu_tbo_hours numeric;
alter table aircraft add column if not exists apu_total_hours numeric default 0;
alter table aircraft add column if not exists apu_cycles int default 0;
