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
import { supabase } from '@/lib/supabase';
import { KipiPalette, Fonts } from '@/constants/theme';
import NovoPedidoModal from '@/components/NovoPedidoModal';

// ============================================================================
// TIPOS E MODELOS
// ============================================================================

export type Periodo = 'hoje' | '7dias' | 'mes' | 'personalizar';
export type TipoPedido = 'todos' | 'pronta_entrega' | 'sob_encomenda';
export type StatusPagamento = 'todos' | 'pendentes' | 'pagos';

export interface PedidoItem {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  precoUnitario: number;
  desconto?: number;
  comDesconto?: boolean;
  totalItem: number;
}

export interface Pedido {
  id: string;
  codigoDisplay: string;
  clienteNome: string;
  clienteTelefone?: string | null;
  clienteEmail?: string | null;
  tag: string;
  tipoPedido: 'pronta_entrega' | 'sob_encomenda';
  data: string;
  dataDisplay: string;
  horaDisplay: string;
  diaChave: string; // YYYY-MM-DD
  diaTitulo: string; // Ex: Sábado, 17 de Outubro
  vendedor: string;
  vendedorCargo: string;
  formaPagamento: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'pendente';
  status: 'pago' | 'pendente' | 'cancelado';
  total: number;
  valorSinalPago: number;
  saldoNaEntrega: number;
  statusProducao: 'a_fazer' | 'em_producao' | 'pronto' | 'entregue';
  itens: PedidoItem[];
  observacoes?: string | null;
  deletado?: boolean;
}

export interface EstoqueItem {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  estoqueMinimo: number;
  status: 'normal' | 'baixo' | 'zerado';
}

// ============================================================================
// DADOS MOCK INICIAIS (ATELIERQ PÂTISSERIE)
// ============================================================================

const MOCK_PEDIDOS: Pedido[] = [
  // SEGUNDA-FEIRA (HOJE - 19/10)
  {
    id: 'ped-1048',
    codigoDisplay: '#PED-1048',
    clienteNome: 'Mariana Albuquerque',
    clienteTelefone: '(21) 98844-3321',
    clienteEmail: 'mariana.alb@gmail.com',
    tag: 'WhatsApp VIP',
    tipoPedido: 'sob_encomenda',
    data: '2026-10-19T14:35:00.000Z',
    dataDisplay: '19/10/2026',
    horaDisplay: '14:35',
    diaChave: '2026-10-19',
    diaTitulo: 'Hoje • Segunda-feira, 19 de Outubro',
    vendedor: 'Camila Lima',
    vendedorCargo: 'Proprietária',
    formaPagamento: 'pix',
    status: 'pendente',
    total: 143.90,
    valorSinalPago: 0,
    saldoNaEntrega: 143.90,
    statusProducao: 'em_producao',
    itens: [
      { id: 'it-1', nome: 'Bento Cake Pistache & Framboesa', categoria: 'Bolos & Bentos', quantidade: 2, precoUnitario: 65.00, totalItem: 130.00 },
      { id: 'it-2', nome: 'Cookie Duo Red Velvet c/ Ninho', categoria: 'Cookies', quantidade: 1, precoUnitario: 13.90, totalItem: 13.90 },
    ],
    observacoes: 'Escrever no topo: "Feliz 30 Anos Ju!" com laço verde pistache.',
  },
  {
    id: 'ped-1047',
    codigoDisplay: '#PED-1047',
    clienteNome: 'Dra. Camila Morales',
    clienteTelefone: '(21) 99122-4411',
    clienteEmail: 'morales.camila@clinicavita.com',
    tag: 'Cliente Assídua',
    tipoPedido: 'pronta_entrega',
    data: '2026-10-19T11:20:00.000Z',
    dataDisplay: '19/10/2026',
    horaDisplay: '11:20',
    diaChave: '2026-10-19',
    diaTitulo: 'Hoje • Segunda-feira, 19 de Outubro',
    vendedor: 'Juliana Carvalho',
    vendedorCargo: 'Atendimento Balcão',
    formaPagamento: 'cartao_credito',
    status: 'pago',
    total: 89.50,
    valorSinalPago: 89.50,
    saldoNaEntrega: 0,
    statusProducao: 'entregue',
    itens: [
      { id: 'it-3', nome: 'Caixa Macarons Degustação (6 un)', categoria: 'Macarons', quantidade: 1, precoUnitario: 57.00, totalItem: 57.00 },
      { id: 'it-4', nome: 'Fatia Cheesecake Frutas Silvestres', categoria: 'Sobremesas', quantidade: 1, precoUnitario: 32.50, totalItem: 32.50 },
    ],
    observacoes: 'Embalagem de presente com fita de cetim.',
  },
  {
    id: 'ped-1046',
    codigoDisplay: '#PED-1046',
    clienteNome: 'Venda Avulsa (Balcão)',
    clienteTelefone: null,
    clienteEmail: null,
    tag: 'Balcão Rápido',
    tipoPedido: 'pronta_entrega',
    data: '2026-10-19T09:45:00.000Z',
    dataDisplay: '19/10/2026',
    horaDisplay: '09:45',
    diaChave: '2026-10-19',
    diaTitulo: 'Hoje • Segunda-feira, 19 de Outubro',
    vendedor: 'Juliana Carvalho',
    vendedorCargo: 'Atendimento Balcão',
    formaPagamento: 'pix',
    status: 'pago',
    total: 41.70,
    valorSinalPago: 41.70,
    saldoNaEntrega: 0,
    statusProducao: 'entregue',
    itens: [
      { id: 'it-5', nome: 'Cookie Tradicional Gotas Belga', categoria: 'Cookies', quantidade: 3, precoUnitario: 13.90, totalItem: 41.70 },
    ],
    observacoes: 'Consumo imediato no bistrô.',
  },

  // DOMINGO (ONTEM - 18/10)
  {
    id: 'ped-1045',
    codigoDisplay: '#PED-1045',
    clienteNome: 'Fernanda Montenegro Santos',
    clienteTelefone: '(21) 98711-2299',
    clienteEmail: 'fernanda.m@globo.com',
    tag: 'Festa Infantil',
    tipoPedido: 'sob_encomenda',
    data: '2026-10-18T16:10:00.000Z',
    dataDisplay: '18/10/2026',
    horaDisplay: '16:10',
    diaChave: '2026-10-18',
    diaTitulo: 'Domingo, 18 de Outubro (Ontem)',
    vendedor: 'Camila Lima',
    vendedorCargo: 'Proprietária',
    formaPagamento: 'pix',
    status: 'pago',
    total: 480.00,
    valorSinalPago: 480.00,
    saldoNaEntrega: 0,
    statusProducao: 'entregue',
    itens: [
      { id: 'it-6', nome: 'Bolo Decorado Flores de Açúcar 20 fatias', categoria: 'Bolos & Bentos', quantidade: 1, precoUnitario: 320.00, totalItem: 320.00 },
      { id: 'it-7', nome: 'Cento de Brigadeiros Gourmet Belga', categoria: 'Doces Finos', quantidade: 1, precoUnitario: 160.00, totalItem: 160.00 },
    ],
    observacoes: 'Entregue com sucesso no salão de festas.',
  },
  {
    id: 'ped-1044',
    codigoDisplay: '#PED-1044',
    clienteNome: 'Café & Flor Bistrô',
    clienteTelefone: '(21) 97654-1100',
    clienteEmail: 'compras@cafeflor.com.br',
    tag: 'Revendedora',
    tipoPedido: 'pronta_entrega',
    data: '2026-10-18T10:15:00.000Z',
    dataDisplay: '18/10/2026',
    horaDisplay: '10:15',
    diaChave: '2026-10-18',
    diaTitulo: 'Domingo, 18 de Outubro (Ontem)',
    vendedor: 'Café & Flor Bistrô',
    vendedorCargo: 'Revenda',
    formaPagamento: 'pix',
    status: 'pendente',
    total: 390.00,
    valorSinalPago: 0,
    saldoNaEntrega: 390.00,
    statusProducao: 'pronto',
    itens: [
      { id: 'it-8', nome: 'Cookie Tradicional Gotas Belga', categoria: 'Cookies', quantidade: 15, precoUnitario: 12.00, totalItem: 180.00 },
      { id: 'it-9', nome: 'Bento Cake Red Velvet', categoria: 'Bolos & Bentos', quantidade: 3, precoUnitario: 70.00, totalItem: 210.00 },
    ],
    observacoes: 'Remessa de consignação do fim de semana.',
  },

  // SÁBADO (17/10)
  {
    id: 'ped-1043',
    codigoDisplay: '#PED-1043',
    clienteNome: 'Guilherme Peixoto',
    clienteTelefone: '(21) 99876-5432',
    clienteEmail: 'guilherme.px@yahoo.com',
    tag: 'Noivado',
    tipoPedido: 'sob_encomenda',
    data: '2026-10-17T17:40:00.000Z',
    dataDisplay: '17/10/2026',
    horaDisplay: '17:40',
    diaChave: '2026-10-17',
    diaTitulo: 'Sábado, 17 de Outubro',
    vendedor: 'Sofia Ramos',
    vendedorCargo: 'Confeitaria Artística',
    formaPagamento: 'cartao_credito',
    status: 'pago',
    total: 340.00,
    valorSinalPago: 340.00,
    saldoNaEntrega: 0,
    statusProducao: 'entregue',
    itens: [
      { id: 'it-10', nome: 'Torre de Macarons 24 unidades', categoria: 'Macarons', quantidade: 1, precoUnitario: 220.00, totalItem: 220.00 },
      { id: 'it-11', nome: 'Cinquenta Doces Finos Pistache', categoria: 'Doces Finos', quantidade: 1, precoUnitario: 120.00, totalItem: 120.00 },
    ],
    observacoes: 'Mesa de noivado entregue e montada às 17h.',
  },
  {
    id: 'ped-1042',
    codigoDisplay: '#PED-1042',
    clienteNome: 'Boutique Doce Charme',
    clienteTelefone: '(21) 98111-7788',
    clienteEmail: 'contato@docecharme.com',
    tag: 'Revendedora',
    tipoPedido: 'pronta_entrega',
    data: '2026-10-17T14:10:00.000Z',
    dataDisplay: '17/10/2026',
    horaDisplay: '14:10',
    diaChave: '2026-10-17',
    diaTitulo: 'Sábado, 17 de Outubro',
    vendedor: 'Boutique Doce Charme',
    vendedorCargo: 'Revenda',
    formaPagamento: 'pix',
    status: 'pendente',
    total: 546.00,
    valorSinalPago: 0,
    saldoNaEntrega: 546.00,
    statusProducao: 'entregue',
    itens: [
      { id: 'it-12', nome: 'Cookie Duo Red Velvet c/ Ninho', categoria: 'Cookies', quantidade: 20, precoUnitario: 13.90, totalItem: 278.00 },
      { id: 'it-13', nome: 'Fatia Torta Ópera Café & Ganache', categoria: 'Sobremesas', quantidade: 8, precoUnitario: 33.50, totalItem: 268.00 },
    ],
    observacoes: 'Aguardando fechamento semanal da boutique.',
  },
  {
    id: 'ped-1041',
    codigoDisplay: '#PED-1041',
    clienteNome: 'Larissa Manoela Vasconcelos',
    clienteTelefone: '(21) 98455-1234',
    clienteEmail: 'larissa.v@outlook.com',
    tag: 'Maternidade',
    tipoPedido: 'sob_encomenda',
    data: '2026-10-17T11:00:00.000Z',
    dataDisplay: '17/10/2026',
    horaDisplay: '11:00',
    diaChave: '2026-10-17',
    diaTitulo: 'Sábado, 17 de Outubro',
    vendedor: 'Camila Lima',
    vendedorCargo: 'Proprietária',
    formaPagamento: 'dinheiro',
    status: 'pago',
    total: 260.00,
    valorSinalPago: 260.00,
    saldoNaEntrega: 0,
    statusProducao: 'entregue',
    itens: [
      { id: 'it-14', nome: 'Lembrancinhas Bem-Nascidos (30 un)', categoria: 'Doces Finos', quantidade: 1, precoUnitario: 260.00, totalItem: 260.00 },
    ],
    observacoes: 'Fitas personalizadas com tag "Clara".',
  },

  // SEXTA-FEIRA (16/10)
  {
    id: 'ped-1040',
    codigoDisplay: '#PED-1040',
    clienteNome: 'Rodrigo Santoro Silva',
    clienteTelefone: '(21) 99321-7890',
    clienteEmail: 'rodrigo.silva@advocacia.com',
    tag: 'Corporativo',
    tipoPedido: 'pronta_entrega',
    data: '2026-10-16T15:30:00.000Z',
    dataDisplay: '16/10/2026',
    horaDisplay: '15:30',
    diaChave: '2026-10-16',
    diaTitulo: 'Sexta-feira, 16 de Outubro',
    vendedor: 'Juliana Carvalho',
    vendedorCargo: 'Atendimento Balcão',
    formaPagamento: 'cartao_debito',
    status: 'pago',
    total: 185.00,
    valorSinalPago: 185.00,
    saldoNaEntrega: 0,
    statusProducao: 'entregue',
    itens: [
      { id: 'it-15', nome: 'Caixa Degustação Doces Franceses', categoria: 'Doces Finos', quantidade: 2, precoUnitario: 92.50, totalItem: 185.00 },
    ],
    observacoes: 'Nota fiscal corporativa emitida.',
  },
  {
    id: 'ped-1039',
    codigoDisplay: '#PED-1039',
    clienteNome: 'Renata Fraga',
    clienteTelefone: '(21) 98777-6655',
    clienteEmail: 'renata.fraga@design.com',
    tag: 'Instagram',
    tipoPedido: 'sob_encomenda',
    data: '2026-10-16T10:00:00.000Z',
    dataDisplay: '16/10/2026',
    horaDisplay: '10:00',
    diaChave: '2026-10-16',
    diaTitulo: 'Sexta-feira, 16 de Outubro',
    vendedor: 'Camila Lima',
    vendedorCargo: 'Proprietária',
    formaPagamento: 'pix',
    status: 'pendente',
    total: 400.00,
    valorSinalPago: 0,
    saldoNaEntrega: 400.00,
    statusProducao: 'a_fazer',
    itens: [
      { id: 'it-16', nome: 'Bolo Casamento Boho 3 Andares (Maquete)', categoria: 'Bolos & Bentos', quantidade: 1, precoUnitario: 400.00, totalItem: 400.00 },
    ],
    observacoes: 'Aguardando confirmação do pagamento do sinal.',
  },
];

const MOCK_ESTOQUE: EstoqueItem[] = [
  { id: 'est-1', nome: 'Cookie Duo Red Velvet c/ Ninho', categoria: 'Cookies', preco: 13.90, estoque: 48, estoqueMinimo: 20, status: 'normal' },
  { id: 'est-2', nome: 'Cookie Tradicional Gotas Belga', categoria: 'Cookies', preco: 13.90, estoque: 55, estoqueMinimo: 20, status: 'normal' },
  { id: 'est-3', nome: 'Bento Cake Pistache & Framboesa', categoria: 'Bolos & Bentos', preco: 65.00, estoque: 8, estoqueMinimo: 5, status: 'normal' },
  { id: 'est-4', nome: 'Bento Cake Red Velvet', categoria: 'Bolos & Bentos', preco: 70.00, estoque: 4, estoqueMinimo: 5, status: 'baixo' },
  { id: 'est-5', nome: 'Caixa Macarons Degustação (6 un)', categoria: 'Macarons', preco: 57.00, estoque: 16, estoqueMinimo: 10, status: 'normal' },
  { id: 'est-6', nome: 'Torre de Macarons 24 unidades', categoria: 'Macarons', preco: 220.00, estoque: 3, estoqueMinimo: 4, status: 'baixo' },
  { id: 'est-7', nome: 'Fatia Torta Ópera Café & Ganache', categoria: 'Sobremesas', preco: 33.50, estoque: 12, estoqueMinimo: 8, status: 'normal' },
  { id: 'est-8', nome: 'Fatia Cheesecake Frutas Silvestres', categoria: 'Sobremesas', preco: 32.50, estoque: 9, estoqueMinimo: 6, status: 'normal' },
  { id: 'est-9', nome: 'Cento de Brigadeiros Gourmet Belga', categoria: 'Doces Finos', preco: 160.00, estoque: 22, estoqueMinimo: 10, status: 'normal' },
  { id: 'est-10', nome: 'Farinha de Amêndoas Pura (França)', categoria: 'Insumos', preco: 98.00, estoque: 0, estoqueMinimo: 5, status: 'zerado' },
];

const CHAVE_PIX_ATELIE = '21974162007';
const TITULAR_PIX = 'Camila Lima (Kipi Ateliê)';
const BANCO_PIX = 'Nubank';

export default function PedidosScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // SIDEBAR RETRÁTIL / EXPANSÍVEL (IDÊNTICO À VISÃO GERAL)
  const [menuHovered, setMenuHovered] = useState(false);
  const [menuPinned, setMenuPinned] = useState(true);
  const menuExpanded = isDesktop ? (menuPinned || menuHovered) : false;

  // ESTADOS DE DADOS
  const [pedidos, setPedidos] = useState<Pedido[]>(MOCK_PEDIDOS);
  const [estoque] = useState<EstoqueItem[]>(MOCK_ESTOQUE);

  // FILTROS (MESMA LÓGICA E DESIGN SYSTEM DA VISÃO GERAL)
  const [periodo, setPeriodo] = useState<Periodo>('7dias');
  const [filtroTipo, setFiltroTipo] = useState<TipoPedido>('todos');
  const [filtroPagamento, setFiltroPagamento] = useState<StatusPagamento>('todos');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [termoBusca, setTermoBusca] = useState('');

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

  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [pedidoParaEditar, setPedidoParaEditar] = useState<Pedido | null>(null);
  const [editObservacoes, setEditObservacoes] = useState('');

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

      // Busca por texto
      if (termoBusca.trim() !== '') {
        const b = termoBusca.toLowerCase().trim();
        const noCod = p.codigoDisplay.toLowerCase().includes(b);
        const noCli = p.clienteNome.toLowerCase().includes(b);
        const noVend = p.vendedor.toLowerCase().includes(b);
        const nosItens = p.itens.some((i) => i.nome.toLowerCase().includes(b));
        if (!noCod && !noCli && !noVend && !nosItens) return false;
      }

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
      if (periodo === 'hoje') {
        const hojeStr = new Date().toISOString().split('T')[0];
        if (p.diaChave !== hojeStr && !p.diaChave.includes('2026-10-19')) return false;
      } else if (periodo === 'personalizar') {
        if (p.diaChave < dataInicioPersonalizada || p.diaChave > dataFimPersonalizada) return false;
      }

      return true;
    });
  }, [pedidos, termoBusca, filtroTipo, filtroPagamento, filtroVendedor, periodo, dataInicioPersonalizada, dataFimPersonalizada]);

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
    };
  }, [pedidosFiltrados, estoque]);

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
  const top3Clientes = useMemo(() => {
    const mapa = new Map<string, { nome: string; qtdItens: number; totalGasto: number; pedidosCount: number }>();
    pedidos.forEach((p) => {
      if (p.deletado || p.clienteNome.toLowerCase().includes('venda avulsa')) return;
      if (!mapa.has(p.clienteNome)) {
        mapa.set(p.clienteNome, { nome: p.clienteNome, qtdItens: 0, totalGasto: 0, pedidosCount: 0 });
      }
      const cli = mapa.get(p.clienteNome)!;
      cli.pedidosCount += 1;
      cli.totalGasto += p.total;
      p.itens.forEach((it) => {
        cli.qtdItens += it.quantidade;
      });
    });
    return Array.from(mapa.values()).sort((a, b) => b.qtdItens - a.qtdItens).slice(0, 3);
  }, [pedidos]);

  // AÇÕES
  const abrirModalBaixa = (pedido: Pedido) => {
    setPedidoParaBaixa(pedido);
    setBaixaValor(pedido.saldoNaEntrega > 0 ? pedido.saldoNaEntrega.toFixed(2) : pedido.total.toFixed(2));
    setBaixaFormaPagamento('pix');
    setModalBaixaAberto(true);
  };

  const confirmarBaixa = () => {
    if (!pedidoParaBaixa) return;
    setPedidos((prev) =>
      prev.map((p) => {
        if (p.id === pedidoParaBaixa.id) {
          return {
            ...p,
            status: 'pago',
            formaPagamento: baixaFormaPagamento,
            valorSinalPago: p.total,
            saldoNaEntrega: 0,
          };
        }
        return p;
      })
    );

    if (pedidoSelecionado && pedidoSelecionado.id === pedidoParaBaixa.id) {
      setPedidoSelecionado({
        ...pedidoSelecionado,
        status: 'pago',
        formaPagamento: baixaFormaPagamento,
        valorSinalPago: pedidoSelecionado.total,
        saldoNaEntrega: 0,
      });
    }

    setModalBaixaAberto(false);
    exibirToast(`✓ Pagamento do pedido ${pedidoParaBaixa.codigoDisplay} quitado com sucesso!`);
    setPedidoParaBaixa(null);
  };

  const gerarTextoWhatsApp = (pedido: Pedido): string => {
    const itensTexto = pedido.itens
      .map((it) => `• ${it.quantidade}x ${it.nome} (R$ ${it.precoUnitario.toFixed(2)} un) = R$ ${it.totalItem.toFixed(2)}`)
      .join('\n');

    return `🧁 *KIPI ATELIÊ • COMPROVANTE DE PEDIDO*
Número: *${pedido.codigoDisplay}*
Data: ${pedido.dataDisplay} às ${pedido.horaDisplay}
Cliente: *${pedido.clienteNome}*
Atendente: ${pedido.vendedor}

📦 *ITENS DO PEDIDO:*
${itensTexto}

💰 *TOTAL:* R$ ${pedido.total.toFixed(2)}
Status: ${pedido.status === 'pago' ? '✅ Pago' : '⏳ Pendente de Pagamento'}

🔑 *CHAVE PIX PARA PAGAMENTO:*
Chave (Celular): *${CHAVE_PIX_ATELIE}*
Favorecido: ${TITULAR_PIX}
Banco: ${BANCO_PIX}

Agradecemos imensamente a sua preferência e carinho! ✨
_Kipi Ateliê de Confeitaria Artesanal_`;
  };

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
    setPedidos((prev) =>
      prev.map((p) => {
        if (p.id === pedidoParaExcluir.id) {
          return { ...p, deletado: true, status: 'cancelado' };
        }
        return p;
      })
    );
    if (pedidoSelecionado?.id === pedidoParaExcluir.id) {
      setPedidoSelecionado(null);
    }
    setModalExcluirAberto(false);
    exibirToast(`🗑 Pedido ${pedidoParaExcluir.codigoDisplay} cancelado logicamente.`);
    setPedidoParaExcluir(null);
  };

  const lidarComPedidoCriado = (novaVenda: any) => {
    const hoje = new Date();
    const dataDisplay = hoje.toLocaleDateString('pt-BR');
    const horaDisplay = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const diaChave = hoje.toISOString().split('T')[0];

    const novoPedido: Pedido = {
      id: novaVenda.id || `ped_${Date.now()}`,
      codigoDisplay: `#PED-${1050 + pedidos.length}`,
      clienteNome: novaVenda.cliente_id ? 'Cliente Cadastrado' : 'Venda Avulsa (Balcão)',
      clienteTelefone: null,
      clienteEmail: null,
      tag: novaVenda.tipo_pedido === 'sob_encomenda' ? 'Encomenda' : 'Pronta Entrega',
      tipoPedido: novaVenda.tipo_pedido === 'sob_encomenda' ? 'sob_encomenda' : 'pronta_entrega',
      data: hoje.toISOString(),
      dataDisplay,
      horaDisplay,
      diaChave,
      diaTitulo: `Hoje • ${hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      vendedor: 'Camila Lima',
      vendedorCargo: 'Proprietária',
      formaPagamento: novaVenda.pagamento || 'pix',
      status: novaVenda.status === 'pago' ? 'pago' : 'pendente',
      total: Number(novaVenda.total) || 0,
      valorSinalPago: novaVenda.status === 'pago' ? Number(novaVenda.total) || 0 : 0,
      saldoNaEntrega: novaVenda.status === 'pago' ? 0 : Number(novaVenda.total) || 0,
      statusProducao: novaVenda.tipo_pedido === 'sob_encomenda' ? 'a_fazer' : 'pronto',
      itens: [
        {
          id: `it_${Date.now()}`,
          nome: 'Produto Registrado no Balcão',
          categoria: 'Confeitaria',
          quantidade: 1,
          precoUnitario: Number(novaVenda.total) || 0,
          totalItem: Number(novaVenda.total) || 0,
        },
      ],
      observacoes: novaVenda.observacoes || null,
    };

    setPedidos((prev) => [novoPedido, ...prev]);
    exibirToast(`🎉 Pedido ${novoPedido.codigoDisplay} registrado com sucesso!`);
  };

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.mainLayout}>

        {/* =========================================================================
            MENU LATERAL (IDÊNTICO À TELA DE VISÃO GERAL)
        ========================================================================== */}
        <View
          style={[
            styles.sidebar,
            menuExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed,
          ]}
          // @ts-ignore
          onMouseEnter={() => !menuPinned && setMenuHovered(true)}
          // @ts-ignore
          onMouseLeave={() => !menuPinned && setMenuHovered(false)}>

          {/* TOPO COM LOGO KIPI */}
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
                  if (item.route && item.route !== '/pedidos') {
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
            ÁREA DE CONTEÚDO PRINCIPAL (DASHBOARD COM OS MESMOS COMPONENTES)
        ========================================================================== */}
        <View style={styles.contentArea}>

          {/* BARRA SUPERIOR IDÊNTICA À VISÃO GERAL */}
          <View style={styles.topBar}>
            <View style={styles.topBarSearchBox}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.topBarSearchInput}
                placeholder="Buscar por #PED, cliente, produto..."
                placeholderTextColor="#94A3B8"
                value={termoBusca}
                onChangeText={setTermoBusca}
              />
              <View style={styles.searchShortcutBadge}>
                <Text style={styles.searchShortcutText}>⌘K</Text>
              </View>
            </View>

            <View style={styles.topBarRight}>
              <View style={styles.kitchenBadge}>
                <View style={styles.kitchenDot} />
                <Text style={styles.kitchenBadgeText}>
                  {pedidosFiltrados.length} pedidos no filtro
                </Text>
              </View>

              <TouchableOpacity style={styles.iconCircleBtn} activeOpacity={0.8}>
                <Feather name="bell" size={17} color="#475569" />
                <View style={styles.bellAlertDot} />
              </TouchableOpacity>

              <View style={styles.profileBadge}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>CL</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>Camila Lima</Text>
                  <Text style={styles.profileRole}>PROPRIETÁRIA</Text>
                </View>
              </View>
            </View>
          </View>

          {/* SCROLL DO CONTEÚDO PRINCIPAL */}
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>

            {/* 1. BANNER DE SAUDAÇÃO IDÊNTICO À REFERÊNCIA ATELIERQ */}
            <View style={styles.greetingBanner}>
              <View style={styles.greetingLeft}>
                <View style={styles.chefAvatarBox}>
                  <View style={styles.chefAvatarInner}>
                    <Text style={styles.chefEmoji}>🧁</Text>
                  </View>
                  <View style={styles.chefStatusDot}>
                    <Text style={styles.chefStatusPlus}>✓</Text>
                  </View>
                </View>

                <View style={styles.greetingTextCol}>
                  <View style={styles.greetingTitleRow}>
                    <Text style={styles.greetingTitle}>
                      Gestão de Pedidos & Vendas
                    </Text>
                    <View style={styles.ovenBadge}>
                      <View style={styles.ovenDot} />
                      <Text style={styles.ovenBadgeText}>
                        {kpis.qtdPendentes > 0 ? `${kpis.qtdPendentes} aguardam baixa` : 'Caixa em dia'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.greetingDescription}>
                    Histórico detalhado por data, controle de recebimentos, emissão de WhatsApp e baixa ágil.
                  </Text>
                  <TouchableOpacity activeOpacity={0.75} onPress={() => setModalAReceberAberto(true)}>
                    <Text style={styles.greetingTipLink}>
                      *Petite dica: {kpis.totalAReceber} pendentes para recebimento na entrega hoje. Clique para conferir ↗*
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* CARD DE DESTAQUE DENTRO DO BANNER */}
              <View style={styles.greetingKpiCard}>
                <View style={styles.greetingKpiIconBox}>
                  <Feather name="shopping-bag" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.greetingKpiInfo}>
                  <Text style={styles.greetingKpiTag}>FATURAMENTO DO PERÍODO</Text>
                  <Text style={styles.greetingKpiValue}>
                    {kpis.totalVendido} <Text style={styles.greetingKpiSub}>({kpis.totalItens})</Text>
                  </Text>
                  <Text style={styles.greetingKpiDesc}>
                    Média de {kpis.mediaItensPorPedido} itens por pedido registrado.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.greetingKpiBtn}
                  onPress={() => setModalNovoPedidoAberto(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.greetingKpiBtnText}>+ Vender</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. LINHA DE FILTROS IDÊNTICA À VISÃO GERAL */}
            <View style={styles.filtersBar}>
              <View style={styles.periodTabs}>
                {(['hoje', '7dias', 'mes', 'personalizar'] as Periodo[]).map((p) => {
                  const labels = {
                    hoje: 'Hoje',
                    '7dias': '7 dias',
                    mes: 'Mês',
                    personalizar: 'Personalizar 📅',
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

            {/* BARRA SECUNDÁRIA DE FILTROS REFINADOS */}
            <View style={styles.subFiltersStrip}>
              {/* FILTRO TIPO */}
              <View style={styles.subFilterGroup}>
                <Text style={styles.subFilterLabel}>TIPO:</Text>
                <View style={styles.subFilterPills}>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'pronta_entrega', label: 'Pronta Entrega' },
                    { id: 'sob_encomenda', label: 'Sob Encomenda' },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.subPill, filtroTipo === t.id && styles.subPillActive]}
                      onPress={() => setFiltroTipo(t.id as any)}>
                      <Text style={[styles.subPillText, filtroTipo === t.id && styles.subPillTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* FILTRO PAGAMENTO */}
              <View style={styles.subFilterGroup}>
                <Text style={styles.subFilterLabel}>PAGAMENTO:</Text>
                <View style={styles.subFilterPills}>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'pendentes', label: 'Pendentes' },
                    { id: 'pagos', label: 'Pagos' },
                  ].map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.subPill,
                        filtroPagamento === p.id && styles.subPillActive,
                        p.id === 'pendentes' && filtroPagamento === 'pendentes' && { backgroundColor: '#DC2626' },
                      ]}
                      onPress={() => setFiltroPagamento(p.id as any)}>
                      <Text
                        style={[
                          styles.subPillText,
                          filtroPagamento === p.id && styles.subPillTextActive,
                          p.id === 'pendentes' && filtroPagamento !== 'pendentes' && { color: '#DC2626' },
                        ]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* FILTRO VENDEDOR */}
              <View style={styles.subFilterGroup}>
                <Text style={styles.subFilterLabel}>VENDEDOR:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'Camila Lima', label: 'Camila Lima (Dona)' },
                    { id: 'Juliana Carvalho', label: 'Juliana Carvalho (Balcão)' },
                    { id: 'Sofia Ramos', label: 'Sofia Ramos' },
                    { id: 'Café & Flor', label: 'Café & Flor' },
                  ].map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.subPill, filtroVendedor === v.id && styles.subPillActive]}
                      onPress={() => setFiltroVendedor(v.id)}>
                      <Text style={[styles.subPillText, filtroVendedor === v.id && styles.subPillTextActive]}>
                        {v.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
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
                  <Text style={styles.kpiLabel}>ITENS VENDIDOS</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#EAF3FA' }]}>
                    <Feather name="shopping-bag" size={15} color="#5798D7" />
                  </View>
                </View>
                <Text style={styles.kpiMainNumber}>{kpis.totalItens}</Text>
                <View style={styles.kpiFooter}>
                  <View style={styles.kpiDiffPillBlue}>
                    <Text style={styles.kpiDiffPillBlueText}>Média {kpis.mediaItensPorPedido}/ped</Text>
                  </View>
                  <Text style={styles.kpiFooterNote}>Volume de produção</Text>
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
                  <Text style={styles.kpiLabel}>ESTOQUE GERAL (CLIQUE ↗)</Text>
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
                                      {ped.tipoPedido === 'sob_encomenda' ? 'Sob Encomenda' : 'Pronta Entrega'}
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
                                    {ped.tag && (
                                      <View style={styles.clientTagBadge}>
                                        <Text style={styles.clientTagBadgeText}>{ped.tag}</Text>
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
                                    onPress={() => {
                                      setPedidoParaEditar(ped);
                                      setEditObservacoes(ped.observacoes || '');
                                      setModalEditarAberto(true);
                                    }}>
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
                        <Text style={styles.sideDetailClientName}>{pedidoSelecionado.clienteNome}</Text>
                        <Text style={styles.sideDetailClientSub}>
                          {pedidoSelecionado.clienteTelefone || 'Telefone não cadastrado'}
                        </Text>
                        <Text style={styles.sideDetailClientSub}>
                          Atendido por: {pedidoSelecionado.vendedor}
                        </Text>
                      </View>
                    </View>

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
                        Chave Pix: {CHAVE_PIX_ATELIE} ({TITULAR_PIX})
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
                        <View key={cli.nome} style={styles.sideTopRow}>
                          <Text style={{ fontSize: 16 }}>{medalhas[idx]}</Text>
                          <View style={styles.sideClientAvatarMini}>
                            <Text style={styles.sideClientAvatarText}>{iniciais}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sideTopName}>{cli.nome}</Text>
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
          <View style={styles.modalCard}>
            <View style={styles.modalCardHeader}>
              <View>
                <View style={styles.modalTagBadge}>
                  <Text style={styles.modalTagBadgeText}>FINANCEIRO • BAIXA</Text>
                </View>
                <Text style={styles.modalCardTitle}>Dar Baixa de Pagamento</Text>
              </View>
              <TouchableOpacity onPress={() => setModalBaixaAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {pedidoParaBaixa && (
              <View style={{ gap: 12, marginTop: 14 }}>
                <View style={styles.modalSummaryBox}>
                  <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 14 }}>
                    {pedidoParaBaixa.codigoDisplay} • {pedidoParaBaixa.clienteNome}
                  </Text>
                  <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 16, marginTop: 2 }}>
                    Valor a Receber: R$ {pedidoParaBaixa.saldoNaEntrega.toFixed(2)}
                  </Text>
                </View>

                <Text style={styles.modalInputLabel}>FORMA DE PAGAMENTO:</Text>
                <View style={styles.modalPayGrid}>
                  {[
                    { id: 'pix', label: 'Pix', icon: 'zap' },
                    { id: 'cartao_credito', label: 'Cartão Crédito', icon: 'credit-card' },
                    { id: 'cartao_debito', label: 'Cartão Débito', icon: 'credit-card' },
                    { id: 'dinheiro', label: 'Dinheiro', icon: 'dollar-sign' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.modalPayBtn, baixaFormaPagamento === opt.id && styles.modalPayBtnActive]}
                      onPress={() => setBaixaFormaPagamento(opt.id as any)}>
                      <Feather name={opt.icon as any} size={15} color={baixaFormaPagamento === opt.id ? KipiPalette.icedDenim : '#64748B'} />
                      <Text style={[styles.modalPayBtnText, baixaFormaPagamento === opt.id && styles.modalPayBtnTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalInputLabel}>VALOR RECEBIDO (R$):</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={baixaValor}
                  onChangeText={setBaixaValor}
                  keyboardType="numeric"
                />

                <View style={styles.modalActionsRow}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalBaixaAberto(false)}>
                    <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnConfirm} onPress={confirmarBaixa}>
                    <Feather name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.modalBtnConfirmText}>Confirmar Recebimento</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 2. MODAL A RECEBER */}
      <Modal visible={modalAReceberAberto} transparent animationType="fade" onRequestClose={() => setModalAReceberAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 640 }]}>
            <View style={styles.modalCardHeader}>
              <View>
                <View style={[styles.modalTagBadge, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.modalTagBadgeText, { color: '#DC2626' }]}>CONTAS A RECEBER</Text>
                </View>
                <Text style={styles.modalCardTitle}>Clientes com Pedidos Pendentes</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Total a receber: <Text style={{ color: '#DC2626', fontWeight: '800' }}>{kpis.totalAReceber}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalAReceberAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380, marginTop: 12 }}>
              {pedidos.filter((p) => !p.deletado && p.status === 'pendente').map((ped) => (
                <View key={ped.id} style={styles.modalPendingLine}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
                      {ped.clienteNome} ({ped.codigoDisplay})
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      {ped.dataDisplay} • Vendedor: {ped.vendedor}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#DC2626', marginTop: 2 }}>
                      R$ {ped.saldoNaEntrega.toFixed(2)} devido
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.modalMiniBtnWpp}
                      onPress={() => copiarWhatsApp(ped)}>
                      <Feather name="message-circle" size={13} color="#16A34A" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#16A34A' }}>WPP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalMiniBtnBaixa}
                      onPress={() => {
                        setModalAReceberAberto(false);
                        abrirModalBaixa(ped);
                      }}>
                      <Feather name="check" size={13} color="#FFFFFF" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>Dar Baixa</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3. MODAL ESTOQUE */}
      <Modal visible={modalEstoqueAberto} transparent animationType="fade" onRequestClose={() => setModalEstoqueAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 660 }]}>
            <View style={styles.modalCardHeader}>
              <View>
                <View style={[styles.modalTagBadge, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={[styles.modalTagBadgeText, { color: '#0284C7' }]}>INVENTÁRIO DO ATELIÊ</Text>
                </View>
                <Text style={styles.modalCardTitle}>Estoque por Produto & Categoria</Text>
              </View>
              <TouchableOpacity onPress={() => setModalEstoqueAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ marginVertical: 12, gap: 8 }}>
              <TextInput
                style={styles.modalSearchField}
                placeholder="Buscar produto no estoque..."
                placeholderTextColor="#94A3B8"
                value={buscaEstoque}
                onChangeText={setBuscaEstoque}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['Todas', 'Cookies', 'Bolos & Bentos', 'Macarons', 'Sobremesas', 'Doces Finos', 'Insumos'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.modalCatChip, categoriaEstoque === c && styles.modalCatChipActive]}
                    onPress={() => setCategoriaEstoque(c)}>
                    <Text style={[styles.modalCatChipText, categoriaEstoque === c && styles.modalCatChipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {estoque
                .filter((p) => {
                  const mBusca = !buscaEstoque || p.nome.toLowerCase().includes(buscaEstoque.toLowerCase());
                  const mCat = categoriaEstoque === 'Todas' || p.categoria === categoriaEstoque;
                  return mBusca && mCat;
                })
                .map((prod) => (
                  <View key={prod.id} style={styles.modalStockLine}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{prod.nome}</Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>
                        {prod.categoria} • R$ {prod.preco.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.stockStatusBadge, prod.status === 'zerado' ? { backgroundColor: '#FEE2E2' } : prod.status === 'baixo' ? { backgroundColor: '#FEF3C7' } : { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.stockStatusBadgeText, prod.status === 'zerado' ? { color: '#DC2626' } : prod.status === 'baixo' ? { color: '#D97706' } : { color: '#16A34A' }]}>
                        {prod.estoque} un. disponíveis
                      </Text>
                    </View>
                  </View>
                ))}
            </ScrollView>
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

      {/* MODAL NOVO PEDIDO COMPLETO */}
      <NovoPedidoModal
        visible={modalNovoPedidoAberto}
        onClose={() => setModalNovoPedidoAberto(false)}
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

  // BANNER DE SAUDAÇÃO
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
    fontSize: 28,
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
    paddingHorizontal: 12,
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
