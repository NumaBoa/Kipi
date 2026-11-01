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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KipiPalette, Fonts } from '@/constants/theme';
import NovoPedidoModal from '@/components/NovoPedidoModal';
import Sidebar from '@/components/Sidebar';
import { PageHeaderTitulo } from '@/components/PageHeader';
import { useConfigLoja } from '@/lib/configuracoes';
import { useEscopoRevendedora, pedidosDoEscopo } from '@/lib/minhaRevenda';
import { useEstoqueVitrine, custoUnitarioProduto, produtoAtivo } from '@/lib/estoqueVitrine';
import {
  usePedidos,
  useClientes,
  atualizarPedido as salvarPedidoNaLista,
  cancelarPedido,
  chaveDoDia,
  pedidoBaixouEstoque,
  mensagemWhatsAppDoPedido,
  type Pedido,
  type PedidoItem,
} from '@/lib/clientesPedidos';

// ============================================================================
// TIPOS E MODELOS
// ============================================================================

export type Periodo = 'hoje' | '7dias' | 'mes' | 'personalizar';
export type TipoPedido = 'todos' | 'pronta_entrega' | 'sob_encomenda';
export type StatusPagamento = 'todos' | 'pendentes' | 'pagos';

export interface EstoqueItem {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  estoqueMinimo: number;
  status: 'normal' | 'baixo' | 'zerado';
}

// STATUS DE PRODUÇÃO (ORDEM DO FLUXO DA COZINHA)
type StatusProducao = Pedido['statusProducao'];
const STATUS_PRODUCAO: { id: StatusProducao; label: string; cor: string; fundo: string; icon: 'circle' | 'loader' | 'package' | 'check-circle' }[] = [
  { id: 'a_fazer', label: 'A fazer', cor: '#64748B', fundo: '#F1F5F9', icon: 'circle' },
  { id: 'em_producao', label: 'Em produção', cor: '#B45309', fundo: '#FEF3C7', icon: 'loader' },
  { id: 'pronto', label: 'Pronto p/ retirada', cor: '#2563EB', fundo: '#EAF3FA', icon: 'package' },
  { id: 'entregue', label: 'Entregue', cor: '#16A34A', fundo: '#DCFCE7', icon: 'check-circle' },
];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const infoStatusProducao =(s: StatusProducao) => STATUS_PRODUCAO.find((x) => x.id === s) || STATUS_PRODUCAO[0];

const FORMAS_PAGAMENTO_PEDIDO: { id: Pedido['formaPagamento']; label: string; icon: string }[] = [
  { id: 'pix', label: 'Pix', icon: 'zap' },
  { id: 'cartao_credito', label: 'Crédito', icon: 'credit-card' },
  { id: 'cartao_debito', label: 'Débito', icon: 'credit-card' },
  { id: 'dinheiro', label: 'Dinheiro', icon: 'dollar-sign' },
  { id: 'pendente', label: 'Pendente', icon: 'clock' },
];

export default function PedidosScreen() {
  const router = useRouter();
  // Nome da loja e chave PIX da mensagem de WhatsApp vêm de Configurações
  const { config } = useConfigLoja();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // SIDEBAR RETRÁTIL / EXPANSÍVEL (IDÊNTICO À VISÃO GERAL)
  const [menuHovered, setMenuHovered] = useState(false);
  const [menuPinned, setMenuPinned] = useState(true);
  const menuExpanded = isDesktop ? (menuPinned || menuHovered) : false;

  // ESTADOS DE DADOS
  // Pedidos compartilhados: criar, editar ou cancelar aqui reflete em Clientes, Produção e Visão Geral
  // Revendedora vê só os pedidos que ela lançou; o estoque é o que está com ela
  const escopo = useEscopoRevendedora();
  const pedidos = pedidosDoEscopo(usePedidos(), escopo.revendedoraId);
  const clientes = useClientes();
  // Tag do cadastro do cliente (ex.: "Bloco 1 AP 807"): diferencia clientes com o mesmo nome
  const tagDoCliente = (p: Pedido) => (p.clienteId ? clientes.find((c) => c.id === p.clienteId)?.tag || null : null);
  const vitrine = useEstoqueVitrine();
  const estoque = useMemo<EstoqueItem[]>(
    () =>
      escopo.ehRevendedora
        ? // Revendedora: o que o ateliê entregou para ela e ela ainda não vendeu
          escopo.sabores.map((x) => {
            const v = vitrine.find((p) => p.id === x.produtoId);
            return {
              id: x.produtoId || x.nome,
              nome: x.nome,
              categoria: v?.categoria ?? 'Revenda',
              preco: v?.preco ?? 0,
              estoque: x.saldo,
              estoqueMinimo: escopo.minimoPorSabor,
              status: x.status === 'esgotado' ? 'zerado' : x.status === 'baixo' ? 'baixo' : 'normal',
            };
          })
        : vitrine.filter(produtoAtivo).map((p) => ({
            id: p.id,
            nome: p.nome,
            categoria: p.categoria,
            preco: p.preco,
            estoque: p.estoque,
            estoqueMinimo: p.estoqueMinimo,
            status: p.estoque === 0 ? 'zerado' : p.estoque <= p.estoqueMinimo ? 'baixo' : 'normal',
          })),
    [vitrine, escopo.ehRevendedora, escopo.sabores, escopo.minimoPorSabor]
  );

  // FILTROS (MESMA LÓGICA E DESIGN SYSTEM DA VISÃO GERAL)
  const [periodo, setPeriodo] = useState<Periodo>('7dias');
  const [filtroTipo, setFiltroTipo] = useState<TipoPedido>('todos');
  const [filtroPagamento, setFiltroPagamento] = useState<StatusPagamento>('todos');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const filtrosAtivos = [filtroTipo !== 'todos', filtroPagamento !== 'todos', filtroVendedor !== 'todos'].filter(Boolean).length;

  // FILTRO PERSONALIZADO DE DATAS
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState('2026-10-01');
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState('2026-10-31');

  // PEDIDO SELECIONADO PARA DETALHES (EXIBIDO NA COLUNA LATERAL)
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);

  // MODAIS
  const [modalNovoPedidoAberto, setModalNovoPedidoAberto] = useState(false);
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false);
  const [pedidoParaBaixa, setPedidoParaBaixa] = useState<Pedido | null>(null);
  const [baixaFormaPagamento, setBaixaFormaPagamento] = useState<'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'>('pix');
  const [baixaValor, setBaixaValor] = useState('');

  const [modalAReceberAberto, setModalAReceberAberto] = useState(false);
  const [modalEstoqueAberto, setModalEstoqueAberto] = useState(false);
  const [buscaEstoque, setBuscaEstoque] = useState('');
  const [categoriaEstoque, setCategoriaEstoque] = useState('Todas');

  // PEDIDO EM EDIÇÃO (abre o mesmo modal do Novo Pedido)
  const [pedidoEmEdicao, setPedidoEmEdicao] = useState<Pedido | null>(null);

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [pedidoParaExcluir, setPedidoParaExcluir] = useState<Pedido | null>(null);

  // TOAST FEEDBACK
  const [toastSucesso, setToastSucesso] = useState<string | null>(null);
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);

  const exibirToast = (msg: string) => {
    setToastSucesso(msg);
    setTimeout(() => setToastSucesso(null), 3000);
  };

  // NAVEGAÇÃO LATERAL (IDÊNTICA À VISÃO GERAL)
  const navItems = [
    { id: 'visao-geral', label: 'Visão Geral', icon: 'grid', active: false, route: '/visao-geral' },
    { id: 'pedidos', label: 'Pedidos & Vendas', icon: 'shopping-bag', active: true, route: '/pedidos' },
    { id: 'encomendas', label: 'Encomendas & Cozinha', icon: 'coffee', active: false, route: '/pedidos' },
    { id: 'estoque', label: 'Estoque & Insumos', icon: 'package', active: false },
    { id: 'fichas', label: 'Fichas Técnicas', icon: 'book-open', active: false },
    { id: 'revendedoras', label: 'Revendedoras & Pontos', icon: 'map-pin', active: false },
    { id: 'clientes', label: 'Clientes & Vendas', icon: 'users', active: false },
    { id: 'financeiro', label: 'Fluxo de Caixa', icon: 'dollar-sign', active: false },
    { id: 'config', label: 'Configurações', icon: 'settings', active: false },
  ];

  const usuario = {
    nome: 'Camila Lima',
    papel: 'PROPRIETÁRIA',
    email: 'camila.c.lima08@gmail.com',
  };

  const dataExtenso = useMemo(() => {
    const hoje = new Date();
    const str = hoje.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, []);

  // FILTRAGEM DOS PEDIDOS
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (p.deletado) return false;

      // Tipo de Pedido
      if (filtroTipo !== 'todos' && p.tipoPedido !== filtroTipo) return false;

      // Status Pagamento
      if (filtroPagamento === 'pendentes' && p.status !== 'pendente') return false;
      if (filtroPagamento === 'pagos' && p.status !== 'pago') return false;

      // Vendedor
      if (filtroVendedor !== 'todos') {
        if (!p.vendedor.toLowerCase().includes(filtroVendedor.toLowerCase())) return false;
      }

      // Período
      const hoje = new Date();
      if (periodo === 'hoje') {
        if (p.diaChave !== chaveDoDia(hoje)) return false;
      } else if (periodo === '7dias') {
        const inicio = chaveDoDia(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6));
        if (p.diaChave < inicio) return false;
      } else if (periodo === 'mes') {
        if (!p.diaChave.startsWith(chaveDoDia(hoje).slice(0, 7))) return false;
      } else if (periodo === 'personalizar') {
        if (p.diaChave < dataInicioPersonalizada || p.diaChave > dataFimPersonalizada) return false;
      }

      return true;
    });
  }, [pedidos, filtroTipo, filtroPagamento, filtroVendedor, periodo, dataInicioPersonalizada, dataFimPersonalizada]);

  // AGRUPAMENTO DE PEDIDOS POR DIA (EX: SÁBADO 17/10)
  const pedidosAgrupadosPorDia = useMemo(() => {
    const mapa = new Map<string, { diaChave: string; diaTitulo: string; pedidos: Pedido[]; totalDia: number; pendentesDia: number }>();

    pedidosFiltrados.forEach((p) => {
      const chave = p.diaChave;
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          diaChave: chave,
          diaTitulo: p.diaTitulo,
          pedidos: [],
          totalDia: 0,
          pendentesDia: 0,
        });
      }
      const grp = mapa.get(chave)!;
      grp.pedidos.push(p);
      grp.totalDia += p.total;
      if (p.status === 'pendente') {
        grp.pendentesDia += 1;
      }
    });

    return Array.from(mapa.values()).sort((a, b) => b.diaChave.localeCompare(a.diaChave));
  }, [pedidosFiltrados]);

  // KPIS CALCULADOS
  const kpis = useMemo(() => {
    let totalVendido = 0;
    let totalItens = 0;
    let totalAReceber = 0;
    let qtdPendentes = 0;

    pedidosFiltrados.forEach((p) => {
      totalVendido += p.total;
      p.itens.forEach((it) => {
        totalItens += it.quantidade;
      });
      if (p.status === 'pendente') {
        totalAReceber += (p.saldoNaEntrega > 0 ? p.saldoNaEntrega : p.total);
        qtdPendentes += 1;
      }
    });

    const totalEstoque = estoque.reduce((acc, curr) => acc + curr.estoque, 0);
    const produtosEstoqueBaixo = estoque.filter((p) => p.status === 'baixo' || p.status === 'zerado').length;

    return {
      totalVendido: `R$ ${totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      totalItens: `${totalItens} un.`,
      mediaItensPorPedido: (totalItens / Math.max(1, pedidosFiltrados.length)).toFixed(1),
      totalAReceber: `R$ ${totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      qtdPendentes,
      totalEstoque: `${totalEstoque} un.`,
      produtosEstoqueBaixo,
      // Revendedora: comissão dos pedidos filtrados (item em promoção paga metade)
      comissao: `R$ ${pedidosFiltrados.filter((p) => !p.deletado).reduce((acc, p) => acc + escopo.comissaoDoPedido(p), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    };
  }, [pedidosFiltrados, estoque, escopo]);

  // TOP 3 PRODUTOS
  const top3Produtos = useMemo(() => {
    const mapa = new Map<string, { nome: string; categoria: string; qtd: number; faturamento: number }>();
    pedidos.forEach((p) => {
      if (p.deletado) return;
      p.itens.forEach((it) => {
        if (!mapa.has(it.nome)) {
          mapa.set(it.nome, { nome: it.nome, categoria: it.categoria, qtd: 0, faturamento: 0 });
        }
        const item = mapa.get(it.nome)!;
        item.qtd += it.quantidade;
        item.faturamento += it.totalItem;
      });
    });
    return Array.from(mapa.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 3);
  }, [pedidos]);

  // TOP 3 CLIENTES
  // Agrupa pelo cadastro (há clientes diferentes com o mesmo nome); a tag ajuda a distinguir
  const top3Clientes = useMemo(() => {
    const mapa = new Map<string, { chave: string; nome: string; tag: string | null; qtdItens: number; totalGasto: number; pedidosCount: number }>();
    pedidos.forEach((p) => {
      if (p.deletado || p.clienteNome.toLowerCase().includes('venda avulsa')) return;
      const chave = p.clienteId ?? `nome:${p.clienteNome.toLowerCase()}`;
      if (!mapa.has(chave)) {
        const tag = p.clienteId ? clientes.find((c) => c.id === p.clienteId)?.tag ?? null : null;
        mapa.set(chave, { chave, nome: p.clienteNome, tag, qtdItens: 0, totalGasto: 0, pedidosCount: 0 });
      }
      const cli = mapa.get(chave)!;
      cli.pedidosCount += 1;
      cli.totalGasto += p.total;
      p.itens.forEach((it) => {
        cli.qtdItens += it.quantidade;
      });
    });
    return Array.from(mapa.values()).sort((a, b) => b.qtdItens - a.qtdItens).slice(0, 3);
  }, [pedidos, clientes]);

  // AÇÕES
  const abrirModalBaixa = (pedido: Pedido) => {
    setPedidoParaBaixa(pedido);
    setBaixaValor((pedido.saldoNaEntrega > 0 ? pedido.saldoNaEntrega : pedido.total).toFixed(2).replace('.', ','));
    setBaixaFormaPagamento('pix');
    setModalBaixaAberto(true);
  };

  // Recebimento parcial soma ao já pago; só quita quando cobre o saldo
  const confirmarBaixa = () => {
    if (!pedidoParaBaixa) return;
    const atual = pedidos.find((p) => p.id === pedidoParaBaixa.id) || pedidoParaBaixa;
    const recebido = parseFloat(baixaValor.replace(',', '.')) || 0;
    if (recebido <= 0) {
      exibirToast('Informe o valor recebido.');
      return;
    }
    const pago = Math.min(atual.valorSinalPago + recebido, atual.total);
    const quitado = pago >= atual.total - 0.005;
    atualizarPedido({
      ...atual,
      status: quitado ? 'pago' : 'pendente',
      formaPagamento: baixaFormaPagamento,
      valorSinalPago: pago,
      saldoNaEntrega: quitado ? 0 : atual.total - pago,
    });

    setModalBaixaAberto(false);
    exibirToast(
      quitado
        ? `✓ Pedido ${pedidoParaBaixa.codigoDisplay} quitado!`
        : `✓ Recebido ${brl(recebido)} de ${pedidoParaBaixa.codigoDisplay} · faltam ${brl(atual.total - pago)}`
    );
    setPedidoParaBaixa(null);
  };

  // Mesma mensagem da tela de sucesso do Novo Pedido
  const gerarTextoWhatsApp = (pedido: Pedido): string => mensagemWhatsAppDoPedido(pedido, config);

  const copiarWhatsApp = (pedido: Pedido) => {
    const texto = gerarTextoWhatsApp(pedido);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(texto);
    }
    setCopiadoFeedback(true);
    exibirToast('📋 Mensagem formatada copiada para o WhatsApp!');
    setTimeout(() => setCopiadoFeedback(false), 2000);
  };

  const abrirWhatsAppWeb = (pedido: Pedido) => {
    const texto = encodeURIComponent(gerarTextoWhatsApp(pedido));
    const tel = pedido.clienteTelefone ? pedido.clienteTelefone.replace(/\D/g, '') : '';
    const url = tel ? `https://wa.me/55${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const confirmarExclusao = () => {
    if (!pedidoParaExcluir) return;
    // Os itens do pedido cancelado voltam para o estoque da vitrine
    cancelarPedido(pedidoParaExcluir.id);
    if (pedidoSelecionado?.id === pedidoParaExcluir.id) {
      setPedidoSelecionado(null);
    }
    setModalExcluirAberto(false);
    exibirToast(
      `🗑 Pedido ${pedidoParaExcluir.codigoDisplay} cancelado.${pedidoBaixouEstoque(pedidoParaExcluir) ? ' Os itens voltaram ao estoque.' : ''}`
    );
    setPedidoParaExcluir(null);
  };

  // CUSTO PELA FICHA TÉCNICA (o mesmo cálculo do sistema antigo)
  const custoDoItem = (it: PedidoItem) => it.custoUnitario ?? custoUnitarioProduto({ produtoId: it.produtoId, nome: it.nome, quantidade: 0 });
  const custoDoPedido = (p: Pedido) => p.custoTotal ?? p.itens.reduce((acc, it) => acc + it.quantidade * custoDoItem(it), 0);

  // Aplica uma alteração ao pedido na lista e no painel de detalhes
  const atualizarPedido = (atualizado: Pedido) => {
    salvarPedidoNaLista(atualizado);
    if (pedidoSelecionado?.id === atualizado.id) setPedidoSelecionado(atualizado);
  };

  const avancarStatusProducao = (pedido: Pedido) => {
    const idx = STATUS_PRODUCAO.findIndex((s) => s.id === pedido.statusProducao);
    if (idx >= STATUS_PRODUCAO.length - 1) return;
    const proximo = STATUS_PRODUCAO[idx + 1];
    atualizarPedido({ ...pedido, statusProducao: proximo.id });
    exibirToast(`${pedido.codigoDisplay} agora está: ${proximo.label}`);
  };

  // Editar abre o mesmo modal do Novo Pedido, já preenchido
  const abrirEdicao = (pedido: Pedido) => {
    setPedidoEmEdicao(pedido);
    setModalNovoPedidoAberto(true);
  };

  // O modal já registra/atualiza na lista compartilhada e mexe na vitrine; aqui só avisa
  const lidarComPedidoCriado = (pedido: Pedido) => {
    if (pedidoEmEdicao?.id === pedido.id) {
      if (pedidoSelecionado?.id === pedido.id) setPedidoSelecionado(pedido);
      exibirToast(`✓ Pedido ${pedido.codigoDisplay} atualizado!`);
      return;
    }
    exibirToast(`🎉 Pedido ${pedido.codigoDisplay} registrado com sucesso!`);
  };
  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.mainLayout}>

        {/* =========================================================================
            MENU LATERAL MODULAR E ORGANIZADO POR GRUPOS
        ========================================================================== */}
        <Sidebar
          activeRoute="/pedidos"
          onNotice={(msg) => exibirToast(msg)}
        />

        {/* =========================================================================
            ÁREA DE CONTEÚDO PRINCIPAL (DASHBOARD COM OS MESMOS COMPONENTES)
        ========================================================================== */}
        <View style={styles.contentArea}>

          {/* SCROLL DO CONTEÚDO PRINCIPAL */}
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>

            {/* 1. CABEÇALHO PADRÃO DO SISTEMA */}
            <View style={styles.pageHeader}>
              <PageHeaderTitulo
                etiqueta={escopo.ehRevendedora ? "REVENDA · MEUS PEDIDOS" : "ATELIÊ · PEDIDOS & VENDAS"}
                titulo="Pedidos"
                subtitulo={escopo.ehRevendedora ? "Suas vendas, com o estoque que está com você: recebimentos, WhatsApp e comissão." : "Histórico por data, recebimentos, WhatsApp e baixa ágil."}
              />

              {kpis.qtdPendentes > 0 && (
                <TouchableOpacity
                  style={styles.pageHeaderAlertBtn}
                  onPress={() => setModalAReceberAberto(true)}
                  activeOpacity={0.8}>
                  <Feather name="clock" size={15} color="#DC2626" />
                  <Text style={styles.pageHeaderAlertText}>
                    {kpis.qtdPendentes} {kpis.qtdPendentes === 1 ? 'pedido aguarda' : 'pedidos aguardam'} baixa!
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 2. TOPO: PERÍODO + FILTROS (DROPDOWN) À ESQUERDA; DATA + NOVO PEDIDO À DIREITA */}
            <View style={[styles.filtersBar, { zIndex: 50 }]}>
              <View style={styles.filtrosEsq}>
                <View style={styles.periodTabs}>
                  {(['hoje', '7dias', 'mes', 'personalizar'] as Periodo[]).map((p) => {
                    const labels = { hoje: 'Hoje', '7dias': '7 dias', mes: 'Mês', personalizar: 'Personalizar' };
                    const active = periodo === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.periodTab, active && styles.periodTabActive]}
                        onPress={() => setPeriodo(p)}
                        activeOpacity={0.8}>
                        <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>{labels[p]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Tipo, pagamento e vendedor ficam num só botão (revendedora vê só pagamento) */}
                <View>
                  <TouchableOpacity
                    style={[styles.filtrosBtn, (filtrosAbertos || filtrosAtivos > 0) && styles.filtrosBtnAtivo]}
                    onPress={() => setFiltrosAbertos((v) => !v)}
                    activeOpacity={0.85}>
                    <Feather name="sliders" size={14} color={filtrosAtivos > 0 ? KipiPalette.icedDenim : '#475569'} />
                    <Text style={[styles.filtrosBtnTexto, filtrosAtivos > 0 && { color: KipiPalette.icedDenim }]}>Filtros</Text>
                    {filtrosAtivos > 0 && (
                      <View style={styles.filtrosBadge}>
                        <Text style={styles.filtrosBadgeTexto}>{filtrosAtivos}</Text>
                      </View>
                    )}
                    <Feather name={filtrosAbertos ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
                  </TouchableOpacity>

                  {filtrosAbertos && (
                    <View style={styles.filtrosMenu}>
                      {!escopo.ehRevendedora && (
                        <View>
                          <Text style={styles.filtrosGrupoLabel}>TIPO</Text>
                          <View style={styles.mdChips}>
                            {[
                              { id: 'todos', label: 'Todos' },
                              { id: 'pronta_entrega', label: 'Pronta entrega' },
                              { id: 'sob_encomenda', label: 'Sob encomenda' },
                            ].map((t) => {
                              const ativo = filtroTipo === t.id;
                              return (
                                <TouchableOpacity key={t.id} style={[styles.mdChip, ativo && styles.mdChipAtivo]} onPress={() => setFiltroTipo(t.id as TipoPedido)}>
                                  <Text style={[styles.mdChipTexto, ativo && { color: '#FFFFFF', fontWeight: '800' }]}>{t.label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      <View>
                        <Text style={styles.filtrosGrupoLabel}>PAGAMENTO</Text>
                        <View style={styles.mdChips}>
                          {[
                            { id: 'todos', label: 'Todos' },
                            { id: 'pendentes', label: 'Pendentes' },
                            { id: 'pagos', label: 'Pagos' },
                          ].map((p) => {
                            const ativo = filtroPagamento === p.id;
                            return (
                              <TouchableOpacity key={p.id} style={[styles.mdChip, ativo && styles.mdChipAtivo]} onPress={() => setFiltroPagamento(p.id as StatusPagamento)}>
                                <Text style={[styles.mdChipTexto, ativo && { color: '#FFFFFF', fontWeight: '800' }]}>{p.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {!escopo.ehRevendedora && (
                        <View>
                          <Text style={styles.filtrosGrupoLabel}>VENDEDOR</Text>
                          <View style={styles.mdChips}>
                            {[
                              { id: 'todos', label: 'Todos' },
                              { id: 'Camila Lima', label: 'Camila Lima' },
                              { id: 'Juliana Carvalho', label: 'Juliana Carvalho' },
                              { id: 'Sofia Ramos', label: 'Sofia Ramos' },
                              { id: 'Café & Flor', label: 'Café & Flor' },
                            ].map((v) => {
                              const ativo = filtroVendedor === v.id;
                              return (
                                <TouchableOpacity key={v.id} style={[styles.mdChip, ativo && styles.mdChipAtivo]} onPress={() => setFiltroVendedor(v.id)}>
                                  <Text style={[styles.mdChipTexto, ativo && { color: '#FFFFFF', fontWeight: '800' }]}>{v.label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      <View style={styles.filtrosRodape}>
                        <TouchableOpacity
                          onPress={() => {
                            setFiltroTipo('todos');
                            setFiltroPagamento('todos');
                            setFiltroVendedor('todos');
                          }}>
                          <Text style={[styles.mdLink, { marginBottom: 0, color: '#64748B' }]}>Limpar filtros</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.mdBtnPri, { paddingVertical: 7 }]} onPress={() => setFiltrosAbertos(false)}>
                          <Text style={styles.mdBtnPriTexto}>Pronto</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.filtrosDir}>
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

            {/* SE FILTRO PERSONALIZADO ABERTO */}
            {periodo === 'personalizar' && (
              <View style={styles.customDateBar}>
                <View style={styles.customDateItem}>
                  <Text style={styles.customDateLabel}>De:</Text>
                  <TextInput
                    style={styles.customDateInput}
                    value={dataInicioPersonalizada}
                    onChangeText={setDataInicioPersonalizada}
                    placeholder="AAAA-MM-DD"
                  />
                </View>
                <View style={styles.customDateItem}>
                  <Text style={styles.customDateLabel}>Até:</Text>
                  <TextInput
                    style={styles.customDateInput}
                    value={dataFimPersonalizada}
                    onChangeText={setDataFimPersonalizada}
                    placeholder="AAAA-MM-DD"
                  />
                </View>
                <Text style={styles.customDateInfo}>
                  Consultando pedidos entre {dataInicioPersonalizada} e {dataFimPersonalizada}
                </Text>
              </View>
            )}

            {/* 3. CARDS DE KPIS EM LINHA (IDÊNTICOS AOS DA VISÃO GERAL) */}
            <View style={styles.kpiRow}>

              {/* 1. TOTAL VENDIDO */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>TOTAL VENDIDO</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#F1F6D8' }]}>
                    <Feather name="dollar-sign" size={15} color="#708018" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.totalVendido}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillGreen}>
                    <Text style={styles.kpiDiffPillGreenText}>+18% vs anterior</Text>
                  </View>
                  <Text style={styles.kpiFooterNote}>Faturamento acumulado</Text>
                </View>
              </View>

              {/* 2. TOTAL DE ITENS VENDIDOS */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>{escopo.ehRevendedora ? 'MINHA COMISSÃO' : 'ITENS VENDIDOS'}</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#EAF3FA' }]}>
                    <Feather name="shopping-bag" size={15} color="#5798D7" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{escopo.ehRevendedora ? kpis.comissao : kpis.totalItens}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillBlue}>
                    <Text style={styles.kpiDiffPillBlueText}>{escopo.ehRevendedora ? `${kpis.totalItens} vendidos` : `Média ${kpis.mediaItensPorPedido}/ped`}</Text>
                  </View>
                  <Text style={styles.kpiFooterNote}>{escopo.ehRevendedora ? 'Pelas vendas do período' : 'Volume de produção'}</Text>
                </View>
              </View>

              {/* 3. A RECEBER (CLICÁVEL ↗ ABRE MODAL DE PENDÊNCIAS) */}
              <TouchableOpacity
                style={[styles.kpiCard, styles.kpiCardClickable]}
                onPress={() => setModalAReceberAberto(true)}
                activeOpacity={0.8}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>A RECEBER (CLIQUE ↗)</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <Feather name="clock" size={15} color="#D97706" />
                  </View>
                </View>
                <Text style={[styles.kpiMainNumber, { color: '#DC2626' }]}>
                  {kpis.totalAReceber}
                </Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillYellow}>
                    <Text style={styles.kpiDiffPillYellowText}>{kpis.qtdPendentes} pendentes</Text>
                  </View>
                  <Text style={[styles.kpiFooterNote, { color: KipiPalette.icedDenim, fontWeight: '700' }]}>
                    Ver clientes devedores ↗
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 4. ESTOQUE (CLICÁVEL ↗ ABRE MODAL DE ESTOQUE) */}
              <TouchableOpacity
                style={[styles.kpiCard, styles.kpiCardClickable]}
                onPress={() => setModalEstoqueAberto(true)}
                activeOpacity={0.8}>
                <View style={styles.kpiCardHeader}>
                  <Text style={styles.kpiLabel}>{escopo.ehRevendedora ? 'ESTOQUE COMIGO (CLIQUE ↗)' : 'ESTOQUE GERAL (CLIQUE ↗)'}</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#E0F2FE' }]}>
                    <Feather name="package" size={15} color="#0284C7" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.totalEstoque}</Text>
                <View style={styles.kpiFooter}>
                  <View style={[styles.kpiDiffPillBlue, { backgroundColor: '#E0F2FE' }]}>
                    <Text style={[styles.kpiDiffPillBlueText, { color: '#0284C7' }]}>
                      {kpis.produtosEstoqueBaixo} baixos
                    </Text>
                  </View>
                  <Text style={[styles.kpiFooterNote, { color: KipiPalette.icedDenim, fontWeight: '700' }]}>
                    Consultar cardápio ↗
                  </Text>
                </View>
              </TouchableOpacity>

            </View>

            {/* 4. GRID PRINCIPAL (COLUNA PRINCIPAL + COLUNA LATERAL IDÊNTICO À VISÃO GERAL) */}
            <View style={styles.dashboardGrid}>

              {/* =====================================================================
                  COLUNA PRINCIPAL: HISTÓRICO DE PEDIDOS SEPARADO POR DIA
              ====================================================================== */}
              <View style={styles.gridMainCol}>
                {pedidosAgrupadosPorDia.length === 0 ? (
                  <View style={styles.panelCard}>
                    <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
                      <Feather name="inbox" size={38} color="#94A3B8" />
                      <Text style={styles.panelTitle}>Nenhum pedido encontrado</Text>
                      <Text style={styles.panelSubtitle}>
                        Ajuste os filtros de período ou busca para visualizar os registros.
                      </Text>
                    </View>
                  </View>
                ) : (
                  pedidosAgrupadosPorDia.map((grupo) => (
                    <View key={grupo.diaChave} style={styles.panelCard}>

                      {/* CABEÇALHO DO DIA (MESMO PADRÃO PANELHEADER DA VISÃO GERAL) */}
                      <View style={styles.panelHeader}>
                        <View style={styles.panelTitleRow}>
                          <View style={styles.sectionDot} />
                          <Text style={styles.panelTitle}>{grupo.diaTitulo}</Text>
                          <View style={styles.panelChip}>
                            <Text style={styles.panelChipText}>
                              {grupo.pedidos.length} {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                            Total: R$ {grupo.totalDia.toFixed(2)}
                          </Text>
                          {grupo.pendentesDia > 0 && (
                            <View style={[styles.panelChip, { backgroundColor: '#FEE2E2' }]}>
                              <Text style={[styles.panelChipText, { color: '#DC2626' }]}>
                                {grupo.pendentesDia} pendente
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* LISTA DE PEDIDOS DO DIA */}
                      <View style={styles.ordersListBlock}>
                        {grupo.pedidos.map((ped) => {
                          const isSelected = pedidoSelecionado?.id === ped.id;

                          return (
                            <View
                              key={ped.id}
                              style={[
                                styles.orderRowCard,
                                isSelected && styles.orderRowCardSelected,
                              ]}>

                              {/* LINHA SUPERIOR DO PEDIDO */}
                              <View style={styles.orderRowTop}>
                                <View style={styles.orderCodeBadgeRow}>
                                  <Text style={styles.orderCodeText}>{ped.codigoDisplay}</Text>
                                  <View
                                    style={[
                                      styles.orderTypeBadge,
                                      ped.tipoPedido === 'sob_encomenda'
                                        ? { backgroundColor: '#FEF3C7' }
                                        : { backgroundColor: '#EAF3FA' },
                                    ]}>
                                    <Text
                                      style={[
                                        styles.orderTypeBadgeText,
                                        ped.tipoPedido === 'sob_encomenda'
                                          ? { color: '#B45309' }
                                          : { color: KipiPalette.icedDenim },
                                      ]}>
                                      {ped.revendedoraId ? '🤝 Revenda' : ped.tipoPedido === 'sob_encomenda' ? 'Sob Encomenda' : 'Pronta Entrega'}
                                    </Text>
                                  </View>

                                  {ped.status === 'pago' ? (
                                    <View style={styles.statusPaidPill}>
                                      <Feather name="check" size={11} color="#16A34A" />
                                      <Text style={styles.statusPaidPillText}>
                                        Pago ({ped.formaPagamento.toUpperCase()})
                                      </Text>
                                    </View>
                                  ) : (
                                    <View style={styles.statusPendingPill}>
                                      <Feather name="clock" size={11} color="#DC2626" />
                                      <Text style={styles.statusPendingPillText}>Pendente</Text>
                                    </View>
                                  )}

                                  {/* STATUS DE PRODUÇÃO: clique avança para a próxima etapa (venda da revendedora já sai entregue) */}
                                  {!ped.revendedoraId && (() => {
                                    const st = infoStatusProducao(ped.statusProducao);
                                    const ultimo = ped.statusProducao === 'entregue';
                                    return (
                                      <TouchableOpacity
                                        style={[styles.prodStatusPill, { backgroundColor: st.fundo }]}
                                        onPress={() => avancarStatusProducao(ped)}
                                        disabled={ultimo}
                                        activeOpacity={0.75}>
                                        <Feather name={st.icon} size={11} color={st.cor} />
                                        <Text style={[styles.prodStatusPillText, { color: st.cor }]}>{st.label}</Text>
                                        {!ultimo && <Feather name="chevron-right" size={11} color={st.cor} />}
                                      </TouchableOpacity>
                                    );
                                  })()}
                                </View>

                                <View style={styles.orderSellerInfoRow}>
                                  <Feather name="clock" size={12} color="#94A3B8" />
                                  <Text style={styles.orderMetaText}>{ped.horaDisplay}</Text>
                                  <Text style={styles.orderDotDivider}>•</Text>
                                  <Feather name="user-check" size={12} color="#94A3B8" />
                                  <Text style={styles.orderMetaText}>
                                    Vendedor: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{ped.vendedor}</Text>
                                  </Text>
                                </View>
                              </View>

                              {/* LINHA DO MEIO: CLIENTE, ITENS E VALOR TOTAL */}
                              <View style={styles.orderRowMiddle}>
                                <View style={{ flex: 1, gap: 2 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.orderClientTitle}>{ped.clienteNome}</Text>
                                    {!!tagDoCliente(ped) && (
                                      <View style={styles.clientTagBadge}>
                                        <Text style={styles.clientTagBadgeText}>🏷️ {tagDoCliente(ped)}</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.orderItemsSummary} numberOfLines={2}>
                                    {ped.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(' • ')}
                                  </Text>
                                </View>

                                <View style={styles.orderPriceCol}>
                                  <Text style={styles.orderPriceLabel}>TOTAL</Text>
                                  <Text style={styles.orderPriceValue}>
                                    R$ {ped.total.toFixed(2)}
                                  </Text>
                                  {ped.status === 'pendente' && (
                                    <Text style={styles.orderPendingNote}>
                                      R$ {ped.saldoNaEntrega.toFixed(2)} a receber
                                    </Text>
                                  )}
                                </View>
                              </View>

                              {/* LINHA INFERIOR DE AÇÕES (PADRÃO DOS BOTÕES DA VISÃO GERAL) */}
                              <View style={styles.orderRowActions}>
                                <View style={styles.orderActionsLeft}>
                                  {ped.status === 'pendente' && (
                                    <TouchableOpacity
                                      style={styles.btnActionBaixa}
                                      onPress={() => abrirModalBaixa(ped)}
                                      activeOpacity={0.8}>
                                      <Feather name="check-circle" size={13} color="#FFFFFF" />
                                      <Text style={styles.btnActionBaixaText}>Dar Baixa</Text>
                                    </TouchableOpacity>
                                  )}

                                  <TouchableOpacity
                                    style={styles.btnActionWhatsApp}
                                    onPress={() => copiarWhatsApp(ped)}
                                    activeOpacity={0.8}>
                                    <Feather name="message-circle" size={13} color="#16A34A" />
                                    <Text style={styles.btnActionWhatsAppText}>Comprovante WPP</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={[
                                      styles.btnActionDetalhes,
                                      isSelected && styles.btnActionDetalhesActive,
                                    ]}
                                    onPress={() => {
                                      if (isSelected) {
                                        setPedidoSelecionado(null);
                                      } else {
                                        setPedidoSelecionado(ped);
                                      }
                                    }}
                                    activeOpacity={0.8}>
                                    <Feather
                                      name={isSelected ? 'chevron-down' : 'maximize-2'}
                                      size={13}
                                      color={isSelected ? '#FFFFFF' : KipiPalette.icedDenim}
                                    />
                                    <Text
                                      style={[
                                        styles.btnActionDetalhesText,
                                        isSelected && styles.btnActionDetalhesTextActive,
                                      ]}>
                                      {isSelected ? 'Fechar Detalhes' : 'Ver Detalhes ↗'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>

                                <View style={styles.orderActionsRight}>
                                  <TouchableOpacity
                                    style={styles.btnMiniAction}
                                    onPress={() => abrirEdicao(ped)}>
                                    <Feather name="edit-2" size={14} color="#64748B" />
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={styles.btnMiniAction}
                                    onPress={() => {
                                      setPedidoParaExcluir(ped);
                                      setModalExcluirAberto(true);
                                    }}>
                                    <Feather name="trash-2" size={14} color="#DC2626" />
                                  </TouchableOpacity>
                                </View>
                              </View>

                            </View>
                          );
                        })}
                      </View>

                    </View>
                  ))
                )}
              </View>

              {/* =====================================================================
                  COLUNA LATERAL: DETALHES DO PEDIDO + TOP PRODUTOS + TOP CLIENTES
              ====================================================================== */}
              <View style={styles.gridSideCol}>

                {/* SE HOUVER PEDIDO SELECIONADO: EXIBIR CARD DE DETALHES EXPANDIDO AQUI */}
                {pedidoSelecionado && (
                  <View style={[styles.panelCard, { borderColor: KipiPalette.icedDenim, borderWidth: 2 }]}>
                    <View style={styles.panelHeader}>
                      <View style={styles.panelTitleRow}>
                        <View style={[styles.sectionDot, { backgroundColor: KipiPalette.icedDenim }]} />
                        <Text style={styles.panelTitle}>Detalhes: {pedidoSelecionado.codigoDisplay}</Text>
                        <View style={styles.panelChip}>
                          <Text style={styles.panelChipText}>
                            {pedidoSelecionado.status === 'pago' ? 'Pago' : 'Pendente'}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity onPress={() => setPedidoSelecionado(null)}>
                        <Feather name="x" size={18} color="#64748B" />
                      </TouchableOpacity>
                    </View>

                    {/* DADOS DO CLIENTE */}
                    <View style={styles.sideDetailClientCard}>
                      <View style={styles.sideDetailAvatar}>
                        <Text style={styles.sideDetailAvatarText}>
                          {pedidoSelecionado.clienteNome
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={styles.sideDetailClientName}>{pedidoSelecionado.clienteNome}</Text>
                          {!!tagDoCliente(pedidoSelecionado) && (
                            <View style={styles.clientTagBadge}>
                              <Text style={styles.clientTagBadgeText}>🏷️ {tagDoCliente(pedidoSelecionado)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.sideDetailClientSub}>
                          {pedidoSelecionado.clienteTelefone || 'Telefone não cadastrado'}
                        </Text>
                        <Text style={styles.sideDetailClientSub}>
                          Atendido por: {pedidoSelecionado.vendedor}
                        </Text>
                      </View>
                    </View>

                    {/* STATUS DE PRODUÇÃO (LINHA DO TEMPO) */}
                    {!pedidoSelecionado.revendedoraId && (
                    <View style={{ gap: 8 }}>
                      <Text style={styles.sideDetailSectionLabel}>STATUS DE PRODUÇÃO</Text>
                      <View style={styles.prodTimeline}>
                        {STATUS_PRODUCAO.map((s, idx) => {
                          const atualIdx = STATUS_PRODUCAO.findIndex((x) => x.id === pedidoSelecionado.statusProducao);
                          const feito = idx <= atualIdx;
                          return (
                            <TouchableOpacity
                              key={s.id}
                              style={[styles.prodTimelineStep, feito && { backgroundColor: s.fundo, borderColor: s.cor }]}
                              onPress={() => atualizarPedido({ ...pedidoSelecionado, statusProducao: s.id })}
                              activeOpacity={0.75}>
                              <Feather name={s.icon} size={12} color={feito ? s.cor : '#CBD5E1'} />
                              <Text style={[styles.prodTimelineText, feito && { color: s.cor }]}>{s.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                    )}

                    {/* ITENS DETALHADOS */}
                    <View style={{ gap: 8 }}>
                      <Text style={styles.sideDetailSectionLabel}>ITENS DO PEDIDO</Text>
                      {pedidoSelecionado.itens.map((it) => (
                        <View key={it.id} style={styles.sideDetailItemLine}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sideDetailItemName}>
                              {it.quantidade}x {it.nome}
                            </Text>
                            <Text style={styles.sideDetailItemSub}>
                              {it.categoria} • R$ {it.precoUnitario.toFixed(2)} un.
                              {it.comDesconto && it.desconto ? (
                                <Text style={{ color: '#B45309', fontWeight: '700' }}>
                                  {'  '}🏷️ Promoção (-R$ {it.desconto.toFixed(2)}/un)
                                </Text>
                              ) : null}
                            </Text>
                          </View>
                          <Text style={styles.sideDetailItemTotal}>
                            R$ {it.totalItem.toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* RESUMO DE VALORES */}
                    <View style={styles.sideDetailTotalBox}>
                      <View style={styles.sideDetailTotalLine}>
                        <Text style={styles.sideDetailTotalLabel}>TOTAL DO PEDIDO</Text>
                        <Text style={styles.sideDetailTotalVal}>
                          R$ {pedidoSelecionado.total.toFixed(2)}
                        </Text>
                      </View>
                      {(() => {
                        const custo = custoDoPedido(pedidoSelecionado);
                        const lucro = pedidoSelecionado.total - custo;
                        const margem = pedidoSelecionado.total > 0 ? Math.round((lucro / pedidoSelecionado.total) * 100) : 0;
                        return (
                          <View style={styles.sideDetailProfitRow}>
                            <Text style={styles.sideDetailProfitText}>Custo (ficha técnica): R$ {custo.toFixed(2)}</Text>
                            <Text style={[styles.sideDetailProfitText, { color: '#16A34A', fontWeight: '800' }]}>
                              Lucro est.: R$ {lucro.toFixed(2)} ({margem}%)
                            </Text>
                          </View>
                        );
                      })()}
                      {pedidoSelecionado.valorSinalPago > 0 && pedidoSelecionado.saldoNaEntrega > 0 && (
                        <Text style={styles.sideDetailProfitText}>
                          Sinal pago: R$ {pedidoSelecionado.valorSinalPago.toFixed(2)}
                        </Text>
                      )}
                      {pedidoSelecionado.status === 'pendente' && (
                        <Text style={styles.sideDetailPendingAlert}>
                          ⏳ R$ {pedidoSelecionado.saldoNaEntrega.toFixed(2)} pendente de pagamento
                        </Text>
                      )}
                    </View>

                    {/* COMPROVANTE WHATSAPP COM PIX */}
                    <View style={styles.sideDetailWppBox}>
                      <Text style={styles.sideDetailWppTitle}>📱 COMPROVANTE FORMATADO COM PIX</Text>
                      <Text style={styles.sideDetailWppPreview}>
                        {config.chavePix?.trim()
                          ? `Chave Pix: ${config.chavePix}`
                          : 'Cadastre a chave PIX em Configurações'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity
                          style={[styles.btnSideWppCopy, copiadoFeedback && { backgroundColor: '#16A34A' }]}
                          onPress={() => copiarWhatsApp(pedidoSelecionado)}>
                          <Feather name={copiadoFeedback ? 'check' : 'copy'} size={13} color="#FFFFFF" />
                          <Text style={styles.btnSideWppCopyText}>
                            {copiadoFeedback ? 'Copiado!' : 'Copiar Texto WPP'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnSideWppOpen}
                          onPress={() => abrirWhatsAppWeb(pedidoSelecionado)}>
                          <Feather name="external-link" size={13} color="#16A34A" />
                          <Text style={styles.btnSideWppOpenText}>Abrir WhatsApp</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* AÇÕES DE BAIXA / FECHAR */}
                    {pedidoSelecionado.status === 'pendente' && (
                      <TouchableOpacity
                        style={styles.btnSideBaixaConfirm}
                        onPress={() => abrirModalBaixa(pedidoSelecionado)}>
                        <Feather name="check-circle" size={15} color="#FFFFFF" />
                        <Text style={styles.btnSideBaixaConfirmText}>Dar Baixa de Pagamento</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* CARD 1: TOP 3 PRODUTOS MAIS VENDIDOS */}
                <View style={styles.panelCard}>
                  <View style={styles.panelHeader}>
                    <View style={styles.panelTitleRow}>
                      <View style={[styles.miniAlertIcon, { backgroundColor: '#F1F6D8' }]}>
                        <Feather name="award" size={14} color="#708018" />
                      </View>
                      <Text style={styles.panelTitle}>Top 3 Produtos</Text>
                    </View>
                    <View style={[styles.panelChip, { backgroundColor: '#F1F6D8' }]}>
                      <Text style={[styles.panelChipText, { color: '#708018' }]}>Campeões 🏆</Text>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    {top3Produtos.map((prod, idx) => {
                      const medalhas = ['🥇', '🥈', '🥉'];
                      return (
                        <View key={prod.nome} style={styles.sideTopRow}>
                          <Text style={{ fontSize: 16 }}>{medalhas[idx]}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sideTopName}>{prod.nome}</Text>
                            <Text style={styles.sideTopCat}>{prod.categoria}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.sideTopQty}>{prod.qtd} un.</Text>
                            <Text style={styles.sideTopTotal}>R$ {prod.faturamento.toFixed(2)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* CARD 2: TOP 3 CLIENTES QUE MAIS COMPRAM */}
                <View style={styles.panelCard}>
                  <View style={styles.panelHeader}>
                    <View style={styles.panelTitleRow}>
                      <View style={[styles.miniAlertIcon, { backgroundColor: '#EAF3FA' }]}>
                        <Feather name="users" size={14} color="#5798D7" />
                      </View>
                      <Text style={styles.panelTitle}>Top 3 Clientes</Text>
                    </View>
                    <View style={styles.panelChip}>
                      <Text style={styles.panelChipText}>Clientes VIP ✨</Text>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    {top3Clientes.map((cli, idx) => {
                      const medalhas = ['🥇', '🥈', '🥉'];
                      const iniciais = cli.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

                      return (
                        <View key={cli.chave} style={styles.sideTopRow}>
                          <Text style={{ fontSize: 16 }}>{medalhas[idx]}</Text>
                          <View style={styles.sideClientAvatarMini}>
                            <Text style={styles.sideClientAvatarText}>{iniciais}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sideTopName} numberOfLines={1}>
                              {cli.nome}
                              {!!cli.tag && <Text style={styles.sideTopTag}>  {cli.tag}</Text>}
                            </Text>
                            <Text style={styles.sideTopCat}>{cli.pedidosCount} pedidos realizados</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.sideTopQty, { color: '#16A34A' }]}>{cli.qtdItens} itens</Text>
                            <Text style={styles.sideTopTotal}>R$ {cli.totalGasto.toFixed(2)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

              </View>

            </View>

            {/* RODAPÉ DO ATELIÊ (IDÊNTICO À VISÃO GERAL) */}
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

      {/* =========================================================================
          MODAIS AUXILIARES (PAGAMENTO, A RECEBER, ESTOQUE, EXCLUSÃO)
      ========================================================================== */}

      {/* 1. MODAL DAR BAIXA */}
      <Modal visible={modalBaixaAberto} transparent animationType="fade" onRequestClose={() => setModalBaixaAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.md, { maxWidth: 440 }]}>
            <View style={styles.mdHeader}>
              <View style={[styles.mdHeaderIcon, { backgroundColor: '#DCFCE7' }]}>
                <Feather name="dollar-sign" size={16} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mdTitle}>Receber pagamento</Text>
                <Text style={styles.mdSub} numberOfLines={1}>
                  {pedidoParaBaixa?.codigoDisplay} · {pedidoParaBaixa?.clienteNome}
                  {pedidoParaBaixa && tagDoCliente(pedidoParaBaixa) ? ` · ${tagDoCliente(pedidoParaBaixa)}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalBaixaAberto(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {pedidoParaBaixa && (() => {
              const recebido = parseFloat(baixaValor.replace(',', '.')) || 0;
              const restante = Math.max(pedidoParaBaixa.saldoNaEntrega - recebido, 0);
              return (
                <View style={{ gap: 14 }}>
                  {/* Quanto falta, com o que já foi pago */}
                  <View style={styles.mdBaixaHero}>
                    <Text style={styles.mdBaixaHeroRotulo}>FALTA RECEBER</Text>
                    <Text style={styles.mdBaixaHeroValor}>{brl(pedidoParaBaixa.saldoNaEntrega)}</Text>
                    <View style={styles.mdBaixaHeroLinha}>
                      <Text style={styles.mdBaixaHeroInfo}>Total {brl(pedidoParaBaixa.total)}</Text>
                      <View style={styles.mdBaixaHeroPonto} />
                      <Text style={styles.mdBaixaHeroInfo}>Já pago {brl(pedidoParaBaixa.valorSinalPago)}</Text>
                    </View>
                  </View>

                  <View>
                    <Text style={styles.mdLabel}>COMO RECEBEU?</Text>
                    <View style={styles.mdFormas}>
                      {[
                        { id: 'pix', label: 'Pix', icon: 'zap' },
                        { id: 'dinheiro', label: 'Dinheiro', icon: 'dollar-sign' },
                        { id: 'cartao_credito', label: 'Crédito', icon: 'credit-card' },
                        { id: 'cartao_debito', label: 'Débito', icon: 'credit-card' },
                      ].map((opt) => {
                        const ativo = baixaFormaPagamento === opt.id;
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            style={[styles.mdForma, ativo && styles.mdFormaAtiva]}
                            onPress={() => setBaixaFormaPagamento(opt.id as any)}>
                            <Feather name={opt.icon as any} size={16} color={ativo ? '#16A34A' : '#64748B'} />
                            <Text style={[styles.mdFormaTexto, ativo && styles.mdFormaTextoAtivo]}>{opt.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View>
                    <View style={styles.mdLabelLinha}>
                      <Text style={styles.mdLabel}>VALOR RECEBIDO</Text>
                      <TouchableOpacity onPress={() => setBaixaValor(pedidoParaBaixa.saldoNaEntrega.toFixed(2).replace('.', ','))}>
                        <Text style={styles.mdLink}>Valor total</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.mdInputIcone, { paddingVertical: 4 }]}>
                      <Text style={styles.mdPrefixo}>R$</Text>
                      <TextInput
                        style={[styles.mdInputSemBorda, { fontSize: 18, fontFamily: Fonts.display, fontWeight: '800' }]}
                        value={baixaValor}
                        onChangeText={(t) => setBaixaValor(t.replace(/[^\d,.]/g, ''))}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Text style={[styles.mdDica, restante > 0 && { color: '#B45309' }]}>
                      {restante > 0
                        ? `Pagamento parcial: continuam faltando ${brl(restante)}.`
                        : 'O pedido fica quitado.'}
                    </Text>
                  </View>
                </View>
              );
            })()}

            <View style={styles.mdFooter}>
              <TouchableOpacity style={styles.mdBtnSec} onPress={() => setModalBaixaAberto(false)}>
                <Text style={styles.mdBtnSecTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mdBtnPri, { backgroundColor: '#16A34A' }]} onPress={confirmarBaixa}>
                <Feather name="check" size={14} color="#FFFFFF" />
                <Text style={styles.mdBtnPriTexto}>Confirmar recebimento</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. MODAL A RECEBER */}
      <Modal visible={modalAReceberAberto} transparent animationType="fade" onRequestClose={() => setModalAReceberAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.md, { maxWidth: 600 }]}>
            <View style={styles.mdHeader}>
              <View style={[styles.mdHeaderIcon, { backgroundColor: '#FEF3C7' }]}>
                <Feather name="clock" size={16} color="#B45309" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mdTitle}>A receber</Text>
                <Text style={styles.mdSub}>
                  {escopo.ehRevendedora ? 'Clientes que ainda te devem' : 'Pedidos com pagamento pendente'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalAReceberAberto(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {(() => {
              const pendentes = pedidos
                .filter((p) => !p.deletado && p.status === 'pendente')
                .sort((a, b) => b.saldoNaEntrega - a.saldoNaEntrega);
              const totalDevido = pendentes.reduce((acc, p) => acc + p.saldoNaEntrega, 0);
              const clientesDevendo = new Set(pendentes.map((p) => p.clienteId ?? p.clienteNome)).size;
              return (
                <>
                  <View style={styles.mdResumo}>
                    <View style={[styles.mdResumoCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                      <Text style={[styles.mdResumoRotulo, { color: '#B45309' }]}>TOTAL A RECEBER</Text>
                      <Text style={[styles.mdResumoValor, { color: '#B45309' }]}>{brl(totalDevido)}</Text>
                    </View>
                    <View style={styles.mdResumoCard}>
                      <Text style={styles.mdResumoRotulo}>PEDIDOS</Text>
                      <Text style={styles.mdResumoValor}>{pendentes.length}</Text>
                    </View>
                    <View style={styles.mdResumoCard}>
                      <Text style={styles.mdResumoRotulo}>CLIENTES</Text>
                      <Text style={styles.mdResumoValor}>{clientesDevendo}</Text>
                    </View>
                  </View>

                  <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
                    {pendentes.length === 0 ? (
                      <View style={styles.mdVazio}>
                        <Text style={{ fontSize: 26 }}>🎉</Text>
                        <Text style={styles.mdVazioTitulo}>Nada a receber</Text>
                        <Text style={styles.mdDica}>Todos os pedidos estão pagos.</Text>
                      </View>
                    ) : (
                      pendentes.map((ped) => (
                        <View key={ped.id} style={styles.mdDevedor}>
                          <View style={styles.mdAvatar}>
                            <Text style={styles.mdAvatarTexto}>{(ped.clienteNome || '?').charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.mdLinhaNome}>
                              <Text style={styles.mdItemNome} numberOfLines={1}>{ped.clienteNome}</Text>
                              {!!tagDoCliente(ped) && (
                                <View style={styles.clientTagBadge}>
                                  <Text style={styles.clientTagBadgeText}>🏷️ {tagDoCliente(ped)}</Text>
                                </View>
                              )}
                              <View style={styles.mdCodigo}>
                                <Text style={styles.mdCodigoTexto}>{ped.codigoDisplay}</Text>
                              </View>
                            </View>
                            <Text style={styles.mdItemSub} numberOfLines={1}>
                              {ped.dataDisplay}
                              {!escopo.ehRevendedora ? ` · ${ped.vendedor}` : ''}
                              {ped.valorSinalPago > 0 ? ` · já pagou ${brl(ped.valorSinalPago)}` : ''}
                            </Text>
                          </View>
                          <Text style={styles.mdDevedorValor}>{brl(ped.saldoNaEntrega)}</Text>
                          <TouchableOpacity style={styles.mdIconeBtnWpp} onPress={() => abrirWhatsAppWeb(ped)}>
                            <Feather name="message-circle" size={14} color="#16A34A" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.mdBtnBaixa}
                            onPress={() => {
                              setModalAReceberAberto(false);
                              abrirModalBaixa(ped);
                            }}>
                            <Feather name="check" size={12} color="#FFFFFF" />
                            <Text style={styles.mdBtnBaixaTexto}>Receber</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* 3. MODAL ESTOQUE (CONSULTAR CARDÁPIO) */}
      <Modal visible={modalEstoqueAberto} transparent animationType="fade" onRequestClose={() => setModalEstoqueAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.md, { maxWidth: 620 }]}>
            <View style={styles.mdHeader}>
              <View style={[styles.mdHeaderIcon, { backgroundColor: '#EAF3FA' }]}>
                <Feather name="box" size={16} color={KipiPalette.icedDenim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mdTitle}>{escopo.ehRevendedora ? 'Estoque com você' : 'Cardápio e estoque'}</Text>
                <Text style={styles.mdSub}>
                  {escopo.ehRevendedora ? 'O que o ateliê te entregou e ainda não foi vendido' : 'O que está disponível na vitrine para vender agora'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalEstoqueAberto(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {(() => {
              const categorias = ['Todas', ...Array.from(new Set(estoque.map((p) => p.categoria)))];
              const ordemStatus = { zerado: 0, baixo: 1, normal: 2 } as const;
              const lista = estoque
                .filter((p) => {
                  const mBusca = !buscaEstoque || p.nome.toLowerCase().includes(buscaEstoque.toLowerCase());
                  const mCat = categoriaEstoque === 'Todas' || p.categoria === categoriaEstoque;
                  return mBusca && mCat;
                })
                .sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || a.nome.localeCompare(b.nome));
              const totalUn = estoque.reduce((acc, p) => acc + p.estoque, 0);
              const baixos = estoque.filter((p) => p.status === 'baixo').length;
              const zerados = estoque.filter((p) => p.status === 'zerado').length;
              return (
                <>
                  <View style={styles.mdResumo}>
                    <View style={styles.mdResumoCard}>
                      <Text style={styles.mdResumoRotulo}>UNIDADES</Text>
                      <Text style={styles.mdResumoValor}>{totalUn}</Text>
                    </View>
                    <View style={styles.mdResumoCard}>
                      <Text style={styles.mdResumoRotulo}>PRODUTOS</Text>
                      <Text style={styles.mdResumoValor}>{estoque.length}</Text>
                    </View>
                    <View style={[styles.mdResumoCard, baixos > 0 && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                      <Text style={[styles.mdResumoRotulo, baixos > 0 && { color: '#B45309' }]}>ACABANDO</Text>
                      <Text style={[styles.mdResumoValor, baixos > 0 && { color: '#B45309' }]}>{baixos}</Text>
                    </View>
                    <View style={[styles.mdResumoCard, zerados > 0 && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                      <Text style={[styles.mdResumoRotulo, zerados > 0 && { color: '#DC2626' }]}>ESGOTADOS</Text>
                      <Text style={[styles.mdResumoValor, zerados > 0 && { color: '#DC2626' }]}>{zerados}</Text>
                    </View>
                  </View>

                  <View style={{ gap: 8, marginBottom: 10 }}>
                    <View style={styles.mdInputIcone}>
                      <Feather name="search" size={13} color="#94A3B8" />
                      <TextInput
                        style={styles.mdInputSemBorda}
                        placeholder="Buscar produto..."
                        placeholderTextColor="#94A3B8"
                        value={buscaEstoque}
                        onChangeText={setBuscaEstoque}
                      />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {categorias.map((c) => {
                        const ativo = categoriaEstoque === c;
                        return (
                          <TouchableOpacity key={c} style={[styles.mdChip, ativo && styles.mdChipAtivo]} onPress={() => setCategoriaEstoque(c)}>
                            <Text style={[styles.mdChipTexto, ativo && { color: '#FFFFFF', fontWeight: '800' }]}>{c}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 6 }} showsVerticalScrollIndicator={false}>
                    {lista.length === 0 ? (
                      <View style={styles.mdVazio}>
                        <Feather name="search" size={22} color="#CBD5E1" />
                        <Text style={styles.mdDica}>Nenhum produto encontrado.</Text>
                      </View>
                    ) : (
                      lista.map((prod) => {
                        const cor = prod.status === 'zerado' ? '#DC2626' : prod.status === 'baixo' ? '#B45309' : '#16A34A';
                        const fundo = prod.status === 'zerado' ? '#FEF2F2' : prod.status === 'baixo' ? '#FFFBEB' : '#F0FDF4';
                        const rotulo = prod.status === 'zerado' ? 'Esgotado' : prod.status === 'baixo' ? 'Acabando' : 'Disponível';
                        return (
                          <View key={prod.id} style={styles.mdProduto}>
                            <View style={[styles.mdProdutoBarra, { backgroundColor: cor }]} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.mdItemNome} numberOfLines={1}>{prod.nome}</Text>
                              <Text style={styles.mdItemSub}>{prod.categoria} · {brl(prod.preco)}</Text>
                            </View>
                            <View style={[styles.mdStatus, { backgroundColor: fundo }]}>
                              <Text style={[styles.mdStatusTexto, { color: cor }]}>{rotulo}</Text>
                            </View>
                            <Text style={[styles.mdProdutoQtd, { color: prod.status === 'normal' ? '#0F172A' : cor }]}>
                              {prod.estoque}
                              <Text style={styles.mdProdutoUn}> un</Text>
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* 4. MODAL EXCLUSÃO */}
      <Modal visible={modalExcluirAberto} transparent animationType="fade" onRequestClose={() => setModalExcluirAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalCardHeader}>
              <View>
                <View style={[styles.modalTagBadge, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.modalTagBadgeText, { color: '#DC2626' }]}>EXCLUSÃO LÓGICA</Text>
                </View>
                <Text style={[styles.modalCardTitle, { color: '#DC2626' }]}>Cancelar Pedido?</Text>
              </View>
              <TouchableOpacity onPress={() => setModalExcluirAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#475569', marginTop: 12, lineHeight: 20 }}>
              Deseja arquivar e cancelar logicamente o pedido <Text style={{ fontWeight: '700', color: '#0F172A' }}>{pedidoParaExcluir?.codigoDisplay}</Text>?
              {'\n\n'}
              O histórico permanecerá preservado para auditoria contábil.
            </Text>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalExcluirAberto(false)}>
                <Text style={styles.modalBtnCancelText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnConfirm, { backgroundColor: '#DC2626' }]} onPress={confirmarExclusao}>
                <Text style={styles.modalBtnConfirmText}>Sim, Cancelar Pedido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL NOVO PEDIDO / EDITAR PEDIDO (O MESMO) */}
      <NovoPedidoModal
        visible={modalNovoPedidoAberto}
        pedidoEditando={pedidoEmEdicao}
        onClose={() => {
          setModalNovoPedidoAberto(false);
          setPedidoEmEdicao(null);
        }}
        onPedidoCriado={lidarComPedidoCriado}
      />
      {/* TOAST DE FEEDBACK DE SUCESSO (IDÊNTICO À VISÃO GERAL) */}
      {toastSucesso && (
        <View style={styles.toastSuccess}>
          <Feather name="check-circle" size={18} color="#FFFFFF" />
          <Text style={styles.toastSuccessText}>{toastSucesso}</Text>
        </View>
      )}

    </SafeAreaView>
  );
}

// ============================================================================
// FOLHA DE ESTILOS MODERNA (EXATAMENTE OS MESMOS COMPONENTES DA VISÃO GERAL)
// ============================================================================

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

  // SIDEBAR
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

  // ÁREA DE CONTEÚDO
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
    width: 340,
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

  // CABEÇALHO PADRÃO DO SISTEMA
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  pageHeaderAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  pageHeaderAlertText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },

  // FILTROS
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

  // SUB-FILTROS
  subFiltersStrip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
  },
  subFilterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subFilterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  subFilterPills: {
    flexDirection: 'row',
    gap: 6,
  },
  subPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  subPillActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  subPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  subPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customDateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    gap: 12,
    flexWrap: 'wrap',
  },
  customDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customDateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  customDateInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: '#0F172A',
  },
  customDateInfo: {
    fontSize: 11,
    color: KipiPalette.icedDenim,
    fontWeight: '600',
  },

  // KPIS EM LINHA
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
  kpiCardClickable: {
    borderStyle: 'solid',
    borderColor: '#C7E0F7',
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

  // GRID PRINCIPAL (2 COLUNAS)
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

  // COMPONENTES DOS CARDS PADRÃO (PANELCARD)
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

  // LISTA DE PEDIDOS DENTRO DO PANEL
  ordersListBlock: {
    gap: 10,
  },
  orderRowCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  orderRowCardSelected: {
    borderColor: KipiPalette.icedDenim,
    backgroundColor: '#F9FCFF',
  },
  orderRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderCodeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderCodeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.mono,
  },
  orderTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orderTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPaidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  statusPaidPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  statusPendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  statusPendingPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },

  // CUSTO E LUCRO NO DETALHE
  sideDetailProfitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 4,
  },
  sideDetailProfitText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },

  // STATUS DE PRODUÇÃO
  prodStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  prodStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  prodTimeline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  prodTimelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  prodTimelineText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },

  // MODAL DE EDIÇÃO DO PEDIDO
  modalEditCard: {
    maxWidth: 640,
    maxHeight: '92%',
  },
  editRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  editItemsBox: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  editItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editItemName: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  editItemSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },
  editStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  editStepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  editStepperQtd: {
    minWidth: 24,
    textAlign: 'center',
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  editItemTotal: {
    minWidth: 76,
    textAlign: 'right',
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  editTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  editTotalLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  editTotalValue: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  orderSellerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  orderDotDivider: {
    color: '#CBD5E1',
  },
  orderRowMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderClientTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  clientTagBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  clientTagBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  orderItemsSummary: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  orderPriceCol: {
    alignItems: 'flex-end',
  },
  orderPriceLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  orderPriceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  orderPendingNote: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '700',
  },
  orderRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  btnActionBaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  btnActionBaixaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  btnActionWhatsApp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  btnActionWhatsAppText: {
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 11,
  },
  btnActionDetalhes: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  btnActionDetalhesActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  btnActionDetalhesText: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
    fontSize: 11,
  },
  btnActionDetalhesTextActive: {
    color: '#FFFFFF',
  },
  orderActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnMiniAction: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // CARD DE DETALHES NA COLUNA LATERAL
  sideDetailClientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
  },
  sideDetailAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideDetailAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  sideDetailClientName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  sideDetailClientSub: {
    fontSize: 11,
    color: '#64748B',
  },
  sideDetailSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  sideDetailItemLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sideDetailItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  sideDetailItemSub: {
    fontSize: 10,
    color: '#64748B',
  },
  sideDetailItemTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  sideDetailTotalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  sideDetailTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sideDetailTotalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  sideDetailTotalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  sideDetailPendingAlert: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  sideDetailWppBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  sideDetailWppTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  sideDetailWppPreview: {
    fontSize: 11,
    color: '#15803D',
  },
  btnSideWppCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  btnSideWppCopyText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  btnSideWppOpen: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 6,
  },
  btnSideWppOpenText: {
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 11,
  },
  btnSideBaixaConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  btnSideBaixaConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  // TOP PRODUTOS E CLIENTES NA COLUNA LATERAL
  sideTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  sideTopName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  sideTopTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#708018',
  },
  sideTopCat: {
    fontSize: 10,
    color: '#64748B',
  },
  sideTopQty: {
    fontSize: 12,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  sideTopTotal: {
    fontSize: 10,
    color: '#64748B',
  },
  sideClientAvatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EAF3FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideClientAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },

  // RODAPÉ DA PÁGINA
  pageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 12,
  },
  pageFooterBrand: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#94A3B8',
  },
  pageFooterLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pageFooterLink: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },

  // MODAIS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 20,
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  modalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTagBadge: {
    backgroundColor: '#EAF3FA',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  modalTagBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  modalCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  modalSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 4,
  },
  modalPayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalPayBtn: {
    flex: 1,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalPayBtnActive: {
    backgroundColor: '#EAF3FA',
    borderColor: KipiPalette.icedDenim,
  },
  modalPayBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  modalPayBtnTextActive: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalBtnCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalBtnCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  modalBtnConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalBtnConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  modalPendingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalMiniBtnWpp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  modalMiniBtnBaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },

  modalSearchField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  modalCatChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  modalCatChipActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  modalCatChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  modalCatChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalStockLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stockStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // MODAIS NO PADRÃO DO SISTEMA (cabeçalho com ícone, seções em cartão, rodapé fixo)
  md: { width: '100%', maxHeight: '92%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', ...Platform.select({ web: { boxShadow: '0 20px 50px rgba(15,23,42,0.18)' } }) },
  mdHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  mdHeaderIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mdTitle: { fontFamily: Fonts.display, fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  mdSub: { fontFamily: Fonts.sans, fontSize: 11, color: '#64748B', marginTop: 1 },
  mdSecao: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F6', padding: 12 },
  mdLabel: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 },
  mdLabelLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mdMiniLabel: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  mdLink: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', color: KipiPalette.icedDenim, marginBottom: 8 },
  mdDica: { fontFamily: Fonts.sans, fontSize: 11, color: '#64748B', marginTop: 6 },
  mdLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mdInput: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600', color: '#0F172A', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  mdInputIcone: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10 },
  mdInputSemBorda: { flex: 1, minWidth: 0, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600', color: '#0F172A', paddingVertical: 8, ...Platform.select({ web: { outlineStyle: 'none' } as any }) },
  mdPrefixo: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  mdSegmento: { flexDirection: 'row', backgroundColor: '#EEF2F6', borderRadius: 10, padding: 3 },
  mdSegmentoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, borderRadius: 8 },
  mdSegmentoBtnAtivo: { backgroundColor: '#FFFFFF', ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(15,23,42,0.1)' } }) },
  mdSegmentoTexto: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '600', color: '#64748B' },
  mdSegmentoTextoAtivo: { color: KipiPalette.icedDenim, fontWeight: '800' },
  mdChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mdChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  mdChipAtivo: { backgroundColor: KipiPalette.icedDenim, borderColor: KipiPalette.icedDenim },
  mdChipTexto: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '600', color: '#475569' },
  mdItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#EEF2F6', paddingHorizontal: 10, paddingVertical: 8 },
  mdItemNome: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700', color: '#0F172A' },
  mdItemSub: { fontFamily: Fonts.sans, fontSize: 11, color: '#64748B', marginTop: 1 },
  mdItemTotal: { width: 80, textAlign: 'right', fontFamily: Fonts.display, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  mdStepper: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', padding: 2 },
  mdStepperBtn: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  mdStepperQtd: { minWidth: 22, textAlign: 'center', fontFamily: Fonts.display, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  mdTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', borderStyle: 'dashed' },
  mdTotalRotulo: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700', color: '#475569' },
  mdTotalValor: { fontFamily: Fonts.display, fontSize: 18, fontWeight: '800', color: KipiPalette.icedDenim },
  mdSaldo: { flex: 1, minWidth: 150, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  mdSaldoPendente: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  mdSaldoOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  mdSaldoValor: { fontFamily: Fonts.display, fontSize: 16, fontWeight: '800' },
  mdFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  mdBtnSec: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  mdBtnSecTexto: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700', color: '#334155' },
  mdBtnPri: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: KipiPalette.icedDenim },
  mdBtnPriTexto: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  // Baixa de pagamento
  mdBaixaHero: { alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', paddingVertical: 14, paddingHorizontal: 12 },
  mdBaixaHeroRotulo: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', color: '#B45309', letterSpacing: 0.6 },
  mdBaixaHeroValor: { fontFamily: Fonts.display, fontSize: 28, fontWeight: '800', color: '#92400E', letterSpacing: -0.5, marginVertical: 2 },
  mdBaixaHeroLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mdBaixaHeroInfo: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '600', color: '#B45309' },
  mdBaixaHeroPonto: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#D97706' },
  mdFormas: { flexDirection: 'row', gap: 8 },
  mdForma: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  mdFormaAtiva: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  mdFormaTexto: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '600', color: '#475569' },
  mdFormaTextoAtivo: { color: '#15803D', fontWeight: '800' },
  // A receber e estoque
  mdResumo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  mdResumoCard: { flex: 1, minWidth: 100, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F6', paddingHorizontal: 12, paddingVertical: 9 },
  mdResumoRotulo: { fontFamily: Fonts.sans, fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  mdResumoValor: { fontFamily: Fonts.display, fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  mdVazio: { alignItems: 'center', gap: 4, paddingVertical: 28 },
  mdVazioTitulo: { fontFamily: Fonts.display, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  mdDevedor: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F6', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 9 },
  mdAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EAF3FA', alignItems: 'center', justifyContent: 'center' },
  mdAvatarTexto: { fontFamily: Fonts.display, fontSize: 13, fontWeight: '800', color: KipiPalette.icedDenim },
  mdLinhaNome: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mdCodigo: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  mdCodigoTexto: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '700', color: '#64748B' },
  mdDevedorValor: { fontFamily: Fonts.display, fontSize: 14, fontWeight: '800', color: '#B45309' },
  mdIconeBtnWpp: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  mdBtnBaixa: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 10, height: 30 },
  mdBtnBaixaTexto: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  mdProduto: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, borderColor: '#EEF2F6', backgroundColor: '#FFFFFF', paddingRight: 12, paddingVertical: 8, overflow: 'hidden' },
  mdProdutoBarra: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginLeft: 6 },
  mdStatus: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  mdStatusTexto: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800' },
  mdProdutoQtd: { width: 58, textAlign: 'right', fontFamily: Fonts.display, fontSize: 15, fontWeight: '800' },
  mdProdutoUn: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  // Topo: botão Filtros com dropdown
  filtrosEsq: { flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 50 },
  filtrosBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  filtrosBtnAtivo: { borderColor: KipiPalette.icedDenim, backgroundColor: '#EAF3FA' },
  filtrosBtnTexto: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700', color: '#475569' },
  filtrosBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: KipiPalette.icedDenim, alignItems: 'center', justifyContent: 'center' },
  filtrosBadgeTexto: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  filtrosMenu: { position: 'absolute', top: 46, left: 0, width: 320, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 14, zIndex: 100, ...Platform.select({ web: { boxShadow: '0 16px 40px rgba(15,23,42,0.16)' } }) },
  filtrosGrupoLabel: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 7 },
  filtrosRodape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  filtrosDir: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  // TOAST DE SUCESSO (IDÊNTICO À VISÃO GERAL)
  toastSuccess: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
