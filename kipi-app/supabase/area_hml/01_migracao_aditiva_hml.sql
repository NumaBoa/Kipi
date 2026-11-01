-- ⚠ VERSÃO PARA A ÁREA HML (schema hml) — gerada a partir de ../01_migracao_aditiva.sql trocando 'public.' por 'hml.'.
-- Não toca na área public (sistema antigo). No dia da virada, use o ../01_migracao_aditiva.sql original.

-- ==============================================================================
-- 01 · MIGRAÇÃO ADITIVA — estrutura para o app novo (kipi-app)
-- Rodar PRIMEIRO EM HML. Só acrescenta tabelas/colunas e amplia listas de valores:
-- o sistema antigo continua funcionando com o banco depois deste script.
-- Pode rodar mais de uma vez (IF NOT EXISTS / DROP ... IF EXISTS).
-- NÃO mexe em regras de acesso (RLS) nem em login: isso fica para a etapa de autenticação.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- EMPRESAS: configurações da loja (tela Configurações) e cobrança do Kipi (tela Admin)
-- ------------------------------------------------------------------------------
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS slogan TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS chave_pix TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS comissao_padrao_tipo TEXT DEFAULT 'porcentagem';
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS comissao_padrao_valor NUMERIC DEFAULT 15;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS valor_hora_trabalho NUMERIC DEFAULT 20;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS meta_mensal NUMERIC;
-- Cobrança do Kipi (o campo "plano" antigo fica como está; o app novo usa plano_kipi)
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS plano_kipi TEXT CHECK (plano_kipi IN ('Essencial', 'Profissional', 'Premium'));
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS mensalidade NUMERIC;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS dia_vencimento INT CHECK (dia_vencimento BETWEEN 1 AND 28);
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;
ALTER TABLE hml.empresas ADD COLUMN IF NOT EXISTS responsavel_email TEXT;

CREATE TABLE IF NOT EXISTS hml.mensalidades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT NOT NULL REFERENCES hml.empresas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,                -- AAAA-MM
  valor NUMERIC NOT NULL,
  pago_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, competencia)
);

-- ------------------------------------------------------------------------------
-- CLIENTES: colunas que o script mestre previa mas NUNCA foram criadas em produção
-- (o sistema antigo descartava esses campos em silêncio; a partir daqui passa a gravar)
-- ------------------------------------------------------------------------------
ALTER TABLE hml.clientes ADD COLUMN IF NOT EXISTS tag TEXT;
ALTER TABLE hml.clientes ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE hml.clientes ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;
ALTER TABLE hml.clientes ADD COLUMN IF NOT EXISTS aniversario TEXT;
ALTER TABLE hml.clientes ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE hml.clientes ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE hml.clientes ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE hml.clientes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'));

-- ------------------------------------------------------------------------------
-- REVENDEDORAS e ACERTOS (migração que estava fora do git e não foi aplicada)
-- ------------------------------------------------------------------------------
ALTER TABLE hml.revendedoras ADD COLUMN IF NOT EXISTS tag TEXT;
ALTER TABLE hml.revendedoras ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE hml.revendedoras ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE hml.revendedoras ADD COLUMN IF NOT EXISTS rua TEXT;
ALTER TABLE hml.revendedoras ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE hml.revendedoras ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE hml.revendedoras ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE hml.revendedoras ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE hml.revendedoras ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE hml.pagamentos_comissao ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'pix';

-- ------------------------------------------------------------------------------
-- PRODUTOS
-- ------------------------------------------------------------------------------
ALTER TABLE hml.produtos ADD COLUMN IF NOT EXISTS estoque_minimo NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE hml.produtos ADD COLUMN IF NOT EXISTS detalhe TEXT;
ALTER TABLE hml.produtos ADD COLUMN IF NOT EXISTS emoji TEXT;

-- ------------------------------------------------------------------------------
-- VENDAS (= Pedidos no app novo)
-- ------------------------------------------------------------------------------
-- Número sequencial do pedido (#PED-123). Vendas novas do sistema antigo também recebem número.
CREATE SEQUENCE IF NOT EXISTS hml.vendas_numero_seq;
ALTER TABLE hml.vendas ADD COLUMN IF NOT EXISTS numero BIGINT;
ALTER TABLE hml.vendas ALTER COLUMN numero SET DEFAULT nextval('hml.vendas_numero_seq');
ALTER SEQUENCE hml.vendas_numero_seq OWNED BY hml.vendas.numero;
ALTER TABLE hml.vendas ADD COLUMN IF NOT EXISTS vendedor_nome TEXT;
ALTER TABLE hml.vendas ADD COLUMN IF NOT EXISTS vendedor_cargo TEXT;
-- Comissão gravada no momento da venda (mudar a taxa da revendedora não altera o histórico)
ALTER TABLE hml.vendas ADD COLUMN IF NOT EXISTS comissao_valor NUMERIC;

-- Formas de pagamento: mantém as antigas (cartao, transferencia) e aceita as novas
ALTER TABLE hml.vendas DROP CONSTRAINT IF EXISTS vendas_pagamento_check;
ALTER TABLE hml.vendas ADD CONSTRAINT vendas_pagamento_check
  CHECK (pagamento IN ('pix', 'dinheiro', 'cartao', 'transferencia', 'pendente', 'cartao_credito', 'cartao_debito'));

-- Itens: desconto aplicado, motivo da promoção (interno) e custo na hora da venda
ALTER TABLE hml.venda_itens ADD COLUMN IF NOT EXISTS desconto_unitario NUMERIC;
ALTER TABLE hml.venda_itens ADD COLUMN IF NOT EXISTS motivo_promocao TEXT;
ALTER TABLE hml.venda_itens ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC;

-- ------------------------------------------------------------------------------
-- HISTÓRICO DE PRODUÇÃO: aceita os tipos novos sem invalidar os antigos
-- (bater_massa = preparo_massa · descarte_perda = perda; o app novo lê os dois)
-- ------------------------------------------------------------------------------
ALTER TABLE hml.historico_producao DROP CONSTRAINT IF EXISTS historico_producao_tipo_check;
ALTER TABLE hml.historico_producao ADD CONSTRAINT historico_producao_tipo_check
  CHECK (tipo IN ('bater_massa', 'assar_fornada', 'descarte_perda', 'preparo_massa', 'perda', 'ajuste'));
ALTER TABLE hml.historico_producao ADD COLUMN IF NOT EXISTS motivo TEXT;          -- descarte
ALTER TABLE hml.historico_producao ADD COLUMN IF NOT EXISTS origem TEXT CHECK (origem IN ('vitrine', 'freezer'));
ALTER TABLE hml.historico_producao ADD COLUMN IF NOT EXISTS custo NUMERIC;        -- perda em R$
ALTER TABLE hml.historico_producao ADD COLUMN IF NOT EXISTS responsavel TEXT;

-- ------------------------------------------------------------------------------
-- INSUMOS: campos do cadastro novo (custo fracionado, armazenamento...)
-- ------------------------------------------------------------------------------
ALTER TABLE hml.insumos DROP CONSTRAINT IF EXISTS insumos_tipo_check;
ALTER TABLE hml.insumos ADD CONSTRAINT insumos_tipo_check
  CHECK (tipo IN ('ingrediente', 'material', 'materia_prima', 'embalagem', 'acessorio', 'outro'));
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS unidade_fracionada TEXT;
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS fator_fracionado NUMERIC DEFAULT 1;
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS preco_pago NUMERIC;
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS conteudo_embalagem NUMERIC;
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS armazenamento TEXT;
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS marca_fornecedor TEXT;
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'));
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE hml.insumos ADD COLUMN IF NOT EXISTS usado_em TEXT;

CREATE TABLE IF NOT EXISTS hml.compras_insumos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT NOT NULL REFERENCES hml.empresas(id) ON DELETE CASCADE,
  insumo_id TEXT REFERENCES hml.insumos(id) ON DELETE SET NULL,
  nome_insumo TEXT NOT NULL,
  quantidade NUMERIC NOT NULL,
  unidade TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  data TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- FICHA TÉCNICA: a tabela "receitas" continua sendo as linhas (produto × insumo);
-- o cabeçalho da ficha e os custos extras ficam em tabelas próprias
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hml.fichas_tecnicas (
  produto_id TEXT PRIMARY KEY REFERENCES hml.produtos(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL REFERENCES hml.empresas(id) ON DELETE CASCADE,
  rendimento NUMERIC NOT NULL DEFAULT 1,
  tempo_preparo_minutos NUMERIC NOT NULL DEFAULT 0,
  modo_lucro TEXT NOT NULL DEFAULT 'porcentagem' CHECK (modo_lucro IN ('porcentagem', 'reais')),
  lucro_desejado NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hml.fichas_custos_extras (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT NOT NULL REFERENCES hml.empresas(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL REFERENCES hml.produtos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------------------------
-- RLS das tabelas novas: mesmo padrão permissivo das atuais por enquanto
-- (as regras por empresa entram junto com a autenticação)
-- ------------------------------------------------------------------------------
ALTER TABLE hml.mensalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE hml.compras_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hml.fichas_tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE hml.fichas_custos_extras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total mensalidades" ON hml.mensalidades;
DROP POLICY IF EXISTS "Acesso total compras_insumos" ON hml.compras_insumos;
DROP POLICY IF EXISTS "Acesso total fichas_tecnicas" ON hml.fichas_tecnicas;
DROP POLICY IF EXISTS "Acesso total fichas_custos_extras" ON hml.fichas_custos_extras;
CREATE POLICY "Acesso total mensalidades" ON hml.mensalidades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total compras_insumos" ON hml.compras_insumos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total fichas_tecnicas" ON hml.fichas_tecnicas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total fichas_custos_extras" ON hml.fichas_custos_extras FOR ALL USING (true) WITH CHECK (true);

-- Índices de leitura por empresa
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_data ON hml.vendas (empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON hml.clientes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON hml.produtos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_remessas_revendedora ON hml.remessas_consignacao (revendedora_id, data DESC);

COMMIT;
