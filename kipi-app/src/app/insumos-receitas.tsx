import { paraCelular } from '@/lib/responsivo';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Sidebar from '@/components/Sidebar';
import { useEhCelular } from '@/lib/layout';
import InsumosMobile from '@/components/insumos-mobile/InsumosMobile';
import {
  useInsumos,
  salvarInsumo,
  ajustarEstoqueInsumo,
  custoPorUnidadeEstoque,
  fatorDaUnidade,
  unidadeFracionadaDe,
  useFichas,
  calcularFicha,
  margemReal,
  definirHoraTrabalhada,
  MARGEM_MINIMA,
  type Insumo,
} from '@/lib/insumos';
import { useEstoqueVitrine } from '@/lib/estoqueVitrine';
import { PageHeaderTitulo, TOPO_COMPACTO } from '@/components/PageHeader';
import FichaTecnicaModal from '@/components/FichaTecnicaModal';
import { dinheiroParaCampo, lerDinheiro, mascaraDinheiro } from '@/lib/dinheiro';

const EMOJI_CATEGORIA: Record<string, string> = {
  Cookies: '🍪',
  'Bolos & Bentos': '🎂',
  Macarons: '✨',
  'Doces Finos': '🍬',
  Folhados: '🥐',
  Sobremesas: '🥧',
  Bebidas: '☕',
  Presentes: '🎁',
};

// Insumos vêm da lista única compartilhada (Estoque Central, Produção, Produtos e Visão Geral)
export type InsumoItem = Insumo;

// ============================================================================
// TIPOGRAFIA & CONSTANTES DE TEMA (AZUL DO SISTEMA KIPI / ATELIÊ)
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: 'System' });

// Azul Oficial Kipi (Iced Denim & Variações)
const KIPI_BLUE = '#9E5D25';
const KIPI_BLUE_DARK = '#7A4520';
const KIPI_BLUE_TINT = '#ECEBFA';
const KIPI_BLUE_ACCENT = '#4B4FC4';
const KIPI_BLUE_LIGHT = '#F8F6F2';
const KIPI_FROST_BG = '#F8F6F2';

// Tipos de visualização e filtros
export type ViewMode = 'cards' | 'grid' | 'lista';
export type TipoInsumoFilter = 'todos' | 'ingrediente' | 'embalagem';
export type StatusFilter = 'todos' | 'ativos' | 'inativos';
export type ArmazenamentoFilter = 'todos' | 'seco' | 'refrigerado' | 'congelado' | 'perecivel' | 'in_natura';
export type NivelEstoqueFilter = 'todos' | 'critico' | 'seguro';

// OPÇÕES DE UNIDADES
const UNIDADES_INGREDIENTES = [
  { value: 'kg', label: 'kg (Quilograma)', isCommon: true },
  { value: 'g', label: 'g (Grama)', isCommon: true },
  { value: 'L', label: 'L (Litro)', isCommon: true },
  { value: 'ml', label: 'ml (Mililitro)', isCommon: true },
  { value: 'un', label: 'un (Unidade)', isCommon: true },
  { value: 'pct', label: 'pct (Pacote)', isCommon: true },
  { value: 'lata', label: 'lata (Lata)', isCommon: false },
  { value: 'pote', label: 'pote (Pote)', isCommon: false },
  { value: 'cx', label: 'cx (Caixa)', isCommon: false },
  { value: 'garrafa', label: 'garrafa (Garrafa)', isCommon: false },
  { value: 'balde', label: 'balde (Balde)', isCommon: false },
  { value: 'tb', label: 'tb (Tubo / Bisnaga)', isCommon: false },
  { value: 'medida', label: 'xícara / colher (Medida)', isCommon: false },
];

const UNIDADES_EMBALAGENS = [
  { value: 'un', label: 'un (Unidade individual)', isCommon: true },
  { value: 'pacote', label: 'pacote (Pacote)', isCommon: true },
  { value: 'caixa', label: 'caixa (Caixa)', isCommon: true },
  { value: 'rolo', label: 'rolo (Rolo)', isCommon: true },
  { value: 'duzia', label: 'duzia (Dúzia)', isCommon: true },
  { value: 'fardo', label: 'fardo (Fardo)', isCommon: true },
  { value: 'm', label: 'm (Metro)', isCommon: true },
  { value: 'cento', label: 'cento (100 unidades)', isCommon: false },
  { value: 'milheiro', label: 'milheiro (1000 unidades)', isCommon: false },
];

const ARMAZENAMENTOS_LIST = [
  { id: 'seco', label: 'Seco', emoji: '🌾', desc: 'Despensa / Ambiente' },
  { id: 'refrigerado', label: 'Refrigerado', emoji: '❄️', desc: '0°C a 8°C' },
  { id: 'congelado', label: 'Congelado', emoji: '🧊', desc: '-18°C' },
  { id: 'perecivel', label: 'Perecível', emoji: '⏳', desc: 'Consumo rápido' },
  { id: 'in_natura', label: 'In Natura', emoji: '🍃', desc: 'Hortifrúti / Fresco' },
];

// Celular: insumos, receitas, detalhe e cadastro próprios; computador: tela completa abaixo
export default function InsumosReceitasScreen() {
  const celular = useEhCelular();
  return celular ? <InsumosMobile /> : <InsumosReceitasDesktop />;
}

function InsumosReceitasDesktop() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  // Estados principais
  const [tabPrincipal, setTabPrincipal] = useState<'insumos' | 'receitas'>('insumos');
  // Lista única de insumos: o que muda aqui aparece no Estoque Central, na Produção e na Visão Geral
  const insumosList = useInsumos();
  // Fichas técnicas: as mesmas da Produção, Estoque Central e Produtos
  const { fichas, horaTrabalhada } = useFichas();
  const vitrine = useEstoqueVitrine();
  const [horaTxt, setHoraTxt] = useState(dinheiroParaCampo(horaTrabalhada));
  const [fichaAberta, setFichaAberta] = useState<{ produtoId: string | null } | null>(null);

  // Filtros de Insumos
  const [searchQuery, setSearchQuery] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoInsumoFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [armazenamentoFilter, setArmazenamentoFilter] = useState<ArmazenamentoFilter>('todos');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  // Modais
  const [modalNovoInsumoVisible, setModalNovoInsumoVisible] = useState(false);
  const [modalDetalhesVisible, setModalDetalhesVisible] = useState(false);
  // Guarda só o id: o dossiê mostra sempre o estoque atual (inclusive baixas feitas pela Produção)
  const [insumoSelecionadoId, setInsumoSelecionadoId] = useState<string | null>(null);
  const insumoSelecionado = insumosList.find((i) => i.id === insumoSelecionadoId) ?? null;
  const setInsumoSelecionado = (i: InsumoItem | null) => setInsumoSelecionadoId(i?.id ?? null);

  // Formulário de Novo Insumo
  const [formTipo, setFormTipo] = useState<'ingrediente' | 'embalagem'>('ingrediente');
  const [formNome, setFormNome] = useState('');
  const [formUnidade, setFormUnidade] = useState('kg');
  const [formPreco, setFormPreco] = useState('');
  const [formConteudo, setFormConteudo] = useState('1');
  const [formArmazenamento, setFormArmazenamento] = useState<'seco' | 'refrigerado' | 'congelado' | 'perecivel' | 'in_natura'>('seco');
  const [formEstoqueAtual, setFormEstoqueAtual] = useState('');
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState('');
  const [formMarca, setFormMarca] = useState('');
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [formErro, setFormErro] = useState<string | null>(null);

  // ==========================================================================
  // FILTRAGEM DOS INSUMOS
  // ==========================================================================
  const insumosFiltrados = useMemo(() => {
    return insumosList.filter(item => {
      // 1. Filtro Tipo
      if (tipoFilter !== 'todos' && item.tipo !== tipoFilter) {
        return false;
      }

      // 2. Filtro Status
      if (statusFilter === 'ativos' && item.status !== 'ativo') {
        return false;
      }
      if (statusFilter === 'inativos' && item.status !== 'inativo') {
        return false;
      }

      // 3. Filtro Armazenamento
      if (armazenamentoFilter !== 'todos' && item.armazenamento !== armazenamentoFilter) {
        return false;
      }

      // 4. Busca Livre (nome, marca, armazenamento, receitas)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchNome = item.nome.toLowerCase().includes(query);
        const matchMarca = item.marcaFornecedor?.toLowerCase().includes(query) ?? false;
        const matchUnidade = item.unidade.toLowerCase().includes(query);
        const matchReceitas = item.receitasOndeUsado?.some(r => r.toLowerCase().includes(query)) ?? false;
        if (!matchNome && !matchMarca && !matchUnidade && !matchReceitas) {
          return false;
        }
      }

      return true;
    });
  }, [insumosList, tipoFilter, statusFilter, armazenamentoFilter, searchQuery]);

  // Contagens para badges dinâmicos
  const totalInsumos = insumosList.length;
  const totalIngredientes = insumosList.filter(i => i.tipo === 'ingrediente').length;
  const totalEmbalagens = insumosList.filter(i => i.tipo === 'embalagem').length;
  const totalAlerta = insumosList.filter(i => i.quantidadeEstoque <= i.estoqueMinimo).length;
  const valorTotalEstoque = insumosList.reduce((acc, curr) => acc + curr.quantidadeEstoque * custoPorUnidadeEstoque(curr), 0);

  // Formatador de Moeda R$
  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Abrir Modal de Cadastro
  const handleAbrirNovoInsumo = (tipoPref: 'ingrediente' | 'embalagem' = 'ingrediente') => {
    setFormTipo(tipoPref);
    setFormNome('');
    setFormUnidade(tipoPref === 'ingrediente' ? 'kg' : 'pacote');
    setFormPreco('');
    setFormConteudo(tipoPref === 'ingrediente' ? '1000' : '50');
    setFormArmazenamento('seco');
    setFormEstoqueAtual('');
    setFormEstoqueMinimo('');
    setFormMarca('');
    setFormStatus('ativo');
    setFormErro(null);
    setModalNovoInsumoVisible(true);
  };

  // Salvar Novo Insumo
  const handleSalvarNovoInsumo = () => {
    if (!formNome.trim()) {
      setFormErro('Por favor, informe o nome do item.');
      return;
    }

    const precoNum = parseFloat(formPreco.replace(/\./g, '').replace(',', '.'));
    if (isNaN(precoNum) || precoNum <= 0) {
      setFormErro('Por favor, digite um preço válido (ex: 29,90).');
      return;
    }

    const conteudoNum = parseFloat(formConteudo.replace(',', '.')) || 1;
    const custoCalc = conteudoNum > 0 ? (precoNum / conteudoNum) : precoNum;

    const estoqueAtualNum = parseFloat(formEstoqueAtual.replace(',', '.')) || 0;
    const estoqueMinimoNum = parseFloat(formEstoqueMinimo.replace(',', '.')) || 0;

    const novo: InsumoItem = {
      id: `ins-${Date.now()}`,
      nome: formNome.trim(),
      tipo: formTipo,
      unidade: formUnidade,
      precoPago: precoNum,
      conteudoEmbalagem: conteudoNum,
      unidadeFracionada: unidadeFracionadaDe(formTipo, formUnidade),
      fatorFracionado: fatorDaUnidade(formUnidade, conteudoNum),
      custoUnitario: custoCalc,
      quantidadeEstoque: estoqueAtualNum,
      estoqueMinimo: estoqueMinimoNum,
      armazenamento: formArmazenamento,
      marcaFornecedor: formMarca.trim() || undefined,
      status: formStatus,
      emoji: formTipo === 'ingrediente' ? '🥫' : '📦',
      ultimaCompra: new Date().toLocaleDateString('pt-BR'),
    };

    // Entra na lista única (Estoque Central, Produção e ficha técnica de Produtos já enxergam)
    salvarInsumo(novo);
    setModalNovoInsumoVisible(false);
  };

  // Ajuste rápido de estoque (+ / -)
  const handleAjustarEstoque = (delta: number) => {
    if (!insumoSelecionado) return;
    ajustarEstoqueInsumo(insumoSelecionado.id, delta);
  };

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screenWrapper}>
        {/* SIDEBAR MODULAR OFICIAL */}
        <Sidebar activeRoute="/insumos-receitas" />

        {/* CONTEÚDO PRINCIPAL */}
        <View style={styles.mainContainer}>
          {/* TOPO: CABEÇALHO E AÇÕES RÁPIDAS */}
          <View style={styles.topHeader}>
            <PageHeaderTitulo
              etiqueta="ATELIÊ · PRODUÇÃO & CONFEITARIA"
              titulo="Insumos & Receitas"
              subtitulo="Ingredientes, embalagens e fichas técnicas para controlar seus custos."
            />

            {/* BOTÕES DE AÇÃO NO TOPO */}
            <View style={styles.headerActionsRow}>
              {/* Seletor de Módulo: Insumos vs Fichas de Receita */}
              <View style={styles.moduleSwitcher}>
                <TouchableOpacity
                  style={[styles.moduleTab, tabPrincipal === 'insumos' && styles.moduleTabActive]}
                  onPress={() => setTabPrincipal('insumos')}>
                  <Feather
                    name="layers"
                    size={15}
                    color={tabPrincipal === 'insumos' ? '#FFFDFA' : '#6B615A'}
                  />
                  <Text style={[styles.moduleTabText, tabPrincipal === 'insumos' && styles.moduleTabTextActive]}>
                    Insumos & Estoque
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.moduleTab, tabPrincipal === 'receitas' && styles.moduleTabActive]}
                  onPress={() => setTabPrincipal('receitas')}>
                  <Feather
                    name="book-open"
                    size={15}
                    color={tabPrincipal === 'receitas' ? '#FFFDFA' : '#6B615A'}
                  />
                  <Text style={[styles.moduleTabText, tabPrincipal === 'receitas' && styles.moduleTabTextActive]}>
                    Receitas
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Botão Novo Insumo */}
              <TouchableOpacity
                style={styles.btnNovoInsumo}
                onPress={() => handleAbrirNovoInsumo('ingrediente')}>
                <Feather name="plus-circle" size={17} color="#FFFDFA" />
                <Text style={styles.btnNovoInsumoText}>+ Novo Insumo</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* =========================================================================
              CARDS DE KPIS EM DESTAQUE (AZUL DO SISTEMA)
          ========================================================================== */}
          <View style={styles.kpiCardsRow}>
            {/* Card 1: Total de Insumos */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardHeader}>
                <Text style={styles.kpiLabel}>TOTAL DE INSUMOS</Text>
                <View style={[styles.kpiIconBox, { backgroundColor: KIPI_BLUE_TINT }]}>
                  <Feather name="layers" size={16} color={KIPI_BLUE} />
                </View>
              </View>
              <Text style={styles.kpiValue}>{totalInsumos}</Text>
              <Text style={styles.kpiSubtext}>Matérias-primas e insumos cadastrados</Text>
            </View>

            {/* Card 2: Ingredientes */}
            <TouchableOpacity
              style={[styles.kpiCard, tipoFilter === 'ingrediente' && styles.kpiCardActiveFilter]}
              onPress={() => setTipoFilter(tipoFilter === 'ingrediente' ? 'todos' : 'ingrediente')}>
              <View style={styles.kpiCardHeader}>
                <Text style={styles.kpiLabel}>INGREDIENTES</Text>
                <View style={[styles.kpiIconBox, { backgroundColor: '#FBF0DC' }]}>
                  <Text style={{ fontSize: 13 }}>🥫</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{totalIngredientes}</Text>
              <Text style={styles.kpiSubtext}>Chocolates, farinhas, laticínios...</Text>
            </TouchableOpacity>

            {/* Card 3: Embalagens */}
            <TouchableOpacity
              style={[styles.kpiCard, tipoFilter === 'embalagem' && styles.kpiCardActiveFilter]}
              onPress={() => setTipoFilter(tipoFilter === 'embalagem' ? 'todos' : 'embalagem')}>
              <View style={styles.kpiCardHeader}>
                <Text style={styles.kpiLabel}>EMBALAGENS</Text>
                <View style={[styles.kpiIconBox, { backgroundColor: '#ECEBFA' }]}>
                  <Text style={{ fontSize: 13 }}>📦</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{totalEmbalagens}</Text>
              <Text style={styles.kpiSubtext}>Caixas, sacos, fitas e forminhas</Text>
            </TouchableOpacity>

            {/* Card 4: Alerta de Reposição */}
            <TouchableOpacity
              style={[styles.kpiCard, totalAlerta > 0 && styles.kpiCardAlert]}
              onPress={() => {
                if (totalAlerta > 0) {
                  // Alterna filtro para ver os críticos
                }
              }}>
              <View style={styles.kpiCardHeader}>
                <Text style={[styles.kpiLabel, totalAlerta > 0 && { color: '#9A6516' }]}>
                  REPOSIÇÃO URGENTE
                </Text>
                <View style={[styles.kpiIconBox, { backgroundColor: totalAlerta > 0 ? '#FBE7E4' : '#E4F1E9' }]}>
                  <Feather
                    name={totalAlerta > 0 ? 'alert-triangle' : 'check-circle'}
                    size={16}
                    color={totalAlerta > 0 ? '#B42318' : '#2F7D55'}
                  />
                </View>
              </View>
              <Text style={[styles.kpiValue, totalAlerta > 0 && { color: '#B42318' }]}>
                {totalAlerta}
              </Text>
              <Text style={styles.kpiSubtext}>
                {totalAlerta > 0 ? 'Itens atingiram ou estão abaixo do mínimo' : 'Estoque em níveis seguros'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* =========================================================================
              SEÇÃO: INSUMOS & ESTOQUE (OU RECEITAS CONFORME ABA ATIVA)
          ========================================================================== */}
          {tabPrincipal === 'insumos' ? (
            <>
              {/* FILTRO MANEIRO SOLICITADO: TUDO JUNTO COM SELETORES ESTILIZADOS */}
              <View style={styles.filterSection}>
                {/* Linha 1: Seletor Maneiro de Tipo (Tudo, Ingredientes, Embalagens) + Busca */}
                <View style={styles.filterRowTop}>
                  {/* SELETOR MANEIRO DE TIPO (PILL TABS) */}
                  <View style={styles.coolTypeSelector}>
                    <TouchableOpacity
                      style={[styles.coolTypeBtn, tipoFilter === 'todos' && styles.coolTypeBtnActive]}
                      onPress={() => setTipoFilter('todos')}>
                      <Text style={[styles.coolTypeBtnText, tipoFilter === 'todos' && styles.coolTypeBtnTextActive]}>
                        ✨ Todos os Insumos
                      </Text>
                      <View style={[styles.coolBadge, tipoFilter === 'todos' && styles.coolBadgeActive]}>
                        <Text style={[styles.coolBadgeText, tipoFilter === 'todos' && styles.coolBadgeTextActive]}>
                          {totalInsumos}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.coolTypeBtn, tipoFilter === 'ingrediente' && styles.coolTypeBtnActive]}
                      onPress={() => setTipoFilter('ingrediente')}>
                      <Text style={[styles.coolTypeBtnText, tipoFilter === 'ingrediente' && styles.coolTypeBtnTextActive]}>
                        🥫 Ingredientes
                      </Text>
                      <View style={[styles.coolBadge, tipoFilter === 'ingrediente' && styles.coolBadgeActive]}>
                        <Text style={[styles.coolBadgeText, tipoFilter === 'ingrediente' && styles.coolBadgeTextActive]}>
                          {totalIngredientes}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.coolTypeBtn, tipoFilter === 'embalagem' && styles.coolTypeBtnActive]}
                      onPress={() => setTipoFilter('embalagem')}>
                      <Text style={[styles.coolTypeBtnText, tipoFilter === 'embalagem' && styles.coolTypeBtnTextActive]}>
                        📦 Embalagens
                      </Text>
                      <View style={[styles.coolBadge, tipoFilter === 'embalagem' && styles.coolBadgeActive]}>
                        <Text style={[styles.coolBadgeText, tipoFilter === 'embalagem' && styles.coolBadgeTextActive]}>
                          {totalEmbalagens}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* CAMPO DE BUSCA MULTI-DADO */}
                  <View style={styles.searchBox}>
                    <Feather name="search" size={17} color="#9A8F87" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar por nome, marca, unidade, receita..."
                      placeholderTextColor="#9A8F87"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="x" size={15} color="#9A8F87" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Linha 2: Filtros de Armazenamento, Status e Modo de Visualização */}
                <View style={styles.filterRowBottom}>
                  {/* Pílulas de Armazenamento */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storageScroll}>
                    <TouchableOpacity
                      style={[styles.storagePill, armazenamentoFilter === 'todos' && styles.storagePillActive]}
                      onPress={() => setArmazenamentoFilter('todos')}>
                      <Text style={[styles.storagePillText, armazenamentoFilter === 'todos' && styles.storagePillTextActive]}>
                        Todos Armazenamentos
                      </Text>
                    </TouchableOpacity>

                    {ARMAZENAMENTOS_LIST.map(arm => {
                      const isActive = armazenamentoFilter === arm.id;
                      return (
                        <TouchableOpacity
                          key={arm.id}
                          style={[styles.storagePill, isActive && styles.storagePillActive]}
                          onPress={() => setArmazenamentoFilter(isActive ? 'todos' : (arm.id as ArmazenamentoFilter))}>
                          <Text style={styles.storageEmoji}>{arm.emoji}</Text>
                          <Text style={[styles.storagePillText, isActive && styles.storagePillTextActive]}>
                            {arm.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Filtro de Status (Todos, Ativos, Inativos) */}
                  <View style={styles.statusPillsRow}>
                    <TouchableOpacity
                      style={[styles.statusPill, statusFilter === 'todos' && styles.statusPillActive]}
                      onPress={() => setStatusFilter('todos')}>
                      <Text style={[styles.statusPillText, statusFilter === 'todos' && styles.statusPillTextActive]}>
                        Todos
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.statusPill, statusFilter === 'ativos' && styles.statusPillActive]}
                      onPress={() => setStatusFilter('ativos')}>
                      <Text style={[styles.statusPillText, statusFilter === 'ativos' && styles.statusPillTextActive]}>
                        Ativos
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.statusPill, statusFilter === 'inativos' && styles.statusPillActive]}
                      onPress={() => setStatusFilter('inativos')}>
                      <Text style={[styles.statusPillText, statusFilter === 'inativos' && styles.statusPillTextActive]}>
                        Inativos
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Seletor de Modo de Visualização (Cards, Grid, Lista) */}
                  <View style={styles.viewModeSwitcher}>
                    <TouchableOpacity
                      style={[styles.viewModeBtn, viewMode === 'cards' && styles.viewModeBtnActive]}
                      onPress={() => setViewMode('cards')}
                      accessibilityLabel="Visualização em Cards">
                      <Feather
                        name="credit-card"
                        size={15}
                        color={viewMode === 'cards' ? KIPI_BLUE_ACCENT : '#6B615A'}
                      />
                      <Text style={[styles.viewModeBtnText, viewMode === 'cards' && styles.viewModeBtnTextActive]}>
                        Cards
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
                      onPress={() => setViewMode('grid')}
                      accessibilityLabel="Visualização em Grade">
                      <Feather
                        name="grid"
                        size={15}
                        color={viewMode === 'grid' ? KIPI_BLUE_ACCENT : '#6B615A'}
                      />
                      <Text style={[styles.viewModeBtnText, viewMode === 'grid' && styles.viewModeBtnTextActive]}>
                        Grid
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.viewModeBtn, viewMode === 'lista' && styles.viewModeBtnActive]}
                      onPress={() => setViewMode('lista')}
                      accessibilityLabel="Visualização em Lista">
                      <Feather
                        name="list"
                        size={15}
                        color={viewMode === 'lista' ? KIPI_BLUE_ACCENT : '#6B615A'}
                      />
                      <Text style={[styles.viewModeBtnText, viewMode === 'lista' && styles.viewModeBtnTextActive]}>
                        Lista
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* LISTAGEM DE INSUMOS DE ACORDO COM MODO SELECIONADO */}
              <ScrollView
                style={styles.contentScrollView}
                contentContainerStyle={styles.contentScrollContent}
                showsVerticalScrollIndicator={false}>
                {insumosFiltrados.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <View style={styles.emptyIconCircle}>
                      <Feather name="search" size={28} color="#9A8F87" />
                    </View>
                    <Text style={styles.emptyTitle}>Nenhum insumo encontrado</Text>
                    <Text style={styles.emptySubtitle}>
                      Tente alterar os filtros de busca ou cadastre um novo ingrediente/embalagem.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyActionBtn}
                      onPress={() => handleAbrirNovoInsumo('ingrediente')}>
                      <Feather name="plus-circle" size={16} color="#FFFDFA" />
                      <Text style={styles.emptyActionBtnText}>Cadastrar Insumo</Text>
                    </TouchableOpacity>
                  </View>
                ) : viewMode === 'cards' ? (
                  // MODO 1: CARDS DETALHADOS
                  <View style={styles.cardsContainer}>
                    {insumosFiltrados.map(item => {
                      const isAlert = item.quantidadeEstoque <= item.estoqueMinimo;
                      const percentualMinimo = item.estoqueMinimo > 0
                        ? Math.min(100, Math.round((item.quantidadeEstoque / item.estoqueMinimo) * 100))
                        : 100;

                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.cardItem, isAlert && styles.cardItemAlert]}
                          activeOpacity={0.88}
                          onPress={() => {
                            setInsumoSelecionado(item);
                            setModalDetalhesVisible(true);
                          }}>
                          {/* Topo do Card */}
                          <View style={styles.cardHeaderRow}>
                            <View style={styles.cardIconBox}>
                              <Text style={styles.cardEmoji}>{item.emoji}</Text>
                            </View>
                            <View style={styles.cardInfoCol}>
                              <View style={styles.cardBadgeRow}>
                                <View style={[styles.typeBadge, item.tipo === 'ingrediente' ? styles.typeBadgeIngrediente : styles.typeBadgeEmbalagem]}>
                                  <Text style={[styles.typeBadgeText, item.tipo === 'ingrediente' ? styles.typeBadgeTextIngrediente : styles.typeBadgeTextEmbalagem]}>
                                    {item.tipo === 'ingrediente' ? '🥫 Ingrediente' : item.tipo === 'outro' ? '🧷 Outro' : '📦 Embalagem'}
                                  </Text>
                                </View>
                                <View style={styles.storageBadge}>
                                  <Text style={styles.storageBadgeText}>
                                    {item.armazenamento.replace('_', ' ').toUpperCase()}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.cardTitle} numberOfLines={1}>{item.nome}</Text>
                              {item.marcaFornecedor && (
                                <Text style={styles.cardBrand}>{item.marcaFornecedor}</Text>
                              )}
                            </View>
                          </View>

                          {/* Métricas do Card: Preço e Custo Unitário */}
                          <View style={styles.cardMetricsGrid}>
                            <View style={styles.cardMetricItem}>
                              <Text style={styles.cardMetricLabel}>PREÇO DE COMPRA</Text>
                              <Text style={styles.cardMetricValue}>{formatMoney(item.precoPago)}</Text>
                              <Text style={styles.cardMetricSub}>por {item.unidade}</Text>
                            </View>
                            <View style={styles.cardMetricItem}>
                              <Text style={styles.cardMetricLabel}>CUSTO FRACIONADO</Text>
                              <Text style={[styles.cardMetricValue, { color: KIPI_BLUE_ACCENT }]}>
                                {item.custoUnitario < 0.1
                                  ? `R$ ${item.custoUnitario.toFixed(4)}`
                                  : formatMoney(item.custoUnitario)}
                              </Text>
                              <Text style={styles.cardMetricSub}>por {item.unidadeFracionada}</Text>
                            </View>
                          </View>

                          {/* Barra de Nível de Estoque */}
                          <View style={styles.stockLevelSection}>
                            <View style={styles.stockTextRow}>
                              <Text style={styles.stockLabel}>
                                Estoque Atual: <Text style={styles.stockBold}>{item.quantidadeEstoque} {item.unidade}</Text>
                              </Text>
                              <Text style={[styles.stockAlertText, isAlert && styles.stockAlertTextCritical]}>
                                {isAlert ? '⚠️ Repor Estoque' : `Mín: ${item.estoqueMinimo} ${item.unidade}`}
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  isAlert ? styles.progressBarFillAlert : styles.progressBarFillSafe,
                                  { width: `${Math.max(8, Math.min(100, percentualMinimo))}%` },
                                ]}
                              />
                            </View>
                          </View>

                          {/* Rodapé do Card */}
                          <View style={styles.cardFooter}>
                            <Text style={styles.cardFooterText}>
                              {item.receitasOndeUsado && item.receitasOndeUsado.length > 0
                                ? `Usado em ${item.receitasOndeUsado.length} receitas`
                                : 'Sem receitas vinculadas'}
                            </Text>
                            <View style={styles.cardViewAction}>
                              <Text style={styles.cardViewActionText}>Ver Ficha</Text>
                              <Feather name="arrow-right" size={13} color={KIPI_BLUE_ACCENT} />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : viewMode === 'grid' ? (
                  // MODO 2: GRID COMPACTO
                  <View style={styles.gridContainer}>
                    {insumosFiltrados.map(item => {
                      const isAlert = item.quantidadeEstoque <= item.estoqueMinimo;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.gridItem, isAlert && styles.gridItemAlert]}
                          activeOpacity={0.88}
                          onPress={() => {
                            setInsumoSelecionado(item);
                            setModalDetalhesVisible(true);
                          }}>
                          <View style={styles.gridItemHeader}>
                            <Text style={styles.gridEmoji}>{item.emoji}</Text>
                            <View style={[styles.typeBadgeSmall, item.tipo === 'ingrediente' ? styles.typeBadgeIngrediente : styles.typeBadgeEmbalagem]}>
                              <Text style={styles.typeBadgeSmallText}>
                                {item.tipo === 'ingrediente' ? 'Ingrediente' : item.tipo === 'outro' ? 'Outro' : 'Embalagem'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.gridItemTitle} numberOfLines={2}>{item.nome}</Text>
                          <Text style={styles.gridItemStorage}>
                            {item.armazenamento.replace('_', ' ').toUpperCase()} • {item.unidade}
                          </Text>

                          <View style={styles.gridPriceBox}>
                            <Text style={styles.gridPriceLabel}>Custo Unitário:</Text>
                            <Text style={styles.gridPriceValue}>
                              {item.custoUnitario < 0.1
                                ? `R$ ${item.custoUnitario.toFixed(4)}`
                                : formatMoney(item.custoUnitario)}/{item.unidadeFracionada}
                            </Text>
                          </View>

                          <View style={styles.gridStockRow}>
                            <Text style={styles.gridStockText}>Estoque: {item.quantidadeEstoque} {item.unidade}</Text>
                            {isAlert && <Feather name="alert-circle" size={14} color="#B42318" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  // MODO 3: LISTA CORPORATIVA (TABELA)
                  <View style={styles.tableCard}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableTh, { flex: 2.2 }]}>INSUMO / MARCA</Text>
                      <Text style={[styles.tableTh, { flex: 1.2 }]}>TIPO</Text>
                      <Text style={[styles.tableTh, { flex: 1.2 }]}>ARMAZENAMENTO</Text>
                      <Text style={[styles.tableTh, { flex: 1.2 }]}>PREÇO COMPRA</Text>
                      <Text style={[styles.tableTh, { flex: 1.4 }]}>CUSTO UNITÁRIO</Text>
                      <Text style={[styles.tableTh, { flex: 1.3 }]}>ESTOQUE ATUAL</Text>
                      <Text style={[styles.tableTh, { flex: 1.1 }]}>STATUS</Text>
                      <Text style={[styles.tableTh, { width: 80, textAlign: 'right' }]}>AÇÕES</Text>
                    </View>

                    {insumosFiltrados.map((item, index) => {
                      const isAlert = item.quantidadeEstoque <= item.estoqueMinimo;
                      const isEven = index % 2 === 0;

                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.tableRow, isEven && styles.tableRowEven, isAlert && styles.tableRowAlert]}
                          activeOpacity={0.8}
                          onPress={() => {
                            setInsumoSelecionado(item);
                            setModalDetalhesVisible(true);
                          }}>
                          {/* Coluna 1: Nome & Marca */}
                          <View style={[styles.tableTd, { flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                            <View style={styles.tableEmojiBox}>
                              <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.tableItemName} numberOfLines={1}>{item.nome}</Text>
                              <Text style={styles.tableItemBrand} numberOfLines={1}>{item.marcaFornecedor || 'Padrão'}</Text>
                            </View>
                          </View>

                          {/* Coluna 2: Tipo */}
                          <View style={[styles.tableTd, { flex: 1.2 }]}>
                            <View style={[styles.typeBadgeSmall, item.tipo === 'ingrediente' ? styles.typeBadgeIngrediente : styles.typeBadgeEmbalagem]}>
                              <Text style={styles.typeBadgeSmallText}>
                                {item.tipo === 'ingrediente' ? '🥫 Ingrediente' : item.tipo === 'outro' ? '🧷 Outro' : '📦 Embalagem'}
                              </Text>
                            </View>
                          </View>

                          {/* Coluna 3: Armazenamento */}
                          <View style={[styles.tableTd, { flex: 1.2 }]}>
                            <Text style={styles.tableStorageText}>
                              {item.armazenamento.replace('_', ' ').toUpperCase()}
                            </Text>
                          </View>

                          {/* Coluna 4: Preço Pago */}
                          <View style={[styles.tableTd, { flex: 1.2 }]}>
                            <Text style={styles.tablePriceText}>{formatMoney(item.precoPago)}</Text>
                            <Text style={styles.tablePriceSub}>/{item.unidade}</Text>
                          </View>

                          {/* Coluna 5: Custo Unitário */}
                          <View style={[styles.tableTd, { flex: 1.4 }]}>
                            <Text style={[styles.tablePriceText, { color: KIPI_BLUE_ACCENT, fontWeight: '700' }]}>
                              {item.custoUnitario < 0.1
                                ? `R$ ${item.custoUnitario.toFixed(4)}`
                                : formatMoney(item.custoUnitario)}
                            </Text>
                            <Text style={styles.tablePriceSub}>/{item.unidadeFracionada}</Text>
                          </View>

                          {/* Coluna 6: Estoque */}
                          <View style={[styles.tableTd, { flex: 1.3 }]}>
                            <Text style={[styles.tableStockText, isAlert && styles.tableStockAlert]}>
                              {item.quantidadeEstoque} {item.unidade}
                            </Text>
                            {isAlert ? (
                              <Text style={styles.tableAlertBadge}>Mín: {item.estoqueMinimo}</Text>
                            ) : (
                              <Text style={styles.tableSafeBadge}>Normal</Text>
                            )}
                          </View>

                          {/* Coluna 7: Status */}
                          <View style={[styles.tableTd, { flex: 1.1 }]}>
                            <View style={[styles.statusBadge, item.status === 'ativo' ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                              <Text style={[styles.statusBadgeText, item.status === 'ativo' ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive]}>
                                {item.status === 'ativo' ? 'Ativo' : 'Inativo'}
                              </Text>
                            </View>
                          </View>

                          {/* Coluna 8: Ações */}
                          <View style={[styles.tableTd, { width: 80, alignItems: 'flex-end' }]}>
                            <TouchableOpacity
                              style={styles.tableDetailBtn}
                              onPress={() => {
                                setInsumoSelecionado(item);
                                setModalDetalhesVisible(true);
                              }}>
                              <Feather name="chevron-right" size={17} color={KIPI_BLUE_ACCENT} />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </>
          ) : (
            // =========================================================================
            // SEÇÃO: FICHAS TÉCNICAS & RECEITAS (VALOR AGREGADO EXTRA)
            // =========================================================================
            <ScrollView
              style={styles.contentScrollView}
              contentContainerStyle={styles.contentScrollContent}
              showsVerticalScrollIndicator={false}>
              {/* Barra compacta: hora trabalhada (vale para todas as fichas) + nova ficha */}
              <View style={styles.recipesBanner}>
                <Text style={styles.recipesBannerSub}>
                  {fichas.length} receitas · toque numa receita para editar · custo pelo custo médio atual dos insumos
                </Text>
                <View style={styles.horaBox}>
                  <Feather name="clock" size={13} color="#6B615A" />
                  <Text style={styles.horaLabel}>Hora trabalhada R$</Text>
                  <TextInput
                    style={styles.horaInput}
                    value={horaTxt}
                    keyboardType="numeric"
                    onChangeText={(v) => {
                      const m = mascaraDinheiro(v);
                      setHoraTxt(m);
                      definirHoraTrabalhada(lerDinheiro(m));
                    }}
                  />
                  <Text style={styles.horaLabel}>/h</Text>
                </View>
                <TouchableOpacity style={styles.btnNovaReceita} onPress={() => setFichaAberta({ produtoId: null })}>
                  <Feather name="plus-circle" size={15} color="#FFFDFA" />
                  <Text style={styles.btnNovaReceitaText}>Nova Receita</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardsContainer}>
                {fichas.map((f) => {
                  const prod = vitrine.find((p) => p.id === f.produtoId);
                  if (!prod) return null;
                  const c = calcularFicha(f, insumosList, horaTrabalhada);
                  const margem = margemReal(prod.preco, c.custoUnitario);
                  const atencao = margem < MARGEM_MINIMA;
                  return (
                    <TouchableOpacity
                      key={f.produtoId}
                      style={[styles.recipeCard, atencao && styles.recipeCardAtencao]}
                      onPress={() => setFichaAberta({ produtoId: f.produtoId })}>
                      <View style={styles.recipeHeaderRow}>
                        <View style={styles.recipeEmojiBox}>
                          <Text style={{ fontSize: 20 }}>{EMOJI_CATEGORIA[prod.categoria] ?? '🧁'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.recipeBadgeRow}>
                            <Text style={styles.recipeCategoryBadge}>{prod.categoria}</Text>
                            <Text style={styles.recipePrepTime}>⏱️ {f.tempoPreparoMinutos} min</Text>
                          </View>
                          <Text style={styles.recipeTitle} numberOfLines={1}>{prod.nome}</Text>
                          <Text style={styles.recipeRendimento}>
                            Rende {f.rendimento} un · {c.linhas.length} insumos
                          </Text>
                        </View>
                        <View style={styles.btnEditarReceita}>
                          <Feather name="edit-2" size={12} color={KIPI_BLUE_ACCENT} />
                          <Text style={styles.btnEditarReceitaText}>Editar</Text>
                        </View>
                      </View>

                      {/* Divisão de custos da receita */}
                      <View style={styles.recipeCostBreakdown}>
                        {[
                          ['Ingredientes', c.ingredientes],
                          ['Embalagens', c.embalagens],
                          ['Mão de obra', c.maoDeObra],
                          ['Extras', c.extras],
                        ].map(([rotulo, valor]) => (
                          <View key={rotulo as string} style={styles.recipeCostItem}>
                            <Text style={styles.recipeCostLabel}>{rotulo}</Text>
                            <Text style={styles.recipeCostVal}>{formatMoney(valor as number)}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Custo, preço e margem real */}
                      <View style={styles.recipeFinancialFooter}>
                        <View>
                          <Text style={styles.recipeTotalCostLabel}>CUSTO/UN</Text>
                          <Text style={styles.recipeTotalCostVal}>{formatMoney(c.custoUnitario)}</Text>
                          {Math.abs(c.precoSugerido - prod.preco) >= 0.01 && (
                            <Text style={styles.recipePrepTime}>sugerido {formatMoney(c.precoSugerido)}</Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.recipeSuggestedLabel}>PREÇO DE VENDA</Text>
                          <Text style={styles.recipeSuggestedVal}>{formatMoney(prod.preco)}</Text>
                          <Text style={[styles.recipeMarginBadge, atencao && { color: '#B42318' }]}>
                            {atencao ? '⚠ Atenção · ' : ''}margem {Math.round(margem)}%
                          </Text>
                        </View>
                      </View>
                      {c.gargalo && (
                        <Text style={styles.recipeCapacidade}>
                          📦 Estoque dá para {c.receitasPossiveis} receita(s) · gargalo: {c.gargalo}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* =========================================================================
          MODAL DE CADASTRO (+ NOVO INSUMO)
          Conforme solicitado com seleção clara entre Ingredientes e Embalagens
      ========================================================================== */}
      <Modal
        visible={modalNovoInsumoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalNovoInsumoVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentBox}>
            {/* Header do Modal */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cadastrar Novo Insumo</Text>
                <Text style={styles.modalSubtitle}>
                  Escolha se o item é um ingrediente ou embalagem para o cálculo de custos do ateliê.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalNovoInsumoVisible(false)}>
                <Feather name="x" size={20} color="#6B615A" />
              </TouchableOpacity>
            </View>

            {formErro && (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={16} color="#B42318" />
                <Text style={styles.errorBannerText}>{formErro}</Text>
              </View>
            )}

            <ScrollView style={styles.modalFormScroll} showsVerticalScrollIndicator={false}>
              {/* 1. SELEÇÃO DO TIPO: INGREDIENTE OU EMBALAGEM */}
              <Text style={styles.fieldLabel}>O QUE VOCÊ ESTÁ CADASTRANDO? *</Text>
              <View style={styles.typeSelectorCards}>
                <TouchableOpacity
                  style={[styles.typeSelectCard, formTipo === 'ingrediente' && styles.typeSelectCardActive]}
                  onPress={() => {
                    setFormTipo('ingrediente');
                    setFormUnidade('kg');
                    setFormConteudo('1000');
                  }}>
                  <View style={[styles.typeSelectIcon, formTipo === 'ingrediente' && styles.typeSelectIconActive]}>
                    <Text style={{ fontSize: 20 }}>🥫</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeSelectTitle, formTipo === 'ingrediente' && styles.typeSelectTitleActive]}>
                      Ingrediente / Matéria-Prima
                    </Text>
                    <Text style={styles.typeSelectSub}>Farinhas, chocolates, laticínios, frutas, açúcares...</Text>
                  </View>
                  {formTipo === 'ingrediente' && (
                    <Feather name="check-circle" size={20} color={KIPI_BLUE_ACCENT} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeSelectCard, formTipo === 'embalagem' && styles.typeSelectCardActive]}
                  onPress={() => {
                    setFormTipo('embalagem');
                    setFormUnidade('pacote');
                    setFormConteudo('50');
                  }}>
                  <View style={[styles.typeSelectIcon, formTipo === 'embalagem' && styles.typeSelectIconActive]}>
                    <Text style={{ fontSize: 20 }}>📦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeSelectTitle, formTipo === 'embalagem' && styles.typeSelectTitleActive]}>
                      Embalagem / Apresentação
                    </Text>
                    <Text style={styles.typeSelectSub}>Caixas, fitas, sacos celofane, forminhas, laços...</Text>
                  </View>
                  {formTipo === 'embalagem' && (
                    <Feather name="check-circle" size={20} color={KIPI_BLUE_ACCENT} />
                  )}
                </TouchableOpacity>
              </View>

              {/* 2. NOME DO INSUMO (OBRIGATÓRIO) */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>NOME DO ITEM *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={formTipo === 'ingrediente' ? 'Ex: Chocolate Belga 54% Callebaut' : 'Ex: Caixa Kraft c/ Visor 6 Cookies'}
                  placeholderTextColor="#9A8F87"
                  value={formNome}
                  onChangeText={setFormNome}
                />
              </View>

              {/* 3. UNIDADE DE COMPRA (OBRIGATÓRIO) */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>
                  {formTipo === 'ingrediente'
                    ? 'UNIDADE DE COMPRA (AS MAIS COMUNS PRIMEIRO) *'
                    : 'UNIDADE DE COMPRA (UN, PACOTE, CAIXA, ROLO, DÚZIA, FARDO, M) *'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitPillsScroll}>
                  {(formTipo === 'ingrediente' ? UNIDADES_INGREDIENTES : UNIDADES_EMBALAGENS).map(u => {
                    const isSelected = formUnidade === u.value;
                    return (
                      <TouchableOpacity
                        key={u.value}
                        style={[styles.unitPill, isSelected && styles.unitPillActive]}
                        onPress={() => setFormUnidade(u.value)}>
                        <Text style={[styles.unitPillText, isSelected && styles.unitPillTextActive]}>
                          {u.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 4. PREÇO PAGO E TAMANHO/CONTEÚDO (PARA CÁLCULO DE CUSTO FRACIONADO) */}
              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>PREÇO PAGO (R$) *</Text>
                  <View style={styles.currencyInputBox}>
                    <Text style={styles.currencyPrefix}>R$</Text>
                    <TextInput
                      style={styles.currencyInput}
                      placeholder="0,00"
                      placeholderTextColor="#9A8F87"
                      keyboardType="numeric"
                      value={formPreco}
                      onChangeText={(t) => setFormPreco(mascaraDinheiro(t))}
                    />
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>
                    {formTipo === 'ingrediente' ? 'CONTEÚDO / PESO (g ou ml)' : 'QTD NO PACOTE/ROLO'}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={formTipo === 'ingrediente' ? 'Ex: 1000 (para 1kg)' : 'Ex: 50 (unidades)'}
                    placeholderTextColor="#9A8F87"
                    keyboardType="numeric"
                    value={formConteudo}
                    onChangeText={setFormConteudo}
                  />
                </View>
              </View>

              {/* 5. TIPO DE ARMAZENAMENTO (SOLICITADO EXPLICITAMENTE: seco, refrigerado, congelado, perecível, in natura) */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>TIPO DE ARMAZENAMENTO</Text>
                <View style={styles.storageGridSelector}>
                  {ARMAZENAMENTOS_LIST.map(arm => {
                    const isSelected = formArmazenamento === arm.id;
                    return (
                      <TouchableOpacity
                        key={arm.id}
                        style={[styles.storageGridItem, isSelected && styles.storageGridItemActive]}
                        onPress={() => setFormArmazenamento(arm.id as any)}>
                        <Text style={{ fontSize: 18 }}>{arm.emoji}</Text>
                        <Text style={[styles.storageGridItemTitle, isSelected && styles.storageGridItemTitleActive]}>
                          {arm.label}
                        </Text>
                        <Text style={styles.storageGridItemDesc}>{arm.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 6. ESTOQUE ATUAL & MÍNIMO */}
              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>ESTOQUE ATUAL</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: 5"
                    placeholderTextColor="#9A8F87"
                    keyboardType="numeric"
                    value={formEstoqueAtual}
                    onChangeText={setFormEstoqueAtual}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>ESTOQUE MÍNIMO (ALERTA)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: 2"
                    placeholderTextColor="#9A8F87"
                    keyboardType="numeric"
                    value={formEstoqueMinimo}
                    onChangeText={setFormEstoqueMinimo}
                  />
                </View>
              </View>

              {/* 7. MARCA / FORNECEDOR */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>MARCA / FORNECEDOR (OPCIONAL)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ex: Callebaut, Nestlé, Cromus, Sulformas..."
                  placeholderTextColor="#9A8F87"
                  value={formMarca}
                  onChangeText={setFormMarca}
                />
              </View>
            </ScrollView>

            {/* Rodapé do Modal */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalNovoInsumoVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSalvarNovoInsumo}>
                <Feather name="check" size={17} color="#FFFDFA" />
                <Text style={styles.modalSaveBtnText}>Salvar Insumo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL DE DETALHES DO INSUMO (DOSSIÊ AO CLICAR)
      ========================================================================== */}
      <Modal
        visible={modalDetalhesVisible && insumoSelecionado !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalDetalhesVisible(false)}>
        <View style={styles.modalOverlay}>
          {insumoSelecionado && (
            <View style={styles.modalContentBox}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.dossierEmojiBox}>
                    <Text style={{ fontSize: 26 }}>{insumoSelecionado.emoji}</Text>
                  </View>
                  <View>
                    <View style={styles.cardBadgeRow}>
                      <View style={[styles.typeBadge, insumoSelecionado.tipo === 'ingrediente' ? styles.typeBadgeIngrediente : styles.typeBadgeEmbalagem]}>
                        <Text style={[styles.typeBadgeText, insumoSelecionado.tipo === 'ingrediente' ? styles.typeBadgeTextIngrediente : styles.typeBadgeTextEmbalagem]}>
                          {insumoSelecionado.tipo === 'ingrediente' ? '🥫 Ingrediente' : insumoSelecionado.tipo === 'outro' ? '🧷 Outro' : '📦 Embalagem'}
                        </Text>
                      </View>
                      <View style={styles.storageBadge}>
                        <Text style={styles.storageBadgeText}>
                          {insumoSelecionado.armazenamento.replace('_', ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.modalTitle}>{insumoSelecionado.nome}</Text>
                    {insumoSelecionado.marcaFornecedor && (
                      <Text style={styles.modalSubtitle}>Marca: {insumoSelecionado.marcaFornecedor}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setModalDetalhesVisible(false)}>
                  <Feather name="x" size={20} color="#6B615A" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalFormScroll} showsVerticalScrollIndicator={false}>
                {/* Métricas Principais de Custo */}
                <View style={styles.dossierMetricsGrid}>
                  <View style={styles.dossierMetricCard}>
                    <Text style={styles.dossierMetricLabel}>PREÇO DE COMPRA</Text>
                    <Text style={styles.dossierMetricVal}>{formatMoney(insumoSelecionado.precoPago)}</Text>
                    <Text style={styles.dossierMetricSub}>por {insumoSelecionado.unidade}</Text>
                  </View>

                  <View style={[styles.dossierMetricCard, { backgroundColor: KIPI_BLUE_TINT, borderColor: '#D6D7F3' }]}>
                    <Text style={[styles.dossierMetricLabel, { color: KIPI_BLUE_ACCENT }]}>CUSTO FRACIONADO</Text>
                    <Text style={[styles.dossierMetricVal, { color: KIPI_BLUE_ACCENT }]}>
                      {insumoSelecionado.custoUnitario < 0.1
                        ? `R$ ${insumoSelecionado.custoUnitario.toFixed(4)}`
                        : formatMoney(insumoSelecionado.custoUnitario)}
                    </Text>
                    <Text style={styles.dossierMetricSub}>por {insumoSelecionado.unidadeFracionada}</Text>
                  </View>
                </View>

                {/* Bloco de Ajuste Rápido de Estoque */}
                <View style={styles.stockAdjustmentCard}>
                  <View style={styles.stockAdjHeader}>
                    <View>
                      <Text style={styles.stockAdjTitle}>Controle de Estoque Atual</Text>
                      <Text style={styles.stockAdjSubtitle}>
                        Mínimo cadastrado: {insumoSelecionado.estoqueMinimo} {insumoSelecionado.unidade}
                      </Text>
                    </View>
                    <Text style={styles.stockAdjBigNumber}>
                      {insumoSelecionado.quantidadeEstoque} <Text style={{ fontSize: 16, color: '#6B615A' }}>{insumoSelecionado.unidade}</Text>
                    </Text>
                  </View>

                  <View style={styles.stockAdjButtonsRow}>
                    <TouchableOpacity
                      style={styles.stockAdjBtnMinus}
                      onPress={() => handleAjustarEstoque(-1)}>
                      <Feather name="minus" size={16} color="#B42318" />
                      <Text style={styles.stockAdjBtnTextMinus}>-1 {insumoSelecionado.unidade}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.stockAdjBtnPlus}
                      onPress={() => handleAjustarEstoque(+1)}>
                      <Feather name="plus" size={16} color="#2F7D55" />
                      <Text style={styles.stockAdjBtnTextPlus}>+1 {insumoSelecionado.unidade} (Entrada)</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Receitas Vinculadas */}
                <View style={styles.linkedRecipesCard}>
                  <Text style={styles.linkedRecipesTitle}>Receitas que utilizam este insumo:</Text>
                  {insumoSelecionado.receitasOndeUsado && insumoSelecionado.receitasOndeUsado.length > 0 ? (
                    insumoSelecionado.receitasOndeUsado.map((rec, i) => (
                      <View key={i} style={styles.linkedRecipeItem}>
                        <Feather name="check-circle" size={15} color={KIPI_BLUE_ACCENT} />
                        <Text style={styles.linkedRecipeText}>{rec}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.linkedRecipesEmpty}>
                      Nenhuma receita cadastrada consumindo este insumo diretamente ainda.
                    </Text>
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setModalDetalhesVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>Fechar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={() => {
                    setModalDetalhesVisible(false);
                    // Feedback visual
                  }}>
                  <Feather name="check" size={17} color="#FFFDFA" />
                  <Text style={styles.modalSaveBtnText}>Concluído</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Editor da ficha técnica (o mesmo do dossiê de Produtos) */}
      <FichaTecnicaModal
        visible={fichaAberta !== null}
        produtoId={fichaAberta?.produtoId ?? null}
        onClose={() => setFichaAberta(null)}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS COM A IDENTIDADE VISUAL DO ATELIÊ & AZUL DO SISTEMA
// ============================================================================
const styles = paraCelular(StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDFA',
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
  topHeader: TOPO_COMPACTO,
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moduleSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#FFFDFA',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  moduleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  moduleTabActive: {
    backgroundColor: KIPI_BLUE_DARK,
  },
  moduleTabText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B615A',
  },
  moduleTabTextActive: {
    color: '#FFFDFA',
    fontWeight: '700',
  },
  btnNovoInsumo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_BLUE,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    boxShadow: '0 2px 8px rgba(75, 79, 196, 0.35)',
  },
  btnNovoInsumoText: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFDFA',
  },

  // KPI CARDS
  kpiCardsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  kpiCardActiveFilter: {
    borderColor: KIPI_BLUE,
    backgroundColor: KIPI_BLUE_LIGHT,
  },
  kpiCardAlert: {
    borderColor: '#F3C4BD',
    backgroundColor: '#FBF0DC',
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
    color: '#6B615A',
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
    fontSize: 24,
    fontWeight: '800',
    color: '#2E211A',
    marginBottom: 3,
  },
  kpiSubtext: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#9A8F87',
  },

  // FILTROS
  filterSection: {
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    marginBottom: 16,
    gap: 14,
  },
  filterRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
  },
  coolTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3EEE7',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  coolTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    gap: 8,
  },
  coolTypeBtnActive: {
    backgroundColor: '#FFFDFA',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  coolTypeBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B615A',
  },
  coolTypeBtnTextActive: {
    color: '#2E211A',
    fontWeight: '700',
  },
  coolBadge: {
    backgroundColor: '#E8E0D6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  coolBadgeActive: {
    backgroundColor: KIPI_BLUE_TINT,
  },
  coolBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#4A3E37',
  },
  coolBadgeTextActive: {
    color: KIPI_BLUE_ACCENT,
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#2E211A',
  },
  filterRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
  },
  storageScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  storagePillActive: {
    backgroundColor: KIPI_BLUE_TINT,
    borderColor: '#D6D7F3',
  },
  storageEmoji: {
    fontSize: 13,
  },
  storagePillText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B615A',
  },
  storagePillTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '700',
  },

  // STATUS PILLS
  statusPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3EEE7',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusPillActive: {
    backgroundColor: '#FFFDFA',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  statusPillText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B615A',
  },
  statusPillTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '700',
  },

  // VIEW MODE SWITCHER
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3EEE7',
    borderRadius: 10,
    padding: 3,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  viewModeBtnActive: {
    backgroundColor: '#FFFDFA',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  viewModeBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B615A',
  },
  viewModeBtnTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '700',
  },

  // CONTEÚDO E SCROLL
  contentScrollView: {
    flex: 1,
  },
  contentScrollContent: {
    paddingBottom: 40,
  },

  // MODO CARDS
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  cardItem: {
    width: '32%',
    minWidth: 280,
    flexGrow: 1,
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  cardItemAlert: {
    borderColor: '#F3C4BD',
    backgroundColor: '#FFFDFA',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardInfoCol: {
    flex: 1,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeIngrediente: {
    backgroundColor: '#FBF0DC',
  },
  typeBadgeEmbalagem: {
    backgroundColor: '#ECEBFA',
  },
  typeBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
  },
  typeBadgeTextIngrediente: {
    color: '#9A6516',
  },
  typeBadgeTextEmbalagem: {
    color: '#3A3D9E',
  },
  storageBadge: {
    backgroundColor: '#F3EEE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  storageBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '700',
    color: '#6B615A',
  },
  cardTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '700',
    color: '#2E211A',
  },
  cardBrand: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#6B615A',
  },
  cardMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8F6F2',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3EEE7',
  },
  cardMetricItem: {
    flex: 1,
  },
  cardMetricLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#9A8F87',
    marginBottom: 2,
  },
  cardMetricValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '800',
    color: '#2E211A',
  },
  cardMetricSub: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#6B615A',
  },
  stockLevelSection: {
    marginBottom: 12,
  },
  stockTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  stockLabel: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#4A3E37',
  },
  stockBold: {
    fontWeight: '700',
    color: '#2E211A',
  },
  stockAlertText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#6B615A',
  },
  stockAlertTextCritical: {
    color: '#B42318',
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E8E0D6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarFillSafe: {
    backgroundColor: '#2F7D55',
  },
  progressBarFillAlert: {
    backgroundColor: '#B42318',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3EEE7',
  },
  cardFooterText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#9A8F87',
  },
  cardViewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardViewActionText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },

  // MODO GRID
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '24%',
    minWidth: 200,
    flexGrow: 1,
    backgroundColor: '#FFFDFA',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  gridItemAlert: {
    borderColor: '#F3C4BD',
    backgroundColor: '#FFFDFA',
  },
  gridItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridEmoji: {
    fontSize: 20,
  },
  typeBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeBadgeSmallText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#4A3E37',
  },
  gridItemTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
    marginBottom: 3,
  },
  gridItemStorage: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#9A8F87',
    marginBottom: 8,
  },
  gridPriceBox: {
    backgroundColor: '#F8F6F2',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  gridPriceLabel: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    color: '#9A8F87',
    fontWeight: '700',
  },
  gridPriceValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },
  gridStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridStockText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#4A3E37',
    fontWeight: '600',
  },

  // MODO LISTA / TABELA
  tableCard: {
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F6F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D6',
  },
  tableTh: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '800',
    color: '#6B615A',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE7',
  },
  tableRowEven: {
    backgroundColor: '#F8F6F2',
  },
  tableRowAlert: {
    backgroundColor: '#FFFDFA',
  },
  tableTd: {
    justifyContent: 'center',
  },
  tableEmojiBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableItemName: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
  },
  tableItemBrand: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#9A8F87',
  },
  tableStorageText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#4A3E37',
  },
  tablePriceText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '600',
    color: '#2E211A',
  },
  tablePriceSub: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#9A8F87',
  },
  tableStockText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
  },
  tableStockAlert: {
    color: '#B42318',
  },
  tableAlertBadge: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#B42318',
  },
  tableSafeBadge: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#2F7D55',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeActive: {
    backgroundColor: '#E4F1E9',
  },
  statusBadgeInactive: {
    backgroundColor: '#F3EEE7',
  },
  statusBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextActive: {
    color: '#2F7D55',
  },
  statusBadgeTextInactive: {
    color: '#9A8F87',
  },
  tableDetailBtn: {
    padding: 6,
  },

  // RECEITAS BANNER E CARDS
  recipesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDFA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  recipesBannerSub: {
    flex: 1,
    minWidth: 200,
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#6B615A',
  },
  horaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  horaLabel: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#4A3E37',
  },
  horaInput: {
    width: 44,
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
    textAlign: 'center',
    paddingVertical: 2,
  },
  btnNovaReceita: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_BLUE_DARK,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  btnEditarReceita: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: KIPI_BLUE_TINT,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnEditarReceitaText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },
  recipeCardAtencao: {
    borderColor: '#F3C4BD',
  },
  recipeCapacidade: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#6B615A',
    marginTop: 8,
  },
  btnNovaReceitaText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFDFA',
  },
  recipeCard: {
    width: '32%',
    minWidth: 290,
    flexGrow: 1,
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  recipeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  recipeEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: KIPI_BLUE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recipeCategoryBadge: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
    backgroundColor: KIPI_BLUE_TINT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  recipePrepTime: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#6B615A',
  },
  recipeTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '700',
    color: '#2E211A',
  },
  recipeRendimento: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#6B615A',
  },
  recipeCostBreakdown: {
    flexDirection: 'row',
    backgroundColor: '#F8F6F2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  recipeCostItem: {
    flex: 1,
  },
  recipeCostLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#9A8F87',
    marginBottom: 2,
  },
  recipeCostVal: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#3D312A',
  },
  recipeFinancialFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3EEE7',
  },
  recipeTotalCostLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#6B615A',
  },
  recipeTotalCostVal: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '800',
    color: '#2E211A',
  },
  recipeSuggestedLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#2F7D55',
  },
  recipeSuggestedVal: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '800',
    color: '#2F7D55',
  },
  recipeMarginBadge: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#2F7D55',
  },

  // EMPTY STATE
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '700',
    color: '#2E211A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#6B615A',
    marginBottom: 16,
    maxWidth: 320,
    textAlign: 'center',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_BLUE,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  emptyActionBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFDFA',
  },

  // MODAIS (CADASTRO & DOSSIÊ)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 36, 33, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentBox: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    backgroundColor: '#FFFDFA',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE7',
  },
  modalTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '800',
    color: '#2E211A',
  },
  modalSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#6B615A',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBE7E4',
    borderWidth: 1,
    borderColor: '#F3C4BD',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 14,
  },
  errorBannerText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#B42318',
    fontWeight: '600',
  },
  modalFormScroll: {
    maxHeight: 520,
  },
  fieldLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#4A3E37',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  textInput: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    color: '#2E211A',
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '700',
    color: '#6B615A',
    marginRight: 6,
  },
  currencyInput: {
    flex: 1,
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '700',
    color: '#2E211A',
    paddingVertical: 10,
  },

  // Seletores do Modal
  typeSelectorCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  typeSelectCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F6F2',
    borderWidth: 1.5,
    borderColor: '#E8E0D6',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  typeSelectCardActive: {
    borderColor: KIPI_BLUE_ACCENT,
    backgroundColor: KIPI_BLUE_TINT,
  },
  typeSelectIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSelectIconActive: {
    backgroundColor: '#FFFDFA',
  },
  typeSelectTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#4A3E37',
  },
  typeSelectTitleActive: {
    color: '#2E211A',
  },
  typeSelectSub: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#6B615A',
    marginTop: 2,
  },
  unitPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  unitPill: {
    backgroundColor: '#F3EEE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  unitPillActive: {
    backgroundColor: KIPI_BLUE,
    borderColor: KIPI_BLUE,
  },
  unitPillText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#4A3E37',
  },
  unitPillTextActive: {
    color: '#FFFDFA',
    fontWeight: '700',
  },
  storageGridSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  storageGridItem: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  storageGridItemActive: {
    borderColor: KIPI_BLUE_ACCENT,
    backgroundColor: KIPI_BLUE_TINT,
  },
  storageGridItemTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#4A3E37',
    marginTop: 4,
  },
  storageGridItemTitleActive: {
    color: KIPI_BLUE_ACCENT,
  },
  storageGridItemDesc: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#9A8F87',
    textAlign: 'center',
    marginTop: 2,
  },

  // Rodapé do Modal
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3EEE7',
    marginTop: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B615A',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_BLUE,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modalSaveBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFDFA',
  },

  // DOSSIÊ STYLES
  dossierEmojiBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dossierMetricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dossierMetricCard: {
    flex: 1,
    backgroundColor: '#F8F6F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  dossierMetricLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#9A8F87',
    marginBottom: 4,
  },
  dossierMetricVal: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '800',
    color: '#2E211A',
  },
  dossierMetricSub: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#6B615A',
  },
  stockAdjustmentCard: {
    backgroundColor: '#FFFDFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    padding: 16,
    marginBottom: 16,
  },
  stockAdjHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  stockAdjTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '700',
    color: '#2E211A',
  },
  stockAdjSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#6B615A',
  },
  stockAdjBigNumber: {
    fontFamily: FONT_DISPLAY,
    fontSize: 22,
    fontWeight: '800',
    color: '#2E211A',
  },
  stockAdjButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stockAdjBtnMinus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBE7E4',
    borderWidth: 1,
    borderColor: '#F3C4BD',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  stockAdjBtnTextMinus: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#B42318',
  },
  stockAdjBtnPlus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4F1E9',
    borderWidth: 1,
    borderColor: '#BFDCCB',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  stockAdjBtnTextPlus: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#2F7D55',
  },
  linkedRecipesCard: {
    backgroundColor: '#F8F6F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  linkedRecipesTitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#4A3E37',
    marginBottom: 10,
  },
  linkedRecipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  linkedRecipeText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#2E211A',
  },
  linkedRecipesEmpty: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#9A8F87',
    fontStyle: 'italic',
  },
}));
