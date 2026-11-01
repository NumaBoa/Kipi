import { useEffect, useState } from 'react';
import { registrarDadosDoEstabelecimento } from '@/lib/acesso';

// ============================================================================
// ESTOQUE DA VITRINE (PRODUTOS PRONTOS) — compartilhado entre as telas
// Toda venda baixa o estoque e todo pedido cancelado devolve.
// O freezer (massas congeladas) fica no fim deste arquivo.
// ============================================================================
export interface ProdutoVitrine {
  id: string;
  nome: string;
  detalhe: string;
  categoria: string;
  preco: number; // R$
  custo: number; // R$ por unidade (ficha técnica ou custo manual)
  estoque: number;
  estoqueMinimo: number;
  desconto?: number; // desconto promocional em R$ por unidade
  ativo?: boolean; // false = inativado: some das vendas, mas pedidos antigos continuam achando o produto
  disponibilidade?: 'pronta_entrega' | 'sob_encomenda' | 'hibrido'; // sem valor = pronta-entrega
}

// Vende sob encomenda (só encomenda ou pronta-entrega + encomenda)
export const aceitaEncomenda = (p: ProdutoVitrine) =>
  p.disponibilidade === 'sob_encomenda' || p.disponibilidade === 'hibrido';

export const produtoAtivo = (p: ProdutoVitrine) => p.ativo !== false;

export interface MovimentoEstoque {
  produtoId?: string | null;
  nome: string;
  quantidade: number;
}

const PRODUTOS_INICIAIS: ProdutoVitrine[] = [
  { id: 'prod-1', nome: 'Cookie Black Nutella', detalhe: 'Chocolate intenso · recheado', categoria: 'Cookies', preco: 18.9, custo: 3.26, estoque: 12, estoqueMinimo: 8, desconto: 3 },
  { id: 'prod-2', nome: 'Cookie Tradicional Gotas Belga', detalhe: 'Baunilha · gotas de chocolate', categoria: 'Cookies', preco: 14.9, custo: 2.4, estoque: 55, estoqueMinimo: 20, desconto: 2 },
  { id: 'prod-3', nome: 'Cookie Duo Red Velvet c/ Ninho', detalhe: 'Dois sabores em um cookie', categoria: 'Cookies', preco: 13.9, custo: 2.8, estoque: 48, estoqueMinimo: 20 },
  { id: 'prod-4', nome: 'Bento Cake Pistache & Framboesa', detalhe: 'Mini bolo decorado', categoria: 'Bolos & Bentos', preco: 65, custo: 31.9, estoque: 8, estoqueMinimo: 5, disponibilidade: 'hibrido' },
  { id: 'prod-5', nome: 'Bento Cake Red Velvet', detalhe: 'Mini bolo decorado', categoria: 'Bolos & Bentos', preco: 70, custo: 30.5, estoque: 4, estoqueMinimo: 5, disponibilidade: 'hibrido' },
  { id: 'prod-6', nome: 'Caixa Macarons Degustação (6 un)', detalhe: 'Sabores sortidos', categoria: 'Macarons', preco: 57, custo: 22, estoque: 16, estoqueMinimo: 10, desconto: 5 },
  { id: 'prod-7', nome: 'Torre de Macarons 24 unidades', detalhe: 'Para festas e eventos', categoria: 'Macarons', preco: 220, custo: 88, estoque: 3, estoqueMinimo: 4, disponibilidade: 'sob_encomenda' },
  { id: 'prod-8', nome: 'Fatia Torta Ópera Café & Ganache', detalhe: 'Fatia individual', categoria: 'Sobremesas', preco: 33.5, custo: 11, estoque: 12, estoqueMinimo: 8 },
  { id: 'prod-9', nome: 'Cento de Brigadeiros Gourmet Belga', detalhe: '100 unidades', categoria: 'Doces Finos', preco: 160, custo: 76.5, estoque: 22, estoqueMinimo: 10, disponibilidade: 'hibrido' },
  { id: 'prod-10', nome: 'Caixinha de Cookie', detalhe: 'Uma seleção para presentear', categoria: 'Presentes', preco: 18, custo: 6.5, estoque: 0, estoqueMinimo: 5, desconto: 3 },
  { id: 'prod-11', nome: 'Croissant Francês Folhado Manteiga', detalhe: 'Folhado na manteiga', categoria: 'Folhados', preco: 16, custo: 5.2, estoque: 6, estoqueMinimo: 6 },
  { id: 'prod-12', nome: 'Pão de Mel Artesanal Recheado', detalhe: 'Recheio de doce de leite', categoria: 'Doces Finos', preco: 12, custo: 3.5, estoque: 12, estoqueMinimo: 8 },
  { id: 'prod-13', nome: 'Torta de Nozes c/ Caramelo Salgado', detalhe: 'Torta inteira', categoria: 'Sobremesas', preco: 140, custo: 0, estoque: 3, estoqueMinimo: 2, disponibilidade: 'sob_encomenda' },
  { id: 'prod-14', nome: 'Café Cold Brew com Baunilha 300ml', detalhe: 'Garrafa 300ml', categoria: 'Bebidas', preco: 14.5, custo: 0, estoque: 18, estoqueMinimo: 6 },
];

// Fase de testes: só dados de exemplo em memória, nada é lido ou gravado no banco
let produtos: ProdutoVitrine[] = PRODUTOS_INICIAIS;
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

const useAssinarEstoque = () => {
  const [, forcarRender] = useState(0);
  useEffect(() => {
    const ouvinte = () => forcarRender((n) => n + 1);
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  }, []);
};

export const useEstoqueVitrine = () => {
  useAssinarEstoque();
  return produtos;
};

export const produtoPorNome = (nome: string) => produtos.find((p) => p.nome.toLowerCase() === nome.toLowerCase());

const localizar = (m: MovimentoEstoque) =>
  produtos.find((p) => (m.produtoId && p.id === m.produtoId) || p.nome.toLowerCase() === m.nome.toLowerCase());

// sinal = -1 baixa (venda), +1 devolve (cancelamento)
const movimentar = (itens: MovimentoEstoque[], sinal: 1 | -1) => {
  produtos = produtos.map((p) => {
    const qtd = itens
      .filter((m) => localizar(m)?.id === p.id)
      .reduce((acc, m) => acc + m.quantidade, 0);
    if (qtd === 0) return p;
    return { ...p, estoque: Math.max(0, p.estoque + sinal * qtd) };
  });
  notificar();
};

export const baixarEstoque = (itens: MovimentoEstoque[]) => movimentar(itens, -1);
export const devolverEstoque = (itens: MovimentoEstoque[]) => movimentar(itens, 1);
// Produção: fornada assada entra na vitrine; perda/descarte sai da vitrine
export const adicionarAoEstoque = (itens: MovimentoEstoque[]) => movimentar(itens, 1);
export const removerDoEstoque = (itens: MovimentoEstoque[]) => movimentar(itens, -1);

// Produto novo (tela Produtos) entra na vitrine com o estoque inicial informado
export const cadastrarProduto = (produto: ProdutoVitrine) => {
  produtos = [produto, ...produtos];
  notificar();
};

export const nomeDoProduto = (produtoId: string) => produtos.find((p) => p.id === produtoId)?.nome ?? produtoId;

export const estoqueDoProduto =(produtoId: string) => produtos.find((p) => p.id === produtoId)?.estoque ?? 0;

// Custo por unidade vindo da ficha técnica: muda sozinho quando um insumo ou a ficha mudam
export const atualizarCustosProdutos = (custos: Record<string, number>) => {
  produtos = produtos.map((p) => (p.id in custos && p.custo !== custos[p.id] ? { ...p, custo: custos[p.id] } : p));
  notificar();
};

// Edição do cadastro (tela Produtos): nome, categoria, preço, mínimo, disponibilidade, promoção
export const atualizarProduto = (produtoId: string, campos: Partial<Omit<ProdutoVitrine, 'id' | 'estoque' | 'custo'>>) => {
  produtos = produtos.map((p) => (p.id === produtoId ? { ...p, ...campos } : p));
  notificar();
};

// Inativar some das vendas, mas mantém histórico de pedidos e indicadores
export const alternarAtivoProduto = (produtoId: string) => {
  produtos = produtos.map((p) => (p.id === produtoId ? { ...p, ativo: !produtoAtivo(p) } : p));
  notificar();
};

// Preço de venda só muda quando a pessoa confirma (ficha técnica → "Aplicar preço")
export const definirPrecoProduto = (produtoId: string, preco: number) => {
  produtos = produtos.map((p) => (p.id === produtoId ? { ...p, preco } : p));
  notificar();
};

// Custo de um item pela ficha técnica do produto (0 quando o produto não tem custo cadastrado)
export const custoUnitarioProduto = (m: MovimentoEstoque) => localizar(m)?.custo ?? 0;

// ============================================================================
// FREEZER (MASSAS CONGELADAS PARA ASSAR) — Produção congela e assa,
// Estoque Central ajusta. Unidades por id do produto.
// ============================================================================
let congelados: Record<string, number> = {
  'prod-1': 36,
  'prod-2': 24,
  'prod-4': 10,
  'prod-11': 18,
  'prod-12': 0,
};

export const useEstoqueFreezer = () => {
  useAssinarEstoque();
  return congelados;
};

const movimentarFreezer = (produtoId: string, delta: number) => {
  congelados = { ...congelados, [produtoId]: Math.max(0, (congelados[produtoId] ?? 0) + delta) };
  notificar();
};

export const congelarNoFreezer = (produtoId: string, quantidade: number) => movimentarFreezer(produtoId, quantidade);
export const retirarDoFreezer = (produtoId: string, quantidade: number) => movimentarFreezer(produtoId, -quantidade);

// Cada ateliê tem a sua vitrine e o seu freezer
registrarDadosDoEstabelecimento('vitrine', {
  exportar: () => ({ produtos, congelados }),
  importar: (estado) => {
    const e = estado as { produtos: ProdutoVitrine[]; congelados: Record<string, number> } | undefined;
    produtos = e?.produtos ?? [];
    congelados = e?.congelados ?? {};
    notificar();
  },
});
