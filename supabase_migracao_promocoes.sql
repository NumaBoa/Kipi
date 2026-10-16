-- ==============================================================================
-- MIGRAÇÃO: ADICIONAR CAMPOS DE VALOR PROMOCIONAL E DESCONTO EM PRODUTOS
-- ==============================================================================

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS tem_promocao BOOLEAN DEFAULT false;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS desconto_promocional NUMERIC DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS preco_promocional NUMERIC;
