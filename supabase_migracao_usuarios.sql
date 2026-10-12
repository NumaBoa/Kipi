-- ==============================================================================
-- MIGRAÇÃO DE USUÁRIOS & ACESSO GLOBAL (KIPI SAAS)
-- Execute este script no SQL Editor do Supabase (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. CRIAR TABELA DE USUÁRIOS (PERSISTÊNCIA MULTI-DISPOSITIVO E NUVEM)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pendente', 'bloqueado')),
  papel TEXT NOT NULL DEFAULT 'operador' CHECK (papel IN ('super_admin', 'admin', 'operador', 'revendedor')),
  empresa_ids TEXT[] DEFAULT '{}',
  empresa_ativa_id TEXT REFERENCES public.empresas(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT now(),
  ultimo_acesso TIMESTAMPTZ
);

-- 2. HABILITAR ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total usuarios" ON public.usuarios;
CREATE POLICY "Acesso total usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);

-- 3. INSERIR OU ATUALIZAR CONTA MASTER (CAMILA LIMA)
INSERT INTO public.usuarios (id, nome, email, senha, status, papel, empresa_ids, empresa_ativa_id)
VALUES (
  'usr_dono',
  'Camila Lima',
  'camila.c.lima08@gmail.com',
  'P&ix1nh0!',
  'ativo',
  'super_admin',
  ARRAY['emp_matriz'],
  'emp_matriz'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  senha = EXCLUDED.senha,
  papel = EXCLUDED.papel,
  status = EXCLUDED.status;

-- 4. INSERIR CONTA DO SEU CLIENTE (JUN DOS SANTOS)
-- Nota: se você usou outra senha ao criar, altere abaixo para a senha desejada:
INSERT INTO public.usuarios (id, nome, email, senha, status, papel, empresa_ids, empresa_ativa_id)
VALUES (
  'usr_cliente_jun',
  'Jun dos Santos',
  'jun.dossantos85@gmail.com',
  '123',
  'ativo',
  'admin',
  ARRAY['emp_matriz'],
  'emp_matriz'
)
ON CONFLICT (email) DO UPDATE SET
  status = 'ativo',
  papel = 'admin';
