import { custoUnitarioProduto } from '@/lib/estoqueVitrine';
import { encomendasEmAberto, type ClienteCompleto, type Pedido } from '@/lib/clientesPedidos';
import { comissaoDaVenda, resumoFinanceiro, type PagamentoRevenda, type Revendedora, type VendaRevenda } from '@/lib/revenda';
import { custoDoDescarte } from '@/lib/descarte';
import type { RegistroProducao } from '@/lib/historicoProducao';

// ============================================================================
// INDICADORES DA VISÃO GERAL — tudo calculado a partir dos pedidos, das vendas
// das revendedoras e da vitrine. Nenhum número é digitado à mão.
// ============================================================================
// Personalizado escolhido na tela vem como "personalizar:AAAA-MM-DD:AAAA-MM-DD" (início e fim, inclusive)
export type PeriodoPainel = 'hoje' | 'semana' | 'mes' | 'personalizar' | `personalizar:${string}`;

const lerDia = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
};
// Intervalo escolhido no "Personalizar" (null = ainda não escolhido: últimos 30 dias)
export const intervaloPersonalizado = (periodo: PeriodoPainel) => {
  if (!periodo.startsWith('personalizar:')) return null;
  const [, de, ate] = periodo.split(':');
  const inicio = lerDia(de);
  const fim = lerDia(ate);
  return inicio && fim && fim >= inicio ? { inicio, fim: new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1) } : null;
};

// Meta de faturamento do mês (exemplo; ainda não existe tela para configurar)
export const META_MENSAL = 6000;

// Contas de fornecedores a pagar (exemplo; ainda não existe tela de contas a pagar)
const diaRelativo = (dias: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias, 12, 0).toISOString();
};
export const CONTAS_A_PAGAR = [
  { id: 'cp-1', descricao: 'Fornecedor Embalagens Kraft & Fitas', detalhe: 'Pagamento via Boleto', valor: 480, vencimento: diaRelativo(1) },
  { id: 'cp-2', descricao: 'Morangos e Frutas Vermelhas Orgânicas', detalhe: 'Fornecedor Sítio da Serra', valor: 180, vencimento: diaRelativo(4) },
  { id: 'cp-3', descricao: 'Aluguel do Ateliê', detalhe: 'Transferência', valor: 1290, vencimento: diaRelativo(12) },
];

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const somarDias = (d: Date, dias: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const nomeDoMes = (mes: number) => MESES[mes];

interface Intervalo {
  inicio: Date;
  fim: Date; // exclusivo
}

// Período atual e o período anterior de mesmo tamanho (para o "+x% vs ...")
export const intervaloDoPeriodo = (periodo: PeriodoPainel, ref = new Date()) => {
  const hoje = inicioDoDia(ref);
  const escolhido = intervaloPersonalizado(periodo);
  if (escolhido) {
    const dias = Math.round((escolhido.fim.getTime() - escolhido.inicio.getTime()) / 86400000);
    return {
      atual: escolhido,
      anterior: { inicio: somarDias(escolhido.inicio, -dias), fim: escolhido.inicio },
      comparacao: `vs ${dias} ${dias === 1 ? 'dia anterior' : 'dias anteriores'}`,
    };
  }
  switch (periodo) {
    case 'hoje':
      return { atual: { inicio: hoje, fim: somarDias(hoje, 1) }, anterior: { inicio: somarDias(hoje, -1), fim: hoje }, comparacao: 'vs ontem' };
    case 'mes': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return {
        atual: { inicio, fim: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1) },
        anterior: { inicio: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), fim: inicio },
        comparacao: 'vs mês anterior',
      };
    }
    case 'personalizar':
      return { atual: { inicio: somarDias(hoje, -29), fim: somarDias(hoje, 1) }, anterior: { inicio: somarDias(hoje, -59), fim: somarDias(hoje, -29) }, comparacao: 'vs 30 dias anteriores' };
    case 'semana':
    default:
      return { atual: { inicio: somarDias(hoje, -6), fim: somarDias(hoje, 1) }, anterior: { inicio: somarDias(hoje, -13), fim: somarDias(hoje, -6) }, comparacao: 'vs 7 dias anteriores' };
  }
};

const dentro = (iso: string, i: Intervalo) => {
  const t = new Date(iso).getTime();
  return t >= i.inicio.getTime() && t < i.fim.getTime();
};

const pedidosValidos = (pedidos: Pedido[], i: Intervalo) => pedidos.filter((p) => !p.deletado && dentro(p.data, i));
// Vendas da revenda que viraram pedido (cliente de revendedora) já entram pelos pedidos:
// contam só para a comissão, não de novo no faturamento
const vendasComComissao = (vendas: VendaRevenda[], i: Intervalo) => vendas.filter((v) => v.status !== 'cancelado' && dentro(v.data, i));
const vendasValidas = (vendas: VendaRevenda[], i: Intervalo) => vendasComComissao(vendas, i).filter((v) => !v.pedidoId);

const custoDoPedido = (p: Pedido) =>
  p.custoTotal ??
  p.itens.reduce((acc, it) => acc + it.quantidade * (it.custoUnitario ?? custoUnitarioProduto({ produtoId: it.produtoId, nome: it.nome, quantidade: 0 })), 0);
const custoDaVendaRevenda = (v: VendaRevenda) =>
  v.itens.reduce((acc, it) => acc + it.quantidade * custoUnitarioProduto({ produtoId: it.produtoId, nome: it.nome, quantidade: 0 }), 0);

const faturamentoDe = (pedidos: Pedido[], vendas: VendaRevenda[]) =>
  pedidos.reduce((acc, p) => acc + p.total, 0) + vendas.reduce((acc, v) => acc + v.total, 0);

// ============================================================================
// KPIs DO PERÍODO
// ============================================================================
export const calcularKpis = (
  periodo: PeriodoPainel,
  pedidos: Pedido[],
  vendasRevenda: VendaRevenda[],
  revendedoras: Revendedora[],
  registrosProducao: RegistroProducao[] = []
) => {
  const { atual, anterior, comparacao } = intervaloDoPeriodo(periodo);
  const doPeriodo = pedidosValidos(pedidos, atual);
  const revendaPeriodo = vendasValidas(vendasRevenda, atual);

  // Pedidos lançados pelas revendedoras entram no canal revenda
  const pedidosRevenda = doPeriodo.filter((p) => p.revendedoraId);
  const diretaNum = doPeriodo.filter((p) => !p.revendedoraId).reduce((acc, p) => acc + p.total, 0);
  const revendaNum = revendaPeriodo.reduce((acc, v) => acc + v.total, 0) + pedidosRevenda.reduce((acc, p) => acc + p.total, 0);
  const faturamentoNum = diretaNum + revendaNum;
  const faturamentoAnterior = faturamentoDe(pedidosValidos(pedidos, anterior), vendasValidas(vendasRevenda, anterior));

  const comissoesRevenda = vendasComComissao(vendasRevenda, atual).reduce((acc, v) => {
    const r = revendedoras.find((x) => x.id === v.revendedoraId);
    return acc + (r ? comissaoDaVenda(v, r) : 0);
  }, 0);
  const custos =
    doPeriodo.reduce((acc, p) => acc + custoDoPedido(p), 0) + revendaPeriodo.reduce((acc, v) => acc + custoDaVendaRevenda(v), 0);
  // Descartes (vencido, doado, quebrado...): custo de material perdido desconta do lucro
  const perdasNum = registrosProducao
    .filter((r) => r.tipo === 'perda' && dentro(r.data, atual))
    .reduce((acc, r) => acc + custoDoDescarte(r), 0);
  const lucroNum = faturamentoNum - custos - comissoesRevenda - perdasNum;

  const pendentes = doPeriodo.filter((p) => p.status === 'pendente');
  const aReceberNum = pendentes.reduce((acc, p) => acc + (p.saldoNaEntrega > 0 ? p.saldoNaEntrega : p.total), 0);
  const qtdVendas = doPeriodo.length + revendaPeriodo.length;

  // Meta proporcional aos dias do período (o mês usa a meta cheia)
  const diasNoPeriodo = Math.round((atual.fim.getTime() - atual.inicio.getTime()) / 86400000);
  const meta = periodo === 'mes' ? META_MENSAL : (META_MENSAL / 30) * diasNoPeriodo;
  const diffPct = faturamentoAnterior > 0 ? Math.round(((faturamentoNum - faturamentoAnterior) / faturamentoAnterior) * 100) : null;

  const encomendasAbertas = encomendasEmAberto(pedidos);
  const encomendasNovas = doPeriodo.filter((p) => p.tipoPedido === 'sob_encomenda').length;
  const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

  return {
    faturamentoNum,
    diretaNum,
    revendaNum,
    lucroNum,
    perdasNum,
    perdas: formatar(perdasNum),
    aReceberNum,
    comissoesRevenda,
    pedidosNum: doPeriodo.length,
    revendaPedidos: revendaPeriodo.length + pedidosRevenda.length,
    diretaPedidos: doPeriodo.length - pedidosRevenda.length,
    faturamento: formatar(faturamentoNum),
    faturamentoDiff: diffPct === null ? 'Sem vendas no período anterior' : `${diffPct >= 0 ? '+' : ''}${diffPct}% ${comparacao}`,
    lucroLiquido: formatar(lucroNum),
    margem: `${faturamentoNum > 0 ? Math.round((lucroNum / faturamentoNum) * 100) : 0}% margem`,
    ticketMedio: formatar(qtdVendas > 0 ? faturamentoNum / qtdVendas : 0),
    pedidosQtd: plural(doPeriodo.length, 'pedido', 'pedidos'),
    aReceber: formatar(aReceberNum),
    pendentes: plural(pendentes.length, 'pendente', 'pendentes'),
    encomendasAtivas: plural(encomendasAbertas.length, 'pedido', 'pedidos'),
    encomendasNovas: `+${encomendasNovas} ${encomendasNovas === 1 ? 'nova' : 'novas'}`,
    metaPct: Math.round((faturamentoNum / meta) * 100),
    revendaTotal: formatar(revendaNum),
    revendaQtd: `${[...revendaPeriodo, ...pedidosRevenda].reduce((acc, v) => acc + v.itens.reduce((a, i) => a + i.quantidade, 0), 0)} un. vendidas`,
  };
};

const formatar = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ============================================================================
// GRÁFICO: faturamento por faixa do período (pedidos + revenda)
// ============================================================================
export const dadosDoGrafico = (periodo: PeriodoPainel, pedidos: Pedido[], vendasRevenda: VendaRevenda[]) => {
  const hoje = inicioDoDia(new Date());
  let faixas: { label: string; inicio: Date; fim: Date; atual?: boolean }[] = [];

  if (periodo === 'hoje') {
    faixas = [8, 10, 12, 14, 16, 18].map((h, idx, lista) => ({
      label: `${String(h).padStart(2, '0')}h`,
      inicio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), idx === 0 ? 0 : h),
      fim: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), idx === lista.length - 1 ? 24 : h + 2),
      atual: new Date().getHours() >= h && new Date().getHours() < h + 2,
    }));
  } else if (periodo === 'semana') {
    faixas = Array.from({ length: 7 }, (_, i) => {
      const dia = somarDias(hoje, i - 6);
      return { label: DIAS_SEMANA[dia.getDay()], inicio: dia, fim: somarDias(dia, 1), atual: i === 6 };
    });
  } else if (periodo === 'mes') {
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    for (let s = 0; somarDias(primeiro, s * 7) < proximoMes; s++) {
      const inicio = somarDias(primeiro, s * 7);
      const fim = somarDias(inicio, 7) < proximoMes ? somarDias(inicio, 7) : proximoMes;
      faixas.push({ label: `Sem ${s + 1}`, inicio, fim, atual: hoje >= inicio && hoje < fim });
    }
  } else if (intervaloPersonalizado(periodo)) {
    // Intervalo escolhido: até 6 barras de dias iguais
    const { inicio, fim } = intervaloPersonalizado(periodo)!;
    const dias = Math.round((fim.getTime() - inicio.getTime()) / 86400000);
    const tamanho = Math.max(1, Math.ceil(dias / 6));
    for (let ini = inicio; ini < fim; ini = somarDias(ini, tamanho)) {
      const fimFaixa = somarDias(ini, tamanho) < fim ? somarDias(ini, tamanho) : fim;
      faixas.push({
        label: `${String(ini.getDate()).padStart(2, '0')}/${String(ini.getMonth() + 1).padStart(2, '0')}`,
        inicio: ini,
        fim: fimFaixa,
        atual: hoje >= ini && hoje < fimFaixa,
      });
    }
  } else {
    // Últimos 30 dias em 5 blocos de 6 dias
    faixas = Array.from({ length: 5 }, (_, i) => {
      const inicio = somarDias(hoje, -29 + i * 6);
      return { label: `${String(inicio.getDate()).padStart(2, '0')}/${String(inicio.getMonth() + 1).padStart(2, '0')}`, inicio, fim: somarDias(inicio, 6), atual: i === 4 };
    });
  }

  const valores = faixas.map((f) => faturamentoDe(pedidosValidos(pedidos, f), vendasValidas(vendasRevenda, f)));
  const maior = Math.max(...valores, 0);
  return faixas.map((f, i) => ({
    label: f.label,
    valor: valores[i],
    pct: maior > 0 ? Math.round((valores[i] / maior) * 100) : 0,
    pico: maior > 0 && valores[i] === maior,
    atual: !!f.atual,
  }));
};

// ============================================================================
// FUNIL DE ENCOMENDAS (a fazer → em produção → prontas)
// ============================================================================
export const funilDeEncomendas = (pedidos: Pedido[]) => {
  const abertas = encomendasEmAberto(pedidos);
  return (['a_fazer', 'em_producao', 'pronto'] as const).map((status) => {
    const lista = abertas.filter((p) => p.statusProducao === status);
    return { status, quantidade: lista.length, total: lista.reduce((acc, p) => acc + p.total, 0), primeira: lista[0] ?? null };
  });
};

// ============================================================================
// FLUXO DE CAIXA
// ============================================================================
export const fluxoDeCaixa = (
  periodo: PeriodoPainel,
  pedidos: Pedido[],
  revendedoras: Revendedora[],
  vendasRevenda: VendaRevenda[],
  pagamentosRevenda: PagamentoRevenda[],
  comprasInsumos: { valor: number; data: string }[] = []
) => {
  const { atual } = intervaloDoPeriodo(periodo);
  const hoje = { inicio: inicioDoDia(new Date()), fim: somarDias(inicioDoDia(new Date()), 1) };
  const ativos = pedidos.filter((p) => !p.deletado);
  // Compras de insumos já pagas no período (entrada com valor pago no Estoque Central)
  const comprasPeriodo = comprasInsumos
    .filter((c) => {
      const t = new Date(c.data).getTime();
      return t >= atual.inicio.getTime() && t < atual.fim.getTime();
    })
    .reduce((acc, c) => acc + c.valor, 0);

  const recebidoPeriodo = pedidosValidos(ativos, atual).reduce((acc, p) => acc + p.valorSinalPago, 0);
  const recebidoHoje = pedidosValidos(ativos, hoje).reduce((acc, p) => acc + p.valorSinalPago, 0);
  const aReceber = ativos.filter((p) => p.status === 'pendente').reduce((acc, p) => acc + p.saldoNaEntrega, 0);

  // Comissões ainda não pagas às revendedoras também são contas a pagar
  const comissoesAPagar = revendedoras.reduce(
    (acc, r) => acc + Math.max(0, resumoFinanceiro(r, vendasRevenda, pagamentosRevenda).saldo),
    0
  );
  const contas = CONTAS_A_PAGAR.reduce((acc, c) => acc + c.valor, 0);
  const aPagar = contas + comissoesAPagar;

  // Próximos 7 dias: saldos de encomendas a receber e contas a vencer
  const limite = somarDias(hoje.inicio, 8).getTime();
  const lancamentos = [
    ...encomendasEmAberto(ativos)
      .filter((p) => p.saldoNaEntrega > 0 && p.dataEntrega && new Date(p.dataEntrega).getTime() < limite)
      .map((p) => ({ id: p.id, tipo: 'entrada' as const, descricao: `${p.clienteNome} (saldo da encomenda)`, data: p.dataEntrega!, detalhe: 'Na entrega', valor: p.saldoNaEntrega })),
    ...CONTAS_A_PAGAR.filter((c) => new Date(c.vencimento).getTime() < limite).map((c) => ({
      id: c.id,
      tipo: 'saida' as const,
      descricao: c.descricao,
      data: c.vencimento,
      detalhe: c.detalhe,
      valor: c.valor,
    })),
  ]
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 4);

  return {
    saldoPrevisto: recebidoPeriodo + aReceber - aPagar - comprasPeriodo,
    recebidoHoje,
    aReceber,
    aPagar,
    comissoesAPagar,
    comprasPeriodo,
    lancamentos,
  };
};

// ============================================================================
// TOP PRODUTOS DO PERÍODO (pedidos + revenda)
// ============================================================================
export const topProdutos = (periodo: PeriodoPainel, pedidos: Pedido[], vendasRevenda: VendaRevenda[], quantos = 3) => {
  const { atual } = intervaloDoPeriodo(periodo);
  const mapa = new Map<string, { nome: string; qtd: number; faturamento: number }>();
  const somar = (nome: string, qtd: number, valor: number) => {
    const item = mapa.get(nome) ?? { nome, qtd: 0, faturamento: 0 };
    item.qtd += qtd;
    item.faturamento += valor;
    mapa.set(nome, item);
  };
  pedidosValidos(pedidos, atual).forEach((p) => p.itens.forEach((it) => somar(it.nome, it.quantidade, it.totalItem)));
  vendasValidas(vendasRevenda, atual).forEach((v) => v.itens.forEach((it) => somar(it.nome, it.quantidade, it.quantidade * it.precoUnitario)));
  return Array.from(mapa.values()).sort((a, b) => b.qtd - a.qtd).slice(0, quantos);
};

// Quantas unidades do produto saíram ontem (para o card de vitrine zerada)
export const vendidoOntem = (nome: string, pedidos: Pedido[]) => {
  const hoje = inicioDoDia(new Date());
  return pedidosValidos(pedidos, { inicio: somarDias(hoje, -1), fim: hoje })
    .flatMap((p) => p.itens)
    .filter((it) => it.nome.toLowerCase() === nome.toLowerCase())
    .reduce((acc, it) => acc + it.quantidade, 0);
};

// ============================================================================
// CLIENTES & FIDELIDADE
// ============================================================================
export const indicadoresClientes = (periodo: PeriodoPainel, clientes: ClienteCompleto[], pedidos: Pedido[]) => {
  const { atual } = intervaloDoPeriodo(periodo);
  const ativos = clientes.filter((c) => c.status === 'ativo');
  const compradores = clientes.filter((c) => c.quantidadePedidos > 0);
  const recompra = compradores.length > 0 ? Math.round((compradores.filter((c) => c.quantidadePedidos >= 2).length / compradores.length) * 100) : 0;

  // Novos = primeiro pedido do cliente caiu dentro do período
  const primeiroPedido = new Map<string, string>();
  pedidos
    .filter((p) => !p.deletado && p.clienteId)
    .forEach((p) => {
      const atualPrimeiro = primeiroPedido.get(p.clienteId!);
      if (!atualPrimeiro || p.data < atualPrimeiro) primeiroPedido.set(p.clienteId!, p.data);
    });
  const novos = Array.from(primeiroPedido.values()).filter((iso) => dentro(iso, atual)).length;

  const mes = new Date().getMonth() + 1;
  const diaDoAniversario = (c: ClienteCompleto) => parseInt((c.aniversario || '').split(/[-/]/)[0], 10) || 0;
  const aniversariantes = ativos
    .filter((c) => c.mesAniversario === mes)
    .sort((a, b) => diaDoAniversario(a) - diaDoAniversario(b))
    .map((c) => ({ ...c, diaAniversario: diaDoAniversario(c) }));

  return { ativos: ativos.length, novos, recompra, aniversariantes, nomeMes: MESES[mes - 1] };
};
