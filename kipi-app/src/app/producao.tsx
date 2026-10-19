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
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

// ============================================================================
// TIPOGRAFIA & CONSTANTES DE TEMA (KIPI ATELIÊ / UX SÊNIOR)
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });

const KIPI_BLUE = '#5798D7';
const KIPI_BLUE_DARK = '#3E7BB8';
const KIPI_BLUE_TINT = '#EAF3FA';
const KIPI_BLUE_ACCENT = '#2563EB';
const KIPI_FROST_BG = '#F8FAFC';
const SUCCESS_GREEN = '#16A34A';
const SUCCESS_TINT = '#DCFCE7';
const WARNING_AMBER = '#D97706';
const WARNING_TINT = '#FEF3C7';
const DANGER_RED = '#DC2626';
const DANGER_TINT = '#FEE2E2';
const OVEN_ORANGE = '#EA580C';
const OVEN_TINT = '#FFEDD5';
const FREEZER_CYAN = '#0284C7';
const FREEZER_TINT = '#E0F2FE';

// ============================================================================
// TIPOS DE DADOS
// ============================================================================
export interface IngredienteNecessario {
  nome: string;
  quantidadePorUnidade: number; // por unidade do produto (em g ou ml)
  unidade: string;
  estoqueAtual: number; // estoque total disponível
}

export interface ProdutoProducao {
  id: string;
  nome: string;
  categoria: string;
  fotoEmoji: string;
  estoqueAssado: number; // pronto para venda
  estoqueCongelado: number; // no freezer para assar
  tempoFornoMinutos: number;
  receitaIngredientes: IngredienteNecessario[];
}

export interface RegistroFornada {
  id: string;
  tipo: 'preparo_massa' | 'assar_fornada';
  produtoNome: string;
  fotoEmoji: string;
  quantidade: number;
  horario: string;
  responsavel: string;
  detalhes?: string;
}

// PRODUTOS DE CONFEITARIA COM ESTOQUE DE CONGELADOS E RECEITA
const PRODUTOS_PRODUCAO_INICIAIS: ProdutoProducao[] = [
  {
    id: 'prod-1',
    nome: 'Cookie Black Nutella & Avelã',
    categoria: 'Cookies',
    fotoEmoji: '🍪',
    estoqueAssado: 14,
    estoqueCongelado: 36, // 36 congelados no freezer
    tempoFornoMinutos: 14,
    receitaIngredientes: [
      { nome: 'Chocolate Belga 54%', quantidadePorUnidade: 15, unidade: 'g', estoqueAtual: 4800 },
      { nome: 'Farinha de Trigo Especial', quantidadePorUnidade: 28, unidade: 'g', estoqueAtual: 18000 },
      { nome: 'Manteiga Extra sem Sal', quantidadePorUnidade: 12, unidade: 'g', estoqueAtual: 1200 },
      { nome: 'Açúcar Mascavo Premium', quantidadePorUnidade: 10, unidade: 'g', estoqueAtual: 3500 },
    ],
  },
  {
    id: 'prod-2',
    nome: 'Cookie Tradicional Gotas Belga',
    categoria: 'Cookies',
    fotoEmoji: '🍪',
    estoqueAssado: 8,
    estoqueCongelado: 24,
    tempoFornoMinutos: 14,
    receitaIngredientes: [
      { nome: 'Farinha de Trigo Especial', quantidadePorUnidade: 30, unidade: 'g', estoqueAtual: 18000 },
      { nome: 'Manteiga Extra sem Sal', quantidadePorUnidade: 14, unidade: 'g', estoqueAtual: 1200 },
      { nome: 'Gotas Chocolate Belga', quantidadePorUnidade: 16, unidade: 'g', estoqueAtual: 2400 },
    ],
  },
  {
    id: 'prod-3',
    nome: 'Bento Cake Pistache & Framboesa',
    categoria: 'Bolos & Bentôs',
    fotoEmoji: '🎂',
    estoqueAssado: 4,
    estoqueCongelado: 10,
    tempoFornoMinutos: 35,
    receitaIngredientes: [
      { nome: 'Farinha de Trigo Especial', quantidadePorUnidade: 120, unidade: 'g', estoqueAtual: 18000 },
      { nome: 'Pasta Pura de Pistache', quantidadePorUnidade: 60, unidade: 'g', estoqueAtual: 850 },
      { nome: 'Creme de Leite Fresco', quantidadePorUnidade: 100, unidade: 'ml', estoqueAtual: 1500 },
    ],
  },
  {
    id: 'prod-4',
    nome: 'Croissant Francês Folhado Manteiga',
    categoria: 'Folhados',
    fotoEmoji: '🥐',
    estoqueAssado: 6,
    estoqueCongelado: 18,
    tempoFornoMinutos: 20,
    receitaIngredientes: [
      { nome: 'Farinha de Trigo Especial', quantidadePorUnidade: 55, unidade: 'g', estoqueAtual: 18000 },
      { nome: 'Manteiga Extra sem Sal', quantidadePorUnidade: 35, unidade: 'g', estoqueAtual: 1200 },
    ],
  },
  {
    id: 'prod-5',
    nome: 'Pão de Mel Artesanal Recheado',
    categoria: 'Doces Finos',
    fotoEmoji: '🍯',
    estoqueAssado: 12,
    estoqueCongelado: 0, // ZERADO NO CONGELADOR!
    tempoFornoMinutos: 18,
    receitaIngredientes: [
      { nome: 'Farinha de Trigo Especial', quantidadePorUnidade: 40, unidade: 'g', estoqueAtual: 18000 },
      { nome: 'Doce de Leite Cremoso', quantidadePorUnidade: 30, unidade: 'g', estoqueAtual: 2000 },
      { nome: 'Chocolate Belga 54%', quantidadePorUnidade: 25, unidade: 'g', estoqueAtual: 4800 },
    ],
  },
];

// HISTÓRICO DAS FORNADAS DE HOJE
const FORNADAS_HOJE_INICIAIS: RegistroFornada[] = [
  {
    id: 'forn-1',
    tipo: 'assar_fornada',
    produtoNome: 'Cookie Black Nutella & Avelã',
    fotoEmoji: '🍪',
    quantidade: 12,
    horario: '10:45',
    responsavel: 'Camila Lima',
    detalhes: 'Fornada dourada e macia. Direto para a vitrine.',
  },
  {
    id: 'forn-2',
    tipo: 'preparo_massa',
    produtoNome: 'Cookie Black Nutella & Avelã',
    fotoEmoji: '🍪',
    quantidade: 24,
    horario: '09:30',
    responsavel: 'Juliana Carvalho',
    detalhes: 'Lote #88 modelado e guardado no freezer a -18°C.',
  },
  {
    id: 'forn-3',
    tipo: 'assar_fornada',
    produtoNome: 'Croissant Francês Folhado Manteiga',
    fotoEmoji: '🥐',
    quantidade: 6,
    horario: '08:15',
    responsavel: 'Camila Lima',
    detalhes: 'Fornada da manhã para o balcão.',
  },
];

export default function ProducaoScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // Estados principais
  const [produtos, setProdutos] = useState<ProdutoProducao[]>(PRODUTOS_PRODUCAO_INICIAIS);
  const [fornadas, setFornadas] = useState<RegistroFornada[]>(FORNADAS_HOJE_INICIAIS);
  const [searchQuery, setSearchQuery] = useState('');

  // Modais de Ação Operacional
  const [modalPreparoVisible, setModalPreparoVisible] = useState(false);
  const [modalAssarVisible, setModalAssarVisible] = useState(false);
  const [produtoAtivo, setProdutoAtivo] = useState<ProdutoProducao | null>(null);

  // Formulário: Preparar Massa (Congelar)
  const [qtdPreparoInput, setQtdPreparoInput] = useState('12');
  const [erroPreparo, setErroPreparo] = useState<string | null>(null);

  // Formulário: Assar Fornada
  const [qtdAssarInput, setQtdAssarInput] = useState('6');
  const [erroAssar, setErroAssar] = useState<string | null>(null);

  // Timer de Forno Ativo
  const [timerAtivo, setTimerAtivo] = useState(false);
  const [timerMinutosRestantes, setTimerMinutosRestantes] = useState(14);
  const [produtoNoFornoNome, setProdutoNoFornoNome] = useState('');

  // Totais de KPIs
  const totalCongelados = produtos.reduce((acc, p) => acc + p.estoqueCongelado, 0);
  const totalAssados = produtos.reduce((acc, p) => acc + p.estoqueAssado, 0);
  const totalFornadasHoje = fornadas.filter(f => f.tipo === 'assar_fornada').length;

  // ==========================================================================
  // VALIDAÇÃO EM TEMPO REAL DE INGREDIENTES PARA O PREPARO (UX SÊNIOR)
  // ==========================================================================
  const analiseIngredientesPreparo = useMemo(() => {
    if (!produtoAtivo) return { viavel: false, itens: [] };

    const qtd = parseInt(qtdPreparoInput) || 0;
    if (qtd <= 0) return { viavel: false, itens: [] };

    let viavel = true;
    const itens = produtoAtivo.receitaIngredientes.map(ing => {
      const necessario = ing.quantidadePorUnidade * qtd;
      const suficiente = ing.estoqueAtual >= necessario;
      if (!suficiente) viavel = false;

      return {
        nome: ing.nome,
        necessario,
        disponivel: ing.estoqueAtual,
        unidade: ing.unidade,
        suficiente,
      };
    });

    return { viavel, itens };
  }, [produtoAtivo, qtdPreparoInput]);

  // ==========================================================================
  // FLUXO 1: CONFIRMAR PREPARO DE MASSA (VAI PARA O CONGELADOR)
  // ==========================================================================
  const handleConfirmarPreparo = () => {
    if (!produtoAtivo) return;

    const qtd = parseInt(qtdPreparoInput) || 0;
    if (qtd <= 0) {
      setErroPreparo('Por favor, informe uma quantidade válida.');
      return;
    }

    if (!analiseIngredientesPreparo.viavel) {
      setErroPreparo('Não é possível produzir: estoque de ingredientes insuficiente.');
      return;
    }

    // 1. Atualiza estoque do produto: adiciona aos congelados
    setProdutos(prev =>
      prev.map(p =>
        p.id === produtoAtivo.id
          ? {
              ...p,
              estoqueCongelado: p.estoqueCongelado + qtd,
              // Subtrai proporcionalmente o estoque dos ingredientes da receita
              receitaIngredientes: p.receitaIngredientes.map(ing => ({
                ...ing,
                estoqueAtual: Math.max(0, ing.estoqueAtual - ing.quantidadePorUnidade * qtd),
              })),
            }
          : p
      )
    );

    // 2. Registra no histórico de produção
    const novoRegistro: RegistroFornada = {
      id: `forn-${Date.now()}`,
      tipo: 'preparo_massa',
      produtoNome: produtoAtivo.nome,
      fotoEmoji: produtoAtivo.fotoEmoji,
      quantidade: qtd,
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      responsavel: 'Camila Lima',
      detalhes: `${qtd} massas preparadas e armazenadas no freezer.`,
    };
    setFornadas(prev => [novoRegistro, ...prev]);

    setModalPreparoVisible(false);
  };

  // ==========================================================================
  // FLUXO 2: CONFIRMAR ASSAMENTO (CONGELADO ➔ PRONTO PARA VENDA)
  // ==========================================================================
  const handleConfirmarAssar = () => {
    if (!produtoAtivo) return;

    const qtd = parseInt(qtdAssarInput) || 0;
    if (qtd <= 0) {
      setErroAssar('Por favor, informe quantos deseja assar.');
      return;
    }

    // REGRA BÁSICA: NÃO PODE ASSAR SE NÃO TIVER ITEM SUFICIENTE CONGELADO!
    if (qtd > produtoAtivo.estoqueCongelado) {
      setErroAssar(`Estoque congelado insuficiente! Você possui apenas ${produtoAtivo.estoqueCongelado} no freezer.`);
      return;
    }

    // 1. Atualiza estoque: subtrai do congelado e adiciona ao assado para venda
    setProdutos(prev =>
      prev.map(p =>
        p.id === produtoAtivo.id
          ? {
              ...p,
              estoqueCongelado: p.estoqueCongelado - qtd,
              estoqueAssado: p.estoqueAssado + qtd,
            }
          : p
      )
    );

    // 2. Inicia Timer de Forno visual
    setProdutoNoFornoNome(produtoAtivo.nome);
    setTimerMinutosRestantes(produtoAtivo.tempoFornoMinutos);
    setTimerAtivo(true);

    // 3. Registra fornada
    const novoRegistro: RegistroFornada = {
      id: `forn-${Date.now()}`,
      tipo: 'assar_fornada',
      produtoNome: produtoAtivo.nome,
      fotoEmoji: produtoAtivo.fotoEmoji,
      quantidade: qtd,
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      responsavel: 'Camila Lima',
      detalhes: `${qtd} unidades assadas e adicionadas à vitrine de pronta entrega.`,
    };
    setFornadas(prev => [novoRegistro, ...prev]);

    setModalAssarVisible(false);
  };

  // Filtragem de produtos
  const produtosFiltrados = useMemo(() => {
    if (!searchQuery.trim()) return produtos;
    const q = searchQuery.toLowerCase().trim();
    return produtos.filter(p => p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q));
  }, [produtos, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screenWrapper}>
        {/* SIDEBAR MODULAR */}
        <Sidebar activeRoute="/producao" />

        {/* ÁREA PRINCIPAL */}
        <View style={styles.mainContainer}>
          {/* TOPO: CABEÇALHO */}
          <View style={styles.topHeader}>
            <View style={styles.headerTitleCol}>
              <View style={styles.headerBadgeRow}>
                <View style={styles.activeDot} />
                <Text style={styles.headerCategoryBadge}>CHÃO DE FÁBRICA & ATELIÊ</Text>
                <View style={styles.systemBluePill}>
                  <Text style={styles.systemBluePillText}>KIPI ATELIÊ</Text>
                </View>
              </View>
              <Text style={styles.pageTitle}>Produção & Forno</Text>
              <Text style={styles.pageSubtitle}>
                Fluxo diário de produção: prepare lotes de massa para congelar e asse sob demanda para a vitrine.
              </Text>
            </View>

            {/* Ações Rápidas no Topo */}
            <View style={styles.topActionsRow}>
              <TouchableOpacity
                style={styles.btnAcaoPreparo}
                onPress={() => {
                  setProdutoAtivo(produtos[0]);
                  setQtdPreparoInput('12');
                  setErroPreparo(null);
                  setModalPreparoVisible(true);
                }}>
                <Text style={{ fontSize: 16 }}>🧊</Text>
                <Text style={styles.btnAcaoPreparoText}>+ Preparar Massa</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnAcaoAssar}
                onPress={() => {
                  setProdutoAtivo(produtos[0]);
                  setQtdAssarInput('6');
                  setErroAssar(null);
                  setModalAssarVisible(true);
                }}>
                <Text style={{ fontSize: 16 }}>🔥</Text>
                <Text style={styles.btnAcaoAssarText}>♨️ Assar Fornada</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* BANNER DO FORNO ATIVO SE HOUVER FORNADA ASSANDO */}
          {timerAtivo && (
            <View style={styles.ovenActiveBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.ovenIconBox}>
                  <Text style={{ fontSize: 24 }}>♨️</Text>
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.ovenTitle}>FORNADA NO FORNO AGORA!</Text>
                    <View style={styles.ovenBadge}>
                      <Text style={styles.ovenBadgeText}>ASSANDO</Text>
                    </View>
                  </View>
                  <Text style={styles.ovenSubtitle}>
                    {produtoNoFornoNome} • Tempo restante estimado: <Text style={{ fontWeight: '800' }}>{timerMinutosRestantes} min</Text>
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.ovenFinishBtn}
                onPress={() => setTimerAtivo(false)}>
                <Feather name="check" size={14} color="#FFFFFF" />
                <Text style={styles.ovenFinishBtnText}>Fornada Concluída</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* KPIS DE PRODUÇÃO */}
          <View style={styles.kpiCardsRow}>
            {/* KPI 1: Congelados no Freezer */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardHeader}>
                <Text style={styles.kpiLabel}>NO FREEZER (CONGELADOS)</Text>
                <View style={[styles.kpiIconBox, { backgroundColor: FREEZER_TINT }]}>
                  <Text style={{ fontSize: 13 }}>🧊</Text>
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: FREEZER_CYAN }]}>{totalCongelados} un</Text>
              <Text style={styles.kpiSubtext}>Massas modeladas prontas para o forno</Text>
            </View>

            {/* KPI 2: Assados Prontos para Venda */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardHeader}>
                <Text style={styles.kpiLabel}>NA VITRINE (PRONTOS)</Text>
                <View style={[styles.kpiIconBox, { backgroundColor: OVEN_TINT }]}>
                  <Text style={{ fontSize: 13 }}>🧁</Text>
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: OVEN_ORANGE }]}>{totalAssados} un</Text>
              <Text style={styles.kpiSubtext}>Disponíveis para pronta entrega</Text>
            </View>

            {/* KPI 3: Fornadas Assadas Hoje */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardHeader}>
                <Text style={styles.kpiLabel}>FORNADAS HOJE</Text>
                <View style={[styles.kpiIconBox, { backgroundColor: SUCCESS_TINT }]}>
                  <Feather name="check-circle" size={15} color={SUCCESS_GREEN} />
                </View>
              </View>
              <Text style={styles.kpiValue}>{totalFornadasHoje}</Text>
              <Text style={styles.kpiSubtext}>Lotes assados no dia</Text>
            </View>
          </View>

          {/* =========================================================================
              CONTEÚDO PRINCIPAL (DIVIDIDO EM PRODUTOS & TIMELINE DE FORNADAS)
          ========================================================================== */}
          <View style={styles.contentColumns}>
            {/* COLUNA ESQUERDA: CARDS DE PRODUTOS COM CONTROLE CONGELADO / ASSADO */}
            <View style={styles.productsCol}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Produtos & Status de Cozinha</Text>
                  <Text style={styles.sectionSubtitle}>Controle de massas no freezer vs unidades na bancada</Text>
                </View>

                {/* Busca rápida */}
                <View style={styles.miniSearchBox}>
                  <Feather name="search" size={14} color="#94A3B8" />
                  <TextInput
                    style={styles.miniSearchInput}
                    placeholder="Filtrar doce..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
              </View>

              <ScrollView style={styles.productsListScroll} showsVerticalScrollIndicator={false}>
                {produtosFiltrados.map(prod => {
                  const precisaAssar = prod.estoqueAssado <= 4 && prod.estoqueCongelado > 0;
                  const precisaPrepararMassa = prod.estoqueCongelado <= 6;

                  return (
                    <View key={prod.id} style={styles.productionCard}>
                      <View style={styles.prodCardTop}>
                        <View style={styles.prodAvatar}>
                          <Text style={{ fontSize: 22 }}>{prod.fotoEmoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prodCategory}>{prod.categoria}</Text>
                          <Text style={styles.prodName}>{prod.nome}</Text>
                          <Text style={styles.prodOvenTime}>⏱️ Tempo de Forno: {prod.tempoFornoMinutos} min</Text>
                        </View>
                      </View>

                      {/* As 2 Barras de Nível: Congelados vs Assados */}
                      <View style={styles.stockBarsContainer}>
                        {/* 1. Congelados */}
                        <View style={styles.stockBarItem}>
                          <View style={styles.stockBarTextRow}>
                            <Text style={styles.stockBarLabel}>🧊 Congelados no Freezer:</Text>
                            <Text style={[styles.stockBarNumber, { color: FREEZER_CYAN }]}>
                              {prod.estoqueCongelado} un
                            </Text>
                          </View>
                          {precisaPrepararMassa && (
                            <Text style={styles.stockNoticeWarning}>⚠️ Fazer mais massa</Text>
                          )}
                        </View>

                        {/* 2. Assados */}
                        <View style={styles.stockBarItem}>
                          <View style={styles.stockBarTextRow}>
                            <Text style={styles.stockBarLabel}>♨️ Assados na Vitrine:</Text>
                            <Text style={[styles.stockBarNumber, { color: OVEN_ORANGE }]}>
                              {prod.estoqueAssado} un
                            </Text>
                          </View>
                          {precisaAssar && (
                            <Text style={styles.stockNoticeAlert}>🔥 Hora de assar fornada!</Text>
                          )}
                        </View>
                      </View>

                      {/* Botões de Ação Rápida no Card */}
                      <View style={styles.prodCardActionsRow}>
                        <TouchableOpacity
                          style={styles.cardBtnPreparo}
                          onPress={() => {
                            setProdutoAtivo(prod);
                            setQtdPreparoInput('12');
                            setErroPreparo(null);
                            setModalPreparoVisible(true);
                          }}>
                          <Text style={{ fontSize: 13 }}>🧊</Text>
                          <Text style={styles.cardBtnPreparoText}>+ Preparar Massa</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.cardBtnAssar,
                            prod.estoqueCongelado <= 0 && styles.cardBtnAssarDisabled,
                          ]}
                          disabled={prod.estoqueCongelado <= 0}
                          onPress={() => {
                            setProdutoAtivo(prod);
                            setQtdAssarInput(Math.min(6, prod.estoqueCongelado).toString());
                            setErroAssar(null);
                            setModalAssarVisible(true);
                          }}>
                          <Text style={{ fontSize: 13 }}>🔥</Text>
                          <Text style={[
                            styles.cardBtnAssarText,
                            prod.estoqueCongelado <= 0 && styles.cardBtnAssarTextDisabled,
                          ]}>
                            {prod.estoqueCongelado <= 0 ? 'Sem Congelados' : 'Assar Fornada'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* COLUNA DIREITA: HISTÓRICO DAS FORNADAS DO DIA (TIMELINE) */}
            <View style={styles.historyCol}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Histórico de Hoje</Text>
                  <Text style={styles.sectionSubtitle}>Lotes preparados e fornadas</Text>
                </View>
                <Feather name="clock" size={16} color="#64748B" />
              </View>

              <ScrollView style={styles.historyListScroll} showsVerticalScrollIndicator={false}>
                {fornadas.map(f => (
                  <View key={f.id} style={styles.historyItem}>
                    <View style={styles.historyTimeCol}>
                      <Text style={styles.historyTimeText}>{f.horario}</Text>
                      <View style={[styles.historyDot, f.tipo === 'assar_fornada' ? styles.historyDotOven : styles.historyDotFreezer]} />
                    </View>

                    <View style={styles.historyCardBox}>
                      <View style={styles.historyTopRow}>
                        <Text style={{ fontSize: 16 }}>{f.fotoEmoji}</Text>
                        <Text style={styles.historyProdName} numberOfLines={1}>{f.produtoNome}</Text>
                        <View style={[styles.historyTypeBadge, f.tipo === 'assar_fornada' ? styles.badgeOven : styles.badgeFreezer]}>
                          <Text style={[styles.historyTypeBadgeText, f.tipo === 'assar_fornada' ? styles.badgeOvenText : styles.badgeFreezerText]}>
                            {f.tipo === 'assar_fornada' ? `♨️ +${f.quantidade} assados` : `🧊 +${f.quantidade} massas`}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.historyDetailText}>{f.detalhes}</Text>
                      <Text style={styles.historyAuthor}>Por {f.responsavel}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </View>

      {/* =========================================================================
          MODAL 1: PREPARAR MASSA (SUBTRAI INGREDIENTES E SOMA AOS CONGELADOS)
      ========================================================================== */}
      <Modal
        visible={modalPreparoVisible && produtoAtivo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPreparoVisible(false)}>
        <View style={styles.modalOverlay}>
          {produtoAtivo && (
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.modalIconCircle, { backgroundColor: FREEZER_TINT }]}>
                    <Text style={{ fontSize: 24 }}>🧊</Text>
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Preparar Lote de Massa</Text>
                    <Text style={styles.modalSubtitle}>
                      {produtoAtivo.nome} • A quantidade produzida irá para o freezer.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setModalPreparoVisible(false)}>
                  <Feather name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {erroPreparo && (
                <View style={styles.errorBox}>
                  <Feather name="alert-triangle" size={16} color={DANGER_RED} />
                  <Text style={styles.errorBoxText}>{erroPreparo}</Text>
                </View>
              )}

              <View style={styles.modalBody}>
                {/* Quantidade a Produzir */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>QUANTAS UNIDADES DE MASSA VAI MODELAR? *</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        const v = Math.max(1, (parseInt(qtdPreparoInput) || 0) - 6);
                        setQtdPreparoInput(v.toString());
                      }}>
                      <Feather name="minus" size={16} color="#0F172A" />
                    </TouchableOpacity>

                    <TextInput
                      style={styles.stepperInput}
                      keyboardType="numeric"
                      value={qtdPreparoInput}
                      onChangeText={setQtdPreparoInput}
                    />

                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        const v = (parseInt(qtdPreparoInput) || 0) + 6;
                        setQtdPreparoInput(v.toString());
                      }}>
                      <Feather name="plus" size={16} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Checklist de Validação de Ingredientes em Estoque */}
                <View style={styles.checklistCard}>
                  <Text style={styles.checklistTitle}>
                    Verificação de Ingredientes no Estoque:
                  </Text>
                  <Text style={styles.checklistSubtitle}>
                    O sistema desconta automaticamente dos insumos cadastrados.
                  </Text>

                  <View style={{ gap: 8, marginTop: 10 }}>
                    {analiseIngredientesPreparo.itens.map((item, idx) => (
                      <View key={idx} style={styles.checkItemRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Feather
                            name={item.suficiente ? 'check-circle' : 'alert-circle'}
                            size={16}
                            color={item.suficiente ? SUCCESS_GREEN : DANGER_RED}
                          />
                          <Text style={styles.checkItemName}>{item.nome}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.checkItemAmount, !item.suficiente && { color: DANGER_RED }]}>
                            Precisa: {item.necessario} {item.unidade}
                          </Text>
                          <Text style={styles.checkItemStock}>
                            Disponível: {item.disponivel} {item.unidade}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setModalPreparoVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirmBtn,
                    !analiseIngredientesPreparo.viavel && styles.modalConfirmBtnDisabled,
                  ]}
                  disabled={!analiseIngredientesPreparo.viavel}
                  onPress={handleConfirmarPreparo}>
                  <Feather name="check" size={16} color="#FFFFFF" />
                  <Text style={styles.modalConfirmBtnText}>
                    {analiseIngredientesPreparo.viavel ? 'Confirmar & Congelar' : 'Faltam Ingredientes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* =========================================================================
          MODAL 2: ASSAR FORNADA (SUBTRAI DOS CONGELADOS E SOMA NA VITRINE)
      ========================================================================== */}
      <Modal
        visible={modalAssarVisible && produtoAtivo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalAssarVisible(false)}>
        <View style={styles.modalOverlay}>
          {produtoAtivo && (
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.modalIconCircle, { backgroundColor: OVEN_TINT }]}>
                    <Text style={{ fontSize: 24 }}>♨️</Text>
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Assar Fornada</Text>
                    <Text style={styles.modalSubtitle}>
                      {produtoAtivo.nome} • Tempo de forno: {produtoAtivo.tempoFornoMinutos} min.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setModalAssarVisible(false)}>
                  <Feather name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {erroAssar && (
                <View style={styles.errorBox}>
                  <Feather name="alert-triangle" size={16} color={DANGER_RED} />
                  <Text style={styles.errorBoxText}>{erroAssar}</Text>
                </View>
              )}

              <View style={styles.modalBody}>
                {/* Status do Freezer */}
                <View style={styles.freezerNoticeBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>🧊</Text>
                    <Text style={styles.freezerNoticeText}>
                      Você possui <Text style={{ fontWeight: '800', color: FREEZER_CYAN }}>{produtoAtivo.estoqueCongelado} unidades</Text> congeladas no freezer.
                    </Text>
                  </View>
                </View>

                {/* Quantidade a Assar */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>QUANTAS UNIDADES QUER ASSAR AGORA? *</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        const v = Math.max(1, (parseInt(qtdAssarInput) || 0) - 1);
                        setQtdAssarInput(v.toString());
                      }}>
                      <Feather name="minus" size={16} color="#0F172A" />
                    </TouchableOpacity>

                    <TextInput
                      style={styles.stepperInput}
                      keyboardType="numeric"
                      value={qtdAssarInput}
                      onChangeText={setQtdAssarInput}
                    />

                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        const v = Math.min(produtoAtivo.estoqueCongelado, (parseInt(qtdAssarInput) || 0) + 1);
                        setQtdAssarInput(v.toString());
                      }}>
                      <Feather name="plus" size={16} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Prévia do Resultado */}
                <View style={styles.previewResultBox}>
                  <Text style={styles.previewResultLabel}>Após assar esta fornada:</Text>
                  <Text style={styles.previewResultText}>
                    • Freezer ficará com: <Text style={{ fontWeight: '700' }}>{Math.max(0, produtoAtivo.estoqueCongelado - (parseInt(qtdAssarInput) || 0))} un</Text>
                  </Text>
                  <Text style={styles.previewResultText}>
                    • Vitrine pronta entrega terá: <Text style={{ fontWeight: '700', color: OVEN_ORANGE }}>{produtoAtivo.estoqueAssado + (parseInt(qtdAssarInput) || 0)} un</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setModalAssarVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirmBtn,
                    { backgroundColor: OVEN_ORANGE },
                    (parseInt(qtdAssarInput) || 0) > produtoAtivo.estoqueCongelado && styles.modalConfirmBtnDisabled,
                  ]}
                  disabled={(parseInt(qtdAssarInput) || 0) > produtoAtivo.estoqueCongelado}
                  onPress={handleConfirmarAssar}>
                  <Text style={{ fontSize: 14 }}>🔥</Text>
                  <Text style={styles.modalConfirmBtnText}>Colocar no Forno & Prateleira</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screenWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: KIPI_FROST_BG,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: KIPI_FROST_BG,
  },

  // CABEÇALHO
  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    flexWrap: 'wrap',
    gap: 16,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 280,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: OVEN_ORANGE,
  },
  headerCategoryBadge: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#64748B',
  },
  systemBluePill: {
    backgroundColor: KIPI_BLUE_TINT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  systemBluePillText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
    color: KIPI_BLUE_ACCENT,
    letterSpacing: 0.5,
  },
  pageTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnAcaoPreparo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  btnAcaoPreparoText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: FREEZER_CYAN,
  },
  btnAcaoAssar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OVEN_ORANGE,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    boxShadow: '0 2px 8px rgba(234, 88, 12, 0.35)',
  },
  btnAcaoAssarText: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // BANNER FORNO ATIVO
  ovenActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  ovenIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovenTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  ovenBadge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ovenBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ovenSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#C2410C',
    marginTop: 2,
  },
  ovenFinishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SUCCESS_GREEN,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  ovenFinishBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // KPIS
  kpiCardsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  kpiSubtext: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#94A3B8',
  },

  // COLUNAS PRINCIPAIS
  contentColumns: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  productsCol: {
    flex: 1.6,
  },
  historyCol: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 580,
  },

  // CABEÇALHO DE SEÇÃO
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
  },
  miniSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
    width: 140,
  },
  miniSearchInput: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 11,
  },

  // CARDS DE PRODUÇÃO
  productsListScroll: {
    flex: 1,
  },
  productionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  prodCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  prodAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodCategory: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  prodName: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  prodOvenTime: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  // DUAS BARRAS DE ESTOQUE
  stockBarsContainer: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  stockBarItem: {
    flex: 1,
  },
  stockBarTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockBarLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#475569',
  },
  stockBarNumber: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '800',
  },
  stockNoticeAlert: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: OVEN_ORANGE,
    marginTop: 2,
  },
  stockNoticeWarning: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: DANGER_RED,
    marginTop: 2,
  },

  // AÇÕES NO CARD
  prodCardActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardBtnPreparo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  cardBtnPreparoText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: FREEZER_CYAN,
  },
  cardBtnAssar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  cardBtnAssarDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  cardBtnAssarText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: OVEN_ORANGE,
  },
  cardBtnAssarTextDisabled: {
    color: '#94A3B8',
  },

  // HISTÓRICO
  historyListScroll: {
    flex: 1,
  },
  historyItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  historyTimeCol: {
    alignItems: 'center',
    width: 48,
  },
  historyTimeText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyDotOven: {
    backgroundColor: OVEN_ORANGE,
  },
  historyDotFreezer: {
    backgroundColor: FREEZER_CYAN,
  },
  historyCardBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  historyProdName: {
    flex: 1,
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeOven: {
    backgroundColor: OVEN_TINT,
  },
  badgeFreezer: {
    backgroundColor: FREEZER_TINT,
  },
  historyTypeBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
  },
  badgeOvenText: {
    color: OVEN_ORANGE,
  },
  badgeFreezerText: {
    color: FREEZER_CYAN,
  },
  historyDetailText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
  },
  historyAuthor: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // MODAIS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalBody: {
    gap: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  errorBoxText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: DANGER_RED,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepperInput: {
    width: 90,
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    textAlign: 'center',
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  checklistCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checklistTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  checklistSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
  },
  checkItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  checkItemName: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  checkItemAmount: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  checkItemStock: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#94A3B8',
  },
  freezerNoticeBox: {
    backgroundColor: FREEZER_TINT,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 12,
  },
  freezerNoticeText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#0369A1',
  },
  previewResultBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  previewResultLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  previewResultText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#334155',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modalCancelBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FREEZER_CYAN,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modalConfirmBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  modalConfirmBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
