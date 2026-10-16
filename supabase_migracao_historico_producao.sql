-- ==============================================================================
-- TABELA DE HISTÓRICO DE PRODUÇÃO & FORNADAS (SUPABASE)
-- Execute este script no SQL Editor do Supabase (SQL Editor -> New Query -> Run)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.historico_producao (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('bater_massa', 'assar_fornada', 'descarte_perda')),
  produto_id TEXT REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome_produto TEXT NOT NULL,
  quantidade NUMERIC NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS e Permissões
ALTER TABLE public.historico_producao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total historico_producao" ON public.historico_producao;
CREATE POLICY "Acesso total historico_producao" ON public.historico_producao FOR ALL USING (true) WITH CHECK (true);

-- Criar índice para buscas rápidas por data e empresa
CREATE INDEX IF NOT EXISTS idx_historico_producao_empresa_data ON public.historico_producao (empresa_id, created_at DESC);
