import { paraCelular } from '@/lib/responsivo';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KipiPalette, Fonts } from '@/constants/theme';
import NovoPedidoModal from '@/components/NovoPedidoModal';
import ProducaoRapidaModal, { type ModoProducaoRapida } from '@/components/ProducaoRapidaModal';
import { usePedidos, useClientes, metricasCliente, encomendasEmAberto, resumoItens, rotuloEntrega } from '@/lib/clientesPedidos';
import { useEscopoRevendedora, pedidosDoEscopo } from '@/lib/minhaRevenda';
import { useEstoqueVitrine, useEstoqueFreezer, produtoAtivo } from '@/lib/estoqueVitrine';
import { useInsumos, useComprasInsumos, demandaDaSemana, custoPorUnidadeEstoque } from '@/lib/insumos';
import { useRevenda, situacaoEstoqueRevendedoras, descreverComissao, labelFormaPagamento } from '@/lib/revenda';
import { useHistoricoProducao } from '@/lib/historicoProducao';
import { useSessao } from '@/lib/acesso';
import { useConfigLoja } from '@/lib/configuracoes';
import {
  calcularKpis,
  intervaloDoPeriodo,
  type PeriodoPainel,
  dadosDoGrafico,
  funilDeEncomendas,
  fluxoDeCaixa,
  topProdutos,
  vendidoOntem,
  indicadoresClientes,
} from '@/lib/indicadores';
import Sidebar from '@/components/Sidebar';

type Periodo = PeriodoPainel;

type CardId =
  | 'grafico_vendas'
  | 'funil_encomendas'
  | 'fluxo_caixa'
  | 'revendedoras'
  | 'insumos_alerta'
  | 'vitrine_zerada'
  | 'top_produtos'
  | 'clientes_fidelidade'
  // Só da revendedora
  | 'acerto_contas'
  | 'estoque_comigo';

interface LayoutConfig {
  mainCards: CardId[];
  sideCards: CardId[];
}

const DEFAULT_LAYOUT: LayoutConfig = {
  mainCards: ['grafico_vendas', 'funil_encomendas', 'fluxo_caixa', 'revendedoras'],
  sideCards: ['insumos_alerta', 'vitrine_zerada', 'top_produtos', 'clientes_fidelidade'],
};

const STORAGE_KEY = '@kipi_dashboard_layout_v2';

// Revendedora: as vendas dela, o acerto com o ateliê, o estoque com ela e os clientes dela
const DEFAULT_LAYOUT_REVENDA: LayoutConfig = {
  mainCards: ['grafico_vendas', 'acerto_contas'],
  sideCards: ['estoque_comigo', 'top_produtos', 'clientes_fidelidade'],
};
const STORAGE_KEY_REVENDA = '@kipi_dashboard_layout_revenda_v1';

const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// CRONOGRAMA DE ENTREGAS (ENCOMENDAS DE HOJE E AMANHÃ, TIRADAS DOS PEDIDOS COMPARTILHADOS)
interface EncomendaCronograma {
  id: string;
  dia: 'hoje' | 'amanha';
  horario: string;
  cliente: string;
  itens: string;
  observacao?: string;
  total: number;
  saldoNaEntrega: number;
}


// LISTA DE COMPRAS: necessário = maior entre a demanda das encomendas da semana e o estoque mínimo
interface InsumoCompra {
  id: string;
  nome: string;
  unidade: string;
  estoque: number;
  minimo: number;
  demandaSemana: number; // consumo previsto pelas encomendas dos próximos 7 dias
  custoUnitario: number;
}


const calcularCompra = (i: InsumoCompra) => {
  const necessario = Math.max(i.demandaSemana, i.minimo);
  const faltaComprar = Number(Math.max(necessario - i.estoque, 0).toFixed(2));
  return { necessario, faltaComprar, custoEstimado: faltaComprar * i.custoUnitario };
};

// EMOJI POR CATEGORIA (CARD DE VITRINE ZERADA)
const EMOJI_CATEGORIA_VG: Record<string, string> = {
  Cookies: '🍪',
  'Bolos & Bentos': '🎂',
  Macarons: '✨',
  Sobremesas: '🍮',
  'Doces Finos': '🍬',
  Presentes: '🎁',
  Folhados: '🥐',
  Bebidas: '☕',
};

const STATUS_FUNIL = {
  a_fazer: { titulo: 'CONFIRMADAS', icone: 'check-circle', cor: '#5798D7', fundo: '#EAF3FA' },
  em_producao: { titulo: 'EM PRODUÇÃO', icone: 'loader', cor: '#708018', fundo: '#F1F6D8' },
  pronto: { titulo: 'PRONTAS', icone: 'box', cor: '#16A34A', fundo: '#DCFCE7' },
} as const;

export default function VisaoGeralScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // ESTADO DO MENU LATERAL (HOVER + FIXAÇÃO)
  const [menuHovered, setMenuHovered] = useState(false);
  const [menuPinned, setMenuPinned] = useState(true);
  const menuExpanded = isDesktop ? (menuPinned || menuHovered) : false;

  // FILTRO DE PERÍODO
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  // PERSONALIZAR: intervalo de datas escolhido (DD/MM/AAAA na tela; AAAA-MM-DD no filtro)
  const [deTxt, setDeTxt] = useState('');
  const [ateTxt, setAteTxt] = useState('');
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null);
  const ehPersonalizado = periodo.startsWith('personalizar');
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
  const aplicarIntervalo = (de: Date, ate: Date) => {
    setDeTxt(paraTela(de));
    setAteTxt(paraTela(ate));
    setErroPeriodo(null);
    setPeriodo(`personalizar:${paraFiltro(de)}:${paraFiltro(ate)}`);
  };
  const aplicarDigitado = () => {
    const de = lerTela(deTxt);
    const ate = lerTela(ateTxt);
    if (!de || !ate) return setErroPeriodo('Use datas no formato DD/MM/AAAA.');
    if (ate < de) return setErroPeriodo('A data final precisa ser depois da inicial.');
    aplicarIntervalo(de, ate);
  };
  const hojeData = new Date();
  const atalhosPeriodo = [
    { rotulo: 'Últimos 15 dias', de: new Date(hojeData.getFullYear(), hojeData.getMonth(), hojeData.getDate() - 14), ate: hojeData },
    { rotulo: 'Últimos 30 dias', de: new Date(hojeData.getFullYear(), hojeData.getMonth(), hojeData.getDate() - 29), ate: hojeData },
    { rotulo: 'Mês passado', de: new Date(hojeData.getFullYear(), hojeData.getMonth() - 1, 1), ate: new Date(hojeData.getFullYear(), hojeData.getMonth(), 0) },
    { rotulo: 'Este ano', de: new Date(hojeData.getFullYear(), 0, 1), ate: hojeData },
  ];
  // Rótulo curto do período (chip dos painéis)
  const rotuloPeriodo = ehPersonalizado
    ? (() => {
        const [, de, ate] = periodo.split(':');
        return de && ate ? `${de.slice(8, 10)}/${de.slice(5, 7)} – ${ate.slice(8, 10)}/${ate.slice(5, 7)}` : 'PERSONALIZADO';
      })()
    : periodo.toUpperCase();

  // MODO DE PERSONALIZAÇÃO / REORDENAÇÃO DE CARDS
  const [editMode, setEditMode] = useState(false);
  // Cada perfil tem seus cards e guarda a sua própria ordem
  const { sessao } = useSessao();
  const layoutPadrao = sessao?.perfil === 'revendedora' ? DEFAULT_LAYOUT_REVENDA : DEFAULT_LAYOUT;
  const chaveLayout = sessao?.perfil === 'revendedora' ? STORAGE_KEY_REVENDA : STORAGE_KEY;
  const [layout, setLayout] = useState<LayoutConfig>(layoutPadrao);
  const [mensagemSalvo, setMensagemSalvo] = useState(false);

  // MODAL DE NOVO PEDIDO E FEEDBACK
  const [modalNovoPedidoAberto, setModalNovoPedidoAberto] = useState(false);
  const [cronogramaAberto, setCronogramaAberto] = useState(false);
  const [toastSucesso, setToastSucesso] = useState<string | null>(null);

  // USUÁRIO LOGADO (sessão de teste)
  const usuario = { nome: sessao?.nome ?? 'Camila Lima' };

  // CARREGAR LAYOUT SALVO DO ASYNCSTORAGE
  useEffect(() => {
    async function carregarLayout() {
      try {
        const salvo = await AsyncStorage.getItem(chaveLayout);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (Array.isArray(parsed.mainCards) && Array.isArray(parsed.sideCards)) {
            // Cards criados depois que o layout foi salvo entram no fim da coluna lateral
            const salvos = new Set<CardId>([...parsed.mainCards, ...parsed.sideCards]);
            const novos = [...layoutPadrao.mainCards, ...layoutPadrao.sideCards].filter((c) => !salvos.has(c));
            // Só os cards do perfil (a revendedora nunca recebe cards do ateliê)
            const doPerfil = (c: CardId) => novos.includes(c) || [...layoutPadrao.mainCards, ...layoutPadrao.sideCards].includes(c);
            setLayout({ mainCards: parsed.mainCards.filter(doPerfil), sideCards: [...parsed.sideCards.filter(doPerfil), ...novos] });
          }
        }
      } catch {
        // Fallback para o layout padrão se houver erro
      }
    }
    carregarLayout();
  }, []);

  // FUNÇÕES DE REORDENAÇÃO DOS CARDS
  const moverCard = (id: CardId, direcao: 'up' | 'down') => {
    setLayout((prev) => {
      const inMain = prev.mainCards.includes(id);
      const list = inMain ? [...prev.mainCards] : [...prev.sideCards];
      const index = list.indexOf(id);
      if (index === -1) return prev;

      const targetIndex = direcao === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;

      // Troca os elementos de posição
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;

      return inMain
        ? { ...prev, mainCards: list }
        : { ...prev, sideCards: list };
    });
  };

  const alternarColuna = (id: CardId) => {
    setLayout((prev) => {
      const inMain = prev.mainCards.includes(id);
      if (inMain) {
        return {
          mainCards: prev.mainCards.filter((c) => c !== id),
          sideCards: [id, ...prev.sideCards],
        };
      } else {
        return {
          sideCards: prev.sideCards.filter((c) => c !== id),
          mainCards: [...prev.mainCards, id],
        };
      }
    });
  };

  const salvarLayout = async () => {
    try {
      await AsyncStorage.setItem(chaveLayout, JSON.stringify(layout));
      setMensagemSalvo(true);
      setTimeout(() => {
        setMensagemSalvo(false);
        setEditMode(false);
      }, 1200);
    } catch {
      setEditMode(false);
    }
  };

  const restaurarPadrao = async () => {
    setLayout(layoutPadrao);
    try {
      await AsyncStorage.removeItem(chaveLayout);
    } catch {}
  };

  // SAUDAÇÃO DINÂMICA BASEADA NO HORÁRIO LOCAL
  const saudacao = useMemo(() => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  // DATA ATUAL FORMATADA
  const dataExtenso = useMemo(() => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    const d = new Date();
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }, []);

  // DADOS COMPARTILHADOS: pedidos, clientes, vitrine e revenda (os números saem deles).
  // Revendedora: só os pedidos e clientes dela; nada do ateliê (custos, outras revendedoras, produção)
  const escopo = useEscopoRevendedora();
  const ehRevendedora = escopo.ehRevendedora;
  const { config } = useConfigLoja();
  const pedidosCompartilhados = pedidosDoEscopo(usePedidos(), escopo.revendedoraId);
  const todosClientes = useClientes();
  const clientesCompartilhados = ehRevendedora
    ? todosClientes
        .filter((c) => c.revendedoraId === escopo.revendedoraId)
        .map((c) => ({ ...c, ...metricasCliente(c, pedidosCompartilhados) }))
    : todosClientes;
  const vitrine = useEstoqueVitrine();
  const freezerVG = useEstoqueFreezer();
  // Produzir lote: abre o modal aqui mesmo (assa se tem massa no freezer; senão prepara)
  const [producaoRapida, setProducaoRapida] = useState<{ id: string; modo: ModoProducaoRapida } | null>(null);
  const revendaAtelie = useRevenda();
  const revendedoras = ehRevendedora ? [] : revendaAtelie.revendedoras;
  const vendasRevenda = ehRevendedora ? [] : revendaAtelie.vendas;
  const entregasRevenda = ehRevendedora ? [] : revendaAtelie.entregas;
  const pagamentosRevenda = ehRevendedora ? [] : revendaAtelie.pagamentos;
  // Estoque que está com cada revendedora (entregue − vendido), com alerta de reposição
  const situacaoRevenda = situacaoEstoqueRevendedoras(revendedoras, entregasRevenda, vendasRevenda);
  const revendedorasEmAlerta = situacaoRevenda.filter((s) => s.emAlerta).length;

  // KPIS DO PERÍODO
  const historicoAtelie = useHistoricoProducao();
  const historicoProducao = ehRevendedora ? [] : historicoAtelie;
  const kpis = calcularKpis(periodo, pedidosCompartilhados, vendasRevenda, revendedoras, historicoProducao);
  // O destaque do banner é sempre o dia de hoje, independente do filtro
  const kpisHoje = calcularKpis('hoje', pedidosCompartilhados, vendasRevenda, revendedoras, historicoProducao);

  // REVENDEDORA: comissão do período e de hoje, acerto com o ateliê e estoque com ela
  const comissaoNoIntervalo = (p: PeriodoPainel) => {
    const { atual } = intervaloDoPeriodo(p);
    return pedidosCompartilhados
      .filter((x) => !x.deletado && new Date(x.data) >= atual.inicio && new Date(x.data) < atual.fim)
      .reduce((acc, x) => acc + escopo.comissaoDoPedido(x), 0);
  };
  const minhaComissao = ehRevendedora ? comissaoNoIntervalo(periodo) : 0;
  const minhaComissaoHoje = ehRevendedora ? comissaoNoIntervalo('hoje') : 0;
  const saborAcabando = escopo.sabores.filter((x) => x.status !== 'abastecido');
  const unidadesComigo = escopo.sabores.reduce((acc, x) => acc + x.saldo, 0);

  // VENDA DIRETA × REVENDA (divisão do faturamento do período por canal)
  const canais = useMemo(() => {
    const diretaTotal = kpis.faturamentoNum - kpis.revendaNum;
    const diretaPedidos = kpis.diretaPedidos;
    const pctDireta = kpis.faturamentoNum > 0 ? Math.round((diretaTotal / kpis.faturamentoNum) * 100) : 0;
    return { diretaTotal, diretaPedidos, pctDireta, pctRevenda: 100 - pctDireta };
  }, [kpis]);

  // ENTREGAS DE HOJE E AMANHÃ: encomendas em aberto dos pedidos compartilhados
  const cronograma: EncomendaCronograma[] = encomendasEmAberto(pedidosCompartilhados).flatMap((p): EncomendaCronograma[] => {
    const rotulo = rotuloEntrega(p.dataEntrega);
    const dia = rotulo.startsWith('Hoje') ? 'hoje' : rotulo.startsWith('Amanhã') ? 'amanha' : null;
    if (!dia) return [];
    return [
      {
        id: p.id,
        dia,
        horario: rotulo.split(' ')[1],
        cliente: p.clienteNome,
        itens: resumoItens(p),
        observacao: p.observacoes ?? undefined,
        total: p.total,
        saldoNaEntrega: p.saldoNaEntrega,
      },
    ];
  });
  const entregasHoje = cronograma.filter((e) => e.dia === 'hoje');
  const entregasAmanha = cronograma.filter((e) => e.dia === 'amanha');

  // LISTA DE COMPRAS DA SEMANA
  const insumosLista = useInsumos();
  // Compras de insumos com valor pago entram no fluxo de caixa
  const comprasInsumos = useComprasInsumos();
  const encomendasDaSemana = encomendasEmAberto(pedidosCompartilhados);
  const listaCompras = insumosLista
    .filter((i) => i.status === 'ativo')
    .map((i) => ({
      id: i.id,
      nome: i.nome,
      unidade: i.unidade,
      estoque: i.quantidadeEstoque,
      minimo: i.estoqueMinimo,
      demandaSemana: Number(demandaDaSemana(i, encomendasDaSemana).toFixed(2)),
      custoUnitario: custoPorUnidadeEstoque(i),
    }))
    .map((i) => ({ ...i, ...calcularCompra(i) }))
    .filter((i) => i.faltaComprar > 0);
  const custoTotalCompras = listaCompras.reduce((acc, i) => acc + i.custoEstimado, 0);

  const copiarListaCompras = () => {
    const texto = [
      '🛒 *LISTA DE COMPRAS DO ATELIÊ:*',
      `Data: ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      ...listaCompras.map(
        (i) => `• ${i.nome}: comprar ${i.faltaComprar.toLocaleString('pt-BR')} ${i.unidade} (estoque: ${i.estoque.toLocaleString('pt-BR')} ${i.unidade})`
      ),
      '',
      `💰 Custo estimado total: ${formatMoney(custoTotalCompras)}`,
    ].join('\n');
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(texto);
    }
    setToastSucesso('✓ Lista de compras copiada para o WhatsApp!');
    setTimeout(() => setToastSucesso(null), 3500);
  };

  // DADOS DO GRÁFICO DE VENDAS (faturamento por faixa do período)
  const dadosGrafico = dadosDoGrafico(periodo, pedidosCompartilhados, vendasRevenda);

  // FUNIL, CAIXA, RANKING, CLIENTES E VITRINE ZERADA (todos calculados dos dados compartilhados)
  const funil = funilDeEncomendas(pedidosCompartilhados);
  const caixa = fluxoDeCaixa(periodo, pedidosCompartilhados, revendedoras, vendasRevenda, pagamentosRevenda, comprasInsumos);
  const ranking = topProdutos(periodo, pedidosCompartilhados, vendasRevenda);
  const indClientes = indicadoresClientes(periodo, clientesCompartilhados, pedidosCompartilhados);
  const vitrineZerada = vitrine
    .filter((p) => produtoAtivo(p) && p.disponibilidade !== 'sob_encomenda' && p.estoque === 0)
    .map((p) => {
      const ontem = vendidoOntem(p.nome, pedidosCompartilhados);
      return {
        id: p.id,
        nome: p.nome,
        emoji: EMOJI_CATEGORIA_VG[p.categoria] ?? '🧁',
        ultimaVenda: ontem > 0 ? `Vendeu ${ontem} ontem` : 'Sem vendas ontem',
      };
    });

  // ITENS DO MENU LATERAL
  const navItems = [
    { id: 'visao-geral', label: 'Visão Geral', icon: 'grid', active: true, route: '/visao-geral' },
    { id: 'pedidos', label: 'Pedidos & Vendas', icon: 'shopping-bag', active: false, route: '/pedidos' },
    { id: 'encomendas', label: 'Encomendas & Cozinha', icon: 'coffee', active: false, route: '/pedidos' },
    { id: 'estoque', label: 'Estoque & Insumos', icon: 'package', active: false },
    { id: 'fichas', label: 'Fichas Técnicas', icon: 'book-open', active: false },
    { id: 'revendedoras', label: 'Revendedoras & Pontos', icon: 'map-pin', active: false },
    { id: 'clientes', label: 'Clientes & Vendas', icon: 'users', active: false },
    { id: 'financeiro', label: 'Fluxo de Caixa', icon: 'dollar-sign', active: false },
    { id: 'config', label: 'Configurações', icon: 'settings', active: false },
  ];

  // COMPONENTES DOS CARDS RENDERIZADOS
  const renderCard = (cardId: CardId) => {
    const editControls = editMode && (
      <View style={styles.reorderBar}>
        <TouchableOpacity
          style={styles.reorderBtn}
          onPress={() => moverCard(cardId, 'up')}
          activeOpacity={0.7}>
          <Text style={styles.reorderBtnText}>▲ Subir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.reorderBtn}
          onPress={() => moverCard(cardId, 'down')}
          activeOpacity={0.7}>
          <Text style={styles.reorderBtnText}>▼ Descer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reorderBtn, styles.reorderBtnCol]}
          onPress={() => alternarColuna(cardId)}
          activeOpacity={0.7}>
          <Text style={styles.reorderBtnColText}>⇄ Mudar Coluna</Text>
        </TouchableOpacity>
      </View>
    );

    switch (cardId) {
      // 1. GRÁFICO DE VENDAS
      case 'grafico_vendas':
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View>
                <View style={styles.panelTitleRow}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.panelTitle}>Vendas no Período</Text>
                  <View style={styles.panelChip}>
                    <Text style={styles.panelChipText}>{rotuloPeriodo}</Text>
                  </View>
                </View>
                <Text style={styles.panelSubtitle}>
                  Acompanhamento de volume financeiro e picos de demanda
                </Text>
              </View>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: KipiPalette.icedDenim }]} />
                  <Text style={styles.legendLabel}>Vendas Concluídas</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: KipiPalette.pistachio }]} />
                  <Text style={styles.legendLabel}>Meta Diária</Text>
                </View>
              </View>
            </View>

            <View style={styles.chartBarsContainer}>
              {dadosGrafico.map((item, idx) => (
                <View key={idx} style={styles.chartBarCol}>
                  <Text style={styles.chartValueLabel}>{item.pct}%</Text>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBarFill,
                        {
                          height: `${Math.max(15, item.pct)}%`,
                          backgroundColor: item.pico
                            ? KipiPalette.pistachio
                            : item.atual
                            ? KipiPalette.icedDenim
                            : '#7BAEE0',
                        },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.chartXTag,
                      item.atual && styles.chartXTagCurrent,
                      item.pico && styles.chartXTagPeak,
                    ]}>
                    <Text
                      style={[
                        styles.chartXText,
                        (item.atual || item.pico) && styles.chartXTextHighlight,
                      ]}>
                      {item.label}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );

      // 2. FUNIL DE ENCOMENDAS
      case 'funil_encomendas':
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View>
                <View style={styles.panelTitleRow}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.panelTitle}>Funil de Encomendas</Text>
                </View>
                <Text style={styles.panelSubtitle}>
                  Status em tempo real das encomendas em fluxo na cozinha
                </Text>
              </View>
              <TouchableOpacity style={styles.panelActionBtn} activeOpacity={0.7} onPress={() => router.push('/producao')}>
                <Text style={styles.panelActionBtnText}>Ver Cozinha →</Text>
              </TouchableOpacity>
            </View>

            {/* Encomendas em aberto por status de produção (mesmas da tela de Produção) */}
            <View style={styles.funnelRow}>
              {funil.map((etapa) => {
                const st = STATUS_FUNIL[etapa.status];
                return (
                  <View key={etapa.status} style={styles.funnelCard}>
                    <View style={styles.funnelCardTop}>
                      <View style={[styles.funnelBadge, { backgroundColor: st.fundo }]}>
                        <Feather name={st.icone} size={14} color={st.cor} />
                        <Text style={[styles.funnelBadgeText, { color: st.cor }]}>{st.titulo}</Text>
                      </View>
                      <Text style={styles.funnelCount}>
                        {etapa.quantidade} {etapa.quantidade === 1 ? 'pedido' : 'pedidos'}
                      </Text>
                    </View>
                    <Text style={styles.funnelTotal}>{formatMoney(etapa.total)}</Text>
                    <View style={styles.funnelOrderSnippet}>
                      {etapa.primeira ? (
                        <>
                          <Text style={styles.funnelCustomerName}>{etapa.primeira.clienteNome}</Text>
                          <Text style={styles.funnelItemTitle}>
                            {resumoItens(etapa.primeira)} (Entrega {rotuloEntrega(etapa.primeira.dataEntrega)})
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.funnelItemTitle}>Nenhuma encomenda nesta etapa.</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );

      // 3. FLUXO DE CAIXA
      case 'fluxo_caixa':
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View>
                <View style={styles.panelTitleRow}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.panelTitle}>Fluxo de Caixa</Text>
                </View>
                <Text style={styles.panelSubtitle}>
                  Saúde financeira, disponibilidades e lançamentos futuros
                </Text>
              </View>
              <View style={[styles.cashStatusBadge, caixa.saldoPrevisto < 0 && { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.cashStatusBadgeText, caixa.saldoPrevisto < 0 && { color: '#DC2626' }]}>
                  {caixa.saldoPrevisto >= 0 ? 'Saldo Positivo' : 'Saldo Negativo'}
                </Text>
              </View>
            </View>

            <View style={styles.cashSummaryRow}>
              <View style={styles.cashBox}>
                <Text style={styles.cashBoxLabel}>SALDO PREVISTO</Text>
                <Text style={styles.cashBoxValuePrimary}>{formatMoney(caixa.saldoPrevisto)}</Text>
                <Text style={styles.cashBoxSub}>
                  Recebido + a receber − a pagar{caixa.comprasPeriodo > 0 ? ` − ${formatMoney(caixa.comprasPeriodo)} em compras` : ''}
                </Text>
              </View>
              <View style={styles.cashBox}>
                <Text style={styles.cashBoxLabel}>RECEBIDO HOJE</Text>
                <Text style={styles.cashBoxValue}>{formatMoney(caixa.recebidoHoje)}</Text>
                <Text style={styles.cashBoxSub}>Pagamentos e sinais de hoje</Text>
              </View>
              <View style={styles.cashBox}>
                <Text style={styles.cashBoxLabel}>A RECEBER</Text>
                <Text style={[styles.cashBoxValue, { color: '#16A34A' }]}>+ {formatMoney(caixa.aReceber)}</Text>
                <Text style={styles.cashBoxSub}>Saldos de pedidos pendentes</Text>
              </View>
              <View style={styles.cashBox}>
                <Text style={styles.cashBoxLabel}>A PAGAR</Text>
                <Text style={[styles.cashBoxValue, { color: '#DC2626' }]}>- {formatMoney(caixa.aPagar)}</Text>
                <Text style={styles.cashBoxSub}>Contas + {formatMoney(caixa.comissoesAPagar)} de comissões</Text>
              </View>
            </View>

            <View style={styles.cashLaunchesArea}>
              <Text style={styles.cashLaunchesTitle}>PRÓXIMOS LANÇAMENTOS (PRÓXIMOS 7 DIAS)</Text>
              <View style={styles.launchesList}>
                {caixa.lancamentos.length === 0 && (
                  <Text style={styles.launchDate}>Nenhum lançamento nos próximos 7 dias.</Text>
                )}
                {caixa.lancamentos.map((l) => {
                  const entrada = l.tipo === 'entrada';
                  return (
                    <View key={l.id} style={styles.launchItem}>
                      <View style={styles.launchLeft}>
                        <View style={[styles.launchIconBox, { backgroundColor: entrada ? '#DCFCE7' : '#FEE2E2' }]}>
                          <Feather name={entrada ? 'arrow-down-left' : 'arrow-up-right'} size={15} color={entrada ? '#16A34A' : '#DC2626'} />
                        </View>
                        <View>
                          <Text style={styles.launchDesc}>{l.descricao}</Text>
                          <Text style={styles.launchDate}>
                            {rotuloEntrega(l.data).split(' ')[0]} • {l.detalhe}
                          </Text>
                        </View>
                      </View>
                      <Text style={entrada ? styles.launchValueIncome : styles.launchValueExpense}>
                        {entrada ? '+' : '-'} {formatMoney(l.valor)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        );

      // 4. VENDAS DOS REVENDEDORES & PONTOS DE VENDA (NOVO!)
      case 'revendedoras':
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View>
                <View style={styles.panelTitleRow}>
                  <View style={[styles.miniAlertIcon, { backgroundColor: '#F1F6D8' }]}>
                    <Feather name="shopping-bag" size={14} color="#708018" />
                  </View>
                  <Text style={styles.panelTitle}>Rede de Revendedoras & Consignação</Text>
                  <View style={[styles.panelChip, { backgroundColor: '#F1F6D8' }]}>
                    <Text style={[styles.panelChipText, { color: '#708018' }]}>
                      {revendedoras.length} {revendedoras.length === 1 ? 'Parceira Ativa' : 'Parceiras Ativas'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.panelSubtitle}>
                  Desempenho de vendas parceiras e monitoramento de estoque externo
                </Text>
              </View>
              <TouchableOpacity
                style={styles.panelActionBtn}
                activeOpacity={0.7}
                onPress={() => router.push('/acessos')}>
                <Text style={styles.panelActionBtnText}>Gerenciar Revenda →</Text>
              </TouchableOpacity>
            </View>

            {/* 3 PILARES DE VENDAS DOS REVENDEDORES */}
            <View style={styles.resellerMetricsRow}>
              <View style={styles.resellerMetricBox}>
                <Text style={styles.resellerMetricLabel}>PARCEIRAS ATIVAS</Text>
                <Text style={styles.resellerMetricNumber}>
                  {revendedoras.length} {revendedoras.length === 1 ? 'ponto' : 'pontos'}
                </Text>
                <Text style={styles.resellerMetricSub}>Cadastradas em Acessos</Text>
              </View>
              <View style={styles.resellerMetricBox}>
                <Text style={styles.resellerMetricLabel}>PRODUTOS VENDIDOS</Text>
                <Text style={[styles.resellerMetricNumber, { color: KipiPalette.icedDenim }]}>
                  {kpis.revendaQtd}
                </Text>
                <Text style={styles.resellerMetricSub}>Consignação ativa</Text>
              </View>
              <View style={styles.resellerMetricBox}>
                <Text style={styles.resellerMetricLabel}>FATURAMENTO REPASSE</Text>
                <Text style={[styles.resellerMetricNumber, { color: '#16A34A' }]}>
                  {kpis.revendaTotal}
                </Text>
                <Text style={styles.resellerMetricSub}>
                  {kpis.revendaPedidos} vendas · {formatMoney(kpis.comissoesRevenda)} em comissões
                </Text>
              </View>
            </View>

            {/* VENDA DIRETA × REVENDA */}
            <View style={styles.channelArea}>
              <Text style={styles.channelTitle}>VENDA DIRETA × REVENDA NO PERÍODO</Text>
              <View style={styles.channelBarTrack}>
                <View style={[styles.channelBarFill, { width: `${canais.pctDireta}%`, backgroundColor: KipiPalette.icedDenim }]} />
                <View style={[styles.channelBarFill, { width: `${canais.pctRevenda}%`, backgroundColor: '#B9C255' }]} />
              </View>
              <View style={styles.channelRow}>
                <View style={styles.channelBox}>
                  <View style={styles.channelBoxHeader}>
                    <View style={[styles.channelDot, { backgroundColor: KipiPalette.icedDenim }]} />
                    <Text style={styles.channelBoxLabel}>Venda direta / balcão</Text>
                  </View>
                  <Text style={styles.channelBoxValue}>{formatMoney(canais.diretaTotal)}</Text>
                  <Text style={styles.channelBoxSub}>
                    {canais.diretaPedidos} vendas · {canais.pctDireta}% do faturamento
                  </Text>
                </View>
                <View style={styles.channelBox}>
                  <View style={styles.channelBoxHeader}>
                    <View style={[styles.channelDot, { backgroundColor: '#B9C255' }]} />
                    <Text style={styles.channelBoxLabel}>Revendedoras (consignação)</Text>
                  </View>
                  <Text style={styles.channelBoxValue}>{formatMoney(kpis.revendaNum)}</Text>
                  <Text style={styles.channelBoxSub}>
                    {kpis.revendaPedidos} vendas · {canais.pctRevenda}% do faturamento
                  </Text>
                </View>
              </View>
            </View>

            {/* ALERTA DE ESTOQUE DAS REVENDEDORAS (entregue − vendido de cada uma) */}
            <View style={styles.resellerStockAlertArea}>
              <View style={styles.resellerAlertHeader}>
                <Feather name="alert-circle" size={15} color={revendedorasEmAlerta > 0 ? '#DC2626' : '#16A34A'} />
                <Text style={styles.resellerAlertTitle}>
                  STATUS DO ESTOQUE NAS REVENDEDORAS ({revendedorasEmAlerta} EM ALERTA DE REPOSIÇÃO)
                </Text>
              </View>

              <View style={styles.resellerAlertList}>
                {situacaoRevenda.slice(0, 3).map((s) => (
                  <View key={s.revendedora.id} style={styles.resellerAlertItem}>
                    <View style={styles.resellerAlertLeft}>
                      <View style={[styles.resellerStatusDot, { backgroundColor: s.emAlerta ? '#DC2626' : '#16A34A' }]} />
                      <View>
                        <Text style={styles.resellerName}>{s.revendedora.nome}</Text>
                        {s.emAlerta ? (
                          <Text style={styles.resellerAlertDesc}>
                            {s.total === 0
                              ? 'Estoque zerado'
                              : `${s.saboresEmFalta} ${s.saboresEmFalta === 1 ? 'sabor precisa' : 'sabores precisam'} de reposição${s.menor ? ` (${s.menor.nome}: ${s.menor.quantidade} un)` : ''}`}
                            {s.diasSemReposicao !== null && (
                              <Text style={{ color: '#DC2626', fontWeight: '700' }}>
                                {' '}• Sem reposição há {s.diasSemReposicao} {s.diasSemReposicao === 1 ? 'dia' : 'dias'}
                              </Text>
                            )}
                          </Text>
                        ) : (
                          <Text style={styles.resellerAlertDesc}>
                            Estoque regular ({s.total} unidades com ela)
                          </Text>
                        )}
                      </View>
                    </View>
                    {s.emAlerta ? (
                      <TouchableOpacity style={styles.resellerActionBtn} activeOpacity={0.8} onPress={() => router.push('/acessos')}>
                        <Text style={styles.resellerActionBtnText}>+ Enviar Remessa</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.resellerOkBadge}>
                        <Text style={styles.resellerOkBadgeText}>Estoque em dia</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        );

      // 5. INSUMOS EM ALERTA (COLUNA LATERAL)
      case 'insumos_alerta':
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleRow}>
                <View style={[styles.miniAlertIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Feather name="alert-triangle" size={14} color="#DC2626" />
                </View>
                <Text style={styles.panelTitle}>O que Comprar</Text>
              </View>
              <Text style={styles.criticalCountBadge}>{listaCompras.length} em falta</Text>
            </View>
            <Text style={styles.purchaseIntro}>
              Calculado pelas encomendas dos próximos 7 dias e pelo estoque mínimo de cada insumo.
            </Text>

            <View style={styles.purchaseTotalBox}>
              <Text style={styles.purchaseTotalLabel}>CUSTO ESTIMADO DAS COMPRAS</Text>
              <Text style={styles.purchaseTotalValue}>{formatMoney(custoTotalCompras)}</Text>
            </View>

            <View style={styles.insumosList}>
              {listaCompras.map((i) => {
                const pct = Math.max(0, Math.min(100, Math.round((i.estoque / i.necessario) * 100)));
                return (
                  <View key={i.id} style={styles.insumoItem}>
                    <View style={styles.insumoTopRow}>
                      <Text style={styles.insumoName}>{i.nome}</Text>
                      <View style={styles.insumoPctBadge}>
                        <Text style={styles.insumoPctText}>{pct}% do necessário</Text>
                      </View>
                    </View>
                    <View style={styles.insumoProgressTrack}>
                      <View
                        style={[
                          styles.insumoProgressFill,
                          { width: `${pct}%`, backgroundColor: pct < 30 ? '#DC2626' : '#F59E0B' },
                        ]}
                      />
                    </View>
                    <Text style={styles.insumoStockText}>
                      Estoque {i.estoque.toLocaleString('pt-BR')} {i.unidade} · Encomendas da semana{' '}
                      {i.demandaSemana.toLocaleString('pt-BR')} {i.unidade} · Mín. {i.minimo.toLocaleString('pt-BR')} {i.unidade}
                    </Text>
                    <View style={styles.insumoBottomRow}>
                      <Text style={styles.purchaseBuyText}>
                        Comprar +{i.faltaComprar.toLocaleString('pt-BR')} {i.unidade}
                      </Text>
                      <Text style={styles.purchaseCostText}>{formatMoney(i.custoEstimado)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.buyOrderBtn} activeOpacity={0.85} onPress={copiarListaCompras}>
              <Feather name="copy" size={15} color="#5798D7" />
              <Text style={styles.buyOrderBtnText}>Copiar lista para WhatsApp</Text>
            </TouchableOpacity>
          </View>
        );

      // VITRINE ZERADA (PRODUTOS DE PRONTA-ENTREGA SEM ESTOQUE)
      case 'vitrine_zerada':
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleRow}>
                <View style={[styles.miniAlertIcon, { backgroundColor: '#FFEDD5' }]}>
                  <Feather name="package" size={14} color="#EA580C" />
                </View>
                <Text style={styles.panelTitle}>Vitrine Zerada</Text>
              </View>
              <Text style={[styles.criticalCountBadge, vitrineZerada.length === 0 && { color: '#16A34A' }]}>
                {vitrineZerada.length} zerados
              </Text>
            </View>
            <Text style={styles.purchaseIntro}>Produtos de pronta-entrega sem estoque para venda.</Text>

            {vitrineZerada.length === 0 ? (
              <Text style={styles.insumoStockText}>Prateleira abastecida! Nenhum produto zerado.</Text>
            ) : (
              <View style={styles.insumosList}>
                {vitrineZerada.map((p) => (
                  <View key={p.id} style={styles.vitrineItem}>
                    <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.insumoName}>{p.nome}</Text>
                      <Text style={styles.insumoStockText}>{p.ultimaVenda}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.orderInsumoBtn}
                      onPress={() => setProducaoRapida({ id: p.id, modo: (freezerVG[p.id] ?? 0) > 0 ? 'assar' : 'preparar' })}
                      activeOpacity={0.8}>
                      <Text style={styles.orderInsumoBtnText}>{(freezerVG[p.id] ?? 0) > 0 ? 'Assar' : 'Produzir lote'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      // 6. TOP 3 PRODUTOS
      case 'top_produtos':
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleRow}>
                <View style={styles.sectionDot} />
                <Text style={styles.panelTitle}>Top 3 Mais Vendidos</Text>
              </View>
              <Text style={styles.panelActionLink}>Ranking</Text>
            </View>

            {/* Ranking do período escolhido (pedidos + vendas das revendedoras) */}
            <View style={styles.rankingList}>
              {ranking.length === 0 && <Text style={styles.rankingProdMeta}>Nenhuma venda no período.</Text>}
              {ranking.map((prod, idx) => (
                <View key={prod.nome} style={styles.rankingItem}>
                  <View style={styles.rankingMedalBox}>
                    <Text style={styles.rankingMedal}>{['🥇', '🥈', '🥉'][idx]}</Text>
                  </View>
                  <View style={styles.rankingInfo}>
                    <Text style={styles.rankingProdName}>{prod.nome}</Text>
                    <Text style={styles.rankingProdMeta}>
                      {prod.qtd} vendidos • {formatMoney(prod.faturamento)}
                    </Text>
                    <View style={styles.rankingBarTrack}>
                      <View
                        style={[
                          styles.rankingBarFill,
                          {
                            width: `${Math.max(8, Math.round((prod.qtd / ranking[0].qtd) * 100))}%`,
                            backgroundColor: [KipiPalette.icedDenim, KipiPalette.pistachio, '#7BAEE0'][idx],
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );

      // 7. CLIENTES & ANIVERSARIANTES
      case 'clientes_fidelidade':
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleRow}>
                <View style={styles.sectionDot} />
                <Text style={styles.panelTitle}>Clientes & Fidelidade</Text>
              </View>
              <View style={[styles.panelChip, { backgroundColor: '#F1F6D8' }]}>
                <Text style={[styles.panelChipText, { color: '#708018' }]}>{indClientes.recompra}% Recompra</Text>
              </View>
            </View>

            {/* Mesmos clientes da tela de Clientes; recompra = clientes com 2 ou mais pedidos */}
            <View style={styles.clientsMetricsRow}>
              <View style={styles.clientMetricCard}>
                <Text style={styles.clientMetricNum}>{indClientes.ativos}</Text>
                <Text style={styles.clientMetricLabel}>Ativos</Text>
              </View>
              <View style={styles.clientMetricCard}>
                <Text style={[styles.clientMetricNum, { color: '#16A34A' }]}>+{indClientes.novos}</Text>
                <Text style={styles.clientMetricLabel}>Novos no Período</Text>
              </View>
              <View style={styles.clientMetricCard}>
                <Text style={[styles.clientMetricNum, { color: KipiPalette.icedDenim }]}>{indClientes.recompra}%</Text>
                <Text style={styles.clientMetricLabel}>Recompra</Text>
              </View>
            </View>

            <View style={styles.bdayArea}>
              <Text style={styles.bdayTitle}>🎂 ANIVERSARIANTES DE {indClientes.nomeMes.toUpperCase()}</Text>
              <View style={styles.bdayList}>
                {indClientes.aniversariantes.length === 0 && (
                  <Text style={styles.bdayDate}>Nenhum aniversariante neste mês.</Text>
                )}
                {indClientes.aniversariantes.slice(0, 3).map((c) => (
                  <View key={c.id} style={styles.bdayItem}>
                    <View style={styles.bdayLeft}>
                      <View style={styles.bdayAvatar}>
                        <Text style={styles.bdayAvatarText}>
                          {c.nome.replace(/^Dra?\.\s*/, '').split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.bdayName}>{c.nome}</Text>
                        <Text style={styles.bdayDate}>
                          {c.diaAniversario} de {indClientes.nomeMes}
                          {c.tag ? ` • ${c.tag}` : ''}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.bdayGiftBtn}>
                      <Text style={styles.bdayGiftBtnText}>Cupom 🎁</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );

      // REVENDEDORA: ACERTO DE CONTAS COM O ATELIÊ (comissão − recebido)
      case 'acerto_contas': {
        const resumo = escopo.resumo;
        const extrato = [
          ...escopo.minhasVendas
            .filter((v) => v.status !== 'cancelado')
            .map((v) => ({ id: v.id, data: v.data, titulo: `Comissão · ${v.cliente || 'Venda sem cliente'}`, valor: escopo.comissao(v) })),
          ...escopo.meusPagamentos.map((p) => ({
            id: p.id,
            data: p.data,
            titulo: `Recebido do ateliê · ${labelFormaPagamento(p.formaPagamento)}`,
            valor: -p.valor,
          })),
        ]
          .sort((a, b) => b.data.localeCompare(a.data))
          .slice(0, 6);
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View>
                <View style={styles.panelTitleRow}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.panelTitle}>Acerto de Contas</Text>
                </View>
                <Text style={styles.panelSubtitle}>
                  {escopo.revendedora ? descreverComissao(escopo.revendedora) : ''} · item em promoção paga metade
                </Text>
              </View>
              <View style={[styles.panelChip, { backgroundColor: (resumo?.saldo ?? 0) > 0 ? '#FEF3C7' : '#DCFCE7' }]}>
                <Text style={[styles.panelChipText, { color: (resumo?.saldo ?? 0) > 0 ? '#B45309' : '#16A34A' }]}>
                  {(resumo?.saldo ?? 0) > 0 ? 'A RECEBER' : 'EM DIA'}
                </Text>
              </View>
            </View>

            <View style={styles.clientsMetricsRow}>
              <View style={styles.clientMetricCard}>
                <Text style={styles.clientMetricNum}>{formatMoney(resumo?.comissao ?? 0)}</Text>
                <Text style={styles.clientMetricLabel}>Comissão total</Text>
              </View>
              <View style={styles.clientMetricCard}>
                <Text style={[styles.clientMetricNum, { color: '#16A34A' }]}>{formatMoney(resumo?.pago ?? 0)}</Text>
                <Text style={styles.clientMetricLabel}>Já recebido</Text>
              </View>
              <View style={styles.clientMetricCard}>
                <Text style={[styles.clientMetricNum, { color: '#D97706' }]}>{formatMoney(Math.max(0, resumo?.saldo ?? 0))}</Text>
                <Text style={styles.clientMetricLabel}>Ateliê me deve</Text>
              </View>
            </View>

            <View style={styles.bdayArea}>
              <Text style={styles.bdayTitle}>ÚLTIMOS LANÇAMENTOS</Text>
              <View style={styles.bdayList}>
                {extrato.length === 0 && <Text style={styles.bdayDate}>Nenhuma venda ainda.</Text>}
                {extrato.map((e) => (
                  <View key={e.id} style={styles.bdayItem}>
                    <View style={styles.bdayLeft}>
                      <View style={[styles.bdayAvatar, { backgroundColor: e.valor >= 0 ? '#EAF3FA' : '#DCFCE7' }]}>
                        <Feather name={e.valor >= 0 ? 'arrow-up-right' : 'arrow-down-left'} size={13} color={e.valor >= 0 ? '#2563EB' : '#16A34A'} />
                      </View>
                      <View style={{ flexShrink: 1 }}>
                        <Text style={styles.bdayName} numberOfLines={1}>{e.titulo}</Text>
                        <Text style={styles.bdayDate}>{new Date(e.data).toLocaleDateString('pt-BR')}</Text>
                      </View>
                    </View>
                    <Text style={[styles.bdayName, { color: e.valor >= 0 ? '#2563EB' : '#16A34A' }]}>
                      {e.valor >= 0 ? '+' : '−'}{formatMoney(Math.abs(e.valor))}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );
      }

      // REVENDEDORA: ESTOQUE QUE ESTÁ COM ELA (entregue pelo ateliê − vendido)
      case 'estoque_comigo':
        return (
          <View key={cardId} style={[styles.panelCard, editMode && styles.panelCardEdit]}>
            {editControls}
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleRow}>
                <View style={styles.sectionDot} />
                <Text style={styles.panelTitle}>Estoque Comigo</Text>
              </View>
              <View style={[styles.panelChip, { backgroundColor: saborAcabando.length > 0 ? '#FEF3C7' : '#DCFCE7' }]}>
                <Text style={[styles.panelChipText, { color: saborAcabando.length > 0 ? '#B45309' : '#16A34A' }]}>
                  {unidadesComigo} UN
                </Text>
              </View>
            </View>
            <View style={styles.bdayList}>
              {escopo.sabores.length === 0 && <Text style={styles.bdayDate}>O ateliê ainda não entregou produtos para você.</Text>}
              {escopo.sabores.map((x) => {
                const st =
                  x.status === 'esgotado'
                    ? { texto: 'Esgotado', cor: '#DC2626', fundo: '#FEE2E2' }
                    : x.status === 'baixo'
                    ? { texto: 'Acabando', cor: '#B45309', fundo: '#FEF3C7' }
                    : { texto: 'Ok', cor: '#16A34A', fundo: '#DCFCE7' };
                return (
                  <View key={x.produtoId || x.nome} style={styles.bdayItem}>
                    <View style={[styles.bdayLeft, { flexShrink: 1 }]}>
                      <View style={styles.bdayAvatar}>
                        <Text style={styles.bdayAvatarText}>{x.saldo}</Text>
                      </View>
                      <View style={{ flexShrink: 1 }}>
                        <Text style={styles.bdayName} numberOfLines={1}>{x.nome}</Text>
                        <Text style={styles.bdayDate}>
                          recebi {x.entregue} · vendi {x.vendido} ·{' '}
                          <Text style={{ fontWeight: '800', color: x.saldo > 0 ? '#0F172A' : '#DC2626' }}>
                            {x.saldo > 0 ? `${x.saldo} disponíve${x.saldo === 1 ? 'l' : 'is'}` : 'nenhum disponível'}
                          </Text>
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.panelChip, { backgroundColor: st.fundo }]}>
                      <Text style={[styles.panelChipText, { color: st.cor }]}>{st.texto}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.mainLayout}>

        {/* =========================================================================
            MENU LATERAL MODULAR E ORGANIZADO POR GRUPOS
        ========================================================================== */}
        <Sidebar
          activeRoute="/visao-geral"
          onNotice={(msg) => setToastSucesso(msg)}
        />

        {/* =========================================================================
            ÁREA DE CONTEÚDO PRINCIPAL (DASHBOARD)
        ========================================================================== */}
        <View style={styles.contentArea}>
          {/* BARRA SUPERIOR DE AÇÕES E STATUS */}
          <View style={styles.topBar}>
            <View style={styles.topBarSearchBox}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.topBarSearchInput}
                placeholder="Buscar receitas, lotes, clientes..."
                placeholderTextColor="#94A3B8"
              />
              <View style={styles.searchShortcutBadge}>
                <Text style={styles.searchShortcutText}>⌘K</Text>
              </View>
            </View>

            <View style={styles.topBarRight}>
              {/* BOTÃO PARA PERSONALIZAR / REORDENAR CARDS */}
              <TouchableOpacity
                style={[styles.customizeLayoutBtn, editMode && styles.customizeLayoutBtnActive]}
                onPress={() => setEditMode(!editMode)}
                activeOpacity={0.8}>
                <Feather
                  name={editMode ? 'check' : 'layout'}
                  size={14}
                  color={editMode ? '#FFFFFF' : KipiPalette.icedDenim}
                />
                <Text
                  style={[
                    styles.customizeLayoutBtnText,
                    editMode && styles.customizeLayoutBtnTextActive,
                  ]}>
                  {editMode ? 'Concluir Edição' : 'Personalizar Layout'}
                </Text>
              </TouchableOpacity>

              <View style={styles.kitchenBadge}>
                <View style={styles.kitchenDot} />
                <Text style={styles.kitchenBadgeText}>Cozinha Aberta • {entregasHoje.length} entregas hoje</Text>
              </View>

              <TouchableOpacity style={styles.iconCircleBtn} activeOpacity={0.8}>
                <Feather name="bell" size={17} color="#475569" />
                <View style={styles.bellAlertDot} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileBadge}
                onPress={() => router.replace('/')}
                activeOpacity={0.85}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{usuario.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{usuario.nome}</Text>
                  <Text style={styles.profileRole}>PROPRIETÁRIA</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* CONTEÚDO SCROLLÁVEL */}
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>

            {/* BANNER DO MODO DE EDIÇÃO SE ATIVO */}
            {editMode && (
              <View style={styles.editModeNoticeBar}>
                <View style={styles.editModeNoticeLeft}>
                  <Feather name="info" size={16} color="#708018" />
                  <Text style={styles.editModeNoticeText}>
                    Modo de Customização: Use os botões ▲ e ▼ para reordenar, ou ⇄ para trocar entre as colunas.
                  </Text>
                </View>
                <View style={styles.editModeNoticeActions}>
                  <TouchableOpacity
                    style={styles.restoreDefaultBtn}
                    onPress={restaurarPadrao}>
                    <Text style={styles.restoreDefaultBtnText}>↺ Restaurar Padrão</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveLayoutBtn}
                    onPress={salvarLayout}>
                    <Text style={styles.saveLayoutBtnText}>
                      {mensagemSalvo ? '✓ Salvo!' : '💾 Salvar Layout'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 1. BANNER: SAUDAÇÃO + FILTRO DE PERÍODO À ESQUERDA; VENDAS DE HOJE, DATA E NOVO PEDIDO À DIREITA */}
            <View style={styles.greetingBanner}>
              <View style={styles.greetingLeft}>
                <View style={styles.chefAvatarBox}>
                  <View style={styles.chefAvatarInner}>
                    <Text style={styles.chefEmoji}>👩‍🍳</Text>
                  </View>
                  <View style={styles.chefStatusDot}>
                    <Text style={styles.chefStatusPlus}>+</Text>
                  </View>
                </View>

                <View style={styles.greetingTextCol}>
                  <View style={styles.greetingTitleRow}>
                    <Text style={styles.greetingTitle}>
                      {saudacao}, {usuario.nome.split(' ')[0]}!
                    </Text>
                    <View style={styles.ovenBadge}>
                      <View style={styles.ovenDot} />
                      <Text style={styles.ovenBadgeText}>
                        {ehRevendedora
                          ? `${unidadesComigo} un com você${saborAcabando.length > 0 ? ` · ${saborAcabando.length} acabando` : ''}`
                          : `${entregasHoje.length} ${entregasHoje.length === 1 ? 'entrega' : 'entregas'} hoje · ${entregasAmanha.length} amanhã`}
                      </Text>
                    </View>
                  </View>

                  {/* Filtro de período: vale para todos os números da tela */}
                  <View style={[styles.periodTabs, styles.periodTabsBanner]}>
                    {(['hoje', 'semana', 'mes', 'personalizar'] as const).map((p) => {
                      const labels = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês', personalizar: 'Personalizar' };
                      const active = p === 'personalizar' ? ehPersonalizado : periodo === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[styles.periodTab, styles.periodTabBanner, active && styles.periodTabActive]}
                          onPress={() => {
                            // Personalizar começa nos últimos 30 dias; as datas ficam editáveis na faixa abaixo
                            if (p === 'personalizar') {
                              if (!ehPersonalizado) aplicarIntervalo(atalhosPeriodo[1].de, atalhosPeriodo[1].ate);
                            } else setPeriodo(p);
                          }}
                          activeOpacity={0.8}>
                          <Text style={[styles.periodTabText, styles.periodTabTextBanner, active && styles.periodTabTextActive]}>{labels[p]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.greetingRight}>
                {/* Vendas de hoje (independe do filtro): faturamento do dia, % da meta diária e lucro estimado */}
                <View style={styles.greetingKpiCard}>
                  <View style={styles.greetingKpiIconBox}>
                    <Feather name="trending-up" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.greetingKpiInfo}>
                    <Text style={styles.greetingKpiTag}>{ehRevendedora ? 'SUAS VENDAS HOJE' : 'VENDAS DE HOJE'}</Text>
                    <Text style={styles.greetingKpiValue}>
                      {kpisHoje.faturamento}{' '}
                      {!ehRevendedora && <Text style={styles.greetingKpiSub}>({kpisHoje.metaPct}% da meta do dia)</Text>}
                    </Text>
                    <Text style={styles.greetingKpiDesc}>
                      {ehRevendedora ? `Sua comissão hoje: ${formatMoney(minhaComissaoHoje)}` : `Lucro estimado hoje: ${kpisHoje.lucroLiquido}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.greetingAcoes}>
                  <View style={styles.calendarPill}>
                    <Feather name="calendar" size={14} color="#64748B" />
                    <Text style={styles.calendarPillText}>{dataExtenso}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={() => setModalNovoPedidoAberto(true)}
                    activeOpacity={0.85}>
                    <Feather name="plus" size={16} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Novo Pedido</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* PERÍODO PERSONALIZADO: datas de/até e atalhos (vale para todos os números da tela) */}
            {ehPersonalizado && (
              <View style={styles.personalizarBar}>
                <Feather name="calendar" size={15} color={KipiPalette.icedDenim} />
                <View style={styles.personalizarCampo}>
                  <Text style={styles.personalizarRotulo}>De</Text>
                  <TextInput
                    style={styles.personalizarInput}
                    value={deTxt}
                    onChangeText={(t) => setDeTxt(mascaraData(t))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    onSubmitEditing={aplicarDigitado}
                  />
                </View>
                <View style={styles.personalizarCampo}>
                  <Text style={styles.personalizarRotulo}>Até</Text>
                  <TextInput
                    style={styles.personalizarInput}
                    value={ateTxt}
                    onChangeText={(t) => setAteTxt(mascaraData(t))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    onSubmitEditing={aplicarDigitado}
                  />
                </View>
                <TouchableOpacity style={styles.personalizarAplicar} onPress={aplicarDigitado} activeOpacity={0.85}>
                  <Text style={styles.personalizarAplicarTexto}>Aplicar</Text>
                </TouchableOpacity>
                <View style={styles.personalizarAtalhos}>
                  {atalhosPeriodo.map((a) => (
                    <TouchableOpacity key={a.rotulo} style={styles.personalizarChip} onPress={() => aplicarIntervalo(a.de, a.ate)}>
                      <Text style={styles.personalizarChipTexto}>{a.rotulo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {erroPeriodo && <Text style={styles.personalizarErro}>{erroPeriodo}</Text>}
              </View>
            )}

            {/* 3. CARDS DE KPIS EM LINHA */}
            <View style={styles.kpiRow}>
              {/* Faturamento Geral */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>{ehRevendedora ? 'MINHAS VENDAS' : 'FATURAMENTO GERAL'}</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#F1F6D8' }]}>
                    <Feather name="dollar-sign" size={15} color="#708018" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.faturamento}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillGreen}>
                    <Text style={styles.kpiDiffPillGreenText}>{kpis.faturamentoDiff}</Text>
                  </View>
                  <Text style={styles.kpiFooterNote}>{ehRevendedora ? kpis.pedidosQtd : `${kpis.metaPct}% da meta`}</Text>
                </View>
              </View>

              {/* Lucro Líquido */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>{ehRevendedora ? 'MINHA COMISSÃO' : 'LUCRO LÍQUIDO'}</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#EAF3FA' }]}>
                    <Feather name="pie-chart" size={15} color="#5798D7" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{ehRevendedora ? formatMoney(minhaComissao) : kpis.lucroLiquido}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillBlue}>
                    <Text style={styles.kpiDiffPillBlueText}>
                      {ehRevendedora ? `${kpis.faturamentoNum > 0 ? Math.round((minhaComissao / kpis.faturamentoNum) * 100) : 0}% das vendas` : kpis.margem}
                    </Text>
                  </View>
                  <Text style={[styles.kpiFooterNote, kpis.perdasNum > 0 && { color: '#DC2626' }]}>
                    {ehRevendedora ? 'Ganho no período' : kpis.perdasNum > 0 ? `🗑 Perdas −${kpis.perdas}` : 'Estimado no período'}
                  </Text>
                </View>
              </View>

              {/* Ticket Médio */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>TICKET MÉDIO</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#F8FAFC' }]}>
                    <Feather name="shopping-bag" size={15} color="#64748B" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.ticketMedio}</Text>
                <View style={styles.kpiFooter}>
                  <Text style={styles.kpiFooterMuted}>{kpis.pedidosQtd}</Text>
                  <Text style={styles.kpiFooterNote}>
                    {ehRevendedora ? 'Por venda' : kpis.revendaPedidos > 0 ? `+ ${kpis.revendaPedidos} da revenda` : 'Vendas diretas'}
                  </Text>
                </View>
              </View>

              {/* A Receber */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>A RECEBER</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <Feather name="clock" size={15} color="#D97706" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.aReceber}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillYellow}>
                    <Text style={styles.kpiDiffPillYellowText}>{kpis.pendentes}</Text>
                  </View>
                  <Text style={styles.kpiFooterNote}>{ehRevendedora ? 'Clientes me devem' : 'Saldos na entrega'}</Text>
                </View>
              </View>

              {/* Encomendas Ativas (clique abre o cronograma de entregas) */}
              {ehRevendedora ? (
                // Revendedora: quanto o ateliê ainda deve de comissão (acerto de contas)
                <View style={styles.kpiCard}>
                  <View style={styles.kpiCardHeader}>
                    <Text style={styles.kpiLabel}>ATELIÊ ME DEVE</Text>
                    <View style={[styles.kpiIconWrap, { backgroundColor: '#DCFCE7' }]}>
                      <Feather name="briefcase" size={15} color="#16A34A" />
                    </View>
                  </View>
                  <Text style={styles.kpiMainNumber}>{formatMoney(Math.max(0, escopo.resumo?.saldo ?? 0))}</Text>
                  <View style={styles.kpiFooter}>
                    <View style={styles.kpiDiffPillGreen}>
                      <Text style={styles.kpiDiffPillGreenText}>Recebido {formatMoney(escopo.resumo?.pago ?? 0)}</Text>
                    </View>
                    <Text style={styles.kpiFooterNote}>Acerto de contas</Text>
                  </View>
                </View>
              ) : (
              <TouchableOpacity
                style={[styles.kpiCard, styles.kpiCardClickable]}
                onPress={() => setCronogramaAberto(true)}
                activeOpacity={0.85}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>ENCOMENDAS ATIVAS</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#EAF3FA' }]}>
                    <Feather name="inbox" size={15} color="#5798D7" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.encomendasAtivas}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillBlue}>
                    <Text style={styles.kpiDiffPillBlueText}>
                      {entregasHoje.length} hoje · {entregasAmanha.length} amanhã
                    </Text>
                  </View>
                  <Text style={[styles.kpiFooterNote, { color: KipiPalette.icedDenim, fontWeight: '700' }]}>
                    Ver cronograma ›
                  </Text>
                </View>
              </TouchableOpacity>
              )}
            </View>

            {/* =====================================================================
                4. GRID PRINCIPAL (REORDENÁVEL PELO USUÁRIO)
            ====================================================================== */}
            <View style={styles.dashboardGrid}>
              {/* COLUNA PRINCIPAL */}
              <View style={styles.gridMainCol}>
                {layout.mainCards.map((cardId) => renderCard(cardId))}
              </View>

              {/* COLUNA LATERAL */}
              <View style={styles.gridSideCol}>
                {layout.sideCards.map((cardId) => renderCard(cardId))}
              </View>
            </View>

            {/* RODAPÉ DO ATELIÊ */}
            <View style={styles.pageFooter}>
              <Text style={styles.pageFooterBrand}>
                ● Kipi Ateliê & Confeitaria • Tecnologia, amor e gestão para seu negócio artesanal
              </Text>
              <View style={styles.pageFooterLinks}>
                <Text style={styles.pageFooterLink}>Termos</Text>
                <Text style={styles.pageFooterLink}>Ajuda & Suporte</Text>
                <Text style={styles.pageFooterLink}>v2.4 Pro</Text>
              </View>
            </View>

          </ScrollView>
        </View>

      </View>

      {/* MODAL DE NOVO PEDIDO COMPLETO */}
      <ProducaoRapidaModal
        visible={producaoRapida !== null}
        produtoId={producaoRapida?.id ?? null}
        modo={producaoRapida?.modo ?? 'preparar'}
        onClose={() => setProducaoRapida(null)}
      />
      <NovoPedidoModal
        visible={modalNovoPedidoAberto}
        onClose={() => setModalNovoPedidoAberto(false)}
        onPedidoCriado={(novo) => {
          setToastSucesso(`✓ Pedido ${novo.codigoDisplay} registrado com sucesso!`);
          setTimeout(() => setToastSucesso(null), 4000);
        }}
      />

      {/* MODAL: CRONOGRAMA DE ENTREGAS (HOJE E AMANHÃ) */}
      <Modal
        visible={cronogramaAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setCronogramaAberto(false)}>
        <View style={styles.scheduleOverlay}>
          <View style={styles.scheduleBox}>
            <View style={styles.scheduleHeader}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#EAF3FA' }]}>
                <Feather name="truck" size={15} color="#5798D7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleTitle}>Cronograma de entregas</Text>
                <Text style={styles.scheduleSubtitle}>
                  Encomendas com horário prometido e situação do pagamento
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCronogramaAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.scheduleScroll}>
              {[
                { titulo: 'HOJE', lista: entregasHoje },
                { titulo: 'AMANHÃ', lista: entregasAmanha },
              ].map((grupo) => (
                <View key={grupo.titulo} style={{ marginBottom: 16 }}>
                  <View style={styles.scheduleGroupHeader}>
                    <Text style={styles.scheduleGroupTitle}>{grupo.titulo}</Text>
                    <Text style={styles.scheduleGroupCount}>
                      {grupo.lista.length} {grupo.lista.length === 1 ? 'entrega' : 'entregas'}
                    </Text>
                  </View>
                  {grupo.lista.length === 0 ? (
                    <Text style={styles.scheduleEmpty}>Nenhuma entrega agendada.</Text>
                  ) : (
                    grupo.lista.map((enc) => {
                      const temSaldo = enc.saldoNaEntrega > 0;
                      return (
                        <View key={enc.id} style={styles.scheduleItem}>
                          <View style={styles.scheduleTimePill}>
                            <Text style={styles.scheduleTimeText}>{enc.horario}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.scheduleClient}>{enc.cliente}</Text>
                            <Text style={styles.scheduleItems}>{enc.itens}</Text>
                            {enc.observacao ? (
                              <Text style={styles.scheduleObs}>"{enc.observacao}"</Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Text style={[styles.schedulePay, { color: temSaldo ? '#D97706' : '#16A34A' }]}>
                              {temSaldo ? `Falta ${formatMoney(enc.saldoNaEntrega)}` : '100% pago'}
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                setCronogramaAberto(false);
                                router.push('/pedidos');
                              }}>
                              <Text style={styles.scheduleLink}>Ver pedido ›</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* TOAST DE FEEDBACK DE SUCESSO */}
      {toastSucesso && (
        <View style={styles.toastSuccess}>
          <Feather name="check-circle" size={18} color="#FFFFFF" />
          <Text style={styles.toastSuccessText}>{toastSucesso}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = paraCelular(StyleSheet.create({
  viewport: {
    flex: 1,
    height: '100%',
    backgroundColor: '#F4F7FB',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    overflow: 'hidden',
  },

  // =========================================================================
  // SIDEBAR ESTILOS (AJUSTE PERFEITO DO ÍCONE ATIVO RETRAÍDO)
  // =========================================================================
  sidebar: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1.5,
    borderRightColor: '#E2E8F0',
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 12,
    zIndex: 100,
    ...Platform.select({
      web: {
        transition: 'width 0.22s ease-in-out',
      },
    }),
  },
  sidebarExpanded: {
    width: 230,
  },
  sidebarCollapsed: {
    width: 68,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EAF3FA',
    borderWidth: 1.5,
    borderColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeLetter: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  brandInfo: {
    flex: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  saasTag: {
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  saasTagText: {
    fontFamily: Fonts.sans,
    fontSize: 8,
    fontWeight: '800',
    color: '#708018',
  },
  brandSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
  },
  sidebarNav: {
    flex: 1,
  },
  sidebarNavContent: {
    gap: 8,
    alignItems: 'stretch',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  // O INDICADOR QUANDO O MENU ESTÁ RECOLHIDO: QUADRADINHO PERFEITO E ENVOLVENTE
  navItemCollapsed: {
    width: 42,
    height: 42,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  navItemActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  navItemActiveCollapsed: {
    backgroundColor: KipiPalette.icedDenim,
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  navItemText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  navItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sidebarFooter: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  pinBtnActive: {
    backgroundColor: '#EAF3FA',
  },
  pinBtnCollapsed: {
    width: 42,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    alignSelf: 'center',
  },
  pinBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  userMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  userMiniCardCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    alignSelf: 'center',
  },
  userMiniAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: KipiPalette.icedDenimLight,
    borderWidth: 1.5,
    borderColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMiniAvatarLetter: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  userMiniInfo: {
    flex: 1,
  },
  userMiniName: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  userMiniRole: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
  },

  // =========================================================================
  // ÁREA DE CONTEÚDO
  // =========================================================================
  contentArea: {
    flex: 1,
    height: '100%',
    backgroundColor: '#F4F7FB',
  },
  topBar: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  topBarSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    width: 320,
    gap: 8,
  },
  topBarSearchInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#0F172A',
    outlineWidth: 0,
  },
  searchShortcutBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  searchShortcutText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customizeLayoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAF3FA',
    borderWidth: 1.5,
    borderColor: '#B6D6F4',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  customizeLayoutBtnActive: {
    backgroundColor: KipiPalette.icedDenim,
    borderColor: KipiPalette.icedDenim,
  },
  customizeLayoutBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  customizeLayoutBtnTextActive: {
    color: '#FFFFFF',
  },
  kitchenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  kitchenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#708018',
  },
  kitchenBadgeText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#708018',
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellAlertDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: KipiPalette.icedDenimLight,
    borderWidth: 1.5,
    borderColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  profileInfo: {
    gap: 1,
  },
  profileName: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  profileRole: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },

  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 20,
  },

  // BARRA DE AVISO DO MODO DE EDIÇÃO
  editModeNoticeBar: {
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  editModeNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  editModeNoticeText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#46500F',
    fontWeight: '600',
  },
  editModeNoticeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restoreDefaultBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B9C255',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  restoreDefaultBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#708018',
  },
  saveLayoutBtn: {
    backgroundColor: KipiPalette.icedDenim,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  saveLayoutBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // CONTROLES DE REORDENAÇÃO DENTRO DO CARD
  reorderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
  },
  reorderBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  reorderBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  reorderBtnCol: {
    backgroundColor: '#EAF3FA',
  },
  reorderBtnColText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },

  // =========================================================================
  // BANNER DE SAUDAÇÃO
  // =========================================================================
  greetingBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  greetingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 320,
  },
  chefAvatarBox: {
    position: 'relative',
  },
  chefAvatarInner: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chefEmoji: {
    fontSize: 30,
  },
  chefStatusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#84CC16',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chefStatusPlus: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  greetingTextCol: {
    gap: 3,
    flex: 1,
  },
  greetingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  greetingTitle: {
    fontFamily: Fonts.sans,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  ovenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ovenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#84CC16',
  },
  ovenBadgeText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#708018',
  },
  greetingDescription: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#475569',
  },
  greetingTipLink: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: KipiPalette.icedDenim,
  },
  greetingRight: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    flexWrap: 'wrap',
  },
  greetingAcoes: {
    justifyContent: 'space-between',
    gap: 8,
  },
  periodTabsBanner: {
    alignSelf: 'flex-start',
    marginTop: 8,
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  periodTabBanner: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  periodTabTextBanner: {
    fontSize: 12,
  },
  personalizarBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  personalizarCampo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  personalizarRotulo: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', color: '#64748B' },
  personalizarInput: {
    width: 110,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  personalizarAplicar: { backgroundColor: KipiPalette.icedDenim, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  personalizarAplicarTexto: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  personalizarAtalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 'auto' },
  personalizarChip: { backgroundColor: '#F1F5F9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  personalizarChipTexto: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', color: '#475569' },
  personalizarErro: { width: '100%', fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', color: '#DC2626' },
  greetingKpiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
    minWidth: 280,
  },
  greetingKpiIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingKpiInfo: {
    flex: 1,
    gap: 2,
  },
  greetingKpiTag: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  greetingKpiValue: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  greetingKpiSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  greetingKpiDesc: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },
  greetingKpiBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
  },
  greetingKpiBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },

  // =========================================================================
  // FILTROS
  // =========================================================================
  filtersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  periodTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  periodTab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  periodTabActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  periodTabText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calendarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  calendarPillText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: KipiPalette.icedDenim,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 16,
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryActionBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // =========================================================================
  // KPIS EM LINHA
  // =========================================================================
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 8,
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  kpiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiMainNumber: {
    fontFamily: Fonts.sans,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  kpiFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  kpiDiffPillGreen: {
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiDiffPillGreenText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#708018',
  },
  kpiDiffPillBlue: {
    backgroundColor: '#EAF3FA',
    borderColor: '#B6D6F4',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiDiffPillBlueText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  kpiDiffPillYellow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiDiffPillYellowText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  kpiFooterNote: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#94A3B8',
  },
  kpiFooterMuted: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // =========================================================================
  // GRID PRINCIPAL
  // =========================================================================
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  gridMainCol: {
    flex: 1.8,
    minWidth: 340,
    gap: 20,
  },
  gridSideCol: {
    flex: 1,
    minWidth: 300,
    gap: 20,
  },

  panelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 20,
    gap: 16,
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  panelCardEdit: {
    borderColor: KipiPalette.icedDenim,
    borderStyle: 'dashed',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: KipiPalette.icedDenim,
  },
  miniAlertIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  panelSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  panelChip: {
    backgroundColor: '#EAF3FA',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  panelChipText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  panelActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  panelActionBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  panelActionLink: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },

  // GRÁFICO DE BARRAS
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },
  chartBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 190,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartValueLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  chartBarTrack: {
    width: 32,
    height: 125,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 8,
  },
  chartXTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  chartXTagCurrent: {
    backgroundColor: '#EAF3FA',
  },
  chartXTagPeak: {
    backgroundColor: '#F1F6D8',
  },
  chartXText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  chartXTextHighlight: {
    color: '#0F172A',
    fontWeight: '800',
  },

  // FUNIL DE ENCOMENDAS
  funnelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  funnelCard: {
    flex: 1,
    minWidth: 170,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  funnelCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  funnelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  funnelBadgeText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '800',
  },
  funnelCount: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  funnelTotal: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  funnelOrderSnippet: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  funnelCustomerName: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  funnelItemTitle: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
  },

  // FLUXO DE CAIXA
  cashStatusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cashStatusBadgeText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  cashSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cashBox: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 3,
  },
  cashBoxLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  cashBoxValuePrimary: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  cashBoxValue: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  cashBoxSub: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#94A3B8',
  },
  cashLaunchesArea: {
    gap: 10,
    paddingTop: 8,
  },
  cashLaunchesTitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  launchesList: {
    gap: 8,
  },
  launchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  launchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  launchIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchDesc: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  launchDate: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#94A3B8',
  },
  launchValueExpense: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  launchValueIncome: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
  },

  // =========================================================================
  // NOVO: CARD DE REVENDEDORAS & CONSIGNAÇÃO
  // =========================================================================
  resellerMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  resellerMetricBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 3,
  },
  resellerMetricLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  resellerMetricNumber: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  resellerMetricSub: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
  },
  resellerStockAlertArea: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  resellerAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resellerAlertTitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.4,
  },
  resellerAlertList: {
    gap: 8,
  },
  resellerAlertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  resellerAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 240,
  },
  resellerStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resellerName: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  resellerAlertDesc: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },
  resellerActionBtn: {
    backgroundColor: '#EAF3FA',
    borderWidth: 1,
    borderColor: '#B6D6F4',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resellerActionBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  resellerOkBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  resellerOkBadgeText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },

  // SIDEBAR DIREITA: INSUMOS
  criticalCountBadge: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  insumosList: {
    gap: 12,
  },
  insumoItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  insumoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insumoName: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  insumoPctBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  insumoPctText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  insumoProgressTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  insumoProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  insumoBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insumoStockText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },
  orderInsumoBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
  },
  orderInsumoBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  buyOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EAF3FA',
    borderWidth: 1.5,
    borderColor: '#B6D6F4',
    borderRadius: 12,
    height: 40,
  },
  buyOrderBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },

  // TOP 3 MAIS VENDIDOS
  rankingList: {
    gap: 10,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  rankingMedalBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingMedal: {
    fontSize: 16,
  },
  rankingInfo: {
    flex: 1,
    gap: 3,
  },
  rankingProdName: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  rankingProdMeta: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },
  rankingBarTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  rankingBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // CLIENTES & FIDELIDADE
  clientsMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  clientMetricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  clientMetricNum: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  clientMetricLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  bdayArea: {
    gap: 8,
    paddingTop: 4,
  },
  bdayTitle: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  bdayList: {
    gap: 8,
  },
  bdayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  bdayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bdayAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F6D8',
    borderWidth: 1,
    borderColor: '#B9C255',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bdayAvatarText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#708018',
  },
  bdayName: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  bdayDate: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
  },
  bdayGiftBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
  },
  bdayGiftBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },

  // FOOTER DA PÁGINA
  pageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 10,
    gap: 10,
  },
  pageFooterBrand: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },
  pageFooterLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pageFooterLink: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  // KPI CLICÁVEL (ENCOMENDAS ATIVAS)
  kpiCardClickable: {
    borderColor: '#BFDBFE',
  },

  // VENDA DIRETA × REVENDA
  channelArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  channelTitle: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  channelBarTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  channelBarFill: {
    height: '100%',
  },
  channelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  channelBox: {
    flex: 1,
    minWidth: 180,
    gap: 2,
  },
  channelBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  channelBoxLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  channelBoxValue: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  channelBoxSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },

  // O QUE COMPRAR / VITRINE ZERADA
  purchaseIntro: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
    marginTop: -4,
  },
  purchaseTotalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  purchaseTotalLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  purchaseTotalValue: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
  },
  purchaseBuyText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  purchaseCostText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  vitrineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },

  // MODAL CRONOGRAMA DE ENTREGAS
  scheduleOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scheduleBox: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  scheduleTitle: {
    fontFamily: Fonts.display,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  scheduleSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  scheduleScroll: {
    padding: 18,
  },
  scheduleGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scheduleGroupTitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#3E7BB8',
    letterSpacing: 0.8,
  },
  scheduleGroupCount: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  scheduleEmpty: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#94A3B8',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  scheduleTimePill: {
    backgroundColor: '#EAF3FA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scheduleTimeText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  scheduleClient: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  scheduleItems: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  scheduleObs: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontStyle: 'italic',
    color: '#64748B',
    marginTop: 2,
  },
  schedulePay: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
  },
  scheduleLink: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#5798D7',
  },

  toastSuccess: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#16A34A',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 9999,
  },
  toastSuccessText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
}));
