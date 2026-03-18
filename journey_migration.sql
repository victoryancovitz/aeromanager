-- v5.26 — Flight Journey: adiciona campos de integração
-- Executar no Supabase SQL Editor

-- 1. Adiciona flight_id na tabela missions (ligação missão ↔ voo principal)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS flight_id UUID REFERENCES flights(id) ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 2. Adiciona mission_id na tabela flights (ligação voo ↔ missão)
ALTER TABLE flights ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id) ON DELETE SET NULL;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS journey_status TEXT DEFAULT 'registered';
-- journey_status: 'planned' | 'registered' | 'in_progress' | 'completed' | 'cancelled'

-- 3. Adiciona mission_id na tabela costs (custo vinculado a missão)
ALTER TABLE costs ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id) ON DELETE SET NULL;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_missions_flight_id ON missions(flight_id);
CREATE INDEX IF NOT EXISTS idx_flights_mission_id ON flights(mission_id);
CREATE INDEX IF NOT EXISTS idx_costs_mission_id ON costs(mission_id);

-- 5. Função para calcular status da jornada automaticamente
CREATE OR REPLACE FUNCTION compute_journey_status(p_mission_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_mission missions%ROWTYPE;
  v_flight_count INT;
BEGIN
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN RETURN 'registered'; END IF;
  IF v_mission.status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  SELECT COUNT(*) INTO v_flight_count FROM flights WHERE mission_id = p_mission_id;
  IF v_flight_count > 0 THEN RETURN 'completed'; END IF;
  RETURN 'planned';
END;
$$ LANGUAGE plpgsql;
