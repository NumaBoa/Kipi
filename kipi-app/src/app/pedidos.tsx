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
// TIPOS E INTERFACES
// ============================================================================

export type PeriodoFiltro = 'hoje' | '7dias' | 'mes' | 'personalizado';
export type TipoPedidoFiltro = 'todos' | 'pronta_entrega' | 'sob_encomenda';
export type StatusPagamentoFiltro = 'todos' | 'pendentes' | 'pagos';

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
  data: string; // ISO ou string formatada
  dataDisplay: string; // ex: 19/10/2026
  horaDisplay: string; // ex: 14:35
  diaChave: string; // ex: 2026-10-19
  diaTitulo: string; // ex: Hoje • Segunda-feira, 19 de Outubro
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

export interface EstoqueProduto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  estoqueMinimo: number;
  status: 'normal' | 'baixo' | 'zerado';
}

// ============================================================================
// DADOS MOCK INICIAIS REALISTAS (ATELIERQ PÂTISSERIE)
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
      {
        id: 'it-1',
        nome: 'Bento Cake Pistache & Framboesa',
        categoria: 'Bolos & Bentos',
        quantidade: 2,
        precoUnitario: 65.00,
        totalItem: 130.00,
      },
      {
        id: 'it-2',
        nome: 'Cookie Duo Red Velvet c/ Ninho',
        categoria: 'Cookies',
        quantidade: 1,
        precoUnitario: 13.90,
        totalItem: 13.90,
      },
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
      {
        id: 'it-3',
        nome: 'Caixa Macarons Degustação (6 un)',
        categoria: 'Macarons',
        quantidade: 1,
        precoUnitario: 57.00,
        totalItem: 57.00,
      },
      {
        id: 'it-4',
        nome: 'Fatia Cheesecake Frutas Silvestres',
        categoria: 'Sobremesas',
        quantidade: 1,
        precoUnitario: 32.50,
        totalItem: 32.50,
      },
    ],
    observacoes: 'Embalagem para presente com cartãozinho de agradecimento.',
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
      {
        id: 'it-5',
        nome: 'Cookie Tradicional Gotas Belga',
        categoria: 'Cookies',
        quantidade: 3,
        precoUnitario: 13.90,
        totalItem: 41.70,
      },
    ],
    observacoes: 'Consumo no bistrô com café expresso.',
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
      {
        id: 'it-6',
        nome: 'Bolo Decorado Flores de Açúcar 20 fatias',
        categoria: 'Bolos & Bentos',
        quantidade: 1,
        precoUnitario: 320.00,
        totalItem: 320.00,
      },
      {
        id: 'it-7',
        nome: 'Cento de Brigadeiros Gourmet Belga',
        categoria: 'Doces Finos',
        quantidade: 1,
        precoUnitario: 160.00,
        totalItem: 160.00,
      },
    ],
    observacoes: 'Entregue pontualmente às 17h no salão de festas.',
  },
  {
    id: 'ped-1044',
    codigoDisplay: '#PED-1044',
    clienteNome: 'Café & Flor Bistrô',
    clienteTelefone: '(21) 97654-1100',
    clienteEmail: 'compras@cafeflor.com.br',
    tag: 'Revendedora Parceira',
    tipoPedido: 'pronta_entrega',
    data: '2026-10-18T10:15:00.000Z',
    dataDisplay: '18/10/2026',
    horaDisplay: '10:15',
    diaChave: '2026-10-18',
    diaTitulo: 'Domingo, 18 de Outubro (Ontem)',
    vendedor: 'Café & Flor Bistrô',
    vendedorCargo: 'Revenda Consignada',
    formaPagamento: 'pix',
    status: 'pendente',
    total: 390.00,
    valorSinalPago: 0,
    saldoNaEntrega: 390.00,
    statusProducao: 'pronto',
    itens: [
      {
        id: 'it-8',
        nome: 'Cookie Tradicional Gotas Belga',
        categoria: 'Cookies',
        quantidade: 15,
        precoUnitario: 12.00,
        comDesconto: true,
        desconto: 1.90,
        totalItem: 180.00,
      },
      {
        id: 'it-9',
        nome: 'Bento Cake Red Velvet',
        categoria: 'Bolos & Bentos',
        quantidade: 3,
        precoUnitario: 70.00,
        totalItem: 210.00,
      },
    ],
    observacoes: 'Remessa consignada de fim de semana. Acerto previsto para terça.',
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
      {
        id: 'it-10',
        nome: 'Torre de Macarons 24 unidades',
        categoria: 'Macarons',
        quantidade: 1,
        precoUnitario: 220.00,
        totalItem: 220.00,
      },
      {
        id: 'it-11',
        nome: 'Cinquenta Doces Finos Pistache & Ouro',
        categoria: 'Doces Finos',
        quantidade: 1,
        precoUnitario: 120.00,
        totalItem: 120.00,
      },
    ],
    observacoes: 'Cliente elogiou muito a apresentação.',
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
      {
        id: 'it-12',
        nome: 'Cookie Duo Red Velvet c/ Ninho',
        categoria: 'Cookies',
        quantidade: 20,
        precoUnitario: 13.90,
        totalItem: 278.00,
      },
      {
        id: 'it-13',
        nome: 'Fatia Torta Ópera Café & Ganache',
        categoria: 'Sobremesas',
        quantidade: 8,
        precoUnitario: 33.50,
        totalItem: 268.00,
      },
    ],
    observacoes: 'Fechamento semanal da boutique pendente.',
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
      {
        id: 'it-14',
        nome: 'Lembrancinhas Bem-Nascidos (30 un)',
        categoria: 'Doces Finos',
        quantidade: 1,
        precoUnitario: 260.00,
        totalItem: 260.00,
      },
    ],
    observacoes: 'Fita rosa bebê com tag personalizada com o nome Clara.',
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
      {
        id: 'it-15',
        nome: 'Caixa Degustação Doces Franceses',
        categoria: 'Doces Finos',
        quantidade: 2,
        precoUnitario: 92.50,
        totalItem: 185.00,
      },
    ],
    observacoes: 'Nota fiscal enviada por email.',
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
      {
        id: 'it-16',
        nome: 'Bolo Casamento Boho 3 Andares (Maquete + Corte)',
        categoria: 'Bolos & Bentos',
        quantidade: 1,
        precoUnitario: 400.00,
        totalItem: 400.00,
      },
    ],
    observacoes: 'Aguardando confirmação do comprovante do sinal.',
  },
];

const MOCK_ESTOQUE: EstoqueProduto[] = [
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

const VENDEDORES_LISTA = [
  { id: 'todos', nome: 'Todos os Vendedores', papel: 'Todos' },
  { id: 'camila', nome: 'Camila Lima', papel: 'Proprietária (Dona da Loja)' },
  { id: 'juliana', nome: 'Juliana Carvalho', papel: 'Atendimento & Balcão' },
  { id: 'sofia', nome: 'Sofia Ramos', papel: 'Confeitaria Artística' },
  { id: 'cafeflor', nome: 'Café & Flor Bistrô', papel: 'Revendedora' },
  { id: 'docecharme', nome: 'Boutique Doce Charme', papel: 'Revendedora' },
];

const CHAVE_PIX_ATELIE = '21974162007';
const TITULAR_PIX = 'Camila Lima (Kipi Ateliê de Confeitaria)';
const BANCO_PIX = 'Nubank';

// ============================================================================
// COMPONENTE PRINCIPAL: PEDIDOS & VENDAS
// ============================================================================

export default function PedidosScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  // ESTADO DO MENU LATERAL
  const [menuHovered, setMenuHovered] = useState(false);
  const [menuPinned, setMenuPinned] = useState(true);
  const menuExpanded = isDesktop ? (menuPinned || menuHovered) : false;

  // DADOS DE PEDIDOS E ESTOQUE
  const [pedidos, setPedidos] = useState<Pedido[]>(MOCK_PEDIDOS);
  const [estoque, setEstoque] = useState<EstoqueProduto[]>(MOCK_ESTOQUE);

  // FILTROS PRINCIPAIS
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoFiltro>('todos' as any); // default todos
  const [filtroTipo, setFiltroTipo] = useState<TipoPedidoFiltro>('todos');
  const [filtroPagamento, setFiltroPagamento] = useState<StatusPagamentoFiltro>('todos');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [termoBusca, setTermoBusca] = useState('');

  // FILTRO PERSONALIZADO (DATAS)
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState('2026-10-01');
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState('2026-10-31');

  // MODO DE VISUALIZAÇÃO: 'lista' OU 'cards'
  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'cards'>('lista');

  // PEDIDO SELECIONADO PARA EXPANSÃO MODERNA (DRAWER LATERAL DESLIZANTE)
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);

  // MODAIS
  const [modalNovoPedidoAberto, setModalNovoPedidoAberto] = useState(false);
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false);
  const [pedidoParaBaixa, setPedidoParaBaixa] = useState<Pedido | null>(null);
  const [baixaFormaPagamento, setBaixaFormaPagamento] = useState<'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'>('pix');
  const [baixaValor, setBaixaValor] = useState<string>('');

  const [modalAReceberAberto, setModalAReceberAberto] = useState(false);
  const [modalEstoqueAberto, setModalEstoqueAberto] = useState(false);
  const [buscaEstoque, setBuscaEstoque] = useState('');
  const [categoriaEstoque, setCategoriaEstoque] = useState('Todas');

  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [pedidoParaEditar, setPedidoParaEditar] = useState<Pedido | null>(null);
  const [editObservacoes, setEditObservacoes] = useState('');

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [pedidoParaExcluir, setPedidoParaExcluir] = useState<Pedido | null>(null);

  // FEEDBACKS TOAST
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);

  const exibirToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => {
      setToastMensagem(null);
    }, 2800);
  };

  // NAVEGAÇÃO LATERAL
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

  // USUÁRIO LOGADO
  const usuario = {
    nome: 'Camila Lima',
    papel: 'Proprietária & Chef',
    email: 'camila.c.lima08@gmail.com',
  };

  // BUSCAR DADOS DO SUPABASE AO MONTAR (COM FALLBACK SUAVE)
  useEffect(() => {
    async function sincronizarSupabase() {
      try {
        const { data: vendasData, error: vendasError } = await supabase
          .from('vendas')
          .select(`
            *,
            clientes (nome, telefone, email),
            venda_itens (*)
          `)
          .order('created_at', { ascending: false })
          .limit(40);

        if (!vendasError && vendasData && vendasData.length > 0) {
          const formatados: Pedido[] = vendasData.map((v: any, index: number) => {
            const dataVenda = new Date(v.created_at || v.data || Date.now());
            const dataDisplay = dataVenda.toLocaleDateString('pt-BR');
            const horaDisplay = dataVenda.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const diaChave = dataVenda.toISOString().split('T')[0];

            let diaTitulo = `${dataVenda.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`;
            diaTitulo = diaTitulo.charAt(0).toUpperCase() + diaTitulo.slice(1);

            const hojeStr = new Date().toISOString().split('T')[0];
            if (diaChave === hojeStr) {
              diaTitulo = `Hoje • ${diaTitulo}`;
            }

            const itensMapped: PedidoItem[] = (v.venda_itens || []).map((it: any) => ({
              id: it.id || String(Math.random()),
              nome: it.nome_produto || 'Produto Especial',
              categoria: 'Confeitaria',
              quantidade: Number(it.quantidade) || 1,
              precoUnitario: Number(it.preco_unitario) || 0,
              comDesconto: Boolean(it.com_desconto),
              totalItem: (Number(it.quantidade) || 1) * (Number(it.preco_unitario) || 0),
            }));

            return {
              id: v.id,
              codigoDisplay: `#PED-${1050 + index}`,
              clienteNome: v.clientes?.nome || (v.cliente_id ? 'Cliente Cadastrado' : 'Venda Avulsa (Balcão)'),
              clienteTelefone: v.clientes?.telefone || null,
              clienteEmail: v.clientes?.email || null,
              tag: v.canal === 'revendedora' ? 'Revendedora' : v.tipo_pedido === 'sob_encomenda' ? 'Encomenda' : 'Balcão',
              tipoPedido: v.tipo_pedido === 'sob_encomenda' ? 'sob_encomenda' : 'pronta_entrega',
              data: v.created_at || new Date().toISOString(),
              dataDisplay,
              horaDisplay,
              diaChave,
              diaTitulo,
              vendedor: 'Camila Lima',
              vendedorCargo: 'Proprietária',
              formaPagamento: (v.pagamento as any) || 'pix',
              status: v.status === 'pago' ? 'pago' : 'pendente',
              total: Number(v.total) || 0,
              valorSinalPago: Number(v.valor_sinal_pago) || 0,
              saldoNaEntrega: Number(v.saldo_na_entrega) || (v.status === 'pago' ? 0 : Number(v.total) || 0),
              statusProducao: (v.status_producao as any) || 'pronto',
              itens: itensMapped.length > 0 ? itensMapped : [
                {
                  id: 'item-base',
                  nome: 'Caixa de Doces Artesanais',
                  categoria: 'Confeitaria',
                  quantidade: 1,
                  precoUnitario: Number(v.total) || 0,
                  totalItem: Number(v.total) || 0,
                }
              ],
              observacoes: v.observacoes || null,
            };
          });

          // Unir dados reais mantendo os mocks se a tabela tiver poucos dados
          if (formatados.length >= 3) {
            setPedidos(formatados);
          }
        }
      } catch {
        // Fallback robusto para MOCK_PEDIDOS já carregado
      }
    }

    sincronizarSupabase();
  }, []);

  // FILTRAGEM DOS PEDIDOS ATIVOS (EXCLUINDO DELETADOS LOGICAMENTE)
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (p.deletado) return false;

      // Filtro por termo de busca
      if (termoBusca.trim() !== '') {
        const busca = termoBusca.toLowerCase().trim();
        const noCodigo = p.codigoDisplay.toLowerCase().includes(busca);
        const noCliente = p.clienteNome.toLowerCase().includes(busca);
        const noVendedor = p.vendedor.toLowerCase().includes(busca);
        const nosItens = p.itens.some((it) => it.nome.toLowerCase().includes(busca));
        if (!noCodigo && !noCliente && !noVendedor && !nosItens) return false;
      }

      // Filtro por Tipo de Pedido
      if (filtroTipo !== 'todos' && p.tipoPedido !== filtroTipo) {
        return false;
      }

      // Filtro por Pagamento
      if (filtroPagamento === 'pendentes' && p.status !== 'pendente') return false;
      if (filtroPagamento === 'pagos' && p.status !== 'pago') return false;

      // Filtro por Vendedor
      if (filtroVendedor !== 'todos') {
        if (filtroVendedor === 'camila' && !p.vendedor.toLowerCase().includes('camila')) return false;
        if (filtroVendedor === 'juliana' && !p.vendedor.toLowerCase().includes('juliana')) return false;
        if (filtroVendedor === 'sofia' && !p.vendedor.toLowerCase().includes('sofia')) return false;
        if (filtroVendedor === 'cafeflor' && !p.vendedor.toLowerCase().includes('café & flor')) return false;
        if (filtroVendedor === 'docecharme' && !p.vendedor.toLowerCase().includes('doce charme')) return false;
      }

      // Filtro por Período
      if ((filtroPeriodo as any) === 'hoje') {
        const hojeStr = new Date().toISOString().split('T')[0];
        if (p.diaChave !== hojeStr && !p.diaChave.includes('2026-10-19')) return false;
      } else if (filtroPeriodo === '7dias') {
        // Simulado: últimos 7 dias inclui todos os pedidos atuais do mockup
      } else if (filtroPeriodo === 'personalizado') {
        if (p.diaChave < dataInicioPersonalizada || p.diaChave > dataFimPersonalizada) {
          return false;
        }
      }

      return true;
    });
  }, [pedidos, termoBusca, filtroTipo, filtroPagamento, filtroVendedor, filtroPeriodo, dataInicioPersonalizada, dataFimPersonalizada]);

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
      const grupo = mapa.get(chave)!;
      grupo.pedidos.push(p);
      grupo.totalDia += p.total;
      if (p.status === 'pendente') {
        grupo.pendentesDia += 1;
      }
    });

    // Ordenar dias decrescente (mais recente primeiro)
    return Array.from(mapa.values()).sort((a, b) => b.diaChave.localeCompare(a.diaChave));
  }, [pedidosFiltrados]);

  // ============================================================================
  // CÁLCULO DOS INDICADORES / KPIS
  // ============================================================================

  const kpis = useMemo(() => {
    let totalVendido = 0;
    let totalItensVendidos = 0;
    let totalAReceber = 0;
    let qtdPendentes = 0;

    pedidosFiltrados.forEach((p) => {
      totalVendido += p.total;
      p.itens.forEach((it) => {
        totalItensVendidos += it.quantidade;
      });
      if (p.status === 'pendente') {
        totalAReceber += (p.saldoNaEntrega > 0 ? p.saldoNaEntrega : p.total);
        qtdPendentes += 1;
      }
    });

    const totalEstoqueItens = estoque.reduce((acc, curr) => acc + curr.estoque, 0);
    const produtosEstoqueBaixo = estoque.filter((p) => p.status === 'baixo' || p.status === 'zerado').length;

    return {
      totalVendido,
      totalVendidoFormatado: `R$ ${totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      totalItensVendidos,
      totalAReceber,
      totalAReceberFormatado: `R$ ${totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      qtdPendentes,
      totalEstoqueItens,
      produtosEstoqueBaixo,
    };
  }, [pedidosFiltrados, estoque]);

  // ============================================================================
  // CÁLCULO DO TOP 3 PRODUTOS E TOP 3 CLIENTES
  // ============================================================================

  const top3Produtos = useMemo(() => {
    const mapaProdutos = new Map<string, { nome: string; categoria: string; qtd: number; faturamento: number }>();

    pedidos.forEach((p) => {
      if (p.deletado) return;
      p.itens.forEach((it) => {
        const itemChave = it.nome;
        if (!mapaProdutos.has(itemChave)) {
          mapaProdutos.set(itemChave, {
            nome: it.nome,
            categoria: it.categoria,
            qtd: 0,
            faturamento: 0,
          });
        }
        const prod = mapaProdutos.get(itemChave)!;
        prod.qtd += it.quantidade;
        prod.faturamento += it.totalItem;
      });
    });

    return Array.from(mapaProdutos.values())
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 3);
  }, [pedidos]);

  const top3Clientes = useMemo(() => {
    const mapaClientes = new Map<string, { nome: string; qtdItens: number; totalGasto: number; pedidosCount: number }>();

    pedidos.forEach((p) => {
      if (p.deletado) return;
      // Não agregar venda avulsa como cliente único
      if (p.clienteNome.toLowerCase().includes('venda avulsa')) return;

      const nome = p.clienteNome;
      if (!mapaClientes.has(nome)) {
        mapaClientes.set(nome, {
          nome,
          qtdItens: 0,
          totalGasto: 0,
          pedidosCount: 0,
        });
      }
      const cli = mapaClientes.get(nome)!;
      cli.pedidosCount += 1;
      cli.totalGasto += p.total;
      p.itens.forEach((it) => {
        cli.qtdItens += it.quantidade;
      });
    });

    return Array.from(mapaClientes.values())
      .sort((a, b) => b.qtdItens - a.qtdItens)
      .slice(0, 3);
  }, [pedidos]);

  // LISTA DE PEDIDOS PENDENTES (PARA O MODAL "A RECEBER")
  const pedidosPendentes = useMemo(() => {
    return pedidos.filter((p) => !p.deletado && p.status === 'pendente');
  }, [pedidos]);

  // ESTOQUE FILTRADO (PARA O MODAL "ESTOQUE")
  const estoqueFiltrado = useMemo(() => {
    return estoque.filter((p) => {
      if (buscaEstoque.trim() !== '') {
        const busca = buscaEstoque.toLowerCase();
        if (!p.nome.toLowerCase().includes(busca) && !p.categoria.toLowerCase().includes(busca)) {
          return false;
        }
      }
      if (categoriaEstoque !== 'Todas' && p.categoria !== categoriaEstoque) {
        return false;
      }
      return true;
    });
  }, [estoque, buscaEstoque, categoriaEstoque]);

  // ============================================================================
  // FUNÇÕES DE AÇÃO: DAR BAIXA, WHATSAPP, EDITAR, EXCLUIR
  // ============================================================================

  const abrirModalBaixa = (pedido: Pedido) => {
    setPedidoParaBaixa(pedido);
    setBaixaValor(pedido.saldoNaEntrega > 0 ? pedido.saldoNaEntrega.toFixed(2) : pedido.total.toFixed(2));
    setBaixaFormaPagamento('pix');
    setModalBaixaAberto(true);
  };

  const confirmarBaixaPagamento = () => {
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

    // Se estiver selecionado no painel lateral aberto, atualiza também
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
    setPedidoParaBaixa(null);
    exibirToast(`✓ Baixa realizada com sucesso no pedido ${pedidoParaBaixa.codigoDisplay}!`);
  };

  // GERADOR DE TEXTO DO COMPROVANTE WHATSAPP COM CHAVE PIX
  const gerarTextoWhatsApp = (pedido: Pedido): string => {
    const itensTexto = pedido.itens
      .map(
        (it) =>
          `• ${it.quantidade}x ${it.nome} (R$ ${it.precoUnitario.toFixed(2)} un) = R$ ${it.totalItem.toFixed(2)}`
      )
      .join('\n');

    const statusTexto = pedido.status === 'pago' ? '✅ Pago' : '⏳ Pendente de Pagamento';

    return `🧁 *KIPI ATELIÊ • COMPROVANTE DE PEDIDO*
Número: *${pedido.codigoDisplay}*
Data: ${pedido.dataDisplay} às ${pedido.horaDisplay}
Cliente: *${pedido.clienteNome}*
Atendente: ${pedido.vendedor}

📦 *ITENS:*
${itensTexto}

💰 *TOTAL:* R$ ${pedido.total.toFixed(2)}
Status: ${statusTexto}

🔑 *CHAVE PIX PARA PAGAMENTO:*
Chave (Celular): *${CHAVE_PIX_ATELIE}*
Favorecido: ${TITULAR_PIX}
Banco: ${BANCO_PIX}

Agradecemos imensamente a sua preferência e confiança! ✨
_Kipi Ateliê de Confeitaria Artesanal_`;
  };

  const copiarComprovanteWhatsApp = (pedido: Pedido) => {
    const texto = gerarTextoWhatsApp(pedido);

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(texto);
    }

    setCopiadoFeedback(true);
    exibirToast('📋 Comprovante formatado copiado para a área de transferência!');
    setTimeout(() => setCopiadoFeedback(false), 2000);
  };

  const abrirConversaWhatsApp = (pedido: Pedido) => {
    const texto = encodeURIComponent(gerarTextoWhatsApp(pedido));
    const telefoneLimpo = pedido.clienteTelefone ? pedido.clienteTelefone.replace(/\D/g, '') : '';
    const url = telefoneLimpo
      ? `https://wa.me/55${telefoneLimpo}?text=${texto}`
      : `https://wa.me/?text=${texto}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  // EXCLUSÃO LÓGICA DO PEDIDO
  const confirmarExclusaoLogica = () => {
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
    exibirToast(`🗑 Pedido ${pedidoParaExcluir.codigoDisplay} cancelado e arquivado logicamente.`);
    setPedidoParaExcluir(null);
  };

  // EDIÇÃO DE OBSERVAÇÕES DO PEDIDO
  const salvarEdicaoPedido = () => {
    if (!pedidoParaEditar) return;

    setPedidos((prev) =>
      prev.map((p) => {
        if (p.id === pedidoParaEditar.id) {
          return { ...p, observacoes: editObservacoes.trim() || null };
        }
        return p;
      })
    );

    if (pedidoSelecionado?.id === pedidoParaEditar.id) {
      setPedidoSelecionado({
        ...pedidoSelecionado,
        observacoes: editObservacoes.trim() || null,
      });
    }

    setModalEditarAberto(false);
    exibirToast('✓ Alterações salvas com sucesso!');
  };

  // QUANDO NOVO PEDIDO É CRIADO PELO MODAL "+ NOVO PEDIDO"
  const lidarComPedidoCriado = (novoVenda: any) => {
    const hoje = new Date();
    const dataDisplay = hoje.toLocaleDateString('pt-BR');
    const horaDisplay = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const diaChave = hoje.toISOString().split('T')[0];

    const novoPedidoFormatado: Pedido = {
      id: novoVenda.id || `ped-${Date.now()}`,
      codigoDisplay: `#PED-${1050 + pedidos.length}`,
      clienteNome: novoVenda.cliente_id ? 'Cliente Cadastrado' : 'Venda Avulsa (Balcão)',
      clienteTelefone: null,
      clienteEmail: null,
      tag: novoVenda.tipo_pedido === 'sob_encomenda' ? 'Encomenda' : 'Pronta Entrega',
      tipoPedido: novoVenda.tipo_pedido === 'sob_encomenda' ? 'sob_encomenda' : 'pronta_entrega',
      data: hoje.toISOString(),
      dataDisplay,
      horaDisplay,
      diaChave,
      diaTitulo: `Hoje • ${hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      vendedor: 'Camila Lima',
      vendedorCargo: 'Proprietária',
      formaPagamento: novoVenda.pagamento || 'pix',
      status: novoVenda.status === 'pago' ? 'pago' : 'pendente',
      total: Number(novoVenda.total) || 0,
      valorSinalPago: novoVenda.status === 'pago' ? Number(novoVenda.total) || 0 : 0,
      saldoNaEntrega: novoVenda.status === 'pago' ? 0 : Number(novoVenda.total) || 0,
      statusProducao: novoVenda.tipo_pedido === 'sob_encomenda' ? 'a_fazer' : 'pronto',
      itens: [
        {
          id: `it-${Date.now()}`,
          nome: 'Produto do Pedido Registrado',
          categoria: 'Confeitaria',
          quantidade: 1,
          precoUnitario: Number(novoVenda.total) || 0,
          totalItem: Number(novoVenda.total) || 0,
        },
      ],
      observacoes: novoVenda.observacoes || null,
    };

    setPedidos((prev) => [novoPedidoFormatado, ...prev]);
    exibirToast(`🎉 Pedido ${novoPedidoFormatado.codigoDisplay} registrado com sucesso!`);
  };

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.mainLayout}>

        {/* =========================================================================
            MENU LATERAL (EXPANSÍVEL NO HOVER + FIXAÇÃO COM PIN + ATIVO EM PEDIDOS)
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
            ÁREA DE CONTEÚDO PRINCIPAL (TELA DE PEDIDOS)
        ========================================================================== */}
        <View style={styles.contentArea}>

          {/* BARRA SUPERIOR DE BUSCA E AÇÕES */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <View style={styles.titleWithBadgeRow}>
                <Text style={styles.screenHeading}>Gestão de Pedidos & Vendas</Text>
                <View style={styles.liveIndicatorBadge}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveIndicatorText}>
                    {pedidosFiltrados.length} pedidos no filtro
                  </Text>
                </View>
              </View>
              <Text style={styles.screenSubheading}>
                Histórico agrupado por data, controle de recebimentos, WhatsApp e baixa rápida
              </Text>
            </View>

            <View style={styles.topBarRight}>
              {/* TOGGLE MODO DE VISUALIZAÇÃO (LISTA / CARDS) */}
              <View style={styles.viewModeToggle}>
                <TouchableOpacity
                  style={[
                    styles.viewModeBtn,
                    modoVisualizacao === 'lista' && styles.viewModeBtnActive,
                  ]}
                  onPress={() => setModoVisualizacao('lista')}
                  activeOpacity={0.7}>
                  <Feather
                    name="list"
                    size={16}
                    color={modoVisualizacao === 'lista' ? KipiPalette.icedDenim : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.viewModeBtnText,
                      modoVisualizacao === 'lista' && styles.viewModeBtnTextActive,
                    ]}>
                    Lista
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.viewModeBtn,
                    modoVisualizacao === 'cards' && styles.viewModeBtnActive,
                  ]}
                  onPress={() => setModoVisualizacao('cards')}
                  activeOpacity={0.7}>
                  <Feather
                    name="grid"
                    size={16}
                    color={modoVisualizacao === 'cards' ? KipiPalette.icedDenim : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.viewModeBtnText,
                      modoVisualizacao === 'cards' && styles.viewModeBtnTextActive,
                    ]}>
                    Cards
                  </Text>
                </TouchableOpacity>
              </View>

              {/* BOTÃO + NOVO PEDIDO */}
              <TouchableOpacity
                style={styles.btnNovoPedido}
                onPress={() => setModalNovoPedidoAberto(true)}
                activeOpacity={0.85}>
                <Feather name="plus-circle" size={17} color="#FFFFFF" />
                <Text style={styles.btnNovoPedidoText}>+ Novo Pedido</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CONTAINER PRINCIPAL COM SPLIT VIEW / EXPANSÃO LATERAL MODERNA (PINTEREST REFERENCE) */}
          <View style={styles.workspaceSplitArea}>

            {/* COLUNA ESQUERDA: KPIS, FILTROS E HISTÓRICO DE PEDIDOS */}
            <ScrollView
              style={[
                styles.feedScrollView,
                pedidoSelecionado !== null && isDesktop && styles.feedScrollViewWithDrawer,
              ]}
              contentContainerStyle={styles.feedContentContainer}
              showsVerticalScrollIndicator={false}>

              {/* =========================================================================
                  LINHA DE 4 INDICADORES / KPIS (TOTAL VENDIDO, ITENS, A RECEBER, ESTOQUE)
              ========================================================================== */}
              <View style={styles.kpiRow}>

                {/* 1. TOTAL VENDIDO (R$) */}
                <View style={styles.kpiCard}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.kpiIconBox, { backgroundColor: '#EAF3FA' }]}>
                      <Feather name="dollar-sign" size={17} color={KipiPalette.icedDenim} />
                    </View>
                    <View style={styles.kpiBadgeGreen}>
                      <Text style={styles.kpiBadgeGreenText}>+18% período</Text>
                    </View>
                  </View>
                  <Text style={styles.kpiValueText}>{kpis.totalVendidoFormatado}</Text>
                  <Text style={styles.kpiLabelText}>TOTAL VENDIDO (FATURAMENTO)</Text>
                  <Text style={styles.kpiHintText}>Soma de todas as vendas válidas</Text>
                </View>

                {/* 2. TOTAL DE ITENS VENDIDOS */}
                <View style={styles.kpiCard}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.kpiIconBox, { backgroundColor: '#F3F6DD' }]}>
                      <Feather name="shopping-bag" size={17} color={KipiPalette.pistachioDark} />
                    </View>
                    <View style={[styles.kpiBadgeGreen, { backgroundColor: '#F3F6DD' }]}>
                      <Text style={[styles.kpiBadgeGreenText, { color: KipiPalette.pistachioDark }]}>
                        Alta saída
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.kpiValueText}>{kpis.totalItensVendidos} un.</Text>
                  <Text style={styles.kpiLabelText}>TOTAL DE ITENS VENDIDOS</Text>
                  <Text style={styles.kpiHintText}>Média de {(kpis.totalItensVendidos / Math.max(1, pedidosFiltrados.length)).toFixed(1)} itens por pedido</Text>
                </View>

                {/* 3. A RECEBER (INTERATIVO • CLIQUE ABRE MODAL PENDÊNCIAS) */}
                <TouchableOpacity
                  style={[styles.kpiCard, styles.kpiCardClickable]}
                  onPress={() => setModalAReceberAberto(true)}
                  activeOpacity={0.8}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.kpiIconBox, { backgroundColor: '#FEE2E2' }]}>
                      <Feather name="clock" size={17} color="#DC2626" />
                    </View>
                    <View style={styles.kpiBadgeRed}>
                      <Text style={styles.kpiBadgeRedText}>{kpis.qtdPendentes} pendentes ↗</Text>
                    </View>
                  </View>
                  <Text style={[styles.kpiValueText, { color: '#DC2626' }]}>
                    {kpis.totalAReceberFormatado}
                  </Text>
                  <Text style={styles.kpiLabelText}>A RECEBER (PENDENTES)</Text>
                  <Text style={[styles.kpiHintText, { color: KipiPalette.icedDenim, fontWeight: '600' }]}>
                    Clique para ver lista de quem deve ↗
                  </Text>
                </TouchableOpacity>

                {/* 4. ESTOQUE (INTERATIVO • CLIQUE ABRE MODAL ESTOQUE) */}
                <TouchableOpacity
                  style={[styles.kpiCard, styles.kpiCardClickable]}
                  onPress={() => setModalEstoqueAberto(true)}
                  activeOpacity={0.8}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.kpiIconBox, { backgroundColor: '#E0F2FE' }]}>
                      <Feather name="package" size={17} color="#0284C7" />
                    </View>
                    <View style={[styles.kpiBadgeGreen, { backgroundColor: '#E0F2FE' }]}>
                      <Text style={[styles.kpiBadgeGreenText, { color: '#0284C7' }]}>
                        {kpis.produtosEstoqueBaixo} baixos ↗
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.kpiValueText}>{kpis.totalEstoqueItens} un.</Text>
                  <Text style={styles.kpiLabelText}>ESTOQUE GERAL DISPONÍVEL</Text>
                  <Text style={[styles.kpiHintText, { color: KipiPalette.icedDenim, fontWeight: '600' }]}>
                    Clique para ver produtos e qtd ↗
                  </Text>
                </TouchableOpacity>

              </View>

              {/* =========================================================================
                  LINHA DE INSIGHTS: TOP 3 PRODUTOS E TOP 3 CLIENTES
              ========================================================================== */}
              <View style={styles.insightsTwinRow}>

                {/* TOP 3 PRODUTOS MAIS VENDIDOS */}
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View style={styles.insightTitleRow}>
                      <View style={[styles.miniInsightIcon, { backgroundColor: '#F3F6DD' }]}>
                        <Feather name="award" size={15} color={KipiPalette.pistachioDark} />
                      </View>
                      <View>
                        <Text style={styles.insightTitle}>Top 3 Produtos Mais Vendidos</Text>
                        <Text style={styles.insightSubtitle}>Por unidades e faturamento gerado</Text>
                      </View>
                    </View>
                    <View style={styles.podiumBadge}>
                      <Text style={styles.podiumBadgeText}>Campeões 🏆</Text>
                    </View>
                  </View>

                  <View style={styles.topItemList}>
                    {top3Produtos.map((prod, idx) => {
                      const medalhas = ['🥇', '🥈', '🥉'];
                      return (
                        <View key={prod.nome} style={styles.topItemRow}>
                          <View style={styles.topItemLeft}>
                            <Text style={styles.topItemMedal}>{medalhas[idx]}</Text>
                            <View>
                              <Text style={styles.topItemName}>{prod.nome}</Text>
                              <Text style={styles.topItemCategory}>{prod.categoria}</Text>
                            </View>
                          </View>
                          <View style={styles.topItemRight}>
                            <Text style={styles.topItemQty}>{prod.qtd} un. vendidas</Text>
                            <Text style={styles.topItemTotal}>
                              R$ {prod.faturamento.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* TOP 3 CLIENTES QUE MAIS COMPRAM (POR QUANTIDADE DE ITENS) */}
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View style={styles.insightTitleRow}>
                      <View style={[styles.miniInsightIcon, { backgroundColor: '#EAF3FA' }]}>
                        <Feather name="users" size={15} color={KipiPalette.icedDenim} />
                      </View>
                      <View>
                        <Text style={styles.insightTitle}>Top 3 Clientes que Mais Compram</Text>
                        <Text style={styles.insightSubtitle}>Classificados por volume total de itens</Text>
                      </View>
                    </View>
                    <View style={[styles.podiumBadge, { backgroundColor: '#EAF3FA' }]}>
                      <Text style={[styles.podiumBadgeText, { color: KipiPalette.icedDenim }]}>Clientes VIP ✨</Text>
                    </View>
                  </View>

                  <View style={styles.topItemList}>
                    {top3Clientes.map((cli, idx) => {
                      const medalhas = ['🥇', '🥈', '🥉'];
                      const iniciais = cli.nome
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <View key={cli.nome} style={styles.topItemRow}>
                          <View style={styles.topItemLeft}>
                            <Text style={styles.topItemMedal}>{medalhas[idx]}</Text>
                            <View style={styles.clientMiniAvatar}>
                              <Text style={styles.clientMiniAvatarText}>{iniciais}</Text>
                            </View>
                            <View>
                              <Text style={styles.topItemName}>{cli.nome}</Text>
                              <Text style={styles.topItemCategory}>{cli.pedidosCount} compras realizadas</Text>
                            </View>
                          </View>
                          <View style={styles.topItemRight}>
                            <Text style={[styles.topItemQty, { color: '#16A34A', fontWeight: '700' }]}>
                              {cli.qtdItens} itens
                            </Text>
                            <Text style={styles.topItemTotal}>
                              Total: R$ {cli.totalGasto.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

              </View>

              {/* =========================================================================
                  SEÇÃO DE FILTROS COMPLETOS (PERÍODO, TIPO, STATUS, VENDEDOR E BUSCA)
              ========================================================================== */}
              <View style={styles.filterSectionCard}>
                <View style={styles.filterSectionHeader}>
                  <View style={styles.filterTitleRow}>
                    <Feather name="sliders" size={16} color={KipiPalette.icedDenim} />
                    <Text style={styles.filterSectionTitle}>Filtros de Consulta & Refinamento</Text>
                  </View>

                  {/* BUSCA RÁPIDA POR PEDIDO / CLIENTE */}
                  <View style={styles.searchBarContainer}>
                    <Feather name="search" size={15} color="#94A3B8" />
                    <TextInput
                      style={styles.searchBarInput}
                      placeholder="Buscar por #PED, cliente, produto..."
                      placeholderTextColor="#94A3B8"
                      value={termoBusca}
                      onChangeText={setTermoBusca}
                    />
                    {termoBusca.length > 0 && (
                      <TouchableOpacity onPress={() => setTermoBusca('')}>
                        <Feather name="x" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* LINHA DE FILTROS PÍLULA */}
                <View style={styles.filtersControlsArea}>

                  {/* 1. FILTRO DE PERÍODO (PÍLULAS) */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>PERÍODO:</Text>
                    <View style={styles.pillContainer}>
                      {[
                        { id: 'todos', label: 'Todos (Default)' },
                        { id: 'hoje', label: 'Hoje' },
                        { id: '7dias', label: '7 dias' },
                        { id: 'mes', label: 'Mês' },
                        { id: 'personalizado', label: 'Personalizado 📅' },
                      ].map((item) => {
                        const ativo = (filtroPeriodo as any) === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.pillBtn, ativo && styles.pillBtnActive]}
                            onPress={() => setFiltroPeriodo(item.id as any)}
                            activeOpacity={0.7}>
                            <Text style={[styles.pillBtnText, ativo && styles.pillBtnTextActive]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 2. FILTRO DE TIPO DE PEDIDO */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>TIPO:</Text>
                    <View style={styles.pillContainer}>
                      {[
                        { id: 'todos', label: 'Todos' },
                        { id: 'pronta_entrega', label: 'Pronta Entrega' },
                        { id: 'sob_encomenda', label: 'Sob Encomenda' },
                      ].map((item) => {
                        const ativo = filtroTipo === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.pillBtn, ativo && styles.pillBtnActive]}
                            onPress={() => setFiltroTipo(item.id as any)}
                            activeOpacity={0.7}>
                            <Text style={[styles.pillBtnText, ativo && styles.pillBtnTextActive]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 3. FILTRO DE STATUS DE PAGAMENTO */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>PAGAMENTO:</Text>
                    <View style={styles.pillContainer}>
                      {[
                        { id: 'todos', label: 'Todos' },
                        { id: 'pendentes', label: 'Pendentes' },
                        { id: 'pagos', label: 'Pagos' },
                      ].map((item) => {
                        const ativo = filtroPagamento === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.pillBtn,
                              ativo && styles.pillBtnActive,
                              item.id === 'pendentes' && ativo && { backgroundColor: '#DC2626' },
                            ]}
                            onPress={() => setFiltroPagamento(item.id as any)}
                            activeOpacity={0.7}>
                            <Text
                              style={[
                                styles.pillBtnText,
                                ativo && styles.pillBtnTextActive,
                                item.id === 'pendentes' && !ativo && { color: '#DC2626' },
                              ]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 4. FILTRO DE QUEM VENDEU */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>QUEM VENDEU:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.sellersScrollRow}>
                      {VENDEDORES_LISTA.map((v) => {
                        const ativo = filtroVendedor === v.id;
                        return (
                          <TouchableOpacity
                            key={v.id}
                            style={[styles.sellerChip, ativo && styles.sellerChipActive]}
                            onPress={() => setFiltroVendedor(v.id)}
                            activeOpacity={0.7}>
                            <Text style={[styles.sellerChipText, ativo && styles.sellerChipTextActive]}>
                              {v.nome}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                </View>

                {/* SELETOR EXPANSÍVEL DE CALENDÁRIO / DATA PERSONALIZADA */}
                {filtroPeriodo === 'personalizado' && (
                  <View style={styles.customDateBar}>
                    <View style={styles.customDateGroup}>
                      <Text style={styles.customDateLabel}>Data Inicial:</Text>
                      <TextInput
                        style={styles.customDateInput}
                        value={dataInicioPersonalizada}
                        onChangeText={setDataInicioPersonalizada}
                        placeholder="AAAA-MM-DD"
                      />
                    </View>
                    <View style={styles.customDateGroup}>
                      <Text style={styles.customDateLabel}>Data Final:</Text>
                      <TextInput
                        style={styles.customDateInput}
                        value={dataFimPersonalizada}
                        onChangeText={setDataFimPersonalizada}
                        placeholder="AAAA-MM-DD"
                      />
                    </View>
                    <View style={styles.customDateFeedback}>
                      <Feather name="calendar" size={14} color={KipiPalette.icedDenim} />
                      <Text style={styles.customDateFeedbackText}>
                        Exibindo pedidos entre {dataInicioPersonalizada} e {dataFimPersonalizada}
                      </Text>
                    </View>
                  </View>
                )}

              </View>

              {/* =========================================================================
                  HISTÓRICO DE PEDIDOS SEPARADO POR DIA (EX: SÁBADO 17/10)
              ========================================================================== */}
              <View style={styles.ordersHistorySection}>
                {pedidosAgrupadosPorDia.length === 0 ? (
                  <View style={styles.emptyFeedState}>
                    <Feather name="inbox" size={42} color="#94A3B8" />
                    <Text style={styles.emptyFeedTitle}>Nenhum pedido encontrado</Text>
                    <Text style={styles.emptyFeedSubtitle}>
                      Tente alterar os filtros de período, vendedor ou termo de busca.
                    </Text>
                    <TouchableOpacity
                      style={styles.btnResetFiltros}
                      onPress={() => {
                        setFiltroPeriodo('todos' as any);
                        setFiltroTipo('todos');
                        setFiltroPagamento('todos');
                        setFiltroVendedor('todos');
                        setTermoBusca('');
                      }}>
                      <Text style={styles.btnResetFiltrosText}>Restaurar Filtros Padrão</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  pedidosAgrupadosPorDia.map((grupo) => (
                    <View key={grupo.diaChave} style={styles.dayGroupBlock}>

                      {/* CABEÇALHO DO DIA COM TOTAL E PENDÊNCIAS */}
                      <View style={styles.dayHeaderRow}>
                        <View style={styles.dayTitleLeft}>
                          <View style={styles.dayDotIndicator} />
                          <Text style={styles.dayTitleText}>{grupo.diaTitulo}</Text>
                        </View>
                        <View style={styles.daySummaryRight}>
                          <View style={styles.dayBadgeCount}>
                            <Text style={styles.dayBadgeCountText}>
                              {grupo.pedidos.length} {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                            </Text>
                          </View>
                          <Text style={styles.dayTotalRevenue}>
                            Total: R$ {grupo.totalDia.toFixed(2)}
                          </Text>
                          {grupo.pendentesDia > 0 && (
                            <View style={styles.dayPendingBadge}>
                              <Text style={styles.dayPendingBadgeText}>
                                {grupo.pendentesDia} pendente(s)
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* RENDERIZAÇÃO DOS PEDIDOS DO DIA (VISÃO EM LISTA OU VISÃO EM CARDS) */}
                      {modoVisualizacao === 'lista' ? (
                        <View style={styles.ordersListContainer}>
                          {grupo.pedidos.map((pedido) => {
                            const isSelected = pedidoSelecionado?.id === pedido.id;

                            return (
                              <View
                                key={pedido.id}
                                style={[
                                  styles.orderListItem,
                                  isSelected && styles.orderListItemActive,
                                ]}>

                                {/* LINHA SUPERIOR DO ITEM: ID, TAGS, HORÁRIO E VENDEDOR */}
                                <View style={styles.orderItemTopRow}>
                                  <View style={styles.orderItemCodeRow}>
                                    <Text style={styles.orderItemCode}>{pedido.codigoDisplay}</Text>
                                    <View
                                      style={[
                                        styles.orderTypeTag,
                                        pedido.tipoPedido === 'sob_encomenda'
                                          ? styles.tagEncomenda
                                          : styles.tagProntaEntrega,
                                      ]}>
                                      <Text
                                        style={[
                                          styles.orderTypeTagText,
                                          pedido.tipoPedido === 'sob_encomenda'
                                            ? styles.tagEncomendaText
                                            : styles.tagProntaEntregaText,
                                        ]}>
                                        {pedido.tipoPedido === 'sob_encomenda'
                                          ? 'Sob Encomenda'
                                          : 'Pronta Entrega'}
                                      </Text>
                                    </View>

                                    {pedido.status === 'pago' ? (
                                      <View style={styles.statusPagoBadge}>
                                        <Feather name="check" size={11} color="#16A34A" />
                                        <Text style={styles.statusPagoText}>Pago ({pedido.formaPagamento.toUpperCase()})</Text>
                                      </View>
                                    ) : (
                                      <View style={styles.statusPendenteBadge}>
                                        <Feather name="alert-circle" size={11} color="#DC2626" />
                                        <Text style={styles.statusPendenteText}>Pendente</Text>
                                      </View>
                                    )}
                                  </View>

                                  <View style={styles.orderItemSellerRow}>
                                    <Feather name="clock" size={12} color="#94A3B8" />
                                    <Text style={styles.orderTimeText}>{pedido.horaDisplay}</Text>
                                    <Text style={styles.orderSellerDot}>•</Text>
                                    <Feather name="user-check" size={12} color="#94A3B8" />
                                    <Text style={styles.orderSellerName}>
                                      Vendido por: <Text style={{ fontWeight: '600', color: '#0F172A' }}>{pedido.vendedor}</Text>
                                    </Text>
                                  </View>
                                </View>

                                {/* CORPO DO ITEM: CLIENTE, RESUMO DOS ITENS E VALOR TOTAL */}
                                <View style={styles.orderItemBodyRow}>
                                  <View style={styles.orderClientAndItems}>
                                    <View style={styles.orderClientTitleRow}>
                                      <Text style={styles.orderClientName}>{pedido.clienteNome}</Text>
                                      {pedido.tag && (
                                        <View style={styles.orderClientTag}>
                                          <Text style={styles.orderClientTagText}>{pedido.tag}</Text>
                                        </View>
                                      )}
                                    </View>

                                    {/* LISTA RESUMIDA DOS ITENS */}
                                    <View style={styles.orderItemsPreview}>
                                      <Text style={styles.orderItemsPreviewText}>
                                        {pedido.itens
                                          .map((it) => `${it.quantidade}x ${it.nome}`)
                                          .join(' • ')}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* VALOR TOTAL E SALDO */}
                                  <View style={styles.orderPriceBlock}>
                                    <Text style={styles.orderPriceLabel}>TOTAL DO PEDIDO</Text>
                                    <Text style={styles.orderPriceValue}>
                                      R$ {pedido.total.toFixed(2)}
                                    </Text>
                                    {pedido.status === 'pendente' && (
                                      <Text style={styles.orderPendingBalance}>
                                        R$ {pedido.saldoNaEntrega.toFixed(2)} a receber
                                      </Text>
                                    )}
                                  </View>
                                </View>

                                {/* BARRA DE AÇÕES INLINE: DAR BAIXA, WHATSAPP, VER DETALHES (EXPANDIR), EDITAR, DELETAR */}
                                <View style={styles.orderItemActionsRow}>
                                  <View style={styles.orderActionsLeft}>
                                    {/* SE NÃO ESTIVER PAGO: BOTÃO DESTACADO "DAR BAIXA" */}
                                    {pedido.status === 'pendente' && (
                                      <TouchableOpacity
                                        style={styles.btnDarBaixa}
                                        onPress={() => abrirModalBaixa(pedido)}
                                        activeOpacity={0.8}>
                                        <Feather name="check-circle" size={14} color="#FFFFFF" />
                                        <Text style={styles.btnDarBaixaText}>Dar Baixa de Pagamento</Text>
                                      </TouchableOpacity>
                                    )}

                                    {/* BOTÃO COMPROVANTE WHATSAPP */}
                                    <TouchableOpacity
                                      style={styles.btnWhatsApp}
                                      onPress={() => copiarComprovanteWhatsApp(pedido)}
                                      activeOpacity={0.8}>
                                      <Feather name="message-circle" size={14} color="#16A34A" />
                                      <Text style={styles.btnWhatsAppText}>Comprovante WPP</Text>
                                    </TouchableOpacity>

                                    {/* BOTÃO VER DETALHES (DISPARA A TRANSIÇÃO/EXPANSÃO MODERNA) */}
                                    <TouchableOpacity
                                      style={[
                                        styles.btnVerDetalhes,
                                        isSelected && styles.btnVerDetalhesActive,
                                      ]}
                                      onPress={() => {
                                        if (isSelected) {
                                          setPedidoSelecionado(null);
                                        } else {
                                          setPedidoSelecionado(pedido);
                                        }
                                      }}
                                      activeOpacity={0.8}>
                                      <Feather
                                        name={isSelected ? 'chevron-right' : 'maximize-2'}
                                        size={14}
                                        color={isSelected ? '#FFFFFF' : KipiPalette.icedDenim}
                                      />
                                      <Text
                                        style={[
                                          styles.btnVerDetalhesText,
                                          isSelected && styles.btnVerDetalhesTextActive,
                                        ]}>
                                        {isSelected ? 'Fechar Detalhes' : 'Ver Detalhes ↗'}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>

                                  <View style={styles.orderActionsRight}>
                                    {/* BOTÃO EDITAR PEDIDO */}
                                    <TouchableOpacity
                                      style={styles.btnIconAction}
                                      onPress={() => {
                                        setPedidoParaEditar(pedido);
                                        setEditObservacoes(pedido.observacoes || '');
                                        setModalEditarAberto(true);
                                      }}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                      <Feather name="edit-2" size={15} color="#64748B" />
                                    </TouchableOpacity>

                                    {/* BOTÃO DELETAR PEDIDO (LOGICAMENTE) */}
                                    <TouchableOpacity
                                      style={styles.btnIconAction}
                                      onPress={() => {
                                        setPedidoParaExcluir(pedido);
                                        setModalExcluirAberto(true);
                                      }}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                      <Feather name="trash-2" size={15} color="#DC2626" />
                                    </TouchableOpacity>
                                  </View>
                                </View>

                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        /* VISÃO EM GRID DE CARDS */
                        <View style={styles.ordersGridContainer}>
                          {grupo.pedidos.map((pedido) => {
                            const isSelected = pedidoSelecionado?.id === pedido.id;

                            return (
                              <View
                                key={pedido.id}
                                style={[
                                  styles.orderGridCard,
                                  isSelected && styles.orderListItemActive,
                                ]}>
                                <View style={styles.gridCardHeader}>
                                  <Text style={styles.orderItemCode}>{pedido.codigoDisplay}</Text>
                                  {pedido.status === 'pago' ? (
                                    <View style={styles.statusPagoBadge}>
                                      <Text style={styles.statusPagoText}>Pago</Text>
                                    </View>
                                  ) : (
                                    <View style={styles.statusPendenteBadge}>
                                      <Text style={styles.statusPendenteText}>Pendente</Text>
                                    </View>
                                  )}
                                </View>

                                <Text style={styles.gridCardClientName}>{pedido.clienteNome}</Text>
                                <Text style={styles.gridCardSeller}>
                                  Por: {pedido.vendedor} • {pedido.horaDisplay}
                                </Text>

                                <View style={styles.gridCardItemsBox}>
                                  {pedido.itens.map((it) => (
                                    <Text key={it.id} style={styles.gridCardItemLine}>
                                      • {it.quantidade}x {it.nome}
                                    </Text>
                                  ))}
                                </View>

                                <View style={styles.gridCardPriceRow}>
                                  <View>
                                    <Text style={styles.gridCardPriceLabel}>TOTAL</Text>
                                    <Text style={styles.gridCardPriceValue}>
                                      R$ {pedido.total.toFixed(2)}
                                    </Text>
                                  </View>

                                  <TouchableOpacity
                                    style={styles.gridCardDetailBtn}
                                    onPress={() => setPedidoSelecionado(pedido)}
                                    activeOpacity={0.8}>
                                    <Text style={styles.gridCardDetailBtnText}>Detalhes ↗</Text>
                                  </TouchableOpacity>
                                </View>

                                {/* AÇÕES DO CARD */}
                                <View style={styles.gridCardActions}>
                                  {pedido.status === 'pendente' && (
                                    <TouchableOpacity
                                      style={styles.gridCardBaixaBtn}
                                      onPress={() => abrirModalBaixa(pedido)}>
                                      <Text style={styles.gridCardBaixaBtnText}>Dar Baixa</Text>
                                    </TouchableOpacity>
                                  )}
                                  <TouchableOpacity
                                    style={styles.gridCardWppBtn}
                                    onPress={() => copiarComprovanteWhatsApp(pedido)}>
                                    <Feather name="message-circle" size={13} color="#16A34A" />
                                    <Text style={styles.gridCardWppBtnText}>WPP</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}

                    </View>
                  ))
                )}
              </View>

            </ScrollView>

            {/* =========================================================================
                PAINEL LATERAL DESLIZANTE / EXPANSÍVEL (PINTEREST REFERENCE PIN)
                Ao clicar em "Ver Detalhes", a página moderna se expande e mostra
                a linha do tempo, tabela de itens, comprovante formatado com Pix e ações
            ========================================================================== */}
            {pedidoSelecionado !== null && (
              <View style={styles.modernSlideOverDrawer}>

                {/* CABEÇALHO DO PAINEL EXPANSÍVEL */}
                <View style={styles.drawerHeader}>
                  <View style={styles.drawerHeaderLeft}>
                    <View style={styles.drawerBadgeRow}>
                      <Text style={styles.drawerCodeTitle}>{pedidoSelecionado.codigoDisplay}</Text>
                      {pedidoSelecionado.status === 'pago' ? (
                        <View style={styles.statusPagoBadge}>
                          <Feather name="check" size={12} color="#16A34A" />
                          <Text style={styles.statusPagoText}>Pago</Text>
                        </View>
                      ) : (
                        <View style={styles.statusPendenteBadge}>
                          <Feather name="clock" size={12} color="#DC2626" />
                          <Text style={styles.statusPendenteText}>Pendente</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.drawerDateSubtitle}>
                      {pedidoSelecionado.dataDisplay} às {pedidoSelecionado.horaDisplay}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.drawerCloseBtn}
                    onPress={() => setPedidoSelecionado(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* CONTEÚDO ROLÁVEL DO PAINEL EXPANSÍVEL */}
                <ScrollView
                  style={styles.drawerScrollView}
                  contentContainerStyle={styles.drawerScrollContent}
                  showsVerticalScrollIndicator={false}>

                  {/* BARRA DE AÇÕES PRINCIPAIS DO TOPO DO PAINEL */}
                  <View style={styles.drawerActionsBar}>
                    {pedidoSelecionado.status === 'pendente' && (
                      <TouchableOpacity
                        style={styles.drawerActionBtnPrimary}
                        onPress={() => abrirModalBaixa(pedidoSelecionado)}
                        activeOpacity={0.85}>
                        <Feather name="check-circle" size={15} color="#FFFFFF" />
                        <Text style={styles.drawerActionBtnPrimaryText}>Dar Baixa de Pagamento</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.drawerActionBtnWpp}
                      onPress={() => abrirConversaWhatsApp(pedidoSelecionado)}
                      activeOpacity={0.85}>
                      <Feather name="send" size={15} color="#FFFFFF" />
                      <Text style={styles.drawerActionBtnWppText}>Enviar pelo WhatsApp</Text>
                    </TouchableOpacity>
                  </View>

                  {/* CARD DE INFORMAÇÕES DO CLIENTE */}
                  <View style={styles.drawerCardSection}>
                    <View style={styles.drawerSectionHeader}>
                      <Feather name="user" size={15} color={KipiPalette.icedDenim} />
                      <Text style={styles.drawerSectionTitle}>Dados do Cliente</Text>
                    </View>

                    <View style={styles.drawerClientCard}>
                      <View style={styles.drawerAvatar}>
                        <Text style={styles.drawerAvatarText}>
                          {pedidoSelecionado.clienteNome
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.drawerClientInfo}>
                        <Text style={styles.drawerClientName}>{pedidoSelecionado.clienteNome}</Text>
                        <Text style={styles.drawerClientSub}>
                          {pedidoSelecionado.clienteTelefone || 'Telefone não cadastrado'}
                        </Text>
                        <Text style={styles.drawerClientSub}>
                          {pedidoSelecionado.clienteEmail || 'Email não cadastrado'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.drawerMetaInfoRow}>
                      <View style={styles.drawerMetaItem}>
                        <Text style={styles.drawerMetaLabel}>TIPO DE ENTREGA</Text>
                        <Text style={styles.drawerMetaValue}>
                          {pedidoSelecionado.tipoPedido === 'sob_encomenda'
                            ? 'Sob Encomenda (Agendada)'
                            : 'Pronta Entrega (Balcão)'}
                        </Text>
                      </View>
                      <View style={styles.drawerMetaItem}>
                        <Text style={styles.drawerMetaLabel}>VENDEDOR RESPONSÁVEL</Text>
                        <Text style={styles.drawerMetaValue}>{pedidoSelecionado.vendedor}</Text>
                      </View>
                    </View>
                  </View>

                  {/* LINHA DO TEMPO DO PEDIDO */}
                  <View style={styles.drawerCardSection}>
                    <View style={styles.drawerSectionHeader}>
                      <Feather name="activity" size={15} color={KipiPalette.icedDenim} />
                      <Text style={styles.drawerSectionTitle}>Status & Etapas do Pedido</Text>
                    </View>

                    <View style={styles.timelineContainer}>
                      <View style={styles.timelineStep}>
                        <View style={[styles.timelineDot, styles.timelineDotComplete]}>
                          <Feather name="check" size={10} color="#FFFFFF" />
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineStepTitle}>Pedido Registrado</Text>
                          <Text style={styles.timelineStepDesc}>
                            {pedidoSelecionado.dataDisplay} às {pedidoSelecionado.horaDisplay}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.timelineLine} />

                      <View style={styles.timelineStep}>
                        <View
                          style={[
                            styles.timelineDot,
                            pedidoSelecionado.statusProducao === 'em_producao' ||
                            pedidoSelecionado.statusProducao === 'pronto' ||
                            pedidoSelecionado.statusProducao === 'entregue'
                              ? styles.timelineDotComplete
                              : styles.timelineDotPending,
                          ]}>
                          <Feather
                            name={
                              pedidoSelecionado.statusProducao === 'em_producao'
                                ? 'loader'
                                : 'check'
                            }
                            size={10}
                            color="#FFFFFF"
                          />
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineStepTitle}>Produção & Montagem</Text>
                          <Text style={styles.timelineStepDesc}>
                            {pedidoSelecionado.tipoPedido === 'sob_encomenda'
                              ? 'Confeitaria especializada'
                              : 'Embalado e pronto'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.timelineLine} />

                      <View style={styles.timelineStep}>
                        <View
                          style={[
                            styles.timelineDot,
                            pedidoSelecionado.status === 'pago'
                              ? styles.timelineDotComplete
                              : styles.timelineDotAlert,
                          ]}>
                          <Feather
                            name={pedidoSelecionado.status === 'pago' ? 'check' : 'clock'}
                            size={10}
                            color="#FFFFFF"
                          />
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineStepTitle}>
                            Pagamento & Entrega Final
                          </Text>
                          <Text style={styles.timelineStepDesc}>
                            {pedidoSelecionado.status === 'pago'
                              ? `Liquidado via ${pedidoSelecionado.formaPagamento.toUpperCase()}`
                              : 'Aguardando baixa de pagamento'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* ITENS DA COMPRA COM VALOR UNITÁRIO E TOTAL */}
                  <View style={styles.drawerCardSection}>
                    <View style={styles.drawerSectionHeader}>
                      <Feather name="shopping-bag" size={15} color={KipiPalette.icedDenim} />
                      <Text style={styles.drawerSectionTitle}>Itens da Compra ({pedidoSelecionado.itens.length})</Text>
                    </View>

                    <View style={styles.drawerItemsTable}>
                      {pedidoSelecionado.itens.map((it) => (
                        <View key={it.id} style={styles.drawerItemRow}>
                          <View style={styles.drawerItemLeft}>
                            <View style={styles.drawerItemQtyBadge}>
                              <Text style={styles.drawerItemQtyText}>{it.quantidade}x</Text>
                            </View>
                            <View>
                              <Text style={styles.drawerItemName}>{it.nome}</Text>
                              <Text style={styles.drawerItemCat}>
                                {it.categoria} • R$ {it.precoUnitario.toFixed(2)} unitário
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.drawerItemPrice}>
                            R$ {it.totalItem.toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* RESUMO FINANCEIRO DO PEDIDO */}
                    <View style={styles.drawerFinancialBox}>
                      <View style={styles.drawerFinanceLine}>
                        <Text style={styles.drawerFinanceLabel}>Subtotal</Text>
                        <Text style={styles.drawerFinanceValue}>
                          R$ {pedidoSelecionado.total.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.drawerFinanceLine}>
                        <Text style={styles.drawerFinanceLabel}>Valor Sinal Pago</Text>
                        <Text style={[styles.drawerFinanceValue, { color: '#16A34A' }]}>
                          R$ {pedidoSelecionado.valorSinalPago.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.drawerFinanceLine}>
                        <Text style={styles.drawerFinanceLabel}>Saldo Restante</Text>
                        <Text
                          style={[
                            styles.drawerFinanceValue,
                            pedidoSelecionado.saldoNaEntrega > 0 && {
                              color: '#DC2626',
                              fontWeight: '700',
                            },
                          ]}>
                          R$ {pedidoSelecionado.saldoNaEntrega.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.drawerFinanceDivider} />

                      <View style={styles.drawerFinanceTotalLine}>
                        <Text style={styles.drawerFinanceTotalLabel}>TOTAL DO PEDIDO</Text>
                        <Text style={styles.drawerFinanceTotalValue}>
                          R$ {pedidoSelecionado.total.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* GERADOR DE COMPROVANTE WHATSAPP COM CHAVE PIX */}
                  <View style={styles.drawerCardSection}>
                    <View style={styles.drawerSectionHeader}>
                      <Feather name="message-circle" size={15} color="#16A34A" />
                      <Text style={styles.drawerSectionTitle}>Comprovante WhatsApp & Pix</Text>
                    </View>

                    <View style={styles.wppPreviewBubble}>
                      <Text style={styles.wppPreviewText}>
                        {gerarTextoWhatsApp(pedidoSelecionado)}
                      </Text>
                    </View>

                    <View style={styles.wppButtonsRow}>
                      <TouchableOpacity
                        style={[styles.btnCopyWpp, copiadoFeedback && styles.btnCopyWppSuccess]}
                        onPress={() => copiarComprovanteWhatsApp(pedidoSelecionado)}
                        activeOpacity={0.8}>
                        <Feather
                          name={copiadoFeedback ? 'check' : 'copy'}
                          size={15}
                          color={copiadoFeedback ? '#FFFFFF' : KipiPalette.icedDenim}
                        />
                        <Text
                          style={[
                            styles.btnCopyWppText,
                            copiadoFeedback && styles.btnCopyWppTextSuccess,
                          ]}>
                          {copiadoFeedback ? 'Copiado!' : 'Copiar Texto para WhatsApp'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnOpenWppDirect}
                        onPress={() => abrirConversaWhatsApp(pedidoSelecionado)}
                        activeOpacity={0.8}>
                        <Feather name="external-link" size={15} color="#16A34A" />
                        <Text style={styles.btnOpenWppDirectText}>Abrir no WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* OBSERVAÇÕES E NOTAS DO PEDIDO */}
                  {pedidoSelecionado.observacoes && (
                    <View style={styles.drawerCardSection}>
                      <View style={styles.drawerSectionHeader}>
                        <Feather name="file-text" size={15} color="#64748B" />
                        <Text style={styles.drawerSectionTitle}>Observações do Cliente</Text>
                      </View>
                      <View style={styles.drawerObsBox}>
                        <Text style={styles.drawerObsText}>
                          "{pedidoSelecionado.observacoes}"
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* RODAPÉ DO PAINEL: EDITAR / DELETAR LOGICAMENTE */}
                  <View style={styles.drawerFooterRow}>
                    <TouchableOpacity
                      style={styles.drawerEditBtn}
                      onPress={() => {
                        setPedidoParaEditar(pedidoSelecionado);
                        setEditObservacoes(pedidoSelecionado.observacoes || '');
                        setModalEditarAberto(true);
                      }}
                      activeOpacity={0.8}>
                      <Feather name="edit-2" size={14} color="#475569" />
                      <Text style={styles.drawerEditBtnText}>Editar Informações</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.drawerDeleteBtn}
                      onPress={() => {
                        setPedidoParaExcluir(pedidoSelecionado);
                        setModalExcluirAberto(true);
                      }}
                      activeOpacity={0.8}>
                      <Feather name="trash-2" size={14} color="#DC2626" />
                      <Text style={styles.drawerDeleteBtnText}>Cancelar Pedido</Text>
                    </TouchableOpacity>
                  </View>

                </ScrollView>
              </View>
            )}

          </View>
        </View>

      </View>

      {/* =========================================================================
          MODAIS INTERATIVOS
      ========================================================================== */}

      {/* 1. MODAL DE DAR BAIXA DE PAGAMENTO */}
      <Modal
        visible={modalBaixaAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalBaixaAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeaderRow}>
              <View>
                <View style={styles.modalTagRow}>
                  <Text style={styles.modalTagText}>FINANCEIRO • BAIXA DE CAIXA</Text>
                </View>
                <Text style={styles.modalMainTitle}>Dar Baixa de Pagamento</Text>
              </View>
              <TouchableOpacity onPress={() => setModalBaixaAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {pedidoParaBaixa && (
              <View style={styles.modalBodyContent}>
                <View style={styles.modalOrderSummaryCard}>
                  <Text style={styles.modalOrderSummaryCode}>
                    {pedidoParaBaixa.codigoDisplay} • {pedidoParaBaixa.clienteNome}
                  </Text>
                  <Text style={styles.modalOrderSummaryTotal}>
                    Valor a Receber: <Text style={{ color: '#DC2626', fontWeight: '800' }}>R$ {pedidoParaBaixa.saldoNaEntrega.toFixed(2)}</Text>
                  </Text>
                </View>

                {/* FORMA DE PAGAMENTO REALIZADA */}
                <Text style={styles.modalInputLabel}>SELECIONE A FORMA DE PAGAMENTO:</Text>
                <View style={styles.modalPayOptionsGrid}>
                  {[
                    { id: 'pix', label: 'Pix Instantâneo', icon: 'zap' },
                    { id: 'cartao_credito', label: 'Cartão de Crédito', icon: 'credit-card' },
                    { id: 'cartao_debito', label: 'Cartão de Débito', icon: 'credit-card' },
                    { id: 'dinheiro', label: 'Dinheiro em Espécie', icon: 'dollar-sign' },
                  ].map((opt) => {
                    const ativo = baixaFormaPagamento === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.modalPayOptionBtn, ativo && styles.modalPayOptionBtnActive]}
                        onPress={() => setBaixaFormaPagamento(opt.id as any)}
                        activeOpacity={0.75}>
                        <Feather
                          name={opt.icon as any}
                          size={16}
                          color={ativo ? KipiPalette.icedDenim : '#64748B'}
                        />
                        <Text style={[styles.modalPayOptionText, ativo && styles.modalPayOptionTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* VALOR RECEBIDO */}
                <Text style={styles.modalInputLabel}>VALOR RECEBIDO (R$):</Text>
                <TextInput
                  style={styles.modalNumberInput}
                  value={baixaValor}
                  onChangeText={setBaixaValor}
                  keyboardType="numeric"
                  placeholder="0,00"
                />

                {/* CHAVE PIX DE DESTINO */}
                <View style={styles.modalPixNotice}>
                  <Feather name="info" size={14} color={KipiPalette.icedDenim} />
                  <Text style={styles.modalPixNoticeText}>
                    Chave Pix cadastrada do ateliê: {CHAVE_PIX_ATELIE} ({TITULAR_PIX})
                  </Text>
                </View>

                {/* BOTÕES DE CONFIRMAÇÃO */}
                <View style={styles.modalFooterActions}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setModalBaixaAberto(false)}>
                    <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={confirmarBaixaPagamento}
                    activeOpacity={0.85}>
                    <Feather name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.modalConfirmBtnText}>Confirmar Recebimento</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 2. MODAL "A RECEBER" (LISTAGEM DE QUEM ESTÁ PENDENTE) */}
      <Modal
        visible={modalAReceberAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalAReceberAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { maxWidth: 650 }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <View style={[styles.modalTagRow, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.modalTagText, { color: '#DC2626' }]}>CONTROLE DE INADIMPLÊNCIA</Text>
                </View>
                <Text style={styles.modalMainTitle}>Contas a Receber (Pendentes)</Text>
                <Text style={styles.modalMainSubtitle}>
                  Lista detalhada de clientes com pedidos em aberto para cobrança imediata
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalAReceberAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalTotalPendingBanner}>
              <View>
                <Text style={styles.modalTotalPendingLabel}>TOTAL PENDENTE DE RECEBIMENTO</Text>
                <Text style={styles.modalTotalPendingValue}>{kpis.totalAReceberFormatado}</Text>
              </View>
              <View style={styles.modalTotalPendingCountBadge}>
                <Text style={styles.modalTotalPendingCountText}>{pedidosPendentes.length} pedidos pendentes</Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {pedidosPendentes.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Feather name="check-circle" size={36} color="#16A34A" />
                  <Text style={{ marginTop: 8, fontSize: 16, fontWeight: '700', color: '#16A34A' }}>
                    Parabéns! Nenhuma conta pendente.
                  </Text>
                </View>
              ) : (
                pedidosPendentes.map((ped) => (
                  <View key={ped.id} style={styles.modalPendingRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 14 }}>
                          {ped.clienteNome}
                        </Text>
                        <Text style={{ color: '#64748B', fontSize: 12 }}>({ped.codigoDisplay})</Text>
                      </View>
                      <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                        Data: {ped.dataDisplay} • Vendedor: {ped.vendedor}
                      </Text>
                      <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 15, marginTop: 4 }}>
                        R$ {ped.saldoNaEntrega.toFixed(2)} devido
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={styles.btnSmallWpp}
                        onPress={() => {
                          copiarComprovanteWhatsApp(ped);
                        }}>
                        <Feather name="message-circle" size={13} color="#16A34A" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#16A34A' }}>Cobrar WPP</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnSmallBaixa}
                        onPress={() => {
                          setModalAReceberAberto(false);
                          abrirModalBaixa(ped);
                        }}>
                        <Feather name="check" size={13} color="#FFFFFF" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Dar Baixa</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3. MODAL "ESTOQUE GERAL" (CONSULTA DE PRODUTOS E CATEGORIAS) */}
      <Modal
        visible={modalEstoqueAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalEstoqueAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { maxWidth: 680 }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <View style={[styles.modalTagRow, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={[styles.modalTagText, { color: '#0284C7' }]}>INVENTÁRIO & DISPONIBILIDADE</Text>
                </View>
                <Text style={styles.modalMainTitle}>Estoque Geral de Produtos</Text>
                <Text style={styles.modalMainSubtitle}>
                  Consulte a quantidade em tempo real de cada item e categoria
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalEstoqueAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* BARRA DE PESQUISA E FILTROS DE CATEGORIA */}
            <View style={styles.stockSearchRow}>
              <View style={styles.stockSearchBox}>
                <Feather name="search" size={14} color="#94A3B8" />
                <TextInput
                  style={styles.stockSearchInput}
                  placeholder="Pesquisar produto no estoque..."
                  placeholderTextColor="#94A3B8"
                  value={buscaEstoque}
                  onChangeText={setBuscaEstoque}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['Todas', 'Cookies', 'Bolos & Bentos', 'Macarons', 'Sobremesas', 'Doces Finos', 'Insumos'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.stockCatChip,
                      categoriaEstoque === cat && styles.stockCatChipActive,
                    ]}
                    onPress={() => setCategoriaEstoque(cat)}>
                    <Text
                      style={[
                        styles.stockCatChipText,
                        categoriaEstoque === cat && styles.stockCatChipTextActive,
                      ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* TABELA DE PRODUTOS EM ESTOQUE */}
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {estoqueFiltrado.map((prod) => (
                <View key={prod.id} style={styles.stockTableRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 14 }}>
                      {prod.nome}
                    </Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                      Categoria: {prod.categoria} • Preço: R$ {prod.preco.toFixed(2)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View
                      style={[
                        styles.stockQtyBadge,
                        prod.status === 'zerado'
                          ? { backgroundColor: '#FEE2E2' }
                          : prod.status === 'baixo'
                          ? { backgroundColor: '#FEF3C7' }
                          : { backgroundColor: '#F0FDF4' },
                      ]}>
                      <Text
                        style={[
                          styles.stockQtyText,
                          prod.status === 'zerado'
                            ? { color: '#DC2626' }
                            : prod.status === 'baixo'
                            ? { color: '#D97706' }
                            : { color: '#16A34A' },
                        ]}>
                        {prod.estoque} un. disponíveis
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                      Mínimo recomendado: {prod.estoqueMinimo} un.
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4. MODAL EDITAR OBSERVAÇÕES DO PEDIDO */}
      <Modal
        visible={modalEditarAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalEditarAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalMainTitle}>Editar Pedido {pedidoParaEditar?.codigoDisplay}</Text>
                <Text style={styles.modalMainSubtitle}>Atualize notas e instruções de produção</Text>
              </View>
              <TouchableOpacity onPress={() => setModalEditarAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.modalInputLabel}>INSTRUÇÕES E OBSERVAÇÕES:</Text>
              <TextInput
                style={[styles.modalTextInput, { height: 90, textAlignVertical: 'top' }]}
                multiline
                value={editObservacoes}
                onChangeText={setEditObservacoes}
                placeholder="Ex: Frase personalizada, cor do laço, horário preferido..."
              />

              <View style={styles.modalFooterActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setModalEditarAberto(false)}>
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={salvarEdicaoPedido}>
                  <Text style={styles.modalConfirmBtnText}>Salvar Alterações</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (LÓGICA) */}
      <Modal
        visible={modalExcluirAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalExcluirAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeaderRow}>
              <View>
                <View style={[styles.modalTagRow, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.modalTagText, { color: '#DC2626' }]}>EXCLUSÃO LÓGICA</Text>
                </View>
                <Text style={[styles.modalMainTitle, { color: '#DC2626' }]}>Cancelar Pedido?</Text>
              </View>
              <TouchableOpacity onPress={() => setModalExcluirAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={{ marginTop: 12, color: '#475569', fontSize: 14, lineHeight: 22 }}>
              Deseja realmente cancelar o pedido <Text style={{ fontWeight: '700', color: '#0F172A' }}>{pedidoParaExcluir?.codigoDisplay}</Text> de <Text style={{ fontWeight: '700', color: '#0F172A' }}>{pedidoParaExcluir?.clienteNome}</Text>?
              {'\n\n'}
              O pedido será arquivado logicamente como cancelado, mantendo a integridade do histórico contábil.
            </Text>

            <View style={styles.modalFooterActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalExcluirAberto(false)}>
                <Text style={styles.modalCancelBtnText}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#DC2626' }]}
                onPress={confirmarExclusaoLogica}>
                <Feather name="trash-2" size={16} color="#FFFFFF" />
                <Text style={styles.modalConfirmBtnText}>Sim, Cancelar Pedido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. MODAL NOVO PEDIDO COMPLETO */}
      <NovoPedidoModal
        visible={modalNovoPedidoAberto}
        onClose={() => setModalNovoPedidoAberto(false)}
        onPedidoCriado={lidarComPedidoCriado}
      />

      {/* FEEDBACK TOAST FLUTUANTE */}
      {toastMensagem && (
        <View style={styles.floatingToast}>
          <Feather name="check-circle" size={17} color="#FFFFFF" />
          <Text style={styles.floatingToastText}>{toastMensagem}</Text>
        </View>
      )}

    </SafeAreaView>
  );
}

// ============================================================================
// FOLHA DE ESTILOS MODERNA (ATELIERQ PÂTISSERIE PALETTE)
// ============================================================================

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: '#E6F1FA',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },

  // --------------------------------------------------------------------------
  // MENU LATERAL
  // --------------------------------------------------------------------------
  sidebar: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 100,
    ...Platform.select({
      web: {
        transition: 'width 0.25s ease-in-out',
        boxShadow: '2px 0 16px rgba(15, 23, 42, 0.04)',
      },
    }),
  },
  sidebarCollapsed: {
    width: 68,
  },
  sidebarExpanded: {
    width: 250,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeLetter: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    fontFamily: Fonts.sans,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  saasTag: {
    backgroundColor: '#F3F6DD',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  saasTagText: {
    color: '#708018',
    fontSize: 9,
    fontWeight: '800',
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  sidebarNav: {
    flex: 1,
  },
  sidebarNavContent: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  navItemActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  navItemActiveCollapsed: {
    backgroundColor: KipiPalette.icedDenim,
    width: 44,
    height: 44,
    alignSelf: 'center',
    borderRadius: 12,
    paddingVertical: 0,
  },
  navItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    fontFamily: Fonts.sans,
  },
  navItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sidebarFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  pinBtnActive: {
    backgroundColor: '#EAF3FA',
  },
  pinBtnCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  pinBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  userMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 10,
    gap: 8,
  },
  userMiniCardCollapsed: {
    justifyContent: 'center',
    padding: 4,
    backgroundColor: 'transparent',
  },
  userMiniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: KipiPalette.pistachio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMiniAvatarLetter: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  userMiniInfo: {
    flex: 1,
  },
  userMiniName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  userMiniRole: {
    fontSize: 10,
    color: '#64748B',
  },

  // --------------------------------------------------------------------------
  // ÁREA DE CONTEÚDO PRINCIPAL
  // --------------------------------------------------------------------------
  contentArea: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#E6F1FA',
  },

  // BARRA SUPERIOR
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 12,
  },
  topBarLeft: {
    flex: 1,
    minWidth: 260,
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  screenHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: KipiPalette.icedDenim,
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  screenSubheading: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  viewModeBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      },
    }),
  },
  viewModeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  viewModeBtnTextActive: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
  },
  btnNovoPedido: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KipiPalette.icedDenim,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(87, 152, 215, 0.3)',
      },
    }),
  },
  btnNovoPedidoText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: Fonts.sans,
  },

  // --------------------------------------------------------------------------
  // WORKSPACE SPLIT (FEED + GAVETA EXPANSÍVEL LATERAL)
  // --------------------------------------------------------------------------
  workspaceSplitArea: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  feedScrollView: {
    flex: 1,
  },
  feedScrollViewWithDrawer: {
    flex: 0.62,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  feedContentContainer: {
    padding: 24,
    gap: 20,
    paddingBottom: 60,
  },

  // --------------------------------------------------------------------------
  // 1. LINHA DE KPIS (TOTAL VENDIDO, ITENS, A RECEBER, ESTOQUE)
  // --------------------------------------------------------------------------
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
      },
    }),
  },
  kpiCardClickable: {
    borderStyle: 'solid',
    borderColor: '#D4E6F6',
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBadgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiBadgeGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  kpiBadgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiBadgeRedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  kpiValueText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
    letterSpacing: -0.5,
  },
  kpiLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  kpiHintText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },

  // --------------------------------------------------------------------------
  // 2. INSIGHTS ROW (TOP 3 PRODUTOS E TOP 3 CLIENTES)
  // --------------------------------------------------------------------------
  insightsTwinRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  insightCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  insightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniInsightIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  insightSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  podiumBadge: {
    backgroundColor: '#F3F6DD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  podiumBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#708018',
  },
  topItemList: {
    marginTop: 12,
    gap: 10,
  },
  topItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  topItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  topItemMedal: {
    fontSize: 16,
  },
  topItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  topItemCategory: {
    fontSize: 11,
    color: '#64748B',
  },
  topItemRight: {
    alignItems: 'flex-end',
  },
  topItemQty: {
    fontSize: 12,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  topItemTotal: {
    fontSize: 11,
    color: '#64748B',
  },
  clientMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EAF3FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientMiniAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },

  // --------------------------------------------------------------------------
  // 3. BARRA DE FILTROS COMPLETOS
  // --------------------------------------------------------------------------
  filterSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 240,
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
    outlineWidth: 0,
  },
  filtersControlsArea: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  pillBtnActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pillBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sellersScrollRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sellerChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sellerChipActive: {
    backgroundColor: '#EAF3FA',
    borderColor: KipiPalette.icedDenim,
  },
  sellerChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  sellerChipTextActive: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
  },
  customDateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    flexWrap: 'wrap',
  },
  customDateGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customDateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  customDateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: '#0F172A',
  },
  customDateFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customDateFeedbackText: {
    fontSize: 11,
    color: KipiPalette.icedDenim,
    fontWeight: '600',
  },

  // --------------------------------------------------------------------------
  // 4. HISTÓRICO DE PEDIDOS POR DIA (SEPARADO POR DIA)
  // --------------------------------------------------------------------------
  ordersHistorySection: {
    gap: 22,
  },
  emptyFeedState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyFeedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptyFeedSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  btnResetFiltros: {
    marginTop: 16,
    backgroundColor: KipiPalette.icedDenim,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnResetFiltrosText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  dayGroupBlock: {
    gap: 10,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dayTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayDotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: KipiPalette.icedDenim,
  },
  dayTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    fontFamily: Fonts.sans,
  },
  daySummaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayBadgeCount: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayBadgeCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  dayTotalRevenue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  dayPendingBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dayPendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  // ITENS DO PEDIDO EM LISTA
  ordersListContainer: {
    gap: 10,
  },
  orderListItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...Platform.select({
      web: {
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      },
    }),
  },
  orderListItemActive: {
    borderColor: KipiPalette.icedDenim,
    backgroundColor: '#FAFDFE',
    borderLeftWidth: 4,
    borderLeftColor: KipiPalette.icedDenim,
  },
  orderItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderItemCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderItemCode: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.mono,
  },
  orderTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagEncomenda: {
    backgroundColor: '#FEF3C7',
  },
  tagEncomendaText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  tagProntaEntrega: {
    backgroundColor: '#EAF3FA',
  },
  tagProntaEntregaText: {
    color: KipiPalette.icedDenim,
    fontSize: 11,
    fontWeight: '700',
  },
  orderTypeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPagoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  statusPagoText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
  },
  statusPendenteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  statusPendenteText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  orderItemSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderTimeText: {
    fontSize: 12,
    color: '#64748B',
  },
  orderSellerDot: {
    color: '#CBD5E1',
  },
  orderSellerName: {
    fontSize: 12,
    color: '#64748B',
  },
  orderItemBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderClientAndItems: {
    flex: 1,
    gap: 4,
  },
  orderClientTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderClientName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  orderClientTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  orderClientTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  orderItemsPreview: {
    marginTop: 2,
  },
  orderItemsPreviewText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  orderPriceBlock: {
    alignItems: 'flex-end',
  },
  orderPriceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  orderPriceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  orderPendingBalance: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  orderItemActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  btnDarBaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  btnDarBaixaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  btnWhatsApp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  btnWhatsAppText: {
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 12,
  },
  btnVerDetalhes: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  btnVerDetalhesActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  btnVerDetalhesText: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
    fontSize: 12,
  },
  btnVerDetalhesTextActive: {
    color: '#FFFFFF',
  },
  orderActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btnIconAction: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },

  // GRID DE CARDS
  ordersGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  orderGridCard: {
    flex: 1,
    minWidth: 260,
    maxWidth: '49%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  gridCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridCardClientName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  gridCardSeller: {
    fontSize: 11,
    color: '#64748B',
  },
  gridCardItemsBox: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    gap: 3,
  },
  gridCardItemLine: {
    fontSize: 11,
    color: '#475569',
  },
  gridCardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  gridCardPriceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  gridCardPriceValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  gridCardDetailBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  gridCardDetailBtnText: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
    fontSize: 11,
  },
  gridCardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  gridCardBaixaBtn: {
    flex: 1,
    backgroundColor: '#16A34A',
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  gridCardBaixaBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  gridCardWppBtn: {
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
  gridCardWppBtnText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
  },

  // --------------------------------------------------------------------------
  // 5. PAINEL LATERAL DESLIZANTE / EXPANSÍVEL (PINTEREST REFERENCE)
  // --------------------------------------------------------------------------
  modernSlideOverDrawer: {
    flex: 0.38,
    minWidth: 380,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        transition: 'all 0.3s ease-in-out',
        boxShadow: '-4px 0 24px rgba(15, 23, 42, 0.08)',
      },
    }),
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  drawerHeaderLeft: {
    gap: 4,
  },
  drawerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerCodeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.mono,
  },
  drawerDateSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  drawerCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerScrollView: {
    flex: 1,
  },
  drawerScrollContent: {
    padding: 20,
    gap: 18,
    paddingBottom: 40,
  },
  drawerActionsBar: {
    gap: 8,
  },
  drawerActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
      },
    }),
  },
  drawerActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  drawerActionBtnWpp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  drawerActionBtnWppText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  drawerCardSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  drawerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  drawerSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  drawerClientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  drawerClientInfo: {
    flex: 1,
  },
  drawerClientName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  drawerClientSub: {
    fontSize: 12,
    color: '#64748B',
  },
  drawerMetaInfoRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  drawerMetaItem: {
    flex: 1,
  },
  drawerMetaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
  drawerMetaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },

  // LINHA DO TEMPO DO DRAWER
  timelineContainer: {
    gap: 4,
    paddingVertical: 4,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotComplete: {
    backgroundColor: '#16A34A',
  },
  timelineDotPending: {
    backgroundColor: '#CBD5E1',
  },
  timelineDotAlert: {
    backgroundColor: '#DC2626',
  },
  timelineContent: {
    flex: 1,
  },
  timelineStepTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineStepDesc: {
    fontSize: 11,
    color: '#64748B',
  },
  timelineLine: {
    width: 2,
    height: 12,
    backgroundColor: '#E2E8F0',
    marginLeft: 9,
  },

  // ITENS DO PEDIDO NO DRAWER
  drawerItemsTable: {
    gap: 8,
  },
  drawerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  drawerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  drawerItemQtyBadge: {
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  drawerItemQtyText: {
    fontSize: 11,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  drawerItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  drawerItemCat: {
    fontSize: 11,
    color: '#64748B',
  },
  drawerItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  drawerFinancialBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    marginTop: 6,
  },
  drawerFinanceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drawerFinanceLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  drawerFinanceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  drawerFinanceDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  drawerFinanceTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerFinanceTotalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  drawerFinanceTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
    fontFamily: Fonts.sans,
  },

  // WHATSAPP GENERATOR NO DRAWER
  wppPreviewBubble: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#25D366',
  },
  wppPreviewText: {
    fontSize: 11,
    color: '#1F2937',
    fontFamily: Fonts.mono,
    lineHeight: 16,
  },
  wppButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  btnCopyWpp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  btnCopyWppSuccess: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  btnCopyWppText: {
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  btnCopyWppTextSuccess: {
    color: '#FFFFFF',
  },
  btnOpenWppDirect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  btnOpenWppDirectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },

  // OBSERVAÇÕES
  drawerObsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  drawerObsText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#475569',
  },

  // RODAPÉ DO DRAWER
  drawerFooterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  drawerEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  drawerEditBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  drawerDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  drawerDeleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },

  // --------------------------------------------------------------------------
  // MODAIS
  // --------------------------------------------------------------------------
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  modalBox: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
      },
    }),
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTagRow: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  modalTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  modalMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  modalMainSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalBodyContent: {
    marginTop: 14,
    gap: 12,
  },
  modalOrderSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalOrderSummaryCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalOrderSummaryTotal: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  modalInputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginTop: 4,
  },
  modalPayOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalPayOptionBtn: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  modalPayOptionBtnActive: {
    backgroundColor: '#EAF3FA',
    borderColor: KipiPalette.icedDenim,
  },
  modalPayOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalPayOptionTextActive: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
  },
  modalNumberInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  modalPixNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF3FA',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  modalPixNoticeText: {
    fontSize: 11,
    color: '#1E3A8A',
    fontWeight: '600',
    flex: 1,
  },
  modalFooterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  modalConfirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // PENDÊNCIAS
  modalTotalPendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 10,
    marginVertical: 14,
  },
  modalTotalPendingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
  },
  modalTotalPendingValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#DC2626',
    fontFamily: Fonts.sans,
  },
  modalTotalPendingCountBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalTotalPendingCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  modalPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  btnSmallWpp: {
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
  btnSmallBaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },

  // ESTOQUE
  stockSearchRow: {
    marginVertical: 12,
    gap: 8,
  },
  stockSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  stockSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
    outlineWidth: 0,
  },
  stockCatChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  stockCatChipActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  stockCatChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  stockCatChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stockTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stockQtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockQtyText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // TOAST FLUTUANTE
  floatingToast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 10,
    zIndex: 9999,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      },
    }),
  },
  floatingToastText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
