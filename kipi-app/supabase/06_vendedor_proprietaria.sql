-- ==============================================================================
-- 06 · QUEM VENDEU nas vendas do próprio ateliê (canal 'propria').
-- O sistema antigo não guardava o vendedor; na Fatiô a única proprietária é a
-- Juliana Carvalho (usr_cliente_jun). Só preenche onde está vazio. Pode rodar de novo.
-- ==============================================================================

UPDATE public.vendas
SET vendedor_nome = 'Juliana Carvalho', vendedor_cargo = 'Proprietária'
WHERE empresa_id = 'emp_fatio' AND canal = 'propria' AND vendedor_nome IS NULL;

-- Conferência: deve listar Juliana Carvalho = 13 e Camila Lima = 82
SELECT vendedor_nome, vendedor_cargo, count(*) FROM public.vendas
WHERE empresa_id = 'emp_fatio' GROUP BY 1, 2 ORDER BY 1;
