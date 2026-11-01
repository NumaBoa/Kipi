-- ==============================================================================
-- 03 · CONFERÊNCIA — só leitura. Rodar ANTES e DEPOIS do 01+02 e comparar.
-- Os totais de dinheiro e quantidades NÃO podem mudar com a migração;
-- só mudam as linhas marcadas como "deve mudar".
-- ANTES do 01 rode só A, B, C, E e F (D, G e H usam colunas que o 01 cria).
-- ==============================================================================

-- A. Contagem de linhas por tabela (não pode mudar)
SELECT 'empresas' AS tabela, count(*) FROM public.empresas
UNION ALL SELECT 'clientes', count(*) FROM public.clientes
UNION ALL SELECT 'produtos', count(*) FROM public.produtos
UNION ALL SELECT 'vendas', count(*) FROM public.vendas
UNION ALL SELECT 'venda_itens', count(*) FROM public.venda_itens
UNION ALL SELECT 'revendedoras', count(*) FROM public.revendedoras
UNION ALL SELECT 'pagamentos_comissao', count(*) FROM public.pagamentos_comissao
UNION ALL SELECT 'remessas_consignacao', count(*) FROM public.remessas_consignacao
UNION ALL SELECT 'historico_producao', count(*) FROM public.historico_producao;

-- B. Dinheiro por empresa (não pode mudar)
SELECT empresa_id,
       count(*) AS vendas,
       sum(total) AS faturamento,
       sum(saldo_na_entrega) FILTER (WHERE status = 'pendente') AS a_receber,
       sum(total) FILTER (WHERE canal = 'revendedora') AS faturamento_revenda
FROM public.vendas
WHERE status <> 'cancelado'
GROUP BY empresa_id;

-- C. Itens vendidos (não pode mudar): soma de quantidade × preço tem que bater com o total das vendas
SELECT v.empresa_id,
       sum(i.quantidade) AS unidades,
       round(sum(i.quantidade * i.preco_unitario), 2) AS soma_itens,
       (SELECT round(sum(total), 2) FROM public.vendas x WHERE x.empresa_id = v.empresa_id AND x.status <> 'cancelado') AS soma_vendas
FROM public.venda_itens i JOIN public.vendas v ON v.id = i.venda_id
WHERE v.status <> 'cancelado'
GROUP BY v.empresa_id;

-- D. Revendedora: comissão, acertos e estoque com ela (comissão: depois do 02 = valor do sistema antigo)
SELECT r.nome,
       (SELECT sum(comissao_valor) FROM public.vendas v WHERE v.revendedora_id = r.id) AS comissao_gravada,
       (SELECT sum(valor) FROM public.pagamentos_comissao p WHERE p.revendedora_id = r.id) AS ja_pago,
       (SELECT sum(quantidade) FROM public.remessas_consignacao e WHERE e.revendedora_id = r.id) AS unidades_entregues,
       (SELECT sum(i.quantidade) FROM public.venda_itens i JOIN public.vendas v ON v.id = i.venda_id
         WHERE v.revendedora_id = r.id AND v.canal = 'revendedora' AND v.status <> 'cancelado') AS unidades_vendidas
FROM public.revendedoras r;

-- E. Estoque com a revendedora por produto (entregue − vendido) — comparar com a tela do antigo
SELECT r.nome AS revendedora, e.nome_produto,
       sum(e.quantidade) AS entregue,
       COALESCE((SELECT sum(i.quantidade) FROM public.venda_itens i JOIN public.vendas v ON v.id = i.venda_id
                  WHERE v.revendedora_id = r.id AND v.canal = 'revendedora' AND v.status <> 'cancelado'
                    AND i.produto_id = e.produto_id), 0) AS vendido
FROM public.remessas_consignacao e JOIN public.revendedoras r ON r.id = e.revendedora_id
GROUP BY r.id, r.nome, e.produto_id, e.nome_produto
ORDER BY r.nome, e.nome_produto;

-- F. Estoque da vitrine e do freezer (não pode mudar)
SELECT empresa_id, sum(estoque) AS vitrine, sum(estoque_congelado) AS freezer FROM public.produtos GROUP BY empresa_id;

-- G. O que DEVE mudar com o 02
SELECT
  (SELECT count(*) FROM public.clientes WHERE observacoes ~ '\[TAG:') AS clientes_com_tag_na_observacao,   -- depois: 0
  (SELECT count(*) FROM public.clientes WHERE tag IS NOT NULL) AS clientes_com_tag,                        -- depois: 43
  (SELECT count(*) FROM public.vendas WHERE tipo_pedido = 'pronta_entrega' AND status_producao = 'a_fazer') AS pronta_entrega_na_fila, -- depois: 0
  (SELECT count(*) FROM public.vendas WHERE numero IS NULL) AS vendas_sem_numero,                          -- depois: 0
  (SELECT count(*) FROM public.vendas WHERE comissao_valor IS NULL) AS vendas_sem_comissao_gravada;        -- depois: 0

-- H. Promoção dos produtos: conferir à mão depois do 02
SELECT nome, preco, desconto_promocional, preco_promocional, tem_promocao FROM public.produtos ORDER BY nome;
