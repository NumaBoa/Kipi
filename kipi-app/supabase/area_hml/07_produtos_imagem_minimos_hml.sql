-- =====================================================================
-- PRODUTOS: imagem (ícone ou foto) e estoque mínimo no freezer
-- Área de testes (schema hml). Só acrescenta colunas; não apaga nada.
-- Pode rodar mais de uma vez.
-- =====================================================================
ALTER TABLE hml.produtos ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE hml.produtos ADD COLUMN IF NOT EXISTS foto TEXT;  -- foto pequena (data URI JPEG)
ALTER TABLE hml.produtos ADD COLUMN IF NOT EXISTS estoque_minimo_congelado NUMERIC NOT NULL DEFAULT 0;
