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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { KipiPalette, Fonts } from '@/constants/theme';
import NovoPedidoModal from '@/components/NovoPedidoModal';

type Periodo = 'hoje' | 'semana' | 'mes' | 'personalizar';

type CardId =
  | 'grafico_vendas'
  | 'funil_encomendas'
  | 'fluxo_caixa'
  | 'revendedoras'
  | 'insumos_alerta'
  | 'top_produtos'
  | 'clientes_fidelidade';

interface LayoutConfig {
  mainCards: CardId[];
  sideCards: CardId[];
}

const DEFAULT_LAYOUT: LayoutConfig = {
  mainCards: ['grafico_vendas', 'funil_encomendas', 'fluxo_caixa', 'revendedoras'],
  sideCards: ['insumos_alerta', 'top_produtos', 'clientes_fidelidade'],
};

const STORAGE_KEY = '@kipi_dashboard_layout_v2';

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

  // MODO DE PERSONALIZAÇÃO / REORDENAÇÃO DE CARDS
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT);
  const [mensagemSalvo, setMensagemSalvo] = useState(false);

  // MODAL DE NOVO PEDIDO E FEEDBACK
  const [modalNovoPedidoAberto, setModalNovoPedidoAberto] = useState(false);
  const [toastSucesso, setToastSucesso] = useState<string | null>(null);

  // USUÁRIO LOGADO (PADRÃO: CAMILA LIMA)
  const [usuario] = useState({
    nome: 'Camila Lima',
    papel: 'Proprietária',
    email: 'camila.c.lima08@gmail.com',
  });

  // CARREGAR LAYOUT SALVO DO ASYNCSTORAGE
  useEffect(() => {
    async function carregarLayout() {
      try {
        const salvo = await AsyncStorage.getItem(STORAGE_KEY);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (Array.isArray(parsed.mainCards) && Array.isArray(parsed.sideCards)) {
            setLayout(parsed);
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
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
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
    setLayout(DEFAULT_LAYOUT);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
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

  // DADOS REATIVOS POR PERÍODO (KPIS)
  const kpis = useMemo(() => {
    switch (periodo) {
      case 'hoje':
        return {
          faturamento: 'R$ 2.840,00',
          faturamentoDiff: '+18% vs ontem',
          lucroLiquido: 'R$ 1.420,00',
          margem: '50% margem',
          ticketMedio: 'R$ 94,60',
          pedidosQtd: '30 pedidos',
          aReceber: 'R$ 680,00',
          pendentes: '3 pendentes',
          encomendasAtivas: '8 pedidos',
          encomendasNovas: '+2 novas',
          metaPct: 84,
          revendaTotal: 'R$ 820,00',
          revendaQtd: '48 un. vendidas',
        };
      case 'mes':
        return {
          faturamento: 'R$ 62.480,00',
          faturamentoDiff: '+24% vs mês anterior',
          lucroLiquido: 'R$ 31.240,00',
          margem: '50% margem',
          ticketMedio: 'R$ 98,20',
          pedidosQtd: '636 pedidos',
          aReceber: 'R$ 4.890,00',
          pendentes: '12 pendentes',
          encomendasAtivas: '24 pedidos',
          encomendasNovas: '+9 novas',
          metaPct: 92,
          revendaTotal: 'R$ 18.940,00',
          revendaQtd: '1.120 un. vendidas',
        };
      case 'personalizar':
        return {
          faturamento: 'R$ 28.950,00',
          faturamentoDiff: 'Período customizado',
          lucroLiquido: 'R$ 14.475,00',
          margem: '50% margem',
          ticketMedio: 'R$ 92,50',
          pedidosQtd: '312 pedidos',
          aReceber: 'R$ 2.340,00',
          pendentes: '6 pendentes',
          encomendasAtivas: '14 pedidos',
          encomendasNovas: '+4 novas',
          metaPct: 88,
          revendaTotal: 'R$ 8.650,00',
          revendaQtd: '510 un. vendidas',
        };
      case 'semana':
      default:
        return {
          faturamento: 'R$ 16.480,00',
          faturamentoDiff: '+14% vs semana passada',
          lucroLiquido: 'R$ 8.240,00',
          margem: '50% margem',
          ticketMedio: 'R$ 96,40',
          pedidosQtd: '171 pedidos',
          aReceber: 'R$ 2.450,00',
          pendentes: '7 pendentes',
          encomendasAtivas: '12 pedidos',
          encomendasNovas: '+5 novas',
          metaPct: 86,
          revendaTotal: 'R$ 4.820,00',
          revendaQtd: '286 un. vendidas',
        };
    }
  }, [periodo]);

  // DADOS DO GRÁFICO DE VENDAS
  const dadosGrafico = useMemo(() => {
    switch (periodo) {
      case 'hoje':
        return [
          { label: '08h', valor: 280, pct: 35 },
          { label: '10h', valor: 640, pct: 65 },
          { label: '12h', valor: 890, pct: 90, pico: true },
          { label: '14h', valor: 520, pct: 55 },
          { label: '16h', valor: 380, pct: 40 },
          { label: '18h', valor: 130, pct: 20 },
        ];
      case 'mes':
        return [
          { label: 'Sem 1', valor: 14200, pct: 72 },
          { label: 'Sem 2', valor: 16800, pct: 85 },
          { label: 'Sem 3 (Pico)', valor: 19400, pct: 100, pico: true },
          { label: 'Sem 4', valor: 12080, pct: 62 },
        ];
      case 'personalizar':
        return [
          { label: 'Bloco A', valor: 7200, pct: 60 },
          { label: 'Bloco B', valor: 9800, pct: 82 },
          { label: 'Bloco C', valor: 11950, pct: 100, pico: true },
        ];
      case 'semana':
      default:
        return [
          { label: 'Seg', valor: 1980, pct: 58 },
          { label: 'Ter', valor: 2840, pct: 85, atual: true },
          { label: 'Qua', valor: 1750, pct: 52 },
          { label: 'Qui', valor: 2280, pct: 68 },
          { label: 'Sex (Pico)', valor: 3950, pct: 100, pico: true },
          { label: 'Sáb', valor: 3680, pct: 92 },
        ];
    }
  }, [periodo]);

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
                    <Text style={styles.panelChipText}>{periodo.toUpperCase()}</Text>
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
              <TouchableOpacity style={styles.panelActionBtn} activeOpacity={0.7}>
                <Text style={styles.panelActionBtnText}>Ver Cozinha →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.funnelRow}>
              {/* Confirmadas */}
              <View style={styles.funnelCard}>
                <View style={styles.funnelCardTop}>
                  <View style={[styles.funnelBadge, { backgroundColor: '#EAF3FA' }]}>
                    <Feather name="check-circle" size={14} color="#5798D7" />
                    <Text style={[styles.funnelBadgeText, { color: '#5798D7' }]}>CONFIRMADAS</Text>
                  </View>
                  <Text style={styles.funnelCount}>4 pedidos</Text>
                </View>
                <Text style={styles.funnelTotal}>R$ 1.480,00</Text>
                <View style={styles.funnelOrderSnippet}>
                  <Text style={styles.funnelCustomerName}>Mariana Albuquerque</Text>
                  <Text style={styles.funnelItemTitle}>Bolo Floral 3 andares (Entrega 14h)</Text>
                </View>
              </View>

              {/* Em Produção */}
              <View style={styles.funnelCard}>
                <View style={styles.funnelCardTop}>
                  <View style={[styles.funnelBadge, { backgroundColor: '#F1F6D8' }]}>
                    <Feather name="loader" size={14} color="#708018" />
                    <Text style={[styles.funnelBadgeText, { color: '#708018' }]}>EM PRODUÇÃO</Text>
                  </View>
                  <Text style={styles.funnelCount}>3 pedidos</Text>
                </View>
                <Text style={styles.funnelTotal}>R$ 960,00</Text>
                <View style={styles.funnelOrderSnippet}>
                  <Text style={styles.funnelCustomerName}>Ateliê do Chocolate</Text>
                  <Text style={styles.funnelItemTitle}>100 Brigadeiros Pistache (Montagem)</Text>
                </View>
              </View>

              {/* Prontas */}
              <View style={styles.funnelCard}>
                <View style={styles.funnelCardTop}>
                  <View style={[styles.funnelBadge, { backgroundColor: '#DCFCE7' }]}>
                    <Feather name="box" size={14} color="#16A34A" />
                    <Text style={[styles.funnelBadgeText, { color: '#16A34A' }]}>PRONTAS</Text>
                  </View>
                  <Text style={styles.funnelCount}>2 pedidos</Text>
                </View>
                <Text style={styles.funnelTotal}>R$ 400,00</Text>
                <View style={styles.funnelOrderSnippet}>
                  <Text style={styles.funnelCustomerName}>Lucas Silveira</Text>
                  <Text style={styles.funnelItemTitle}>Bento Cake Minimalista (Balcão)</Text>
                </View>
              </View>
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
              <View style={styles.cashStatusBadge}>
                <Text style={styles.cashStatusBadgeText}>Saldo Positivo</Text>
              </View>
            </View>

            <View style={styles.cashSummaryRow}>
              <View style={styles.cashBox}>
                <Text style={styles.cashBoxLabel}>SALDO PREVISTO</Text>
                <Text style={styles.cashBoxValuePrimary}>R$ 18.450,00</Text>
                <Text style={styles.cashBoxSub}>Fim do período</Text>
              </View>
              <View style={styles.cashBox}>
                <Text style={styles.cashBoxLabel}>HOJE EM CAIXA</Text>
                <Text style={styles.cashBoxValue}>R$ 4.280,00</Text>
                <Text style={styles.cashBoxSub}>Disponível agora</Text>
              </View>
              <View style={styles.cashBox}>
                <Text style={styles.cashBoxLabel}>A RECEBER</Text>
                <Text style={[styles.cashBoxValue, { color: '#16A34A' }]}>+ R$ 3.820,00</Text>
                <Text style={styles.cashBoxSub}>Entregas agendadas</Text>
              </View>
              <View style={styles.cashBox}>
                <Text style={styles.cashBoxLabel}>A PAGAR</Text>
                <Text style={[styles.cashBoxValue, { color: '#DC2626' }]}>- R$ 1.950,00</Text>
                <Text style={styles.cashBoxSub}>Fornecedores e contas</Text>
              </View>
            </View>

            <View style={styles.cashLaunchesArea}>
              <Text style={styles.cashLaunchesTitle}>PRÓXIMOS LANÇAMENTOS (PRÓXIMOS 7 DIAS)</Text>
              <View style={styles.launchesList}>
                <View style={styles.launchItem}>
                  <View style={styles.launchLeft}>
                    <View style={[styles.launchIconBox, { backgroundColor: '#FEE2E2' }]}>
                      <Feather name="arrow-up-right" size={15} color="#DC2626" />
                    </View>
                    <View>
                      <Text style={styles.launchDesc}>Fornecedor Embalagens Kraft & Fitas</Text>
                      <Text style={styles.launchDate}>Vence amanhã • Pagamento via Boleto</Text>
                    </View>
                  </View>
                  <Text style={styles.launchValueExpense}>- R$ 480,00</Text>
                </View>

                <View style={styles.launchItem}>
                  <View style={styles.launchLeft}>
                    <View style={[styles.launchIconBox, { backgroundColor: '#DCFCE7' }]}>
                      <Feather name="arrow-down-left" size={15} color="#16A34A" />
                    </View>
                    <View>
                      <Text style={styles.launchDesc}>Casamento Mariana (Saldo Restante 50%)</Text>
                      <Text style={styles.launchDate}>Quinta-feira • Pix na Entrega</Text>
                    </View>
                  </View>
                  <Text style={styles.launchValueIncome}>+ R$ 1.200,00</Text>
                </View>

                <View style={styles.launchItem}>
                  <View style={styles.launchLeft}>
                    <View style={[styles.launchIconBox, { backgroundColor: '#FEE2E2' }]}>
                      <Feather name="arrow-up-right" size={15} color="#DC2626" />
                    </View>
                    <View>
                      <Text style={styles.launchDesc}>Morangos e Frutas Vermelhas Orgânicas</Text>
                      <Text style={styles.launchDate}>Sexta-feira • Fornecedor Sítio da Serra</Text>
                    </View>
                  </View>
                  <Text style={styles.launchValueExpense}>- R$ 180,00</Text>
                </View>
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
                    <Text style={[styles.panelChipText, { color: '#708018' }]}>8 Parceiras Ativas</Text>
                  </View>
                </View>
                <Text style={styles.panelSubtitle}>
                  Desempenho de vendas parceiras e monitoramento de estoque externo
                </Text>
              </View>
              <TouchableOpacity style={styles.panelActionBtn} activeOpacity={0.7}>
                <Text style={styles.panelActionBtnText}>Gerenciar Revenda →</Text>
              </TouchableOpacity>
            </View>

            {/* 3 PILARES DE VENDAS DOS REVENDEDORES */}
            <View style={styles.resellerMetricsRow}>
              <View style={styles.resellerMetricBox}>
                <Text style={styles.resellerMetricLabel}>PARCEIRAS ATIVAS</Text>
                <Text style={styles.resellerMetricNumber}>8 pontos</Text>
                <Text style={styles.resellerMetricSub}>+2 cadastradas no mês</Text>
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
                <Text style={styles.resellerMetricSub}>Comissão média 20%</Text>
              </View>
            </View>

            {/* ALERTA DE ESTOQUE DAS REVENDEDORAS */}
            <View style={styles.resellerStockAlertArea}>
              <View style={styles.resellerAlertHeader}>
                <Feather name="alert-circle" size={15} color="#DC2626" />
                <Text style={styles.resellerAlertTitle}>
                  STATUS DO ESTOQUE NAS REVENDEDORAS (2 EM ALERTA DE REPOSIÇÃO)
                </Text>
              </View>

              <View style={styles.resellerAlertList}>
                {/* Revendedora 1 */}
                <View style={styles.resellerAlertItem}>
                  <View style={styles.resellerAlertLeft}>
                    <View style={[styles.resellerStatusDot, { backgroundColor: '#DC2626' }]} />
                    <View>
                      <Text style={styles.resellerName}>Café & Flor Bistrô (Bancada Central)</Text>
                      <Text style={styles.resellerAlertDesc}>
                        Restam apenas 3 Cookies Duo • <Text style={{ color: '#DC2626', fontWeight: '700' }}>Crítico (12% restante)</Text>
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.resellerActionBtn} activeOpacity={0.8}>
                    <Text style={styles.resellerActionBtnText}>+ Enviar Remessa</Text>
                  </TouchableOpacity>
                </View>

                {/* Revendedora 2 */}
                <View style={styles.resellerAlertItem}>
                  <View style={styles.resellerAlertLeft}>
                    <View style={[styles.resellerStatusDot, { backgroundColor: '#DC2626' }]} />
                    <View>
                      <Text style={styles.resellerName}>Boutique Doce Charme</Text>
                      <Text style={styles.resellerAlertDesc}>
                        Estoque zerado de Bento Cakes • <Text style={{ color: '#DC2626', fontWeight: '700' }}>Sem reposição há 5 dias</Text>
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.resellerActionBtn} activeOpacity={0.8}>
                    <Text style={styles.resellerActionBtnText}>+ Enviar Remessa</Text>
                  </TouchableOpacity>
                </View>

                {/* Revendedora 3 */}
                <View style={styles.resellerAlertItem}>
                  <View style={styles.resellerAlertLeft}>
                    <View style={[styles.resellerStatusDot, { backgroundColor: '#16A34A' }]} />
                    <View>
                      <Text style={styles.resellerName}>Empório dos Sabores Artesanais</Text>
                      <Text style={styles.resellerAlertDesc}>
                        Estoque regular (32 unidades disponíveis) • Vendeu 18 ontem
                      </Text>
                    </View>
                  </View>
                  <View style={styles.resellerOkBadge}>
                    <Text style={styles.resellerOkBadgeText}>Estoque em dia</Text>
                  </View>
                </View>
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
                <Text style={styles.panelTitle}>Insumos em Alerta</Text>
              </View>
              <Text style={styles.criticalCountBadge}>3 críticos</Text>
            </View>

            <View style={styles.insumosList}>
              <View style={styles.insumoItem}>
                <View style={styles.insumoTopRow}>
                  <Text style={styles.insumoName}>Farinha de Amêndoa Pura (França)</Text>
                  <View style={styles.insumoPctBadge}>
                    <Text style={styles.insumoPctText}>15% restante</Text>
                  </View>
                </View>
                <View style={styles.insumoProgressTrack}>
                  <View style={[styles.insumoProgressFill, { width: '15%', backgroundColor: '#DC2626' }]} />
                </View>
                <View style={styles.insumoBottomRow}>
                  <Text style={styles.insumoStockText}>Restam 1.2 kg (Mín: 5.0 kg)</Text>
                  <TouchableOpacity style={styles.orderInsumoBtn}>
                    <Text style={styles.orderInsumoBtnText}>+ Pedir</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.insumoItem}>
                <View style={styles.insumoTopRow}>
                  <Text style={styles.insumoName}>Morangos Orgânicos Selecionados</Text>
                  <View style={styles.insumoPctBadge}>
                    <Text style={styles.insumoPctText}>22% restante</Text>
                  </View>
                </View>
                <View style={styles.insumoProgressTrack}>
                  <View style={[styles.insumoProgressFill, { width: '22%', backgroundColor: '#F59E0B' }]} />
                </View>
                <View style={styles.insumoBottomRow}>
                  <Text style={styles.insumoStockText}>Restam 4 caixas (Mín: 10 cx)</Text>
                  <TouchableOpacity style={styles.orderInsumoBtn}>
                    <Text style={styles.orderInsumoBtnText}>+ Pedir</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.insumoItem}>
                <View style={styles.insumoTopRow}>
                  <Text style={styles.insumoName}>Fitas de Cetim Dusty Rose (22mm)</Text>
                  <View style={styles.insumoPctBadge}>
                    <Text style={styles.insumoPctText}>10% restante</Text>
                  </View>
                </View>
                <View style={styles.insumoProgressTrack}>
                  <View style={[styles.insumoProgressFill, { width: '10%', backgroundColor: '#DC2626' }]} />
                </View>
                <View style={styles.insumoBottomRow}>
                  <Text style={styles.insumoStockText}>Restam 1 rolo (Mín: 4 rolos)</Text>
                  <TouchableOpacity style={styles.orderInsumoBtn}>
                    <Text style={styles.orderInsumoBtnText}>+ Pedir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.buyOrderBtn} activeOpacity={0.85}>
              <Feather name="shopping-cart" size={15} color="#5798D7" />
              <Text style={styles.buyOrderBtnText}>Gerar Ordem de Compra Imediata</Text>
            </TouchableOpacity>
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

            <View style={styles.rankingList}>
              <View style={styles.rankingItem}>
                <View style={styles.rankingMedalBox}>
                  <Text style={styles.rankingMedal}>🥇</Text>
                </View>
                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingProdName}>Cookie Duo Tradicional</Text>
                  <Text style={styles.rankingProdMeta}>142 vendidos • R$ 2.400,00</Text>
                  <View style={styles.rankingBarTrack}>
                    <View style={[styles.rankingBarFill, { width: '95%', backgroundColor: KipiPalette.icedDenim }]} />
                  </View>
                </View>
              </View>

              <View style={styles.rankingItem}>
                <View style={styles.rankingMedalBox}>
                  <Text style={styles.rankingMedal}>🥈</Text>
                </View>
                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingProdName}>Bolo Red Velvet Floral</Text>
                  <Text style={styles.rankingProdMeta}>38 vendidos • R$ 4.560,00</Text>
                  <View style={styles.rankingBarTrack}>
                    <View style={[styles.rankingBarFill, { width: '75%', backgroundColor: KipiPalette.pistachio }]} />
                  </View>
                </View>
              </View>

              <View style={styles.rankingItem}>
                <View style={styles.rankingMedalBox}>
                  <Text style={styles.rankingMedal}>🥉</Text>
                </View>
                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingProdName}>Cento de Brigadeiros Pistache</Text>
                  <Text style={styles.rankingProdMeta}>26 centos • R$ 3.120,00</Text>
                  <View style={styles.rankingBarTrack}>
                    <View style={[styles.rankingBarFill, { width: '58%', backgroundColor: '#7BAEE0' }]} />
                  </View>
                </View>
              </View>
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
                <Text style={[styles.panelChipText, { color: '#708018' }]}>68% Recompra</Text>
              </View>
            </View>

            <View style={styles.clientsMetricsRow}>
              <View style={styles.clientMetricCard}>
                <Text style={styles.clientMetricNum}>148</Text>
                <Text style={styles.clientMetricLabel}>Ativos</Text>
              </View>
              <View style={styles.clientMetricCard}>
                <Text style={[styles.clientMetricNum, { color: '#16A34A' }]}>+14</Text>
                <Text style={styles.clientMetricLabel}>Na Semana</Text>
              </View>
              <View style={styles.clientMetricCard}>
                <Text style={[styles.clientMetricNum, { color: KipiPalette.icedDenim }]}>68%</Text>
                <Text style={styles.clientMetricLabel}>Recompra</Text>
              </View>
            </View>

            <View style={styles.bdayArea}>
              <Text style={styles.bdayTitle}>🎂 ANIVERSARIANTES DE OUTUBRO</Text>
              <View style={styles.bdayList}>
                <View style={styles.bdayItem}>
                  <View style={styles.bdayLeft}>
                    <View style={styles.bdayAvatar}>
                      <Text style={styles.bdayAvatarText}>CM</Text>
                    </View>
                    <View>
                      <Text style={styles.bdayName}>Dra. Camila Morales</Text>
                      <Text style={styles.bdayDate}>24 de Outubro • VIP</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.bdayGiftBtn}>
                    <Text style={styles.bdayGiftBtnText}>Cupom 🎁</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.bdayItem}>
                  <View style={styles.bdayLeft}>
                    <View style={styles.bdayAvatar}>
                      <Text style={styles.bdayAvatarText}>MA</Text>
                    </View>
                    <View>
                      <Text style={styles.bdayName}>Mariana Albuquerque</Text>
                      <Text style={styles.bdayDate}>28 de Outubro • Noiva</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.bdayGiftBtn}>
                    <Text style={styles.bdayGiftBtnText}>Cupom 🎁</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
            MENU LATERAL (EXPANSÍVEL NO HOVER + FIXAÇÃO COM PIN + ÍCONE COMPACTO REDONDO/QUADRADINHO)
        ========================================================================== */}
        <View
          style={[
            styles.sidebar,
            menuExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed,
          ]}
          // @ts-ignore (propriedades web para hover)
          onMouseEnter={() => !menuPinned && setMenuHovered(true)}
          onMouseLeave={() => !menuPinned && setMenuHovered(false)}>

          {/* TOPO DO MENU COM LOGO KIPI */}
          <View style={styles.sidebarHeader}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeLetter}>K</Text>
            </View>
            {menuExpanded && (
              <View style={styles.brandInfo}>
                <View style={styles.brandTitleRow}>
                  <Text style={styles.brandTitle}>Kipi</Text>
                  <View style={styles.saasTag}>
                    <Text style={styles.saasTagText}>ATELIÊ</Text>
                  </View>
                </View>
                <Text style={styles.brandSubtitle}>Gestão de Alta Confeitaria</Text>
              </View>
            )}
          </View>

          {/* LISTA DE NAVEGAÇÃO */}
          <ScrollView
            style={styles.sidebarNav}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarNavContent}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.navItem,
                  !menuExpanded && styles.navItemCollapsed,
                  item.active && styles.navItemActive,
                  item.active && !menuExpanded && styles.navItemActiveCollapsed,
                ]}
                activeOpacity={0.75}
                onPress={() => {
                  if (item.route && item.route !== '/visao-geral') {
                    router.push(item.route as any);
                  }
                }}>
                <Feather
                  name={item.icon as any}
                  size={19}
                  color={item.active ? '#FFFFFF' : '#64748B'}
                />
                {menuExpanded && (
                  <Text
                    style={[
                      styles.navItemText,
                      item.active && styles.navItemTextActive,
                    ]}>
                    {item.label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* RODAPÉ DO MENU */}
          <View style={styles.sidebarFooter}>
            {isDesktop && (
              <TouchableOpacity
                style={[
                  styles.pinBtn,
                  menuPinned && styles.pinBtnActive,
                  !menuExpanded && styles.pinBtnCollapsed,
                ]}
                onPress={() => setMenuPinned(!menuPinned)}
                activeOpacity={0.7}>
                <Feather
                  name={menuPinned ? 'lock' : 'unlock'}
                  size={15}
                  color={menuPinned ? KipiPalette.icedDenim : '#94A3B8'}
                />
                {menuExpanded && (
                  <Text style={styles.pinBtnText}>
                    {menuPinned ? 'Menu fixado' : 'Fixar menu'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <View style={[styles.userMiniCard, !menuExpanded && styles.userMiniCardCollapsed]}>
              <View style={styles.userMiniAvatar}>
                <Text style={styles.userMiniAvatarLetter}>C</Text>
              </View>
              {menuExpanded && (
                <View style={styles.userMiniInfo}>
                  <Text style={styles.userMiniName} numberOfLines={1}>{usuario.nome}</Text>
                  <Text style={styles.userMiniRole}>{usuario.papel}</Text>
                </View>
              )}
              {menuExpanded && (
                <TouchableOpacity
                  onPress={() => router.replace('/')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="log-out" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

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
                <Text style={styles.kitchenBadgeText}>Cozinha Aberta • 8 entregas hoje</Text>
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
                  <Text style={styles.profileAvatarText}>CL</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>Camila Lima</Text>
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

            {/* 1. BANNER DE SAUDAÇÃO IDÊNTICO À REFERÊNCIA ATELIERQ */}
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
                      <Text style={styles.ovenBadgeText}>Fornos aquecidos a 170°C</Text>
                    </View>
                  </View>
                  <Text style={styles.greetingDescription}>
                    O aroma de cardamomo, flor de laranjeira e baunilha bourbon domina o ateliê.
                  </Text>
                  <TouchableOpacity activeOpacity={0.75}>
                    <Text style={styles.greetingTipLink}>
                      *Petite dica: O lote de macarons está quase pronto para ganache!*
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.greetingKpiCard}>
                <View style={styles.greetingKpiIconBox}>
                  <Feather name="trending-up" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.greetingKpiInfo}>
                  <Text style={styles.greetingKpiTag}>DESTAQUE FINANCEIRO HOJE</Text>
                  <Text style={styles.greetingKpiValue}>
                    {kpis.faturamento} <Text style={styles.greetingKpiSub}>({kpis.metaPct}% da meta)</Text>
                  </Text>
                  <Text style={styles.greetingKpiDesc}>
                    Lucro líquido projetado de {kpis.lucroLiquido} hoje.
                  </Text>
                </View>
                <TouchableOpacity style={styles.greetingKpiBtn} activeOpacity={0.7}>
                  <Text style={styles.greetingKpiBtnText}>Ver Ficha →</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. LINHA DE FILTROS DE PERÍODO */}
            <View style={styles.filtersBar}>
              <View style={styles.periodTabs}>
                {(['hoje', 'semana', 'mes', 'personalizar'] as Periodo[]).map((p) => {
                  const labels = {
                    hoje: 'Hoje',
                    semana: 'Semana',
                    mes: 'Mês',
                    personalizar: 'Personalizar',
                  };
                  const active = periodo === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.periodTab, active && styles.periodTabActive]}
                      onPress={() => setPeriodo(p)}
                      activeOpacity={0.8}>
                      <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>
                        {labels[p]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.filterActions}>
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

            {/* 3. CARDS DE KPIS EM LINHA */}
            <View style={styles.kpiRow}>
              {/* Faturamento Geral */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>FATURAMENTO GERAL</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#F1F6D8' }]}>
                    <Feather name="dollar-sign" size={15} color="#708018" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.faturamento}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillGreen}>
                    <Text style={styles.kpiDiffPillGreenText}>{kpis.faturamentoDiff}</Text>
                  </View>
                  <Text style={styles.kpiFooterNote}>{kpis.metaPct}% da meta</Text>
                </View>
              </View>

              {/* Lucro Líquido */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>LUCRO LÍQUIDO</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#EAF3FA' }]}>
                    <Feather name="pie-chart" size={15} color="#5798D7" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.lucroLiquido}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillBlue}>
                    <Text style={styles.kpiDiffPillBlueText}>{kpis.margem}</Text>
                  </View>
                  <Text style={styles.kpiFooterNote}>Estimado no período</Text>
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
                  <Text style={styles.kpiFooterNote}>Estabilidade alta</Text>
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
                  <Text style={styles.kpiFooterNote}>Saldos na entrega</Text>
                </View>
              </View>

              {/* Encomendas Ativas */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>ENCOMENDAS ATIVAS</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#EAF3FA' }]}>
                    <Feather name="inbox" size={15} color="#5798D7" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.encomendasAtivas}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillBlue}>
                    <Text style={styles.kpiDiffPillBlueText}>{kpis.encomendasNovas}</Text>
                  </View>
                  <Text style={styles.kpiFooterNote}>Produção em dia</Text>
                </View>
              </View>
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
      <NovoPedidoModal
        visible={modalNovoPedidoAberto}
        onClose={() => setModalNovoPedidoAberto(false)}
        onPedidoCriado={(novo) => {
          setToastSucesso(`✓ Pedido #${novo.id ? novo.id.slice(0, 8) : 'novo'} registrado com sucesso!`);
          setTimeout(() => setToastSucesso(null), 4000);
        }}
      />

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

const styles = StyleSheet.create({
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
  greetingKpiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    minWidth: 320,
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
});
