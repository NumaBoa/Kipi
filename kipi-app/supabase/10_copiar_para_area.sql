-- ==============================================================================
-- 10 · COPIAR OS DADOS DE PRODUÇÃO PARA UMA ÁREA SEPARADA (schema) NO MESMO BANCO
-- Roda no SQL Editor do projeto do Kipi. Não altera NADA da área "public"
-- (a que o sistema antigo usa): só LÊ dela e grava na área de destino.
--
-- Use para:
--   · HML:    destino = 'hml'               (recria a área hml do zero, com dados atuais)
--   · BACKUP: destino = 'backup_20261101'   (foto completa antes da migração; use a data do dia)
--
-- Troque SÓ a linha "destino" abaixo. Pode rodar de novo: a área de destino é recriada.
-- ==============================================================================

DO $$
DECLARE
  destino  TEXT := 'hml';   -- ← 'hml' ou 'backup_AAAAMMDD'
  tabela   TEXT;
  tabelas  TEXT[] := ARRAY[
    'empresas', 'usuarios', 'perfis', 'categorias', 'insumos', 'produtos', 'revendedoras',
    'clientes', 'pagamentos_comissao', 'receitas', 'vendas', 'venda_itens',
    'remessas_consignacao', 'historico_producao'
  ];
  qtd_origem  BIGINT;
  qtd_destino BIGINT;
BEGIN
  -- Travas: nunca escreve na área do sistema antigo nem em áreas do Supabase
  IF destino IN ('public', 'auth', 'storage', 'extensions', 'realtime', 'graphql', 'graphql_public')
     OR destino !~ '^(hml|backup_[0-9]{8})$' THEN
    RAISE EXCEPTION 'PARADO: destino "%" não permitido. Use hml ou backup_AAAAMMDD.', destino;
  END IF;
  -- Backup é foto: não sobrescreve um backup que já existe
  IF destino LIKE 'backup_%' AND EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = destino) THEN
    RAISE EXCEPTION 'PARADO: o backup "%" já existe. Use outra data.', destino;
  END IF;

  EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', destino);
  EXECUTE format('CREATE SCHEMA %I', destino);

  FOREACH tabela IN ARRAY tabelas LOOP
    IF to_regclass('public.' || tabela) IS NULL THEN
      RAISE NOTICE 'Tabela public.% não existe, pulando.', tabela;
      CONTINUE;
    END IF;
    -- Mesma estrutura (colunas, padrões, regras de valores, índices) e os mesmos dados
    EXECUTE format('CREATE TABLE %I.%I (LIKE public.%I INCLUDING ALL)', destino, tabela, tabela);
    EXECUTE format('INSERT INTO %I.%I SELECT * FROM public.%I', destino, tabela, tabela);

    EXECUTE format('SELECT count(*) FROM public.%I', tabela) INTO qtd_origem;
    EXECUTE format('SELECT count(*) FROM %I.%I', destino, tabela) INTO qtd_destino;
    IF qtd_origem <> qtd_destino THEN
      RAISE EXCEPTION 'PARADO: % copiou % de % linhas.', tabela, qtd_destino, qtd_origem;
    END IF;
    RAISE NOTICE '% → %.%: % linhas', tabela, destino, tabela, qtd_destino;
  END LOOP;

  -- HML: o app novo poderá ler e gravar nesta área (falta expor em Settings → API → Exposed schemas)
  IF destino = 'hml' THEN
    EXECUTE 'GRANT USAGE ON SCHEMA hml TO anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA hml TO anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA hml TO anon, authenticated, service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA hml GRANT ALL ON TABLES TO anon, authenticated, service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA hml GRANT ALL ON SEQUENCES TO anon, authenticated, service_role';
  ELSE
    -- Backup: ninguém de fora acessa
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM anon, authenticated', destino);
  END IF;
END $$;

-- Conferência rápida: linhas por tabela na área copiada
SELECT table_schema AS area, table_name AS tabela,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::int AS linhas
FROM information_schema.tables
WHERE table_schema IN ('public', 'hml') AND table_type = 'BASE TABLE'
ORDER BY table_name, table_schema;
