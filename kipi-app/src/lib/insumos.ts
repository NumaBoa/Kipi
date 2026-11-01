import { useEffect, useState } from 'react';
import type { Pedido } from '@/lib/clientesPedidos';
import { atualizarCustosProdutos, congelarNoFreezer, retirarDoFreezer, adicionarAoEstoque, nomeDoProduto } from '@/lib/estoqueVitrine';
import { registrarProducao } from '@/lib/historicoProducao';
import { registrarDadosDoEstabelecimento } from '@/lib/acesso';

// ============================================================================
// INSUMOS — lista única compartilhada entre as telas
// (Insumos & Receitas, Estoque Central, Produção, ficha técnica de Produtos e
// "O que Comprar" da Visão Geral).
// Fase de testes: só dados de exemplo em memória, nada é lido ou gravado no banco.
// ============================================================================
export type TipoInsumo = 'ingrediente' | 'embalagem' | 'outro';
export type Armazenamento = 'seco' | 'refrigerado' | 'congelado' | 'perecivel' | 'in_natura';

export interface Insumo {
  id: string;
  nome: string;
  tipo: TipoInsumo;
  unidade: string; // unidade em que o estoque é contado (kg, L, un, m, pacote...)
  unidadeFracionada: string; // unidade usada nas receitas (g, ml, un, m)
  fatorFracionado: number; // quantas unidades fracionadas cabem em 1 unidade de estoque (1 kg = 1000 g)
  precoPago: number; // preço da última embalagem comprada
  conteudoEmbalagem: number; // quanto vem na embalagem, na unidade fracionada (ex: 2500 g)
  custoUnitario: number; // R$ por unidade fracionada (custo médio das compras)
  quantidadeEstoque: number; // na unidade de estoque
  estoqueMinimo: number; // na unidade de estoque
  armazenamento: Armazenamento;
  marcaFornecedor?: string;
  status: 'ativo' | 'inativo';
  emoji: string;
  categoria?: string; // ex: Laticínio, Chocolate Nobre
  usadoEm?: string; // embalagens e outros: onde é usado
  receitasOndeUsado?: string[];
  ultimaCompra?: string;
}

export const ROTULO_ARMAZENAMENTO: Record<Armazenamento, string> = {
  seco: 'Seco',
  refrigerado: 'Refrigerado',
  congelado: 'Congelado',
  perecivel: 'Perecível',
  in_natura: 'In Natura',
};

// kg/L viram 1000 g/ml; g, ml, un e m já são a unidade fracionada; pacote, rolo etc. valem o conteúdo da embalagem
export const fatorDaUnidade = (unidade: string, conteudoEmbalagem = 1) => {
  if (unidade === 'kg' || unidade === 'L') return 1000;
  if (['g', 'ml', 'un', 'm'].includes(unidade)) return 1;
  return conteudoEmbalagem > 0 ? conteudoEmbalagem : 1;
};

export const unidadeFracionadaDe = (tipo: TipoInsumo, unidade: string) =>
  unidade === 'L' || unidade === 'ml' ? 'ml' : unidade === 'kg' || unidade === 'g' ? 'g' : unidade === 'm' ? 'm' : tipo === 'ingrediente' ? 'g' : 'un';

// R$ por unidade de estoque (ex: R$/kg)
export const custoPorUnidadeEstoque = (i: Insumo) => i.custoUnitario * i.fatorFracionado;

const insumo = (
  id: string,
  nome: string,
  tipo: TipoInsumo,
  unidade: string,
  unidadeFracionada: string,
  precoPago: number,
  conteudoEmbalagem: number,
  quantidadeEstoque: number,
  estoqueMinimo: number,
  armazenamento: Armazenamento,
  emoji: string,
  extras: Partial<Insumo> = {}
): Insumo => ({
  id,
  nome,
  tipo,
  unidade,
  unidadeFracionada,
  fatorFracionado: fatorDaUnidade(unidade, conteudoEmbalagem),
  precoPago,
  conteudoEmbalagem,
  custoUnitario: precoPago / conteudoEmbalagem,
  quantidadeEstoque,
  estoqueMinimo,
  armazenamento,
  status: 'ativo',
  emoji,
  ...extras,
});

const INSUMOS_INICIAIS: Insumo[] = [
  // --- INGREDIENTES ---
  insumo('ins-1', 'Chocolate Belga Callebaut 54%', 'ingrediente', 'kg', 'g', 189.9, 2500, 4.8, 2, 'seco', '🍫', { categoria: 'Chocolate Nobre', marcaFornecedor: 'Callebaut Barry', receitasOndeUsado: ['Cookie Black Nutella', 'Pão de Mel Artesanal'], ultimaCompra: '14/10/2026' }),
  insumo('ins-2', 'Farinha de Trigo Especial Tipo 1', 'ingrediente', 'kg', 'g', 32.5, 5000, 18, 10, 'seco', '🌾', { categoria: 'Farináceo', marcaFornecedor: 'Anaconda', receitasOndeUsado: ['Cookies', 'Bento Cake', 'Croissant', 'Pão de Mel'], ultimaCompra: '10/10/2026' }),
  insumo('ins-3', 'Manteiga Extra sem Sal 82%', 'ingrediente', 'kg', 'g', 48.9, 1000, 1.2, 2.5, 'refrigerado', '🧈', { categoria: 'Laticínio', marcaFornecedor: 'President', receitasOndeUsado: ['Cookies', 'Croissant'], ultimaCompra: '16/10/2026' }),
  insumo('ins-4', 'Pasta Pura de Pistache Siciliano', 'ingrediente', 'kg', 'g', 145, 1000, 0.45, 0.8, 'refrigerado', '🥜', { categoria: 'Pasta Concentrada', receitasOndeUsado: ['Bento Cake Pistache'], ultimaCompra: '02/10/2026' }),
  insumo('ins-5', 'Leite Condensado Moça Integral', 'ingrediente', 'kg', 'g', 8.9, 395, 9.5, 4.5, 'seco', '🥛', { categoria: 'Laticínio', marcaFornecedor: 'Nestlé', receitasOndeUsado: ['Brigadeiros'] }),
  insumo('ins-6', 'Açúcar Mascavo Premium', 'ingrediente', 'kg', 'g', 9, 1000, 3.5, 2, 'seco', '🍯', { categoria: 'Açúcares', receitasOndeUsado: ['Cookie Black Nutella'] }),
  insumo('ins-7', 'Frutas Vermelhas Frescas (Framboesa & Mirtilo)', 'ingrediente', 'kg', 'g', 68, 1000, 0.3, 0.8, 'in_natura', '🍓', { categoria: 'Fruta Fresca', receitasOndeUsado: ['Bento Cake Pistache'] }),
  insumo('ins-8', 'Creme de Leite Fresco 35%', 'ingrediente', 'L', 'ml', 26.9, 1000, 1.5, 2, 'refrigerado', '🍶', { categoria: 'Laticínio', receitasOndeUsado: ['Bento Cake Pistache'] }),
  insumo('ins-14', 'Polpa de Morango Natural Congelada', 'ingrediente', 'kg', 'g', 28, 1000, 3, 1, 'congelado', '🍓', { categoria: 'Fruta Congelada' }),
  insumo('ins-15', 'Gotas de Chocolate Belga', 'ingrediente', 'kg', 'g', 70, 1000, 2.4, 1, 'seco', '🍫', { categoria: 'Chocolate Nobre', receitasOndeUsado: ['Cookie Tradicional Gotas Belga'] }),
  insumo('ins-16', 'Doce de Leite Cremoso', 'ingrediente', 'kg', 'g', 30, 1000, 2, 1, 'refrigerado', '🍮', { categoria: 'Recheio', receitasOndeUsado: ['Pão de Mel Artesanal'] }),
  insumo('ins-17', 'Farinha de Amêndoa Pura (França)', 'ingrediente', 'kg', 'g', 98, 1000, 1.2, 2, 'seco', '🌰', { categoria: 'Farináceo', receitasOndeUsado: ['Macarons'] }),
  // --- EMBALAGENS ---
  insumo('ins-9', 'Caixa Cookie Kraft c/ Visor (6 un)', 'embalagem', 'un', 'un', 64.9, 50, 120, 30, 'seco', '📦', { usadoEm: 'Caixas de Cookies Degustação' }),
  insumo('ins-10', 'Fita de Cetim Dourada Champagne 15mm', 'embalagem', 'm', 'm', 19.9, 50, 125, 50, 'seco', '🎀', { usadoEm: 'Laços para Presente' }),
  insumo('ins-11', 'Saco Celofane Transparente 15x25cm', 'embalagem', 'un', 'un', 18.5, 100, 350, 100, 'seco', '🛍️', { usadoEm: 'Cookies Individuais de Balcão' }),
  insumo('ins-12', 'Caixa Bentô Cake Biodegradável', 'embalagem', 'un', 'un', 98, 50, 14, 25, 'seco', '🧁', { usadoEm: 'Bentô Cakes e Mini Tortas' }),
  insumo('ins-13', 'Forminhas Quatro Pétalas Douradas N° 4', 'embalagem', 'un', 'un', 75, 1000, 2400, 500, 'seco', '✨', { usadoEm: 'Brigadeiros e Doces Finos' }),
  insumo('ins-18', 'Fita de Cetim Dusty Rose 22mm', 'embalagem', 'm', 'm', 19.9, 50, 50, 200, 'seco', '🎀', { usadoEm: 'Caixas de Casamento' }),
  // --- OUTROS ---
  insumo('ins-19', 'Vela de Aniversário Dourada', 'outro', 'un', 'un', 30, 20, 40, 20, 'seco', '🕯️', { usadoEm: 'Bolos de aniversário' }),
];

// ============================================================================
// FICHA TÉCNICA — uma só por produto, usada por todas as telas: custo e preço
// (Insumos & Receitas e Produtos), preparo de massa (Produção), capacidade de
// fornadas (Estoque Central) e demanda das encomendas (Visão Geral).
// Quantidades por receita (uma fornada), na unidade fracionada do insumo.
// ============================================================================
export interface ItemFicha {
  insumoId: string;
  quantidade: number;
}

export interface CustoExtra {
  id: string;
  descricao: string;
  valor: number; // R$ por receita (gás, energia...)
}

export type ModoLucro = 'porcentagem' | 'reais';

export interface FichaTecnica {
  produtoId: string;
  rendimento: number; // unidades do produto por receita
  tempoPreparoMinutos: number; // mão de obra = tempo × hora trabalhada
  itens: ItemFicha[];
  custosExtras: CustoExtra[];
  modoLucro: ModoLucro;
  lucroDesejado: number; // % sobre o custo ou R$ por unidade
}

export const MARGEM_MINIMA = 40; // abaixo disso a ficha pede atenção

const novaFicha = (
  produtoId: string,
  rendimento: number,
  tempoPreparoMinutos: number,
  itens: [string, number][],
  extras: [string, number][] = [],
  modoLucro: ModoLucro = 'porcentagem',
  lucroDesejado = 200
): FichaTecnica => ({
  produtoId,
  rendimento,
  tempoPreparoMinutos,
  itens: itens.map(([insumoId, quantidade]) => ({ insumoId, quantidade })),
  custosExtras: extras.map(([descricao, valor], idx) => ({ id: `${produtoId}-extra-${idx}`, descricao, valor })),
  modoLucro,
  lucroDesejado,
});

const FICHAS_INICIAIS: FichaTecnica[] = [
  novaFicha('prod-1', 12, 45, [['ins-1', 180], ['ins-2', 336], ['ins-3', 144], ['ins-6', 120], ['ins-11', 12], ['ins-10', 6]], [['Energia do forno', 2.5]]),
  novaFicha('prod-2', 12, 40, [['ins-2', 360], ['ins-3', 168], ['ins-15', 192], ['ins-11', 12]], [['Energia do forno', 2.5]]),
  novaFicha('prod-4', 1, 60, [['ins-2', 120], ['ins-4', 60], ['ins-8', 100], ['ins-7', 80], ['ins-12', 1], ['ins-10', 2]], [['Gás', 4]], 'reais', 30),
  novaFicha('prod-6', 4, 60, [['ins-17', 240], ['ins-9', 4]], [['Energia do forno', 2]]),
  novaFicha('prod-9', 1, 90, [['ins-5', 2370], ['ins-1', 200], ['ins-13', 100]], [['Gás', 3]], 'reais', 60),
  novaFicha('prod-11', 12, 90, [['ins-2', 660], ['ins-3', 420]], [['Energia do forno', 3]]),
  novaFicha('prod-12', 12, 60, [['ins-2', 480], ['ins-16', 360], ['ins-1', 300], ['ins-11', 12]]),
];

// ============================================================================
// ESTADO COMPARTILHADO
// ============================================================================
let insumos: Insumo[] = INSUMOS_INICIAIS;
let fichas: FichaTecnica[] = FICHAS_INICIAIS;
let horaTrabalhada = 20; // R$ por hora, vale para todas as fichas
const ouvintes = new Set<() => void>();
// Toda mudança de insumo, ficha ou hora recalcula o custo dos produtos na vitrine
// Foto entregue a useFichas: objeto novo a cada mudança (seguro com o React Compiler)
let estadoFichas = { fichas, horaTrabalhada };
const notificar = () => {
  estadoFichas = { fichas, horaTrabalhada };
  sincronizarCustos();
  ouvintes.forEach((fn) => fn());
};

const useAssinar = () => {
  const [, forcarRender] = useState(0);
  useEffect(() => {
    const ouvinte = () => forcarRender((n) => n + 1);
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  }, []);
};

export const useInsumos = () => {
  useAssinar();
  return insumos;
};

export const useFichas = () => {
  useAssinar();
  return estadoFichas;
};

export const fichaDoProduto = (produtoId: string) => fichas.find((f) => f.produtoId === produtoId);

export const salvarFicha = (ficha: FichaTecnica) => {
  fichas = fichas.some((f) => f.produtoId === ficha.produtoId)
    ? fichas.map((f) => (f.produtoId === ficha.produtoId ? ficha : f))
    : [...fichas, ficha];
  notificar();
};

export const excluirFicha = (produtoId: string) => {
  fichas = fichas.filter((f) => f.produtoId !== produtoId);
  notificar();
};

export const definirHoraTrabalhada = (valor: number) => {
  horaTrabalhada = Math.max(0, valor);
  notificar();
};

// Custos e preço sugerido da ficha com o custo médio atual de cada insumo
export const calcularFicha = (f: FichaTecnica, lista: Insumo[] = insumos, hora = horaTrabalhada) => {
  const linhas = f.itens.flatMap((it) => {
    const item = lista.find((i) => i.id === it.insumoId);
    return item ? [{ ...it, item, custo: it.quantidade * item.custoUnitario }] : [];
  });
  const ingredientes = linhas.filter((l) => l.item.tipo === 'ingrediente').reduce((acc, l) => acc + l.custo, 0);
  const embalagens = linhas.filter((l) => l.item.tipo !== 'ingrediente').reduce((acc, l) => acc + l.custo, 0);
  const maoDeObra = (f.tempoPreparoMinutos / 60) * hora;
  const extras = f.custosExtras.reduce((acc, c) => acc + c.valor, 0);
  const custoTotal = ingredientes + embalagens + maoDeObra + extras;
  const custoUnitario = custoTotal / Math.max(1, f.rendimento);
  const precoSugerido = f.modoLucro === 'porcentagem' ? custoUnitario * (1 + f.lucroDesejado / 100) : custoUnitario + f.lucroDesejado;
  // Quantas receitas o estoque atual permite; o insumo que acaba primeiro é o gargalo
  const gargalo = linhas
    .filter((l) => l.quantidade > 0)
    .map((l) => ({ nome: l.item.nome, receitas: Math.floor((l.item.quantidadeEstoque * l.item.fatorFracionado) / l.quantidade) }))
    .reduce<{ nome: string; receitas: number } | null>((min, c) => (!min || c.receitas < min.receitas ? c : min), null);
  return {
    linhas,
    ingredientes,
    embalagens,
    maoDeObra,
    extras,
    custoTotal,
    custoUnitario,
    precoSugerido,
    receitasPossiveis: gargalo?.receitas ?? 0,
    gargalo: gargalo?.nome,
  };
};

// Margem real sobre o preço de venda
export const margemReal = (preco: number, custo: number) => (preco > 0 ? ((preco - custo) / preco) * 100 : 0);

// Custo por unidade de cada produto com ficha vai para a vitrine (lucro dos pedidos e indicadores)
function sincronizarCustos() {
  atualizarCustosProdutos(
    Object.fromEntries(fichas.map((f) => [f.produtoId, Number(calcularFicha(f).custoUnitario.toFixed(2))]))
  );
}
sincronizarCustos();

// Quanto de cada insumo vai em 1 unidade do produto
const porUnidade = (produtoId: string) => {
  const f = fichaDoProduto(produtoId);
  return f ? f.itens.map((it) => ({ insumoId: it.insumoId, quantidade: it.quantidade / Math.max(1, f.rendimento) })) : [];
};

// Cadastro novo ou edição (mesmo id)
export const salvarInsumo = (item: Insumo) => {
  insumos = insumos.some((i) => i.id === item.id) ? insumos.map((i) => (i.id === item.id ? item : i)) : [item, ...insumos];
  notificar();
};

export const excluirInsumo = (id: string) => {
  insumos = insumos.filter((i) => i.id !== id);
  notificar();
};

// Compras de insumos (entrada com valor pago): saída de caixa no fluxo da Visão Geral
export interface CompraInsumo {
  id: string;
  insumoId: string;
  nome: string;
  quantidade: number; // na unidade de estoque
  unidade: string;
  valor: number;
  data: string; // ISO
}
let compras: CompraInsumo[] = [];

// Cada ateliê tem os seus insumos, receitas, valor da hora e compras
registrarDadosDoEstabelecimento('insumos', {
  exportar: () => ({ insumos, fichas, horaTrabalhada, compras }),
  importar: (estado) => {
    const e = estado as { insumos: Insumo[]; fichas: FichaTecnica[]; horaTrabalhada: number; compras: CompraInsumo[] } | undefined;
    insumos = e?.insumos ?? [];
    fichas = e?.fichas ?? [];
    horaTrabalhada = e?.horaTrabalhada ?? 20;
    compras = e?.compras ?? [];
    notificar();
  },
});

export const useComprasInsumos = () => {
  useAssinar();
  return compras;
};

// Entrada (+) ou baixa (−) na unidade de estoque. Entrada com valor pago recalcula o custo médio
// e entra no financeiro como compra.
export const ajustarEstoqueInsumo = (id: string, delta: number, valorPago = 0) => {
  const comprado = insumos.find((i) => i.id === id);
  if (comprado && delta > 0 && valorPago > 0) {
    compras = [
      {
        id: `compra-${Date.now()}`,
        insumoId: id,
        nome: comprado.nome,
        quantidade: delta,
        unidade: comprado.unidade,
        valor: valorPago,
        data: new Date().toISOString(),
      },
      ...compras,
    ];
  }
  insumos = insumos.map((i) => {
    if (i.id !== id) return i;
    const novaQtd = Math.max(0, Number((i.quantidadeEstoque + delta).toFixed(3)));
    const custoUnitario =
      delta > 0 && valorPago > 0 && novaQtd > 0
        ? (i.quantidadeEstoque * custoPorUnidadeEstoque(i) + valorPago) / novaQtd / i.fatorFracionado
        : i.custoUnitario;
    return {
      ...i,
      quantidadeEstoque: novaQtd,
      custoUnitario,
      ...(delta > 0 && valorPago > 0 ? { ultimaCompra: new Date().toLocaleDateString('pt-BR') } : {}),
    };
  });
  notificar();
};

// Preparo de massa: desconta os insumos da ficha × unidades preparadas (nunca abaixo de zero)
export const consumirParaProducao = (produtoId: string, unidades: number) => {
  porUnidade(produtoId).forEach((f) => {
    const item = insumos.find((i) => i.id === f.insumoId);
    if (item) ajustarEstoqueInsumo(item.id, -(f.quantidade * unidades) / item.fatorFracionado);
  });
};

// Massa entra no freezer sempre consumindo os insumos da ficha (Produção, Estoque Central e cadastro de Produtos)
// e fica registrada no histórico de produção
export const congelarMassas = (produtoId: string, unidades: number, descontarInsumos = true, origem?: string) => {
  if (unidades <= 0) return;
  congelarNoFreezer(produtoId, unidades);
  if (descontarInsumos) consumirParaProducao(produtoId, unidades);
  const semFicha = !fichaDoProduto(produtoId);
  registrarProducao({
    tipo: 'preparo_massa',
    produtoId,
    produtoNome: nomeDoProduto(produtoId),
    quantidade: unidades,
    detalhes: [
      `${unidades} massas no freezer${origem ? ` (${origem})` : ''}.`,
      !descontarInsumos ? 'Ingredientes não descontados.' : semFicha ? 'Sem ficha: insumos não descontados.' : '',
    ]
      .filter(Boolean)
      .join(' '),
  });
};

// Assar: sai do freezer e entra na vitrine (nunca mais do que há congelado)
export const assarDoFreezer = (produtoId: string, nome: string, unidades: number, congeladoAtual: number) => {
  const qtd = Math.min(unidades, congeladoAtual);
  if (qtd <= 0) return 0;
  retirarDoFreezer(produtoId, qtd);
  adicionarAoEstoque([{ produtoId, nome, quantidade: qtd }]);
  registrarProducao({
    tipo: 'assar_fornada',
    produtoId,
    produtoNome: nome,
    quantidade: qtd,
    detalhes: `${qtd} unidades assadas e adicionadas à vitrine.`,
  });
  return qtd;
};

// Receita do produto com o estoque atual de cada insumo (tudo na unidade fracionada)
export const receitaDoProduto = (produtoId: string, lista: Insumo[] = insumos) =>
  porUnidade(produtoId).flatMap((f) => {
    const item = lista.find((i) => i.id === f.insumoId);
    if (!item) return [];
    return [
      {
        insumoId: item.id,
        nome: item.nome,
        quantidadePorUnidade: f.quantidade,
        unidade: item.unidadeFracionada,
        estoqueAtual: Math.round(item.quantidadeEstoque * item.fatorFracionado),
      },
    ];
  });

// Quantas fornadas (uma receita da ficha) de cada produto o estoque do insumo permite
export const capacidadeDoInsumo = (item: Insumo, nomeProduto: (id: string) => string) =>
  fichas.flatMap((f) => {
    const uso = f.itens.find((it) => it.insumoId === item.id);
    if (!uso || uso.quantidade <= 0) return [];
    const gastoPorFornada = uso.quantidade / item.fatorFracionado; // na unidade de estoque
    return [
      {
        receitaNome: `${nomeProduto(f.produtoId)} (${f.rendimento} un)`,
        gastoPorFornada,
        fornadasPossiveis: Math.floor(item.quantidadeEstoque / gastoPorFornada),
      },
    ];
  });

// Consumo previsto do insumo pelas encomendas em aberto com entrega nos próximos 7 dias (unidade de estoque)
export const demandaDaSemana = (item: Insumo, encomendas: Pedido[]) => {
  const limite = Date.now() + 7 * 86400000;
  return encomendas
    .filter((p) => p.dataEntrega && new Date(p.dataEntrega).getTime() <= limite)
    .flatMap((p) => p.itens)
    .reduce((acc, it) => {
      const uso = it.produtoId ? porUnidade(it.produtoId).find((f) => f.insumoId === item.id) : undefined;
      return acc + (uso ? (uso.quantidade * it.quantidade) / item.fatorFracionado : 0);
    }, 0);
};
