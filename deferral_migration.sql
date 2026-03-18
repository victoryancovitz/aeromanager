-- Migração: adicionar campos de diferimento na tabela maintenance
-- Execute no SQL Editor do Supabase

ALTER TABLE maintenance
  ADD COLUMN IF NOT EXISTS deferred_until_date  date,
  ADD COLUMN IF NOT EXISTS deferred_until_hours numeric,
  ADD COLUMN IF NOT EXISTS deferral_ref         text;

-- Comentários
COMMENT ON COLUMN maintenance.deferred_until_date  IS 'Data até a qual o item está diferido (calcula status como current enquanto válido)';
COMMENT ON COLUMN maintenance.deferred_until_hours IS 'Horas até as quais o item está diferido';
COMMENT ON COLUMN maintenance.deferral_ref         IS 'Referência da aprovação do diferimento (MEL, AME, autorização técnica)';
