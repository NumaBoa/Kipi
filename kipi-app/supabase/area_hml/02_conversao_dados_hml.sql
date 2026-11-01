-- ⚠ VERSÃO PARA A ÁREA HML (schema hml) — gerada a partir de ../02_conversao_dados.sql trocando 'public.' por 'hml.'.
-- Não toca na área public (sistema antigo). No dia da virada, use o ../02_conversao_dados.sql original.

-- ==============================================================================
-- 02 · CONVERSÃO DOS DADOS EXISTENTES — rodar logo depois do 01, PRIMEIRO EM HML
-- Ajusta o que o sistema antigo gravou de um jeito que o app novo leria errado.
-- Pode rodar mais de uma vez: cada passo só altera o que ainda não foi convertido.
-- Antes de rodar em PRODUÇÃO: backup (pg_dump) e conferência do 03 em HML.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TAG DO CLIENTE: o sistema antigo escondia em observacoes como "[TAG:Noiva] texto"
--    (a coluna tag não existia). Copia para a coluna e limpa a observação.
--    O sistema antigo continua lendo certo: ele usa a coluna tag quando ela existe.
-- ------------------------------------------------------------------------------
UPDATE hml.clientes
SET tag = NULLIF(trim(substring(observacoes FROM '\[TAG:\s*([^\]]+)\]')), '')
WHERE (tag IS NULL OR trim(tag) = '')
  AND observacoes ~ '\[TAG:';

UPDATE hml.clientes
SET observacoes = NULLIF(trim(regexp_replace(observacoes, '\[TAG:[^\]]*\]', '', 'g')), '')
WHERE observacoes ~ '\[TAG:';

-- ------------------------------------------------------------------------------
-- 2. STATUS DE PRODUÇÃO: o antigo gravava 'a_fazer' até em venda pronta-entrega.
--    No app novo 'a_fazer' = fila da cozinha → as vendas antigas apareceriam como
--    encomendas pendentes. Pronta-entrega já saiu da vitrine: vira 'entregue'.
--    (tipo_destino_lote preenchido = ordem de produção do antigo; não mexe)
-- ------------------------------------------------------------------------------
UPDATE hml.vendas
SET status_producao = 'entregue'
WHERE tipo_pedido = 'pronta_entrega'
  AND status_producao = 'a_fazer'
  AND tipo_destino_lote IS NULL;

-- ------------------------------------------------------------------------------
-- 3. PROMOÇÃO DO PRODUTO: uma fonte só (desconto_promocional, em R$ por unidade).
--    Casos encontrados: desconto 0 com preco_promocional preenchido (ex.: 17,90 → 14,90)
--    e valores com dízima (13,8999...). Regra:
--      - desconto 0 + preço promocional válido + tem_promocao → desconto = preço − promocional
--      - arredonda para centavos e recalcula preco_promocional/tem_promocao a partir do desconto
--    ⚠ CONFERIR na tela de Produtos de HML se os descontos resultantes estão corretos.
-- ------------------------------------------------------------------------------
UPDATE hml.produtos
SET desconto_promocional = round(preco - preco_promocional, 2)
WHERE COALESCE(desconto_promocional, 0) = 0
  AND tem_promocao IS TRUE
  AND preco_promocional IS NOT NULL
  AND preco_promocional > 0
  AND preco_promocional < preco;

UPDATE hml.produtos
SET desconto_promocional = round(COALESCE(desconto_promocional, 0), 2),
    preco_promocional = CASE WHEN COALESCE(desconto_promocional, 0) > 0
                             THEN round(preco - desconto_promocional, 2) END,
    tem_promocao = COALESCE(desconto_promocional, 0) > 0;

-- ------------------------------------------------------------------------------
-- 4. NÚMERO DO PEDIDO (#PED-n): numera por ordem de data, do mais antigo ao mais novo.
--    Só roda se houver venda sem número (rodar 01 e 02 em sequência, sem uso no meio).
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM hml.vendas WHERE numero IS NULL) THEN
    WITH ordem AS (
      SELECT id, row_number() OVER (ORDER BY data, created_at, id) AS n
      FROM hml.vendas
    )
    UPDATE hml.vendas v SET numero = ordem.n FROM ordem WHERE ordem.id = v.id;
  END IF;
  PERFORM setval('hml.vendas_numero_seq', GREATEST((SELECT COALESCE(max(numero), 0) FROM hml.vendas), 1));
END $$;

-- ------------------------------------------------------------------------------
-- 5. COMISSÃO GRAVADA NA VENDA: mesma regra do sistema antigo
--    (só canal = 'revendedora'; item com desconto paga metade; cancelada = 0).
--    Usa a taxa ATUAL da revendedora — é o mesmo valor que o antigo mostra hoje.
-- ------------------------------------------------------------------------------
UPDATE hml.vendas v
SET comissao_valor = CASE
    WHEN v.status = 'cancelado' THEN 0
    WHEN r.tipo_comissao = 'valor_fixo' THEN (
      SELECT COALESCE(sum(i.quantidade * CASE WHEN i.com_desconto THEN COALESCE(r.comissao_fixa, 0) / 2
                                              ELSE COALESCE(r.comissao_fixa, 0) END), 0)
      FROM hml.venda_itens i WHERE i.venda_id = v.id)
    ELSE (
      SELECT COALESCE(sum(i.quantidade * i.preco_unitario * CASE WHEN i.com_desconto THEN COALESCE(r.comissao_percentual, 0) / 200
                                                                ELSE COALESCE(r.comissao_percentual, 0) / 100 END), 0)
      FROM hml.venda_itens i WHERE i.venda_id = v.id)
  END
FROM hml.revendedoras r
WHERE v.canal = 'revendedora'
  AND v.revendedora_id = r.id
  AND v.comissao_valor IS NULL;

UPDATE hml.vendas SET comissao_valor = 0 WHERE canal = 'propria' AND comissao_valor IS NULL;

-- ------------------------------------------------------------------------------
-- 6. QUEM VENDEU: venda da revendedora fica com o nome dela
-- ------------------------------------------------------------------------------
UPDATE hml.vendas v
SET vendedor_nome = r.nome, vendedor_cargo = 'Revendedora'
FROM hml.revendedoras r
WHERE v.canal = 'revendedora' AND v.revendedora_id = r.id AND v.vendedor_nome IS NULL;

-- ------------------------------------------------------------------------------
-- 7. DESCONTO DO ITEM: para itens vendidos na promoção, guarda quanto foi descontado
--    (preço cheio atual do produto − preço pago). Motivo fica vazio: o antigo não pedia.
-- ------------------------------------------------------------------------------
UPDATE hml.venda_itens i
SET desconto_unitario = GREATEST(round(p.preco - i.preco_unitario, 2), 0)
FROM hml.produtos p
WHERE i.produto_id = p.id
  AND i.com_desconto IS TRUE
  AND i.desconto_unitario IS NULL;

COMMIT;

-- ==============================================================================
-- NÃO CONVERTIDO AQUI (de propósito):
--  · status de produção 'fazendo'/'pronto_retirada' (antigo) = 'em_producao'/'pronto' (novo),
--    pagamento 'cartao'/'transferencia' e tipos 'bater_massa'/'descarte_perda':
--    o app novo lê os nomes antigos — renomear quebraria o sistema antigo.
--  · e-mail, CPF, aniversário, CEP e cidade dos clientes: nunca chegaram ao banco;
--    só podem vir do localStorage ("meu-atelie-dados-v10") dos aparelhos usados.
--  · custo dos produtos (hoje 0): depende do cadastro das receitas.
--  · empresa_id obrigatório e regras por empresa: junto com a autenticação.
-- ==============================================================================
