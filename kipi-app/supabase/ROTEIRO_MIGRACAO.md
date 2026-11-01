# Roteiro da migração — sem custo, sem instalar nada, sem projeto novo

Tudo acontece **no mesmo projeto do Supabase**, pelo navegador (SQL Editor), usando áreas
separadas dentro do banco (*schemas*):

| Área | O que é | Quem usa |
|---|---|---|
| `public` | Produção de hoje | Sistema antigo (não é tocada até a virada) |
| `hml` | Cópia dos dados para testar as mudanças | App novo, nos testes |
| `backup_AAAAMMDD` | Foto completa antes da migração | Ninguém (só para restaurar) |

---

## Parte 1 — Montar o HML (pode repetir quantas vezes quiser)

1. Supabase → projeto do Kipi → **SQL Editor** → New query.
2. Cole `10_copiar_para_area.sql` (com `destino := 'hml'`) e rode.
   No fim aparece a lista de tabelas com as linhas em `public` e em `hml`: têm que ser iguais.
3. Cole e rode `area_hml/01_migracao_aditiva_hml.sql`.
4. Cole e rode `area_hml/02_conversao_dados_hml.sql`, depois `area_hml/04_unificar_clientes_hml.sql` e `area_hml/05_vincular_acessos_hml.sql`.
5. Conferência:
   - rode os blocos **A, B, C, E e F** do `03_conferencia.sql` (área public, só leitura);
   - rode o `area_hml/03_conferencia_hml.sql` inteiro;
   - A, B, C, E e F têm que dar **os mesmos números** nos dois;
   - bloco G do HML: tudo **0**, exceto `clientes_com_tag` = **43**;
   - bloco H: conferir os descontos dos produtos;
   - bloco D: comissão gravada = a que o sistema antigo mostra hoje.
6. Quando o app novo for ligado ao banco: **Settings → API → Exposed schemas**, adicionar `hml`.

> Para testar de novo com dados atualizados: repita a partir do passo 2 (a área hml é recriada).

---

## Parte 2 — Dia da virada (depois de tudo aprovado no HML)

1. Avise e **pare de usar o sistema antigo**.
2. **Backup:** rode `10_copiar_para_area.sql` com `destino := 'backup_AAAAMMDD'` (data do dia).
   Exporte também os CSVs (Table Editor → Export) e guarde fora do computador de uso diário.
3. Rode os **originais** (área public, sem o `_hml`): `01_migracao_aditiva.sql`, `02_conversao_dados.sql`, `04_unificar_clientes.sql` e `05_vincular_acessos.sql`.
4. Rode o `03_conferencia.sql` inteiro e compare com o que deu no HML.
5. Ligue o app novo na área `public`.
6. A área `hml` pode ser apagada depois: `DROP SCHEMA hml CASCADE;`

**Se algo der errado na virada:** os dados de antes estão na área `backup_AAAAMMDD`
(e nos CSVs). A restauração é feita tabela por tabela a partir dela — me chame antes de executar.

---

## Cuidados

- A área `hml` tem **dados reais**: não compartilhe a chave do projeto.
- Os scripts `_hml` só mexem na área hml; os originais só na public. Confira o nome do arquivo antes de rodar.
- O `10_copiar_para_area.sql` só lê a área public e se recusa a gravar nela.
- O sistema antigo segue normal durante os testes: ele só enxerga a área public.
- Login (Supabase Auth) e regras de acesso por empresa ficam para a etapa seguinte.
