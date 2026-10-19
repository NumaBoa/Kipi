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

// ============================================================================
// TIPOS DE DADOS
// ============================================================================
export type ViewMode = 'cards' | 'grid' | 'lista';
export type StatusFilter = 'todos' | 'ativos' | 'inativos' | 'com_ficha' | 'sem_ficha';

export interface IngredienteUtilizado {
  id: string;
  insumoId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custoPorUnidade: number; // por g ou ml
  custoTotal: number;
}

export interface EmbalagemUtilizada {
  id: string;
  insumoId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
  custoTotal: number;
}

export interface CustoIndireto {
  id: string;
  tipo: 'energia' | 'gas' | 'mao_de_obra' | 'aluguel' | 'outro';
  descricao: string;
  modo: 'fixo_reais' | 'porcentagem';
  valor: number; // em R$ ou %
  valorCalculado: number; // valor final em R$
}

export interface ProdutoCompleto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  fotoEmoji: string;
  estoque: number;
  estoqueMinimo: number;
  ativo: boolean;
  temFichaTecnica: boolean;
  // Campos da Ficha Técnica (se houver)
  rendimento?: number;
  unidadeRendimento?: 'unidades' | 'kg' | 'grama' | 'fatia' | 'pote';
  tempoPreparoMinutos?: number;
  ingredientes?: IngredienteUtilizado[];
  embalagens?: EmbalagemUtilizada[];
  custosIndiretos?: CustoIndireto[];
  custoIngredientesTotal?: number;
  custoEmbalagensTotal?: number;
  custosIndiretosTotal?: number;
  custoTotalReceita?: number;
  custoUnitario?: number;
  precoSugeridoVenda?: number;
  margemLucroPercentual?: number;
  lucroLiquidoUnitario?: number;
}

// INSUMOS DISPONÍVEIS PARA SELEÇÃO
interface InsumoRef {
  id: string;
  nome: string;
  tipo: 'ingrediente' | 'embalagem';
  unidade: string;
  custoFracionado: number; // por g, ml ou un
  emoji: string;
}

const INSUMOS_DISPONIVEIS: InsumoRef[] = [
  { id: 'ins-1', nome: 'Chocolate Belga 54% Callebaut', tipo: 'ingrediente', unidade: 'g', custoFracionado: 0.076, emoji: '🍫' },
  { id: 'ins-2', nome: 'Farinha de Trigo Especial Anaconda', tipo: 'ingrediente', unidade: 'g', custoFracionado: 0.0065, emoji: '🌾' },
  { id: 'ins-3', nome: 'Manteiga Extra sem Sal President', tipo: 'ingrediente', unidade: 'g', custoFracionado: 0.0489, emoji: '🧈' },
  { id: 'ins-4', nome: 'Pasta Pura de Pistache Siciliano', tipo: 'ingrediente', unidade: 'g', custoFracionado: 0.145, emoji: '🥜' },
  { id: 'ins-5', nome: 'Leite Condensado Moça Integral', tipo: 'ingrediente', unidade: 'g', custoFracionado: 0.0225, emoji: '🥛' },
  { id: 'ins-6', nome: 'Açúcar Mascavo Premium', tipo: 'ingrediente', unidade: 'g', custoFracionado: 0.009, emoji: '🍯' },
  { id: 'ins-7', nome: 'Frutas Vermelhas Frescas', tipo: 'ingrediente', unidade: 'g', custoFracionado: 0.068, emoji: '🍓' },
  { id: 'ins-8', nome: 'Creme de Leite Fresco 35%', tipo: 'ingrediente', unidade: 'ml', custoFracionado: 0.0269, emoji: '🍶' },
  { id: 'ins-9', nome: 'Caixa Cookie Kraft c/ Visor (6 un)', tipo: 'embalagem', unidade: 'un', custoFracionado: 1.298, emoji: '📦' },
  { id: 'ins-10', nome: 'Fita de Cetim Dourada Champagne 15mm', tipo: 'embalagem', unidade: 'm', custoFracionado: 0.398, emoji: '🎀' },
  { id: 'ins-11', nome: 'Saco Celofane Transparente 15x25cm', tipo: 'embalagem', unidade: 'un', custoFracionado: 0.185, emoji: '🛍️' },
  { id: 'ins-12', nome: 'Caixa Bentô Cake Biodegradável', tipo: 'embalagem', unidade: 'un', custoFracionado: 1.96, emoji: '🧁' },
  { id: 'ins-13', nome: 'Forminha Quatro Pétalas Dourada N°4', tipo: 'embalagem', unidade: 'un', custoFracionado: 0.075, emoji: '✨' },
];

// PRODUTOS INICIAIS ENRIQUECIDOS (CONFEITARIA FINA)
const PRODUTOS_INICIAIS: ProdutoCompleto[] = [
  {
    id: 'prod-1',
    nome: 'Cookie Black Nutella & Avelã',
    categoria: 'Cookies',
    preco: 18.90,
    fotoEmoji: '🍪',
    estoque: 24,
    estoqueMinimo: 10,
    ativo: true,
    temFichaTecnica: true,
    rendimento: 12,
    unidadeRendimento: 'unidades',
    tempoPreparoMinutos: 45,
    custoIngredientesTotal: 28.40,
    custoEmbalagensTotal: 4.80,
    custosIndiretosTotal: 6.00,
    custoTotalReceita: 39.20,
    custoUnitario: 3.26,
    precoSugeridoVenda: 18.90,
    margemLucroPercentual: 479,
    lucroLiquidoUnitario: 15.64,
    ingredientes: [
      { id: 'i1', insumoId: 'ins-1', nome: 'Chocolate Belga 54%', quantidade: 180, unidade: 'g', custoPorUnidade: 0.076, custoTotal: 13.68 },
      { id: 'i2', insumoId: 'ins-2', nome: 'Farinha de Trigo Especial', quantidade: 350, unidade: 'g', custoPorUnidade: 0.0065, custoTotal: 2.28 },
      { id: 'i3', insumoId: 'ins-3', nome: 'Manteiga Extra sem Sal', quantidade: 150, unidade: 'g', custoPorUnidade: 0.0489, custoTotal: 7.34 },
      { id: 'i4', insumoId: 'ins-6', nome: 'Açúcar Mascavo Premium', quantidade: 120, unidade: 'g', custoPorUnidade: 0.009, custoTotal: 1.08 },
    ],
    embalagens: [
      { id: 'e1', insumoId: 'ins-11', nome: 'Saco Celofane Transparente', quantidade: 12, unidade: 'un', custoUnitario: 0.185, custoTotal: 2.22 },
      { id: 'e2', insumoId: 'ins-10', nome: 'Fita de Cetim Dourada', quantidade: 6, unidade: 'm', custoUnitario: 0.398, custoTotal: 2.39 },
    ],
    custosIndiretos: [
      { id: 'c1', tipo: 'energia', descricao: 'Forno Elétrico Convector', modo: 'fixo_reais', valor: 2.50, valorCalculado: 2.50 },
      { id: 'c2', tipo: 'mao_de_obra', descricao: 'Tempo de Confeitaria (45min)', modo: 'fixo_reais', valor: 3.50, valorCalculado: 3.50 },
    ],
  },
  {
    id: 'prod-2',
    nome: 'Bento Cake Pistache & Framboesa',
    categoria: 'Bolos & Bentôs',
    preco: 65.00,
    fotoEmoji: '🎂',
    estoque: 6,
    estoqueMinimo: 4,
    ativo: true,
    temFichaTecnica: true,
    rendimento: 1,
    unidadeRendimento: 'pote',
    tempoPreparoMinutos: 60,
    custoIngredientesTotal: 18.70,
    custoEmbalagensTotal: 3.20,
    custosIndiretosTotal: 10.00,
    custoTotalReceita: 31.90,
    custoUnitario: 31.90,
    precoSugeridoVenda: 65.00,
    margemLucroPercentual: 103,
    lucroLiquidoUnitario: 33.10,
    ingredientes: [
      { id: 'i5', insumoId: 'ins-4', nome: 'Pasta Pura de Pistache', quantidade: 60, unidade: 'g', custoPorUnidade: 0.145, custoTotal: 8.70 },
      { id: 'i6', insumoId: 'ins-7', nome: 'Frutas Vermelhas Frescas', quantidade: 80, unidade: 'g', custoPorUnidade: 0.068, custoTotal: 5.44 },
      { id: 'i7', insumoId: 'ins-8', nome: 'Creme de Leite Fresco', quantidade: 120, unidade: 'ml', custoPorUnidade: 0.0269, custoTotal: 3.23 },
    ],
    embalagens: [
      { id: 'e3', insumoId: 'ins-12', nome: 'Caixa Bentô Cake Biodegradável', quantidade: 1, unidade: 'un', custoUnitario: 1.96, custoTotal: 1.96 },
      { id: 'e4', insumoId: 'ins-10', nome: 'Fita de Cetim Dourada', quantidade: 2, unidade: 'm', custoUnitario: 0.398, custoTotal: 0.80 },
    ],
    custosIndiretos: [
      { id: 'c3', tipo: 'gas', descricao: 'Gás de Cozinha Fornada', modo: 'fixo_reais', valor: 4.00, valorCalculado: 4.00 },
      { id: 'c4', tipo: 'mao_de_obra', descricao: 'Decoração e Confeiteira', modo: 'fixo_reais', valor: 6.00, valorCalculado: 6.00 },
    ],
  },
  {
    id: 'prod-3',
    nome: 'Cento de Brigadeiros Belga 54%',
    categoria: 'Doces Finos & Brigadeiros',
    preco: 160.00,
    fotoEmoji: '🍬',
    estoque: 12,
    estoqueMinimo: 8,
    ativo: true,
    temFichaTecnica: true,
    rendimento: 100,
    unidadeRendimento: 'unidades',
    tempoPreparoMinutos: 90,
    custoIngredientesTotal: 44.50,
    custoEmbalagensTotal: 12.00,
    custosIndiretosTotal: 20.00,
    custoTotalReceita: 76.50,
    custoUnitario: 0.765,
    precoSugeridoVenda: 160.00,
    margemLucroPercentual: 109,
    lucroLiquidoUnitario: 83.50,
  },
  {
    id: 'prod-4',
    nome: 'Caixa Macarons Degustação (6 un)',
    categoria: 'Macarons',
    preco: 57.00,
    fotoEmoji: '✨',
    estoque: 8,
    estoqueMinimo: 5,
    ativo: true,
    temFichaTecnica: false, // Produto cadastrado rápido sem ficha
  },
  {
    id: 'prod-5',
    nome: 'Torta de Nozes c/ Caramelo Salgado',
    categoria: 'Tortas & Fatias',
    preco: 140.00,
    fotoEmoji: '🥧',
    estoque: 3,
    estoqueMinimo: 2,
    ativo: true,
    temFichaTecnica: false, // Produto sem ficha
  },
  {
    id: 'prod-6',
    nome: 'Café Cold Brew com Baunilha 300ml',
    categoria: 'Bebidas & Cafés',
    preco: 14.50,
    fotoEmoji: '☕',
    estoque: 18,
    estoqueMinimo: 6,
    ativo: true,
    temFichaTecnica: false,
  },
];

const CATEGORIAS_PADRAO = [
  'Todas',
  'Cookies',
  'Bolos & Bentôs',
  'Doces Finos & Brigadeiros',
  'Macarons',
  'Tortas & Fatias',
  'Bebidas & Cafés',
  'Kits & Presentes',
];

const EMOJIS_SUGESTOES = ['🍪', '🎂', '🧁', '🍬', '🥧', '🍫', '✨', '☕', '🥐', '🍓', '🎁', '🍩'];

export default function ProdutosEstoqueScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  // Estados principais
  const [produtosList, setProdutosList] = useState<ProdutoCompleto[]>(PRODUTOS_INICIAIS);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_PADRAO);
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  // Modais
  const [modalNovoProdutoVisible, setModalNovoProdutoVisible] = useState(false);
  const [modalDossieVisible, setModalDossieVisible] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoCompleto | null>(null);

  // Formulário do Produto (Híbrido)
  const [formNome, setFormNome] = useState('');
  const [formFotoEmoji, setFormFotoEmoji] = useState('🍪');
  const [formCategoria, setFormCategoria] = useState('Cookies');
  const [formPreco, setFormPreco] = useState('');
  const [formEstoque, setFormEstoque] = useState('10');
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState('5');

  // Nova categoria inline
  const [mostrarInputNovaCategoria, setMostrarInputNovaCategoria] = useState(false);
  const [novaCategoriaTexto, setNovaCategoriaTexto] = useState('');

  // Toggle de Ficha Técnica / Precificação
  const [habilitarFichaTecnica, setHabilitarFichaTecnica] = useState(false);
  const [formRendimento, setFormRendimento] = useState('12');
  const [formUnidadeRendimento, setFormUnidadeRendimento] = useState<'unidades' | 'kg' | 'grama' | 'fatia' | 'pote'>('unidades');
  const [formTempoPreparo, setFormTempoPreparo] = useState('45');

  // Ficha Técnica: Ingredientes
  const [ingredientesUsados, setIngredientesUsados] = useState<IngredienteUtilizado[]>([]);
  const [insumoSelecionadoId, setInsumoSelecionadoId] = useState('');
  const [quantidadeInsumoInput, setQuantidadeInsumoInput] = useState('');

  // Ficha Técnica: Embalagens
  const [embalagensUsadas, setEmbalagensUsadas] = useState<EmbalagemUtilizada[]>([]);
  const [embalagemSelecionadaId, setEmbalagemSelecionadaId] = useState('');
  const [quantidadeEmbalagemInput, setQuantidadeEmbalagemInput] = useState('');

  // Ficha Técnica: Custos Indiretos
  const [custosIndiretos, setCustosIndiretos] = useState<CustoIndireto[]>([
    { id: 'ci-gas', tipo: 'gas', descricao: 'Gás / Forno', modo: 'fixo_reais', valor: 3.00, valorCalculado: 3.00 },
    { id: 'ci-energia', tipo: 'energia', descricao: 'Energia Elétrica & Batedeira', modo: 'fixo_reais', valor: 2.00, valorCalculado: 2.00 },
    { id: 'ci-mao', tipo: 'mao_de_obra', descricao: 'Mão de Obra de Produção', modo: 'fixo_reais', valor: 5.00, valorCalculado: 5.00 },
  ]);

  // Modo de Lucro Desejado: % ou R$
  const [modoLucro, setModoLucro] = useState<'porcentagem' | 'reais'>('porcentagem');
  const [margemLucroDesejada, setMargemLucroDesejada] = useState('200'); // ex: 200% de markup
  const [lucroReaisDesejado, setLucroReaisDesejado] = useState('15'); // ex: R$ 15,00 por unidade
  const [formErro, setFormErro] = useState<string | null>(null);

  // Carregar produtos de Supabase com fallback seguro
  useEffect(() => {
    carregarProdutosSupabase();
  }, []);

  const carregarProdutosSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return;

      if (data && data.length > 0) {
        const formatados: ProdutoCompleto[] = data.map((item: any, idx: number) => {
          return {
            id: item.id || `prod-db-${idx}`,
            nome: item.nome || 'Produto sem nome',
            categoria: item.categoria || 'Geral',
            preco: Number(item.preco) || 0,
            fotoEmoji: '🧁',
            estoque: Number(item.estoque) || 0,
            estoqueMinimo: 5,
            ativo: item.ativo !== false,
            temFichaTecnica: false,
          };
        });

        const nomesDb = new Set(formatados.map(f => f.nome.toLowerCase()));
        const unicosLocais = PRODUTOS_INICIAIS.filter(loc => !nomesDb.has(loc.nome.toLowerCase()));
        setProdutosList([...formatados, ...unicosLocais]);
      }
    } catch {
      // Ignora erro mantendo dados locais
    }
  };

  // ==========================================================================
  // CÁLCULOS FINANCEIROS EM TEMPO REAL DA FICHA TÉCNICA (UX SENIOR)
  // ==========================================================================
  const calculosFinanceiros = useMemo(() => {
    // 1. Total dos Ingredientes
    const totalIngredientes = ingredientesUsados.reduce((acc, curr) => acc + curr.custoTotal, 0);

    // 2. Total das Embalagens
    const totalEmbalagens = embalagensUsadas.reduce((acc, curr) => acc + curr.custoTotal, 0);

    // 3. Total Custos Indiretos
    const subtotalInsumos = totalIngredientes + totalEmbalagens;
    const totalIndiretos = custosIndiretos.reduce((acc, curr) => {
      if (curr.modo === 'porcentagem') {
        const valCalc = (subtotalInsumos * curr.valor) / 100;
        return acc + valCalc;
      }
      return acc + curr.valor;
    }, 0);

    // 4. Soma de todos eles (Custo Total da Receita)
    const custoTotalReceita = totalIngredientes + totalEmbalagens + totalIndiretos;

    // 5. Custo por Unidade (CPV Unitário)
    const rendimentoNum = Math.max(1, parseFloat(formRendimento) || 1);
    const custoUnitario = custoTotalReceita / rendimentoNum;

    // 6. Preço Sugerido com Lucro
    let precoSugerido = 0;
    let lucroEstimadoUnitario = 0;
    let margemCalculadaPercentual = 0;

    if (modoLucro === 'porcentagem') {
      const margemNum = parseFloat(margemLucroDesejada) || 0;
      // Preço de venda com markup sobre o custo: Custo * (1 + Margem/100)
      precoSugerido = custoUnitario * (1 + margemNum / 100);
      lucroEstimadoUnitario = precoSugerido - custoUnitario;
      margemCalculadaPercentual = margemNum;
    } else {
      const lucroNum = parseFloat(lucroReaisDesejado) || 0;
      precoSugerido = custoUnitario + lucroNum;
      lucroEstimadoUnitario = lucroNum;
      margemCalculadaPercentual = custoUnitario > 0 ? (lucroNum / custoUnitario) * 100 : 0;
    }

    return {
      totalIngredientes,
      totalEmbalagens,
      totalIndiretos,
      custoTotalReceita,
      custoUnitario,
      precoSugerido: Math.max(0, precoSugerido),
      lucroEstimadoUnitario: Math.max(0, lucroEstimadoUnitario),
      margemCalculadaPercentual,
    };
  }, [ingredientesUsados, embalagensUsadas, custosIndiretos, formRendimento, modoLucro, margemLucroDesejada, lucroReaisDesejado]);

  // Formatador Moeda
  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Filtragem de Produtos
  const produtosFiltrados = useMemo(() => {
    return produtosList.filter(prod => {
      // Categoria
      if (categoriaAtiva !== 'Todas' && prod.categoria !== categoriaAtiva) {
        return false;
      }

      // Status
      if (statusFilter === 'ativos' && !prod.ativo) return false;
      if (statusFilter === 'inativos' && prod.ativo) return false;
      if (statusFilter === 'com_ficha' && !prod.temFichaTecnica) return false;
      if (statusFilter === 'sem_ficha' && prod.temFichaTecnica) return false;

      // Busca
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchNome = prod.nome.toLowerCase().includes(query);
        const matchCat = prod.categoria.toLowerCase().includes(query);
        if (!matchNome && !matchCat) return false;
      }

      return true;
    });
  }, [produtosList, categoriaAtiva, statusFilter, searchQuery]);

  // Contadores
  const totalProdutos = produtosList.length;
  const totalComFicha = produtosList.filter(p => p.temFichaTecnica).length;
  const totalEstoqueBaixo = produtosList.filter(p => p.estoque <= p.estoqueMinimo).length;
  const valorEstoqueGeral = produtosList.reduce((acc, curr) => acc + curr.estoque * curr.preco, 0);

  // Ações de Ficha Técnica: Adicionar Ingrediente
  const handleAdicionarIngrediente = () => {
    if (!insumoSelecionadoId) return;
    const qtd = parseFloat(quantidadeInsumoInput.replace(',', '.')) || 0;
    if (qtd <= 0) return;

    const insumo = INSUMOS_DISPONIVEIS.find(i => i.id === insumoSelecionadoId);
    if (!insumo) return;

    const custoTotal = qtd * insumo.custoFracionado;
    const novo: IngredienteUtilizado = {
      id: `ing-${Date.now()}`,
      insumoId: insumo.id,
      nome: insumo.nome,
      quantidade: qtd,
      unidade: insumo.unidade,
      custoPorUnidade: insumo.custoFracionado,
      custoTotal,
    };

    setIngredientesUsados(prev => [...prev, novo]);
    setInsumoSelecionadoId('');
    setQuantidadeInsumoInput('');
  };

  // Remover Ingrediente
  const handleRemoverIngrediente = (id: string) => {
    setIngredientesUsados(prev => prev.filter(i => i.id !== id));
  };

  // Adicionar Embalagem
  const handleAdicionarEmbalagem = () => {
    if (!embalagemSelecionadaId) return;
    const qtd = parseFloat(quantidadeEmbalagemInput.replace(',', '.')) || 0;
    if (qtd <= 0) return;

    const emb = INSUMOS_DISPONIVEIS.find(i => i.id === embalagemSelecionadaId);
    if (!emb) return;

    const custoTotal = qtd * emb.custoFracionado;
    const nova: EmbalagemUtilizada = {
      id: `emb-${Date.now()}`,
      insumoId: emb.id,
      nome: emb.nome,
      quantidade: qtd,
      unidade: emb.unidade,
      custoUnitario: emb.custoFracionado,
      custoTotal,
    };

    setEmbalagensUsadas(prev => [...prev, nova]);
    setEmbalagemSelecionadaId('');
    setQuantidadeEmbalagemInput('');
  };

  // Remover Embalagem
  const handleRemoverEmbalagem = (id: string) => {
    setEmbalagensUsadas(prev => prev.filter(e => e.id !== id));
  };

  // Criar Categoria Inline
  const handleCriarCategoria = () => {
    if (!novaCategoriaTexto.trim()) return;
    const nova = novaCategoriaTexto.trim();
    if (!categorias.includes(nova)) {
      setCategorias(prev => [...prev, nova]);
    }
    setFormCategoria(nova);
    setNovaCategoriaTexto('');
    setMostrarInputNovaCategoria(false);
  };

  // Abrir Modal de Novo Produto
  const handleAbrirNovoProduto = () => {
    setFormNome('');
    setFormFotoEmoji('🍪');
    setFormCategoria(categorias[1] || 'Cookies');
    setFormPreco('');
    setFormEstoque('10');
    setFormEstoqueMinimo('5');
    setHabilitarFichaTecnica(false);
    setFormRendimento('12');
    setFormUnidadeRendimento('unidades');
    setFormTempoPreparo('45');
    setIngredientesUsados([]);
    setEmbalagensUsadas([]);
    setFormErro(null);
    setModalNovoProdutoVisible(true);
  };

  // Salvar Novo Produto
  const handleSalvarProduto = async () => {
    if (!formNome.trim()) {
      setFormErro('Por favor, informe o nome do produto.');
      return;
    }

    const precoNum = parseFloat(formPreco.replace(/\./g, '').replace(',', '.'));
    if (isNaN(precoNum) || precoNum <= 0) {
      setFormErro('Por favor, informe o valor/preço de venda do produto.');
      return;
    }

    const estoqueNum = parseFloat(formEstoque) || 0;
    const estoqueMinNum = parseFloat(formEstoqueMinimo) || 0;

    const novoProduto: ProdutoCompleto = {
      id: `prod-${Date.now()}`,
      nome: formNome.trim(),
      categoria: formCategoria,
      preco: precoNum,
      fotoEmoji: formFotoEmoji,
      estoque: estoqueNum,
      estoqueMinimo: estoqueMinNum,
      ativo: true,
      temFichaTecnica: habilitarFichaTecnica,
      ...(habilitarFichaTecnica && {
        rendimento: parseFloat(formRendimento) || 1,
        unidadeRendimento: formUnidadeRendimento,
        tempoPreparoMinutos: parseInt(formTempoPreparo) || 30,
        ingredientes: ingredientesUsados,
        embalagens: embalagensUsadas,
        custosIndiretos,
        custoIngredientesTotal: calculosFinanceiros.totalIngredientes,
        custoEmbalagensTotal: calculosFinanceiros.totalEmbalagens,
        custosIndiretosTotal: calculosFinanceiros.totalIndiretos,
        custoTotalReceita: calculosFinanceiros.custoTotalReceita,
        custoUnitario: calculosFinanceiros.custoUnitario,
        precoSugeridoVenda: calculosFinanceiros.precoSugerido,
        margemLucroPercentual: Math.round(calculosFinanceiros.margemCalculadaPercentual),
        lucroLiquidoUnitario: calculosFinanceiros.lucroEstimadoUnitario,
      }),
    };

    setProdutosList(prev => [novoProduto, ...prev]);
    setModalNovoProdutoVisible(false);

    // Salvar no Supabase
    try {
      await supabase.from('produtos').insert([
        {
          nome: novoProduto.nome,
          categoria: novoProduto.categoria,
          preco: novoProduto.preco,
          estoque: novoProduto.estoque,
          ativo: novoProduto.ativo,
          rendimento_unidades: novoProduto.rendimento || 1,
          tempo_preparo_minutos: novoProduto.tempoPreparoMinutos || 0,
        },
      ]);
    } catch {
      // Ignora erro mantendo estado local consistente
    }
  };

  // ==========================================================================
  // RENDERIZAÇÃO PRINCIPAL
  // ==========================================================================
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screenWrapper}>
        {/* SIDEBAR MODULAR OFICIAL */}
        <Sidebar activeRoute="/produtos-estoque" />

        {/* ÁREA DE CONTEÚDO PRINCIPAL */}
        <View style={styles.mainContainer}>
          {/* HEADER PRINCIPAL */}
          <View style={styles.topHeader}>
            <View style={styles.headerTitleCol}>
              <View style={styles.headerBadgeRow}>
                <View style={styles.activeDot} />
                <Text style={styles.headerCategoryBadge}>CATÁLOGO & VITRINE</Text>
                <View style={styles.systemBluePill}>
                  <Text style={styles.systemBluePillText}>KIPI ATELIÊ</Text>
                </View>
              </View>
              <Text style={styles.pageTitle}>Produtos & Estoque</Text>
              <Text style={styles.pageSubtitle}>
                Cadastre seus doces de forma rápida ou crie fichas técnicas completas com precificação inteligente.
              </Text>
            </View>

            {/* BOTÃO NOVO PRODUTO */}
            <TouchableOpacity
              style={styles.btnNovoProduto}
              onPress={handleAbrirNovoProduto}>
              <Feather name="plus-circle" size={17} color="#FFFFFF" />
              <Text style={styles.btnNovoProdutoText}>+ Novo Produto</Text>
            </TouchableOpacity>
          </View>

          {/* =========================================================================
              CARDS DE KPIS EM DESTAQUE (AZUL OFICIAL & DESIGN ATELIÊ)
          ========================================================================== */}
          <View style={styles.kpiCardsRow}>
            {/* KPI 1: Total Produtos */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardHeader}>
                <Text style={styles.kpiLabel}>TOTAL DE PRODUTOS</Text>
                <View style={[styles.kpiIconBox, { backgroundColor: KIPI_BLUE_TINT }]}>
                  <Feather name="package" size={16} color={KIPI_BLUE_ACCENT} />
                </View>
              </View>
              <Text style={styles.kpiValue}>{totalProdutos}</Text>
              <Text style={styles.kpiSubtext}>Cadastrados no catálogo</Text>
            </View>

            {/* KPI 2: Com Ficha Técnica */}
            <TouchableOpacity
              style={[styles.kpiCard, statusFilter === 'com_ficha' && styles.kpiCardActive]}
              onPress={() => setStatusFilter(statusFilter === 'com_ficha' ? 'todos' : 'com_ficha')}>
              <View style={styles.kpiCardHeader}>
                <Text style={styles.kpiLabel}>FICHAS TÉCNICAS</Text>
                <View style={[styles.kpiIconBox, { backgroundColor: SUCCESS_TINT }]}>
                  <Feather name="check-circle" size={16} color={SUCCESS_GREEN} />
                </View>
              </View>
              <Text style={styles.kpiValue}>{totalComFicha}</Text>
              <Text style={styles.kpiSubtext}>Com custo e margem calculados</Text>
            </TouchableOpacity>

            {/* KPI 3: Estoque Baixo */}
            <View style={[styles.kpiCard, totalEstoqueBaixo > 0 && styles.kpiCardAlert]}>
              <View style={styles.kpiCardHeader}>
                <Text style={[styles.kpiLabel, totalEstoqueBaixo > 0 && { color: DANGER_RED }]}>
                  ESTOQUE BAIXO
                </Text>
                <View style={[styles.kpiIconBox, { backgroundColor: totalEstoqueBaixo > 0 ? DANGER_TINT : SUCCESS_TINT }]}>
                  <Feather
                    name={totalEstoqueBaixo > 0 ? 'alert-triangle' : 'check'}
                    size={16}
                    color={totalEstoqueBaixo > 0 ? DANGER_RED : SUCCESS_GREEN}
                  />
                </View>
              </View>
              <Text style={[styles.kpiValue, totalEstoqueBaixo > 0 && { color: DANGER_RED }]}>
                {totalEstoqueBaixo}
              </Text>
              <Text style={styles.kpiSubtext}>
                {totalEstoqueBaixo > 0 ? 'Produtos precisam de produção' : 'Estoque seguro'}
              </Text>
            </View>

            {/* KPI 4: Valor Total em Prateleira */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardHeader}>
                <Text style={styles.kpiLabel}>VALOR EM PRATELEIRA</Text>
                <View style={[styles.kpiIconBox, { backgroundColor: KIPI_BLUE_TINT }]}>
                  <Feather name="dollar-sign" size={16} color={KIPI_BLUE_ACCENT} />
                </View>
              </View>
              <Text style={styles.kpiValue}>{formatMoney(valorEstoqueGeral)}</Text>
              <Text style={styles.kpiSubtext}>Soma do estoque em preço de venda</Text>
            </View>
          </View>

          {/* =========================================================================
              FILTROS & BARRA DE CATEGORIAS
          ========================================================================== */}
          <View style={styles.filterSection}>
            {/* Linha 1: Categorias por Pílulas Deslizantes */}
            <View style={styles.categoriesRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                {categorias.map(cat => {
                  const isActive = categoriaAtiva === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                      onPress={() => setCategoriaAtiva(cat)}>
                      <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Linha 2: Busca, Status e Modos de Visualização */}
            <View style={styles.filterControlsRow}>
              {/* Campo de Busca */}
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar produto por nome ou categoria..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Feather name="x" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filtro de Status */}
              <View style={styles.statusFilterGroup}>
                <TouchableOpacity
                  style={[styles.statusFilterBtn, statusFilter === 'todos' && styles.statusFilterBtnActive]}
                  onPress={() => setStatusFilter('todos')}>
                  <Text style={[styles.statusFilterBtnText, statusFilter === 'todos' && styles.statusFilterBtnTextActive]}>
                    Todos
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusFilterBtn, statusFilter === 'com_ficha' && styles.statusFilterBtnActive]}
                  onPress={() => setStatusFilter('com_ficha')}>
                  <Text style={[styles.statusFilterBtnText, statusFilter === 'com_ficha' && styles.statusFilterBtnTextActive]}>
                    Com Ficha 🔬
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusFilterBtn, statusFilter === 'sem_ficha' && styles.statusFilterBtnActive]}
                  onPress={() => setStatusFilter('sem_ficha')}>
                  <Text style={[styles.statusFilterBtnText, statusFilter === 'sem_ficha' && styles.statusFilterBtnTextActive]}>
                    Rápidos ⚡
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Seletor de Modo de Exibição (Cards, Grid, Lista) */}
              <View style={styles.viewSwitcher}>
                <TouchableOpacity
                  style={[styles.viewBtn, viewMode === 'cards' && styles.viewBtnActive]}
                  onPress={() => setViewMode('cards')}
                  accessibilityLabel="Modo Cards">
                  <Feather name="credit-card" size={14} color={viewMode === 'cards' ? KIPI_BLUE_ACCENT : '#64748B'} />
                  <Text style={[styles.viewBtnText, viewMode === 'cards' && styles.viewBtnTextActive]}>Cards</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}
                  onPress={() => setViewMode('grid')}
                  accessibilityLabel="Modo Grid">
                  <Feather name="grid" size={14} color={viewMode === 'grid' ? KIPI_BLUE_ACCENT : '#64748B'} />
                  <Text style={[styles.viewBtnText, viewMode === 'grid' && styles.viewBtnTextActive]}>Grid</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.viewBtn, viewMode === 'lista' && styles.viewBtnActive]}
                  onPress={() => setViewMode('lista')}
                  accessibilityLabel="Modo Lista">
                  <Feather name="list" size={14} color={viewMode === 'lista' ? KIPI_BLUE_ACCENT : '#64748B'} />
                  <Text style={[styles.viewBtnText, viewMode === 'lista' && styles.viewBtnTextActive]}>Lista</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* =========================================================================
              CONTEÚDO DE PRODUTOS
          ========================================================================== */}
          <ScrollView
            style={styles.productsScroll}
            contentContainerStyle={styles.productsScrollContent}
            showsVerticalScrollIndicator={false}>
            {produtosFiltrados.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="package" size={28} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>Nenhum produto encontrado</Text>
                <Text style={styles.emptySubtitle}>
                  Tente trocar a categoria selecionada ou clique no botão para cadastrar um novo produto.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleAbrirNovoProduto}>
                  <Feather name="plus-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Cadastrar Produto</Text>
                </TouchableOpacity>
              </View>
            ) : viewMode === 'cards' ? (
              // MODO 1: CARDS DETALHADOS
              <View style={styles.cardsGrid}>
                {produtosFiltrados.map(prod => {
                  const isEstoqueBaixo = prod.estoque <= prod.estoqueMinimo;

                  return (
                    <TouchableOpacity
                      key={prod.id}
                      style={[styles.productCard, isEstoqueBaixo && styles.productCardAlert]}
                      activeOpacity={0.88}
                      onPress={() => {
                        setProdutoSelecionado(prod);
                        setModalDossieVisible(true);
                      }}>
                      {/* Topo do Card */}
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.productAvatar}>
                          <Text style={{ fontSize: 24 }}>{prod.fotoEmoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.cardCategoryRow}>
                            <Text style={styles.cardCategoryText}>{prod.categoria}</Text>
                            {prod.temFichaTecnica ? (
                              <View style={styles.techBadge}>
                                <Text style={styles.techBadgeText}>🔬 FICHA TÉCNICA</Text>
                              </View>
                            ) : (
                              <View style={styles.quickBadge}>
                                <Text style={styles.quickBadgeText}>⚡ RÁPIDO</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.cardTitle} numberOfLines={1}>{prod.nome}</Text>
                        </View>
                      </View>

                      {/* Dados Financeiros: Preço, Custo e Lucro */}
                      <View style={styles.financialCardBox}>
                        <View style={styles.finCol}>
                          <Text style={styles.finLabel}>PREÇO DE VENDA</Text>
                          <Text style={styles.finPrice}>{formatMoney(prod.preco)}</Text>
                        </View>

                        {prod.temFichaTecnica && prod.custoUnitario ? (
                          <>
                            <View style={styles.finDivider} />
                            <View style={styles.finCol}>
                              <Text style={styles.finLabel}>CUSTO UNITÁRIO</Text>
                              <Text style={styles.finCost}>{formatMoney(prod.custoUnitario)}</Text>
                            </View>
                            <View style={styles.finDivider} />
                            <View style={styles.finCol}>
                              <Text style={styles.finLabel}>MARGEM</Text>
                              <Text style={styles.finMargin}>+{prod.margemLucroPercentual}%</Text>
                            </View>
                          </>
                        ) : (
                          <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                            <Text style={styles.noFichaNotice}>Ficha técnica não vinculada</Text>
                          </View>
                        )}
                      </View>

                      {/* Estoque e Alerta */}
                      <View style={styles.stockStatusRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Feather
                            name={isEstoqueBaixo ? 'alert-circle' : 'check-circle'}
                            size={14}
                            color={isEstoqueBaixo ? DANGER_RED : SUCCESS_GREEN}
                          />
                          <Text style={styles.stockStatusText}>
                            Estoque: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{prod.estoque} un</Text>
                          </Text>
                        </View>
                        {isEstoqueBaixo && (
                          <Text style={styles.alertNotice}>Mín: {prod.estoqueMinimo} un</Text>
                        )}
                      </View>

                      {/* Rodapé do Card */}
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardFooterHint}>
                          {prod.temFichaTecnica ? 'Tempo de preparo: ' + (prod.tempoPreparoMinutos || 30) + 'min' : 'Pronta entrega'}
                        </Text>
                        <View style={styles.cardActionLink}>
                          <Text style={styles.cardActionLinkText}>Ver Detalhes</Text>
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
                {produtosFiltrados.map(prod => (
                  <TouchableOpacity
                    key={prod.id}
                    style={styles.gridItem}
                    activeOpacity={0.88}
                    onPress={() => {
                      setProdutoSelecionado(prod);
                      setModalDossieVisible(true);
                    }}>
                    <View style={styles.gridTop}>
                      <Text style={{ fontSize: 22 }}>{prod.fotoEmoji}</Text>
                      <Text style={styles.gridPriceText}>{formatMoney(prod.preco)}</Text>
                    </View>
                    <Text style={styles.gridTitle} numberOfLines={2}>{prod.nome}</Text>
                    <Text style={styles.gridCat}>{prod.categoria}</Text>
                    <View style={styles.gridStock}>
                      <Text style={styles.gridStockLabel}>Estoque: {prod.estoque} un</Text>
                      {prod.temFichaTecnica && (
                        <Text style={styles.gridMarginBadge}>+{prod.margemLucroPercentual}%</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              // MODO 3: LISTA CORPORATIVA (TABELA)
              <View style={styles.tableCard}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 2.5 }]}>PRODUTO</Text>
                  <Text style={[styles.th, { flex: 1.3 }]}>CATEGORIA</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>PREÇO VENDA</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>CUSTO PROD.</Text>
                  <Text style={[styles.th, { flex: 1.1 }]}>MARGEM</Text>
                  <Text style={[styles.th, { flex: 1.1 }]}>ESTOQUE</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>TIPO</Text>
                  <Text style={[styles.th, { width: 60, textAlign: 'right' }]}>AÇÃO</Text>
                </View>

                {produtosFiltrados.map((prod, index) => {
                  const isEven = index % 2 === 0;
                  const isEstoqueBaixo = prod.estoque <= prod.estoqueMinimo;

                  return (
                    <TouchableOpacity
                      key={prod.id}
                      style={[styles.tableRow, isEven && styles.tableRowEven]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setProdutoSelecionado(prod);
                        setModalDossieVisible(true);
                      }}>
                      <View style={[styles.td, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <View style={styles.tableAvatar}>
                          <Text style={{ fontSize: 18 }}>{prod.fotoEmoji}</Text>
                        </View>
                        <Text style={styles.tableName} numberOfLines={1}>{prod.nome}</Text>
                      </View>

                      <View style={[styles.td, { flex: 1.3 }]}>
                        <Text style={styles.tableCat}>{prod.categoria}</Text>
                      </View>

                      <View style={[styles.td, { flex: 1.2 }]}>
                        <Text style={styles.tablePrice}>{formatMoney(prod.preco)}</Text>
                      </View>

                      <View style={[styles.td, { flex: 1.2 }]}>
                        <Text style={styles.tableCost}>
                          {prod.custoUnitario ? formatMoney(prod.custoUnitario) : '-'}
                        </Text>
                      </View>

                      <View style={[styles.td, { flex: 1.1 }]}>
                        {prod.margemLucroPercentual ? (
                          <View style={styles.tableMarginPill}>
                            <Text style={styles.tableMarginText}>+{prod.margemLucroPercentual}%</Text>
                          </View>
                        ) : (
                          <Text style={{ color: '#94A3B8', fontSize: 11 }}>-</Text>
                        )}
                      </View>

                      <View style={[styles.td, { flex: 1.1 }]}>
                        <Text style={[styles.tableStock, isEstoqueBaixo && { color: DANGER_RED }]}>
                          {prod.estoque} un
                        </Text>
                      </View>

                      <View style={[styles.td, { flex: 1.2 }]}>
                        {prod.temFichaTecnica ? (
                          <View style={styles.techBadgeSmall}>
                            <Text style={styles.techBadgeSmallText}>Ficha 🔬</Text>
                          </View>
                        ) : (
                          <View style={styles.quickBadgeSmall}>
                            <Text style={styles.quickBadgeSmallText}>Rápido ⚡</Text>
                          </View>
                        )}
                      </View>

                      <View style={[styles.td, { width: 60, alignItems: 'flex-end' }]}>
                        <Feather name="chevron-right" size={17} color={KIPI_BLUE_ACCENT} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* =========================================================================
          MODAL DE CADASTRO (+ NOVO PRODUTO HÍBRIDO)
          Sem scroll excessivo: Layout em abas / 2 colunas com live financeiro
      ========================================================================== */}
      <Modal
        visible={modalNovoProdutoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalNovoProdutoVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {/* Topo do Modal */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cadastrar Novo Produto</Text>
                <Text style={styles.modalSubtitle}>
                  Cadastre com preço fixo ou elabore a ficha técnica completa para calcular o custo exato.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalNovoProdutoVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {formErro && (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={15} color={DANGER_RED} />
                <Text style={styles.errorBannerText}>{formErro}</Text>
              </View>
            )}

            {/* CORPO DO MODAL (LAYOUT HÍBRIDO EM 2 COLUNAS PARA EVITAR SCROLL) */}
            <View style={styles.modalBodyColumns}>
              {/* COLUNA ESQUERDA: FORMULÁRIO */}
              <ScrollView style={styles.modalFormCol} showsVerticalScrollIndicator={false}>
                {/* 1. SELEÇÃO DE EMOJI / ÍCONE */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FOTO / ÍCONE DO PRODUTO</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
                    {EMOJIS_SUGESTOES.map(emoji => (
                      <TouchableOpacity
                        key={emoji}
                        style={[styles.emojiSelectBtn, formFotoEmoji === emoji && styles.emojiSelectBtnActive]}
                        onPress={() => setFormFotoEmoji(emoji)}>
                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* 2. NOME DO PRODUTO (OBRIGATÓRIO) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NOME DO PRODUTO *</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="Ex: Cookie Black Nutella & Avelã"
                    placeholderTextColor="#94A3B8"
                    value={formNome}
                    onChangeText={setFormNome}
                  />
                </View>

                {/* 3. CATEGORIA (COM ATALHO PARA CRIAR NOVA NA HORA) */}
                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.inputLabel}>CATEGORIA *</Text>
                    <TouchableOpacity
                      onPress={() => setMostrarInputNovaCategoria(!mostrarInputNovaCategoria)}>
                      <Text style={styles.linkText}>
                        {mostrarInputNovaCategoria ? 'Fechar' : '+ Criar Nova Categoria'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {mostrarInputNovaCategoria && (
                    <View style={styles.inlineNewCatBox}>
                      <TextInput
                        style={styles.inlineCatInput}
                        placeholder="Nome da nova categoria..."
                        placeholderTextColor="#94A3B8"
                        value={novaCategoriaTexto}
                        onChangeText={setNovaCategoriaTexto}
                      />
                      <TouchableOpacity
                        style={styles.inlineCatBtn}
                        onPress={handleCriarCategoria}>
                        <Text style={styles.inlineCatBtnText}>Adicionar</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipsScroll}>
                    {categorias.filter(c => c !== 'Todas').map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.catChip, formCategoria === cat && styles.catChipActive]}
                        onPress={() => setFormCategoria(cat)}>
                        <Text style={[styles.catChipText, formCategoria === cat && styles.catChipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* 4. PREÇO DE VENDA E ESTOQUE */}
                <View style={styles.formRow}>
                  <View style={[styles.inputGroup, { flex: 1.2 }]}>
                    <Text style={styles.inputLabel}>VALOR / PREÇO DE VENDA (R$) *</Text>
                    <View style={styles.currencyInputRow}>
                      <Text style={styles.currencySymbol}>R$</Text>
                      <TextInput
                        style={styles.currencyField}
                        placeholder="0,00"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={formPreco}
                        onChangeText={setFormPreco}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { flex: 0.9 }]}>
                    <Text style={styles.inputLabel}>ESTOQUE INICIAL</Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="10"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={formEstoque}
                      onChangeText={setFormEstoque}
                    />
                  </View>
                </View>

                {/* ===================================================================
                    5. TOGGLE PARA CRIAR FICHA TÉCNICA & PRECIFICAÇÃO DETALHADA
                ==================================================================== */}
                <View style={styles.recipeToggleBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeToggleTitle}>Ficha Técnica & Cálculo de Custos</Text>
                    <Text style={styles.recipeToggleSubtitle}>
                      Calcular custo exato de ingredientes, embalagens, mão de obra e margem de lucro.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleSwitch, habilitarFichaTecnica && styles.toggleSwitchActive]}
                    onPress={() => setHabilitarFichaTecnica(!habilitarFichaTecnica)}>
                    <View style={[styles.toggleDot, habilitarFichaTecnica && styles.toggleDotActive]} />
                  </TouchableOpacity>
                </View>

                {/* SE FICHA TÉCNICA ATIVA, EXIBE OS DETALHES ORGANIZADOS */}
                {habilitarFichaTecnica && (
                  <View style={styles.recipeDetailsSection}>
                    {/* Rendimento, Unidade e Tempo */}
                    <View style={styles.formRow}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>RENDIMENTO (QTD)</Text>
                        <TextInput
                          style={styles.inputBox}
                          placeholder="12"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={formRendimento}
                          onChangeText={setFormRendimento}
                        />
                      </View>

                      <View style={[styles.inputGroup, { flex: 1.2 }]}>
                        <Text style={styles.inputLabel}>UNIDADE</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitPillsRow}>
                          {(['unidades', 'kg', 'grama', 'fatia', 'pote'] as const).map(u => (
                            <TouchableOpacity
                              key={u}
                              style={[styles.unitPillSmall, formUnidadeRendimento === u && styles.unitPillSmallActive]}
                              onPress={() => setFormUnidadeRendimento(u)}>
                              <Text style={[styles.unitPillSmallText, formUnidadeRendimento === u && styles.unitPillSmallTextActive]}>
                                {u}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>

                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>TEMPO (MIN)</Text>
                        <TextInput
                          style={styles.inputBox}
                          placeholder="45 min"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={formTempoPreparo}
                          onChangeText={setFormTempoPreparo}
                        />
                      </View>
                    </View>

                    {/* SEÇÃO: INGREDIENTES */}
                    <View style={styles.subSectionBox}>
                      <View style={styles.subSectionHeader}>
                        <Text style={styles.subSectionTitle}>🥣 Ingredientes da Receita</Text>
                        <Text style={styles.subSectionCount}>{ingredientesUsados.length} adicionados</Text>
                      </View>

                      {/* Seletor Inline para Adicionar Ingrediente */}
                      <View style={styles.addItemRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsInsumosScroll}>
                          {INSUMOS_DISPONIVEIS.filter(i => i.tipo === 'ingrediente').map(ins => {
                            const isSelected = insumoSelecionadoId === ins.id;
                            return (
                              <TouchableOpacity
                                key={ins.id}
                                style={[styles.chipInsumo, isSelected && styles.chipInsumoActive]}
                                onPress={() => setInsumoSelecionadoId(ins.id)}>
                                <Text style={{ fontSize: 13 }}>{ins.emoji}</Text>
                                <Text style={[styles.chipInsumoText, isSelected && styles.chipInsumoTextActive]} numberOfLines={1}>
                                  {ins.nome}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TextInput
                            style={styles.amountInput}
                            placeholder="Qtd (g/ml)"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={quantidadeInsumoInput}
                            onChangeText={setQuantidadeInsumoInput}
                          />
                          <TouchableOpacity
                            style={styles.addInlineBtn}
                            onPress={handleAdicionarIngrediente}>
                            <Feather name="plus" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Lista de Ingredientes Adicionados */}
                      {ingredientesUsados.map(item => (
                        <View key={item.id} style={styles.addedItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.addedItemName}>{item.nome}</Text>
                            <Text style={styles.addedItemSub}>
                              {item.quantidade} {item.unidade} × R$ {item.custoPorUnidade.toFixed(4)}
                            </Text>
                          </View>
                          <Text style={styles.addedItemCost}>{formatMoney(item.custoTotal)}</Text>
                          <TouchableOpacity onPress={() => handleRemoverIngrediente(item.id)}>
                            <Feather name="trash-2" size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>

                    {/* SEÇÃO: EMBALAGENS */}
                    <View style={styles.subSectionBox}>
                      <View style={styles.subSectionHeader}>
                        <Text style={styles.subSectionTitle}>📦 Embalagens Utilizadas</Text>
                        <Text style={styles.subSectionCount}>{embalagensUsadas.length} adicionadas</Text>
                      </View>

                      <View style={styles.addItemRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsInsumosScroll}>
                          {INSUMOS_DISPONIVEIS.filter(i => i.tipo === 'embalagem').map(emb => {
                            const isSelected = embalagemSelecionadaId === emb.id;
                            return (
                              <TouchableOpacity
                                key={emb.id}
                                style={[styles.chipInsumo, isSelected && styles.chipInsumoActive]}
                                onPress={() => setEmbalagemSelecionadaId(emb.id)}>
                                <Text style={{ fontSize: 13 }}>{emb.emoji}</Text>
                                <Text style={[styles.chipInsumoText, isSelected && styles.chipInsumoTextActive]} numberOfLines={1}>
                                  {emb.nome}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TextInput
                            style={styles.amountInput}
                            placeholder="Qtd un"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={quantidadeEmbalagemInput}
                            onChangeText={setQuantidadeEmbalagemInput}
                          />
                          <TouchableOpacity
                            style={styles.addInlineBtn}
                            onPress={handleAdicionarEmbalagem}>
                            <Feather name="plus" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {embalagensUsadas.map(item => (
                        <View key={item.id} style={styles.addedItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.addedItemName}>{item.nome}</Text>
                            <Text style={styles.addedItemSub}>
                              {item.quantidade} {item.unidade} × {formatMoney(item.custoUnitario)}
                            </Text>
                          </View>
                          <Text style={styles.addedItemCost}>{formatMoney(item.custoTotal)}</Text>
                          <TouchableOpacity onPress={() => handleRemoverEmbalagem(item.id)}>
                            <Feather name="trash-2" size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>

                    {/* SEÇÃO: CUSTOS INDIRETOS */}
                    <View style={styles.subSectionBox}>
                      <View style={styles.subSectionHeader}>
                        <Text style={styles.subSectionTitle}>⚡ Custos Indiretos (Energia, Gás, Mão de Obra)</Text>
                      </View>

                      {custosIndiretos.map((ci, idx) => (
                        <View key={ci.id} style={styles.indirectCostRow}>
                          <Text style={styles.indirectCostName}>{ci.descricao}</Text>
                          <View style={styles.indirectCostInputBox}>
                            <Text style={styles.indirectCostPrefix}>R$</Text>
                            <TextInput
                              style={styles.indirectCostInput}
                              keyboardType="numeric"
                              value={ci.valor.toString()}
                              onChangeText={text => {
                                const valNum = parseFloat(text.replace(',', '.')) || 0;
                                setCustosIndiretos(prev => prev.map((item, i) => i === idx ? { ...item, valor: valNum, valorCalculado: valNum } : item));
                              }}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* COLUNA DIREITA: LIVE PRICING & PAINEL DE MARGEM (UX SÊNIOR) */}
              <View style={styles.modalPricingCol}>
                <View style={styles.pricingCard}>
                  <View style={styles.pricingHeader}>
                    <Feather name="trending-up" size={16} color={KIPI_BLUE_ACCENT} />
                    <Text style={styles.pricingHeaderTitle}>Custo & Precificação</Text>
                  </View>

                  {/* Resumo de Custos */}
                  <View style={styles.pricingBreakdown}>
                    <View style={styles.pricingRow}>
                      <Text style={styles.pricingLabel}>Ingredientes:</Text>
                      <Text style={styles.pricingValue}>{formatMoney(calculosFinanceiros.totalIngredientes)}</Text>
                    </View>
                    <View style={styles.pricingRow}>
                      <Text style={styles.pricingLabel}>Embalagens:</Text>
                      <Text style={styles.pricingValue}>{formatMoney(calculosFinanceiros.totalEmbalagens)}</Text>
                    </View>
                    <View style={styles.pricingRow}>
                      <Text style={styles.pricingLabel}>Custos Indiretos:</Text>
                      <Text style={styles.pricingValue}>{formatMoney(calculosFinanceiros.totalIndiretos)}</Text>
                    </View>
                    <View style={[styles.pricingRow, styles.pricingRowTotal]}>
                      <Text style={styles.pricingTotalLabel}>Custo Total da Fornada:</Text>
                      <Text style={styles.pricingTotalValue}>{formatMoney(calculosFinanceiros.custoTotalReceita)}</Text>
                    </View>
                  </View>

                  {/* Custo Unitário em Destaque */}
                  <View style={styles.unitCostHighlight}>
                    <Text style={styles.unitCostLabel}>CUSTO POR UNIDADE ({formUnidadeRendimento})</Text>
                    <Text style={styles.unitCostBig}>{formatMoney(calculosFinanceiros.custoUnitario)}</Text>
                  </View>

                  {/* Ajuste do Lucro Desejado: % ou R$ */}
                  <View style={styles.profitControlBox}>
                    <View style={styles.profitControlHeader}>
                      <Text style={styles.profitControlTitle}>DEFINIR LUCRO DESEJADO</Text>
                      <View style={styles.profitModeSwitch}>
                        <TouchableOpacity
                          style={[styles.profitModeBtn, modoLucro === 'porcentagem' && styles.profitModeBtnActive]}
                          onPress={() => setModoLucro('porcentagem')}>
                          <Text style={[styles.profitModeBtnText, modoLucro === 'porcentagem' && styles.profitModeBtnTextActive]}>
                            % Margem
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.profitModeBtn, modoLucro === 'reais' && styles.profitModeBtnActive]}
                          onPress={() => setModoLucro('reais')}>
                          <Text style={[styles.profitModeBtnText, modoLucro === 'reais' && styles.profitModeBtnTextActive]}>
                            R$ Fixo
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {modoLucro === 'porcentagem' ? (
                      <View style={styles.profitInputRow}>
                        <TextInput
                          style={styles.profitInputField}
                          keyboardType="numeric"
                          value={margemLucroDesejada}
                          onChangeText={setMargemLucroDesejada}
                        />
                        <Text style={styles.profitInputSuffix}>% de Markup</Text>
                      </View>
                    ) : (
                      <View style={styles.profitInputRow}>
                        <Text style={styles.profitInputPrefix}>R$</Text>
                        <TextInput
                          style={styles.profitInputField}
                          keyboardType="numeric"
                          value={lucroReaisDesejado}
                          onChangeText={setLucroReaisDesejado}
                        />
                        <Text style={styles.profitInputSuffix}>lucro por unidade</Text>
                      </View>
                    )}
                  </View>

                  {/* Preço de Venda Sugerido */}
                  <View style={styles.suggestedPriceBox}>
                    <View>
                      <Text style={styles.suggestedPriceLabel}>PREÇO SUGERIDO DE VENDA</Text>
                      <Text style={styles.suggestedPriceValue}>
                        {formatMoney(calculosFinanceiros.precoSugerido)}
                      </Text>
                      <Text style={styles.suggestedProfitSub}>
                        Lucro líquido: {formatMoney(calculosFinanceiros.lucroEstimadoUnitario)}/unidade
                      </Text>
                    </View>

                    {/* Botão de 1 clique para aplicar o preço sugerido no produto */}
                    <TouchableOpacity
                      style={styles.btnApplySuggested}
                      onPress={() => {
                        setFormPreco(calculosFinanceiros.precoSugerido.toFixed(2).replace('.', ','));
                      }}>
                      <Feather name="check" size={14} color="#FFFFFF" />
                      <Text style={styles.btnApplySuggestedText}>Aplicar no Produto</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Rodapé do Modal */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalNovoProdutoVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSalvarProduto}>
                <Feather name="check-circle" size={17} color="#FFFFFF" />
                <Text style={styles.modalSaveBtnText}>Salvar Produto</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL DE DOSSIÊ DO PRODUTO (AO CLICAR NO PRODUTO)
      ========================================================================== */}
      <Modal
        visible={modalDossieVisible && produtoSelecionado !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalDossieVisible(false)}>
        <View style={styles.modalOverlay}>
          {produtoSelecionado && (
            <View style={[styles.modalBox, { maxWidth: 640 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.dossierAvatarBox}>
                    <Text style={{ fontSize: 28 }}>{produtoSelecionado.fotoEmoji}</Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <Text style={styles.cardCategoryText}>{produtoSelecionado.categoria}</Text>
                      {produtoSelecionado.temFichaTecnica ? (
                        <View style={styles.techBadge}>
                          <Text style={styles.techBadgeText}>🔬 FICHA TÉCNICA</Text>
                        </View>
                      ) : (
                        <View style={styles.quickBadge}>
                          <Text style={styles.quickBadgeText}>⚡ RÁPIDO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modalTitle}>{produtoSelecionado.nome}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setModalDossieVisible(false)}>
                  <Feather name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {/* Resumo Financeiro */}
                <View style={styles.dossierFinancialRow}>
                  <View style={styles.dossierFinCard}>
                    <Text style={styles.dossierFinLabel}>PREÇO DE VENDA</Text>
                    <Text style={styles.dossierFinVal}>{formatMoney(produtoSelecionado.preco)}</Text>
                  </View>

                  <View style={styles.dossierFinCard}>
                    <Text style={styles.dossierFinLabel}>CUSTO UNITÁRIO</Text>
                    <Text style={[styles.dossierFinVal, { color: '#64748B' }]}>
                      {produtoSelecionado.custoUnitario ? formatMoney(produtoSelecionado.custoUnitario) : 'Não informado'}
                    </Text>
                  </View>

                  <View style={[styles.dossierFinCard, { backgroundColor: SUCCESS_TINT, borderColor: '#BBF7D0' }]}>
                    <Text style={[styles.dossierFinLabel, { color: SUCCESS_GREEN }]}>MARGEM REAL</Text>
                    <Text style={[styles.dossierFinVal, { color: SUCCESS_GREEN }]}>
                      {produtoSelecionado.margemLucroPercentual ? `+${produtoSelecionado.margemLucroPercentual}%` : '-'}
                    </Text>
                  </View>
                </View>

                {/* Composição da Ficha Técnica se houver */}
                {produtoSelecionado.temFichaTecnica && produtoSelecionado.ingredientes && (
                  <View style={styles.dossierSection}>
                    <Text style={styles.dossierSectionTitle}>Ingredientes Utilizados</Text>
                    {produtoSelecionado.ingredientes.map(i => (
                      <View key={i.id} style={styles.dossierItemRow}>
                        <Text style={styles.dossierItemName}>{i.nome}</Text>
                        <Text style={styles.dossierItemQtd}>{i.quantidade} {i.unidade}</Text>
                        <Text style={styles.dossierItemCost}>{formatMoney(i.custoTotal)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Estoque */}
                <View style={styles.dossierStockBox}>
                  <Text style={styles.dossierStockTitle}>Estoque em Prateleira</Text>
                  <Text style={styles.dossierStockNumber}>
                    {produtoSelecionado.estoque} unidades disponíveis
                  </Text>
                  <Text style={styles.dossierStockSub}>
                    Estoque mínimo de alerta: {produtoSelecionado.estoqueMinimo} unidades
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setModalDossieVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>Fechar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={() => setModalDossieVisible(false)}>
                  <Feather name="check" size={17} color="#FFFFFF" />
                  <Text style={styles.modalSaveBtnText}>Concluído</Text>
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
// ESTILOS VISUAIS COM A MESMA IDENTIDADE DAS TELAS REFINADAS
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
    marginBottom: 20,
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
  btnNovoProduto: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_BLUE,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    boxShadow: '0 2px 8px rgba(87, 152, 215, 0.35)',
  },
  btnNovoProdutoText: {
    fontFamily: FONT_SANS,
    fontSize: 14,
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
  kpiCardActive: {
    borderColor: KIPI_BLUE,
    backgroundColor: KIPI_BLUE_TINT,
  },
  kpiCardAlert: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF7ED',
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

  // FILTROS
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 12,
  },
  categoriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoriesScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: KIPI_BLUE,
    borderColor: KIPI_BLUE,
  },
  categoryPillText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#0F172A',
  },
  statusFilterGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  statusFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusFilterBtnActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  statusFilterBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusFilterBtnTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '700',
  },
  viewSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  viewBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  viewBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  viewBtnTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '700',
  },

  // LISTAGEM
  productsScroll: {
    flex: 1,
  },
  productsScrollContent: {
    paddingBottom: 40,
  },

  // CARDS DETALHADOS
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  productCard: {
    width: '32%',
    minWidth: 290,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productCardAlert: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBF9',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  productAvatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  cardCategoryText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  techBadge: {
    backgroundColor: SUCCESS_TINT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  techBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: SUCCESS_GREEN,
  },
  quickBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  quickBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
  },
  cardTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  financialCardBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  finCol: {
    flex: 1,
  },
  finDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  finLabel: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  finPrice: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  finCost: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  finMargin: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: SUCCESS_GREEN,
  },
  noFichaNotice: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  stockStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stockStatusText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#475569',
  },
  alertNotice: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: DANGER_RED,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardFooterHint: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#94A3B8',
  },
  cardActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardActionLinkText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },

  // GRID COMPACTO
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '24%',
    minWidth: 200,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gridTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridPriceText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  gridTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  gridCat: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 10,
  },
  gridStock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridStockLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#475569',
  },
  gridMarginBadge: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: SUCCESS_GREEN,
  },

  // TABELA
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
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
  tableCat: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
  },
  tablePrice: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  tableCost: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
  },
  tableMarginPill: {
    backgroundColor: SUCCESS_TINT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  tableMarginText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
    color: SUCCESS_GREEN,
  },
  tableStock: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  techBadgeSmall: {
    backgroundColor: SUCCESS_TINT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  techBadgeSmallText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: SUCCESS_GREEN,
  },
  quickBadgeSmall: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  quickBadgeSmallText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },

  // EMPTY STATE
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    maxWidth: 320,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_BLUE,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  emptyButtonText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // MODAL HÍBRIDO (2 COLUNAS SENIOR)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 960,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 14,
  },
  errorBannerText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: DANGER_RED,
    fontWeight: '600',
  },
  modalBodyColumns: {
    flexDirection: 'row',
    gap: 20,
    maxHeight: 520,
  },
  modalFormCol: {
    flex: 1.4,
  },
  modalPricingCol: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
    paddingLeft: 16,
  },

  // FORMULÁRIO INTERNO
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  inputBox: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  emojiList: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  emojiSelectBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emojiSelectBtnActive: {
    borderColor: KIPI_BLUE_ACCENT,
    backgroundColor: KIPI_BLUE_TINT,
  },
  linkText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },
  inlineNewCatBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  inlineCatInput: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineCatBtn: {
    backgroundColor: KIPI_BLUE_DARK,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  inlineCatBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  catChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: KIPI_BLUE_DARK,
    borderColor: KIPI_BLUE_DARK,
  },
  catChipText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  currencyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  currencySymbol: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 6,
  },
  currencyField: {
    flex: 1,
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 8,
  },

  // TOGGLE FICHA TÉCNICA
  recipeToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: KIPI_BLUE_TINT,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  recipeToggleTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  recipeToggleSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: KIPI_BLUE_ACCENT,
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },

  // SEÇÕES DE RECEITA
  recipeDetailsSection: {
    gap: 12,
  },
  unitPillsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  unitPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  unitPillSmallActive: {
    backgroundColor: KIPI_BLUE,
  },
  unitPillSmallText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  unitPillSmallTextActive: {
    color: '#FFFFFF',
  },
  subSectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  subSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subSectionTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  subSectionCount: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
  },
  addItemRow: {
    gap: 8,
    marginBottom: 10,
  },
  chipsInsumosScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chipInsumo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 5,
    maxWidth: 160,
  },
  chipInsumoActive: {
    borderColor: KIPI_BLUE_ACCENT,
    backgroundColor: KIPI_BLUE_TINT,
  },
  chipInsumoText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#475569',
  },
  chipInsumoTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '700',
  },
  amountInput: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: FONT_SANS,
    fontSize: 12,
  },
  addInlineBtn: {
    backgroundColor: KIPI_BLUE,
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 4,
    gap: 8,
  },
  addedItemName: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  addedItemSub: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#64748B',
  },
  addedItemCost: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  indirectCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  indirectCostName: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#475569',
  },
  indirectCostInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    width: 80,
  },
  indirectCostPrefix: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#94A3B8',
    marginRight: 4,
  },
  indirectCostInput: {
    flex: 1,
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 4,
  },

  // LIVE PRICING CARD (COLUNA DIREITA)
  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pricingHeaderTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  pricingBreakdown: {
    gap: 6,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingRowTotal: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  pricingLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
  },
  pricingValue: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  pricingTotalLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  pricingTotalValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  unitCostHighlight: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitCostLabel: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  unitCostBig: {
    fontFamily: FONT_DISPLAY,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  profitControlBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profitControlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profitControlTitle: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  profitModeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    padding: 2,
  },
  profitModeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  profitModeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  profitModeBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#64748B',
  },
  profitModeBtnTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '700',
  },
  profitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profitInputField: {
    width: 80,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  profitInputPrefix: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  profitInputSuffix: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
  },
  suggestedPriceBox: {
    backgroundColor: SUCCESS_TINT,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 10,
  },
  suggestedPriceLabel: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.5,
  },
  suggestedPriceValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 22,
    fontWeight: '800',
    color: '#166534',
    marginVertical: 2,
  },
  suggestedProfitSub: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#15803D',
  },
  btnApplySuggested: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUCCESS_GREEN,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  btnApplySuggestedText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // RODAPÉ DO MODAL
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
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_BLUE,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  modalSaveBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // DOSSIÊ STYLES
  dossierAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dossierFinancialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  dossierFinCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dossierFinLabel: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 3,
  },
  dossierFinVal: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  dossierSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  dossierSectionTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  dossierItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dossierItemName: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#334155',
  },
  dossierItemQtd: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
    marginRight: 12,
  },
  dossierItemCost: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  dossierStockBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  dossierStockTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  dossierStockNumber: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    color: SUCCESS_GREEN,
  },
  dossierStockSub: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
