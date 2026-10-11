-- ==============================================================================
-- SCRIPT DE BANCO DE DADOS MULTI-TENANT & CONTROLE DE ACESSO (SUPABASE)
-- Execute este script no SQL Editor do Supabase (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. TABELA DE EMPRESAS (TENANTS)
CREATE TABLE IF NOT EXISTS public.empresas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  documento TEXT,
  plano TEXT DEFAULT 'Pro',
  status TEXT DEFAULT 'ativa',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE PERFIS DE USUÁRIOS (VINCULADA AO AUTH E EMPRESAS)
CREATE TABLE IF NOT EXISTS public.perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'operador' CHECK (papel IN ('super_admin', 'admin', 'operador')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pendente', 'bloqueado')),
  empresa_ids TEXT[] DEFAULT '{}',
  empresa_ativa_id TEXT REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  ultimo_acesso TIMESTAMPTZ
);

-- 3. TABELA DE CATEGORIAS
CREATE TABLE IF NOT EXISTS public.categorias (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL
);

-- 4. TABELA DE INSUMOS (ESTOQUE)
CREATE TABLE IF NOT EXISTS public.insumos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingrediente', 'material')),
  unidade TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  minimo NUMERIC NOT NULL DEFAULT 0,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.produtos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  preco NUMERIC NOT NULL DEFAULT 0,
  estoque NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  tempo_preparo_minutos NUMERIC DEFAULT 0,
  valor_hora_trabalho NUMERIC DEFAULT 0,
  rendimento_unidades NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  rua TEXT,
  numero TEXT,
  bairro TEXT,
  complemento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TABELA DE REVENDEDORAS
CREATE TABLE IF NOT EXISTS public.revendedoras (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  tipo_comissao TEXT NOT NULL CHECK (tipo_comissao IN ('porcentagem', 'valor_fixo')),
  comissao_percentual NUMERIC NOT NULL DEFAULT 0,
  comissao_fixa NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  cliente_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TABELA DE PAGAMENTOS DE COMISSÃO
CREATE TABLE IF NOT EXISTS public.pagamentos_comissao (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  revendedora_id TEXT REFERENCES public.revendedoras(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacoes TEXT
);

-- 9. TABELA DE RECEITAS (FICHA TÉCNICA)
CREATE TABLE IF NOT EXISTS public.receitas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id TEXT REFERENCES public.produtos(id) ON DELETE CASCADE,
  insumo_id TEXT REFERENCES public.insumos(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL DEFAULT 0
);

-- 10. TABELA DE VENDAS
CREATE TABLE IF NOT EXISTS public.vendas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id TEXT REFERENCES public.clientes(id) ON DELETE SET NULL,
  canal TEXT NOT NULL DEFAULT 'propria' CHECK (canal IN ('propria', 'revendedora')),
  revendedora_id TEXT REFERENCES public.revendedoras(id) ON DELETE SET NULL,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  pagamento TEXT NOT NULL CHECK (pagamento IN ('pix', 'dinheiro', 'cartao', 'transferencia')),
  status TEXT NOT NULL CHECK (status IN ('pago', 'pendente', 'cancelado')),
  total NUMERIC NOT NULL DEFAULT 0,
  custo_total NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. TABELA DE ITENS DA VENDA
CREATE TABLE IF NOT EXISTS public.venda_itens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  venda_id TEXT REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id TEXT REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome_produto TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL DEFAULT 0
);

-- GARANTIR COLUNA EMPRESA_ID CASO AS TABELAS JÁ EXISTAM
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.revendedoras ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.revendedoras ADD COLUMN IF NOT EXISTS cliente_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.pagamentos_comissao ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.venda_itens ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;

-- HABILITAR RLS PERMISSIVO
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revendedoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_comissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- REMOVER POLÍTICAS ANTIGAS SE EXISTIREM (EVITA ERRO 42710)
DROP POLICY IF EXISTS "Acesso total empresas" ON public.empresas;
DROP POLICY IF EXISTS "Acesso total perfis" ON public.perfis;
DROP POLICY IF EXISTS "Acesso total categorias" ON public.categorias;
DROP POLICY IF EXISTS "Acesso total insumos" ON public.insumos;
DROP POLICY IF EXISTS "Acesso total produtos" ON public.produtos;
DROP POLICY IF EXISTS "Acesso total clientes" ON public.clientes;
DROP POLICY IF EXISTS "Acesso total revendedoras" ON public.revendedoras;
DROP POLICY IF EXISTS "Acesso total pagamentos_comissao" ON public.pagamentos_comissao;
DROP POLICY IF EXISTS "Acesso total receitas" ON public.receitas;
DROP POLICY IF EXISTS "Acesso total vendas" ON public.vendas;
DROP POLICY IF EXISTS "Acesso total venda_itens" ON public.venda_itens;

-- RECRIAR POLÍTICAS DE ACESSO TOTAL PARA O APP
CREATE POLICY "Acesso total empresas" ON public.empresas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total perfis" ON public.perfis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total categorias" ON public.categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total insumos" ON public.insumos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total revendedoras" ON public.revendedoras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total pagamentos_comissao" ON public.pagamentos_comissao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total receitas" ON public.receitas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total vendas" ON public.vendas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total venda_itens" ON public.venda_itens FOR ALL USING (true) WITH CHECK (true);

-- DADOS INICIAIS DA EMPRESA MATRIZ
INSERT INTO public.empresas (id, nome, documento, plano, status) VALUES
  ('emp_matriz', 'Ateliê Gourmet (Matriz)', '12.345.678/0001-90', 'Enterprise', 'ativa')
ON CONFLICT (id) DO NOTHING;
