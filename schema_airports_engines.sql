-- ══════════════════════════════════════════════════════════════
-- AeroManager — Schema Extensível v2
-- Aeroportos + Taxas + Engine Events + Custos Recorrentes
-- ══════════════════════════════════════════════════════════════

-- ── AEROPORTOS (tabela global + overrides por usuário) ────────
create table if not exists airports_db (
  id            uuid primary key default uuid_generate_v4(),
  icao          text not null,            -- SBSP, SBBR, KJFK...
  iata          text,
  name          text not null,
  city          text,
  state         text,
  country       text default 'BR',
  type          text default 'public',    -- public | private | military | helipad
  anac_category text,                     -- A | B | C | D
  lat           numeric,
  lng           numeric,

  -- Taxas base (editáveis por qualquer usuário autenticado como "proposta")
  landing_fee_brl       numeric,          -- R$ fixo ou por tonelada MTOW
  landing_fee_per_ton   boolean default false,
  parking_fee_brl_hour  numeric,          -- permanência R$/hora
  hangar_fee_brl_day    numeric,          -- hangar R$/diária
  atis_fee_brl          numeric,
  handling_fee_brl      numeric,
  fuel_avgas_brl_l      numeric,
  fuel_jeta1_brl_l      numeric,

  -- Serviços disponíveis (flags)
  has_tower       boolean default false,
  has_app         boolean default false,
  has_afis        boolean default false,
  has_customs     boolean default false,
  has_mro         boolean default false,
  has_catering    boolean default false,
  has_avgas       boolean default false,
  has_jeta1       boolean default false,

  -- Metadados
  source          text default 'user',    -- anac | user | fbo | system
  verified        boolean default false,
  notes           text,
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique(icao, country)
);

-- Override pessoal de taxas (usuário customiza sem alterar a base global)
create table if not exists airport_overrides (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  airport_id    uuid references airports_db(id) on delete cascade not null,
  -- Qualquer campo de taxa pode ser sobrescrito; null = usa a base global
  landing_fee_brl       numeric,
  parking_fee_brl_hour  numeric,
  hangar_fee_brl_day    numeric,
  atis_fee_brl          numeric,
  fuel_avgas_brl_l      numeric,
  fuel_jeta1_brl_l      numeric,
  notes         text,
  updated_at    timestamptz default now(),
  unique(user_id, airport_id)
);

-- RLS Aeroportos: leitura pública, escrita autenticado
alter table airports_db enable row level security;
create policy "airports_read_all"   on airports_db for select using (true);
create policy "airports_write_auth" on airports_db for insert with check (auth.uid() is not null);
create policy "airports_update_own" on airports_db for update using (created_by = auth.uid());

alter table airport_overrides enable row level security;
create policy "overrides_own" on airport_overrides for all using (auth.uid() = user_id);

-- Índices
create index if not exists idx_airports_icao    on airports_db(icao);
create index if not exists idx_airports_country on airports_db(country);
create index if not exists idx_airport_overrides_user on airport_overrides(user_id);


-- ── ENGINE EVENTS (histórico de motor por aeronave) ───────────
create table if not exists engine_events (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  aircraft_id   uuid references aircraft(id) on delete cascade not null,
  engine_position int default 1,          -- 1=motor único/esquerdo, 2=direito, 0=APU
  event_type    text not null,
  -- event_type values:
  --   install      — instalação (novo/remanufaturado/aluguel)
  --   remove       — remoção (manutenção/venda/devolução)
  --   sell         — venda do motor
  --   buy          — compra do motor
  --   rent_in      — aluguel recebido (motor vai para outra aeronave)
  --   rent_out     — aluguel dado (motor de terceiro instalado)
  --   program_enroll  — entrada em programa (JSSI, MSP, TAP, etc.)
  --   program_exit    — saída de programa
  --   overhaul     — revisão geral (OH)
  --   borescope    — inspeção boroscópica
  --   repair       — reparo pontual
  --   trend_check  — trend monitoring / power check

  event_date    date not null,
  airframe_hours_at_event numeric,        -- horas da célula no momento
  engine_tsn    numeric,                  -- Time Since New no momento do evento
  engine_tso    numeric,                  -- Time Since Overhaul no momento do evento
  engine_csn    int,                      -- Cycles Since New

  -- Campos financeiros (opcionais)
  amount_brl    numeric,                  -- valor R$ (compra/venda/aluguel)
  currency      text default 'BRL',
  counterparty  text,                     -- quem vendeu/comprou/alugou

  -- Campos de programa de motor
  program_name  text,                     -- JSSI, MSP, TAP, EME, etc.
  program_coverage text,                  -- OH completo, LLP, workscope...
  program_rate_per_hour numeric,          -- R$ ou US$ por hora

  -- Campos de aluguel
  rental_start  date,
  rental_end    date,
  rental_rate_type text,                  -- hour | month | cycle
  rental_rate   numeric,

  -- Referências
  work_order    text,                     -- OS da oficina
  shop_name     text,                     -- oficina que executou
  doc_ref       text,                     -- referência do documento

  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table engine_events enable row level security;
create policy "engine_events_own" on engine_events for all using (auth.uid() = user_id);
create index if not exists idx_engine_events_aircraft on engine_events(aircraft_id);
create index if not exists idx_engine_events_type     on engine_events(event_type);


-- ── COST CATEGORIES (categorias livres por usuário) ───────────
create table if not exists cost_categories (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  group_type  text default 'operational',
  -- group_type: operational | maintenance | fixed | admin | reserve | revenue
  color       text,                       -- hex para UI
  icon        text,                       -- emoji ou nome de ícone
  is_default  boolean default false,      -- categorias padrão do sistema
  sort_order  int default 0,
  created_at  timestamptz default now(),
  unique(user_id, name)
);

alter table cost_categories enable row level security;
create policy "categories_own" on cost_categories for all using (auth.uid() = user_id);


-- ── COSTS (extensão com recorrência e taxas) ─────────────────
-- Adiciona campos aos costs existentes
alter table costs add column if not exists category_id    uuid references cost_categories(id);
alter table costs add column if not exists recurrence     text default 'once';
-- recurrence: once | daily | weekly | monthly | quarterly | annual | per_hour | per_cycle
alter table costs add column if not exists recurrence_day int;        -- dia do mês para monthly
alter table costs add column if not exists recurrence_end date;       -- data fim da recorrência
alter table costs add column if not exists billing_period text;       -- referência "2024-03"
alter table costs add column if not exists airport_id     uuid references airports_db(id);
alter table costs add column if not exists engine_event_id uuid references engine_events(id);
alter table costs add column if not exists invoice_number text;
alter table costs add column if not exists vendor        text;
alter table costs add column if not exists is_template   boolean default false; -- template p/ recorrência
alter table costs add column if not exists template_id   uuid;        -- se gerado de um template


-- ── ORGANIZAÇÃO / STAKEHOLDERS (fase 2 seed) ─────────────────
create table if not exists organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  type        text not null,
  -- type: fbo | mro | air_taxi | flight_school | catering | handling
  --       hangar | insurance | finance | fuel | owner | operator
  cnpj        text,
  icao_base   text,                       -- aeroporto sede (ICAO)
  description text,
  phone       text,
  email       text,
  website     text,
  logo_url    text,
  verified    boolean default false,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Vínculo usuário ↔ organização (um user pode ter múltiplos papéis)
create table if not exists org_members (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid references organizations(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  role        text default 'member',
  -- role: owner | admin | manager | member | read_only
  joined_at   timestamptz default now(),
  unique(org_id, user_id)
);

alter table organizations enable row level security;
create policy "orgs_read_all"   on organizations for select using (true);
create policy "orgs_write_own"  on organizations for insert with check (auth.uid() = created_by);
create policy "orgs_update_own" on organizations for update
  using (created_by = auth.uid() or exists (
    select 1 from org_members where org_id = organizations.id
    and user_id = auth.uid() and role in ('owner','admin')
  ));

alter table org_members enable row level security;
create policy "members_own" on org_members for all using (auth.uid() = user_id);

-- Triggers updated_at
drop trigger if exists trg_airports_db_updated    on airports_db;
drop trigger if exists trg_engine_events_updated  on engine_events;
drop trigger if exists trg_organizations_updated  on organizations;

create trigger trg_airports_db_updated    before update on airports_db    for each row execute function update_updated_at();
create trigger trg_engine_events_updated  before update on engine_events  for each row execute function update_updated_at();
create trigger trg_organizations_updated  before update on organizations  for each row execute function update_updated_at();

-- Seed: categorias padrão (inserido para novos usuários via trigger ou first-run)
-- Será criado no frontend no primeiro login

