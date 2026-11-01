-- ⚠ VERSÃO PARA A ÁREA HML (schema hml) — gerada a partir de ../04_unificar_clientes.sql trocando 'public.' por 'hml.'.
-- Não toca na área public (sistema antigo). No dia da virada, use o ../04_unificar_clientes.sql original.

-- ==============================================================================
-- 04 · UNIFICAR CLIENTES DUPLICADOS — rodar depois do 02. Pode rodar mais de uma vez.
-- Os pedidos do cadastro repetido passam para o cadastro que fica; nenhuma venda se perde.
-- Casos aprovados pela responsável (01/11/2026):
--   · Elis (Bloco 1 AP 1306, mesmo telefone): fica o cadastro de 15/10.
-- Os outros nomes repetidos (Júlia, Larissa, Matheus, Monique, Rita) são pessoas diferentes.
-- ==============================================================================

BEGIN;

CREATE TEMP TABLE unificar (manter TEXT, remover TEXT) ON COMMIT DROP;
INSERT INTO unificar VALUES
  ('5423e94a-2646-4ca7-bda6-71f4eacc9abb', 'cli_1792183784685');   -- Elis

-- Só segue se o cadastro que fica existe (evita apagar o repetido sem ter para onde levar os pedidos)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM unificar u WHERE NOT EXISTS (SELECT 1 FROM hml.clientes c WHERE c.id = u.manter)) THEN
    RAISE EXCEPTION 'PARADO: cadastro que deveria ficar não existe. Nada foi alterado.';
  END IF;
END $$;

-- 1. Pedidos do cadastro repetido passam para o que fica
UPDATE hml.vendas v SET cliente_id = u.manter FROM unificar u WHERE v.cliente_id = u.remover;

-- 2. Lista de clientes da revendedora (usada pelo sistema antigo): troca o id repetido pelo que fica
UPDATE hml.revendedoras r
SET cliente_ids = (
  SELECT array_agg(DISTINCT COALESCE(u.manter, x))
  FROM unnest(r.cliente_ids) AS x LEFT JOIN unificar u ON u.remover = x
)
WHERE r.cliente_ids && (SELECT array_agg(remover) FROM unificar);

-- 3. Apaga o cadastro repetido (já sem pedidos)
DELETE FROM hml.clientes c USING unificar u WHERE c.id = u.remover;

COMMIT;

-- Conferência: cada cliente unificado com todos os pedidos
SELECT c.nome, c.id, count(v.id) AS pedidos, round(sum(v.total), 2) AS total
FROM hml.clientes c LEFT JOIN hml.vendas v ON v.cliente_id = c.id AND v.status <> 'cancelado'
WHERE c.id IN ('5423e94a-2646-4ca7-bda6-71f4eacc9abb', 'cli_1792183784685')
GROUP BY c.nome, c.id;
