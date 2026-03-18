-- ============================================================
-- AeroManager v5.32 — Livro de créditos entre sócios
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Tabela principal de créditos
CREATE TABLE IF NOT EXISTS credit_ledger (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Aeronave do contexto
  aircraft_id           UUID REFERENCES aircraft(id) ON DELETE CASCADE NOT NULL,

  -- Quem pagou e quem deve (dentro da mesma aeronave)
  creditor_owner_id     UUID REFERENCES aircraft_co_owners(id) ON DELETE SET NULL,
  creditor_name         TEXT NOT NULL,     -- snapshot do nome (não depende do FK)

  debtor_owner_id       UUID REFERENCES aircraft_co_owners(id) ON DELETE SET NULL,
  debtor_name           TEXT NOT NULL,

  -- Origem do crédito
  origin_type           TEXT NOT NULL DEFAULT 'cost_overpayment',
  -- 'cost_overpayment'  = sócio pagou mais do que devia em um custo
  -- 'hour_exchange'     = troca de horas entre aeronaves
  -- 'manual'            = lançamento manual

  origin_cost_id        UUID REFERENCES costs(id) ON DELETE SET NULL,
  origin_description    TEXT,              -- ex: "Inspeção anual 2026 — Victor pagou integral"

  -- Valores
  amount_brl            NUMERIC NOT NULL DEFAULT 0,
  hours_equivalent      NUMERIC,           -- se aplicável (custo/hora * horas)
  currency_type         TEXT DEFAULT 'money',   -- 'money' | 'hours'

  -- Para troca entre aeronaves de contas diferentes (v6.x)
  counterpart_aircraft_id UUID REFERENCES aircraft(id) ON DELETE SET NULL,
  counterpart_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status
  status                TEXT DEFAULT 'open',
  -- 'open'    = aberto, devedor ainda não pagou
  -- 'partial' = parcialmente quitado
  -- 'settled' = totalmente quitado

  amount_settled_brl    NUMERIC DEFAULT 0,   -- quanto já foi pago
  hours_settled         NUMERIC DEFAULT 0,   -- horas já compensadas

  settled_at            TIMESTAMPTZ,
  due_date              DATE,               -- data acordada para quitação (opcional)
  notes                 TEXT,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de movimentos de quitação
CREATE TABLE IF NOT EXISTS credit_settlements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_id       UUID REFERENCES credit_ledger(id) ON DELETE CASCADE NOT NULL,
  aircraft_id     UUID REFERENCES aircraft(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  settlement_type TEXT NOT NULL DEFAULT 'money',
  -- 'money'         = pagamento em dinheiro
  -- 'hours'         = compensação em horas de voo cedidas
  -- 'cost_offset'   = B pagou próximo custo no lugar de A

  amount_brl      NUMERIC DEFAULT 0,
  hours_amount    NUMERIC DEFAULT 0,
  flight_id       UUID REFERENCES flights(id) ON DELETE SET NULL,
  cost_id         UUID REFERENCES costs(id) ON DELETE SET NULL,
  notes           TEXT,
  settled_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_credit_ledger"      ON credit_ledger;
DROP POLICY IF EXISTS "users_own_credit_settlements"  ON credit_settlements;

CREATE POLICY "users_own_credit_ledger" ON credit_ledger
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_credit_settlements" ON credit_settlements
  FOR ALL USING (auth.uid() = user_id);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_credit_aircraft    ON credit_ledger(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_credit_creditor    ON credit_ledger(creditor_owner_id);
CREATE INDEX IF NOT EXISTS idx_credit_debtor      ON credit_ledger(debtor_owner_id);
CREATE INDEX IF NOT EXISTS idx_credit_status      ON credit_ledger(status);
CREATE INDEX IF NOT EXISTS idx_settlement_credit  ON credit_settlements(credit_id);

-- 5. Triggers
DROP TRIGGER IF EXISTS trg_credit_ledger_updated ON credit_ledger;
CREATE TRIGGER trg_credit_ledger_updated
  BEFORE UPDATE ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Função: calcula saldo líquido entre dois sócios
CREATE OR REPLACE FUNCTION net_balance_between_owners(
  p_aircraft_id UUID,
  p_owner_a_id  UUID,
  p_owner_b_id  UUID
)
RETURNS NUMERIC AS $$
DECLARE
  a_credits_b NUMERIC;  -- quanto B deve para A
  b_credits_a NUMERIC;  -- quanto A deve para B
BEGIN
  -- Créditos que A tem sobre B
  SELECT COALESCE(SUM(amount_brl - amount_settled_brl), 0)
  INTO a_credits_b
  FROM credit_ledger
  WHERE aircraft_id = p_aircraft_id
    AND creditor_owner_id = p_owner_a_id
    AND debtor_owner_id   = p_owner_b_id
    AND status != 'settled';

  -- Créditos que B tem sobre A
  SELECT COALESCE(SUM(amount_brl - amount_settled_brl), 0)
  INTO b_credits_a
  FROM credit_ledger
  WHERE aircraft_id = p_aircraft_id
    AND creditor_owner_id = p_owner_b_id
    AND debtor_owner_id   = p_owner_a_id
    AND status != 'settled';

  -- Positivo = A ainda tem crédito sobre B líquido
  RETURN a_credits_b - b_credits_a;
END;
$$ LANGUAGE plpgsql;

-- 7. Popula dados de exemplo — PP-ABC
-- Victor pagou a manutenção anual toda (R$3.800) — gera crédito sobre Carlos e Rafael
-- Victor pagou a inspeção 100h toda (R$2.800) — distribui por horas

DO $$
DECLARE
  v_victor  UUID;
  v_carlos  UUID;
  v_rafael  UUID;
  v_cost_anual UUID;
  v_cost_100h  UUID;
BEGIN
  SELECT id INTO v_victor FROM aircraft_co_owners
    WHERE aircraft_id = 'bbbbbbbb-0002-0002-0002-000000000002'
    AND display_name LIKE 'Victor%';
  SELECT id INTO v_carlos FROM aircraft_co_owners
    WHERE aircraft_id = 'bbbbbbbb-0002-0002-0002-000000000002'
    AND display_name LIKE 'Carlos%';
  SELECT id INTO v_rafael FROM aircraft_co_owners
    WHERE aircraft_id = 'bbbbbbbb-0002-0002-0002-000000000002'
    AND display_name LIKE 'Rafael%';
  SELECT id INTO v_cost_anual FROM costs
    WHERE aircraft_id = 'bbbbbbbb-0002-0002-0002-000000000002'
    AND description LIKE '%anual%' LIMIT 1;
  SELECT id INTO v_cost_100h FROM costs
    WHERE aircraft_id = 'bbbbbbbb-0002-0002-0002-000000000002'
    AND description LIKE '%100h%' LIMIT 1;

  IF v_victor IS NULL OR v_carlos IS NULL OR v_rafael IS NULL THEN
    RAISE NOTICE 'Sócios não encontrados — pule este bloco';
    RETURN;
  END IF;

  -- Crédito 1: Victor pagou inspeção anual R$3.800 (fixo, divide por cota)
  -- Carlos devia 30% = R$1.140, Rafael devia 20% = R$760
  INSERT INTO credit_ledger (user_id, aircraft_id,
    creditor_owner_id, creditor_name,
    debtor_owner_id, debtor_name,
    origin_type, origin_cost_id, origin_description,
    amount_brl, currency_type, status, due_date, notes)
  VALUES
  (
    'af6c2f00-ba8e-4411-a9dc-0be31f4d1ad9',
    'bbbbbbbb-0002-0002-0002-000000000002',
    v_victor, 'Victor Yancovitz',
    v_carlos, 'Carlos Eduardo Mendes',
    'cost_overpayment', v_cost_anual,
    'Victor pagou a inspeção anual integral — Carlos devia 30%',
    1140.00, 'money', 'open',
    CURRENT_DATE + 30,
    'Carlos combinou pagar no início do próximo mês'
  ),
  (
    'af6c2f00-ba8e-4411-a9dc-0be31f4d1ad9',
    'bbbbbbbb-0002-0002-0002-000000000002',
    v_victor, 'Victor Yancovitz',
    v_rafael, 'Rafael Augusto Pinto',
    'cost_overpayment', v_cost_anual,
    'Victor pagou a inspeção anual integral — Rafael devia 20%',
    760.00, 'money', 'partial',
    CURRENT_DATE + 15,
    'Rafael já pagou R$300 em dinheiro — saldo R$460'
  );

  -- Atualiza o parcial do Rafael: já pagou R$300
  UPDATE credit_ledger
    SET amount_settled_brl = 300, status = 'partial'
  WHERE aircraft_id = 'bbbbbbbb-0002-0002-0002-000000000002'
    AND debtor_owner_id = v_rafael
    AND amount_brl = 760;

  -- Crédito 2: Victor pagou inspeção 100h R$2.800 (variável por horas)
  -- Período: Victor 203min, Carlos 135min, Rafael 90min = 428min
  -- Carlos devia: 135/428 * 2800 = R$883  — combinaram compensar em horas
  -- Rafael devia:  90/428 * 2800 = R$588  — vai pagar em dinheiro
  INSERT INTO credit_ledger (user_id, aircraft_id,
    creditor_owner_id, creditor_name,
    debtor_owner_id, debtor_name,
    origin_type, origin_cost_id, origin_description,
    amount_brl, hours_equivalent, currency_type, status, notes)
  VALUES
  (
    'af6c2f00-ba8e-4411-a9dc-0be31f4d1ad9',
    'bbbbbbbb-0002-0002-0002-000000000002',
    v_victor, 'Victor Yancovitz',
    v_carlos, 'Carlos Eduardo Mendes',
    'cost_overpayment', v_cost_100h,
    'Victor pagou inspeção 100h — Carlos devia proporcional 135/428h',
    883.00, 6.3, 'hours',  -- convertido em ~6.3h ao custo/hora da aeronave
    'open',
    'Carlos prefere compensar cedendo horas para Victor voar a PP-ABC'
  ),
  (
    'af6c2f00-ba8e-4411-a9dc-0be31f4d1ad9',
    'bbbbbbbb-0002-0002-0002-000000000002',
    v_victor, 'Victor Yancovitz',
    v_rafael, 'Rafael Augusto Pinto',
    'cost_overpayment', v_cost_100h,
    'Victor pagou inspeção 100h — Rafael devia proporcional 90/428h',
    588.00, NULL, 'money',
    'open',
    'Rafael vai quitar em dinheiro'
  );

END $$;

SELECT
  'credit_ledger criado' as status,
  COUNT(*) as creditos,
  SUM(amount_brl) as total_brl,
  SUM(amount_brl - amount_settled_brl) as total_aberto
FROM credit_ledger
WHERE aircraft_id = 'bbbbbbbb-0002-0002-0002-000000000002';
