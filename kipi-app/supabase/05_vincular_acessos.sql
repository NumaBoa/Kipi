-- ==============================================================================
-- 05 · LIGAR LOGINS ÀS REVENDEDORAS — rodar depois do 04. Pode rodar mais de uma vez.
-- No app novo, um login ligado a uma revendedora (revendedoras.usuario_id) ganha a área
-- "Revendedora" além da área que já tem — sem precisar de outro login.
-- Casos aprovados (01/11/2026):
--   · Camila Lima (usr_dono, dona do sistema) também é a revendedora "Camila Lima" da Fatiô.
-- ==============================================================================

UPDATE public.revendedoras
SET usuario_id = 'usr_dono'
WHERE id = '337d2524-ffc9-45b0-962b-1e1bf3204160'
  AND (usuario_id IS NULL OR usuario_id = 'usr_dono');

-- Conferência: a revendedora com o login ligado
SELECT r.nome AS revendedora, r.empresa_id, u.nome AS login, u.email
FROM public.revendedoras r LEFT JOIN public.usuarios u ON u.id = r.usuario_id
WHERE r.id = '337d2524-ffc9-45b0-962b-1e1bf3204160';
