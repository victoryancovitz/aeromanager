-- ============================================================
-- AeroManager — Módulo de Tripulação e Documentos
-- Cole no Supabase SQL Editor
-- ============================================================

-- Perfis de tripulantes / passageiros frequentes
create table if not exists crew_members (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  full_name       text not null,
  display_name    text,
  role            text default 'captain',   -- captain | fo | cabin | dispatcher | pax
  nationality     text,
  dob             date,
  anac_code       text,
  is_self         boolean default false,    -- marca o próprio usuário
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Documentos de cada tripulante
create table if not exists crew_documents (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  crew_member_id  uuid references crew_members(id) on delete cascade not null,
  doc_type        text not null,  -- passport | anac_license | medical | type_rating | foreign_validation | other
  doc_number      text,
  issuing_country text,
  issuing_authority text,
  issue_date      date,
  expiry_date     date,
  raw_data        jsonb default '{}',   -- dados extraídos pela IA (habilitações, ratings, etc)
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- RLS
alter table crew_members  enable row level security;
alter table crew_documents enable row level security;

create policy "users_own_crew_members"   on crew_members  for all using (auth.uid() = user_id);
create policy "users_own_crew_documents" on crew_documents for all using (auth.uid() = user_id);

-- Índices
create index if not exists idx_crew_members_user  on crew_members(user_id);
create index if not exists idx_crew_docs_member   on crew_documents(crew_member_id);
create index if not exists idx_crew_docs_expiry   on crew_documents(expiry_date);

-- Triggers
create trigger trg_crew_members_updated  before update on crew_members  for each row execute function update_updated_at();
create trigger trg_crew_documents_updated before update on crew_documents for each row execute function update_updated_at();
