import React, { useState, useMemo } from 'react';
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

export type EstoqueTab = 'produtos' | 'ingredientes' | 'embalagens' | 'compras';

// PRODUTOS COM ESTOQUE ASSADO E CONGELADO
export interface EstoqueProduto {
  id: string;
  nome: string;
  categoria: string;
  fotoEmoji: string;
  precoVenda: number;
  estoqueAssado: number; // diminui com vendas
  estoqueCongelado: number; // para assar
  minimoAssado: number;
  minimoCongelado: number;
}

// INGREDIENTES COM CAPACIDADE DE RECEITAS
export interface EstoqueIngrediente {
  id: string;
  nome: string;
  tipo: string;
  quantidadeAtual: number;
  unidade: string;
  minimoSeguranca: number;
  precoEstimadoCompra: number;
  armazenamento: string;
  emoji: string;
  consumoPorFornada: {
    receitaNome: string;
    gastoPorFornada: number;
    fornadasPossiveis: number;
  }[];
}

// EMBALAGENS
export interface EstoqueEmbalagem {
  id: string;
  nome: string;
  quantidadeAtual: number;
  unidade: string;
  minimoSeguranca: number;
  precoEstimadoCompra: number;
  emoji: string;
  usadoEm: string;
}

const PRODUTOS_ESTOQUE_MOCK: EstoqueProduto[] = [
  {
    id: 'p1',
    nome: 'Cookie Black Nutella & Avelã',
    categoria: 'Cookies',
    fotoEmoji: '🍪',
    precoVenda: 18.90,
    estoqueAssado: 4, // BAIXO!
    estoqueCongelado: 36, // tem bastante congelado
    minimoAssado: 8,
    minimoCongelado: 12,
  },
  {
    id: 'p2',
    nome: 'Cookie Tradicional Gotas Belga',
    categoria: 'Cookies',
    fotoEmoji: '🍪',
    precoVenda: 15.90,
    estoqueAssado: 12,
    estoqueCongelado: 24,
    minimoAssado: 8,
    minimoCongelado: 12,
  },
  {
    id: 'p3',
    nome: 'Bento Cake Pistache & Framboesa',
    categoria: 'Bolos & Bentôs',
    fotoEmoji: '🎂',
    precoVenda: 65.00,
    estoqueAssado: 2, // BAIXO!
    estoqueCongelado: 4, // BAIXO NO FREEZER TAMBÉM!
    minimoAssado: 4,
    minimoCongelado: 6,
  },
  {
    id: 'p4',
    nome: 'Croissant Francês Folhado Manteiga',
    categoria: 'Folhados',
    fotoEmoji: '🥐',
    precoVenda: 16.00,
    estoqueAssado: 6,
    estoqueCongelado: 18,
    minimoAssado: 6,
    minimoCongelado: 10,
  },
  {
    id: 'p5',
    nome: 'Pão de Mel Artesanal Recheado',
    categoria: 'Doces Finos',
    fotoEmoji: '🍯',
    precoVenda: 12.00,
    estoqueAssado: 14,
    estoqueCongelado: 0, // ZERADO!
    minimoAssado: 8,
    minimoCongelado: 10,
  },
];

const INGREDIENTES_ESTOQUE_MOCK: EstoqueIngrediente[] = [
  {
    id: 'ing-1',
    nome: 'Manteiga Extra sem Sal 82%',
    tipo: 'Laticínio',
    quantidadeAtual: 1.2, // 1.2 kg
    unidade: 'kg',
    minimoSeguranca: 2.5, // ALERTA!
    precoEstimadoCompra: 48.90,
    armazenamento: 'Refrigerado',
    emoji: '🧈',
    consumoPorFornada: [
      { receitaNome: 'Cookie Black (12 un)', gastoPorFornada: 0.15, fornadasPossiveis: 8 },
      { receitaNome: 'Croissant (10 un)', gastoPorFornada: 0.35, fornadasPossiveis: 3 }, // GARGALO!
    ],
  },
  {
    id: 'ing-2',
    nome: 'Chocolate Belga 54% Callebaut',
    tipo: 'Chocolate Nobre',
    quantidadeAtual: 4.8,
    unidade: 'kg',
    minimoSeguranca: 2.0,
    precoEstimadoCompra: 189.90,
    armazenamento: 'Seco',
    emoji: '🍫',
    consumoPorFornada: [
      { receitaNome: 'Cookie Black (12 un)', gastoPorFornada: 0.18, fornadasPossiveis: 26 },
      { receitaNome: 'Brigadeiro Belga (100 un)', gastoPorFornada: 0.40, fornadasPossiveis: 12 },
    ],
  },
  {
    id: 'ing-3',
    nome: 'Farinha de Trigo Anaconda Tipo 1',
    tipo: 'Farináceo',
    quantidadeAtual: 18.0,
    unidade: 'kg',
    minimoSeguranca: 10.0,
    precoEstimadoCompra: 32.50,
    armazenamento: 'Seco',
    emoji: '🌾',
    consumoPorFornada: [
      { receitaNome: 'Cookie Black (12 un)', gastoPorFornada: 0.35, fornadasPossiveis: 51 },
      { receitaNome: 'Bento Cake (1 bolo)', gastoPorFornada: 0.12, fornadasPossiveis: 150 },
    ],
  },
  {
    id: 'ing-4',
    nome: 'Pasta Pura de Pistache Siciliano',
    tipo: 'Pasta Concentrada',
    quantidadeAtual: 0.45,
    unidade: 'kg',
    minimoSeguranca: 0.8, // ALERTA!
    precoEstimadoCompra: 145.00,
    armazenamento: 'Refrigerado',
    emoji: '🥜',
    consumoPorFornada: [
      { receitaNome: 'Bento Cake Pistache (1 un)', gastoPorFornada: 0.06, fornadasPossiveis: 7 },
    ],
  },
  {
    id: 'ing-5',
    nome: 'Frutas Vermelhas Frescas',
    tipo: 'Fruta Fresca',
    quantidadeAtual: 0.3,
    unidade: 'kg',
    minimoSeguranca: 0.8, // ALERTA!
    precoEstimadoCompra: 68.00,
    armazenamento: 'In Natura',
    emoji: '🍓',
    consumoPorFornada: [
      { receitaNome: 'Geleia e Decoração Bento Cake', gastoPorFornada: 0.08, fornadasPossiveis: 3 },
    ],
  },
];

const EMBALAGENS_ESTOQUE_MOCK: EstoqueEmbalagem[] = [
  {
    id: 'emb-1',
    nome: 'Caixa Cookie Kraft c/ Visor (6 un)',
    quantidadeAtual: 120,
    unidade: 'un',
    minimoSeguranca: 30,
    precoEstimadoCompra: 64.90,
    emoji: '📦',
    usadoEm: 'Caixas de Cookies Degustação',
  },
  {
    id: 'emb-2',
    nome: 'Caixa Bentô Cake Biodegradável',
    quantidadeAtual: 14,
    unidade: 'un',
    minimoSeguranca: 25, // ALERTA!
    precoEstimadoCompra: 98.00,
    emoji: '🧁',
    usadoEm: 'Bentô Cakes e Mini Tortas',
  },
  {
    id: 'emb-3',
    nome: 'Fita de Cetim Dourada Champagne 15mm',
    quantidadeAtual: 2.5,
    unidade: 'rolos (50m)',
    minimoSeguranca: 1.0,
    precoEstimadoCompra: 19.90,
    emoji: '🎀',
    usadoEm: 'Laços para Presente',
  },
  {
    id: 'emb-4',
    nome: 'Saco Celofane Transparente 15x25cm',
    quantidadeAtual: 350,
    unidade: 'un',
    minimoSeguranca: 100,
    precoEstimadoCompra: 18.50,
    emoji: '🛍️',
    usadoEm: 'Cookies Individuais de Balcão',
  },
];

export default function EstoqueCentralScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [activeTab, setActiveTab] = useState<EstoqueTab>('produtos');
  const [searchQuery, setSearchQuery] = useState('');
  const [produtosEstoque, setProdutosEstoque] = useState<EstoqueProduto[]>(PRODUTOS_ESTOQUE_MOCK);
  const [ingredientesEstoque, setIngredientesEstoque] = useState<EstoqueIngrediente[]>(INGREDIENTES_ESTOQUE_MOCK);
  const [embalagensEstoque, setEmbalagensEstoque] = useState<EstoqueEmbalagem[]>(EMBALAGENS_ESTOQUE_MOCK);

  // Modal de Ajuste Rápido (+ / -)
  const [modalAjusteVisible, setModalAjusteVisible] = useState(false);
  const [itemAjusteNome, setItemAjusteNome] = useState('');
  const [itemAjusteTipo, setItemAjusteTipo] = useState<'assado' | 'congelado' | 'ingrediente' | 'embalagem'>('assado');
  const [itemAjusteId, setItemAjusteId] = useState('');
  const [ajusteQtdInput, setAjusteQtdInput] = useState('1');

  // Notificação copiada
  const [copiadoNotice, setCopiadoNotice] = useState(false);

  // Cálculos da Lista de Compras Inteligente (Tudo abaixo do mínimo)
  const listaComprasSugerida = useMemo(() => {
    const ingredientesComprar = ingredientesEstoque
      .filter(i => i.quantidadeAtual <= i.minimoSeguranca)
      .map(i => ({
        id: i.id,
        tipo: 'Ingrediente',
        nome: i.nome,
        atual: `${i.quantidadeAtual} ${i.unidade}`,
        minimo: `${i.minimoSeguranca} ${i.unidade}`,
        sugerido: `${(i.minimoSeguranca * 2 - i.quantidadeAtual).toFixed(1)} ${i.unidade}`,
        precoEstimado: i.precoEstimadoCompra,
        emoji: i.emoji,
      }));

    const embalagensComprar = embalagensEstoque
      .filter(e => e.quantidadeAtual <= e.minimoSeguranca)
      .map(e => ({
        id: e.id,
        tipo: 'Embalagem',
        nome: e.nome,
        atual: `${e.quantidadeAtual} ${e.unidade}`,
        minimo: `${e.minimoSeguranca} ${e.unidade}`,
        sugerido: `${Math.round(e.minimoSeguranca * 2 - e.quantidadeAtual)} ${e.unidade}`,
        precoEstimado: e.precoEstimadoCompra,
        emoji: e.emoji,
      }));

    return [...ingredientesComprar, ...embalagensComprar];
  }, [ingredientesEstoque, embalagensEstoque]);

  const custoTotalEstimadoCompras = listaComprasSugerida.reduce((acc, curr) => acc + curr.precoEstimado, 0);

  // Formatar Moeda
  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Copiar lista de compras para WhatsApp
  const handleCopiarWhatsApp = () => {
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    let texto = `📋 *LISTA DE COMPRAS & REPOSIÇÃO • ATELIÊ KIPI*\nData: ${dataAtual}\n\n`;

    listaComprasSugerida.forEach(item => {
      texto += `${item.emoji} *${item.nome}* (${item.tipo})\n`;
      texto += `   • Estoque atual: ${item.atual} | Mínimo: ${item.minimo}\n`;
      texto += `   • Sugestão de compra: *${item.sugerido}*\n\n`;
    });

    texto += `💰 *Valor Estimado Total: ${formatMoney(custoTotalEstimadoCompras)}*\n`;
    texto += `Gerado automaticamente pelo Sistema Kipi.`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(texto);
    }
    setCopiadoNotice(true);
    setTimeout(() => setCopiadoNotice(false), 3000);
  };

  // Executar Ajuste de Estoque (+ ou -)
  const handleConfirmarAjuste = (delta: number) => {
    const qtd = parseFloat(ajusteQtdInput.replace(',', '.')) || 0;
    if (qtd <= 0) return;
    const finalDelta = delta * qtd;

    if (itemAjusteTipo === 'assado') {
      setProdutosEstoque(prev =>
        prev.map(p => (p.id === itemAjusteId ? { ...p, estoqueAssado: Math.max(0, p.estoqueAssado + finalDelta) } : p))
      );
    } else if (itemAjusteTipo === 'congelado') {
      setProdutosEstoque(prev =>
        prev.map(p => (p.id === itemAjusteId ? { ...p, estoqueCongelado: Math.max(0, p.estoqueCongelado + finalDelta) } : p))
      );
    } else if (itemAjusteTipo === 'ingrediente') {
      setIngredientesEstoque(prev =>
        prev.map(i => (i.id === itemAjusteId ? { ...i, quantidadeAtual: Math.max(0, i.quantidadeAtual + finalDelta) } : i))
      );
    } else if (itemAjusteTipo === 'embalagem') {
      setEmbalagensEstoque(prev =>
        prev.map(e => (e.id === itemAjusteId ? { ...e, quantidadeAtual: Math.max(0, e.quantidadeAtual + finalDelta) } : e))
      );
    }

    setModalAjusteVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screenWrapper}>
        {/* SIDEBAR MODULAR */}
        <Sidebar activeRoute="/estoque" />

        {/* CONTEÚDO PRINCIPAL */}
        <View style={styles.mainContainer}>
          {/* CABEÇALHO */}
          <View style={styles.topHeader}>
            <View style={styles.headerTitleCol}>
              <View style={styles.headerBadgeRow}>
                <View style={styles.activeDot} />
                <Text style={styles.headerCategoryBadge}>CONTROLE GERAL DE MATERIAIS & VITRINE</Text>
                <View style={styles.systemBluePill}>
                  <Text style={styles.systemBluePillText}>KIPI ATELIÊ</Text>
                </View>
              </View>
              <Text style={styles.pageTitle}>Estoque Central</Text>
              <Text style={styles.pageSubtitle}>
                Acompanhe o estoque de produtos prontos, massas congeladas no freezer, insumos com cálculo de fornadas e lista de compras.
              </Text>
            </View>

            {/* Ações no Topo */}
            <View style={styles.topActionsRow}>
              {listaComprasSugerida.length > 0 && (
                <TouchableOpacity
                  style={styles.btnListaAlerta}
                  onPress={() => setActiveTab('compras')}>
                  <Feather name="shopping-cart" size={15} color="#DC2626" />
                  <Text style={styles.btnListaAlertaText}>
                    {listaComprasSugerida.length} itens para repor!
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* =========================================================================
              SELETOR DE ABAS PRINCIPAIS (DESIGN MODERNO, FLUIDO & SEM SCROLL)
          ========================================================================== */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'produtos' && styles.tabButtonActive]}
              onPress={() => setActiveTab('produtos')}>
              <Text style={{ fontSize: 16 }}>🧁</Text>
              <Text style={[styles.tabButtonText, activeTab === 'produtos' && styles.tabButtonTextActive]}>
                Produtos (Vitrine & Congelados)
              </Text>
              <View style={[styles.tabBadge, activeTab === 'produtos' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'produtos' && styles.tabBadgeTextActive]}>
                  {produtosEstoque.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'ingredientes' && styles.tabButtonActive]}
              onPress={() => setActiveTab('ingredientes')}>
              <Text style={{ fontSize: 16 }}>🥫</Text>
              <Text style={[styles.tabButtonText, activeTab === 'ingredientes' && styles.tabButtonTextActive]}>
                Ingredientes & Rendimento
              </Text>
              <View style={[styles.tabBadge, activeTab === 'ingredientes' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'ingredientes' && styles.tabBadgeTextActive]}>
                  {ingredientesEstoque.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'embalagens' && styles.tabButtonActive]}
              onPress={() => setActiveTab('embalagens')}>
              <Text style={{ fontSize: 16 }}>📦</Text>
              <Text style={[styles.tabButtonText, activeTab === 'embalagens' && styles.tabButtonTextActive]}>
                Embalagens & Apresentação
              </Text>
              <View style={[styles.tabBadge, activeTab === 'embalagens' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'embalagens' && styles.tabBadgeTextActive]}>
                  {embalagensEstoque.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'compras' && styles.tabButtonActive]}
              onPress={() => setActiveTab('compras')}>
              <Text style={{ fontSize: 16 }}>🛒</Text>
              <Text style={[styles.tabButtonText, activeTab === 'compras' && styles.tabButtonTextActive]}>
                Lista de Compras Automática
              </Text>
              {listaComprasSugerida.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: DANGER_TINT }]}>
                  <Text style={[styles.tabBadgeText, { color: DANGER_RED }]}>
                    {listaComprasSugerida.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* =========================================================================
              CONTEÚDO DA ABA 1: PRODUTOS (VITRINE & CONGELADOS)
          ========================================================================== */}
          {activeTab === 'produtos' && (
            <ScrollView style={styles.tabContentScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.cardsGrid}>
                {produtosEstoque.map(p => {
                  const assadoBaixo = p.estoqueAssado <= p.minimoAssado;
                  const congeladoBaixo = p.estoqueCongelado <= p.minimoCongelado;

                  return (
                    <View key={p.id} style={[styles.stockCard, (assadoBaixo || congeladoBaixo) && styles.stockCardWarning]}>
                      <View style={styles.stockCardTop}>
                        <View style={styles.prodAvatar}>
                          <Text style={{ fontSize: 24 }}>{p.fotoEmoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prodCategory}>{p.categoria}</Text>
                          <Text style={styles.prodName}>{p.nome}</Text>
                          <Text style={styles.prodPrice}>{formatMoney(p.precoVenda)}</Text>
                        </View>
                      </View>

                      {/* DUPLO STATUS DE ESTOQUE: ASSADO (VENDA) E CONGELADO (FREEZER) */}
                      <View style={styles.dualStockBox}>
                        {/* 1. Assados na Vitrine */}
                        <View style={styles.dualStockCol}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={styles.dualStockLabel}>♨️ Assados (Vitrine)</Text>
                          </View>
                          <Text style={[styles.dualStockNumber, { color: OVEN_ORANGE }]}>
                            {p.estoqueAssado} <Text style={{ fontSize: 12, color: '#64748B' }}>un</Text>
                          </Text>
                          <Text style={styles.dualStockSub}>Diminui com vendas</Text>
                          {assadoBaixo && (
                            <View style={styles.alertPillOven}>
                              <Text style={styles.alertPillOvenText}>🔥 Assar mais!</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.dualStockDivider} />

                        {/* 2. Congelados no Freezer */}
                        <View style={styles.dualStockCol}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={styles.dualStockLabel}>🧊 No Freezer</Text>
                          </View>
                          <Text style={[styles.dualStockNumber, { color: FREEZER_CYAN }]}>
                            {p.estoqueCongelado} <Text style={{ fontSize: 12, color: '#64748B' }}>un</Text>
                          </Text>
                          <Text style={styles.dualStockSub}>Prontos para assar</Text>
                          {congeladoBaixo && (
                            <View style={styles.alertPillFreezer}>
                              <Text style={styles.alertPillFreezerText}>🧊 Fazer massa!</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Ações de Ajuste Rápido */}
                      <View style={styles.stockCardActions}>
                        <TouchableOpacity
                          style={styles.btnAjustarSmall}
                          onPress={() => {
                            setItemAjusteNome(p.nome);
                            setItemAjusteTipo('assado');
                            setItemAjusteId(p.id);
                            setAjusteQtdInput('1');
                            setModalAjusteVisible(true);
                          }}>
                          <Feather name="edit-2" size={12} color="#64748B" />
                          <Text style={styles.btnAjustarSmallText}>Ajustar Vitrine</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnAjustarSmall}
                          onPress={() => {
                            setItemAjusteNome(p.nome);
                            setItemAjusteTipo('congelado');
                            setItemAjusteId(p.id);
                            setAjusteQtdInput('6');
                            setModalAjusteVisible(true);
                          }}>
                          <Feather name="edit-2" size={12} color="#64748B" />
                          <Text style={styles.btnAjustarSmallText}>Ajustar Freezer</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* =========================================================================
              CONTEÚDO DA ABA 2: INGREDIENTES & RENDIMENTO (QUANTAS RECEITAS DÁ PRA FAZER)
          ========================================================================== */}
          {activeTab === 'ingredientes' && (
            <ScrollView style={styles.tabContentScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.tableCard}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 2 }]}>INGREDIENTE</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>ESTOQUE ATUAL</Text>
                  <Text style={[styles.th, { flex: 1.1 }]}>MÍNIMO</Text>
                  <Text style={[styles.th, { flex: 2.2 }]}>CAPACIDADE DE FORNADAS (RENDIMENTO)</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
                  <Text style={[styles.th, { width: 70, textAlign: 'right' }]}>AJUSTE</Text>
                </View>

                {ingredientesEstoque.map((ing, idx) => {
                  const isAlerta = ing.quantidadeAtual <= ing.minimoSeguranca;
                  const isEven = idx % 2 === 0;

                  return (
                    <View key={ing.id} style={[styles.tableRow, isEven && styles.tableRowEven, isAlerta && styles.tableRowAlert]}>
                      <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <View style={styles.tableAvatar}>
                          <Text style={{ fontSize: 18 }}>{ing.emoji}</Text>
                        </View>
                        <View>
                          <Text style={styles.tableName}>{ing.nome}</Text>
                          <Text style={styles.tableSub}>{ing.tipo} • {ing.armazenamento}</Text>
                        </View>
                      </View>

                      <View style={[styles.td, { flex: 1.2 }]}>
                        <Text style={[styles.tableStockNumber, isAlerta && { color: DANGER_RED }]}>
                          {ing.quantidadeAtual} {ing.unidade}
                        </Text>
                      </View>

                      <View style={[styles.td, { flex: 1.1 }]}>
                        <Text style={styles.tableSub}>{ing.minimoSeguranca} {ing.unidade}</Text>
                      </View>

                      {/* Cálculo de quantas receitas dá para fazer */}
                      <View style={[styles.td, { flex: 2.2 }]}>
                        {ing.consumoPorFornada.map((c, i) => (
                          <View key={i} style={styles.recipeCapacityPill}>
                            <Text style={styles.recipeCapacityText}>
                              {c.receitaNome}: <Text style={{ fontWeight: '800', color: c.fornadasPossiveis <= 3 ? DANGER_RED : SUCCESS_GREEN }}>
                                até {c.fornadasPossiveis} fornadas
                              </Text>
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={[styles.td, { flex: 1.2 }]}>
                        <View style={[styles.statusBadge, isAlerta ? styles.statusBadgeAlert : styles.statusBadgeSafe]}>
                          <Text style={[styles.statusBadgeText, isAlerta ? styles.statusBadgeTextAlert : styles.statusBadgeTextSafe]}>
                            {isAlerta ? '⚠️ Repor Urgente' : '✅ Estoque Seguro'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.td, { width: 70, alignItems: 'flex-end' }]}>
                        <TouchableOpacity
                          style={styles.btnIconAjuste}
                          onPress={() => {
                            setItemAjusteNome(ing.nome);
                            setItemAjusteTipo('ingrediente');
                            setItemAjusteId(ing.id);
                            setAjusteQtdInput('1');
                            setModalAjusteVisible(true);
                          }}>
                          <Feather name="plus-circle" size={17} color={KIPI_BLUE_ACCENT} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* =========================================================================
              CONTEÚDO DA ABA 3: EMBALAGENS
          ========================================================================== */}
          {activeTab === 'embalagens' && (
            <ScrollView style={styles.tabContentScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.tableCard}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 2 }]}>EMBALAGEM</Text>
                  <Text style={[styles.th, { flex: 1.4 }]}>ESTOQUE ATUAL</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>MÍNIMO</Text>
                  <Text style={[styles.th, { flex: 2 }]}>APLICAÇÃO / UTILIZAÇÃO</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
                  <Text style={[styles.th, { width: 70, textAlign: 'right' }]}>AJUSTE</Text>
                </View>

                {embalagensEstoque.map((emb, idx) => {
                  const isAlerta = emb.quantidadeAtual <= emb.minimoSeguranca;
                  const isEven = idx % 2 === 0;

                  return (
                    <View key={emb.id} style={[styles.tableRow, isEven && styles.tableRowEven, isAlerta && styles.tableRowAlert]}>
                      <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <View style={styles.tableAvatar}>
                          <Text style={{ fontSize: 18 }}>{emb.emoji}</Text>
                        </View>
                        <Text style={styles.tableName}>{emb.nome}</Text>
                      </View>

                      <View style={[styles.td, { flex: 1.4 }]}>
                        <Text style={[styles.tableStockNumber, isAlerta && { color: DANGER_RED }]}>
                          {emb.quantidadeAtual} {emb.unidade}
                        </Text>
                      </View>

                      <View style={[styles.td, { flex: 1.2 }]}>
                        <Text style={styles.tableSub}>{emb.minimoSeguranca} {emb.unidade}</Text>
                      </View>

                      <View style={[styles.td, { flex: 2 }]}>
                        <Text style={styles.tableSub}>{emb.usadoEm}</Text>
                      </View>

                      <View style={[styles.td, { flex: 1.2 }]}>
                        <View style={[styles.statusBadge, isAlerta ? styles.statusBadgeAlert : styles.statusBadgeSafe]}>
                          <Text style={[styles.statusBadgeText, isAlerta ? styles.statusBadgeTextAlert : styles.statusBadgeTextSafe]}>
                            {isAlerta ? '⚠️ Baixo' : '✅ Seguro'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.td, { width: 70, alignItems: 'flex-end' }]}>
                        <TouchableOpacity
                          style={styles.btnIconAjuste}
                          onPress={() => {
                            setItemAjusteNome(emb.nome);
                            setItemAjusteTipo('embalagem');
                            setItemAjusteId(emb.id);
                            setAjusteQtdInput('10');
                            setModalAjusteVisible(true);
                          }}>
                          <Feather name="plus-circle" size={17} color={KIPI_BLUE_ACCENT} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* =========================================================================
              CONTEÚDO DA ABA 4: LISTA DE COMPRAS INTELIGENTE (INTEGRADA NA TELA)
          ========================================================================== */}
          {activeTab === 'compras' && (
            <ScrollView style={styles.tabContentScroll} showsVerticalScrollIndicator={false}>
              {/* Banner de Ação de Compras */}
              <View style={styles.comprasHeaderBanner}>
                <View>
                  <Text style={styles.comprasBannerTitle}>Lista de Reposição de Compras</Text>
                  <Text style={styles.comprasBannerSubtitle}>
                    Itens que atingiram o estoque de segurança. Total estimado: <Text style={{ fontWeight: '800', color: '#0F172A' }}>{formatMoney(custoTotalEstimadoCompras)}</Text>
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={styles.btnWhatsappCompras}
                    onPress={handleCopiarWhatsApp}>
                    <Feather name="share-2" size={15} color="#FFFFFF" />
                    <Text style={styles.btnWhatsappComprasText}>
                      {copiadoNotice ? '✅ Copiado com Sucesso!' : 'Copiar para WhatsApp'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {listaComprasSugerida.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="check-circle" size={36} color={SUCCESS_GREEN} />
                  <Text style={styles.emptyTitle}>Tudo em dia com seu estoque!</Text>
                  <Text style={styles.emptySubtitle}>Nenhum ingrediente ou embalagem abaixo do mínimo no momento.</Text>
                </View>
              ) : (
                <View style={styles.tableCard}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.th, { flex: 2.5 }]}>ITEM A COMPRAR</Text>
                    <Text style={[styles.th, { flex: 1.2 }]}>TIPO</Text>
                    <Text style={[styles.th, { flex: 1.2 }]}>ESTOQUE ATUAL</Text>
                    <Text style={[styles.th, { flex: 1.2 }]}>ESTOQUE MÍNIMO</Text>
                    <Text style={[styles.th, { flex: 1.5 }]}>SUGESTÃO COMPRA</Text>
                    <Text style={[styles.th, { flex: 1.4 }]}>PREÇO ESTIMADO</Text>
                  </View>

                  {listaComprasSugerida.map((item, idx) => (
                    <View key={item.id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}>
                      <View style={[styles.td, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                        <Text style={styles.tableName}>{item.nome}</Text>
                      </View>
                      <View style={[styles.td, { flex: 1.2 }]}>
                        <Text style={styles.tableSub}>{item.tipo}</Text>
                      </View>
                      <View style={[styles.td, { flex: 1.2 }]}>
                        <Text style={[styles.tableStockNumber, { color: DANGER_RED }]}>{item.atual}</Text>
                      </View>
                      <View style={[styles.td, { flex: 1.2 }]}>
                        <Text style={styles.tableSub}>{item.minimo}</Text>
                      </View>
                      <View style={[styles.td, { flex: 1.5 }]}>
                        <View style={styles.suggestPill}>
                          <Text style={styles.suggestPillText}>+ {item.sugerido}</Text>
                        </View>
                      </View>
                      <View style={[styles.td, { flex: 1.4 }]}>
                        <Text style={[styles.tableName, { color: SUCCESS_GREEN }]}>{formatMoney(item.precoEstimado)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* =========================================================================
          MODAL DE AJUSTE RÁPIDO DE QUANTIDADE
      ========================================================================== */}
      <Modal
        visible={modalAjusteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalAjusteVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSmallBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Ajustar Estoque</Text>
                <Text style={styles.modalSubtitle}>{itemAjusteNome}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalAjusteVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ marginVertical: 14 }}>
              <Text style={styles.inputLabel}>QUANTIDADE:</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={ajusteQtdInput}
                onChangeText={setAjusteQtdInput}
              />
            </View>

            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.btnAjusteSubtrair}
                onPress={() => handleConfirmarAjuste(-1)}>
                <Feather name="minus" size={16} color="#DC2626" />
                <Text style={styles.btnAjusteSubtrairText}>Dar Baixa (-)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnAjusteSomar}
                onPress={() => handleConfirmarAjuste(1)}>
                <Feather name="plus" size={16} color="#16A34A" />
                <Text style={styles.btnAjusteSomarText}>Dar Entrada (+)</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    backgroundColor: KIPI_BLUE_ACCENT,
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
  btnListaAlerta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DANGER_TINT,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  btnListaAlertaText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: DANGER_RED,
  },

  // ABAS
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 4,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: KIPI_BLUE_TINT,
  },
  tabButtonText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  tabBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBadgeTextActive: {
    color: KIPI_BLUE_ACCENT,
  },

  tabContentScroll: {
    flex: 1,
  },

  // CARDS DE PRODUTOS
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingBottom: 30,
  },
  stockCard: {
    width: '32%',
    minWidth: 290,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stockCardWarning: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFCF9',
  },
  stockCardTop: {
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
  },
  prodName: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  prodPrice: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: SUCCESS_GREEN,
    marginTop: 2,
  },
  dualStockBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  dualStockCol: {
    flex: 1,
  },
  dualStockDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },
  dualStockLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  dualStockNumber: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 2,
  },
  dualStockSub: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#94A3B8',
  },
  alertPillOven: {
    backgroundColor: OVEN_TINT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  alertPillOvenText: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: OVEN_ORANGE,
  },
  alertPillFreezer: {
    backgroundColor: FREEZER_TINT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  alertPillFreezerText: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: FREEZER_CYAN,
  },
  stockCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAjustarSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  btnAjustarSmallText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  // TABELAS
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 30,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  th: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowEven: {
    backgroundColor: '#FAFCFE',
  },
  tableRowAlert: {
    backgroundColor: '#FFFBF9',
  },
  td: {
    justifyContent: 'center',
  },
  tableAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableName: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  tableSub: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
  },
  tableStockNumber: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  recipeCapacityPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
    alignSelf: 'flex-start',
  },
  recipeCapacityText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#475569',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  statusBadgeSafe: {
    backgroundColor: SUCCESS_TINT,
  },
  statusBadgeAlert: {
    backgroundColor: DANGER_TINT,
  },
  statusBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeTextSafe: {
    color: SUCCESS_GREEN,
  },
  statusBadgeTextAlert: {
    color: DANGER_RED,
  },
  btnIconAjuste: {
    padding: 4,
  },

  // LISTA DE COMPRAS
  comprasHeaderBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  comprasBannerTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  comprasBannerSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  btnWhatsappCompras: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  btnWhatsappComprasText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  suggestPill: {
    backgroundColor: SUCCESS_TINT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  suggestPillText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 11,
    fontWeight: '800',
    color: SUCCESS_GREEN,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
  },

  // MODAL AJUSTE
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSmallBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  inputLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  modalInput: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  btnAjusteSubtrair: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  btnAjusteSubtrairText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: DANGER_RED,
  },
  btnAjusteSomar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  btnAjusteSomarText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: SUCCESS_GREEN,
  },
});
