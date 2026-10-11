-- Script de criação de tabelas e dados iniciais para o Supabase
-- Copie e cole este script no Editor SQL do seu Supabase Dashboard (SQL Editor -> New Query -> Run)

-- 1. Tabela de Categorias
CREATE TABLE IF NOT EXISTS public.categorias (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL
);

-- 2. Tabela de Insumos (Estoque de Ingredientes e Materiais)
CREATE TABLE IF NOT EXISTS public.insumos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingrediente', 'material')),
  unidade TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  minimo NUMERIC NOT NULL DEFAULT 0,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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

-- 4. Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  telefone TEXT,
  rua TEXT,
  numero TEXT,
  bairro TEXT,
  complemento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Revendedoras
CREATE TABLE IF NOT EXISTS public.revendedoras (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  telefone TEXT,
  tipo_comissao TEXT NOT NULL CHECK (tipo_comissao IN ('porcentagem', 'valor_fixo')),
  comissao_percentual NUMERIC NOT NULL DEFAULT 0,
  comissao_fixa NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  cliente_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Tabela de Pagamentos de Comissão
CREATE TABLE IF NOT EXISTS public.pagamentos_comissao (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  revendedora_id TEXT REFERENCES public.revendedoras(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacoes TEXT
);

-- 7. Tabela de Receitas (Ficha Técnica: Insumos por Produto)
CREATE TABLE IF NOT EXISTS public.receitas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  produto_id TEXT REFERENCES public.produtos(id) ON DELETE CASCADE,
  insumo_id TEXT REFERENCES public.insumos(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL DEFAULT 0
);

-- 8. Tabela de Vendas
CREATE TABLE IF NOT EXISTS public.vendas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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

-- 9. Tabela de Itens da Venda
CREATE TABLE IF NOT EXISTS public.venda_itens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  venda_id TEXT REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id TEXT REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome_produto TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL DEFAULT 0
);

-- Habilitar RLS (Row Level Security) permissivo para chave pública anon
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revendedoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_comissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso total para o app (Anon Access Policy)
CREATE POLICY "Acesso total categorias" ON public.categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total insumos" ON public.insumos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total revendedoras" ON public.revendedoras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total pagamentos_comissao" ON public.pagamentos_comissao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total receitas" ON public.receitas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total vendas" ON public.vendas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total venda_itens" ON public.venda_itens FOR ALL USING (true) WITH CHECK (true);

-- DADOS INICIAIS (SEED DATA)
INSERT INTO public.categorias (id, nome) VALUES
  ('cat1', 'bolo'),
  ('cat2', 'cookie'),
  ('cat3', 'artesanato')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.insumos (id, nome, tipo, unidade, quantidade, minimo, custo_unitario) VALUES
  ('i1', 'Farinha de trigo', 'ingrediente', 'kg', 8.5, 3, 6.9),
  ('i2', 'Chocolate 60%', 'ingrediente', 'kg', 1.2, 2, 48),
  ('i3', 'Ovos', 'ingrediente', 'un', 42, 18, 0.92),
  ('i4', 'Açúcar mascavo', 'ingrediente', 'kg', 0, 2, 10.5),
  ('i5', 'Manteiga', 'ingrediente', 'kg', 3.4, 1.5, 39.9),
  ('i6', 'Leite condensado', 'ingrediente', 'un', 9, 6, 7.8),
  ('i7', 'Caixa para bolo', 'material', 'un', 7, 10, 4.2),
  ('i8', 'Saquinho para cookie', 'material', 'un', 64, 30, 0.55),
  ('i9', 'Fita de cetim', 'material', 'm', 18, 10, 1.4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.produtos (id, nome, categoria, preco, estoque, ativo, tempo_preparo_minutos, valor_hora_trabalho, rendimento_unidades) VALUES
  ('p1', 'Bolo de cenoura', 'bolo', 65, 3, true, 45, 25, 1),
  ('p2', 'Bolo Red Velvet', 'bolo', 120, 1, true, 60, 30, 1),
  ('p3', 'Cookie clássico', 'cookie', 9, 24, true, 40, 20, 12),
  ('p4', 'Cookie de chocolate', 'cookie', 11, 18, true, 45, 20, 12),
  ('p5', 'Caixa com 6 cookies', 'cookie', 52, 8, true, 20, 20, 1),
  ('p6', 'Kit presente artesanal', 'artesanato', 78, 5, true, 30, 25, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clientes (id, nome, telefone, rua, numero, bairro, complemento, observacoes) VALUES
  ('c1', 'Mariana Souza', '(11) 98765-4321', 'Rua das Flores', '123', 'Jardim Primavera', 'Apt 42', 'Prefere entregas à tarde'),
  ('c2', 'Carlos Eduardo', '(11) 91234-5678', 'Av. Central', '500', 'Centro', NULL, 'Cliente assíduo de Red Velvet'),
  ('c3', 'Ana Beatris', '(11) 99887-7665', 'Rua dos Sabores', '88', 'Vila Nova', NULL, 'Alergia a amendoim')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.revendedoras (id, nome, telefone, tipo_comissao, comissao_percentual, comissao_fixa, observacoes) VALUES
  ('r1', 'Café & Aconchego', '(11) 94444-5555', 'porcentagem', 15, 0, 'Retiradas todas as terças'),
  ('r2', 'Empório Gourmet', '(11) 93333-2222', 'valor_fixo', 0, 8, 'Comissão fixa por bolo vendido')
ON CONFLICT (id) DO NOTHING;
