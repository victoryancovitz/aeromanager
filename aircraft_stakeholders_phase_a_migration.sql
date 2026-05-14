-- ============================================================
-- Multi-stakeholder Fase A — schema aditivo
-- Data: 2026-05-14
--
-- Princípios:
-- - ADITIVO: novas tabelas, não toca em aircraft_co_owners
-- - RLS dos existentes INTACTOS (cost_inbox, flights, costs, etc.)
-- - RLS dos NOVOS habilitado (segurança por default)
-- - Migra dados de co_owners → stakeholders (cópia, não delete)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. aircraft_stakeholders
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aircraft_stakeholders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aircraft_id   UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  email         TEXT,
  role          TEXT NOT NULL CHECK (role IN (
    'owner','co_owner','manager','pilot','mechanic','cabin_crew','viewer'
  )),
  permissions   JSONB DEFAULT '{}'::jsonb,
  share_pct     NUMERIC,  -- compatibilidade com co_owners (equity stake)
  invited_by    UUID REFERENCES auth.users(id),
  invited_at    TIMESTAMPTZ,
  joined_at     DATE DEFAULT CURRENT_DATE,
  left_at       DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Um usuário não pode ter o mesmo papel ATIVO duas vezes na mesma aeronave
CREATE UNIQUE INDEX IF NOT EXISTS uq_stakeholders_aircraft_user_role_active
  ON public.aircraft_stakeholders(aircraft_id, user_id, role)
  WHERE left_at IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stakeholders_aircraft ON public.aircraft_stakeholders(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_user     ON public.aircraft_stakeholders(user_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_role     ON public.aircraft_stakeholders(role);

COMMENT ON TABLE public.aircraft_stakeholders IS
  'Stakeholders por aeronave com role granular. Substitui aircraft_co_owners (que continua existindo nesta fase). Aditivo.';

-- ─────────────────────────────────────────────────────────────
-- 2. stakeholder_invites (magic-link, uso único)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stakeholder_invites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aircraft_id   UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  display_name  TEXT,
  role          TEXT NOT NULL CHECK (role IN (
    'owner','co_owner','manager','pilot','mechanic','cabin_crew','viewer'
  )),
  token         TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  invited_by    UUID NOT NULL REFERENCES auth.users(id),
  message       TEXT,
  accepted_at   TIMESTAMPTZ,
  accepted_by   UUID REFERENCES auth.users(id),
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_aircraft ON public.stakeholder_invites(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_invites_email    ON public.stakeholder_invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token    ON public.stakeholder_invites(token);

-- ─────────────────────────────────────────────────────────────
-- 3. Migração: aircraft_co_owners → aircraft_stakeholders
--    Cópia idempotente (ON CONFLICT respeita unique index)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.aircraft_stakeholders
  (aircraft_id, user_id, display_name, email, role, share_pct, joined_at, left_at, notes, created_at, updated_at)
SELECT
  c.aircraft_id,
  c.user_id,
  c.display_name,
  c.email,
  CASE
    WHEN COALESCE(c.role,'owner') IN ('owner','co_owner','manager','pilot','mechanic','cabin_crew','viewer')
      THEN c.role
    ELSE 'co_owner'
  END AS role,
  c.share_pct,
  COALESCE(c.joined_at, CURRENT_DATE),
  c.left_at,
  c.notes,
  COALESCE(c.created_at, now()),
  COALESCE(c.updated_at, now())
FROM public.aircraft_co_owners c
WHERE NOT EXISTS (
  SELECT 1 FROM public.aircraft_stakeholders s
  WHERE s.aircraft_id = c.aircraft_id
    AND COALESCE(s.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(c.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND s.role = COALESCE(c.role,'co_owner')
    AND s.left_at IS NULL
);

-- ─────────────────────────────────────────────────────────────
-- 4. Auto-popular dono original de cada aeronave como 'owner'
--    (garante que toda aircraft tem pelo menos um stakeholder owner)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.aircraft_stakeholders
  (aircraft_id, user_id, display_name, role, share_pct, joined_at)
SELECT
  a.id,
  a.user_id,
  COALESCE(
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = a.user_id),
    (SELECT email FROM auth.users WHERE id = a.user_id),
    'Owner'
  ),
  'owner',
  100,
  COALESCE(a.created_at::date, CURRENT_DATE)
FROM public.aircraft a
WHERE a.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.aircraft_stakeholders s
    WHERE s.aircraft_id = a.id
      AND s.user_id = a.user_id
      AND s.role = 'owner'
      AND s.left_at IS NULL
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Trigger updated_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_stakeholders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stakeholders_updated_at ON public.aircraft_stakeholders;
CREATE TRIGGER trg_stakeholders_updated_at
  BEFORE UPDATE ON public.aircraft_stakeholders
  FOR EACH ROW EXECUTE FUNCTION public.update_stakeholders_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 6. RLS — somente para tabelas NOVAS (não toca nas existentes)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.aircraft_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholder_invites   ENABLE ROW LEVEL SECURITY;

-- aircraft_stakeholders: ver meus próprios papéis + stakeholders das aeronaves onde tenho papel + aeronaves que sou dono direto
DROP POLICY IF EXISTS "stakeholders_select" ON public.aircraft_stakeholders;
CREATE POLICY "stakeholders_select" ON public.aircraft_stakeholders
  FOR SELECT USING (
    user_id = auth.uid()
    OR aircraft_id IN (
      SELECT s.aircraft_id FROM public.aircraft_stakeholders s
      WHERE s.user_id = auth.uid() AND s.left_at IS NULL
    )
    OR aircraft_id IN (
      SELECT id FROM public.aircraft WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "stakeholders_insert" ON public.aircraft_stakeholders;
CREATE POLICY "stakeholders_insert" ON public.aircraft_stakeholders
  FOR INSERT WITH CHECK (
    aircraft_id IN (SELECT id FROM public.aircraft WHERE user_id = auth.uid())
    OR aircraft_id IN (
      SELECT s.aircraft_id FROM public.aircraft_stakeholders s
      WHERE s.user_id = auth.uid()
        AND s.role IN ('owner','co_owner','manager')
        AND s.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "stakeholders_update" ON public.aircraft_stakeholders;
CREATE POLICY "stakeholders_update" ON public.aircraft_stakeholders
  FOR UPDATE USING (
    aircraft_id IN (SELECT id FROM public.aircraft WHERE user_id = auth.uid())
    OR aircraft_id IN (
      SELECT s.aircraft_id FROM public.aircraft_stakeholders s
      WHERE s.user_id = auth.uid()
        AND s.role IN ('owner','co_owner','manager')
        AND s.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "stakeholders_delete" ON public.aircraft_stakeholders;
CREATE POLICY "stakeholders_delete" ON public.aircraft_stakeholders
  FOR DELETE USING (
    aircraft_id IN (SELECT id FROM public.aircraft WHERE user_id = auth.uid())
    OR aircraft_id IN (
      SELECT s.aircraft_id FROM public.aircraft_stakeholders s
      WHERE s.user_id = auth.uid()
        AND s.role IN ('owner','co_owner','manager')
        AND s.left_at IS NULL
    )
  );

-- stakeholder_invites
DROP POLICY IF EXISTS "invites_select" ON public.stakeholder_invites;
CREATE POLICY "invites_select" ON public.stakeholder_invites
  FOR SELECT USING (
    invited_by = auth.uid()
    OR aircraft_id IN (SELECT id FROM public.aircraft WHERE user_id = auth.uid())
    OR aircraft_id IN (
      SELECT s.aircraft_id FROM public.aircraft_stakeholders s
      WHERE s.user_id = auth.uid()
        AND s.role IN ('owner','co_owner','manager')
        AND s.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "invites_insert" ON public.stakeholder_invites;
CREATE POLICY "invites_insert" ON public.stakeholder_invites
  FOR INSERT WITH CHECK (
    invited_by = auth.uid() AND (
      aircraft_id IN (SELECT id FROM public.aircraft WHERE user_id = auth.uid())
      OR aircraft_id IN (
        SELECT s.aircraft_id FROM public.aircraft_stakeholders s
        WHERE s.user_id = auth.uid()
          AND s.role IN ('owner','co_owner','manager')
          AND s.left_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "invites_update" ON public.stakeholder_invites;
CREATE POLICY "invites_update" ON public.stakeholder_invites
  FOR UPDATE USING (
    invited_by = auth.uid()
    OR aircraft_id IN (SELECT id FROM public.aircraft WHERE user_id = auth.uid())
    OR aircraft_id IN (
      SELECT s.aircraft_id FROM public.aircraft_stakeholders s
      WHERE s.user_id = auth.uid()
        AND s.role IN ('owner','co_owner','manager')
        AND s.left_at IS NULL
    )
  );

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
