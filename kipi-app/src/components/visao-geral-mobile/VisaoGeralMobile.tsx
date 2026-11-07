import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { usePedidos, useClientes, metricasCliente, encomendasEmAberto, resumoItens, rotuloEntrega } from '@/lib/clientesPedidos';
import { useEscopoRevendedora, pedidosDoEscopo } from '@/lib/minhaRevenda';
import { useEstoqueVitrine, useEstoqueFreezer, produtoAtivo } from '@/lib/estoqueVitrine';
import { useInsumos, useComprasInsumos, demandaDaSemana, custoPorUnidadeEstoque } from '@/lib/insumos';
import { useRevenda, situacaoEstoqueRevendedoras, labelFormaPagamento } from '@/lib/revenda';
import { useHistoricoProducao } from '@/lib/historicoProducao';
import { useSessao } from '@/lib/acesso';
import { calcularKpis, intervaloDoPeriodo, type PeriodoPainel, dadosDoGrafico, funilDeEncomendas, fluxoDeCaixa, topProdutos, vendidoOntem, indicadoresClientes } from '@/lib/indicadores';
import TabBar from '@/components/mobile/TabBar';
import { Aviso, Botao, Gaveta, Opcao, T, useAviso } from '@/components/mobile/ui';
import { brl, cor, numeros, sombra } from '@/components/mobile/tema';
import DetalhePedidoMobile from '@/components/pedidos-mobile/DetalhePedidoMobile';
import NovoPedidoMobile from '@/components/pedidos-mobile/NovoPedidoMobile';

// ============================================================================
// VISÃO GERAL / INÍCIO (celular) — em segundos: como está o dia, o que pede ação
// e como foi o período. Mesmos cálculos da versão de computador (lib/indicadores).
// ============================================================================
type Painel = 'grafico' | 'funil' | 'caixa' | 'top' | 'clientes' | 'revenda' | 'acerto' | 'estoqueComigo';
type GavetaAtiva = null | 'periodo' | 'cronograma' | 'compras' | 'vitrine' | 'revendedoras' | 'aniversarios' | 'organizar';
const PADRAO_DONA: Painel[] = ['grafico', 'funil', 'caixa', 'top', 'clientes', 'revenda'];
const PADRAO_REVENDA: Painel[] = ['grafico', 'acerto', 'estoqueComigo', 'top', 'clientes'];
const CHAVE_DONA = '@kipi_inicio_celular_v1';
const CHAVE_REVENDA = '@kipi_inicio_celular_revenda_v1';
const TITULO: Record<Painel, string> = {
  grafico: 'Vendas no período',
  funil: 'Funil de encomendas',
  caixa: 'Fluxo de caixa',
  top: 'Top 3 mais vendidos',
  clientes: 'Clientes & fidelidade',
  revenda: 'Revendedoras',
  acerto: 'Acerto de contas',
  estoqueComigo: 'Estoque comigo',
};
const MEDALHA = ['#F2DDB0', '#E8E0D6', '#F2DDB0'];
const FUNIL = {
  a_fazer: { titulo: 'Confirmadas', fg: '#3A3D9E', bg: '#ECEBFA' },
  em_producao: { titulo: 'Em produção', fg: '#7A4520', bg: '#F6E8D6' },
  pronto: { titulo: 'Prontas', fg: '#2F7D55', bg: '#E4F1E9' },
} as const;

const doisDig = (n: number) => String(n).padStart(2, '0');
const paraTela = (d: Date) => `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}/${d.getFullYear()}`;
const paraFiltro = (d: Date) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`;
const lerTela = (s: string) => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null;
};
const mascaraData = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 8);
  return d.length <= 2 ? d : d.length <= 4 ? `${d.slice(0, 2)}/${d.slice(2)}` : `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

export default function VisaoGeralMobile() {
  const router = useRouter();
  const { sessao } = useSessao();
  const escopo = useEscopoRevendedora();
  const rev = escopo.ehRevendedora;
  const pedidos = pedidosDoEscopo(usePedidos(), escopo.revendedoraId);
  const todosClientes = useClientes();
  const clientes = rev
    ? todosClientes.filter((c) => c.revendedoraId === escopo.revendedoraId).map((c) => ({ ...c, ...metricasCliente(c, pedidos) }))
    : todosClientes;
  const vitrine = useEstoqueVitrine();
  const freezer = useEstoqueFreezer();
  const revenda = useRevenda();
  const revendedoras = rev ? [] : revenda.revendedoras;
  const vendasRevenda = rev ? [] : revenda.vendas;
  const entregasRevenda = rev ? [] : revenda.entregas;
  const pagamentosRevenda = rev ? [] : revenda.pagamentos;
  const historicoTodo = useHistoricoProducao();
  const historico = rev ? [] : historicoTodo;
  const insumos = useInsumos();
  const compras = useComprasInsumos();
  const { msg, avisar } = useAviso();

  const [periodo, setPeriodo] = useState<PeriodoPainel>('semana');
  const [deTxt, setDeTxt] = useState('');
  const [ateTxt, setAteTxt] = useState('');
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null);
  const [gaveta, setGaveta] = useState<GavetaAtiva>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const padrao = rev ? PADRAO_REVENDA : PADRAO_DONA;
  const chave = rev ? CHAVE_REVENDA : CHAVE_DONA;
  const [ordem, setOrdem] = useState<Painel[]>(padrao);

  // Ordem dos painéis guardada no aparelho (só os painéis do perfil)
  useEffect(() => {
    AsyncStorage.getItem(chave)
      .then((v) => {
        if (!v) return setOrdem(padrao);
        const salvo = (JSON.parse(v) as Painel[]).filter((p) => padrao.includes(p));
        setOrdem([...salvo, ...padrao.filter((p) => !salvo.includes(p))]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  // NÚMEROS (mesmas funções da versão de computador)
  const kpis = calcularKpis(periodo, pedidos, vendasRevenda, revendedoras, historico);
  const kpisHoje = calcularKpis('hoje', pedidos, vendasRevenda, revendedoras, historico);
  const comissaoEm = (p: PeriodoPainel) => {
    const { atual } = intervaloDoPeriodo(p);
    return pedidos.filter((x) => !x.deletado && new Date(x.data) >= atual.inicio && new Date(x.data) < atual.fim).reduce((a, x) => a + escopo.comissaoDoPedido(x), 0);
  };
  const minhaComissao = rev ? comissaoEm(periodo) : 0;
  const minhaComissaoHoje = rev ? comissaoEm('hoje') : 0;
  const grafico = dadosDoGrafico(periodo, pedidos, vendasRevenda);
  const funil = funilDeEncomendas(pedidos);
  const caixa = fluxoDeCaixa(periodo, pedidos, revendedoras, vendasRevenda, pagamentosRevenda, compras);
  const ranking = topProdutos(periodo, pedidos, vendasRevenda);
  const indClientes = indicadoresClientes(periodo, clientes, pedidos);
  const situacaoRevenda = situacaoEstoqueRevendedoras(revendedoras, entregasRevenda, vendasRevenda);
  const revEmAlerta = situacaoRevenda.filter((s) => s.emAlerta);

  const encomendas = encomendasEmAberto(pedidos);
  const cronograma = encomendas
    .map((p) => ({ p, rotulo: rotuloEntrega(p.dataEntrega) }))
    .filter((x) => x.rotulo.startsWith('Hoje') || x.rotulo.startsWith('Amanhã'));
  const entregasHoje = cronograma.filter((x) => x.rotulo.startsWith('Hoje'));
  const entregasAmanha = cronograma.filter((x) => x.rotulo.startsWith('Amanhã'));

  const listaCompras = useMemo(
    () =>
      insumos
        .filter((i) => i.status === 'ativo')
        .map((i) => {
          const demanda = Number(demandaDaSemana(i, encomendas).toFixed(2));
          const necessario = Math.max(demanda, i.estoqueMinimo);
          const falta = Number(Math.max(necessario - i.quantidadeEstoque, 0).toFixed(2));
          const custoUn = custoPorUnidadeEstoque(i);
          return { id: i.id, nome: i.nome, unidade: i.unidade, estoque: i.quantidadeEstoque, minimo: i.estoqueMinimo, demanda, necessario, falta, custo: falta * custoUn };
        })
        .filter((i) => i.falta > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insumos, pedidos]
  );
  const custoCompras = listaCompras.reduce((a, i) => a + i.custo, 0);
  const vitrineZerada = rev
    ? []
    : vitrine
        .filter((p) => produtoAtivo(p) && p.disponibilidade !== 'sob_encomenda' && p.estoque === 0)
        .map((p) => ({ ...p, ontem: vendidoOntem(p.nome, pedidos), massa: freezer[p.id] ?? 0 }));
  const saborAcabando = escopo.sabores.filter((x) => x.status !== 'abastecido');

  const extrato = rev
    ? [
        ...escopo.minhasVendas.filter((v) => v.status !== 'cancelado').map((v) => ({ id: v.id, data: v.data, titulo: `Comissão · ${v.cliente || 'Venda sem cliente'}`, valor: escopo.comissao(v) })),
        ...escopo.meusPagamentos.map((p) => ({ id: p.id, data: p.data, titulo: `Recebido do ateliê · ${labelFormaPagamento(p.formaPagamento)}`, valor: -p.valor })),
      ]
        .sort((a, b) => b.data.localeCompare(a.data))
        .slice(0, 6)
    : [];

  // TEXTOS
  const hora = new Date().getHours();
  const saudacao = hora >= 5 && hora < 12 ? 'Bom dia' : hora < 18 && hora >= 12 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = (sessao?.nome ?? 'Camila Lima').split(' ')[0];
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const ehPersonalizado = periodo.startsWith('personalizar');
  const rotuloPeriodo = ehPersonalizado
    ? (() => {
        const [, de, ate] = periodo.split(':');
        return de && ate ? `${de.slice(8, 10)}/${de.slice(5, 7)} – ${ate.slice(8, 10)}/${ate.slice(5, 7)}` : 'Personalizado';
      })()
    : { hoje: 'Hoje', semana: 'Esta semana', mes: 'Este mês' }[periodo as 'hoje' | 'semana' | 'mes'];
  const hojeData = new Date();
  const atalhos = [
    { rotulo: 'Últimos 15 dias', de: new Date(hojeData.getFullYear(), hojeData.getMonth(), hojeData.getDate() - 14), ate: hojeData },
    { rotulo: 'Últimos 30 dias', de: new Date(hojeData.getFullYear(), hojeData.getMonth(), hojeData.getDate() - 29), ate: hojeData },
    { rotulo: 'Mês passado', de: new Date(hojeData.getFullYear(), hojeData.getMonth() - 1, 1), ate: new Date(hojeData.getFullYear(), hojeData.getMonth(), 0) },
    { rotulo: 'Este ano', de: new Date(hojeData.getFullYear(), 0, 1), ate: hojeData },
  ];
  const aplicarIntervalo = (de: Date, ate: Date) => {
    setDeTxt(paraTela(de));
    setAteTxt(paraTela(ate));
    setErroPeriodo(null);
    setPeriodo(`personalizar:${paraFiltro(de)}:${paraFiltro(ate)}`);
  };
  const aplicarPeriodo = () => {
    if (ehPersonalizado || periodo === 'personalizar') {
      const de = lerTela(deTxt);
      const ate = lerTela(ateTxt);
      if (!de || !ate) return setErroPeriodo('Use datas no formato DD/MM/AAAA.');
      if (ate < de) return setErroPeriodo('A data final precisa ser depois da inicial.');
      aplicarIntervalo(de, ate);
    }
    setGaveta(null);
  };

  const copiarCompras = async () => {
    const texto = [
      '🛒 *LISTA DE COMPRAS DO ATELIÊ:*',
      `Data: ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      ...listaCompras.map((i) => `• ${i.nome}: comprar ${i.falta.toLocaleString('pt-BR')} ${i.unidade} (estoque: ${i.estoque.toLocaleString('pt-BR')} ${i.unidade})`),
      '',
      `💰 Custo estimado total: ${brl(custoCompras)}`,
    ].join('\n');
    await Clipboard.setStringAsync(texto);
    avisar('Lista de compras copiada para o WhatsApp!');
  };
  const parabenizar = (nome: string, telefone?: string | null) => {
    const texto = encodeURIComponent(`Oi, ${nome.split(' ')[0]}! 🎂 Feliz aniversário! Que seu dia seja doce. Um carinho do nosso ateliê pra você 💛`);
    const tel = (telefone ?? '').replace(/\D/g, '');
    const url = tel ? `https://wa.me/55${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
    else Linking.openURL(url).catch(() => {});
  };

  // PRECISA DE ATENÇÃO
  type Item = { id: string; titulo: string; sub: string; valor: string; bg: string; fg: string; icone: keyof typeof MaterialCommunityIcons.glyphMap; abrir: () => void };
  const atencao: Item[] = rev
    ? [
        ...(saborAcabando.length
          ? [{ id: 'comigo', titulo: 'Estoque comigo acabando', sub: saborAcabando.slice(0, 2).map((x) => x.nome).join(', '), valor: String(saborAcabando.length), bg: cor.ambarClaro, fg: cor.ambarTexto, icone: 'package-variant' as const, abrir: () => {} }]
          : []),
        ...(kpis.aReceberNum > 0
          ? [{ id: 'devem', titulo: 'Clientes me devem', sub: kpis.pendentes, valor: kpis.aReceber, bg: cor.vermelhoClaro, fg: cor.vermelho, icone: 'clock-outline' as const, abrir: () => router.push('/pedidos') }]
          : []),
      ]
    : [
        ...(listaCompras.length
          ? [{ id: 'compras', titulo: 'O que comprar', sub: `${listaCompras.length} ${listaCompras.length === 1 ? 'insumo abaixo' : 'insumos abaixo'} do necessário`, valor: brl(custoCompras), bg: cor.ambarClaro, fg: cor.ambarTexto, icone: 'cart-outline' as const, abrir: () => setGaveta('compras') }]
          : []),
        ...(vitrineZerada.length
          ? [{ id: 'vitrine', titulo: 'Vitrine zerada', sub: vitrineZerada.slice(0, 2).map((p) => p.nome).join(', '), valor: String(vitrineZerada.length), bg: '#FBE7E4', fg: cor.vermelho, icone: 'storefront-outline' as const, abrir: () => setGaveta('vitrine') }]
          : []),
        ...(revEmAlerta.length
          ? [{ id: 'rev', titulo: 'Revendedoras', sub: `${revEmAlerta.length} ${revEmAlerta.length === 1 ? 'parceira' : 'parceiras'} com estoque baixo`, valor: String(revEmAlerta.length), bg: cor.pistacheClaro, fg: cor.pistacheTexto, icone: 'account-group-outline' as const, abrir: () => setGaveta('revendedoras') }]
          : []),
        ...(indClientes.aniversariantes.length
          ? [{ id: 'niver', titulo: 'Aniversariantes do mês', sub: indClientes.aniversariantes.slice(0, 2).map((c) => c.nome).join(', '), valor: String(indClientes.aniversariantes.length), bg: '#FCE7F3', fg: '#9D174D', icone: 'cake-variant-outline' as const, abrir: () => setGaveta('aniversarios') }]
          : []),
      ];

  const kpiCards = rev
    ? [
        { rotulo: 'Minhas vendas', valor: kpis.faturamento, nota: kpis.faturamentoDiff, notaCor: cor.verde, sub: kpis.pedidosQtd, tom: 'neutro' },
        { rotulo: 'Minha comissão', valor: brl(minhaComissao), nota: `${kpis.faturamentoNum > 0 ? Math.round((minhaComissao / kpis.faturamentoNum) * 100) : 0}% das vendas`, notaCor: cor.azulTexto, sub: 'Ganho no período', tom: 'neutro' },
        { rotulo: 'A receber', valor: kpis.aReceber, nota: `${kpis.pendentes} ›`, notaCor: cor.vermelho, sub: 'Clientes me devem', tom: kpis.aReceberNum > 0 ? 'vermelho' : 'verde', abrir: () => router.push('/pedidos') },
        { rotulo: 'Ateliê me deve', valor: brl(Math.max(0, escopo.resumo?.saldo ?? 0)), nota: 'Acerto de contas', notaCor: cor.verde, sub: 'Comissão a receber', tom: 'verde' },
      ]
    : [
        { rotulo: 'Faturamento', valor: kpis.faturamento, nota: kpis.faturamentoDiff, notaCor: cor.verde, sub: `${kpis.metaPct}% da meta`, tom: 'neutro' },
        { rotulo: 'Lucro líquido', valor: kpis.lucroLiquido, nota: kpis.margem, notaCor: cor.azulTexto, sub: kpis.perdasNum > 0 ? `Perdas −${kpis.perdas}` : 'Estimado no período', tom: 'neutro' },
        { rotulo: 'Ticket médio', valor: kpis.ticketMedio, nota: kpis.pedidosQtd, notaCor: cor.textoMedio, sub: kpis.revendaPedidos > 0 ? `+ ${kpis.revendaPedidos} da revenda` : 'Vendas diretas', tom: 'neutro' },
        { rotulo: 'A receber', valor: kpis.aReceber, nota: `${kpis.pendentes} ›`, notaCor: kpis.aReceberNum > 0 ? cor.vermelho : cor.verde, sub: 'Saldos na entrega', tom: kpis.aReceberNum > 0 ? 'vermelho' : 'verde', abrir: () => router.push('/pedidos') },
      ];

  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= ordem.length) return;
    const o = [...ordem];
    [o[i], o[j]] = [o[j], o[i]];
    setOrdem(o);
  };
  const salvarOrdem = async () => {
    await AsyncStorage.setItem(chave, JSON.stringify(ordem)).catch(() => {});
    setGaveta(null);
    avisar('Ordem do painel salva');
  };
  const restaurar = async () => {
    setOrdem(padrao);
    await AsyncStorage.removeItem(chave).catch(() => {});
  };

  const ic = (n: keyof typeof MaterialCommunityIcons.glyphMap, t: number, c: string) => <MaterialCommunityIcons name={n} size={t} color={c} />;
  const maxGrafico = Math.max(1, ...grafico.map((g) => g.valor));
  const pico = grafico.find((g) => g.pico && g.valor > 0);
  const pctDireta = kpis.faturamentoNum > 0 ? Math.round(((kpis.faturamentoNum - kpis.revendaNum) / kpis.faturamentoNum) * 100) : 0;

  const renderPainel = (id: Painel) => {
    const cabecalho = (link?: { rotulo: string; acao: () => void }) => (
      <View style={s.painelTopo}>
        <T titulo style={s.painelTitulo}>{TITULO[id]}</T>
        {link && (
          <TouchableOpacity onPress={link.acao} accessibilityRole="button">
            <T style={s.link}>{link.rotulo}</T>
          </TouchableOpacity>
        )}
      </View>
    );
    switch (id) {
      case 'grafico':
        return (
          <View key={id} style={[s.painel, sombra]}>
            {cabecalho()}
            <View style={s.barras}>
              {grafico.map((g, i) => (
                <View key={i} style={s.barraCol}>
                  <T style={[s.barraValor, numeros]} numberOfLines={1}>{g.valor >= 1000 ? `${(g.valor / 1000).toFixed(1).replace('.', ',')}k` : Math.round(g.valor)}</T>
                  <View style={[s.barra, { height: Math.max(6, Math.round((g.valor / maxGrafico) * 96)), backgroundColor: g.pico && g.valor > 0 ? cor.pistache : g.atual ? cor.azulBotao : '#D6D7F3' }]} />
                  <T style={[s.barraDia, (g.atual || g.pico) && { color: cor.texto, fontWeight: '800' }]} numberOfLines={1}>{g.label}</T>
                </View>
              ))}
            </View>
            {pico && <T style={s.dica}>Maior: <T style={[s.dica, { fontWeight: '800', color: cor.pistacheTexto }]}>{pico.label}, {brl(pico.valor)}</T> · em verde</T>}
          </View>
        );
      case 'funil':
        return (
          <View key={id} style={[s.painel, sombra]}>
            {cabecalho({ rotulo: 'Ver cozinha ›', acao: () => router.push('/producao') })}
            <View style={s.linha3}>
              {funil.map((f) => {
                const v = FUNIL[f.status];
                return (
                  <View key={f.status} style={[s.mini, { backgroundColor: v.bg }]}>
                    <T style={[s.miniRotulo, { color: v.fg }]}>{v.titulo}</T>
                    <T titulo style={[s.miniValor, numeros, { color: v.fg }]}>{f.quantidade}</T>
                    <T style={s.miniSub} numberOfLines={1}>{f.primeira ? `${f.primeira.clienteNome.split(' ')[0]} · ${rotuloEntrega(f.primeira.dataEntrega)}` : 'Nenhuma'}</T>
                  </View>
                );
              })}
            </View>
          </View>
        );
      case 'caixa':
        return (
          <View key={id} style={[s.painel, sombra]}>
            {cabecalho()}
            <View style={s.linhaEntre}>
              <T style={s.medio}>Saldo previsto</T>
              <T titulo style={[s.valorGrande, numeros, { color: caixa.saldoPrevisto >= 0 ? cor.verde : cor.vermelho }]}>{brl(caixa.saldoPrevisto)}</T>
            </View>
            <View style={s.linha3}>
              <View style={[s.mini, { backgroundColor: cor.fundo }]}><T style={s.miniRotulo}>Recebido hoje</T><T style={[s.miniValorPeq, numeros]}>{brl(caixa.recebidoHoje)}</T></View>
              <View style={[s.mini, { backgroundColor: cor.verdeClaro }]}><T style={[s.miniRotulo, { color: cor.verde }]}>A receber</T><T style={[s.miniValorPeq, numeros, { color: cor.verde }]}>+{brl(caixa.aReceber)}</T></View>
              <View style={[s.mini, { backgroundColor: cor.vermelhoClaro }]}><T style={[s.miniRotulo, { color: cor.vermelho }]}>A pagar</T><T style={[s.miniValorPeq, numeros, { color: cor.vermelho }]}>−{brl(caixa.aPagar)}</T></View>
            </View>
            <T style={s.rotulo}>Próximos 7 dias</T>
            {caixa.lancamentos.length === 0 && <T style={s.dica}>Nenhum lançamento nos próximos 7 dias.</T>}
            {caixa.lancamentos.map((l) => (
              <View key={l.id} style={s.lancamento}>
                <T style={[s.data, numeros]}>{rotuloEntrega(l.data).split(' ')[0]}</T>
                <View style={{ flex: 1 }}>
                  <T style={s.lancTitulo} numberOfLines={1}>{l.descricao}</T>
                  {!!l.detalhe && <T style={s.dica} numberOfLines={1}>{l.detalhe}</T>}
                </View>
                <T style={[s.lancValor, numeros, { color: l.tipo === 'entrada' ? cor.verde : cor.vermelho }]}>{l.tipo === 'entrada' ? '+' : '−'}{brl(l.valor)}</T>
              </View>
            ))}
          </View>
        );
      case 'top':
        return (
          <View key={id} style={[s.painel, sombra]}>
            {cabecalho()}
            {ranking.length === 0 && <T style={s.dica}>Nenhuma venda no período.</T>}
            {ranking.map((p, i) => (
              <View key={p.nome} style={s.top}>
                <View style={[s.medalha, { backgroundColor: MEDALHA[i] }]}><T style={s.medalhaTexto}>{i + 1}</T></View>
                <T style={[s.lancTitulo, { flex: 1 }]} numberOfLines={1}>{p.nome}</T>
                <View style={{ alignItems: 'flex-end' }}>
                  <T style={[s.forte, numeros]}>{p.qtd} vendidos</T>
                  <T style={[s.dica, numeros]}>{brl(p.faturamento)}</T>
                </View>
              </View>
            ))}
          </View>
        );
      case 'clientes':
        return (
          <View key={id} style={[s.painel, sombra]}>
            {cabecalho(indClientes.aniversariantes.length ? { rotulo: `${indClientes.aniversariantes.length} aniversariantes ›`, acao: () => setGaveta('aniversarios') } : undefined)}
            <View style={s.linha3}>
              <View style={[s.mini, { backgroundColor: cor.fundo }]}><T style={s.miniRotulo}>Ativos</T><T titulo style={[s.miniValor, numeros]}>{indClientes.ativos}</T></View>
              <View style={[s.mini, { backgroundColor: cor.fundo }]}><T style={s.miniRotulo}>Novos</T><T titulo style={[s.miniValor, numeros, { color: cor.verde }]}>+{indClientes.novos}</T></View>
              <View style={[s.mini, { backgroundColor: cor.fundo }]}><T style={s.miniRotulo}>Recompra</T><T titulo style={[s.miniValor, numeros, { color: cor.azulTexto }]}>{indClientes.recompra}%</T></View>
            </View>
          </View>
        );
      case 'revenda':
        return (
          <View key={id} style={[s.painel, sombra]}>
            {cabecalho(revEmAlerta.length ? { rotulo: `${revEmAlerta.length} com estoque baixo ›`, acao: () => setGaveta('revendedoras') } : { rotulo: 'Gerenciar ›', acao: () => router.push('/acessos') })}
            <View style={s.linha3}>
              <View style={[s.mini, { backgroundColor: cor.fundo }]}><T style={s.miniRotulo}>Parceiras</T><T titulo style={[s.miniValor, numeros]}>{revendedoras.length}</T></View>
              <View style={[s.mini, { backgroundColor: cor.fundo }]}><T style={s.miniRotulo}>Vendidos</T><T titulo style={[s.miniValor, numeros]}>{kpis.revendaQtd.split(' ')[0]}</T></View>
              <View style={[s.mini, { backgroundColor: cor.fundo }]}><T style={s.miniRotulo}>Repasse</T><T style={[s.miniValorPeq, numeros]}>{kpis.revendaTotal}</T></View>
            </View>
            <T style={s.dica}>{kpis.revendaPedidos} vendas · {brl(kpis.comissoesRevenda)} em comissões</T>
            <T style={s.rotulo}>Venda direta × revenda</T>
            <View style={s.canal}>
              <View style={{ width: `${pctDireta}%`, backgroundColor: cor.azul }} />
              <View style={{ width: `${100 - pctDireta}%`, backgroundColor: cor.pistache }} />
            </View>
            <View style={s.linhaEntre}>
              <T style={s.dica}><T style={[s.dica, { fontWeight: '800', color: cor.azulTexto }]}>{pctDireta}%</T> direta · {kpis.diretaPedidos} vendas · {brl(kpis.faturamentoNum - kpis.revendaNum)}</T>
            </View>
            <T style={s.dica}><T style={[s.dica, { fontWeight: '800', color: cor.pistacheTexto }]}>{100 - pctDireta}%</T> revenda · {kpis.revendaPedidos} vendas · {brl(kpis.revendaNum)}</T>
          </View>
        );
      case 'acerto': {
        const r = escopo.resumo;
        return (
          <View key={id} style={[s.painel, sombra]}>
            {cabecalho()}
            <View style={s.linha3}>
              <View style={[s.mini, { backgroundColor: cor.fundo }]}><T style={s.miniRotulo}>Comissão total</T><T style={[s.miniValorPeq, numeros]}>{brl(r?.comissao ?? 0)}</T></View>
              <View style={[s.mini, { backgroundColor: cor.fundo }]}><T style={s.miniRotulo}>Já recebido</T><T style={[s.miniValorPeq, numeros]}>{brl(r?.pago ?? 0)}</T></View>
              <View style={[s.mini, { backgroundColor: cor.verdeClaro }]}><T style={[s.miniRotulo, { color: cor.verde }]}>Ateliê me deve</T><T style={[s.miniValorPeq, numeros, { color: cor.verde }]}>{brl(Math.max(0, r?.saldo ?? 0))}</T></View>
            </View>
            <T style={s.rotulo}>Últimos lançamentos</T>
            {extrato.length === 0 && <T style={s.dica}>Nenhuma venda ainda.</T>}
            {extrato.map((e) => (
              <View key={e.id} style={s.lancamento}>
                <T style={[s.data, numeros]}>{new Date(e.data).toLocaleDateString('pt-BR').slice(0, 5)}</T>
                <T style={[s.lancTitulo, { flex: 1 }]} numberOfLines={1}>{e.titulo}</T>
                <T style={[s.lancValor, numeros, { color: e.valor >= 0 ? cor.azulTexto : cor.verde }]}>{e.valor >= 0 ? '+' : '−'}{brl(Math.abs(e.valor))}</T>
              </View>
            ))}
          </View>
        );
      }
      case 'estoqueComigo':
        return (
          <View key={id} style={[s.painel, sombra]}>
            {cabecalho()}
            {escopo.sabores.length === 0 && <T style={s.dica}>O ateliê ainda não entregou produtos para você.</T>}
            {escopo.sabores.map((x) => {
              const st = x.status === 'esgotado' ? { t: 'Esgotado', bg: '#FBE7E4', fg: cor.vermelho } : x.status === 'baixo' ? { t: 'Acabando', bg: cor.ambarClaro, fg: cor.ambarTexto } : { t: 'Em dia', bg: '#E4F1E9', fg: cor.verde };
              return (
                <View key={x.produtoId ?? x.nome} style={s.lancamento}>
                  <T style={[s.lancTitulo, { flex: 1 }]} numberOfLines={1}>{x.nome}</T>
                  <View style={[s.etq, { backgroundColor: st.bg }]}><T style={[s.etqTexto, { color: st.fg }]}>{st.t}</T></View>
                  <T style={[s.forte, numeros, { width: 52, textAlign: 'right' }]}>{x.saldo} un</T>
                </View>
              );
            })}
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={s.topo}>
          <View style={{ flex: 1, gap: 2 }}>
            <T style={s.data2}>{dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1)}</T>
            <T titulo style={s.titulo}>{saudacao}, <T titulo style={[s.titulo, { color: cor.mirtilo }]}>{primeiroNome}</T></T>
          </View>
          <TouchableOpacity style={[s.redondo, sombra]} onPress={() => setGaveta('organizar')} accessibilityRole="button" accessibilityLabel="Organizar painel">
            <Feather name="sliders" size={18} color={cor.textoMedio} />
          </TouchableOpacity>
        </View>

        {/* HOJE */}
        <View style={s.hoje}>
          <View style={s.linhaEntre}>
            <View style={{ gap: 2, flex: 1 }}>
              <T style={s.hojeRotulo}>{rev ? 'Suas vendas hoje' : 'Vendas de hoje'}</T>
              <T titulo style={[s.hojeValor, numeros]}>{kpisHoje.faturamento}</T>
              <T style={[s.hojeRotulo, numeros]}>{rev ? `Sua comissão hoje: ${brl(minhaComissaoHoje)}` : `Lucro estimado hoje: ${kpisHoje.lucroLiquido}`}</T>
            </View>
            {!rev && (
              <View style={s.metaChip}>
                <T style={[s.metaTexto, numeros]}>{kpisHoje.metaPct}% da meta</T>
              </View>
            )}
          </View>
          {!rev && (
            <View style={s.metaTrilho}>
              <View style={[s.metaCheio, { width: `${Math.min(100, kpisHoje.metaPct)}%` }]} />
            </View>
          )}
          <View style={[s.linhaEntre, { gap: 8 }]}>
            <TouchableOpacity style={s.hojeBotaoBorda} onPress={() => setGaveta('cronograma')} accessibilityRole="button">
              <Feather name="calendar" size={15} color="#FFFDFA" />
              <T style={s.hojeBotaoBordaTexto}>{entregasHoje.length} {entregasHoje.length === 1 ? 'entrega' : 'entregas'} hoje</T>
            </TouchableOpacity>
            <TouchableOpacity style={s.hojeBotao} onPress={() => setNovoAberto(true)} accessibilityRole="button">
              <Feather name="plus" size={16} color={cor.carameloTinta} />
              <T style={s.hojeBotaoTexto}>Novo pedido</T>
            </TouchableOpacity>
          </View>
        </View>

        {/* PRECISA DE ATENÇÃO */}
        {atencao.length > 0 && (
          <View style={s.secao}>
            <T titulo style={s.secaoTitulo}>Precisa de atenção</T>
            <View style={[s.lista, sombra]}>
              {atencao.map((a, i) => (
                <TouchableOpacity key={a.id} style={[s.atencao, i > 0 && s.borda]} onPress={a.abrir} accessibilityRole="button">
                  <View style={[s.atencaoIcone, { backgroundColor: a.bg }]}>{ic(a.icone, 18, a.fg)}</View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={s.lancTitulo}>{a.titulo}</T>
                    <T style={s.dica} numberOfLines={1}>{a.sub}</T>
                  </View>
                  <T style={[s.forte, numeros, { color: a.fg }]}>{a.valor}</T>
                  <Feather name="chevron-right" size={16} color={cor.apagado} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* RESULTADOS */}
        <View style={[s.secao, s.linhaEntre, { paddingHorizontal: 20 }]}>
          <T titulo style={[s.secaoTitulo, { paddingHorizontal: 0, paddingBottom: 0 }]}>Resultados</T>
          <TouchableOpacity style={s.periodo} onPress={() => setGaveta('periodo')} accessibilityRole="button" accessibilityLabel={`Período: ${rotuloPeriodo}. Trocar`}>
            <T style={s.link}>{rotuloPeriodo}</T>
            <Feather name="chevron-down" size={16} color={cor.azulTexto} />
          </TouchableOpacity>
        </View>
        <View style={s.grade}>
          {kpiCards.map((k) => {
            const bg = k.tom === 'vermelho' ? cor.vermelhoClaro : k.tom === 'verde' ? cor.verdeClaro : '#FFFDFA';
            const fg = k.tom === 'vermelho' ? cor.vermelho : k.tom === 'verde' ? cor.verde : cor.texto;
            return (
              <TouchableOpacity key={k.rotulo} style={[s.kpi, sombra, { backgroundColor: bg }]} onPress={k.abrir} disabled={!k.abrir} activeOpacity={0.8}>
                <T style={[s.kpiRotulo, k.tom !== 'neutro' && { color: fg }]}>{k.rotulo}</T>
                <T titulo style={[s.kpiValor, numeros, { color: fg }]} numberOfLines={1}>{k.valor}</T>
                <T style={[s.kpiNota, { color: k.notaCor }]} numberOfLines={1}>{k.nota}</T>
                <T style={s.kpiSub} numberOfLines={1}>{k.sub}</T>
              </TouchableOpacity>
            );
          })}
        </View>
        {!rev && (
          <TouchableOpacity style={[s.encomendas, sombra]} onPress={() => setGaveta('cronograma')} accessibilityRole="button">
            <T style={s.medio}>Encomendas ativas</T>
            <T titulo style={[s.kpiValor, numeros]}>{encomendas.length}</T>
            <T style={[s.link, { marginLeft: 'auto', fontSize: 12 }]}>{entregasHoje.length} hoje · {entregasAmanha.length} amanhã ›</T>
          </TouchableOpacity>
        )}

        {/* PAINÉIS */}
        {ordem.map(renderPainel)}
      </ScrollView>

      <Aviso msg={msg} base={100} />
      <TabBar ativa="/visao-geral" />

      {/* PERÍODO */}
      <Gaveta aberta={gaveta === 'periodo'} aoFechar={() => setGaveta(null)} titulo="Período" subtitulo="Vale para todos os resultados">
        <View style={{ gap: 8 }}>
          {([['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['personalizar', 'Personalizar datas']] as [string, string][]).map(([k, r]) => (
            <Opcao
              key={k}
              rotulo={r}
              ativo={k === 'personalizar' ? ehPersonalizado : periodo === k}
              aoTocar={() => (k === 'personalizar' ? setPeriodo('personalizar') : setPeriodo(k as PeriodoPainel))}
              style={{ minHeight: 52, borderRadius: 16, justifyContent: 'flex-start', paddingHorizontal: 16 }}
              textoStyle={{ fontSize: 15 }}
            />
          ))}
        </View>
        {ehPersonalizado && (
          <View style={{ gap: 10 }}>
            <View style={s.wrap}>
              {atalhos.map((a) => (
                <Opcao key={a.rotulo} rotulo={a.rotulo} ativo={false} aoTocar={() => aplicarIntervalo(a.de, a.ate)} style={{ minHeight: 36 }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { r: 'De', v: deTxt, set: setDeTxt },
                { r: 'Até', v: ateTxt, set: setAteTxt },
              ].map((c) => (
                <View key={c.r} style={{ flex: 1, gap: 4 }}>
                  <T style={s.rotulo}>{c.r}</T>
                  <TextInput value={c.v} onChangeText={(t) => c.set(mascaraData(t))} placeholder="DD/MM/AAAA" placeholderTextColor={cor.textoSuave} keyboardType="number-pad" style={s.campo} accessibilityLabel={`Data ${c.r}`} />
                </View>
              ))}
            </View>
            {!!erroPeriodo && <T style={[s.dica, { color: cor.vermelho }]}>{erroPeriodo}</T>}
          </View>
        )}
        <Botao rotulo="Aplicar" aoTocar={aplicarPeriodo} />
      </Gaveta>

      {/* CRONOGRAMA */}
      <Gaveta aberta={gaveta === 'cronograma'} aoFechar={() => setGaveta(null)} titulo="Cronograma de entregas" subtitulo="Encomendas de hoje e amanhã">
        {[
          { titulo: 'Hoje', lista: entregasHoje },
          { titulo: 'Amanhã', lista: entregasAmanha },
        ].map((g) => (
          <View key={g.titulo} style={{ gap: 4 }}>
            <T style={s.rotulo}>{g.titulo} · {g.lista.length} {g.lista.length === 1 ? 'entrega' : 'entregas'}</T>
            {g.lista.length === 0 && <T style={s.dica}>Nenhuma entrega agendada.</T>}
            {g.lista.map(({ p, rotulo }) => {
              const temSaldo = p.saldoNaEntrega > 0;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.cronItem, s.borda]}
                  onPress={() => {
                    setGaveta(null);
                    setDetalheId(p.id);
                  }}
                  accessibilityRole="button">
                  <T style={[s.cronHora, numeros]}>{rotulo.split(' ')[1]}</T>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <T style={s.lancTitulo}>{p.clienteNome}</T>
                    <T style={s.dica}>{resumoItens(p)}</T>
                    {!!p.observacoes && <T style={[s.dica, { fontStyle: 'italic' }]}>“{p.observacoes}”</T>}
                  </View>
                  <T style={[s.forte, numeros, { fontSize: 12, color: temSaldo ? cor.ambar : cor.verde }]}>{temSaldo ? `Falta ${brl(p.saldoNaEntrega)}` : `Pago ${brl(p.total)}`}</T>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </Gaveta>

      {/* O QUE COMPRAR */}
      <Gaveta aberta={gaveta === 'compras'} aoFechar={() => setGaveta(null)} titulo="O que comprar" subtitulo="Pelas encomendas dos próximos 7 dias e pelo estoque mínimo">
        <View style={[s.faixa, s.linhaEntre, { backgroundColor: cor.ambarFundo }]}>
          <T style={[s.forte, { color: cor.ambarTexto }]}>Custo estimado</T>
          <T titulo style={[s.valorGrande, numeros, { color: cor.ambarTexto }]}>{brl(custoCompras)}</T>
        </View>
        {listaCompras.map((i) => {
          const pct = i.necessario > 0 ? Math.min(100, Math.round((i.estoque / i.necessario) * 100)) : 0;
          return (
            <View key={i.id} style={[s.borda, { paddingVertical: 10, gap: 6 }]}>
              <View style={s.linhaEntre}>
                <T style={[s.lancTitulo, { flex: 1 }]}>{i.nome}</T>
                <T style={[s.forte, numeros, { color: cor.vermelho }]}>Comprar +{i.falta.toLocaleString('pt-BR')} {i.unidade}</T>
              </View>
              <View style={s.trilho}><View style={[s.trilhoCheio, { width: `${pct}%` }]} /></View>
              <View style={s.linhaEntre}>
                <T style={[s.dica, numeros, { flex: 1 }]} numberOfLines={1}>{pct}% · tem {i.estoque.toLocaleString('pt-BR')} · semana {i.demanda.toLocaleString('pt-BR')} · mín. {i.minimo.toLocaleString('pt-BR')} {i.unidade}</T>
                <T style={[s.forte, numeros, { fontSize: 12 }]}>{brl(i.custo)}</T>
              </View>
            </View>
          );
        })}
        <Botao rotulo="Copiar lista para WhatsApp" variante="verde" icone="copy" aoTocar={copiarCompras} />
      </Gaveta>

      {/* VITRINE ZERADA */}
      <Gaveta aberta={gaveta === 'vitrine'} aoFechar={() => setGaveta(null)} titulo="Vitrine zerada" subtitulo="Produtos de pronta entrega sem estoque para venda">
        {vitrineZerada.map((p) => (
          <View key={p.id} style={[s.linhaEntre, s.borda, { paddingVertical: 10 }]}>
            <View style={{ flex: 1 }}>
              <T style={s.lancTitulo}>{p.nome}</T>
              <T style={s.dica}>{p.ontem > 0 ? `Vendeu ${p.ontem} ontem` : 'Sem vendas ontem'}</T>
            </View>
            <TouchableOpacity
              style={[s.acaoPeq, { backgroundColor: p.massa > 0 ? '#FBF0DC' : '#ECEBFA' }]}
              onPress={() => {
                setGaveta(null);
                router.push(`/producao?${p.massa > 0 ? 'assar' : 'preparar'}=${p.id}&t=${Date.now()}` as any);
              }}
              accessibilityRole="button">
              <T style={[s.forte, { color: p.massa > 0 ? '#9A6516' : '#3A3D9E' }]}>{p.massa > 0 ? 'Registrar fornada' : 'Preparar massa'}</T>
            </TouchableOpacity>
          </View>
        ))}
      </Gaveta>

      {/* REVENDEDORAS */}
      <Gaveta aberta={gaveta === 'revendedoras'} aoFechar={() => setGaveta(null)} titulo="Revendedoras" subtitulo="Estoque que está com cada parceira">
        {situacaoRevenda.map((x) => (
          <View key={x.revendedora.id} style={[s.linhaEntre, s.borda, { paddingVertical: 10 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={s.lancTitulo}>{x.revendedora.nome}</T>
              <T style={[s.dica, { color: x.emAlerta ? cor.vermelho : cor.verde, fontWeight: '700' }]}>
                {x.emAlerta
                  ? x.total === 0
                    ? 'Estoque zerado'
                    : `${x.saboresEmFalta} ${x.saboresEmFalta === 1 ? 'sabor precisa' : 'sabores precisam'} de reposição`
                  : `Estoque regular (${x.total} un com ela)`}
                {x.emAlerta && x.diasSemReposicao !== null ? ` · sem reposição há ${x.diasSemReposicao} ${x.diasSemReposicao === 1 ? 'dia' : 'dias'}` : ''}
              </T>
            </View>
            {x.emAlerta ? (
              <TouchableOpacity style={[s.acaoPeq, { backgroundColor: cor.azulClaro }]} onPress={() => { setGaveta(null); router.push('/acessos'); }} accessibilityRole="button">
                <T style={[s.forte, { color: cor.azulTexto }]}>+ Enviar remessa</T>
              </TouchableOpacity>
            ) : (
              <View style={[s.etq, { backgroundColor: '#E4F1E9' }]}><T style={[s.etqTexto, { color: cor.verde }]}>Em dia</T></View>
            )}
          </View>
        ))}
      </Gaveta>

      {/* ANIVERSARIANTES */}
      <Gaveta aberta={gaveta === 'aniversarios'} aoFechar={() => setGaveta(null)} titulo={`Aniversariantes de ${indClientes.nomeMes.toLowerCase()}`} subtitulo="Mande um carinho pelo WhatsApp">
        {indClientes.aniversariantes.length === 0 && <T style={s.dica}>Nenhum aniversariante neste mês.</T>}
        {indClientes.aniversariantes.map((c) => (
          <View key={c.id} style={[s.linhaEntre, s.borda, { paddingVertical: 10 }]}>
            <View style={s.dia}><T style={[s.forte, { color: '#9D174D' }]}>{doisDig(c.diaAniversario)}</T></View>
            <View style={{ flex: 1 }}>
              <T style={s.lancTitulo}>{c.nome}</T>
              <T style={s.dica}>{c.diaAniversario} de {indClientes.nomeMes.toLowerCase()}</T>
            </View>
            <TouchableOpacity style={[s.acaoPeq, { backgroundColor: cor.verdeClaro }]} onPress={() => parabenizar(c.nome, c.telefone)} accessibilityRole="button">
              <T style={[s.forte, { color: cor.verde }]}>Parabenizar</T>
            </TouchableOpacity>
          </View>
        ))}
      </Gaveta>

      {/* ORGANIZAR */}
      <Gaveta aberta={gaveta === 'organizar'} aoFechar={() => setGaveta(null)} titulo="Organizar painel" subtitulo="Escolha a ordem dos painéis do Início">
        {ordem.map((p, i) => (
          <View key={p} style={[s.linhaEntre, s.borda, { minHeight: 52 }]}>
            <T style={[s.lancTitulo, { flex: 1 }]}>{TITULO[p]}</T>
            <TouchableOpacity style={s.seta} onPress={() => mover(i, -1)} disabled={i === 0} accessibilityLabel={`Subir ${TITULO[p]}`}>
              <Feather name="arrow-up" size={17} color={i === 0 ? cor.apagado : cor.texto} />
            </TouchableOpacity>
            <TouchableOpacity style={s.seta} onPress={() => mover(i, 1)} disabled={i === ordem.length - 1} accessibilityLabel={`Descer ${TITULO[p]}`}>
              <Feather name="arrow-down" size={17} color={i === ordem.length - 1 ? cor.apagado : cor.texto} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Botao rotulo="Restaurar padrão" variante="secundario" aoTocar={restaurar} style={{ flex: 1 }} />
          <Botao rotulo="Salvar" aoTocar={salvarOrdem} style={{ flex: 1 }} />
        </View>
      </Gaveta>

      {detalheId && <DetalhePedidoMobile pedidoId={detalheId} ocultarCustos={rev} aoFechar={() => setDetalheId(null)} aoEditar={() => setDetalheId(null)} />}
      {novoAberto && (
        <NovoPedidoMobile aoFechar={() => setNovoAberto(false)} aoSalvo={(p) => avisar(`Pedido ${p.codigoDisplay} registrado com sucesso!`)} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingRight: 16 },
  data2: { fontSize: 13, fontWeight: '600', color: cor.textoSuave },
  titulo: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  hoje: { marginHorizontal: 16, marginTop: 14, padding: 18, borderRadius: 24, backgroundColor: '#8A5530', gap: 12, ...(Platform.OS === 'web' ? ({ backgroundImage: 'radial-gradient(120% 120% at 85% 0%, #C08550 0%, #8A5530 55%, #6E4426 100%)', experimental_backgroundImage: 'radial-gradient(120% 120% at 85% 0%, #C08550 0%, #8A5530 55%, #6E4426 100%)', boxShadow: '0 30px 50px -30px rgba(40,18,4,.75)' } as object) : {}) },
  hojeRotulo: { fontSize: 13, fontWeight: '600', color: '#ECEBFA' },
  hojeValor: { fontSize: 30, fontWeight: '700', color: '#FFFDFA', letterSpacing: -0.6 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'flex-start' },
  metaTexto: { fontSize: 12, fontWeight: '800', color: '#FFFDFA' },
  metaTrilho: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  metaCheio: { height: '100%', borderRadius: 3, backgroundColor: '#EBD5B8' },
  hojeBotaoBorda: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  hojeBotaoBordaTexto: { fontSize: 13, fontWeight: '800', color: '#FFFDFA' },
  hojeBotao: { flex: 1, height: 46, borderRadius: 23, backgroundColor: cor.creme, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  hojeBotaoTexto: { fontSize: 14, fontWeight: '800', color: cor.carameloTinta },
  secao: { paddingTop: 20 },
  secaoTitulo: { fontSize: 15, fontWeight: '700', color: cor.textoMedio, paddingHorizontal: 20, paddingBottom: 8 },
  lista: { marginHorizontal: 16, backgroundColor: '#FFFDFA', borderRadius: 22, overflow: 'hidden' },
  atencao: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 10, paddingLeft: 16, paddingRight: 14 },
  atencaoIcone: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  borda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  periodo: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 8 },
  kpi: { width: '48.5%', flexGrow: 1, padding: 14, borderRadius: 20, gap: 3 },
  kpiRotulo: { fontSize: 12, fontWeight: '700', color: cor.textoSuave },
  kpiValor: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  kpiNota: { fontSize: 12, fontWeight: '800' },
  kpiSub: { fontSize: 11, color: cor.textoSuave },
  encomendas: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#FFFDFA' },
  painel: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 22, backgroundColor: '#FFFDFA', gap: 12 },
  painelTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  painelTitulo: { fontSize: 15, fontWeight: '700' },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 132 },
  barraCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' },
  barraValor: { fontSize: 10, fontWeight: '700', color: cor.textoSuave },
  barra: { width: '100%', maxWidth: 30, borderRadius: 8 },
  barraDia: { fontSize: 11, fontWeight: '600', color: cor.textoSuave },
  linha3: { flexDirection: 'row', gap: 6 },
  mini: { flex: 1, padding: 10, borderRadius: 14, gap: 2 },
  miniRotulo: { fontSize: 11, fontWeight: '700', color: cor.textoSuave },
  miniValor: { fontSize: 20, fontWeight: '700' },
  miniValorPeq: { fontSize: 13, fontWeight: '800' },
  miniSub: { fontSize: 11, color: cor.textoMedio },
  linhaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  medio: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  forte: { fontSize: 13, fontWeight: '800', color: cor.texto },
  valorGrande: { fontSize: 21, fontWeight: '700' },
  rotulo: { fontSize: 12, fontWeight: '800', color: cor.textoMedio },
  dica: { fontSize: 12, color: cor.textoSuave },
  lancamento: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  data: { width: 54, fontSize: 12, fontWeight: '700', color: cor.textoSuave },
  lancTitulo: { fontSize: 14, fontWeight: '700' },
  lancValor: { fontSize: 13, fontWeight: '800' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medalha: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  medalhaTexto: { fontSize: 13, fontWeight: '800' },
  canal: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: cor.cinzaClaro },
  etq: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  etqTexto: { fontSize: 11, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  campo: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, paddingHorizontal: 12, fontSize: 15, color: cor.texto },
  cronItem: { flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'flex-start' },
  cronHora: { width: 46, fontSize: 13, fontWeight: '800', color: cor.ambar },
  faixa: { padding: 12, borderRadius: 16 },
  trilho: { height: 6, borderRadius: 3, backgroundColor: cor.cinzaClaro, overflow: 'hidden' },
  trilhoCheio: { height: '100%', backgroundColor: '#B9781A' },
  acaoPeq: { height: 38, paddingHorizontal: 12, borderRadius: 19, justifyContent: 'center' },
  dia: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center' },
  seta: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
});
