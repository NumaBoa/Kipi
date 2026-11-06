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
import {
  useEstoqueVitrine,
  useEstoqueFreezer,
  cadastrarProduto,
  atualizarProduto,
  alternarAtivoProduto,
  produtoAtivo,
  type ProdutoVitrine,
} from '@/lib/estoqueVitrine';
import { useInsumos, useFichas, calcularFicha, margemReal, salvarFicha, congelarMassas, MARGEM_MINIMA, type Insumo } from '@/lib/insumos';
import FichaTecnicaModal from '@/components/FichaTecnicaModal';
import DescarteModal from '@/components/DescarteModal';
import ProducaoRapidaModal, { type ModoProducaoRapida } from '@/components/ProducaoRapidaModal';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Sidebar from '@/components/Sidebar';
import { useEhCelular } from '@/lib/layout';
import ProdutosMobile from '@/components/produtos-mobile/ProdutosMobile';
import { PageHeaderTitulo, TOPO_COMPACTO } from '@/components/PageHeader';

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
export type StatusFilter = 'todos' | 'ativos' | 'inativos' | 'com_ficha' | 'sem_ficha' | 'encomenda';
type Disponibilidade = NonNullable<ProdutoVitrine['disponibilidade']>;

const ROTULO_DISPONIBILIDADE: Record<Disponibilidade, string> = {
  pronta_entrega: '🛍️ Pronta-entrega',
  sob_encomenda: '📅 Sob encomenda',
  hibrido: '✨ Híbrido',
};

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
  disponibilidade: Disponibilidade;
  desconto: number; // promoção em R$ por unidade (0 = sem promoção)
  congelado: number; // massas no freezer, prontas para assar
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

// Opções da ficha técnica vêm da lista única de insumos (custo por g, ml ou un)
const paraInsumoRef = (i: Insumo): InsumoRef => ({
  id: i.id,
  nome: i.nome,
  tipo: i.tipo === 'ingrediente' ? 'ingrediente' : 'embalagem',
  unidade: i.unidadeFracionada,
  custoFracionado: i.custoUnitario,
  emoji: i.emoji,
});

// Foto (emoji) de cada produto da vitrine; a ficha técnica vem da lista única em lib/insumos
const FOTOS_INICIAIS: Record<string, string> = {
  'prod-1': '🍪',
  'prod-2': '🍪',
  'prod-3': '🍪',
  'prod-4': '🎂',
  'prod-5': '🎂',
  'prod-6': '✨',
  'prod-7': '✨',
  'prod-8': '🍰',
  'prod-9': '🍬',
  'prod-10': '🎁',
  'prod-11': '🥐',
  'prod-12': '🍯',
  'prod-13': '🥧',
  'prod-14': '☕',
};

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

// Celular: lista, detalhe, cadastro e receita próprios; computador: tela completa abaixo
export default function ProdutosEstoqueScreen() {
  const celular = useEhCelular();
  return celular ? <ProdutosMobile /> : <ProdutosEstoqueDesktop />;
}

function ProdutosEstoqueDesktop() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  // Estados principais
  // Nome, preço e estoque vêm da vitrine compartilhada; aqui ficam só ficha técnica, foto e categoria
  const vitrine = useEstoqueVitrine();
  // Ingredientes e embalagens da ficha técnica: a mesma lista de Insumos & Receitas
  const insumosLista = useInsumos();
  const insumosDisponiveis = insumosLista.filter((i) => i.status === 'ativo').map(paraInsumoRef);
  // Ficha técnica única (a mesma de Insumos & Receitas, Produção e Estoque Central)
  const { fichas: fichasTecnicas, horaTrabalhada } = useFichas();
  const [fotos, setFotos] = useState<Record<string, string>>(FOTOS_INICIAIS);
  const [fichaEditandoId, setFichaEditandoId] = useState<string | null>(null);
  const freezer = useEstoqueFreezer();
  const router = useRouter();
  // Atalho Assar: abre o modal aqui mesmo (sai do freezer e entra na vitrine, sem trocar de tela)
  const [producaoRapida, setProducaoRapida] = useState<{ id: string; modo: ModoProducaoRapida } | null>(null);
  const irParaAssar = (id: string) => setProducaoRapida({ id, modo: 'assar' });
  const produtosList: ProdutoCompleto[] = useMemo(
    () =>
      vitrine.map((v): ProdutoCompleto => {
        const base: ProdutoCompleto = {
          id: v.id,
          nome: v.nome,
          categoria: v.categoria,
          preco: v.preco,
          fotoEmoji: fotos[v.id] ?? '🧁',
          estoque: v.estoque,
          estoqueMinimo: v.estoqueMinimo,
          ativo: produtoAtivo(v),
          temFichaTecnica: false,
          disponibilidade: v.disponibilidade ?? 'pronta_entrega',
          desconto: v.desconto ?? 0,
          congelado: freezer[v.id] ?? 0,
        };
        const ft = fichasTecnicas.find((f) => f.produtoId === v.id);
        if (!ft) return base;
        const c = calcularFicha(ft, insumosLista, horaTrabalhada);
        const linhasDo = (ingrediente: boolean) => c.linhas.filter((l) => (l.item.tipo === 'ingrediente') === ingrediente);
        return {
          ...base,
          temFichaTecnica: true,
          rendimento: ft.rendimento,
          unidadeRendimento: 'unidades',
          tempoPreparoMinutos: ft.tempoPreparoMinutos,
          ingredientes: linhasDo(true).map((l) => ({
            id: l.insumoId,
            insumoId: l.insumoId,
            nome: l.item.nome,
            quantidade: l.quantidade,
            unidade: l.item.unidadeFracionada,
            custoPorUnidade: l.item.custoUnitario,
            custoTotal: l.custo,
          })),
          embalagens: linhasDo(false).map((l) => ({
            id: l.insumoId,
            insumoId: l.insumoId,
            nome: l.item.nome,
            quantidade: l.quantidade,
            unidade: l.item.unidadeFracionada,
            custoUnitario: l.item.custoUnitario,
            custoTotal: l.custo,
          })),
          custoIngredientesTotal: c.ingredientes,
          custoEmbalagensTotal: c.embalagens,
          custosIndiretosTotal: c.maoDeObra + c.extras,
          custoTotalReceita: c.custoTotal,
          custoUnitario: c.custoUnitario,
          precoSugeridoVenda: c.precoSugerido,
          margemLucroPercentual: Math.round(margemReal(v.preco, c.custoUnitario)),
          lucroLiquidoUnitario: v.preco - c.custoUnitario,
        };
      }),
    [vitrine, freezer, fotos, fichasTecnicas, insumosLista, horaTrabalhada]
  );
  const [categoriasCriadas, setCategorias] = useState<string[]>(CATEGORIAS_PADRAO);
  const categorias = useMemo(
    () => Array.from(new Set([...categoriasCriadas, ...produtosList.filter((p) => p.ativo).map((p) => p.categoria)])),
    [categoriasCriadas, produtosList]
  );
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const filtrosAtivos = [searchQuery.trim() !== '', categoriaAtiva !== 'Todas', statusFilter !== 'todos'].filter(Boolean).length;
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  // Modais
  const [modalNovoProdutoVisible, setModalNovoProdutoVisible] = useState(false);
  const [modalDossieVisible, setModalDossieVisible] = useState(false);
  // Guarda só o id: o dossiê acompanha mudanças da ficha, do preço e do estoque
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<string | null>(null);
  const produtoSelecionado = produtosList.find((p) => p.id === produtoSelecionadoId) ?? null;
  const [descarteId, setDescarteId] = useState<string | null>(null);
  const setProdutoSelecionado = (p: ProdutoCompleto | null) => setProdutoSelecionadoId(p?.id ?? null);

  // Atalho "Ver produto" da Estoque Central: chega com ?produto=<id> e já abre o dossiê
  const { produto: produtoDoAtalho, t: atalhoEm } = useLocalSearchParams<{ produto?: string; t?: string }>();
  useEffect(() => {
    const prod = produtoDoAtalho ? produtosList.find((p) => p.id === produtoDoAtalho) : undefined;
    if (!prod) return;
    setProdutoSelecionado(prod);
    setModalDossieVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoDoAtalho, atalhoEm]);

  // Formulário do Produto (Híbrido)
  const [formNome, setFormNome] = useState('');
  const [formFotoEmoji, setFormFotoEmoji] = useState('🍪');
  const [formCategoria, setFormCategoria] = useState('');
  const [formPreco, setFormPreco] = useState('');
  const [formEstoque, setFormEstoque] = useState('');
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState('');
  const [formCongelados, setFormCongelados] = useState('');
  const [formDisponibilidade, setFormDisponibilidade] = useState<Disponibilidade>('pronta_entrega');
  const [formDesconto, setFormDesconto] = useState('');
  // null = cadastro novo; id = edição do produto (a ficha é editada no editor próprio)
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Nova categoria inline
  const [mostrarInputNovaCategoria, setMostrarInputNovaCategoria] = useState(false);
  const [novaCategoriaTexto, setNovaCategoriaTexto] = useState('');

  // Toggle de Ficha Técnica / Precificação
  const [habilitarFichaTecnica, setHabilitarFichaTecnica] = useState(false);
  const [formRendimento, setFormRendimento] = useState('');
  const [formUnidadeRendimento, setFormUnidadeRendimento] = useState<'unidades' | 'kg' | 'grama' | 'fatia' | 'pote'>('unidades');
  const [formTempoPreparo, setFormTempoPreparo] = useState('');

  // Ficha Técnica: Ingredientes
  const [ingredientesUsados, setIngredientesUsados] = useState<IngredienteUtilizado[]>([]);
  const [insumoSelecionadoId, setInsumoSelecionadoId] = useState('');
  const [quantidadeInsumoInput, setQuantidadeInsumoInput] = useState('');

  // Ficha Técnica: Embalagens
  const [embalagensUsadas, setEmbalagensUsadas] = useState<EmbalagemUtilizada[]>([]);
  const [embalagemSelecionadaId, setEmbalagemSelecionadaId] = useState('');
  const [quantidadeEmbalagemInput, setQuantidadeEmbalagemInput] = useState('');

  // Ficha Técnica: Custos Indiretos (mão de obra = tempo de preparo × hora trabalhada)
  // Gás e energia aparecem para preencher, mas começam vazios
  const CUSTOS_INDIRETOS_VAZIOS: CustoIndireto[] = [
    { id: 'ci-gas', tipo: 'gas', descricao: 'Gás / Forno', modo: 'fixo_reais', valor: 0, valorCalculado: 0 },
    { id: 'ci-energia', tipo: 'energia', descricao: 'Energia Elétrica & Batedeira', modo: 'fixo_reais', valor: 0, valorCalculado: 0 },
  ];
  const [custosIndiretos, setCustosIndiretos] = useState<CustoIndireto[]>(CUSTOS_INDIRETOS_VAZIOS);

  // Modo de Lucro Desejado: % ou R$
  const [modoLucro, setModoLucro] = useState<'porcentagem' | 'reais'>('porcentagem');
  const [margemLucroDesejada, setMargemLucroDesejada] = useState(''); // ex: 200 = 200% de markup
  const [lucroReaisDesejado, setLucroReaisDesejado] = useState(''); // ex: 15 = R$ 15,00 por unidade
  const [formErro, setFormErro] = useState<string | null>(null);

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
    }, 0) + ((parseFloat(formTempoPreparo) || 0) / 60) * horaTrabalhada;

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
  }, [ingredientesUsados, embalagensUsadas, custosIndiretos, formRendimento, formTempoPreparo, horaTrabalhada, modoLucro, margemLucroDesejada, lucroReaisDesejado]);

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

      // Status: inativos só aparecem no filtro "Inativos"
      if (statusFilter === 'inativos' ? prod.ativo : !prod.ativo) return false;
      if (statusFilter === 'com_ficha' && !prod.temFichaTecnica) return false;
      if (statusFilter === 'sem_ficha' && prod.temFichaTecnica) return false;
      if (statusFilter === 'encomenda' && prod.disponibilidade === 'pronta_entrega') return false;

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

  // Contadores (só produtos ativos)
  const produtosAtivos = produtosList.filter(p => p.ativo);
  const totalProdutos = produtosAtivos.length;
  const totalComFicha = produtosAtivos.filter(p => p.temFichaTecnica).length;
  const totalEstoqueBaixo = produtosAtivos.filter(p => p.estoque <= p.estoqueMinimo).length;
  const valorEstoqueGeral = produtosAtivos.reduce((acc, curr) => acc + curr.estoque * curr.preco, 0);
  const totalProntos = produtosAtivos.reduce((acc, curr) => acc + curr.estoque, 0);
  const totalCongelados = produtosAtivos.reduce((acc, curr) => acc + curr.congelado, 0);
  const valorCongelados = produtosAtivos.reduce((acc, curr) => acc + curr.congelado * curr.preco, 0);
  const totalEncomenda = produtosAtivos.filter(p => p.disponibilidade !== 'pronta_entrega').length;

  // Ações de Ficha Técnica: Adicionar Ingrediente
  const handleAdicionarIngrediente = () => {
    if (!insumoSelecionadoId) return;
    const qtd = parseFloat(quantidadeInsumoInput.replace(',', '.')) || 0;
    if (qtd <= 0) return;

    const insumo = insumosDisponiveis.find(i => i.id === insumoSelecionadoId);
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

    const emb = insumosDisponiveis.find(i => i.id === embalagemSelecionadaId);
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
    setFormCategoria('');
    setFormPreco('');
    setFormEstoque('');
    setFormEstoqueMinimo('');
    setHabilitarFichaTecnica(false);
    setFormRendimento('');
    setFormUnidadeRendimento('unidades');
    setFormTempoPreparo('');
    setIngredientesUsados([]);
    setEmbalagensUsadas([]);
    setFormCongelados('');
    setFormDisponibilidade('pronta_entrega');
    setFormDesconto('');
    setCustosIndiretos(CUSTOS_INDIRETOS_VAZIOS);
    setModoLucro('porcentagem');
    setMargemLucroDesejada('');
    setLucroReaisDesejado('');
    setEditandoId(null);
    setFormErro(null);
    setModalNovoProdutoVisible(true);
  };

  // Editar cadastro: estoque não muda aqui (vem de vendas, produção e ajustes do Estoque Central)
  const handleAbrirEdicao = (prod: ProdutoCompleto) => {
    setEditandoId(prod.id);
    setFormNome(prod.nome);
    setFormFotoEmoji(prod.fotoEmoji);
    setFormCategoria(prod.categoria);
    setFormPreco(prod.preco.toFixed(2).replace('.', ','));
    setFormEstoqueMinimo(String(prod.estoqueMinimo));
    setFormDisponibilidade(prod.disponibilidade);
    setFormDesconto(prod.desconto ? prod.desconto.toFixed(2).replace('.', ',') : '');
    setHabilitarFichaTecnica(false);
    setFormErro(null);
    setModalDossieVisible(false);
    setModalNovoProdutoVisible(true);
  };

  // Salvar Novo Produto (ou edição)
  const handleSalvarProduto = () => {
    if (!formNome.trim()) {
      setFormErro('Por favor, informe o nome do produto.');
      return;
    }
    if (!formCategoria.trim()) {
      setFormErro('Escolha a categoria do produto.');
      return;
    }

    const precoNum = parseFloat(formPreco.replace(/\./g, '').replace(',', '.'));
    if (isNaN(precoNum) || precoNum <= 0) {
      setFormErro('Por favor, informe o valor/preço de venda do produto.');
      return;
    }

    const estoqueNum = parseFloat(formEstoque) || 0;
    const estoqueMinNum = parseFloat(formEstoqueMinimo) || 0;
    const descontoNum = parseFloat(formDesconto.replace(/\./g, '').replace(',', '.')) || 0;
    if (descontoNum >= precoNum) {
      setFormErro('O desconto da promoção precisa ser menor que o preço de venda.');
      return;
    }

    if (editandoId) {
      setFotos(prev => ({ ...prev, [editandoId]: formFotoEmoji }));
      atualizarProduto(editandoId, {
        nome: formNome.trim(),
        categoria: formCategoria,
        preco: precoNum,
        estoqueMinimo: estoqueMinNum,
        disponibilidade: formDisponibilidade,
        desconto: descontoNum || undefined,
      });
      setModalNovoProdutoVisible(false);
      return;
    }

    const id = `prod-${Date.now()}`;
    setFotos(prev => ({ ...prev, [id]: formFotoEmoji }));
    cadastrarProduto({
      id,
      nome: formNome.trim(),
      detalhe: formCategoria,
      categoria: formCategoria,
      preco: precoNum,
      custo: habilitarFichaTecnica ? calculosFinanceiros.custoUnitario : 0,
      estoque: estoqueNum,
      estoqueMinimo: estoqueMinNum,
      disponibilidade: formDisponibilidade,
      desconto: descontoNum || undefined,
    });
    // A ficha vai para a lista única: aparece em Receitas, Produção e Estoque Central
    if (habilitarFichaTecnica) {
      const subtotalInsumos = calculosFinanceiros.totalIngredientes + calculosFinanceiros.totalEmbalagens;
      salvarFicha({
        produtoId: id,
        rendimento: Math.max(1, parseFloat(formRendimento) || 1),
        tempoPreparoMinutos: parseInt(formTempoPreparo) || 0,
        itens: [...ingredientesUsados, ...embalagensUsadas].map((i) => ({ insumoId: i.insumoId, quantidade: i.quantidade })),
        custosExtras: custosIndiretos.filter((ci) => ci.valor > 0).map((ci) => ({
          id: ci.id,
          descricao: ci.descricao,
          valor: ci.modo === 'porcentagem' ? (subtotalInsumos * ci.valor) / 100 : ci.valor,
        })),
        modoLucro: modoLucro,
        lucroDesejado: parseFloat(modoLucro === 'porcentagem' ? margemLucroDesejada : lucroReaisDesejado) || 0,
      });
    }
    // Massas já feitas vão para o freezer consumindo os insumos da ficha (depois da ficha salva)
    congelarMassas(id, parseInt(formCongelados) || 0, true, 'cadastro do produto');
    setModalNovoProdutoVisible(false);
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
            <PageHeaderTitulo
              etiqueta="ATELIÊ · CATÁLOGO & VITRINE"
              titulo="Produtos & Estoque"
              subtitulo="Cadastro rápido ou ficha técnica completa com precificação inteligente."
            />

            {/* BOTÃO NOVO PRODUTO */}
            <TouchableOpacity
              style={styles.btnNovoProduto}
              onPress={handleAbrirNovoProduto}>
              <Feather name="plus-circle" size={17} color="#FFFFFF" />
              <Text style={styles.btnNovoProdutoText}>+ Novo Produto</Text>
            </TouchableOpacity>
          </View>

          {/* =========================================================================
              INDICADORES COMPACTOS + FILTROS (BOTÃO) + VISUALIZAÇÃO NA MESMA LINHA
          ========================================================================== */}
          <View style={[styles.topoLinha, { zIndex: 40 }]}>
            <View style={styles.statsStrip}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Produtos</Text>
                <Text style={styles.statValue}>{totalProdutos}</Text>
              </View>
              <View style={[styles.statItem, styles.statItemDivider]}>
                <Text style={styles.statLabel}>Prontas · freezer</Text>
                <Text style={styles.statValue}>
                  {totalProntos} <Text style={styles.statValueSub}>· ❄ {totalCongelados}</Text>
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.statItem, styles.statItemDivider]}
                onPress={() => setStatusFilter(statusFilter === 'com_ficha' ? 'todos' : 'com_ficha')}>
                <Text style={styles.statLabel}>Com receita</Text>
                <Text style={[styles.statValue, { color: SUCCESS_GREEN }]}>{totalComFicha}</Text>
              </TouchableOpacity>
              <View style={[styles.statItem, styles.statItemDivider]}>
                <Text style={styles.statLabel}>Estoque baixo</Text>
                <Text style={[styles.statValue, { color: totalEstoqueBaixo > 0 ? DANGER_RED : SUCCESS_GREEN }]}>{totalEstoqueBaixo}</Text>
              </View>
              <View style={[styles.statItem, styles.statItemDivider]}>
                <Text style={styles.statLabel}>Em prateleira</Text>
                <Text style={styles.statValue}>{formatMoney(valorEstoqueGeral)}</Text>
              </View>
              <View style={[styles.statItem, styles.statItemDivider]}>
                <Text style={styles.statLabel}>No freezer</Text>
                <Text style={styles.statValue}>{formatMoney(valorCongelados)}</Text>
              </View>
            </View>

            {/* Busca, categoria e situação ficam todos dentro de "Filtros" */}
            <View>
              <TouchableOpacity
                style={[styles.filtrosBtn, (filtrosAbertos || filtrosAtivos > 0) && styles.filtrosBtnAtivo]}
                onPress={() => setFiltrosAbertos((v) => !v)}>
                <Feather name="sliders" size={14} color={filtrosAtivos > 0 ? KIPI_BLUE_ACCENT : '#475569'} />
                <Text style={[styles.filtrosBtnTexto, filtrosAtivos > 0 && { color: KIPI_BLUE_ACCENT }]}>Filtros</Text>
                {filtrosAtivos > 0 && (
                  <View style={styles.filtrosBadge}>
                    <Text style={styles.filtrosBadgeTexto}>{filtrosAtivos}</Text>
                  </View>
                )}
                <Feather name={filtrosAbertos ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
              </TouchableOpacity>

              {filtrosAbertos && (
                <View style={styles.filtrosMenu}>
                  <View style={[styles.searchBox, { flex: 0, minWidth: 0 }]}>
                    <Feather name="search" size={15} color="#94A3B8" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar por nome ou categoria..."
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

                  <View>
                    <Text style={styles.filtrosGrupo}>CATEGORIA</Text>
                    <View style={styles.filtrosChips}>
                      {categorias.map((cat) => {
                        const ativo = categoriaAtiva === cat;
                        return (
                          <TouchableOpacity key={cat} style={[styles.filtrosChip, ativo && styles.filtrosChipAtivo]} onPress={() => setCategoriaAtiva(cat)}>
                            <Text style={[styles.filtrosChipTexto, ativo && styles.filtrosChipTextoAtivo]}>{cat}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View>
                    <Text style={styles.filtrosGrupo}>SITUAÇÃO</Text>
                    <View style={styles.filtrosChips}>
                      {([
                        { id: 'todos', label: 'Todos' },
                        { id: 'com_ficha', label: 'Com receita 🔬' },
                        { id: 'sem_ficha', label: 'Sem receita ⚡' },
                        { id: 'encomenda', label: `Encomenda 📅 ${totalEncomenda}` },
                        { id: 'inativos', label: 'Inativos' },
                      ] as const).map((st) => {
                        const ativo = statusFilter === st.id;
                        return (
                          <TouchableOpacity key={st.id} style={[styles.filtrosChip, ativo && styles.filtrosChipAtivo]} onPress={() => setStatusFilter(st.id)}>
                            <Text style={[styles.filtrosChipTexto, ativo && styles.filtrosChipTextoAtivo]}>{st.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.filtrosRodape}>
                    <TouchableOpacity
                      onPress={() => {
                        setSearchQuery('');
                        setCategoriaAtiva('Todas');
                        setStatusFilter('todos');
                      }}>
                      <Text style={styles.filtrosLimpar}>Limpar filtros</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.filtrosPronto} onPress={() => setFiltrosAbertos(false)}>
                      <Text style={styles.filtrosProntoTexto}>Pronto</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
                          <Text style={styles.dispoText}>{ROTULO_DISPONIBILIDADE[prod.disponibilidade]}</Text>
                        </View>
                      </View>

                      {/* Dados Financeiros: Preço, Custo e Lucro */}
                      <View style={styles.financialCardBox}>
                        <View style={styles.finCol}>
                          <Text style={styles.finLabel}>PREÇO DE VENDA</Text>
                          <Text style={styles.finPrice}>{formatMoney(prod.preco)}</Text>
                          {prod.desconto > 0 && (
                            <Text style={styles.promoTag}>🏷️ {formatMoney(prod.preco - prod.desconto)} promo</Text>
                          )}
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
                              <Text style={[styles.finMargin, (prod.margemLucroPercentual ?? 0) < MARGEM_MINIMA && { color: DANGER_RED }]}>{(prod.margemLucroPercentual ?? 0) < MARGEM_MINIMA ? '⚠ ' : ''}{prod.margemLucroPercentual}%</Text>
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
                            {isEstoqueBaixo && <Text style={styles.alertNotice}> · mín {prod.estoqueMinimo}</Text>}
                          </Text>
                        </View>
                        <Text style={styles.freezerText}>❄ {prod.congelado} p/ assar</Text>
                        {prod.congelado > 0 && prod.ativo && (
                          <TouchableOpacity style={styles.btnAssar} onPress={() => irParaAssar(prod.id)}>
                            <Text style={styles.btnAssarText}>🔥 Assar</Text>
                          </TouchableOpacity>
                        )}
                        {prod.estoque + prod.congelado > 0 && (
                          <TouchableOpacity style={styles.btnDescartarMini} accessibilityLabel="Descartar" onPress={() => setDescarteId(prod.id)}>
                            <Feather name="trash-2" size={12} color={DANGER_RED} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Rodapé do Card */}
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardFooterHint}>
                          {prod.temFichaTecnica ? 'Tempo de preparo: ' + (prod.tempoPreparoMinutos || 30) + 'min' : 'Sem ficha técnica'}
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
                      <Text style={styles.gridStockLabel}>{prod.estoque} un · ❄ {prod.congelado}</Text>
                      {prod.temFichaTecnica && (
                        <Text style={[styles.gridMarginBadge, (prod.margemLucroPercentual ?? 0) < MARGEM_MINIMA && { color: DANGER_RED }]}>{prod.margemLucroPercentual}%</Text>
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
                        {prod.desconto > 0 && (
                          <Text style={styles.promoTag}>🏷️ {formatMoney(prod.preco - prod.desconto)}</Text>
                        )}
                      </View>

                      <View style={[styles.td, { flex: 1.2 }]}>
                        <Text style={styles.tableCost}>
                          {prod.custoUnitario ? formatMoney(prod.custoUnitario) : '-'}
                        </Text>
                      </View>

                      <View style={[styles.td, { flex: 1.1 }]}>
                        {prod.temFichaTecnica ? (
                          <View style={styles.tableMarginPill}>
                            <Text style={[styles.tableMarginText, (prod.margemLucroPercentual ?? 0) < MARGEM_MINIMA && { color: DANGER_RED }]}>{prod.margemLucroPercentual}%</Text>
                          </View>
                        ) : (
                          <Text style={{ color: '#94A3B8', fontSize: 11 }}>-</Text>
                        )}
                      </View>

                      <View style={[styles.td, { flex: 1.1 }]}>
                        <Text style={[styles.tableStock, isEstoqueBaixo && { color: DANGER_RED }]}>
                          {prod.estoque} un
                        </Text>
                        <Text style={styles.freezerText}>❄ {prod.congelado}</Text>
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
                <Text style={styles.modalTitle}>{editandoId ? 'Editar Produto' : 'Cadastrar Novo Produto'}</Text>
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

                  {!editandoId && (
                    <View style={[styles.inputGroup, { flex: 0.9 }]}>
                      <Text style={styles.inputLabel}>PRONTOS NA VITRINE</Text>
                      <TextInput
                        style={styles.inputBox}
                        placeholder="10"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={formEstoque}
                        onChangeText={setFormEstoque}
                      />
                    </View>
                  )}

                  <View style={[styles.inputGroup, { flex: 0.9 }]}>
                    <Text style={styles.inputLabel}>ESTOQUE MÍNIMO</Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="5"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={formEstoqueMinimo}
                      onChangeText={setFormEstoqueMinimo}
                    />
                  </View>
                </View>

                {/* DISPONIBILIDADE */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>DISPONIBILIDADE</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {(Object.keys(ROTULO_DISPONIBILIDADE) as Disponibilidade[]).map(d => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.catChip, formDisponibilidade === d && styles.catChipActive]}
                        onPress={() => setFormDisponibilidade(d)}>
                        <Text style={[styles.catChipText, formDisponibilidade === d && styles.catChipTextActive]}>
                          {ROTULO_DISPONIBILIDADE[d]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* PROMOÇÃO E CONGELADOS */}
                <View style={styles.formRow}>
                  <View style={[styles.inputGroup, { flex: 1.2 }]}>
                    <Text style={styles.inputLabel}>PROMOÇÃO: DESCONTO (R$/UN)</Text>
                    <View style={styles.currencyInputRow}>
                      <Text style={styles.currencySymbol}>- R$</Text>
                      <TextInput
                        style={styles.currencyField}
                        placeholder="0,00"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={formDesconto}
                        onChangeText={setFormDesconto}
                      />
                    </View>
                    {(() => {
                      const preco = parseFloat(formPreco.replace(/\./g, '').replace(',', '.')) || 0;
                      const desc = parseFloat(formDesconto.replace(/\./g, '').replace(',', '.')) || 0;
                      return desc > 0 && preco > desc ? (
                        <Text style={styles.promoHint}>Cliente paga {formatMoney(preco - desc)} na promoção</Text>
                      ) : null;
                    })()}
                  </View>

                  {!editandoId && (
                    <View style={[styles.inputGroup, { flex: 0.9 }]}>
                      <Text style={styles.inputLabel}>❄ CONGELADOS P/ ASSAR</Text>
                      <TextInput
                        style={styles.inputBox}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={formCongelados}
                        onChangeText={setFormCongelados}
                      />
                      <Text style={styles.promoHint}>
                        {habilitarFichaTecnica ? 'Desconta os insumos da ficha' : 'Sem ficha: não desconta insumos'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* ===================================================================
                    5. TOGGLE PARA CRIAR FICHA TÉCNICA & PRECIFICAÇÃO DETALHADA
                    (na edição a ficha tem editor próprio: "Editar ficha" no dossiê)
                ==================================================================== */}
                {!editandoId && (
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
                )}

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
                          {insumosDisponiveis.filter(i => i.tipo === 'ingrediente').map(ins => {
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
                          {insumosDisponiveis.filter(i => i.tipo === 'embalagem').map(emb => {
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
                              value={ci.valor ? ci.valor.toString() : ''}
                              placeholder="0,00"
                              placeholderTextColor="#CBD5E1"
                              onChangeText={text => {
                                const valNum = parseFloat(text.replace(',', '.')) || 0;
                                setCustosIndiretos(prev => prev.map((item, i) => i === idx ? { ...item, valor: valNum, valorCalculado: valNum } : item));
                              }}
                            />
                          </View>
                        </View>
                      ))}
                      <View style={styles.indirectCostRow}>
                        <Text style={styles.indirectCostName}>
                          Mão de obra ({parseFloat(formTempoPreparo) || 0} min × {formatMoney(horaTrabalhada)}/h)
                        </Text>
                        <Text style={styles.indirectCostPrefix}>
                          {formatMoney(((parseFloat(formTempoPreparo) || 0) / 60) * horaTrabalhada)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* COLUNA DIREITA: LIVE PRICING & PAINEL DE MARGEM (UX SÊNIOR) */}
              {!editandoId && (
              <ScrollView style={styles.modalPricingCol} showsVerticalScrollIndicator={false}>
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
                          placeholder="Ex: 200"
                          placeholderTextColor="#94A3B8"
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
                          placeholder="Ex: 15,00"
                          placeholderTextColor="#94A3B8"
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
              </ScrollView>
              )}
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
                <Text style={styles.modalSaveBtnText}>{editandoId ? 'Salvar Alterações' : 'Salvar Produto'}</Text>
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
                    <Text style={styles.dispoText}>
                      {ROTULO_DISPONIBILIDADE[produtoSelecionado.disponibilidade]}
                      {!produtoSelecionado.ativo ? ' · INATIVO' : ''}
                    </Text>
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

                  {(() => {
                    const margem = produtoSelecionado.margemLucroPercentual;
                    const atencao = produtoSelecionado.temFichaTecnica && (margem ?? 0) < MARGEM_MINIMA;
                    const cor = atencao ? DANGER_RED : SUCCESS_GREEN;
                    return (
                      <View style={[styles.dossierFinCard, { backgroundColor: atencao ? DANGER_TINT : SUCCESS_TINT, borderColor: atencao ? '#FCA5A5' : '#BBF7D0' }]}>
                        <Text style={[styles.dossierFinLabel, { color: cor }]}>{atencao ? '⚠ MARGEM BAIXA' : 'MARGEM REAL'}</Text>
                        <Text style={[styles.dossierFinVal, { color: cor }]}>
                          {produtoSelecionado.temFichaTecnica ? `${margem}%` : '-'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                {/* Promoção: preço final e margem com o desconto */}
                {produtoSelecionado.desconto > 0 && (() => {
                  const precoPromo = produtoSelecionado.preco - produtoSelecionado.desconto;
                  const margemPromo = produtoSelecionado.custoUnitario ? Math.round(margemReal(precoPromo, produtoSelecionado.custoUnitario)) : null;
                  return (
                    <View style={styles.promoBox}>
                      <Text style={styles.promoBoxText}>
                        🏷️ Promoção: -{formatMoney(produtoSelecionado.desconto)}/un → cliente paga <Text style={{ fontWeight: '800' }}>{formatMoney(precoPromo)}</Text>
                      </Text>
                      {margemPromo !== null && (
                        <Text style={[styles.promoBoxText, margemPromo < MARGEM_MINIMA && { color: DANGER_RED, fontWeight: '700' }]}>
                          {margemPromo < MARGEM_MINIMA ? '⚠ ' : ''}Margem na promoção: {margemPromo}%
                        </Text>
                      )}
                    </View>
                  );
                })()}

                {/* Composição da Ficha Técnica se houver */}
                {produtoSelecionado.temFichaTecnica && produtoSelecionado.ingredientes && (
                  <View style={styles.dossierSection}>
                    <Text style={styles.dossierSectionTitle}>Insumos da Ficha</Text>
                    {[...produtoSelecionado.ingredientes, ...(produtoSelecionado.embalagens ?? [])].map(i => (
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
                    Estoque mínimo de alerta: {produtoSelecionado.estoqueMinimo} unidades · ❄ {produtoSelecionado.congelado} no freezer p/ assar
                  </Text>
                </View>
              </ScrollView>

              <View style={[styles.modalFooter, { flexWrap: 'wrap' }]}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { marginRight: 'auto' }]}
                  onPress={() => alternarAtivoProduto(produtoSelecionado.id)}>
                  <Text style={[styles.modalCancelBtnText, { color: produtoSelecionado.ativo ? DANGER_RED : SUCCESS_GREEN }]}>
                    {produtoSelecionado.ativo ? 'Inativar' : 'Reativar'}
                  </Text>
                </TouchableOpacity>

                {produtoSelecionado.congelado > 0 && produtoSelecionado.ativo && (
                  <TouchableOpacity style={styles.btnAssar} onPress={() => irParaAssar(produtoSelecionado.id)}>
                    <Text style={styles.btnAssarText}>🔥 Assar</Text>
                  </TouchableOpacity>
                )}

                {produtoSelecionado.estoque + produtoSelecionado.congelado > 0 && (
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDescarteId(produtoSelecionado.id)}>
                    <Text style={[styles.modalCancelBtnText, { color: DANGER_RED }]}>🗑 Descartar</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => handleAbrirEdicao(produtoSelecionado)}>
                  <Text style={[styles.modalCancelBtnText, { color: KIPI_BLUE_ACCENT }]}>Editar produto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={() => setFichaEditandoId(produtoSelecionado.id)}>
                  <Feather name="edit-2" size={15} color="#FFFFFF" />
                  <Text style={styles.modalSaveBtnText}>
                    {produtoSelecionado.temFichaTecnica ? 'Editar ficha' : 'Criar ficha'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Editor da ficha técnica (o mesmo de Insumos & Receitas) */}
      <FichaTecnicaModal
        visible={fichaEditandoId !== null}
        produtoId={fichaEditandoId}
        onClose={() => setFichaEditandoId(null)}
      />

      {/* Descarte (vencido, doado, quebrado...): sai da vitrine ou do freezer e entra como perda */}
      <DescarteModal visible={descarteId !== null} produtoId={descarteId} onClose={() => setDescarteId(null)} />
      <ProducaoRapidaModal
        visible={producaoRapida !== null}
        produtoId={producaoRapida?.id ?? null}
        modo={producaoRapida?.modo ?? 'assar'}
        onClose={() => setProducaoRapida(null)}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS VISUAIS COM A MESMA IDENTIDADE DAS TELAS REFINADAS
// ============================================================================
const styles = paraCelular(StyleSheet.create({
  // TOPO: indicadores compactos + Filtros + visualização (mesmo padrão do Estoque Central)
  topoLinha: { flexDirection: 'row', alignItems: 'stretch', flexWrap: 'wrap', gap: 10 },
  statsStrip: { flexDirection: 'row', flexWrap: 'wrap', flexGrow: 1, flexShrink: 1, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 8 },
  statItem: { flexGrow: 1, minWidth: 100, paddingHorizontal: 14, justifyContent: 'center' },
  statItemDivider: { borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
  statLabel: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.3, textTransform: 'uppercase' },
  statValue: { fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 1 },
  statValueSub: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#64748B' },
  filtrosBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, height: '100%', minHeight: 42, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  filtrosBtnAtivo: { borderColor: KIPI_BLUE, backgroundColor: KIPI_BLUE_TINT },
  filtrosBtnTexto: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: '700', color: '#475569' },
  filtrosBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: KIPI_BLUE, alignItems: 'center', justifyContent: 'center' },
  filtrosBadgeTexto: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  filtrosMenu: { position: 'absolute', top: 50, right: 0, width: 380, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 14, zIndex: 100, ...Platform.select({ web: { boxShadow: '0 16px 40px rgba(15,23,42,0.16)' } }) },
  filtrosGrupo: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 7 },
  filtrosChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filtrosChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  filtrosChipAtivo: { backgroundColor: KIPI_BLUE, borderColor: KIPI_BLUE },
  filtrosChipTexto: { fontFamily: FONT_SANS, fontSize: 11.5, fontWeight: '600', color: '#475569' },
  filtrosChipTextoAtivo: { color: '#FFFFFF', fontWeight: '800' },
  filtrosRodape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  filtrosLimpar: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#64748B' },
  filtrosPronto: { backgroundColor: KIPI_BLUE, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  filtrosProntoTexto: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
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
  topHeader: TOPO_COMPACTO,
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
  kpiStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  kpiStripItem: {
    flexGrow: 1,
    minWidth: 130,
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
    borderRadius: 8,
  },
  kpiStripAtivo: {
    backgroundColor: KIPI_BLUE_TINT,
  },
  kpiStripLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  kpiStripValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  kpiStripSub: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#94A3B8',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    gap: 8,
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
    paddingHorizontal: 11,
    paddingVertical: 4,
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
    gap: 8,
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
    paddingVertical: 5,
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
    paddingVertical: 4,
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
    paddingVertical: 4,
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
  dispoText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  promoTag: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: WARNING_AMBER,
    marginTop: 2,
  },
  promoHint: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
  },
  promoBox: {
    backgroundColor: WARNING_TINT,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 2,
  },
  promoBoxText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#92400E',
  },
  freezerText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
  },
  btnDescartarMini: { width: 26, height: 26, borderRadius: 7, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  btnAssar: {
    backgroundColor: WARNING_TINT,
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnAssarText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  noFichaNotice: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  stockStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
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
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
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
  // O corpo encolhe para caber na tela: cabeçalho e botão Salvar ficam sempre visíveis
  modalBodyColumns: {
    flexDirection: 'row',
    gap: 20,
    flexShrink: 1,
    minHeight: 0,
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
}));
