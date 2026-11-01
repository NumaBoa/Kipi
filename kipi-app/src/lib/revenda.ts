import { useSyncExternalStore } from 'react';
import { baixarEstoque, devolverEstoque } from '@/lib/estoqueVitrine';
import { ESTABELECIMENTO_EXEMPLO, garantirAcessoRevendedora, registrarDadosDoEstabelecimento } from '@/lib/acesso';


// ============================================================================
// TIPOS DA REDE DE REVENDA
// ============================================================================
export type TipoComissao = 'porcentagem' | 'valor_fixo';
export type FormaPagamento = 'pix' | 'dinheiro' | 'transferencia' | 'cartao';

export interface Revendedora {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  cpf?: string | null;
  tag?: string | null;
  tipoComissao: TipoComissao;
  valorComissao: number; // % (ex: 15) ou R$ por produto (ex: 3.50)
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacoes?: string | null;
  created_at?: string;
}

export interface ItemVendaRevenda {
  produtoId?: string | null;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  comDesconto?: boolean; // vendido na promoção: a comissão deste item é a metade
}

export interface VendaRevenda {
  id: string;
  revendedoraId: string;
  data: string; // ISO
  cliente?: string | null;
  itens: ItemVendaRevenda[];
  total: number;
  status: 'pago' | 'pendente' | 'cancelado';
  // Pedido feito no ateliê para cliente da revendedora: gera comissão,
  // mas o produto saiu da vitrine (não do estoque que está com ela)
  pedidoId?: string | null;
  // Venda que a própria revendedora registrou (vira pedido dela): sai do estoque que está com ela
  doEstoqueDela?: boolean;
}

export interface ItemEntrega {
  produtoId: string;
  nome: string;
  quantidade: number;
}

export interface EntregaRevenda {
  id: string;
  revendedoraId: string;
  data: string; // ISO
  itens: ItemEntrega[];
  observacoes?: string | null;
}

export interface PagamentoRevenda {
  id: string;
  revendedoraId: string;
  valor: number;
  data: string; // ISO
  formaPagamento: FormaPagamento;
  observacoes?: string | null;
}

// Produto pronto no estoque da dona da loja (de onde saem as entregas)
export interface ProdutoEstoqueLoja {
  id: string;
  nome: string;
  emoji: string;
  preco: number;
  estoque: number;
}

export interface ResumoFinanceiro {
  totalVendido: number;
  comissao: number;
  pago: number;
  saldo: number;
  qtdVendas: number;
  qtdItens: number;
  ticketMedio: number;
  produtoMaisVendido: string | null;
}

export const FORMAS_PAGAMENTO: { id: FormaPagamento; label: string; icon: 'zap' | 'dollar-sign' | 'repeat' | 'credit-card' }[] = [
  { id: 'pix', label: 'Pix', icon: 'zap' },
  { id: 'dinheiro', label: 'Dinheiro', icon: 'dollar-sign' },
  { id: 'transferencia', label: 'Transferência', icon: 'repeat' },
  { id: 'cartao', label: 'Cartão', icon: 'credit-card' },
];

// ============================================================================
// FORMATADORES
// ============================================================================
export const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarDataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export const dataHojeBR = () => new Date().toLocaleDateString('pt-BR');

// Máscara DD/MM/AAAA
export const mascaraData = (valor: string) => {
  const limpo = valor.replace(/\D/g, '').slice(0, 8);
  if (limpo.length <= 2) return limpo;
  if (limpo.length <= 4) return `${limpo.slice(0, 2)}/${limpo.slice(2)}`;
  return `${limpo.slice(0, 2)}/${limpo.slice(2, 4)}/${limpo.slice(4)}`;
};

// Converte DD/MM/AAAA em ISO (meio-dia local, para não "voltar um dia" por fuso). Retorna null se inválida.
export const dataBRParaISO = (dataBR: string): string | null => {
  const m = dataBR.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, aaaa] = m;
  const data = new Date(Number(aaaa), Number(mm) - 1, Number(dd), 12, 0, 0);
  if (data.getDate() !== Number(dd) || data.getMonth() !== Number(mm) - 1) return null;
  return data.toISOString();
};

export const descreverComissao = (r: Revendedora) =>
  r.tipoComissao === 'porcentagem'
    ? `${r.valorComissao.toLocaleString('pt-BR')}% sobre a venda`
    : `${formatMoney(r.valorComissao)} por produto`;

export const labelFormaPagamento = (f: FormaPagamento) => FORMAS_PAGAMENTO.find((x) => x.id === f)?.label || f;

// ============================================================================
// CÁLCULOS
// ============================================================================
// Comissão item a item; item vendido na promoção sempre paga metade da comissão
export const comissaoDaVenda = (venda: VendaRevenda, r: Revendedora) => {
  if (venda.status === 'cancelado') return 0;
  return venda.itens.reduce((acc, i) => {
    const fator = i.comDesconto ? 0.5 : 1;
    const comissaoCheia =
      r.tipoComissao === 'porcentagem'
        ? (i.precoUnitario * i.quantidade * r.valorComissao) / 100
        : i.quantidade * r.valorComissao;
    return acc + comissaoCheia * fator;
  }, 0);
};

export const resumoFinanceiro = (
  r: Revendedora,
  vendas: VendaRevenda[],
  pagamentos: PagamentoRevenda[]
): ResumoFinanceiro => {
  const validas = vendas.filter((v) => v.revendedoraId === r.id && v.status !== 'cancelado');
  const totalVendido = validas.reduce((acc, v) => acc + v.total, 0);
  const comissao = validas.reduce((acc, v) => acc + comissaoDaVenda(v, r), 0);
  const pago = pagamentos.filter((p) => p.revendedoraId === r.id).reduce((acc, p) => acc + p.valor, 0);
  const qtdItens = validas.reduce((acc, v) => acc + v.itens.reduce((a, i) => a + i.quantidade, 0), 0);

  const porProduto = new Map<string, number>();
  validas.forEach((v) => v.itens.forEach((i) => porProduto.set(i.nome, (porProduto.get(i.nome) || 0) + i.quantidade)));
  const produtoMaisVendido = [...porProduto.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    totalVendido,
    comissao,
    pago,
    saldo: comissao - pago,
    qtdVendas: validas.length,
    qtdItens,
    ticketMedio: validas.length ? totalVendido / validas.length : 0,
    produtoMaisVendido,
  };
};

// ============================================================================
// REPOSIÇÃO POR SABOR — regra única (Acessos e Visão Geral)
// Saldo até 3 un pede reposição; a sugestão completa até 10 (no mínimo +5).
// ============================================================================
export const MINIMO_POR_SABOR = 3;
export const NIVEL_IDEAL_POR_SABOR = 10;

export type StatusSabor = 'esgotado' | 'baixo' | 'abastecido';

export interface SaborComRevendedora {
  produtoId: string;
  nome: string;
  entregue: number;
  vendido: number;
  saldo: number;
  status: StatusSabor;
  sugestao: number; // un sugeridas para repor (0 = abastecido)
}

const chaveDoSabor = (produtoId: string | null | undefined, nome: string) => produtoId || nome.toLowerCase();

export const saboresComRevendedora = (
  revendedoraId: string,
  todasEntregas: EntregaRevenda[],
  todasVendas: VendaRevenda[]
): SaborComRevendedora[] => {
  const mapa = new Map<string, { produtoId: string; nome: string; entregue: number; vendido: number }>();
  todasEntregas
    .filter((e) => e.revendedoraId === revendedoraId)
    .forEach((e) =>
      e.itens.forEach((i) => {
        const k = chaveDoSabor(i.produtoId, i.nome);
        const atual = mapa.get(k) || { produtoId: i.produtoId, nome: i.nome, entregue: 0, vendido: 0 };
        mapa.set(k, { ...atual, entregue: atual.entregue + i.quantidade });
      })
    );
  todasVendas
    .filter((v) => v.revendedoraId === revendedoraId && v.status !== 'cancelado' && (!v.pedidoId || v.doEstoqueDela))
    .forEach((v) =>
      v.itens.forEach((i) => {
        const k = chaveDoSabor(i.produtoId, i.nome);
        const atual = mapa.get(k) || { produtoId: i.produtoId || '', nome: i.nome, entregue: 0, vendido: 0 };
        mapa.set(k, { ...atual, vendido: atual.vendido + i.quantidade });
      })
    );
  return [...mapa.values()]
    .map((s) => {
      const saldo = Math.max(0, s.entregue - s.vendido);
      const status: StatusSabor = saldo === 0 ? 'esgotado' : saldo <= MINIMO_POR_SABOR ? 'baixo' : 'abastecido';
      const sugestao = status === 'abastecido' ? 0 : Math.max(5, NIVEL_IDEAL_POR_SABOR - saldo);
      return { ...s, saldo, status, sugestao };
    })
    .sort((a, b) => a.saldo - b.saldo);
};

// Todos os sabores que precisam de reposição, de todas as revendedoras
export const alertasDeReposicao = (lista: Revendedora[], todasEntregas: EntregaRevenda[], todasVendas: VendaRevenda[]) =>
  lista.flatMap((r) =>
    saboresComRevendedora(r.id, todasEntregas, todasVendas)
      .filter((s) => s.status !== 'abastecido')
      .map((s) => ({ revendedora: r, sabor: s }))
  );

// ============================================================================
// DADOS INICIAIS (MOCK) — usados enquanto o banco não tem registros
// ============================================================================

// REVENDEDORAS DE EXEMPLO (MOCK)
export const REVENDEDORAS_INICIAIS: Revendedora[] = [
  {
    id: 'rev-1',
    nome: 'Juliana Martins Costa',
    telefone: '(21) 99812-4470',
    email: 'juliana.martins@gmail.com',
    cpf: '529.982.247-25',
    tag: 'Revendedora',
    tipoComissao: 'porcentagem',
    valorComissao: 20,
    cep: '22290-030',
    rua: 'Rua General Severiano',
    numero: '84',
    complemento: 'Apto 302',
    bairro: 'Botafogo',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    observacoes: 'Vende para o condomínio e academia. Retira as caixas às sextas.',
  },
  {
    id: 'rev-2',
    nome: 'Patrícia Nogueira',
    telefone: '(21) 98455-7712',
    email: 'pati.nogueira@hotmail.com',
    cpf: '111.444.777-35',
    tag: 'Consignado',
    tipoComissao: 'valor_fixo',
    valorComissao: 3.5,
    cep: '24220-031',
    rua: 'Rua Moreira César',
    numero: '210',
    complemento: null,
    bairro: 'Icaraí',
    cidade: 'Niterói',
    estado: 'RJ',
    observacoes: 'Trabalha só com cookies. Acerto quinzenal.',
  },
  {
    id: 'rev-3',
    nome: 'Renata Albuquerque',
    telefone: '(21) 97123-0045',
    email: null,
    cpf: null,
    tag: 'Indicação',
    tipoComissao: 'porcentagem',
    valorComissao: 15,
    cep: null,
    rua: null,
    numero: null,
    complemento: null,
    bairro: 'Tijuca',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    observacoes: null,
  },
];

// Mesmos ids e nomes da vitrine (lib/estoqueVitrine)
const COOKIE = { produtoId: 'prod-1', nome: 'Cookie Black Nutella', precoUnitario: 18.9 };
const MACARONS = { produtoId: 'prod-6', nome: 'Caixa Macarons Degustação (6 un)', precoUnitario: 57.0 };
const BENTO = { produtoId: 'prod-4', nome: 'Bento Cake Pistache & Framboesa', precoUnitario: 65.0 };

// Os exemplos foram escritos para outubro (dia 1 a 31); a data acompanha o dia de hoje
// para que o dia 31 seja hoje e os filtros de período funcionem
const dataMock = (dia: number) => {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (31 - dia), 12, 0, 0).toISOString();
};

export const VENDAS_REVENDA_INICIAIS: VendaRevenda[] = [
  { id: 'vr-1', revendedoraId: 'rev-1', data: dataMock(4), cliente: 'Academia Corpo & Mente', itens: [{ ...COOKIE, quantidade: 10 }], total: 189.0, status: 'pago' },
  { id: 'vr-2', revendedoraId: 'rev-1', data: dataMock(11), cliente: 'Condomínio Vila Real (Bl. 2)', itens: [{ ...COOKIE, quantidade: 6 }, { ...MACARONS, quantidade: 2 }], total: 227.4, status: 'pago' },
  { id: 'vr-3', revendedoraId: 'rev-1', data: dataMock(18), cliente: 'Fernanda Souza', itens: [{ ...BENTO, quantidade: 1 }], total: 65.0, status: 'pago' },
  { id: 'vr-4', revendedoraId: 'rev-1', data: dataMock(25), cliente: 'Academia Corpo & Mente', itens: [{ ...COOKIE, quantidade: 12 }], total: 226.8, status: 'pendente' },
  { id: 'vr-5', revendedoraId: 'rev-2', data: dataMock(8), cliente: 'Café Icaraí', itens: [{ ...COOKIE, quantidade: 20 }], total: 378.0, status: 'pago' },
  { id: 'vr-6', revendedoraId: 'rev-2', data: dataMock(22), cliente: 'Café Icaraí', itens: [{ ...COOKIE, precoUnitario: 15.9, quantidade: 15, comDesconto: true }], total: 238.5, status: 'pago' },
];

export const ENTREGAS_REVENDA_INICIAIS: EntregaRevenda[] = [
  { id: 'er-1', revendedoraId: 'rev-1', data: dataMock(2), itens: [{ produtoId: COOKIE.produtoId, nome: COOKIE.nome, quantidade: 30 }, { produtoId: MACARONS.produtoId, nome: MACARONS.nome, quantidade: 4 }], observacoes: 'Primeira remessa do mês' },
  { id: 'er-2', revendedoraId: 'rev-1', data: dataMock(17), itens: [{ produtoId: BENTO.produtoId, nome: BENTO.nome, quantidade: 2 }], observacoes: null },
  { id: 'er-3', revendedoraId: 'rev-2', data: dataMock(6), itens: [{ produtoId: 'prod-1', nome: COOKIE.nome, quantidade: 40 }], observacoes: 'Retirou no ateliê' },
];

export const PAGAMENTOS_REVENDA_INICIAIS: PagamentoRevenda[] = [
  { id: 'pr-1', revendedoraId: 'rev-1', valor: 60.0, data: dataMock(15), formaPagamento: 'pix', observacoes: 'Acerto da 1ª quinzena' },
  { id: 'pr-2', revendedoraId: 'rev-2', valor: 70.0, data: dataMock(16), formaPagamento: 'dinheiro', observacoes: 'Acerto quinzenal' },
];


// ============================================================================
// ESTADO COMPARTILHADO (Acessos, cadastro de clientes e Visão Geral)
// Fase de testes: só dados de exemplo em memória, nada é lido ou gravado no banco.
// ============================================================================
let revendedoras: Revendedora[] = REVENDEDORAS_INICIAIS;
// Toda venda da revendedora é também um pedido dela (mesma tela de Pedidos da dona, filtrada)
let vendas: VendaRevenda[] = VENDAS_REVENDA_INICIAIS.map((v) => (v.pedidoId ? v : { ...v, pedidoId: `ped-${v.id}`, doEstoqueDela: true }));
let entregas: EntregaRevenda[] = ENTREGAS_REVENDA_INICIAIS;
let pagamentos: PagamentoRevenda[] = PAGAMENTOS_REVENDA_INICIAIS;
const ouvintes = new Set<() => void>();
// Foto do estado entregue às telas: objeto novo a cada mudança (seguro com o React Compiler)
let estadoRevenda = { revendedoras, vendas, entregas, pagamentos };
const assinar = (fn: () => void) => {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
};
const notificar = () => {
  estadoRevenda = { revendedoras, vendas, entregas, pagamentos };
  ouvintes.forEach((fn) => fn());
};

export const useRevenda = () => {
  return useSyncExternalStore(assinar, () => estadoRevenda, () => estadoRevenda);
};

// Cada ateliê tem a sua rede de revenda
registrarDadosDoEstabelecimento('revenda', {
  exportar: () => ({ revendedoras, vendas, entregas, pagamentos }),
  importar: (estado) => {
    const e = estado as { revendedoras: Revendedora[]; vendas: VendaRevenda[]; entregas: EntregaRevenda[]; pagamentos: PagamentoRevenda[] } | undefined;
    revendedoras = e?.revendedoras ?? [];
    vendas = e?.vendas ?? [];
    entregas = e?.entregas ?? [];
    pagamentos = e?.pagamentos ?? [];
    notificar();
  },
});

// Revendedoras de exemplo com e-mail já entram com acesso (senha padrão de teste)
REVENDEDORAS_INICIAIS.forEach((r) => garantirAcessoRevendedora(r, ESTABELECIMENTO_EXEMPLO));

// Cadastro novo ou edição (mesmo id); clientes já podem ser vinculados a ela.
// Com e-mail, a revendedora ganha acesso ao sistema (só aos dados dela)
export const salvarRevendedora = (r: Revendedora) => {
  revendedoras = revendedoras.some((x) => x.id === r.id) ? revendedoras.map((x) => (x.id === r.id ? r : x)) : [r, ...revendedoras];
  garantirAcessoRevendedora(r);
  notificar();
};

// Remessa para a revendedora: os produtos saem da vitrine do ateliê
export const registrarEntrega = (entrega: EntregaRevenda) => {
  entregas = [entrega, ...entregas];
  baixarEstoque(entrega.itens.map((i) => ({ produtoId: i.produtoId, nome: i.nome, quantidade: i.quantidade })));
  notificar();
};

// Excluir remessa lançada por engano: os produtos voltam para a vitrine.
// Bloqueia se algum sabor já foi vendido além do que sobraria entregue.
export const excluirEntrega = (entregaId: string): string | null => {
  const entrega = entregas.find((e) => e.id === entregaId);
  if (!entrega) return null;
  const restantes = entregas.filter((e) => e.id !== entregaId);
  const negativo = saboresComRevendedora(entrega.revendedoraId, restantes, vendas).find((s) => s.vendido > s.entregue);
  if (negativo) return `Não dá para excluir: já há vendas de "${negativo.nome}" que dependem desta remessa.`;
  entregas = restantes;
  devolverEstoque(entrega.itens.map((i) => ({ produtoId: i.produtoId, nome: i.nome, quantidade: i.quantidade })));
  notificar();
  return null;
};

// Venda feita pela revendedora com o que está com ela: diminui o saldo por sabor,
// gera comissão e entra nos indicadores (a vitrine já baixou na entrega)
export const registrarVendaRevenda = (dados: Omit<VendaRevenda, 'id' | 'total'>) => {
  const total = dados.itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);
  vendas = [{ ...dados, id: `vr_${Date.now()}`, total }, ...vendas];
  notificar();
};

// Pedido de cliente da revendedora (Novo Pedido): cria, atualiza ou cancela a venda
// ligada a ele para a comissão acompanhar o pedido
export const sincronizarVendaDoPedido = (dados: Omit<VendaRevenda, 'id' | 'total'> & { pedidoId: string }) => {
  const total = dados.itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);
  const existente = vendas.find((v) => v.pedidoId === dados.pedidoId);
  vendas = existente
    ? vendas.map((v) => (v.pedidoId === dados.pedidoId ? { ...v, ...dados, total } : v))
    : [{ ...dados, id: `vr_ped_${dados.pedidoId}`, total }, ...vendas];
  notificar();
};

// Acerto de contas: pagamento da comissão à revendedora
export const registrarPagamento = (dados: Omit<PagamentoRevenda, 'id'>) => {
  pagamentos = [{ ...dados, id: `pag_${Date.now()}` }, ...pagamentos];
  notificar();
};

// Excluir pagamento lançado por engano: o valor volta para o saldo a pagar
export const excluirPagamento = (pagamentoId: string) => {
  pagamentos = pagamentos.filter((p) => p.id !== pagamentoId);
  notificar();
};

// Situação do estoque que está com cada revendedora (Visão Geral); alerta pela regra por sabor
export const situacaoEstoqueRevendedoras = (
  lista: Revendedora[],
  todasEntregas: EntregaRevenda[],
  todasVendas: VendaRevenda[]
) =>
  lista
    .map((r) => {
      const sabores = saboresComRevendedora(r.id, todasEntregas, todasVendas);
      const estoque = sabores.filter((s) => s.saldo > 0).map((s) => ({ nome: s.nome, quantidade: s.saldo }));
      const total = estoque.reduce((acc, e) => acc + e.quantidade, 0);
      const ultima = todasEntregas.filter((e) => e.revendedoraId === r.id).sort((a, b) => b.data.localeCompare(a.data))[0];
      const diasSemReposicao = ultima ? Math.floor((Date.now() - new Date(ultima.data).getTime()) / 86400000) : null;
      const emFalta = sabores.filter((s) => s.status !== 'abastecido');
      const menor = emFalta[0] ? { nome: emFalta[0].nome, quantidade: emFalta[0].saldo } : undefined;
      return { revendedora: r, estoque, sabores, total, diasSemReposicao, menor, saboresEmFalta: emFalta.length, emAlerta: emFalta.length > 0 };
    })
    .sort((a, b) => Number(b.emAlerta) - Number(a.emAlerta) || a.total - b.total);
