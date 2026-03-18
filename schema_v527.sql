-- ═══════════════════════════════════════════════════════════════
-- AeroManager — Schema Completo v5.27
-- Execute no Supabase SQL Editor
-- Seguro para rodar em banco já existente (IF NOT EXISTS em tudo)
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ── Tabelas ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aircraft (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  registration         TEXT NOT NULL,
  type                 TEXT NOT NULL DEFAULT 'single_engine',
  manufacturer         TEXT, model TEXT, year INT,
  engine_model         TEXT, engine_tbo_hours NUMERIC,
  prop_model           TEXT, prop_tbo_hours NUMERIC,
  apu_model            TEXT, apu_tbo_hours NUMERIC,
  apu_total_hours      NUMERIC DEFAULT 0, apu_cycles INT DEFAULT 0,
  base_airframe_hours  NUMERIC DEFAULT 0,
  total_flight_hours   NUMERIC DEFAULT 0,
  total_engine_hours   NUMERIC DEFAULT 0,
  total_cycles         INT DEFAULT 0,
  fuel_type            TEXT DEFAULT 'avgas_100ll',
  fuel_capacity_liters NUMERIC, fuel_bias_manual NUMERIC,
  home_base            TEXT, monthly_fixed NUMERIC DEFAULT 0,
  performance_profiles JSONB DEFAULT '[]',
  climb_profiles       JSONB DEFAULT '[]',
  anac_config          JSONB DEFAULT '{"status":"nao_configurado"}',
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aircraft_id  UUID REFERENCES aircraft(id) ON DELETE SET NULL,
  flight_id    UUID,  -- FK adicionada depois (circular ref com flights)
  name         TEXT NOT NULL,
  type         TEXT DEFAULT 'round_trip',
  status       TEXT DEFAULT 'planned',
  purpose      TEXT DEFAULT 'leisure',
  date_start   DATE, date_end DATE,
  legs         JSONB DEFAULT '[]',
  passengers   JSONB DEFAULT '[]',
  notes        TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flights (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aircraft_id          UUID REFERENCES aircraft(id) ON DELETE SET NULL,
  mission_id           UUID REFERENCES missions(id) ON DELETE SET NULL,
  date                 DATE NOT NULL,
  departure_icao       TEXT, destination_icao TEXT, alternate_icao TEXT,
  takeoff_utc          TEXT, landing_utc TEXT,
  flight_time_minutes  INT DEFAULT 0, flight_time_day INT DEFAULT 0,
  flight_time_night    INT DEFAULT 0, flight_time_ifr INT DEFAULT 0,
  distance_nm          NUMERIC DEFAULT 0,
  cruise_altitude_ft   INT DEFAULT 0, max_altitude_ft INT DEFAULT 0,
  fuel_added_liters    NUMERIC DEFAULT 0, fuel_price_per_liter NUMERIC DEFAULT 0,
  fuel_vendor          TEXT, flight_conditions TEXT DEFAULT 'vfr',
  purpose              TEXT DEFAULT 'leisure', cycles INT DEFAULT 1,
  phase_climb_min      INT DEFAULT 0, phase_cruise_min INT DEFAULT 0,
  phase_descent_min    INT DEFAULT 0,
  source               TEXT DEFAULT 'manual', gps_track_points INT DEFAULT 0,
  logbook_notes        TEXT,
  journey_status       TEXT DEFAULT 'registered',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Agora que flights existe, adiciona FK circular em missions
ALTER TABLE missions ADD COLUMN IF NOT EXISTS flight_id UUID REFERENCES flights(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS costs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aircraft_id       UUID REFERENCES aircraft(id) ON DELETE SET NULL,
  flight_id         UUID REFERENCES flights(id) ON DELETE SET NULL,
  mission_id        UUID REFERENCES missions(id) ON DELETE SET NULL,
  category          TEXT NOT NULL,
  cost_type         TEXT DEFAULT 'variable',
  amount_brl        NUMERIC NOT NULL DEFAULT 0,
  description       TEXT, reference_date DATE, vendor TEXT, receipt_url TEXT,
  recurrence        TEXT DEFAULT 'once',
  recurrence_day    INT, recurrence_end DATE, billing_period TEXT,
  category_id       UUID,
  engine_event_id   UUID,
  airport_id        UUID,
  invoice_number    TEXT,
  is_template       BOOLEAN DEFAULT FALSE, template_id UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aircraft_id           UUID REFERENCES aircraft(id) ON DELETE CASCADE,
  item_type             TEXT DEFAULT 'inspection', name TEXT NOT NULL,
  interval_hours        NUMERIC, interval_days INT,
  last_done_hours       NUMERIC, last_done_date DATE,
  next_due_hours        NUMERIC, next_due_date DATE,
  status                TEXT DEFAULT 'current',
  estimated_cost_brl    NUMERIC DEFAULT 0, notes TEXT,
  deferred_until_date   DATE, deferred_until_hours NUMERIC, deferral_ref TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_prices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  icao             TEXT NOT NULL, price_per_liter NUMERIC NOT NULL,
  liters           NUMERIC DEFAULT 0, fuel_type TEXT DEFAULT 'avgas_100ll',
  vendor           TEXT, date DATE NOT NULL,
  flight_id        UUID REFERENCES flights(id) ON DELETE SET NULL,
  notes            TEXT, recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  api_key          TEXT, fuel_unit TEXT DEFAULT 'liters', currency TEXT DEFAULT 'BRL',
  anac_credentials JSONB DEFAULT '{}', integrations JSONB DEFAULT '{}',
  profile          JSONB DEFAULT '{}',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oil_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aircraft_id    UUID REFERENCES aircraft(id) ON DELETE CASCADE,
  date           DATE NOT NULL, hours_at_check NUMERIC NOT NULL,
  qt_added       NUMERIC NOT NULL, qt_after NUMERIC, notes TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crew_members (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name    TEXT NOT NULL, display_name TEXT,
  role         TEXT DEFAULT 'captain', nationality TEXT,
  dob          DATE, anac_code TEXT, is_self BOOLEAN DEFAULT FALSE, notes TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crew_documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  crew_member_id    UUID REFERENCES crew_members(id) ON DELETE CASCADE NOT NULL,
  doc_type          TEXT NOT NULL, doc_number TEXT,
  issuing_country   TEXT, issuing_authority TEXT,
  issue_date        DATE, expiry_date DATE,
  raw_data          JSONB DEFAULT '{}', notes TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS airports (
  id            SERIAL PRIMARY KEY,
  icao          TEXT UNIQUE, iata TEXT, name TEXT NOT NULL,
  city          TEXT, state TEXT, country TEXT DEFAULT 'BR',
  latitude      NUMERIC, longitude NUMERIC, elevation_ft INT,
  airport_type  TEXT, municipality TEXT,
  scheduled_service BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS components (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aircraft_id   UUID REFERENCES aircraft(id) ON DELETE CASCADE,
  nomenclature  TEXT NOT NULL,
  pn TEXT, ns TEXT, tlv TEXT, tbo TEXT,
  tsn TEXT, tso TEXT, csn TEXT, cso TEXT,
  due_hours     TEXT, due_date DATE, due_condition TEXT,
  shop          TEXT, category TEXT DEFAULT 'other', notes TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS airports_db (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  icao                  TEXT NOT NULL, iata TEXT, name TEXT NOT NULL,
  city TEXT, state TEXT, country TEXT DEFAULT 'BR',
  type                  TEXT DEFAULT 'public',
  anac_category         TEXT, lat NUMERIC, lng NUMERIC,
  landing_fee_brl       NUMERIC, landing_fee_per_ton BOOLEAN DEFAULT FALSE,
  parking_fee_brl_hour  NUMERIC, hangar_fee_brl_day NUMERIC,
  atis_fee_brl          NUMERIC, handling_fee_brl NUMERIC,
  fuel_avgas_brl_l      NUMERIC, fuel_jeta1_brl_l NUMERIC,
  has_tower BOOLEAN DEFAULT FALSE, has_app BOOLEAN DEFAULT FALSE,
  has_afis BOOLEAN DEFAULT FALSE, has_customs BOOLEAN DEFAULT FALSE,
  has_mro BOOLEAN DEFAULT FALSE, has_catering BOOLEAN DEFAULT FALSE,
  has_avgas BOOLEAN DEFAULT FALSE, has_jeta1 BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'user', verified BOOLEAN DEFAULT FALSE, notes TEXT,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(icao, country)
);

CREATE TABLE IF NOT EXISTS airport_overrides (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  airport_id            UUID REFERENCES airports_db(id) ON DELETE CASCADE NOT NULL,
  landing_fee_brl       NUMERIC, parking_fee_brl_hour NUMERIC,
  hangar_fee_brl_day    NUMERIC, atis_fee_brl NUMERIC,
  fuel_avgas_brl_l      NUMERIC, fuel_jeta1_brl_l NUMERIC,
  notes TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, airport_id)
);

CREATE TABLE IF NOT EXISTS engine_events (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aircraft_id             UUID REFERENCES aircraft(id) ON DELETE CASCADE NOT NULL,
  engine_position         INT DEFAULT 1,
  event_type              TEXT NOT NULL, event_date DATE NOT NULL,
  airframe_hours_at_event NUMERIC, engine_tsn NUMERIC, engine_tso NUMERIC, engine_csn INT,
  amount_brl NUMERIC, currency TEXT DEFAULT 'BRL', counterparty TEXT,
  program_name TEXT, program_coverage TEXT, program_rate_per_hour NUMERIC,
  rental_start DATE, rental_end DATE, rental_rate_type TEXT, rental_rate NUMERIC,
  work_order TEXT, shop_name TEXT, doc_ref TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_categories (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name               TEXT NOT NULL, group_type TEXT DEFAULT 'other',
  color TEXT, icon TEXT, sort_order INT DEFAULT 0,
  default_recurrence TEXT DEFAULT 'once',
  is_default         BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, type TEXT NOT NULL,
  cnpj TEXT, icao_base TEXT, description TEXT,
  phone TEXT, email TEXT, website TEXT, logo_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ── ALTER TABLE (seguro para bancos existentes) ───────────────

ALTER TABLE aircraft     ADD COLUMN IF NOT EXISTS apu_model TEXT;
ALTER TABLE aircraft     ADD COLUMN IF NOT EXISTS apu_tbo_hours NUMERIC;
ALTER TABLE aircraft     ADD COLUMN IF NOT EXISTS apu_total_hours NUMERIC DEFAULT 0;
ALTER TABLE aircraft     ADD COLUMN IF NOT EXISTS apu_cycles INT DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}';
ALTER TABLE maintenance  ADD COLUMN IF NOT EXISTS deferred_until_date DATE;
ALTER TABLE maintenance  ADD COLUMN IF NOT EXISTS deferred_until_hours NUMERIC;
ALTER TABLE maintenance  ADD COLUMN IF NOT EXISTS deferral_ref TEXT;
ALTER TABLE components   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'once';
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS recurrence_day INT;
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS recurrence_end DATE;
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS billing_period TEXT;
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS engine_event_id UUID;
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS airport_id UUID;
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS template_id UUID;
ALTER TABLE costs        ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id) ON DELETE SET NULL;
ALTER TABLE cost_categories ADD COLUMN IF NOT EXISTS default_recurrence TEXT DEFAULT 'once';
ALTER TABLE missions     ADD COLUMN IF NOT EXISTS flight_id UUID REFERENCES flights(id) ON DELETE SET NULL;
ALTER TABLE missions     ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE missions     ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE flights      ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id) ON DELETE SET NULL;
ALTER TABLE flights      ADD COLUMN IF NOT EXISTS journey_status TEXT DEFAULT 'registered';

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE aircraft          ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights           ENABLE ROW LEVEL SECURITY;
ALTER TABLE costs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE oil_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE airports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE components        ENABLE ROW LEVEL SECURITY;
ALTER TABLE airports_db       ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies
    WHERE tablename IN ('aircraft','flights','costs','maintenance','missions',
      'fuel_prices','user_settings','oil_logs','crew_members','crew_documents',
      'airports','components','airports_db','airport_overrides',
      'engine_events','cost_categories','organizations','org_members')
  LOOP
    EXECUTE FORMAT('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "users_own_aircraft"          ON aircraft          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_flights"           ON flights           FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_costs"             ON costs             FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_maintenance"       ON maintenance       FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_missions"          ON missions          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_fuel_prices"       ON fuel_prices       FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_settings"          ON user_settings     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_oil_logs"          ON oil_logs          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_crew_members"      ON crew_members      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_crew_documents"    ON crew_documents    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "airports_public_read"        ON airports          FOR SELECT USING (TRUE);
CREATE POLICY "users_own_components"        ON components        FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "airports_db_read_all"        ON airports_db       FOR SELECT USING (TRUE);
CREATE POLICY "airports_db_insert_auth"     ON airports_db       FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "airports_db_update_own"      ON airports_db       FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "airports_db_delete_own"      ON airports_db       FOR DELETE USING (created_by = auth.uid());
CREATE POLICY "users_own_airport_overrides" ON airport_overrides FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_engine_events"     ON engine_events     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_cost_categories"   ON cost_categories   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "orgs_read_all"               ON organizations     FOR SELECT USING (TRUE);
CREATE POLICY "orgs_insert_auth"            ON organizations     FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "users_own_org_members"       ON org_members       FOR ALL USING (auth.uid() = user_id);

-- ── FKs diferidas ─────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'costs_category_id_fkey') THEN
    ALTER TABLE costs ADD CONSTRAINT costs_category_id_fkey FOREIGN KEY (category_id) REFERENCES cost_categories(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'costs_engine_event_id_fkey') THEN
    ALTER TABLE costs ADD CONSTRAINT costs_engine_event_id_fkey FOREIGN KEY (engine_event_id) REFERENCES engine_events(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'costs_airport_id_fkey') THEN
    ALTER TABLE costs ADD CONSTRAINT costs_airport_id_fkey FOREIGN KEY (airport_id) REFERENCES airports_db(id);
  END IF;
END $$;

-- ── Índices ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_aircraft_user          ON aircraft(user_id);
CREATE INDEX IF NOT EXISTS idx_flights_user           ON flights(user_id);
CREATE INDEX IF NOT EXISTS idx_flights_aircraft       ON flights(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_flights_date           ON flights(date DESC);
CREATE INDEX IF NOT EXISTS idx_flights_mission        ON flights(mission_id);
CREATE INDEX IF NOT EXISTS idx_costs_user             ON costs(user_id);
CREATE INDEX IF NOT EXISTS idx_costs_aircraft         ON costs(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_costs_flight           ON costs(flight_id);
CREATE INDEX IF NOT EXISTS idx_costs_mission          ON costs(mission_id);
CREATE INDEX IF NOT EXISTS idx_costs_recurrence       ON costs(recurrence);
CREATE INDEX IF NOT EXISTS idx_costs_category_id      ON costs(category_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_user       ON maintenance(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_aircraft   ON maintenance(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_missions_user          ON missions(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_flight        ON missions(flight_id);
CREATE INDEX IF NOT EXISTS idx_fuel_prices_user       ON fuel_prices(user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_prices_icao       ON fuel_prices(icao);
CREATE INDEX IF NOT EXISTS idx_oil_logs_aircraft      ON oil_logs(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_user      ON crew_members(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_docs_member       ON crew_documents(crew_member_id);
CREATE INDEX IF NOT EXISTS idx_airports_icao          ON airports(icao);
CREATE INDEX IF NOT EXISTS idx_components_user        ON components(user_id);
CREATE INDEX IF NOT EXISTS idx_components_aircraft    ON components(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_airports_db_icao       ON airports_db(icao);
CREATE INDEX IF NOT EXISTS idx_engine_events_aircraft ON engine_events(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_engine_events_date     ON engine_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_categories_user   ON cost_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user       ON org_members(user_id);

-- ── Triggers ──────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_aircraft_updated    ON aircraft;
DROP TRIGGER IF EXISTS trg_flights_updated     ON flights;
DROP TRIGGER IF EXISTS trg_costs_updated       ON costs;
DROP TRIGGER IF EXISTS trg_maintenance_updated ON maintenance;
DROP TRIGGER IF EXISTS trg_missions_updated    ON missions;
DROP TRIGGER IF EXISTS trg_crew_members_updated ON crew_members;
DROP TRIGGER IF EXISTS trg_crew_docs_updated   ON crew_documents;
DROP TRIGGER IF EXISTS trg_components_updated  ON components;
DROP TRIGGER IF EXISTS trg_airports_db_updated ON airports_db;
DROP TRIGGER IF EXISTS trg_engine_events_updated ON engine_events;
DROP TRIGGER IF EXISTS trg_organizations_updated ON organizations;
DROP TRIGGER IF EXISTS trg_settings_updated    ON user_settings;

CREATE TRIGGER trg_aircraft_updated     BEFORE UPDATE ON aircraft          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_flights_updated      BEFORE UPDATE ON flights            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_costs_updated        BEFORE UPDATE ON costs              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_maintenance_updated  BEFORE UPDATE ON maintenance        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_missions_updated     BEFORE UPDATE ON missions           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_crew_members_updated BEFORE UPDATE ON crew_members       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_crew_docs_updated    BEFORE UPDATE ON crew_documents     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_components_updated   BEFORE UPDATE ON components         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_airports_db_updated  BEFORE UPDATE ON airports_db        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_engine_events_updated BEFORE UPDATE ON engine_events     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_settings_updated     BEFORE UPDATE ON user_settings      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Realtime ──────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['aircraft','flights','costs','maintenance','missions'] LOOP
    BEGIN EXECUTE FORMAT('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- ── Função compute_journey_status ─────────────────────────────

CREATE OR REPLACE FUNCTION compute_journey_status(p_mission_id UUID)
RETURNS TEXT AS $$
DECLARE v_mission missions%ROWTYPE; v_flight_count INT;
BEGIN
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN RETURN 'registered'; END IF;
  IF v_mission.status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  SELECT COUNT(*) INTO v_flight_count FROM flights WHERE mission_id = p_mission_id;
  IF v_flight_count > 0 THEN RETURN 'completed'; END IF;
  RETURN 'planned';
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- FIM — AeroManager v5.27
-- 19 tabelas · 22 políticas RLS · 28 índices · 12 triggers
-- ═══════════════════════════════════════════════════════════════
