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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Sidebar from '@/components/Sidebar';
import { PageHeaderTitulo, TOPO_COMPACTO } from '@/components/PageHeader';
import {
  useEstoqueVitrine,
  adicionarAoEstoque,
  removerDoEstoque,
  useEstoqueFreezer,
  retirarDoFreezer,
  produtoAtivo,
  aceitaEncomenda,
} from '@/lib/estoqueVitrine';
import {
  useInsumos,
  salvarInsumo,
  excluirInsumo,
  ajustarEstoqueInsumo,
  capacidadeDoInsumo,
  custoPorUnidadeEstoque,
  fatorDaUnidade,
  unidadeFracionadaDe,
  ROTULO_ARMAZENAMENTO,
  congelarMassas,
  type Armazenamento,
} from '@/lib/insumos';
import { registrarProducao, useHistoricoProducao } from '@/lib/historicoProducao';
import { resumoDePerdas, ultimosDias, custoDoDescarte, EMOJI_MOTIVO } from '@/lib/descarte';
import DescarteModal from '@/components/DescarteModal';
import ProducaoRapidaModal, { type ModoProducaoRapida } from '@/components/ProducaoRapidaModal';

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
  custo: number; // R$ por unidade (0 = sem custo cadastrado)
  estoqueAssado: number; // diminui com vendas
  estoqueCongelado: number; // para assar
  minimoAssado: number;
  minimoCongelado: number; // 0 = produto não usa freezer
}

// INGREDIENTES COM CAPACIDADE DE RECEITAS
export interface EstoqueIngrediente {
  id: string;
  nome: string;
  tipo: string;
  quantidadeAtual: number;
  unidade: string;
  minimoSeguranca: number;
  custoUnitario: number; // R$ por unidade de medida (custo médio das compras)
  precoEstimadoCompra: number;
  armazenamento: string;
  emoji: string;
  consumoPorFornada: {
    receitaNome: string;
    gastoPorFornada: number;
    fornadasPossiveis: number;
  }[];
}

// EMBALAGENS E OUTROS MATERIAIS (velas, toppers, etiquetas...)
export interface EstoqueEmbalagem {
  id: string;
  tipo: 'embalagem' | 'outro';
  nome: string;
  quantidadeAtual: number;
  unidade: string;
  minimoSeguranca: number;
  custoUnitario: number; // R$ por unidade de medida (custo médio das compras)
  precoEstimadoCompra: number;
  emoji: string;
  usadoEm: string;
}

// Nome, preço, custo, categoria, assados e congelados vêm dos estoques compartilhados
// (lib/estoqueVitrine). Aqui ficam só o emoji e o mínimo do freezer de cada produto.
const MINIMO_FREEZER: Record<string, number> = {
  'prod-1': 12,
  'prod-2': 12,
  'prod-4': 6,
  'prod-11': 10,
  'prod-12': 10,
};

const EMOJI_PRODUTO: Record<string, string> = { 'prod-11': '🥐', 'prod-12': '🍯' };
const EMOJI_CATEGORIA: Record<string, string> = {
  Cookies: '🍪',
  'Bolos & Bentos': '🎂',
  Macarons: '✨',
  Sobremesas: '🥧',
  'Doces Finos': '🍬',
  Presentes: '🎁',
  Folhados: '🥐',
  Bebidas: '☕',
};
type TipoMaterial = 'ingrediente' | 'embalagem' | 'outro';
const ROTULO_TIPO_MATERIAL: Record<TipoMaterial, string> = { ingrediente: 'Ingrediente', embalagem: 'Embalagem', outro: 'Outro' };
const UNIDADES_MATERIAL = ['g', 'kg', 'ml', 'L', 'un', 'm', 'rolo', 'pacote'];
const ARMAZENAMENTOS = Object.values(ROTULO_ARMAZENAMENTO);

// "1.234,56" → 1234.56
const lerNumero = (texto: string) => parseFloat(texto.replace(/\./g, '').replace(',', '.')) || 0;
const lerQuantidade = (texto: string) => parseFloat(texto.replace(',', '.')) || 0;

// Entrada com valor pago recalcula o custo médio ponderado; baixa só tira a quantidade
const movimentarMaterial = <T extends { quantidadeAtual: number; custoUnitario: number }>(
  item: T,
  delta: number,
  valorPago: number
): T => {
  const novaQtd = Math.max(0, Number((item.quantidadeAtual + delta).toFixed(3)));
  const custoUnitario =
    delta > 0 && valorPago > 0 && novaQtd > 0
      ? (item.quantidadeAtual * item.custoUnitario + valorPago) / novaQtd
      : item.custoUnitario;
  return { ...item, quantidadeAtual: novaQtd, custoUnitario };
};

// Indicador compacto: vários lado a lado formam uma faixa única
function Indicador({
  rotulo,
  valor,
  detalhe,
  cor = '#0F172A',
  primeiro,
  onPress,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  cor?: string;
  primeiro?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.statItem, !primeiro && styles.statItemDivider]}
      disabled={!onPress}
      onPress={onPress}>
      <Text style={styles.statLabel}>{rotulo}</Text>
      <Text style={[styles.statValue, { color: cor }]}>{valor}</Text>
      {detalhe ? <Text style={styles.statDetail}>{detalhe}</Text> : null}
    </TouchableOpacity>
  );
}

export default function EstoqueCentralScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<EstoqueTab>('produtos');
  const [modoProdutos, setModoProdutos] = useState<'cards' | 'lista'>('cards');
  const [buscaProduto, setBuscaProduto] = useState('');

  // Atalhos Assar / Produzir: abrem o modal aqui mesmo (mesmo registro e histórico da Produção)
  const [producaoRapida, setProducaoRapida] = useState<{ id: string; modo: ModoProducaoRapida } | null>(null);
  const irParaAssar = (id: string) => setProducaoRapida({ id, modo: 'assar' });
  const irParaPreparar = (id: string) => setProducaoRapida({ id, modo: 'preparar' });
  // "Ver produto" abre o dossiê na tela Produtos. O t força reabrir mesmo vindo do mesmo produto.
  const verProduto = (id: string) => router.push(`/produtos-estoque?produto=${id}&t=${Date.now()}` as any);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [buscaMaterial, setBuscaMaterial] = useState('');

  // Produtos ativos da vitrine; assados e congelados vêm dos estoques compartilhados:
  // vendas, fornadas, preparos de massa e perdas já aparecem aqui
  const vitrine = useEstoqueVitrine();
  const freezer = useEstoqueFreezer();
  const produtosEstoque: EstoqueProduto[] = useMemo(
    () =>
      vitrine.filter(produtoAtivo).map((v) => ({
        id: v.id,
        nome: v.nome,
        categoria: v.categoria,
        fotoEmoji: EMOJI_PRODUTO[v.id] ?? EMOJI_CATEGORIA[v.categoria] ?? '🧁',
        precoVenda: v.preco,
        custo: v.custo,
        estoqueAssado: v.estoque,
        estoqueCongelado: freezer[v.id] ?? 0,
        minimoAssado: v.estoqueMinimo,
        minimoCongelado: MINIMO_FREEZER[v.id] ?? 0,
      })),
    [vitrine, freezer]
  );
  const categoriasProdutos = useMemo(
    () => ['Todas', ...Array.from(new Set(produtosEstoque.map((p) => p.categoria)))],
    [produtosEstoque]
  );
  const produtosFiltrados = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase();
    return produtosEstoque.filter(
      (p) =>
        (categoriaFiltro === 'Todas' || p.categoria === categoriaFiltro) &&
        (!termo || p.nome.toLowerCase().includes(termo) || p.categoria.toLowerCase().includes(termo))
    );
  }, [produtosEstoque, categoriaFiltro, buscaProduto]);

  // Indicadores de produtos (todos os ativos, independente do filtro)
  const totalProntos = produtosEstoque.reduce((acc, p) => acc + p.estoqueAssado, 0);
  const totalCongelados = produtosEstoque.reduce((acc, p) => acc + p.estoqueCongelado, 0);
  const valorVitrine = produtosEstoque.reduce((acc, p) => acc + p.estoqueAssado * p.precoVenda, 0);
  const valorCongelados = produtosEstoque.reduce((acc, p) => acc + p.estoqueCongelado * p.precoVenda, 0);
  const totalSobEncomenda = vitrine.filter((v) => produtoAtivo(v) && aceitaEncomenda(v)).length;

  // Materiais vêm da lista única de insumos (a mesma de Insumos & Receitas, Produção e Visão Geral).
  // Aqui a quantidade e o custo ficam na unidade de estoque (kg, L, un...).
  const insumos = useInsumos();
  const nomeProduto = (id: string) => vitrine.find((v) => v.id === id)?.nome ?? id;
  const ingredientesEstoque: EstoqueIngrediente[] = insumos
    .filter((i) => i.tipo === 'ingrediente')
    .map((i) => ({
      id: i.id,
      nome: i.nome,
      tipo: i.categoria || 'Ingrediente',
      quantidadeAtual: i.quantidadeEstoque,
      unidade: i.unidade,
      minimoSeguranca: i.estoqueMinimo,
      custoUnitario: custoPorUnidadeEstoque(i),
      precoEstimadoCompra: 0,
      armazenamento: ROTULO_ARMAZENAMENTO[i.armazenamento],
      emoji: i.emoji,
      consumoPorFornada: capacidadeDoInsumo(i, nomeProduto),
    }));
  const embalagensEstoque: EstoqueEmbalagem[] = insumos
    .filter((i) => i.tipo !== 'ingrediente')
    .map((i): EstoqueEmbalagem => ({
      id: i.id,
      tipo: i.tipo === 'outro' ? 'outro' : 'embalagem',
      nome: i.nome,
      quantidadeAtual: i.quantidadeEstoque,
      unidade: i.unidade,
      minimoSeguranca: i.estoqueMinimo,
      custoUnitario: custoPorUnidadeEstoque(i),
      precoEstimadoCompra: 0,
      emoji: i.emoji,
      usadoEm: i.usadoEm || '',
    }));

  // Descarte: id do produto, "" = escolher na lista, null = fechado
  const [descarteId, setDescarteId] = useState<string | null>(null);
  const perdas30 = resumoDePerdas(useHistoricoProducao(), ultimosDias(30));
  // DETALHE DOS INDICADORES: clique abre o que o número quer dizer e de onde ele vem
  type DetalheKpi = { titulo: string; explicacao: string; linhas: { nome: string; valor: string; alerta?: boolean }[] };
  const [kpiDetalhe, setKpiDetalhe] = useState<DetalheKpi | null>(null);
  const qtd = (n: number, un: string) => `${Number(n.toFixed(2)).toLocaleString('pt-BR')} ${un}`;
  const detalhes = {
    valorVitrine: (): DetalheKpi => ({
      titulo: `Valor em vitrine · ${formatMoney(valorVitrine)}`,
      explicacao: `Quanto vale, pelo preço de venda, o que está pronto na vitrine. Com as massas do freezer: ${formatMoney(valorVitrine + valorCongelados)}.`,
      linhas: produtosEstoque
        .filter((p) => p.estoqueAssado > 0)
        .map((p) => ({ nome: `${p.nome} (${p.estoqueAssado} × ${formatMoney(p.precoVenda)})`, valor: formatMoney(p.estoqueAssado * p.precoVenda) })),
    }),
    prontos: (): DetalheKpi => ({
      titulo: `♨️ Prontos · ${totalProntos} un`,
      explicacao: 'Unidades assadas na vitrine, prontas para vender. Em vermelho, abaixo do mínimo.',
      linhas: produtosEstoque.map((p) => ({ nome: p.nome, valor: `${p.estoqueAssado} un (mín. ${p.minimoAssado})`, alerta: p.estoqueAssado <= p.minimoAssado })),
    }),
    congelados: (): DetalheKpi => ({
      titulo: `🧊 Congelados · ${totalCongelados} un`,
      explicacao: 'Massas no freezer, prontas para assar. Em vermelho, abaixo do mínimo.',
      linhas: produtosEstoque
        .filter((p) => p.minimoCongelado > 0 || p.estoqueCongelado > 0)
        .map((p) => ({ nome: p.nome, valor: `${p.estoqueCongelado} un (mín. ${p.minimoCongelado})`, alerta: p.minimoCongelado > 0 && p.estoqueCongelado <= p.minimoCongelado })),
    }),
    encomenda: (): DetalheKpi => ({
      titulo: `Sob encomenda · ${totalSobEncomenda}`,
      explicacao: 'Produtos que aceitam encomenda (só encomenda ou híbridos). Saem da vitrine só quando a encomenda é entregue.',
      linhas: vitrine
        .filter((v) => produtoAtivo(v) && aceitaEncomenda(v))
        .map((v) => ({ nome: v.nome, valor: v.disponibilidade === 'hibrido' ? 'Híbrido' : 'Só encomenda' })),
    }),
    itens: (): DetalheKpi => ({
      titulo: `Itens · ${totalMateriais}`,
      explicacao: 'Ingredientes, embalagens e outros materiais cadastrados (a mesma lista de Insumos & Receitas).',
      linhas: [...ingredientesEstoque, ...embalagensEstoque].map((m) => ({ nome: `${m.emoji} ${m.nome}`, valor: qtd(m.quantidadeAtual, m.unidade) })),
    }),
    critico: (): DetalheKpi => ({
      titulo: `Estoque crítico · ${listaComprasSugerida.length}`,
      explicacao: 'Materiais que chegaram no estoque mínimo ou abaixo dele e precisam de compra.',
      linhas: [...ingredientesEstoque, ...embalagensEstoque]
        .filter((m) => m.quantidadeAtual <= m.minimoSeguranca)
        .map((m) => ({ nome: `${m.emoji} ${m.nome}`, valor: `${qtd(m.quantidadeAtual, m.unidade)} (mín. ${qtd(m.minimoSeguranca, m.unidade)})`, alerta: true })),
    }),
    perdas: (): DetalheKpi => ({
      titulo: `🗑 Perdas 30 dias · ${formatMoney(perdas30.total)}`,
      explicacao: `${perdas30.unidades} un descartadas. Custo de material (insumos da receita) que se perdeu; desconta do lucro na Visão Geral.`,
      linhas: [
        ...perdas30.porMotivo.map((m) => ({ nome: `${EMOJI_MOTIVO[m.motivo] ?? '🗑'} ${m.motivo} · ${m.unidades} un`, valor: formatMoney(m.custo), alerta: true })),
        ...perdas30.lista.map((r) => ({
          nome: `${new Date(r.data).toLocaleDateString('pt-BR')} · ${r.quantidade}× ${r.produtoNome} (${r.motivo ?? 'Outro'})`,
          valor: formatMoney(custoDoDescarte(r)),
        })),
      ],
    }),
    almoxarifado: (): DetalheKpi => ({
      titulo: `Valor em almoxarifado · ${formatMoney(valorAlmoxarifado)}`,
      explicacao: 'Quanto vale o estoque de materiais pelo custo médio das compras (quantidade × custo).',
      linhas: [...ingredientesEstoque, ...embalagensEstoque]
        .map((m) => ({ nome: `${m.emoji} ${m.nome}`, valor: formatMoney(m.quantidadeAtual * m.custoUnitario), total: m.quantidadeAtual * m.custoUnitario }))
        .sort((a, b) => b.total - a.total),
    }),
  };

  // Busca de materiais por nome ou tipo
  const termoMaterial = buscaMaterial.trim().toLowerCase();
  const casaBuscaMaterial = (...textos: string[]) =>
    !termoMaterial || textos.some((t) => t.toLowerCase().includes(termoMaterial));
  const ingredientesFiltrados = ingredientesEstoque.filter((i) => casaBuscaMaterial(i.nome, i.tipo, 'ingrediente'));
  const embalagensFiltradas = embalagensEstoque.filter((e) =>
    casaBuscaMaterial(e.nome, ROTULO_TIPO_MATERIAL[e.tipo], e.usadoEm)
  );

  // Indicadores de materiais (ingredientes + embalagens + outros)
  const totalMateriais = ingredientesEstoque.length + embalagensEstoque.length;
  const valorAlmoxarifado = [...ingredientesEstoque, ...embalagensEstoque].reduce(
    (acc, m) => acc + m.quantidadeAtual * m.custoUnitario,
    0
  );

  // Modal de Ajuste Rápido (+ / -)
  const [modalAjusteVisible, setModalAjusteVisible] = useState(false);
  const [itemAjusteNome, setItemAjusteNome] = useState('');
  const [itemAjusteTipo, setItemAjusteTipo] = useState<'assado' | 'congelado' | 'ingrediente' | 'embalagem'>('assado');
  const [itemAjusteId, setItemAjusteId] = useState('');
  const [ajusteQtdInput, setAjusteQtdInput] = useState('1');
  const [valorPagoInput, setValorPagoInput] = useState('');
  const materialAjuste =
    itemAjusteTipo === 'ingrediente'
      ? ingredientesEstoque.find((i) => i.id === itemAjusteId)
      : itemAjusteTipo === 'embalagem'
      ? embalagensEstoque.find((e) => e.id === itemAjusteId)
      : undefined;
  const previaCustoMedio =
    materialAjuste && lerNumero(valorPagoInput) > 0 && lerQuantidade(ajusteQtdInput) > 0
      ? movimentarMaterial(materialAjuste, lerQuantidade(ajusteQtdInput), lerNumero(valorPagoInput)).custoUnitario
      : null;

  const abrirAjuste = (tipo: typeof itemAjusteTipo, id: string, nome: string, qtdPadrao: string) => {
    setItemAjusteTipo(tipo);
    setItemAjusteId(id);
    setItemAjusteNome(nome);
    setAjusteQtdInput(qtdPadrao);
    setValorPagoInput('');
    setModalAjusteVisible(true);
  };

  // Modal de Cadastro / Edição de Material
  const [modalMaterialVisible, setModalMaterialVisible] = useState(false);
  const [materialEditandoId, setMaterialEditandoId] = useState<string | null>(null);
  const [formTipo, setFormTipo] = useState<TipoMaterial>('ingrediente');
  const [formNome, setFormNome] = useState('');
  const [formUnidade, setFormUnidade] = useState('kg');
  const [formQtd, setFormQtd] = useState('');
  const [formMinimo, setFormMinimo] = useState('');
  const [formCusto, setFormCusto] = useState('');
  const [formDetalhe, setFormDetalhe] = useState(''); // categoria do ingrediente ou "usado em"
  const [formArmazenamento, setFormArmazenamento] = useState('Seco');
  const [formErro, setFormErro] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const abrirNovoMaterial = (tipo: TipoMaterial) => {
    setMaterialEditandoId(null);
    setFormTipo(tipo);
    setFormNome('');
    setFormUnidade(tipo === 'ingrediente' ? 'kg' : 'un');
    setFormQtd('');
    setFormMinimo('');
    setFormCusto('');
    setFormDetalhe('');
    setFormArmazenamento('Seco');
    setFormErro(null);
    setConfirmarExclusao(false);
    setModalMaterialVisible(true);
  };

  const abrirEdicaoMaterial = (
    tipo: TipoMaterial,
    m: EstoqueIngrediente | EstoqueEmbalagem,
    detalhe: string,
    armazenamento = 'Seco'
  ) => {
    setMaterialEditandoId(m.id);
    setFormTipo(tipo);
    setFormNome(m.nome);
    setFormUnidade(m.unidade);
    setFormQtd(String(m.quantidadeAtual).replace('.', ','));
    setFormMinimo(String(m.minimoSeguranca).replace('.', ','));
    setFormCusto(m.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }));
    setFormDetalhe(detalhe);
    setFormArmazenamento(armazenamento);
    setFormErro(null);
    setConfirmarExclusao(false);
    setModalMaterialVisible(true);
  };

  const handleSalvarMaterial = () => {
    if (!formNome.trim()) {
      setFormErro('Informe o nome do material.');
      return;
    }
    // O formulário trabalha na unidade de estoque; a lista única guarda o custo por unidade fracionada
    const existente = materialEditandoId ? insumos.find((i) => i.id === materialEditandoId) : undefined;
    const fator = fatorDaUnidade(formUnidade, existente?.conteudoEmbalagem ?? 1);
    const custoPorUnidade = lerNumero(formCusto);
    const armazenamento =
      (Object.keys(ROTULO_ARMAZENAMENTO) as Armazenamento[]).find((k) => ROTULO_ARMAZENAMENTO[k] === formArmazenamento) ?? 'seco';
    const dados = {
      nome: formNome.trim(),
      tipo: formTipo,
      unidade: formUnidade,
      unidadeFracionada: unidadeFracionadaDe(formTipo, formUnidade),
      fatorFracionado: fator,
      custoUnitario: custoPorUnidade / fator,
      quantidadeEstoque: lerQuantidade(formQtd),
      estoqueMinimo: lerQuantidade(formMinimo),
      ...(formTipo === 'ingrediente'
        ? { categoria: formDetalhe.trim() || undefined, armazenamento }
        : { usadoEm: formDetalhe.trim() || undefined }),
    };

    if (existente) {
      salvarInsumo({ ...existente, ...dados });
    } else {
      salvarInsumo({
        id: `ins-${Date.now()}`,
        ...dados,
        armazenamento,
        precoPago: custoPorUnidade,
        conteudoEmbalagem: fator,
        status: 'ativo',
        emoji: formTipo === 'ingrediente' ? '🥣' : formTipo === 'outro' ? '🧷' : '📦',
      });
    }
    setModalMaterialVisible(false);
  };

  const handleExcluirMaterial = () => {
    if (!materialEditandoId) return;
    if (!confirmarExclusao) {
      setConfirmarExclusao(true);
      return;
    }
    excluirInsumo(materialEditandoId);
    setModalMaterialVisible(false);
  };

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
        // sem preço estimado cadastrado: sugestão × custo médio
        precoEstimado: i.precoEstimadoCompra || (i.minimoSeguranca * 2 - i.quantidadeAtual) * i.custoUnitario,
        emoji: i.emoji,
      }));

    const embalagensComprar = embalagensEstoque
      .filter(e => e.quantidadeAtual <= e.minimoSeguranca)
      .map(e => ({
        id: e.id,
        tipo: ROTULO_TIPO_MATERIAL[e.tipo],
        nome: e.nome,
        atual: `${e.quantidadeAtual} ${e.unidade}`,
        minimo: `${e.minimoSeguranca} ${e.unidade}`,
        sugerido: `${Math.round(e.minimoSeguranca * 2 - e.quantidadeAtual)} ${e.unidade}`,
        precoEstimado: e.precoEstimadoCompra || Math.round(e.minimoSeguranca * 2 - e.quantidadeAtual) * e.custoUnitario,
        emoji: e.emoji,
      }));

    return [...ingredientesComprar, ...embalagensComprar];
  }, [ingredientesEstoque, embalagensEstoque]);

  const custoTotalEstimadoCompras = listaComprasSugerida.reduce((acc, curr) => acc + curr.precoEstimado, 0);

  // Formatar Moeda
  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  // Custo por grama/unidade pode ser centavos: mostra até 3 casas
  const formatCusto = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: val < 1 ? 3 : 2 });

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
      const movimento = [{ produtoId: itemAjusteId, nome: itemAjusteNome, quantidade: qtd }];
      if (delta > 0) adicionarAoEstoque(movimento);
      else removerDoEstoque(movimento);
      registrarProducao({
        tipo: 'ajuste',
        produtoId: itemAjusteId,
        produtoNome: itemAjusteNome,
        quantidade: qtd,
        detalhes: `Vitrine ${delta > 0 ? '+' : '−'}${qtd} un (ajuste no Estoque Central).`,
      });
    } else if (itemAjusteTipo === 'congelado') {
      // Entrada no freezer é massa feita: consome os insumos da ficha (e vai para o histórico)
      if (delta > 0) congelarMassas(itemAjusteId, qtd, true, 'entrada pelo Estoque Central');
      else {
        retirarDoFreezer(itemAjusteId, qtd);
        registrarProducao({
          tipo: 'ajuste',
          produtoId: itemAjusteId,
          produtoNome: itemAjusteNome,
          quantidade: qtd,
          detalhes: `Freezer −${qtd} un (ajuste no Estoque Central).`,
        });
      }
    } else {
      // Ingrediente, embalagem ou outro: entrada com valor pago recalcula o custo médio na lista única
      ajustarEstoqueInsumo(itemAjusteId, finalDelta, lerNumero(valorPagoInput));
    }

    setModalAjusteVisible(false);
  };

  // Indicadores + busca + novo material (mesma faixa nas abas de ingredientes e embalagens)
  const barraMateriais = (tipoNovo: TipoMaterial) => (
    <View style={styles.toolbarRow}>
      <View style={styles.statsStrip}>
        <Indicador primeiro rotulo="Itens" valor={String(totalMateriais)} onPress={() => setKpiDetalhe(detalhes.itens())} />
        <Indicador
          rotulo="Estoque crítico"
          valor={String(listaComprasSugerida.length)}
          cor={listaComprasSugerida.length > 0 ? DANGER_RED : SUCCESS_GREEN}
          onPress={() => setKpiDetalhe(detalhes.critico())}
        />
        <Indicador rotulo="Valor em almoxarifado" valor={formatMoney(valorAlmoxarifado)} cor={SUCCESS_GREEN} onPress={() => setKpiDetalhe(detalhes.almoxarifado())} />
        <Indicador
          rotulo="Status de compra"
          valor={listaComprasSugerida.length === 0 ? '✅ 100% ok' : '🛒 Comprar'}
          cor={listaComprasSugerida.length === 0 ? SUCCESS_GREEN : DANGER_RED}
          onPress={listaComprasSugerida.length > 0 ? () => setActiveTab('compras') : undefined}
        />
      </View>
      <View style={styles.searchBox}>
        <Feather name="search" size={14} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou tipo"
          placeholderTextColor="#94A3B8"
          value={buscaMaterial}
          onChangeText={setBuscaMaterial}
        />
        {buscaMaterial.length > 0 && (
          <TouchableOpacity onPress={() => setBuscaMaterial('')}>
            <Feather name="x" size={14} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.btnNovoMaterial} onPress={() => abrirNovoMaterial(tipoNovo)}>
        <Feather name="plus" size={14} color="#FFFFFF" />
        <Text style={styles.btnNovoMaterialText}>Novo material</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screenWrapper}>
        {/* SIDEBAR MODULAR */}
        <Sidebar activeRoute="/estoque" />

        {/* CONTEÚDO PRINCIPAL */}
        <View style={styles.mainContainer}>
          {/* CABEÇALHO */}
          <View style={styles.topHeader}>
            <PageHeaderTitulo
              etiqueta="ATELIÊ · MATERIAIS & VITRINE"
              titulo="Estoque Central"
              subtitulo="Produtos prontos, massas no freezer, insumos e lista de compras."
            />

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
                Embalagens & Outros
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
              {/* INDICADORES + BUSCA (FAIXA ÚNICA COMPACTA) */}
              <View style={styles.toolbarRow}>
                <View style={styles.statsStrip}>
                  <Indicador
                    primeiro
                    rotulo="Valor em vitrine"
                    valor={formatMoney(valorVitrine)}
                    detalhe={`c/ congelados: ${formatMoney(valorVitrine + valorCongelados)}`}
                    cor={SUCCESS_GREEN}
                    onPress={() => setKpiDetalhe(detalhes.valorVitrine())}
                  />
                  <Indicador rotulo="♨️ Prontos" valor={`${totalProntos} un`} cor={OVEN_ORANGE} onPress={() => setKpiDetalhe(detalhes.prontos())} />
                  <Indicador rotulo="🧊 Congelados" valor={`${totalCongelados} un`} cor={FREEZER_CYAN} onPress={() => setKpiDetalhe(detalhes.congelados())} />
                  <Indicador
                    rotulo="Sob encomenda"
                    valor={`${totalSobEncomenda} ${totalSobEncomenda === 1 ? 'produto' : 'produtos'}`}
                    cor={KIPI_BLUE_ACCENT}
                    onPress={() => setKpiDetalhe(detalhes.encomenda())}
                  />
                  <Indicador
                    rotulo="🗑 Perdas 30d"
                    valor={formatMoney(perdas30.total)}
                    detalhe={`${perdas30.unidades} un descartadas`}
                    cor={perdas30.total > 0 ? DANGER_RED : SUCCESS_GREEN}
                    onPress={() => setKpiDetalhe(detalhes.perdas())}
                  />
                </View>
                <View style={styles.searchBox}>
                  <Feather name="search" size={14} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar produto ou categoria"
                    placeholderTextColor="#94A3B8"
                    value={buscaProduto}
                    onChangeText={setBuscaProduto}
                  />
                  {buscaProduto.length > 0 && (
                    <TouchableOpacity onPress={() => setBuscaProduto('')}>
                      <Feather name="x" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.chipsBar}>
                <ScrollView
                  horizontal
                  style={{ flex: 1 }}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}>
                  {categoriasProdutos.map((cat) => {
                    const ativo = categoriaFiltro === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.chip, ativo && styles.chipActive]}
                        onPress={() => setCategoriaFiltro(cat)}>
                        <Text style={[styles.chipText, ativo && styles.chipTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Alternar visualização: cards ou lista */}
                <View style={styles.viewToggle}>
                  {(['cards', 'lista'] as const).map((modo) => {
                    const ativo = modoProdutos === modo;
                    return (
                      <TouchableOpacity
                        key={modo}
                        style={[styles.viewToggleBtn, ativo && styles.viewToggleBtnActive]}
                        onPress={() => setModoProdutos(modo)}
                        accessibilityLabel={modo === 'cards' ? 'Ver em cards' : 'Ver em lista'}>
                        <Feather name={modo === 'cards' ? 'grid' : 'list'} size={14} color={ativo ? KIPI_BLUE_ACCENT : '#64748B'} />
                        <Text style={[styles.viewToggleText, ativo && { color: KIPI_BLUE_ACCENT }]}>
                          {modo === 'cards' ? 'Cards' : 'Lista'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {produtosFiltrados.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Feather name="search" size={30} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>Nenhum produto encontrado</Text>
                  <Text style={styles.emptySubtitle}>Tente outro nome ou categoria.</Text>
                </View>
              )}

              {modoProdutos === 'cards' && (
              <View style={styles.cardsGrid}>
                {produtosFiltrados.map(p => {
                  const assadoBaixo = p.estoqueAssado <= p.minimoAssado;
                  const congeladoBaixo = p.minimoCongelado > 0 && p.estoqueCongelado <= p.minimoCongelado;
                  const margem = p.precoVenda > 0 ? Math.round(((p.precoVenda - p.custo) / p.precoVenda) * 100) : 0;

                  return (
                    <View key={p.id} style={[styles.stockCard, (assadoBaixo || congeladoBaixo) && styles.stockCardWarning]}>
                      <View style={styles.stockCardTop}>
                        <View style={styles.prodAvatar}>
                          <Text style={{ fontSize: 24 }}>{p.fotoEmoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prodCategory}>{p.categoria}</Text>
                          <Text style={styles.prodName}>{p.nome}</Text>
                          <Text style={styles.prodPrice}>
                            {formatMoney(p.precoVenda)}{' '}
                            <Text style={styles.prodCusto}>
                              {p.custo > 0 ? `· custo ${formatMoney(p.custo)} (${margem}% margem)` : '· sem custo cadastrado'}
                            </Text>
                          </Text>
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

                      {/* Atalhos da Produção: Produzir (massa → freezer, desconta insumos) e Assar (freezer → vitrine) */}
                      <View style={styles.stockCardActions}>
                        <TouchableOpacity style={styles.btnAjustarSmall} onPress={() => irParaPreparar(p.id)}>
                          <Text style={{ fontSize: 11 }}>🧊</Text>
                          <Text style={[styles.btnAjustarSmallText, { color: FREEZER_CYAN }]}>Produzir</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.btnAtalhoAssar, p.estoqueCongelado <= 0 && { opacity: 0.45 }]}
                          disabled={p.estoqueCongelado <= 0}
                          onPress={() => irParaAssar(p.id)}>
                          <Text style={{ fontSize: 11 }}>🔥</Text>
                          <Text style={styles.btnAtalhoAssarText}>
                            {p.estoqueCongelado > 0 ? 'Assar' : 'Sem congelados'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.btnAjustarSmall, p.estoqueAssado + p.estoqueCongelado <= 0 && { opacity: 0.45 }]}
                          disabled={p.estoqueAssado + p.estoqueCongelado <= 0}
                          onPress={() => setDescarteId(p.id)}>
                          <Feather name="trash-2" size={12} color={DANGER_RED} />
                          <Text style={[styles.btnAjustarSmallText, { color: DANGER_RED }]}>Descartar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.btnAjustarSmall} onPress={() => verProduto(p.id)}>
                          <Feather name="external-link" size={12} color="#64748B" />
                          <Text style={styles.btnAjustarSmallText}>Ver produto</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
              )}

              {/* MODO LISTA: mesma informação dos cards em linhas compactas */}
              {modoProdutos === 'lista' && produtosFiltrados.length > 0 && (
                <View style={styles.tableCard}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.th, { flex: 2.4 }]}>PRODUTO</Text>
                    <Text style={[styles.th, { flex: 1.3 }]}>PREÇO / MARGEM</Text>
                    <Text style={[styles.th, { flex: 1 }]}>♨️ VITRINE</Text>
                    <Text style={[styles.th, { flex: 1 }]}>🧊 FREEZER</Text>
                    <Text style={[styles.th, { width: 150, textAlign: 'right' }]}>AÇÕES</Text>
                  </View>
                  {produtosFiltrados.map((p, idx) => {
                    const assadoBaixo = p.estoqueAssado <= p.minimoAssado;
                    const congeladoBaixo = p.minimoCongelado > 0 && p.estoqueCongelado <= p.minimoCongelado;
                    const margem = p.precoVenda > 0 ? Math.round(((p.precoVenda - p.custo) / p.precoVenda) * 100) : 0;
                    return (
                      <View
                        key={p.id}
                        style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven, (assadoBaixo || congeladoBaixo) && styles.tableRowAlert]}>
                        <View style={[styles.td, styles.tdNome, { flex: 2.4 }]}>
                          <View style={styles.tableAvatar}>
                            <Text style={{ fontSize: 18 }}>{p.fotoEmoji}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tableName} numberOfLines={1}>{p.nome}</Text>
                            <Text style={styles.tableSub}>{p.categoria}</Text>
                          </View>
                        </View>
                        <View style={[styles.td, { flex: 1.3 }]}>
                          <Text style={styles.tableStockNumber}>{formatMoney(p.precoVenda)}</Text>
                          <Text style={styles.tableSub}>{p.custo > 0 ? `${margem}% margem` : 'sem custo'}</Text>
                        </View>
                        <View style={[styles.td, { flex: 1 }]}>
                          <Text style={[styles.tableStockNumber, { color: assadoBaixo ? DANGER_RED : OVEN_ORANGE }]}>
                            {p.estoqueAssado} un
                          </Text>
                          <Text style={styles.tableSub}>mín. {p.minimoAssado}</Text>
                        </View>
                        <View style={[styles.td, { flex: 1 }]}>
                          <Text style={[styles.tableStockNumber, { color: congeladoBaixo ? DANGER_RED : FREEZER_CYAN }]}>
                            {p.minimoCongelado > 0 || p.estoqueCongelado > 0 ? `${p.estoqueCongelado} un` : '—'}
                          </Text>
                          {p.minimoCongelado > 0 && <Text style={styles.tableSub}>mín. {p.minimoCongelado}</Text>}
                        </View>
                        <View style={[styles.td, { width: 150, flexDirection: 'row', justifyContent: 'flex-end', gap: 2 }]}>
                          <TouchableOpacity style={styles.btnIconAjuste} accessibilityLabel="Produzir (preparar massa)" onPress={() => irParaPreparar(p.id)}>
                            <Text style={{ fontSize: 14 }}>🧊</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.btnIconAjuste, p.estoqueCongelado <= 0 && { opacity: 0.35 }]}
                            disabled={p.estoqueCongelado <= 0}
                            accessibilityLabel="Assar na Produção"
                            onPress={() => irParaAssar(p.id)}>
                            <Text style={{ fontSize: 14 }}>🔥</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.btnIconAjuste, p.estoqueAssado + p.estoqueCongelado <= 0 && { opacity: 0.35 }]}
                            disabled={p.estoqueAssado + p.estoqueCongelado <= 0}
                            accessibilityLabel="Descartar"
                            onPress={() => setDescarteId(p.id)}>
                            <Feather name="trash-2" size={14} color={DANGER_RED} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.btnIconAjuste} accessibilityLabel="Ver produto" onPress={() => verProduto(p.id)}>
                            <Feather name="external-link" size={15} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          {/* =========================================================================
              CONTEÚDO DA ABA 2: INGREDIENTES & RENDIMENTO (QUANTAS RECEITAS DÁ PRA FAZER)
          ========================================================================== */}
          {activeTab === 'ingredientes' && (
            <ScrollView style={styles.tabContentScroll} showsVerticalScrollIndicator={false}>
              {barraMateriais('ingrediente')}
              <View style={styles.tableCard}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 2 }]}>INGREDIENTE</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>ESTOQUE ATUAL</Text>
                  <Text style={[styles.th, { flex: 1.1 }]}>MÍNIMO</Text>
                  <Text style={[styles.th, { flex: 2.2 }]}>CAPACIDADE DE FORNADAS (RENDIMENTO)</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
                  <Text style={[styles.th, { width: 70, textAlign: 'right' }]}>AÇÕES</Text>
                </View>

                {ingredientesFiltrados.length === 0 && (
                  <Text style={styles.tableEmpty}>Nenhum ingrediente encontrado.</Text>
                )}

                {ingredientesFiltrados.map((ing, idx) => {
                  const isAlerta = ing.quantidadeAtual <= ing.minimoSeguranca;
                  const isEven = idx % 2 === 0;

                  return (
                    <View key={ing.id} style={[styles.tableRow, isEven && styles.tableRowEven, isAlerta && styles.tableRowAlert]}>
                      <View style={[styles.td, styles.tdNome, { flex: 2 }]}>
                        <View style={styles.tableAvatar}>
                          <Text style={{ fontSize: 18 }}>{ing.emoji}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.tableName} numberOfLines={1}>{ing.nome}</Text>
                          <Text style={styles.tableSub}>{ing.tipo} • {ing.armazenamento}</Text>
                        </View>
                      </View>

                      <View style={[styles.td, { flex: 1.2 }]}>
                        <Text style={[styles.tableStockNumber, isAlerta && { color: DANGER_RED }]}>
                          {ing.quantidadeAtual} {ing.unidade}
                        </Text>
                        <Text style={styles.tableSub}>{formatCusto(ing.custoUnitario)}/{ing.unidade}</Text>
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

                      <View style={[styles.td, styles.tdAcoes]}>
                        <TouchableOpacity
                          style={styles.btnIconAjuste}
                          accessibilityLabel="Entrada ou baixa"
                          onPress={() => abrirAjuste('ingrediente', ing.id, ing.nome, '1')}>
                          <Feather name="plus-circle" size={17} color={KIPI_BLUE_ACCENT} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnIconAjuste}
                          accessibilityLabel="Editar material"
                          onPress={() => abrirEdicaoMaterial('ingrediente', ing, ing.tipo, ing.armazenamento)}>
                          <Feather name="edit-2" size={15} color="#64748B" />
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
              {barraMateriais('embalagem')}
              <View style={styles.tableCard}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 2 }]}>EMBALAGEM / MATERIAL</Text>
                  <Text style={[styles.th, { flex: 1.4 }]}>ESTOQUE ATUAL</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>MÍNIMO</Text>
                  <Text style={[styles.th, { flex: 2 }]}>APLICAÇÃO / UTILIZAÇÃO</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
                  <Text style={[styles.th, { width: 70, textAlign: 'right' }]}>AÇÕES</Text>
                </View>

                {embalagensFiltradas.length === 0 && (
                  <Text style={styles.tableEmpty}>Nenhum material encontrado.</Text>
                )}

                {embalagensFiltradas.map((emb, idx) => {
                  const isAlerta = emb.quantidadeAtual <= emb.minimoSeguranca;
                  const isEven = idx % 2 === 0;

                  return (
                    <View key={emb.id} style={[styles.tableRow, isEven && styles.tableRowEven, isAlerta && styles.tableRowAlert]}>
                      <View style={[styles.td, styles.tdNome, { flex: 2 }]}>
                        <View style={styles.tableAvatar}>
                          <Text style={{ fontSize: 18 }}>{emb.emoji}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.tableName} numberOfLines={1}>{emb.nome}</Text>
                          <Text style={styles.tableSub}>{ROTULO_TIPO_MATERIAL[emb.tipo]}</Text>
                        </View>
                      </View>

                      <View style={[styles.td, { flex: 1.4 }]}>
                        <Text style={[styles.tableStockNumber, isAlerta && { color: DANGER_RED }]}>
                          {emb.quantidadeAtual} {emb.unidade}
                        </Text>
                        <Text style={styles.tableSub}>{formatCusto(emb.custoUnitario)}/{emb.unidade}</Text>
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

                      <View style={[styles.td, styles.tdAcoes]}>
                        <TouchableOpacity
                          style={styles.btnIconAjuste}
                          accessibilityLabel="Entrada ou baixa"
                          onPress={() => abrirAjuste('embalagem', emb.id, emb.nome, '10')}>
                          <Feather name="plus-circle" size={17} color={KIPI_BLUE_ACCENT} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnIconAjuste}
                          accessibilityLabel="Editar material"
                          onPress={() => abrirEdicaoMaterial(emb.tipo, emb, emb.usadoEm)}>
                          <Feather name="edit-2" size={15} color="#64748B" />
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
                      <View style={[styles.td, styles.tdNome, { flex: 2.5 }]}>
                        <View style={styles.tableAvatar}>
                          <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                        </View>
                        <Text style={[styles.tableName, { flex: 1, minWidth: 0 }]} numberOfLines={1}>{item.nome}</Text>
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
              {materialAjuste && (
                <Text style={styles.modalHint}>
                  Atual: {materialAjuste.quantidadeAtual} {materialAjuste.unidade} · {formatCusto(materialAjuste.custoUnitario)}/{materialAjuste.unidade}
                </Text>
              )}
            </View>

            {/* Compra: valor pago recalcula o custo médio (só vale para "Dar Entrada") */}
            {materialAjuste && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.inputLabel}>VALOR TOTAL PAGO (R$) — OPCIONAL, SÓ NA ENTRADA:</Text>
                <TextInput
                  style={[styles.modalInput, { fontSize: 15 }]}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor="#94A3B8"
                  value={valorPagoInput}
                  onChangeText={setValorPagoInput}
                />
                {previaCustoMedio !== null && (
                  <Text style={[styles.modalHint, { color: SUCCESS_GREEN, fontWeight: '700' }]}>
                    Novo custo médio: {formatCusto(previaCustoMedio)}/{materialAjuste.unidade}
                  </Text>
                )}
              </View>
            )}

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

      {/* =========================================================================
          MODAL DE CADASTRO / EDIÇÃO DE MATERIAL
      ========================================================================== */}
      <Modal
        visible={modalMaterialVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalMaterialVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSmallBox, { maxWidth: 460 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{materialEditandoId ? 'Editar Material' : 'Novo Material'}</Text>
                <Text style={styles.modalSubtitle}>Ingredientes, embalagens e outros materiais do ateliê</Text>
              </View>
              <TouchableOpacity onPress={() => setModalMaterialVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingTop: 12, gap: 12 }}>
              {formErro && <Text style={styles.formErro}>{formErro}</Text>}

              <View>
                <Text style={styles.inputLabel}>TIPO</Text>
                <View style={styles.chipsWrap}>
                  {(['ingrediente', 'embalagem', 'outro'] as TipoMaterial[]).map((t) => {
                    const ativo = formTipo === t;
                    // Na edição não troca de tipo (ingrediente e embalagem ficam em listas diferentes)
                    const bloqueado = !!materialEditandoId && (t === 'ingrediente') !== (formTipo === 'ingrediente');
                    return (
                      <TouchableOpacity
                        key={t}
                        disabled={bloqueado}
                        style={[styles.chip, ativo && styles.chipActive, bloqueado && { opacity: 0.4 }]}
                        onPress={() => setFormTipo(t)}>
                        <Text style={[styles.chipText, ativo && styles.chipTextActive]}>{ROTULO_TIPO_MATERIAL[t]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={styles.inputLabel}>NOME *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={formTipo === 'ingrediente' ? 'Ex: Leite Condensado' : formTipo === 'embalagem' ? 'Ex: Caixa Kraft 6 un' : 'Ex: Topper de Aniversário'}
                  placeholderTextColor="#94A3B8"
                  value={formNome}
                  onChangeText={setFormNome}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>UNIDADE DE MEDIDA</Text>
                <View style={styles.chipsWrap}>
                  {(UNIDADES_MATERIAL.includes(formUnidade) ? UNIDADES_MATERIAL : [...UNIDADES_MATERIAL, formUnidade]).map((u) => {
                    const ativo = formUnidade === u;
                    return (
                      <TouchableOpacity key={u} style={[styles.chip, ativo && styles.chipActive]} onPress={() => setFormUnidade(u)}>
                        <Text style={[styles.chipText, ativo && styles.chipTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>QTD ATUAL</Text>
                  <TextInput style={styles.formInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#94A3B8" value={formQtd} onChangeText={setFormQtd} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>MÍNIMO</Text>
                  <TextInput style={styles.formInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#94A3B8" value={formMinimo} onChangeText={setFormMinimo} />
                </View>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.inputLabel}>CUSTO / {formUnidade.toUpperCase()} (R$)</Text>
                  <TextInput style={styles.formInput} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor="#94A3B8" value={formCusto} onChangeText={setFormCusto} />
                </View>
              </View>

              <View>
                <Text style={styles.inputLabel}>{formTipo === 'ingrediente' ? 'CATEGORIA (OPCIONAL)' : 'USADO EM (OPCIONAL)'}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={formTipo === 'ingrediente' ? 'Ex: Laticínio' : 'Ex: Bolos de aniversário'}
                  placeholderTextColor="#94A3B8"
                  value={formDetalhe}
                  onChangeText={setFormDetalhe}
                />
              </View>

              {formTipo === 'ingrediente' && (
                <View>
                  <Text style={styles.inputLabel}>ARMAZENAMENTO</Text>
                  <View style={styles.chipsWrap}>
                    {ARMAZENAMENTOS.map((a) => {
                      const ativo = formArmazenamento === a;
                      return (
                        <TouchableOpacity key={a} style={[styles.chip, ativo && styles.chipActive]} onPress={() => setFormArmazenamento(a)}>
                          <Text style={[styles.chipText, ativo && styles.chipTextActive]}>{a}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalActionButtonsRow, { marginTop: 14 }]}>
              {materialEditandoId && (
                <TouchableOpacity style={styles.btnAjusteSubtrair} onPress={handleExcluirMaterial}>
                  <Feather name="trash-2" size={15} color={DANGER_RED} />
                  <Text style={styles.btnAjusteSubtrairText}>{confirmarExclusao ? 'Confirmar exclusão' : 'Excluir'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btnSalvarMaterial} onPress={handleSalvarMaterial}>
                <Feather name="check" size={15} color="#FFFFFF" />
                <Text style={styles.btnSalvarMaterialText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DESCARTE: vencido, doado, quebrado... sai da vitrine ou do freezer e entra como perda */}
      <DescarteModal visible={descarteId !== null} produtoId={descarteId || null} onClose={() => setDescarteId(null)} />
      <ProducaoRapidaModal
        visible={producaoRapida !== null}
        produtoId={producaoRapida?.id ?? null}
        modo={producaoRapida?.modo ?? 'assar'}
        onClose={() => setProducaoRapida(null)}
      />

      {/* DETALHE DO INDICADOR: o que o número quer dizer e de onde ele vem */}
      <Modal visible={kpiDetalhe !== null} transparent animationType="fade" onRequestClose={() => setKpiDetalhe(null)}>
        <View style={styles.modalOverlay}>
          {kpiDetalhe && (
            <View style={[styles.modalSmallBox, { maxWidth: 480 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{kpiDetalhe.titulo}</Text>
                  <Text style={styles.modalSubtitle}>{kpiDetalhe.explicacao}</Text>
                </View>
                <TouchableOpacity onPress={() => setKpiDetalhe(null)}>
                  <Feather name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 380, marginTop: 8 }}>
                {kpiDetalhe.linhas.length === 0 ? (
                  <Text style={styles.modalSubtitle}>Nada para mostrar no momento.</Text>
                ) : (
                  kpiDetalhe.linhas.map((l, idx) => (
                    <View key={`${l.nome}-${idx}`} style={styles.kpiDetalheLinha}>
                      <Text style={styles.kpiDetalheNome} numberOfLines={1}>{l.nome}</Text>
                      <Text style={[styles.kpiDetalheValor, l.alerta && { color: DANGER_RED }]}>{l.valor}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
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
const styles = paraCelular(StyleSheet.create({
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
  // Célula do nome: alinhada à esquerda, nome longo corta com reticências
  tdNome: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10, minWidth: 0, paddingRight: 12 },
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
  kpiDetalheLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  kpiDetalheNome: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#334155',
  },
  kpiDetalheValor: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
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
  modalHint: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },

  // FAIXA DE INDICADORES + BUSCA (COMPACTA)
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
  },
  statItem: {
    flexGrow: 1,
    minWidth: 110,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  statItemDivider: {
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
  },
  statLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 1,
  },
  statDetail: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#94A3B8',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 220,
    flexGrow: 0.4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#0F172A',
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  btnNovoMaterial: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: KIPI_BLUE_ACCENT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnNovoMaterialText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chipsRow: {
    gap: 6,
    paddingBottom: 12,
  },
  chipsBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewToggleBtnActive: {
    backgroundColor: KIPI_BLUE_TINT,
  },
  viewToggleText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  btnAtalhoAssar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OVEN_TINT,
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  btnAtalhoAssarText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: OVEN_ORANGE,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: KIPI_BLUE_TINT,
    borderColor: KIPI_BLUE,
  },
  chipText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '800',
  },
  prodCusto: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tableEmpty: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 24,
  },
  tdAcoes: {
    width: 70,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },

  // MODAL MATERIAL
  formErro: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: DANGER_RED,
    backgroundColor: DANGER_TINT,
    padding: 8,
    borderRadius: 8,
  },
  formInput: {
    fontFamily: FONT_SANS,
    fontSize: 14,
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
    gap: 10,
  },
  btnSalvarMaterial: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KIPI_BLUE_ACCENT,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  btnSalvarMaterialText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
}));
