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
import { useLocalSearchParams } from 'expo-router';
import Sidebar from '@/components/Sidebar';
import { PageHeaderTitulo, TOPO_COMPACTO } from '@/components/PageHeader';
import {
  useEstoqueVitrine,
  useEstoqueFreezer,
  produtoAtivo as produtoEstaAtivo,
} from '@/lib/estoqueVitrine';
import { usePedidos, encomendasEmAberto, resumoItens, rotuloEntrega, atualizarPedido } from '@/lib/clientesPedidos';
import { useInsumos, useFichas, receitaDoProduto, congelarMassas, assarDoFreezer } from '@/lib/insumos';
import { useHistoricoProducao, type RegistroProducao } from '@/lib/historicoProducao';
import { resumoDePerdas, ultimosDias, EMOJI_MOTIVO } from '@/lib/descarte';
import DescarteModal from '@/components/DescarteModal';
import ProducaoMobile from '@/components/producao-mobile/ProducaoMobile';
import { useEhCelular } from '@/lib/layout';

// ============================================================================
// TIPOGRAFIA & CONSTANTES DE TEMA (KIPI ATELIÊ / UX SÊNIOR)
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: 'System' });

const KIPI_BLUE = '#9E5D25';
const KIPI_BLUE_DARK = '#7A4520';
const KIPI_BLUE_TINT = '#ECEBFA';
const KIPI_BLUE_ACCENT = '#4B4FC4';
const KIPI_FROST_BG = '#F8F6F2';
const SUCCESS_GREEN = '#2F7D55';
const SUCCESS_TINT = '#E4F1E9';
const WARNING_AMBER = '#B9781A';
const WARNING_TINT = '#FBF0DC';
const DANGER_RED = '#B42318';
const DANGER_TINT = '#FBE7E4';
const OVEN_ORANGE = '#B9781A';
const OVEN_TINT = '#FBF0DC';
const FREEZER_CYAN = '#3A3D9E';
const FREEZER_TINT = '#ECEBFA';

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
  tempoFornoMinutos: number;
}

// Assados = estoque da vitrine compartilhado com as vendas; congelados = freezer
// compartilhado com o Estoque Central; receita = ficha de produção com o estoque
// atual da lista única de insumos (mesmo id do produto)
export type ProdutoComVitrine = ProdutoProducao & {
  estoqueAssado: number;
  estoqueCongelado: number;
  receitaIngredientes: IngredienteNecessario[];
};


// Status de produção das encomendas (as encomendas vêm dos pedidos compartilhados)
const STATUS_ENCOMENDA: Record<string, { label: string; cor: string; fundo: string }> = {
  a_fazer: { label: 'A fazer', cor: '#6B615A', fundo: '#F3EEE7' },
  em_producao: { label: 'Em produção', cor: '#9A6516', fundo: '#FBF0DC' },
  pronto: { label: 'Pronto', cor: '#4B4FC4', fundo: '#ECEBFA' },
};

type FiltroPeriodoHistorico = 'hoje' | '7dias' | '30dias' | 'tudo';
type FiltroTipoHistorico = 'todos' | RegistroFornada['tipo'];
const HISTORICO_POR_PAGINA = 15;

// Registro do histórico compartilhado + foto do produto para exibir
export type RegistroFornada = RegistroProducao & { fotoEmoji: string };

// Foto e tempo de forno: os produtos vêm da vitrine (inclusive os cadastrados em Produtos)
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
const TEMPO_FORNO: Record<string, number> = { 'prod-1': 14, 'prod-2': 14, 'prod-4': 35, 'prod-6': 16, 'prod-9': 10, 'prod-11': 20, 'prod-12': 18 };
const TEMPO_FORNO_PADRAO = 15;
// Próximo passo da encomenda na cozinha (Entregue é marcado em Pedidos)
const PROXIMO_STATUS_COZINHA: Record<string, { id: 'em_producao' | 'pronto'; label: string } | undefined> = {
  a_fazer: { id: 'em_producao', label: 'Iniciar produção' },
  em_producao: { id: 'pronto', label: 'Marcar pronto' },
};

// Celular (app e navegador do celular): layout mobile; computador: layout com menu lateral
export default function ProducaoScreen() {
  const celular = useEhCelular();
  return celular ? <ProducaoMobile /> : <ProducaoDesktop />;
}

function ProducaoDesktop() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // Estados principais
  // Histórico compartilhado: entradas de freezer do Estoque Central e de Produtos também aparecem aqui
  const vitrineProdutos = useEstoqueVitrine();
  const emojiDe = (produtoId: string) =>
    vitrineProdutos.find((v) => v.id === produtoId)?.emoji ?? EMOJI_CATEGORIA[vitrineProdutos.find((v) => v.id === produtoId)?.categoria ?? ''] ?? '🧁';
  const fornadas: RegistroFornada[] = useHistoricoProducao().map((r) => ({ ...r, fotoEmoji: emojiDe(r.produtoId) }));
  // Produtos produzidos aqui: todos os ativos (com ou sem receita; sem receita não desconta insumos)
  const { fichas } = useFichas();
  const freezerAtual = useEstoqueFreezer();
  const produtos: ProdutoProducao[] = vitrineProdutos
    .filter((v) => produtoEstaAtivo(v))
    .map((v) => ({
      id: v.id,
      nome: v.nome,
      categoria: v.categoria,
      fotoEmoji: emojiDe(v.id),
      tempoFornoMinutos: TEMPO_FORNO[v.id] ?? TEMPO_FORNO_PADRAO,
    }));
  const [searchQuery, setSearchQuery] = useState('');
  const [encomendasAbertas, setEncomendasAbertas] = useState(false);

  // Filtros do histórico (mostra tudo, carregando aos poucos)
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodoHistorico>('tudo');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipoHistorico>('todos');
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [limiteHistorico, setLimiteHistorico] = useState(HISTORICO_POR_PAGINA);

  // Modais de Ação Operacional
  const [modalPreparoVisible, setModalPreparoVisible] = useState(false);
  const [modalAssarVisible, setModalAssarVisible] = useState(false);
  const [produtoAtivo, setProdutoAtivo] = useState<ProdutoComVitrine | null>(null);
  // Descarte: id do produto, "" = escolher na lista, null = fechado
  const [descarteId, setDescarteId] = useState<string | null>(null);

  // Formulário: Preparar Massa (Congelar)
  const [qtdPreparoInput, setQtdPreparoInput] = useState('12');
  const [erroPreparo, setErroPreparo] = useState<string | null>(null);
  const [descontarIngredientes, setDescontarIngredientes] = useState(true);

  // Formulário: Assar Fornada
  const [qtdAssarInput, setQtdAssarInput] = useState('6');
  const [erroAssar, setErroAssar] = useState<string | null>(null);

  // Timer de Forno Ativo
  const [timerAtivo, setTimerAtivo] = useState(false);
  const [timerMinutosRestantes, setTimerMinutosRestantes] = useState(14);
  const [produtoNoFornoNome, setProdutoNoFornoNome] = useState('');

  // Assados lidos do estoque da vitrine: o que é assado aqui já aparece para venda
  // Congelados lidos do freezer compartilhado: ajustes do Estoque Central aparecem aqui
  const vitrine = useEstoqueVitrine();
  const freezer = useEstoqueFreezer();
  // Encomendas vêm dos pedidos compartilhados: uma encomenda nova no Novo Pedido já aparece aqui
  const encomendasMarcadas = encomendasEmAberto(usePedidos());
  // Ingredientes da receita com o estoque atual da lista única de insumos
  const insumosLista = useInsumos();
  const produtosView: ProdutoComVitrine[] = useMemo(
    () =>
      produtos.map((p) => ({
        ...p,
        estoqueAssado: vitrine.find((v) => v.id === p.id)?.estoque ?? 0,
        estoqueCongelado: freezer[p.id] ?? 0,
        receitaIngredientes: receitaDoProduto(p.id, insumosLista),
      })),
    [produtos, vitrine, freezer, insumosLista]
  );
  const produtoAtivoView = produtoAtivo ? produtosView.find((p) => p.id === produtoAtivo.id) || produtoAtivo : null;

  // Atalhos (Estoque Central e Produtos): ?assar=<id> abre a fornada; ?preparar=<id> abre o preparo de massa
  const { assar, preparar, t: atalhoEm } = useLocalSearchParams<{ assar?: string; preparar?: string; t?: string }>();
  useEffect(() => {
    const prodAssar = assar ? produtosView.find((p) => p.id === assar) : undefined;
    if (prodAssar) {
      setProdutoAtivo(prodAssar);
      setQtdAssarInput(String(Math.max(1, Math.min(6, prodAssar.estoqueCongelado))));
      setErroAssar(null);
      setModalAssarVisible(true);
      return;
    }
    const prodPreparo = preparar ? produtosView.find((p) => p.id === preparar) : undefined;
    if (prodPreparo) {
      setProdutoAtivo(prodPreparo);
      setQtdPreparoInput('12');
      setErroPreparo(null);
      setModalPreparoVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assar, preparar, atalhoEm]);

  // LOTE (botões do topo): escolhe um ou vários produtos e a quantidade de cada
  const [loteModo, setLoteModo] = useState<'preparo' | 'assar' | null>(null);
  const [loteQtds, setLoteQtds] = useState<Record<string, string>>({});
  const [loteErro, setLoteErro] = useState<string | null>(null);
  const abrirLote = (modo: 'preparo' | 'assar') => {
    setLoteQtds({});
    setLoteErro(null);
    setLoteModo(modo);
  };
  const confirmarLote = () => {
    const escolhidos = produtosView
      .map((p) => ({ p, qtd: parseInt(loteQtds[p.id] || '0', 10) || 0 }))
      .filter((x) => x.qtd > 0);
    if (escolhidos.length === 0) {
      setLoteErro('Informe a quantidade de pelo menos um produto.');
      return;
    }
    if (loteModo === 'assar') {
      const semMassa = escolhidos.find((x) => x.qtd > x.p.estoqueCongelado);
      if (semMassa) {
        setLoteErro(`${semMassa.p.nome}: só há ${semMassa.p.estoqueCongelado} no freezer.`);
        return;
      }
      // Cada produto sai do freezer e entra na vitrine (e vai para o histórico)
      escolhidos.forEach(({ p, qtd }) => assarDoFreezer(p.id, p.nome, qtd, p.estoqueCongelado));
      const maisDemorado = escolhidos.reduce((a, b) => (b.p.tempoFornoMinutos > a.p.tempoFornoMinutos ? b : a));
      setProdutoNoFornoNome(escolhidos.length === 1 ? maisDemorado.p.nome : `${escolhidos.length} produtos`);
      setTimerMinutosRestantes(maisDemorado.p.tempoFornoMinutos);
      setTimerAtivo(true);
    } else {
      // Cada massa entra no freezer descontando os insumos da ficha (e vai para o histórico)
      escolhidos.forEach(({ p, qtd }) => congelarMassas(p.id, qtd, true, 'preparo em lote na Produção'));
    }
    setLoteModo(null);
  };

  // Totais de KPIs
  const totalCongelados = produtosView.reduce((acc, p) => acc + p.estoqueCongelado, 0);
  const totalAssados = produtosView.reduce((acc, p) => acc + p.estoqueAssado, 0);
  const saboresFreezerZerado = produtosView.filter((p) => p.estoqueCongelado === 0).length;
  const hojeChave = new Date().toDateString();
  const totalFornadasHoje = fornadas.filter(f => f.tipo === 'assar_fornada' && new Date(f.data).toDateString() === hojeChave).length;
  // Descartes dos últimos 30 dias (custo de material perdido)
  const perdas30 = resumoDePerdas(fornadas, ultimosDias(30));

  // HISTÓRICO FILTRADO E AGRUPADO POR DIA
  const historicoFiltrado = useMemo(() => {
    const agora = Date.now();
    const limiteDias = { hoje: 0, '7dias': 7, '30dias': 30, tudo: Infinity }[filtroPeriodo];
    const termo = buscaHistorico.trim().toLowerCase();
    return [...fornadas]
      .sort((a, b) => b.data.localeCompare(a.data))
      .filter((f) => {
        if (filtroTipo !== 'todos' && f.tipo !== filtroTipo) return false;
        if (termo && !f.produtoNome.toLowerCase().includes(termo)) return false;
        if (filtroPeriodo === 'hoje') return new Date(f.data).toDateString() === hojeChave;
        return (agora - new Date(f.data).getTime()) / 86400000 <= limiteDias;
      });
  }, [fornadas, filtroPeriodo, filtroTipo, buscaHistorico, hojeChave]);

  const historicoVisivel = historicoFiltrado.slice(0, limiteHistorico);
  const gruposHistorico = useMemo(() => {
    const ontemChave = new Date(Date.now() - 86400000).toDateString();
    const grupos: { titulo: string; itens: RegistroFornada[] }[] = [];
    historicoVisivel.forEach((f) => {
      const d = new Date(f.data);
      const chave = d.toDateString();
      const titulo =
        chave === hojeChave
          ? 'Hoje'
          : chave === ontemChave
          ? 'Ontem'
          : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.titulo === titulo) ultimo.itens.push(f);
      else grupos.push({ titulo, itens: [f] });
    });
    return grupos;
  }, [historicoVisivel, hojeChave]);

  // ==========================================================================
  // VALIDAÇÃO EM TEMPO REAL DE INGREDIENTES PARA O PREPARO (UX SÊNIOR)
  // ==========================================================================
  const analiseIngredientesPreparo = useMemo(() => {
    if (!produtoAtivoView) return { viavel: false, itens: [] };

    const qtd = parseInt(qtdPreparoInput) || 0;
    if (qtd <= 0) return { viavel: false, itens: [] };

    let viavel = true;
    const itens = produtoAtivoView.receitaIngredientes.map(ing => {
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
  }, [produtoAtivoView, qtdPreparoInput]);

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

    // 1. Atualiza estoque do produto: adiciona aos congelados
    // Desconto opcional dos ingredientes na lista única de insumos (Estoque Central e
    // Insumos & Receitas já mostram o novo estoque); se faltar, o insumo para em zero
    // 2. O preparo entra no histórico compartilhado (congelarMassas)
    congelarMassas(produtoAtivo.id, qtd, descontarIngredientes, 'preparo na Produção');

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
    const congeladoAtual = freezer[produtoAtivo.id] ?? 0;
    if (qtd > congeladoAtual) {
      setErroAssar(`Estoque congelado insuficiente! Você possui apenas ${congeladoAtual} no freezer.`);
      return;
    }

    // 1. Atualiza estoque: subtrai do congelado e adiciona ao assado para venda
    assarDoFreezer(produtoAtivo.id, produtoAtivo.nome, qtd, congeladoAtual);

    // 2. Inicia Timer de Forno visual
    setProdutoNoFornoNome(produtoAtivo.nome);
    setTimerMinutosRestantes(produtoAtivo.tempoFornoMinutos);
    setTimerAtivo(true);

    // A fornada já entra no histórico compartilhado (assarDoFreezer)
    setModalAssarVisible(false);
  };

  // Filtragem de produtos
  const produtosFiltrados = useMemo(() => {
    if (!searchQuery.trim()) return produtosView;
    const q = searchQuery.toLowerCase().trim();
    return produtosView.filter(p => p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q));
  }, [produtosView, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screenWrapper}>
        {/* SIDEBAR MODULAR */}
        <Sidebar activeRoute="/producao" />

        {/* ÁREA PRINCIPAL */}
        <View style={styles.mainContainer}>
          {/* TOPO: CABEÇALHO */}
          <View style={styles.topHeader}>
            <PageHeaderTitulo
              etiqueta="ATELIÊ · CHÃO DE FÁBRICA"
              titulo="Produção & Forno"
              subtitulo="Prepare lotes de massa para congelar e asse sob demanda para a vitrine."
            />

            {/* Ações Rápidas no Topo */}
            <View style={styles.topActionsRow}>
              <TouchableOpacity style={styles.btnAcaoPreparo} onPress={() => abrirLote('preparo')}>
                <Text style={{ fontSize: 16 }}>🧊</Text>
                <Text style={styles.btnAcaoPreparoText}>Preparar massa</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnAcaoAssar} onPress={() => abrirLote('assar')}>
                <Text style={{ fontSize: 16 }}>🔥</Text>
                <Text style={styles.btnAcaoAssarText}>Assar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnAcaoDescarte} onPress={() => setDescarteId('')}>
                <Feather name="trash-2" size={14} color={DANGER_RED} />
                <Text style={styles.btnAcaoDescarteText}>Descartar</Text>
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
                <Feather name="check" size={14} color="#FFFDFA" />
                <Text style={styles.ovenFinishBtnText}>Fornada Concluída</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* KPIS DE PRODUÇÃO (FAIXA COMPACTA) */}
          <View style={styles.kpiStrip}>
            {[
              { rotulo: '🧊 No freezer', valor: `${totalCongelados} un`, cor: FREEZER_CYAN },
              { rotulo: '🧁 Na vitrine', valor: `${totalAssados} un`, cor: OVEN_ORANGE },
              { rotulo: '♨️ Fornadas hoje', valor: String(totalFornadasHoje), cor: '#2E211A' },
              { rotulo: '⚠️ Freezer zerado', valor: String(saboresFreezerZerado), cor: saboresFreezerZerado > 0 ? WARNING_AMBER : SUCCESS_GREEN },
              { rotulo: '🗑 Perdas 30 dias', valor: perdas30.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), cor: perdas30.total > 0 ? DANGER_RED : SUCCESS_GREEN },
            ].map((k) => (
              <View key={k.rotulo} style={styles.kpiStripItem}>
                <Text style={styles.kpiStripLabel}>{k.rotulo}</Text>
                <Text style={[styles.kpiStripValue, { color: k.cor }]}>{k.valor}</Text>
              </View>
            ))}
            {/* Encomendas: clique abre a lista do que produzir */}
            <TouchableOpacity
              style={[styles.kpiStripItem, styles.kpiStripClicavel, encomendasAbertas && styles.kpiStripAtivo]}
              onPress={() => setEncomendasAbertas(!encomendasAbertas)}
              activeOpacity={0.85}>
              <Text style={styles.kpiStripLabel}>📅 Encomendas {encomendasAbertas ? '▲' : '▼'}</Text>
              <Text style={[styles.kpiStripValue, { color: KIPI_BLUE_ACCENT }]}>{encomendasMarcadas.length}</Text>
            </TouchableOpacity>
          </View>

          {/* LISTA DE ENCOMENDAS MARCADAS (O QUE A COZINHA PRECISA PRODUZIR) */}
          {encomendasAbertas && (
            <View style={styles.ordersPanel}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Encomendas a Produzir</Text>
                  <Text style={styles.sectionSubtitle}>Pedidos agendados que ainda não foram entregues</Text>
                </View>
                <TouchableOpacity onPress={() => setEncomendasAbertas(false)}>
                  <Feather name="chevron-up" size={18} color="#6B615A" />
                </TouchableOpacity>
              </View>
              <View style={styles.ordersGrid}>
                {encomendasMarcadas.map((enc) => {
                  const st = STATUS_ENCOMENDA[enc.statusProducao];
                  return (
                    <View key={enc.id} style={styles.orderCard}>
                      <View style={styles.orderCardTop}>
                        <Text style={styles.orderClient} numberOfLines={1}>{enc.clienteNome}</Text>
                        <View style={[styles.orderStatusPill, { backgroundColor: st.fundo }]}>
                          <Text style={[styles.orderStatusText, { color: st.cor }]}>{st.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.orderItems}>{resumoItens(enc)}</Text>
                      {enc.observacoes ? <Text style={styles.orderObs}>"{enc.observacoes}"</Text> : null}
                      <Text style={styles.orderDelivery}>
                        <Feather name="clock" size={11} color={KIPI_BLUE_ACCENT} /> Entrega: {rotuloEntrega(enc.dataEntrega)}
                      </Text>
                      {/* Avança o status aqui e reflete em Pedidos; Entregue é marcado em Pedidos */}
                      {PROXIMO_STATUS_COZINHA[enc.statusProducao] ? (
                        <TouchableOpacity
                          style={styles.orderNextBtn}
                          onPress={() => atualizarPedido({ ...enc, statusProducao: PROXIMO_STATUS_COZINHA[enc.statusProducao]!.id })}>
                          <Text style={styles.orderNextBtnText}>{PROXIMO_STATUS_COZINHA[enc.statusProducao]!.label} →</Text>
                        </TouchableOpacity>
                      ) : enc.statusProducao === 'pronto' ? (
                        <Text style={styles.orderAguardando}>✓ Pronto · aguardando entrega</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

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
                  <Feather name="search" size={14} color="#9A8F87" />
                  <TextInput
                    style={styles.miniSearchInput}
                    placeholder="Filtrar doce..."
                    placeholderTextColor="#9A8F87"
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
                    <View key={prod.id} style={[styles.productionCard, styles.productionCardCompacto]}>
                      {/* Linha única: produto · freezer · vitrine (com avisos curtos) */}
                      <View style={styles.prodLinha}>
                        <View style={styles.prodAvatarMini}>
                          <Text style={{ fontSize: 17 }}>{prod.fotoEmoji}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 140 }}>
                          <Text style={styles.prodName} numberOfLines={1}>{prod.nome}</Text>
                          <Text style={styles.prodOvenTime}>{prod.categoria} · ⏱️ {prod.tempoFornoMinutos} min</Text>
                        </View>
                        <View style={styles.prodNumero}>
                          <Text style={[styles.stockBarNumber, { color: FREEZER_CYAN }]}>🧊 {prod.estoqueCongelado}</Text>
                          {precisaPrepararMassa && <Text style={styles.stockNoticeWarning}>fazer massa</Text>}
                        </View>
                        <View style={styles.prodNumero}>
                          <Text style={[styles.stockBarNumber, { color: OVEN_ORANGE }]}>♨️ {prod.estoqueAssado}</Text>
                          {precisaAssar && <Text style={styles.stockNoticeAlert}>hora de assar</Text>}
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
                          <Text style={styles.cardBtnPreparoText}>Preparar massa</Text>
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
                            {prod.estoqueCongelado <= 0 ? 'Sem congelados' : 'Assar'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.cardBtnPerda,
                            prod.estoqueAssado + prod.estoqueCongelado <= 0 && styles.cardBtnAssarDisabled,
                          ]}
                          disabled={prod.estoqueAssado + prod.estoqueCongelado <= 0}
                          onPress={() => setDescarteId(prod.id)}>
                          <Feather name="trash-2" size={12} color={DANGER_RED} />
                          <Text style={styles.cardBtnPerdaText}>Descartar</Text>
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
                  <Text style={styles.sectionTitle}>Histórico de Produção</Text>
                  <Text style={styles.sectionSubtitle}>
                    {historicoFiltrado.length} {historicoFiltrado.length === 1 ? 'registro' : 'registros'} · preparos, fornadas e perdas
                  </Text>
                </View>
                <Feather name="clock" size={16} color="#6B615A" />
              </View>

              {/* FILTROS DO HISTÓRICO */}
              <View style={styles.historyFilters}>
                <View style={styles.historyChipRow}>
                  {[
                    { id: 'hoje', label: 'Hoje' },
                    { id: '7dias', label: '7 dias' },
                    { id: '30dias', label: '30 dias' },
                    { id: 'tudo', label: 'Tudo' },
                  ].map((p) => {
                    const ativo = filtroPeriodo === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.historyChip, ativo && styles.historyChipActive]}
                        onPress={() => {
                          setFiltroPeriodo(p.id as FiltroPeriodoHistorico);
                          setLimiteHistorico(HISTORICO_POR_PAGINA);
                        }}>
                        <Text style={[styles.historyChipText, ativo && styles.historyChipTextActive]}>{p.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.historyChipRow}>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'preparo_massa', label: '🧊 Preparos' },
                    { id: 'assar_fornada', label: '♨️ Fornadas' },
                    { id: 'perda', label: '🗑 Descartes' },
                    { id: 'ajuste', label: '⚙️ Ajustes' },
                  ].map((t) => {
                    const ativo = filtroTipo === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.historyChip, ativo && styles.historyChipActive]}
                        onPress={() => {
                          setFiltroTipo(t.id as FiltroTipoHistorico);
                          setLimiteHistorico(HISTORICO_POR_PAGINA);
                        }}>
                        <Text style={[styles.historyChipText, ativo && styles.historyChipTextActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.miniSearchBox}>
                  <Feather name="search" size={14} color="#9A8F87" />
                  <TextInput
                    style={styles.miniSearchInput}
                    placeholder="Filtrar por produto..."
                    placeholderTextColor="#9A8F87"
                    value={buscaHistorico}
                    onChangeText={(t) => {
                      setBuscaHistorico(t);
                      setLimiteHistorico(HISTORICO_POR_PAGINA);
                    }}
                  />
                </View>
              </View>

              <ScrollView style={styles.historyListScroll} showsVerticalScrollIndicator={false}>
                {historicoFiltrado.length === 0 && (
                  <Text style={styles.historyEmpty}>Nenhum registro para os filtros escolhidos.</Text>
                )}
                {gruposHistorico.map(grupo => (
                  <View key={grupo.titulo}>
                    <Text style={styles.historyDayTitle}>{grupo.titulo}</Text>
                {grupo.itens.map(f => (
                  <View key={f.id} style={styles.historyItem}>
                    <View style={styles.historyTimeCol}>
                      <Text style={styles.historyTimeText}>{f.horario}</Text>
                      <View style={[styles.historyDot, f.tipo === 'assar_fornada' ? styles.historyDotOven : f.tipo === 'perda' ? styles.historyDotLoss : styles.historyDotFreezer]} />
                    </View>

                    <View style={styles.historyCardBox}>
                      <View style={styles.historyTopRow}>
                        <Text style={{ fontSize: 16 }}>{f.fotoEmoji}</Text>
                        <Text style={styles.historyProdName} numberOfLines={1}>{f.produtoNome}</Text>
                        <View style={[styles.historyTypeBadge, f.tipo === 'assar_fornada' ? styles.badgeOven : f.tipo === 'perda' ? styles.badgeLoss : styles.badgeFreezer]}>
                          <Text style={[styles.historyTypeBadgeText, f.tipo === 'assar_fornada' ? styles.badgeOvenText : f.tipo === 'perda' ? styles.badgeLossText : styles.badgeFreezerText]}>
                            {f.tipo === 'assar_fornada'
                              ? `♨️ +${f.quantidade} assados`
                              : f.tipo === 'perda'
                              ? `${EMOJI_MOTIVO[f.motivo ?? ''] ?? '🗑'} -${f.quantidade} descartados${f.custo ? ` · perda ${f.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}`
                              : f.tipo === 'ajuste'
                              ? `⚙️ ajuste ${f.quantidade} un`
                              : `🧊 +${f.quantidade} massas`}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.historyDetailText}>{f.detalhes}</Text>
                      <Text style={styles.historyAuthor}>Por {f.responsavel}</Text>
                    </View>
                  </View>
                ))}
                  </View>
                ))}
                {historicoFiltrado.length > historicoVisivel.length && (
                  <TouchableOpacity
                    style={styles.historyMoreBtn}
                    onPress={() => setLimiteHistorico(limiteHistorico + HISTORICO_POR_PAGINA)}>
                    <Text style={styles.historyMoreBtnText}>
                      Mostrar mais ({historicoFiltrado.length - historicoVisivel.length} restantes)
                    </Text>
                  </TouchableOpacity>
                )}
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
                  <Feather name="x" size={20} color="#6B615A" />
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
                      <Feather name="minus" size={16} color="#2E211A" />
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
                      <Feather name="plus" size={16} color="#2E211A" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Checklist de Validação de Ingredientes em Estoque */}
                <View style={styles.checklistCard}>
                  <Text style={styles.checklistTitle}>
                    Verificação de Ingredientes no Estoque:
                  </Text>
                  <TouchableOpacity
                    style={styles.toggleRow}
                    onPress={() => setDescontarIngredientes(!descontarIngredientes)}
                    activeOpacity={0.8}>
                    <View style={[styles.toggleBox, descontarIngredientes && styles.toggleBoxActive]}>
                      {descontarIngredientes && <Feather name="check" size={11} color="#FFFDFA" />}
                    </View>
                    <Text style={styles.checklistSubtitle}>Descontar os ingredientes do estoque de insumos</Text>
                  </TouchableOpacity>
                  {descontarIngredientes && !analiseIngredientesPreparo.viavel && analiseIngredientesPreparo.itens.length > 0 && (
                    <Text style={styles.ingredientWarning}>
                      ⚠️ Alguns ingredientes não são suficientes. Você pode produzir mesmo assim: o estoque deles ficará zerado.
                    </Text>
                  )}

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
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmarPreparo}>
                  <Feather name="check" size={16} color="#FFFDFA" />
                  <Text style={styles.modalConfirmBtnText}>
                    {!descontarIngredientes || analiseIngredientesPreparo.viavel ? 'Confirmar & Congelar' : 'Produzir mesmo assim'}
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
                    <Text style={styles.modalTitle}>Assar</Text>
                    <Text style={styles.modalSubtitle}>
                      {produtoAtivo.nome} • Tempo de forno: {produtoAtivo.tempoFornoMinutos} min.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setModalAssarVisible(false)}>
                  <Feather name="x" size={20} color="#6B615A" />
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
                      <Feather name="minus" size={16} color="#2E211A" />
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
                      <Feather name="plus" size={16} color="#2E211A" />
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
      {/* DESCARTE: SAI DA VITRINE OU DO FREEZER, COM MOTIVO, E ENTRA COMO PERDA */}
      <DescarteModal
        visible={descarteId !== null}
        produtoId={descarteId === '' ? null : descarteId}
        onClose={() => setDescarteId(null)}
      />

      {/* =========================================================================
          MODAL 4: LOTE (BOTÕES DO TOPO) — UM OU VÁRIOS PRODUTOS DE UMA VEZ
      ========================================================================== */}
      <Modal visible={loteModo !== null} transparent animationType="fade" onRequestClose={() => setLoteModo(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.modalIconCircle, { backgroundColor: loteModo === 'assar' ? OVEN_TINT : FREEZER_TINT }]}>
                  <Text style={{ fontSize: 20 }}>{loteModo === 'assar' ? '🔥' : '🧊'}</Text>
                </View>
                <View>
                  <Text style={styles.modalTitle}>{loteModo === 'assar' ? 'Assar fornada' : 'Preparar massa'}</Text>
                  <Text style={styles.modalSubtitle}>
                    {loteModo === 'assar'
                      ? 'Sai do freezer e entra na vitrine'
                      : 'Entra no freezer descontando os insumos da ficha'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setLoteModo(null)}>
                <Feather name="x" size={20} color="#6B615A" />
              </TouchableOpacity>
            </View>

            {loteErro && (
              <View style={styles.errorBox}>
                <Feather name="alert-triangle" size={16} color={DANGER_RED} />
                <Text style={styles.errorBoxText}>{loteErro}</Text>
              </View>
            )}

            <ScrollView style={{ maxHeight: 420 }}>
              {produtosView.map((p) => {
                const qtd = parseInt(loteQtds[p.id] || '0', 10) || 0;
                const semMassa = loteModo === 'assar' && p.estoqueCongelado <= 0;
                // Preparo: avisa se algum insumo da ficha não dá para a quantidade
                const faltaInsumo =
                  loteModo === 'preparo' && qtd > 0 && p.receitaIngredientes.some((i) => i.quantidadePorUnidade * qtd > i.estoqueAtual);
                return (
                  <View key={p.id} style={[styles.loteLinha, semMassa && { opacity: 0.45 }]}>
                    <Text style={{ fontSize: 18 }}>{p.fotoEmoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prodName} numberOfLines={1}>{p.nome}</Text>
                      <Text style={[styles.prodOvenTime, faltaInsumo && { color: DANGER_RED, fontWeight: '700' }]}>
                        {loteModo === 'assar'
                          ? `🧊 ${p.estoqueCongelado} no freezer · ⏱️ ${p.tempoFornoMinutos} min`
                          : faltaInsumo
                          ? '⚠ insumos insuficientes (desconta até zerar)'
                          : `🧊 ${p.estoqueCongelado} no freezer`}
                      </Text>
                    </View>
                    {/* − / + ajudam a ajustar sem digitar (assar: até o que tem no freezer) */}
                    <View style={styles.loteStepper}>
                      <TouchableOpacity
                        style={[styles.loteStepBtn, qtd <= 0 && { opacity: 0.35 }]}
                        disabled={semMassa || qtd <= 0}
                        onPress={() => setLoteQtds((prev) => ({ ...prev, [p.id]: qtd - 1 > 0 ? String(qtd - 1) : '' }))}>
                        <Feather name="minus" size={13} color="#3D312A" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.loteInput}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#D9CFC4"
                        editable={!semMassa}
                        value={loteQtds[p.id] ?? ''}
                        onChangeText={(t) => setLoteQtds((prev) => ({ ...prev, [p.id]: t.replace(/\D/g, '') }))}
                      />
                      <TouchableOpacity
                        style={[styles.loteStepBtn, (semMassa || (loteModo === 'assar' && qtd >= p.estoqueCongelado)) && { opacity: 0.35 }]}
                        disabled={semMassa || (loteModo === 'assar' && qtd >= p.estoqueCongelado)}
                        onPress={() => setLoteQtds((prev) => ({ ...prev, [p.id]: String(qtd + 1) }))}>
                        <Feather name="plus" size={13} color={loteModo === 'assar' ? OVEN_ORANGE : FREEZER_CYAN} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setLoteModo(null)}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: loteModo === 'assar' ? OVEN_ORANGE : FREEZER_CYAN }]}
                onPress={confirmarLote}>
                <Feather name="check" size={16} color="#FFFDFA" />
                <Text style={styles.modalConfirmBtnText}>{loteModo === 'assar' ? 'Assar' : 'Preparar'}</Text>
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
const styles = paraCelular(StyleSheet.create({
  // ENCOMENDAS A PRODUZIR
  kpiCardSelected: {
    borderColor: KIPI_BLUE_ACCENT,
    borderWidth: 1.5,
  },
  ordersPanel: {
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D6D7F3',
    marginBottom: 16,
  },
  ordersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  orderCard: {
    flexGrow: 1,
    flexBasis: 220,
    backgroundColor: KIPI_FROST_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    padding: 12,
    gap: 4,
  },
  orderCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderClient: {
    flex: 1,
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
  },
  orderStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orderStatusText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
  },
  orderItems: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#3D312A',
  },
  orderObs: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontStyle: 'italic',
    color: '#6B615A',
  },
  orderDelivery: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
    marginTop: 2,
  },
  orderNextBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: KIPI_BLUE_TINT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  orderNextBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },
  orderAguardando: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: SUCCESS_GREEN,
    marginTop: 8,
  },

  // HISTÓRICO COM FILTROS
  historyFilters: {
    gap: 8,
    marginBottom: 12,
  },
  historyChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  historyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FFFDFA',
  },
  historyChipActive: {
    backgroundColor: KIPI_BLUE_TINT,
    borderColor: KIPI_BLUE,
  },
  historyChipText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#6B615A',
  },
  historyChipTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '800',
  },
  historyDayTitle: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '800',
    color: KIPI_BLUE_DARK,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  historyEmpty: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#9A8F87',
    textAlign: 'center',
    paddingVertical: 20,
  },
  historyMoreBtn: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FFFDFA',
    marginBottom: 10,
  },
  historyMoreBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },
  // PERDA / DESCARTE
  cardBtnPerda: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3C4BD',
    backgroundColor: '#FBE7E4',
  },
  cardBtnPerdaText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: DANGER_RED,
  },
  historyDotLoss: {
    backgroundColor: DANGER_RED,
  },
  badgeLoss: {
    backgroundColor: DANGER_TINT,
  },
  badgeLossText: {
    color: DANGER_RED,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FFFDFA',
  },
  chipActive: {
    borderColor: DANGER_RED,
    backgroundColor: DANGER_TINT,
  },
  chipText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B615A',
  },
  chipTextActive: {
    color: DANGER_RED,
    fontWeight: '800',
  },
  obsInput: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#2E211A',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },

  // PREPARO: DESCONTO OPCIONAL DE INGREDIENTES
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  toggleBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#D9CFC4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDFA',
  },
  toggleBoxActive: {
    backgroundColor: KIPI_BLUE_ACCENT,
    borderColor: KIPI_BLUE_ACCENT,
  },
  ingredientWarning: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: WARNING_AMBER,
    marginTop: 6,
  },
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
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnAcaoPreparo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDFA',
    borderWidth: 1.5,
    borderColor: '#D6D7F3',
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
  btnAcaoDescarte: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDFA',
    borderWidth: 1,
    borderColor: '#F3C4BD',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  btnAcaoDescarteText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: DANGER_RED,
  },
  btnAcaoAssar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OVEN_ORANGE,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    boxShadow: '0 2px 8px rgba(185, 120, 26, 0.35)',
  },
  btnAcaoAssarText: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFDFA',
  },

  // BANNER FORNO ATIVO
  ovenActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF0DC',
    borderWidth: 1.5,
    borderColor: '#F2DDB0',
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
    backgroundColor: '#FFFDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovenTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: '#9A6516',
  },
  ovenBadge: {
    backgroundColor: '#B9781A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ovenBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFDFA',
  },
  ovenSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#9A6516',
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
    color: '#FFFDFA',
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
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
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
    fontSize: 22,
    fontWeight: '800',
    color: '#2E211A',
    marginBottom: 3,
  },
  kpiSubtext: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#9A8F87',
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
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
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
    color: '#2E211A',
  },
  sectionSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#6B615A',
  },
  miniSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDFA',
    borderWidth: 1,
    borderColor: '#E8E0D6',
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
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    marginBottom: 12,
  },
  loteLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE7',
  },
  loteStepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },  loteStepBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: '#E8E0D6', backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  loteInput: {
    width: 48,
    textAlign: 'center',
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '800',
    color: '#2E211A',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 8,
    paddingVertical: 6,
    backgroundColor: '#F8F6F2',
  },
  productionCardCompacto: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  prodLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  prodAvatarMini: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodNumero: {
    minWidth: 62,
    alignItems: 'flex-end',
  },
  kpiStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFDFA',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  kpiStripItem: {
    flexGrow: 1,
    minWidth: 110,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#F3EEE7',
  },
  kpiStripClicavel: {
    borderRadius: 8,
  },
  kpiStripAtivo: {
    backgroundColor: KIPI_BLUE_TINT,
  },
  kpiStripLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#6B615A',
  },
  kpiStripValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
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
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodCategory: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#6B615A',
    marginBottom: 2,
  },
  prodName: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '700',
    color: '#2E211A',
  },
  prodOvenTime: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#9A8F87',
    marginTop: 2,
  },

  // DUAS BARRAS DE ESTOQUE
  stockBarsContainer: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F8F6F2',
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
    color: '#4A3E37',
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
    backgroundColor: '#ECEBFA',
    borderWidth: 1,
    borderColor: '#D6D7F3',
    paddingVertical: 5,
    borderRadius: 10,
    gap: 6,
  },
  cardBtnPreparoText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: FREEZER_CYAN,
  },
  cardBtnAssar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF0DC',
    borderWidth: 1,
    borderColor: '#F2DDB0',
    paddingVertical: 5,
    borderRadius: 10,
    gap: 6,
  },
  cardBtnAssarDisabled: {
    backgroundColor: '#F3EEE7',
    borderColor: '#E8E0D6',
  },
  cardBtnAssarText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: OVEN_ORANGE,
  },
  cardBtnAssarTextDisabled: {
    color: '#9A8F87',
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
    color: '#6B615A',
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
    backgroundColor: '#F8F6F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F3EEE7',
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
    color: '#2E211A',
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
    color: '#6B615A',
  },
  historyAuthor: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#9A8F87',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // MODAIS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 36, 33, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#FFFDFA',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE7',
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
    color: '#2E211A',
  },
  modalSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#6B615A',
    marginTop: 2,
  },
  modalBody: {
    gap: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBE7E4',
    borderWidth: 1,
    borderColor: '#F3C4BD',
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
    color: '#4A3E37',
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
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  stepperInput: {
    width: 90,
    height: 42,
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    textAlign: 'center',
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '800',
    color: '#2E211A',
  },
  checklistCard: {
    backgroundColor: '#F8F6F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  checklistTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: '#2E211A',
  },
  checklistSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#6B615A',
  },
  checkItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE7',
  },
  checkItemName: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#3D312A',
  },
  checkItemAmount: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#2E211A',
  },
  checkItemStock: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#9A8F87',
  },
  freezerNoticeBox: {
    backgroundColor: FREEZER_TINT,
    borderWidth: 1,
    borderColor: '#D6D7F3',
    borderRadius: 10,
    padding: 12,
  },
  freezerNoticeText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#3A3D9E',
  },
  previewResultBox: {
    backgroundColor: '#F8F6F2',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    gap: 4,
  },
  previewResultLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#4A3E37',
    marginBottom: 2,
  },
  previewResultText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#3D312A',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3EEE7',
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
    color: '#6B615A',
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
    backgroundColor: '#D9CFC4',
  },
  modalConfirmBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFDFA',
  },
}));
