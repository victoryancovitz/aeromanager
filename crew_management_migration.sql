-- Crew Management & International Mission Costs
-- Aplicada em 2026-05-11 via Supabase MCP apply_migration "crew_management_and_block_times"

-- ── crew_members: novos campos ──────────────────────────────────────────────
-- Preserva colunas existentes (full_name, role, anac_code, is_self, etc.) e ADD:
ALTER TABLE public.crew_members
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS daily_rate_brl numeric,
  ADD COLUMN IF NOT EXISTS daily_rate_usd numeric,
  ADD COLUMN IF NOT EXISTS per_diem_domestic_brl numeric,
  ADD COLUMN IF NOT EXISTS per_diem_international_usd numeric,
  ADD COLUMN IF NOT EXISTS is_freelance boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Note: campo "CANAC" mapeia para o existente "anac_code" (não criado novo).

-- ── flight_crew: tripulação por voo, com horários de bloco e custos aplicados
CREATE TABLE IF NOT EXISTS public.flight_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  crew_member_id uuid REFERENCES public.crew_members(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_adhoc text,
  role text NOT NULL,
  block_out time,
  takeoff_time time,
  landing_time time,
  block_in time,
  flight_time_minutes integer,
  block_time_minutes integer,
  daily_rate_applied numeric,
  per_diem_applied numeric,
  currency text DEFAULT 'BRL',
  days_count numeric DEFAULT 1,
  total_crew_cost numeric,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flight_crew_flight ON public.flight_crew(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_crew_user ON public.flight_crew(user_id);
CREATE INDEX IF NOT EXISTS idx_flight_crew_member ON public.flight_crew(crew_member_id);

ALTER TABLE public.flight_crew ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flight_crew_owner_all" ON public.flight_crew FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── flights: horários de bloco e FBO destino ────────────────────────────────
ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS block_out_time time,
  ADD COLUMN IF NOT EXISTS block_in_time time,
  ADD COLUMN IF NOT EXISTS block_time_minutes integer,
  ADD COLUMN IF NOT EXISTS destination_fbo text,
  ADD COLUMN IF NOT EXISTS crew_notes text;
