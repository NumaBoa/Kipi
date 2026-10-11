# Meu Ateliê — briefing de reprodução exata para o Claude

## Objetivo
Reproduza esta interface como um sistema interno de gestão para uma pequena produção familiar de bolos, cookies e artesanato. Não é loja virtual. Não implemente backend, autenticação, banco de dados, API ou serviços externos nesta etapa. Use os dados fictícios de `src/lib/dados.ts`, persistidos apenas no `localStorage` do navegador.

## Regra principal
A identidade visual deve ser preservada exatamente. Não substitua a paleta, tipografia, translucidez, formas ou organização por um tema genérico. Use os arquivos fornecidos como fonte de verdade, especialmente `src/styles.css`, `src/components/app/estrutura.tsx` e `src/components/app/painel.tsx`.

## Identidade visual “Vidro Pastel”
- Fundo creme-lilás muito claro no tema claro; ameixa profunda no tema escuro.
- Cor principal violeta equivalente a `#6d6afc`; destaque rosa equivalente a `#ec7aa8`.
- Títulos em **Fraunces**, peso 600; textos e controles em **Inter**.
- Painéis de vidro fosco: transparência, blur de 28px, borda clara sutil e sombra macia.
- Raios generosos: painéis principais `rounded-3xl`, itens internos `rounded-2xl`, etiquetas em formato pílula.
- Três manchas desfocadas animadas ao fundo nas cores violeta, rosa e lavanda. Respeitar `prefers-reduced-motion`.
- Ícones lineares Lucide, pequenos e funcionais. Evitar decoração desnecessária.
- Tema claro/escuro com botão na barra lateral e no cabeçalho móvel; escolha persistida em `localStorage`.
- Interface responsiva: barra lateral no desktop e navegação inferior rolável no celular.
- Toda a interface em português do Brasil e moeda com `Intl.NumberFormat("pt-BR", { currency: "BRL" })`.

## Telas e comportamentos
1. **Painel**: faturamento do dia, últimos 7 dias, valores a receber, estoque pronto, barras semanais, itens para reposição e pedidos recentes.
2. **Vendas**: histórico, lucro, status editável e gaveta lateral para nova venda com busca, carrinho, cliente, pagamento e observações.
3. **Produtos**: tabela de catálogo, preço, custo, margem, estoque e formulário de criação/edição.
4. **Estoque**: indicadores, filtros de ingredientes/materiais, status mínimo, criação/edição e registro de compra.
5. **Receitas**: ficha técnica por produto, consumo de insumos, custo, lucro, margem e sugestão de preço.
6. **Clientes**: cartões com contato, observações, quantidade de compras e total gasto.
7. **Relatórios**: filtros de 7/30/90 dias, indicadores, gráfico de faturamento/lucro, mais vendidos, pagamentos e categorias.

As ações de criar, editar, excluir e registrar venda devem funcionar localmente. Uma venda reduz o estoque pronto e os ingredientes conforme a ficha técnica. Dados devem sobreviver ao recarregamento via `localStorage`. Não crie tela de login.

## Tecnologias usadas
- **React 19 + TypeScript**: construção da interface com tipagem.
- **TanStack Start e TanStack Router**: estrutura da aplicação e navegação por arquivos.
- **TanStack Query**: mesma interface de leitura/mutação que facilitará conectar um backend depois; nesta versão lê e grava somente no navegador.
- **Tailwind CSS 4**: estilos utilitários e tokens semânticos definidos em `src/styles.css`.
- **shadcn/ui + Radix UI**: botões, janelas, seletores, abas e gaveta lateral acessíveis.
- **Lucide React**: ícones.
- **Recharts**: gráficos de relatórios.
- **Sonner**: mensagens de sucesso e erro.
- **Fraunces + Inter**: carregadas pelo Google Fonts no documento raiz.

## Dependências frontend necessárias
`react`, `react-dom`, `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`, `lucide-react`, `recharts`, `sonner`, `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot`, `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-label`.

## Organização dos arquivos
- `src/styles.css`: identidade visual completa e temas.
- `src/components/app/estrutura.tsx`: navegação, fundo, cabeçalho e alternância de tema.
- `src/components/app/painel.tsx`: painéis, indicadores, etiquetas e estados vazios.
- `src/components/ui/*`: controles visuais usados pelas páginas.
- `src/routes/_authenticated/*`: todas as telas. O nome da pasta é apenas herdado da estrutura original; esta versão não possui autenticação.
- `src/lib/dados.ts`: tipos, dados fictícios e operações locais. É o único arquivo que deverá ser trocado no futuro ao conectar um backend.
- `src/lib/format.ts`, `theme.ts`, `utils.ts`: moeda/data, tema e composição de classes.

## Integração no projeto do Claude
Se o projeto criado não usar TanStack Start, adapte somente as declarações `createFileRoute` e os componentes `Link`; não redesenhe os componentes nem altere as classes. Preserve os sete endereços: `/`, `/vendas`, `/produtos`, `/estoque`, `/receitas`, `/clientes`, `/relatorios`. Monte um `QueryClientProvider` e o `Toaster` na raiz. Inclua no `<head>` os links das fontes Fraunces e Inter indicados abaixo:

`https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap`

## O que não deve existir
- Backend, banco, login, cadastro de usuários, chaves ou variáveis secretas.
- SDK de Supabase, Firebase ou outro serviço.
- Checkout, pagamento online ou catálogo público.
- Mudanças na paleta, fontes ou estilo de vidro pastel.
