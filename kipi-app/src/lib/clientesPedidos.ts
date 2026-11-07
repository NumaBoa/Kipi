import { useEffect, useState, useSyncExternalStore } from 'react';
import { baixarEstoque, devolverEstoque, produtoPorNome, custoUnitarioProduto } from '@/lib/estoqueVitrine';
import { sincronizarVendaDoPedido, VENDAS_REVENDA_INICIAIS, REVENDEDORAS_INICIAIS } from '@/lib/revenda';
import { nomeUsuarioAtual, registrarDadosDoEstabelecimento } from '@/lib/acesso';

// ============================================================================
// CLIENTES E PEDIDOS — fonte única compartilhada entre as telas
// (Pedidos, Novo Pedido, Clientes, Produção e Visão Geral).
// Fase de testes: só dados de exemplo em memória, nada é lido ou gravado no banco.
// Quando ligar o banco, só este arquivo troca a origem dos dados.
// ============================================================================

export interface PedidoItem {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  precoUnitario: number;
  desconto?: number;
  comDesconto?: boolean;
  motivoPromocao?: string; // 'Próximo a vencer' | 'Compra em lote'
  totalItem: number;
  produtoId?: string | null;
  custoUnitario?: number; // custo pela ficha técnica do produto
}

export interface Pedido {
  id: string;
  codigoDisplay: string;
  clienteId?: string | null; // null = venda avulsa de balcão
  clienteNome: string;
  clienteTelefone?: string | null;
  clienteEmail?: string | null;
  tag: string;
  tipoPedido: 'pronta_entrega' | 'sob_encomenda';
  data: string; // ISO da criação do pedido
  dataDisplay: string;
  horaDisplay: string;
  diaChave: string; // YYYY-MM-DD
  diaTitulo: string; // Ex: Sábado, 17 de Outubro
  dataEntrega?: string | null; // ISO da entrega combinada (encomendas)
  vendedor: string;
  vendedorCargo: string;
  formaPagamento: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'pendente';
  status: 'pago' | 'pendente' | 'cancelado';
  total: number;
  valorSinalPago: number;
  saldoNaEntrega: number;
  statusProducao: 'a_fazer' | 'em_producao' | 'pronto' | 'entregue';
  itens: PedidoItem[];
  custoTotal?: number;
  observacoes?: string | null;
  deletado?: boolean; // exclusão lógica: o pedido fica guardado como cancelado
  revendedoraId?: string | null; // venda da revendedora (sai do estoque que está com ela, não da vitrine)
}

export interface ProdutoComprado {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  totalGasto: number;
  dataUltimaCompra: string;
  emoji: string;
}

export interface ClienteCompleto {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  cpf_cnpj?: string | null;
  aniversario?: string | null; // ex: "24/10" ou "24/10/1992"
  mesAniversario?: number; // 1-12
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  complemento?: string | null;
  observacoes?: string | null; // preferências e restrições
  tag?: string | null;
  revendedoraId?: string | null; // null = cliente direto do ateliê
  revendedoraNome?: string | null;
  status: 'ativo' | 'inativo';
  // Calculados a partir dos pedidos do cliente
  totalGasto: number;
  quantidadePedidos: number;
  ticketMedio: number;
  produtoMaisComprado?: string;
  produtosComprados: ProdutoComprado[];
  created_at?: string;
}

// Dados de cadastro (o resto vem dos pedidos)
export type ClienteCadastro = Omit<
  ClienteCompleto,
  'totalGasto' | 'quantidadePedidos' | 'ticketMedio' | 'produtoMaisComprado' | 'produtosComprados'
>;

// ============================================================================
// DATAS — os exemplos foram escritos com "hoje" = 19/10/2026; tudo é deslocado
// para que esse dia caia na data de hoje e os filtros de período funcionem
// ============================================================================
const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DESLOCAMENTO_MS = inicioDoDia(new Date()).getTime() - new Date(2026, 9, 19).getTime();
const deslocar = (iso: string) => new Date(new Date(iso).getTime() + DESLOCAMENTO_MS).toISOString();

const doisDigitos = (n: number) => String(n).padStart(2, '0');
export const chaveDoDia = (d: Date) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
// "sábado, 17 de outubro" → "Sábado, 17 de Outubro"
const capitalizar = (s: string) =>
  (s.charAt(0).toUpperCase() + s.slice(1)).replace(/ de (\S)/, (_, letra: string) => ` de ${letra.toUpperCase()}`);

export const camposDeData = (iso: string) => {
  const d = new Date(iso);
  const hoje = inicioDoDia(new Date()).getTime();
  const dia = inicioDoDia(d).getTime();
  const extenso = capitalizar(d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
  const prefixo = dia === hoje ? 'Hoje • ' : dia === hoje - 86400000 ? 'Ontem • ' : '';
  return {
    dataDisplay: d.toLocaleDateString('pt-BR'),
    horaDisplay: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    diaChave: chaveDoDia(d),
    diaTitulo: `${prefixo}${extenso}`,
  };
};

// "Hoje 14:00", "Amanhã 11:00", "05/11 09:30" ou "Data a combinar"
export const rotuloEntrega = (iso?: string | null) => {
  if (!iso) return 'Data a combinar';
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const diff = Math.round((inicioDoDia(d).getTime() - inicioDoDia(new Date()).getTime()) / 86400000);
  if (diff === 0) return `Hoje ${hora}`;
  if (diff === 1) return `Amanhã ${hora}`;
  if (diff === -1) return `Ontem ${hora}`;
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} ${hora}`;
};

// Aceita "2026-10-25 14:00", "25/10/2026 14:00" ou "25/10 14:00"; null se não entender
export const lerDataEntrega = (texto: string): string | null => {
  const t = texto.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0)).toISOString();
  m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const ano = m[3] ? +m[3] : new Date().getFullYear();
    return new Date(ano, +m[2] - 1, +m[1], +(m[4] || 12), +(m[5] || 0)).toISOString();
  }
  return null;
};

const EMOJI_CATEGORIA: Record<string, string> = {
  Cookies: '🍪',
  'Bolos & Bentos': '🎂',
  Macarons: '✨',
  Sobremesas: '🍮',
  'Doces Finos': '🍬',
  Presentes: '🎁',
  Folhados: '🥐',
  Bebidas: '☕',
};

// ============================================================================
// DADOS DE EXEMPLO
// ============================================================================
// Clientes com o histórico de compras (vira pedidos antigos logo abaixo)
const CLIENTES_BASE: ClienteCompleto[] = [
  {
    id: 'cli-1',
    nome: 'Mariana Albuquerque',
    telefone: '(21) 98844-3321',
    email: 'mariana.alb@gmail.com',
    aniversario: '28/10/1994',
    mesAniversario: 10,
    cep: '22040-002',
    rua: 'Rua Barata Ribeiro',
    numero: '450',
    complemento: 'Apto 802',
    bairro: 'Copacabana',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    tag: 'Noiva VIP',
    status: 'ativo',
    totalGasto: 2840.00,
    quantidadePedidos: 6,
    ticketMedio: 473.33,
    produtoMaisComprado: 'Bolo Casamento Flores de Açúcar',
    observacoes: 'Noiva de Novembro. Prefere doces com pouco açúcar, louca por ganache de pistache e laços em fita de cetim dusty rose.',
    produtosComprados: [
      { id: 'p1', nome: 'Bolo Casamento Flores de Açúcar', categoria: 'Bolos & Bentos', quantidade: 2, totalGasto: 680.00, dataUltimaCompra: '15/10/2026', emoji: '🎂' },
      { id: 'p2', nome: 'Torre de Macarons 24 unidades', categoria: 'Macarons', quantidade: 3, totalGasto: 660.00, dataUltimaCompra: '12/10/2026', emoji: '✨' },
      { id: 'p3', nome: 'Cento de Brigadeiros Gourmet Belga', categoria: 'Doces Finos', quantidade: 5, totalGasto: 800.00, dataUltimaCompra: '08/10/2026', emoji: '🍬' },
      { id: 'p4', nome: 'Cookie Black Nutella', categoria: 'Cookies', quantidade: 14, totalGasto: 264.60, dataUltimaCompra: '18/10/2026', emoji: '🍪' },
    ],
  },
  {
    id: 'cli-2',
    nome: 'Dra. Camila Morales',
    telefone: '(21) 99122-4411',
    email: 'morales.camila@clinicavita.com',
    aniversario: '24/10/1988',
    mesAniversario: 10,
    cep: '22640-100',
    rua: 'Avenida das Américas',
    numero: '3500',
    complemento: 'Bloco 4 - Sala 312',
    bairro: 'Barra da Tijuca',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    tag: 'VIP Corporativo',
    status: 'ativo',
    totalGasto: 1980.50,
    quantidadePedidos: 12,
    ticketMedio: 165.04,
    produtoMaisComprado: 'Cookie Tradicional Gotas Belga',
    observacoes: 'Manda caixinhas de cookies de presente para pacientes da clínica toda sexta-feira. Pedir sempre embalagem para presente.',
    produtosComprados: [
      { id: 'p4', nome: 'Cookie Tradicional Gotas Belga', categoria: 'Cookies', quantidade: 38, totalGasto: 566.20, dataUltimaCompra: '19/10/2026', emoji: '🍪' },
      { id: 'p5', nome: 'Caixa Macarons Degustação (6 un)', categoria: 'Macarons', quantidade: 10, totalGasto: 570.00, dataUltimaCompra: '16/10/2026', emoji: '🧁' },
      { id: 'p6', nome: 'Bento Cake Pistache & Framboesa', categoria: 'Bolos & Bentos', quantidade: 4, totalGasto: 260.00, dataUltimaCompra: '02/10/2026', emoji: '🎂' },
    ],
  },
  {
    id: 'cli-3',
    nome: 'Fernanda Montenegro Santos',
    telefone: '(21) 98711-2299',
    email: 'fernanda.m@globo.com',
    aniversario: '12/05/1990',
    mesAniversario: 5,
    cep: '22410-003',
    rua: 'Rua Visconde de Pirajá',
    numero: '215',
    complemento: 'Apto 1101',
    bairro: 'Ipanema',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    tag: 'Festa Infantil',
    status: 'ativo',
    totalGasto: 1420.00,
    quantidadePedidos: 4,
    ticketMedio: 355.00,
    produtoMaisComprado: 'Bolo Red Velvet Floral',
    observacoes: 'Filho alérgico a nozes e amendoim. Produtos devem ser 100% nut-free na bancada.',
    produtosComprados: [
      { id: 'p7', nome: 'Bolo Red Velvet Floral', categoria: 'Bolos & Bentos', quantidade: 3, totalGasto: 960.00, dataUltimaCompra: '18/10/2026', emoji: '🎂' },
      { id: 'p8', nome: 'Cento de Brigadeiros Gourmet Belga', categoria: 'Doces Finos', quantidade: 2, totalGasto: 320.00, dataUltimaCompra: '18/10/2026', emoji: '🍬' },
    ],
  },
  {
    id: 'cli-4',
    nome: 'Guilherme Peixoto',
    telefone: '(21) 99876-5432',
    email: 'guilherme.px@yahoo.com',
    aniversario: '05/10/1995',
    mesAniversario: 10,
    cep: '22270-010',
    rua: 'Rua Voluntários da Pátria',
    numero: '120',
    complemento: 'Apto 401',
    bairro: 'Botafogo',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    tag: 'Noivado',
    status: 'ativo',
    totalGasto: 890.00,
    quantidadePedidos: 3,
    ticketMedio: 296.67,
    produtoMaisComprado: 'Torre de Macarons 24 unidades',
    observacoes: 'Adora café espresso com fatia de torta ópera.',
    produtosComprados: [
      { id: 'p2', nome: 'Torre de Macarons 24 unidades', categoria: 'Macarons', quantidade: 2, totalGasto: 440.00, dataUltimaCompra: '17/10/2026', emoji: '✨' },
      { id: 'p9', nome: 'Fatia Torta Ópera Café & Ganache', categoria: 'Sobremesas', quantidade: 6, totalGasto: 201.00, dataUltimaCompra: '10/10/2026', emoji: '🍮' },
    ],
  },
  {
    id: 'cli-5',
    nome: 'Larissa Manoela Vasconcelos',
    telefone: '(21) 98455-1234',
    email: 'larissa.v@outlook.com',
    aniversario: '15/10/2001',
    mesAniversario: 10,
    cep: '22793-080',
    rua: 'Avenida Olegário Maciel',
    numero: '510',
    complemento: '',
    bairro: 'Barra da Tijuca',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    tag: 'Recompra Semanal',
    cpf_cnpj: '529.982.247-25',
    revendedoraId: 'rev-1',
    revendedoraNome: 'Juliana Martins Costa',
    status: 'ativo',
    totalGasto: 645.20,
    quantidadePedidos: 8,
    ticketMedio: 80.65,
    produtoMaisComprado: 'Cookie Black Nutella',
    observacoes: 'Pede sempre no delivery pelo WhatsApp. Gosta de entrega rápida por volta das 16h.',
    produtosComprados: [
      { id: 'p1', nome: 'Cookie Black Nutella', categoria: 'Cookies', quantidade: 22, totalGasto: 415.80, dataUltimaCompra: '19/10/2026', emoji: '🍪' },
      { id: 'p10', nome: 'Brownie Fudge Triplo Chocolate', categoria: 'Cookies', quantidade: 10, totalGasto: 155.00, dataUltimaCompra: '14/10/2026', emoji: '🍫' },
    ],
  },
  {
    id: 'cli-6',
    nome: 'Roberto Justus Filho',
    telefone: '(21) 97123-9988',
    email: 'roberto.justus@holding.com.br',
    aniversario: '03/02/1975',
    mesAniversario: 2,
    cep: '22470-050',
    rua: 'Rua Aníbal de Mendonça',
    numero: '88',
    complemento: 'Cobertura 01',
    bairro: 'Ipanema',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    tag: 'Corporativo',
    status: 'inativo',
    totalGasto: 520.00,
    quantidadePedidos: 1,
    ticketMedio: 520.00,
    produtoMaisComprado: 'Torre de Macarons 24 unidades',
    observacoes: 'Cliente corporativo. Sem compras há mais de 90 dias.',
    produtosComprados: [
      { id: 'p2', nome: 'Torre de Macarons 24 unidades', categoria: 'Macarons', quantidade: 2, totalGasto: 440.00, dataUltimaCompra: '12/04/2026', emoji: '✨' },
    ],
  },
];

// Pedidos recentes (datas relativas ao "hoje" dos exemplos, 19/10)
const PEDIDOS_BASE: Pedido[] = [
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

// Clientes que aparecem nos pedidos e encomendas de exemplo
const cadastroSimples = (id: string, nome: string, telefone: string, tag: string): ClienteCadastro => ({
  id,
  nome,
  telefone,
  tag,
  status: 'ativo',
  cidade: 'Rio de Janeiro',
  estado: 'RJ',
});

const CLIENTES_EXTRAS: ClienteCadastro[] = [
  cadastroSimples('cli-7', 'Café & Flor Bistrô', '(21) 3344-5566', 'Parceiro B2B'),
  cadastroSimples('cli-8', 'Boutique Doce Charme', '(21) 3211-9087', 'Parceiro B2B'),
  cadastroSimples('cli-9', 'Rodrigo Santoro Silva', '(21) 99876-1122', 'Cliente Frequente'),
  cadastroSimples('cli-10', 'Renata Fraga', '(21) 98123-7788', 'Encomendas'),
  cadastroSimples('cli-11', 'Fernanda Souza', '(21) 99712-3344', 'Cliente Frequente'),
  cadastroSimples('cli-12', 'Ateliê do Chocolate', '(21) 3022-4455', 'Parceiro B2B'),
  cadastroSimples('cli-13', 'Juliana Martins', '(21) 98456-2211', 'Aniversário'),
  cadastroSimples('cli-14', 'Condomínio Vila Real', '(21) 3555-1020', 'Corporativo'),
  cadastroSimples('cli-15', 'Café Icaraí', '(21) 2711-8899', 'Parceiro B2B'),
  cadastroSimples('cli-16', 'Patrícia Nogueira', '(21) 99234-5566', 'Encomendas'),
  cadastroSimples('cli-17', 'Renata Albuquerque', '(21) 98777-6655', 'Encomendas'),
];

// Encomendas com entrega marcada para hoje e amanhã (cronograma da Visão Geral e lista da Produção)
interface EncomendaBase {
  id: string;
  diasAteEntrega: 0 | 1;
  horario: string; // HH:mm
  clienteId: string;
  itens: { nome: string; categoria: string; quantidade: number; total: number }[];
  observacao?: string;
  saldoNaEntrega: number;
  statusProducao: Pedido['statusProducao'];
}

const ENCOMENDAS_BASE: EncomendaBase[] = [
  { id: 'enc-1', diasAteEntrega: 0, horario: '10:00', clienteId: 'cli-11', itens: [{ nome: 'Bento Cake Pistache & Framboesa', categoria: 'Bolos & Bentos', quantidade: 1, total: 65 }], saldoNaEntrega: 0, statusProducao: 'pronto' },
  { id: 'enc-2', diasAteEntrega: 0, horario: '14:00', clienteId: 'cli-1', itens: [{ nome: 'Bolo Floral 3 andares', categoria: 'Bolos & Bentos', quantidade: 1, total: 680 }], observacao: 'Escrever "Felicidades" no topo', saldoNaEntrega: 340, statusProducao: 'em_producao' },
  { id: 'enc-3', diasAteEntrega: 0, horario: '15:30', clienteId: 'cli-12', itens: [{ nome: 'Brigadeiros Pistache', categoria: 'Doces Finos', quantidade: 100, total: 160 }], saldoNaEntrega: 80, statusProducao: 'em_producao' },
  { id: 'enc-4', diasAteEntrega: 0, horario: '17:00', clienteId: 'cli-13', itens: [{ nome: 'Cookie Black Nutella', categoria: 'Cookies', quantidade: 12, total: 226.8 }], saldoNaEntrega: 0, statusProducao: 'pronto' },
  { id: 'enc-5', diasAteEntrega: 0, horario: '18:30', clienteId: 'cli-14', itens: [{ nome: 'Caixa Macarons Degustação (6 un)', categoria: 'Macarons', quantidade: 2, total: 114 }], observacao: 'Entregar na portaria', saldoNaEntrega: 114, statusProducao: 'pronto' },
  { id: 'enc-6', diasAteEntrega: 1, horario: '09:00', clienteId: 'cli-15', itens: [{ nome: 'Cookie Black Nutella', categoria: 'Cookies', quantidade: 20, total: 378 }], saldoNaEntrega: 0, statusProducao: 'a_fazer' },
  { id: 'enc-7', diasAteEntrega: 1, horario: '11:00', clienteId: 'cli-16', itens: [{ nome: 'Torta de Nozes c/ Caramelo Salgado', categoria: 'Sobremesas', quantidade: 1, total: 140 }], saldoNaEntrega: 70, statusProducao: 'a_fazer' },
  { id: 'enc-8', diasAteEntrega: 1, horario: '16:00', clienteId: 'cli-17', itens: [{ nome: 'Cento de Brigadeiros Gourmet Belga', categoria: 'Doces Finos', quantidade: 1, total: 160 }], observacao: 'Forminhas douradas', saldoNaEntrega: 0, statusProducao: 'a_fazer' },
];

// ============================================================================
// MONTAGEM DOS PEDIDOS DE EXEMPLO
// ============================================================================
const semMetricas = ({ totalGasto, quantidadePedidos, ticketMedio, produtoMaisComprado, produtosComprados, ...cadastro }: ClienteCompleto): ClienteCadastro => cadastro;

const montarItem = (id: string, nome: string, categoria: string, quantidade: number, total: number): PedidoItem => ({
  id,
  nome,
  categoria,
  quantidade,
  precoUnitario: Number((total / quantidade).toFixed(2)),
  totalItem: total,
  produtoId: produtoPorNome(nome)?.id ?? null,
});

// Histórico de compras de cada cliente vira pedidos antigos já pagos e entregues
const pedidosDoHistorico = (): Pedido[] => {
  let numero = 900;
  return CLIENTES_BASE.flatMap((c) =>
    c.produtosComprados.map((pc) => {
      numero += 1;
      const [dia, mes, ano] = pc.dataUltimaCompra.split('/').map(Number);
      const data = deslocar(new Date(ano, mes - 1, dia, 15, 0).toISOString());
      const item = montarItem(`it-h${numero}`, pc.nome, pc.categoria, pc.quantidade, pc.totalGasto);
      return {
        id: `ped-h${numero}`,
        codigoDisplay: `#PED-0${numero}`,
        clienteId: c.id,
        clienteNome: c.nome,
        clienteTelefone: c.telefone,
        clienteEmail: c.email ?? null,
        tag: c.tag || 'Cliente',
        tipoPedido: item.produtoId ? 'pronta_entrega' : 'sob_encomenda',
        data,
        ...camposDeData(data),
        vendedor: 'Camila Lima',
        vendedorCargo: 'Proprietária',
        formaPagamento: 'pix',
        status: 'pago',
        total: pc.totalGasto,
        valorSinalPago: pc.totalGasto,
        saldoNaEntrega: 0,
        statusProducao: 'entregue',
        itens: [item],
      } as Pedido;
    })
  );
};

const pedidosDasEncomendas = (cadastros: ClienteCadastro[]): Pedido[] =>
  ENCOMENDAS_BASE.map((e, idx): Pedido => {
    const cli = cadastros.find((c) => c.id === e.clienteId)!;
    const [h, min] = e.horario.split(':').map(Number);
    const hoje = new Date();
    const entrega = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + e.diasAteEntrega, h, min);
    const criadoEm = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 3, 10 + idx, 0).toISOString();
    const itens = e.itens.map((it, i) => montarItem(`it-${e.id}-${i}`, it.nome, it.categoria, it.quantidade, it.total));
    const total = e.itens.reduce((acc, it) => acc + it.total, 0);
    return {
      id: e.id,
      codigoDisplay: `#PED-${1001 + idx}`,
      clienteId: cli.id,
      clienteNome: cli.nome,
      clienteTelefone: cli.telefone,
      clienteEmail: cli.email ?? null,
      tag: 'Encomenda',
      tipoPedido: 'sob_encomenda',
      data: criadoEm,
      ...camposDeData(criadoEm),
      dataEntrega: entrega.toISOString(),
      vendedor: 'Camila Lima',
      vendedorCargo: 'Proprietária',
      formaPagamento: e.saldoNaEntrega >= total ? 'pendente' : 'pix',
      status: e.saldoNaEntrega > 0 ? 'pendente' : 'pago',
      total,
      valorSinalPago: total - e.saldoNaEntrega,
      saldoNaEntrega: e.saldoNaEntrega,
      statusProducao: e.statusProducao,
      itens,
      observacoes: e.observacao ?? null,
    };
  });

// Vendas de exemplo das revendedoras viram pedidos delas (canal revenda: não mexem na vitrine)
const pedidosDaRevenda = (cadastros: ClienteCadastro[]): Pedido[] =>
  VENDAS_REVENDA_INICIAIS.filter((v) => !v.pedidoId).map((v, idx): Pedido => {
    const cli = cadastros.find((c) => c.nome.toLowerCase() === (v.cliente ?? '').toLowerCase());
    const rev = REVENDEDORAS_INICIAIS.find((r) => r.id === v.revendedoraId);
    return {
      id: `ped-${v.id}`,
      codigoDisplay: `#REV-${String(101 + idx)}`,
      clienteId: cli?.id ?? null,
      clienteNome: cli?.nome ?? v.cliente ?? 'Venda sem cliente',
      clienteTelefone: cli?.telefone ?? null,
      clienteEmail: cli?.email ?? null,
      tag: 'Revenda',
      tipoPedido: 'pronta_entrega',
      data: v.data,
      ...camposDeData(v.data),
      vendedor: rev?.nome ?? 'Revendedora',
      vendedorCargo: 'Revendedora',
      formaPagamento: v.status === 'pago' ? 'pix' : 'pendente',
      status: v.status,
      total: v.total,
      valorSinalPago: v.status === 'pago' ? v.total : 0,
      saldoNaEntrega: v.status === 'pago' ? 0 : v.total,
      statusProducao: 'entregue',
      revendedoraId: v.revendedoraId,
      itens: v.itens.map((it, i) => ({
        id: `it-${v.id}-${i}`,
        nome: it.nome,
        categoria: produtoPorNome(it.nome)?.categoria ?? 'Cookies',
        quantidade: it.quantidade,
        precoUnitario: it.precoUnitario,
        comDesconto: !!it.comDesconto,
        totalItem: it.precoUnitario * it.quantidade,
        produtoId: it.produtoId ?? null,
      })),
    };
  });

const vincularCliente = (p: Pedido, cadastros: ClienteCadastro[]): Pedido => {
  const cli = cadastros.find((c) => c.nome.toLowerCase() === p.clienteNome.toLowerCase());
  return {
    ...p,
    clienteId: cli?.id ?? null,
    itens: p.itens.map((it) => ({ ...it, produtoId: it.produtoId ?? produtoPorNome(it.nome)?.id ?? null })),
  };
};

// ============================================================================
// ESTADO COMPARTILHADO
// ============================================================================
let clientes: ClienteCadastro[] = [...CLIENTES_BASE.map(semMetricas), ...CLIENTES_EXTRAS];
let pedidos: Pedido[] = [
  ...PEDIDOS_BASE.map((p) => {
    const data = deslocar(p.data);
    return vincularCliente({ ...p, data, ...camposDeData(data) }, clientes);
  }),
  ...pedidosDasEncomendas(clientes),
  ...pedidosDaRevenda(clientes),
  ...pedidosDoHistorico(),
].sort((a, b) => b.data.localeCompare(a.data));
let proximoNumero = 1049;

const ouvintes = new Set<() => void>();
// Clientes com métricas: recalculados só quando algo muda (foto estável para useSyncExternalStore)
let clientesCompletos: ClienteCompleto[] | null = null;
const notificar = () => {
  clientesCompletos = null;
  ouvintes.forEach((fn) => fn());
};
const assinar = (fn: () => void) => {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
};

// Cada ateliê tem os seus clientes e pedidos
registrarDadosDoEstabelecimento('clientesPedidos', {
  exportar: () => ({ clientes, pedidos, proximoNumero }),
  importar: (estado) => {
    const e = estado as { clientes: ClienteCadastro[]; pedidos: Pedido[]; proximoNumero: number } | undefined;
    clientes = e?.clientes ?? [];
    pedidos = e?.pedidos ?? [];
    proximoNumero = e?.proximoNumero ?? 1001;
    notificar();
  },
});

const useAssinar = () => {
  const [, forcarRender] = useState(0);
  useEffect(() => {
    const ouvinte = () => forcarRender((n) => n + 1);
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  }, []);
};

// Só pelo cadastro (id): há clientes diferentes com o mesmo nome. Pedido sem cliente (balcão) não é de ninguém
const pedidoDoCliente = (p: Pedido, c: ClienteCadastro) => !!p.clienteId && p.clienteId === c.id;

// Total gasto, pedidos, ticket médio e produtos comprados saem dos pedidos (cancelados não contam)
export const metricasCliente = (c: ClienteCadastro, lista: Pedido[] = pedidos) => {
  const doCliente = lista.filter((p) => !p.deletado && pedidoDoCliente(p, c));
  const totalGasto = doCliente.reduce((acc, p) => acc + p.total, 0);
  const porProduto = new Map<string, ProdutoComprado & { ultimaIso: string }>();
  doCliente.forEach((p) =>
    p.itens.forEach((it) => {
      const atual = porProduto.get(it.nome);
      if (!atual) {
        porProduto.set(it.nome, {
          id: it.produtoId || it.nome,
          nome: it.nome,
          categoria: it.categoria,
          quantidade: it.quantidade,
          totalGasto: it.totalItem,
          dataUltimaCompra: p.dataDisplay,
          ultimaIso: p.data,
          emoji: EMOJI_CATEGORIA[it.categoria] ?? '🧁',
        });
        return;
      }
      atual.quantidade += it.quantidade;
      atual.totalGasto += it.totalItem;
      if (p.data > atual.ultimaIso) {
        atual.ultimaIso = p.data;
        atual.dataUltimaCompra = p.dataDisplay;
      }
    })
  );
  const produtosComprados = Array.from(porProduto.values())
    .sort((a, b) => b.ultimaIso.localeCompare(a.ultimaIso))
    .map(({ ultimaIso, ...pc }) => pc);
  const maisComprado = [...produtosComprados].sort((a, b) => b.quantidade - a.quantidade)[0];
  return {
    totalGasto,
    quantidadePedidos: doCliente.length,
    ticketMedio: doCliente.length > 0 ? totalGasto / doCliente.length : 0,
    produtoMaisComprado: maisComprado?.nome,
    produtosComprados,
  };
};

export const usePedidos = () => {
  useAssinar();
  return pedidos;
};

const fotoClientes = () => (clientesCompletos ??= clientes.map((c) => ({ ...c, ...metricasCliente(c) })));

export const useClientes = (): ClienteCompleto[] => {
  return useSyncExternalStore(assinar, fotoClientes, fotoClientes);
};

// Encomendas que a cozinha ainda precisa produzir/entregar, da entrega mais próxima para a mais distante
export const encomendasEmAberto = (lista: Pedido[]) =>
  lista
    .filter((p) => !p.deletado && p.tipoPedido === 'sob_encomenda' && p.statusProducao !== 'entregue')
    .sort((a, b) => (a.dataEntrega || '9999').localeCompare(b.dataEntrega || '9999'));

// ============================================================================
// MENSAGEM DE WHATSAPP DO PEDIDO (nome da loja e chave PIX vêm de Configurações)
// ============================================================================
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Mensagem para o cliente (WhatsApp): tópicos curtos, emojis discretos e negrito (*texto*)
export const mensagemWhatsAppDoPedido = (pedido: Pedido, loja: { nome: string; chavePix?: string }) => {
  const primeiroNome = pedido.clienteId ? pedido.clienteNome.split(' ')[0] : '';
  const blocos: string[] = [];

  blocos.push(
    `Olá${primeiroNome ? `, ${primeiroNome}` : ''}! 💛\nSeu pedido *${pedido.codigoDisplay}* na *${loja.nome}* está confirmado ✅`
  );

  const itens = pedido.itens.map((it) => {
    const linha = `• ${it.quantidade}x ${it.nome} — *${reais(it.totalItem)}*`;
    const detalhes = [
      it.quantidade > 1 ? `${reais(it.precoUnitario)} cada` : '',
      // Preço promocional aparece; o motivo da promoção é interno e não vai para o cliente
      it.comDesconto ? '🏷️ preço promocional' : '',
    ].filter(Boolean);
    return detalhes.length ? `${linha}\n   _${detalhes.join(' · ')}_` : linha;
  });
  blocos.push(`🛍️ *Seu pedido*\n${itens.join('\n')}`);

  const pagamento = [`💰 *Total: ${reais(pedido.total)}*`];
  if (pedido.saldoNaEntrega <= 0 && pedido.status === 'pago') {
    pagamento.push('✔️ Pagamento recebido. Obrigada!');
  } else if (pedido.valorSinalPago > 0) {
    pagamento.push(`✔️ Já pago: ${reais(pedido.valorSinalPago)}`, `⏳ Falta pagar: *${reais(pedido.saldoNaEntrega)}*`);
  } else {
    pagamento.push('⏳ Pagamento pendente');
  }
  if (pedido.tipoPedido === 'sob_encomenda') pagamento.push(`📅 Entrega: ${rotuloEntrega(pedido.dataEntrega)}`);
  blocos.push(pagamento.join('\n'));

  // PIX só quando ainda falta pagar
  const chave = loja.chavePix?.trim();
  if (chave && pedido.saldoNaEntrega > 0) blocos.push(`💳 *PIX para pagamento*\n${chave}`);

  blocos.push(`Obrigada pela preferência! 🍪\n_${loja.nome}_`);
  return blocos.join('\n\n');
};

// Abre o WhatsApp (web) já com a mensagem; sem telefone, a pessoa escolhe o contato
export const linkWhatsAppDoPedido = (pedido: Pedido, mensagem: string) => {
  const tel = pedido.clienteTelefone ? pedido.clienteTelefone.replace(/\D/g, '') : '';
  return `https://wa.me/${tel ? `55${tel}` : ''}?text=${encodeURIComponent(mensagem)}`;
};

export const resumoItens = (p: Pedido) => p.itens.map((it) => `${it.quantidade}× ${it.nome}`).join(', ');

// ============================================================================
// AÇÕES
// ============================================================================
export interface NovoPedidoDados {
  clienteNome: string | null; // null = balcão avulso
  clienteId?: string | null; // cliente escolhido: liga pelo cadastro (há clientes com o mesmo nome)
  tipoPedido: Pedido['tipoPedido'];
  formaPagamento: Pedido['formaPagamento'];
  itens: Omit<PedidoItem, 'id'>[];
  total: number;
  valorSinalPago: number;
  saldoNaEntrega: number;
  custoTotal: number;
  dataEntrega?: string | null;
  observacoes?: string | null;
  revendedoraId?: string | null; // pedido registrado pela revendedora
  vendedor?: string; // padrão: quem está logado
}

// Pronta-entrega sai da vitrine na venda; encomenda só sai quando é entregue
// (até lá ela ainda vai ser produzida e entrar na vitrine pela Produção)
// Venda da revendedora não mexe na vitrine: sai do estoque que já está com ela
export const pedidoBaixouEstoque = (p: Pedido) => !p.revendedoraId && (p.tipoPedido === 'pronta_entrega' || p.statusProducao === 'entregue');

const movimentosDoPedido = (p: Pedido) => p.itens.map((it) => ({ produtoId: it.produtoId, nome: it.nome, quantidade: it.quantidade }));

// Revendedora do cliente do pedido (null = cliente direto do ateliê)
export const revendedoraDoCliente = (clienteId?: string | null) => {
  const cli = clienteId ? clientes.find((c) => c.id === clienteId) : undefined;
  return cli?.revendedoraId ? { id: cli.revendedoraId, nome: cli.revendedoraNome ?? '' } : null;
};

// Pedido de cliente da revendedora gera comissão (item na promoção paga metade) e acompanha
// as mudanças do pedido: edição, quitação e cancelamento
const sincronizarComissao = (p: Pedido) => {
  // Venda da própria revendedora ou pedido de cliente dela feito no ateliê
  const rev = p.revendedoraId ? { id: p.revendedoraId } : revendedoraDoCliente(p.clienteId);
  if (!rev) return;
  sincronizarVendaDoPedido({
    pedidoId: p.id,
    revendedoraId: rev.id,
    doEstoqueDela: !!p.revendedoraId,
    data: p.data,
    cliente: p.clienteNome,
    itens: p.itens.map((it) => ({
      produtoId: it.produtoId ?? null,
      nome: it.nome,
      quantidade: it.quantidade,
      precoUnitario: it.precoUnitario,
      comDesconto: !!it.comDesconto,
    })),
    status: p.deletado || p.status === 'cancelado' ? 'cancelado' : p.status,
  });
};

// Pedidos carregados do banco: refaz as vendas/comissões das revendedoras a partir deles
export const ressincronizarComissoes = () => pedidos.forEach(sincronizarComissao);

// Registra o pedido e baixa os itens da vitrine (pronta-entrega)
export const criarPedido = (dados: NovoPedidoDados): Pedido => {
  const agora = new Date().toISOString();
  // Só pelo cadastro escolhido (id); sem id = balcão avulso
  const cli = dados.clienteId ? clientes.find((c) => c.id === dados.clienteId) : undefined;
  const numero = proximoNumero++;
  const novo: Pedido = {
    id: `ped-${numero}`,
    codigoDisplay: dados.revendedoraId ? `#REV-${numero}` : `#PED-${numero}`,
    clienteId: cli?.id ?? null,
    clienteNome: cli?.nome ?? dados.clienteNome ?? 'Venda Avulsa (Balcão)',
    clienteTelefone: cli?.telefone ?? null,
    clienteEmail: cli?.email ?? null,
    tag: dados.revendedoraId ? 'Revenda' : dados.tipoPedido === 'sob_encomenda' ? 'Encomenda' : 'Pronta Entrega',
    tipoPedido: dados.tipoPedido,
    data: agora,
    ...camposDeData(agora),
    dataEntrega: dados.dataEntrega ?? null,
    vendedor: dados.vendedor ?? nomeUsuarioAtual(),
    vendedorCargo: dados.revendedoraId ? 'Revendedora' : 'Proprietária',
    formaPagamento: dados.formaPagamento,
    status: dados.saldoNaEntrega > 0 ? 'pendente' : 'pago',
    total: dados.total,
    valorSinalPago: dados.valorSinalPago,
    saldoNaEntrega: dados.saldoNaEntrega,
    custoTotal: dados.custoTotal,
    // Retirada e delivery são feitos e entregues na hora: já nascem entregues
    statusProducao: dados.tipoPedido === 'sob_encomenda' && !dados.revendedoraId ? 'a_fazer' : 'entregue',
    revendedoraId: dados.revendedoraId ?? null,
    itens: dados.itens.map((it, idx) => ({ ...it, id: `it-${numero}-${idx}` })),
    observacoes: dados.observacoes ?? null,
  };
  pedidos = [novo, ...pedidos];
  if (pedidoBaixouEstoque(novo)) baixarEstoque(movimentosDoPedido(novo));
  sincronizarComissao(novo);
  notificar();
  return novo;
};

// Substitui o pedido (edição, avanço de produção, quitação...).
// Encomenda marcada como Entregue baixa a vitrine; se voltar de Entregue, devolve.
export const atualizarPedido = (atualizado: Pedido) => {
  const antes = pedidos.find((p) => p.id === atualizado.id);
  if (antes && !antes.deletado && !atualizado.deletado) {
    const baixouAntes = pedidoBaixouEstoque(antes);
    const baixaAgora = pedidoBaixouEstoque(atualizado);
    if (!baixouAntes && baixaAgora) baixarEstoque(movimentosDoPedido(atualizado));
    if (baixouAntes && !baixaAgora) devolverEstoque(movimentosDoPedido(atualizado));
  }
  pedidos = pedidos.map((p) => (p.id === atualizado.id ? atualizado : p));
  sincronizarComissao(atualizado);
  notificar();
};

// Edição completa pelo modal de pedido (itens, cliente, tipo, pagamento):
// devolve o que o pedido antigo tirou da vitrine e baixa o novo
export const editarPedido = (atualizado: Pedido) => {
  const antes = pedidos.find((p) => p.id === atualizado.id);
  if (antes && !antes.deletado && pedidoBaixouEstoque(antes)) devolverEstoque(movimentosDoPedido(antes));
  if (pedidoBaixouEstoque(atualizado)) baixarEstoque(movimentosDoPedido(atualizado));
  pedidos = pedidos.map((p) => (p.id === atualizado.id ? atualizado : p));
  sincronizarComissao(atualizado);
  notificar();
};

// Exclusão lógica: o pedido fica guardado como cancelado e o que saiu da vitrine volta
export const cancelarPedido = (id: string) => {
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido || pedido.deletado) return;
  if (pedidoBaixouEstoque(pedido)) devolverEstoque(movimentosDoPedido(pedido));
  atualizarPedido({ ...pedido, deletado: true, status: 'cancelado' });
};

// "24/10/1992" ou "24/10" → 10
export const mesDoAniversario = (data?: string | null) => {
  const mes = data ? parseInt(data.split(/[-/]/)[1], 10) : NaN;
  return mes >= 1 && mes <= 12 ? mes : undefined;
};

// Dados vindos do formulário de cliente (ClienteFormModal) viram cadastro
export const cadastroDoFormulario = (
  f: {
    id: string;
    nome: string;
    telefone: string;
    tag: string;
    cpfCnpj: string | null;
    cep: string | null;
    rua: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    aniversario: string | null;
    email: string | null;
    observacoes: string | null;
    revendedoraId: string | null;
    revendedoraNome: string | null;
  },
  status: ClienteCadastro['status'] = 'ativo'
): ClienteCadastro => {
  const { cpfCnpj, ...resto } = f;
  return { ...resto, cpf_cnpj: cpfCnpj, mesAniversario: mesDoAniversario(f.aniversario), status };
};

// Cadastro novo ou edição (mesmo id)
export const salvarCliente =(cadastro: ClienteCadastro) => {
  const existe = clientes.some((c) => c.id === cadastro.id);
  clientes = existe ? clientes.map((c) => (c.id === cadastro.id ? cadastro : c)) : [cadastro, ...clientes];
  // Pedidos do cliente acompanham o nome e o contato atualizados
  pedidos = pedidos.map((p) =>
    p.clienteId === cadastro.id
      ? { ...p, clienteNome: cadastro.nome, clienteTelefone: cadastro.telefone, clienteEmail: cadastro.email ?? null }
      : p
  );
  notificar();
};

// Exclusão lógica: o cliente fica inativo e pode ser reativado
export const alternarStatusCliente = (id: string) => {
  clientes = clientes.map((c) => (c.id === id ? { ...c, status: c.status === 'ativo' ? 'inativo' : 'ativo' } : c));
  notificar();
};
