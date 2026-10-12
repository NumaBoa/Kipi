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

-- 2. TABELA DE USUÁRIOS (SISTEMA MULTI-TENANT & CONTROLE DE ACESSO GLOBAL)
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

-- 2.1 TABELA DE PERFIS DE USUÁRIOS (COMPATIBILIDADE SUPABASE AUTH)
CREATE TABLE IF NOT EXISTS public.perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'operador' CHECK (papel IN ('super_admin', 'admin', 'operador', 'revendedor')),
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
  tipo TEXT NOT NULL CHECK (tipo IN ('ingrediente', 'material', 'materia_prima', 'embalagem', 'acessorio')),
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
  estoque_congelado NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  disponibilidade TEXT DEFAULT 'hibrido',
  custo_manual NUMERIC,
  tempo_preparo_minutos NUMERIC DEFAULT 0,
  valor_hora_trabalho NUMERIC DEFAULT 0,
  rendimento_unidades NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABELA DE REVENDEDORAS (PONTOS DE VENDA E PARCEIROS)
CREATE TABLE IF NOT EXISTS public.revendedoras (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  usuario_id TEXT,
  tipo_comissao TEXT NOT NULL CHECK (tipo_comissao IN ('porcentagem', 'valor_fixo')),
  comissao_percentual NUMERIC NOT NULL DEFAULT 0,
  comissao_fixa NUMERIC NOT NULL DEFAULT 0,
  categoria_parceria TEXT DEFAULT 'revendedor',
  subtipo_parceria TEXT,
  observacoes TEXT,
  cliente_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TABELA DE CLIENTES
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
  tipo_contato TEXT DEFAULT 'cliente',
  revendedora_id TEXT REFERENCES public.revendedoras(id) ON DELETE SET NULL,
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
  tipo_pedido TEXT DEFAULT 'pronta_entrega',
  data_entrega_prometida TIMESTAMPTZ,
  valor_sinal_pago NUMERIC DEFAULT 0,
  saldo_na_entrega NUMERIC DEFAULT 0,
  status_producao TEXT DEFAULT 'a_fazer',
  tipo_destino_lote TEXT,
  baixar_insumos_lote BOOLEAN,
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

-- 12. TABELA DE REMESSAS DE CONSIGNAÇÃO (ENTREGAS AO REVENDEDOR)
CREATE TABLE IF NOT EXISTS public.remessas_consignacao (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
  revendedora_id TEXT REFERENCES public.revendedoras(id) ON DELETE CASCADE,
  produto_id TEXT REFERENCES public.produtos(id) ON DELETE CASCADE,
  nome_produto TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacoes TEXT,
  baixar_estoque_atelie BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- GARANTIR COLUNAS NOVAS CASO AS TABELAS JÁ EXISTAM NO SUPABASE
-- ==============================================================================

-- Produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS estoque_congelado NUMERIC DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS disponibilidade TEXT DEFAULT 'hibrido';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS custo_manual NUMERIC;

-- Vendas
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS tipo_pedido TEXT DEFAULT 'pronta_entrega';
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS data_entrega_prometida TIMESTAMPTZ;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS valor_sinal_pago NUMERIC DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS saldo_na_entrega NUMERIC DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS status_producao TEXT DEFAULT 'a_fazer';
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS tipo_destino_lote TEXT;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS baixar_insumos_lote BOOLEAN;

-- Clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_contato TEXT DEFAULT 'cliente';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS revendedora_id TEXT REFERENCES public.revendedoras(id) ON DELETE SET NULL;

-- Revendedoras
ALTER TABLE public.revendedoras ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.revendedoras ADD COLUMN IF NOT EXISTS usuario_id TEXT;
ALTER TABLE public.revendedoras ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.revendedoras ADD COLUMN IF NOT EXISTS categoria_parceria TEXT DEFAULT 'revendedor';
ALTER TABLE public.revendedoras ADD COLUMN IF NOT EXISTS subtipo_parceria TEXT;
ALTER TABLE public.revendedoras ADD COLUMN IF NOT EXISTS cliente_ids TEXT[] DEFAULT '{}';

-- Atualizar CHECK constraint em perfis para permitir papel revendedor se existir
ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_papel_check;
ALTER TABLE public.perfis ADD CONSTRAINT perfis_papel_check CHECK (papel IN ('super_admin', 'admin', 'operador', 'revendedor'));

-- ==============================================================================
-- HABILITAR RLS PERMISSIVO PARA TODAS AS TABELAS
-- ==============================================================================
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.remessas_consignacao ENABLE ROW LEVEL SECURITY;

-- REMOVER POLÍTICAS ANTIGAS SE EXISTIREM (EVITA ERRO 42710)
DROP POLICY IF EXISTS "Acesso total empresas" ON public.empresas;
DROP POLICY IF EXISTS "Acesso total usuarios" ON public.usuarios;
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
DROP POLICY IF EXISTS "Acesso total remessas_consignacao" ON public.remessas_consignacao;

-- RECRIAR POLÍTICAS DE ACESSO TOTAL PARA O APP
CREATE POLICY "Acesso total empresas" ON public.empresas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);
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
CREATE POLICY "Acesso total remessas_consignacao" ON public.remessas_consignacao FOR ALL USING (true) WITH CHECK (true);

-- EMPRESA MATRIZ PADRÃO
INSERT INTO public.empresas (id, nome, documento, plano, status) VALUES
  ('emp_matriz', 'Meu Ateliê', '12.345.678/0001-90', 'Enterprise', 'ativa')
ON CONFLICT (id) DO NOTHING;
