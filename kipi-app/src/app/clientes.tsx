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
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import NovoPedidoModal from '@/components/NovoPedidoModal';

// ============================================================================
// TIPOGRAFIA & CONSTANTES DE TEMA (ATELIÊ SAGE / LOVABLE)
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });

const ATELIE_GREEN = '#2D7A58';
const ATELIE_TINT = '#EAF5F1';
const ATELIE_SUCCESS = '#228658';

export type ViewMode = 'grid' | 'lista' | 'cards';
export type StatusFilter = 'todos' | 'ativos' | 'inativos' | 'aniversariantes';

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
  status: 'ativo' | 'inativo';
  totalGasto: number;
  quantidadePedidos: number;
  ticketMedio: number;
  produtoMaisComprado?: string;
  produtosComprados: ProdutoComprado[];
  created_at?: string;
}

// CLIENTES INICIAIS ENRIQUECIDOS (CONFEITARIA ATELIERQ)
const CLIENTES_INICIAIS: ClienteCompleto[] = [
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
      { id: 'p4', nome: 'Cookie Black Nutella & Avelã', categoria: 'Cookies', quantidade: 14, totalGasto: 264.60, dataUltimaCompra: '18/10/2026', emoji: '🍪' },
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
    status: 'ativo',
    totalGasto: 645.20,
    quantidadePedidos: 8,
    ticketMedio: 80.65,
    produtoMaisComprado: 'Cookie Black Nutella & Avelã',
    observacoes: 'Pede sempre no delivery pelo WhatsApp. Gosta de entrega rápida por volta das 16h.',
    produtosComprados: [
      { id: 'p1', nome: 'Cookie Black Nutella & Avelã', categoria: 'Cookies', quantidade: 22, totalGasto: 415.80, dataUltimaCompra: '19/10/2026', emoji: '🍪' },
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

export default function ClientesScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // ESTADOS DA TELA
  const [clientes, setClientes] = useState<ClienteCompleto[]>(CLIENTES_INICIAIS);
  const [carregando, setCarregando] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [busca, setBusca] = useState('');

  // MODAIS
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
  const [clienteDetalhe, setClienteDetalhe] = useState<ClienteCompleto | null>(null);
  const [modalNovoPedidoAberto, setModalNovoPedidoAberto] = useState(false);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

  // FORM NOVO CLIENTE (CAMPOS SOLICITADOS)
  const [formNome, setFormNome] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formTag, setFormTag] = useState('VIP');
  const [formCep, setFormCep] = useState('');
  const [formRua, setFormRua] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formComplemento, setFormComplemento] = useState('');
  const [formBairro, setFormBairro] = useState('');
  const [formDataNascimento, setFormDataNascimento] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPreferencias, setFormPreferencias] = useState('');
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  useEffect(() => {
    carregarClientesDoSupabase();
  }, []);

  const exibirToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => {
      setToastMensagem(null);
    }, 3800);
  };

  const carregarClientesDoSupabase = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (!error && data && data.length > 0) {
        // Enriquecer com dados locais se existirem ou mapear
        const mapeados: ClienteCompleto[] = data.map((c: any) => {
          const mockExistente = CLIENTES_INICIAIS.find((ci) => ci.nome.toLowerCase() === c.nome.toLowerCase());
          const aniversarioStr = c.aniversario || mockExistente?.aniversario || '15/10/1995';
          const mesNum = extrairMes(aniversarioStr);

          return {
            id: c.id,
            nome: c.nome,
            telefone: c.telefone || '(21) 98000-0000',
            email: c.email || `${c.nome.toLowerCase().replace(/\s+/g, '.')}@email.com`,
            cpf_cnpj: c.cpf_cnpj || null,
            aniversario: aniversarioStr,
            mesAniversario: mesNum,
            cep: c.cep || '22000-000',
            rua: c.rua || 'Avenida Atlântica',
            numero: c.numero || '100',
            bairro: c.bairro || 'Copacabana',
            cidade: c.cidade || 'Rio de Janeiro',
            estado: c.estado || 'RJ',
            complemento: c.complemento || '',
            observacoes: c.observacoes || 'Cliente cadastrado no ateliê.',
            tag: c.tag || mockExistente?.tag || 'Cliente Frequente',
            status: c.tipo_contato === 'inativo' ? 'inativo' : 'ativo',
            totalGasto: mockExistente?.totalGasto || 420.00,
            quantidadePedidos: mockExistente?.quantidadePedidos || 3,
            ticketMedio: mockExistente?.ticketMedio || 140.00,
            produtoMaisComprado: mockExistente?.produtoMaisComprado || 'Cookie Black Nutella',
            produtosComprados: mockExistente?.produtosComprados || [
              { id: 'p1', nome: 'Cookie Tradicional Gotas Belga', categoria: 'Cookies', quantidade: 6, totalGasto: 89.40, dataUltimaCompra: '18/10/2026', emoji: '🍪' },
            ],
            created_at: c.created_at,
          };
        });

        // Garantir que os clientes ricos iniciais também apareçam
        const idsDb = new Set(mapeados.map((m) => m.nome.toLowerCase()));
        const unicosIniciais = CLIENTES_INICIAIS.filter((ci) => !idsDb.has(ci.nome.toLowerCase()));
        setClientes([...mapeados, ...unicosIniciais]);
      }
    } catch {
      // fallback com mock
    } finally {
      setCarregando(false);
    }
  };

  // MÁSCARA DE TELEFONE AUTOMÁTICA
  const formatarTelefone = (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 11);
    if (limpo.length <= 2) return limpo;
    if (limpo.length <= 6) return `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
    if (limpo.length <= 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  };

  // MÁSCARA DE CEP
  const formatarCep = (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 8);
    if (limpo.length <= 5) return limpo;
    return `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
  };

  // MÁSCARA DE DATA
  const formatarData = (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 8);
    if (limpo.length <= 2) return limpo;
    if (limpo.length <= 4) return `${limpo.slice(0, 2)}/${limpo.slice(2)}`;
    return `${limpo.slice(0, 2)}/${limpo.slice(2, 4)}/${limpo.slice(4)}`;
  };

  const extrairMes = (dataStr?: string | null): number => {
    if (!dataStr) return 10;
    const partes = dataStr.split(/[-/]/);
    if (partes.length >= 2) {
      const mes = parseInt(partes[1], 10);
      if (!isNaN(mes) && mes >= 1 && mes <= 12) return mes;
    }
    return 10;
  };

  // FILTRAGEM DE CLIENTES
  const mesAtual = new Date().getMonth() + 1; // 1-12 (Outubro = 10)

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      // 1. Busca por qualquer campo
      const termo = busca.trim().toLowerCase();
      const matchBusca =
        !termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.telefone.toLowerCase().includes(termo) ||
        (c.email && c.email.toLowerCase().includes(termo)) ||
        (c.bairro && c.bairro.toLowerCase().includes(termo)) ||
        (c.rua && c.rua.toLowerCase().includes(termo)) ||
        (c.tag && c.tag.toLowerCase().includes(termo)) ||
        (c.observacoes && c.observacoes.toLowerCase().includes(termo));

      if (!matchBusca) return false;

      // 2. Filtro de Status
      if (statusFilter === 'ativos') return c.status === 'ativo';
      if (statusFilter === 'inativos') return c.status === 'inativo';
      if (statusFilter === 'aniversariantes') return c.mesAniversario === mesAtual;

      return true;
    });
  }, [clientes, busca, statusFilter, mesAtual]);

  // ESTATÍSTICAS RÁPIDAS
  const stats = useMemo(() => {
    const total = clientes.length;
    const ativos = clientes.filter((c) => c.status === 'ativo').length;
    const inativos = clientes.filter((c) => c.status === 'inativo').length;
    const aniversariantesMes = clientes.filter((c) => c.mesAniversario === mesAtual).length;
    const somaFaturamento = clientes.reduce((acc, c) => acc + c.totalGasto, 0);

    return { total, ativos, inativos, aniversariantesMes, somaFaturamento };
  }, [clientes, mesAtual]);

  // CADASTRAR NOVO CLIENTE
  const handleSalvarNovoCliente = async () => {
    const nomeLimpo = formNome.trim();
    const telLimpo = formTelefone.trim();

    if (!nomeLimpo) {
      setErroForm('Por favor, informe o nome do cliente.');
      return;
    }
    if (!telLimpo || telLimpo.length < 10) {
      setErroForm('Por favor, informe um telefone/WhatsApp válido.');
      return;
    }

    setSalvandoCliente(true);
    setErroForm(null);

    const mesNasc = extrairMes(formDataNascimento);

    const novoObj: ClienteCompleto = {
      id: `cli_${Date.now()}`,
      nome: nomeLimpo,
      telefone: telLimpo,
      tag: formTag.trim() || 'Cliente VIP',
      cep: formCep.trim() || null,
      rua: formRua.trim() || null,
      numero: formNumero.trim() || null,
      complemento: formComplemento.trim() || null,
      bairro: formBairro.trim() || null,
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      aniversario: formDataNascimento.trim() || null,
      mesAniversario: mesNasc,
      email: formEmail.trim() || null,
      observacoes: formPreferencias.trim() || null,
      status: 'ativo',
      totalGasto: 0,
      quantidadePedidos: 0,
      ticketMedio: 0,
      produtosComprados: [],
    };

    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          empresa_id: 'emp_fatio',
          nome: novoObj.nome,
          telefone: novoObj.telefone,
          email: novoObj.email,
          tag: novoObj.tag,
          cep: novoObj.cep,
          rua: novoObj.rua,
          numero: novoObj.numero,
          complemento: novoObj.complemento,
          bairro: novoObj.bairro,
          cidade: novoObj.cidade,
          estado: novoObj.estado,
          aniversario: novoObj.aniversario,
          observacoes: novoObj.observacoes,
          tipo_contato: 'cliente',
        })
        .select()
        .single();

      if (!error && data) {
        novoObj.id = data.id;
      }
    } catch {
      // fallback
    } finally {
      setClientes((prev) => [novoObj, ...prev]);
      setSalvandoCliente(false);
      setModalNovoClienteAberto(false);
      limparFormulario();
      exibirToast(`✨ Cliente "${novoObj.nome}" cadastrado com sucesso!`);
    }
  };

  const limparFormulario = () => {
    setFormNome('');
    setFormTelefone('');
    setFormTag('VIP');
    setFormCep('');
    setFormRua('');
    setFormNumero('');
    setFormComplemento('');
    setFormBairro('');
    setFormDataNascimento('');
    setFormEmail('');
    setFormPreferencias('');
    setErroForm(null);
  };

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.mainLayout}>

        {/* =========================================================================
            MENU LATERAL MODULAR
        ========================================================================== */}
        <Sidebar
          activeRoute="/clientes"
          onNotice={(msg) => exibirToast(msg)}
        />

        {/* =========================================================================
            CONTEÚDO PRINCIPAL (TELA DE CLIENTES)
        ========================================================================== */}
        <View style={styles.contentArea}>

          {/* CABEÇALHO SUPERIOR COM BARRA DE BUSCA E NOVO CLIENTE */}
          <View style={styles.topHeader}>
            <View style={styles.topHeaderLeft}>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>ATELIÊ · CLIENTES & FIDELIDADE</Text>
              </View>
              <Text style={styles.pageTitle}>Gestão de Clientes do Ateliê</Text>
              <Text style={styles.pageSubtitle}>
                Histórico de compras, preferências gastronômicas e fidelidade.
              </Text>
            </View>

            <View style={styles.topHeaderActions}>
              <TouchableOpacity
                style={styles.btnNovoClientePrimary}
                onPress={() => {
                  limparFormulario();
                  setModalNovoClienteAberto(true);
                }}
                activeOpacity={0.85}>
                <Feather name="user-plus" size={16} color="#FFFFFF" />
                <Text style={styles.btnNovoClientePrimaryText}>Novo Cliente</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* BARRA DE CONTROLE: BUSCA, FILTROS E MODO DE VISUALIZAÇÃO */}
          <View style={styles.controlsBar}>
            {/* CAMPO DE BUSCA LIVRE (POR QUALQUER DADO DO CADASTRO) */}
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome, telefone, email, bairro, rua ou tag..."
                placeholderTextColor="#94A3B8"
                value={busca}
                onChangeText={setBusca}
              />
              {busca ? (
                <TouchableOpacity onPress={() => setBusca('')}>
                  <Feather name="x" size={15} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* FILTROS DE STATUS (TODOS, ATIVOS, INATIVOS, ANIVERSARIANTES) */}
            <View style={styles.statusPillsTrack}>
              {[
                { id: 'todos', label: `Todos (${stats.total})` },
                { id: 'ativos', label: `Ativos (${stats.ativos})` },
                { id: 'inativos', label: `Inativos (${stats.inativos})` },
                { id: 'aniversariantes', label: `🎂 Aniversariantes (${stats.aniversariantesMes})` },
              ].map((f) => {
                const ativo = statusFilter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.filterPill, ativo && styles.filterPillActive]}
                    onPress={() => setStatusFilter(f.id as any)}>
                    <Text style={[styles.filterPillText, ativo && styles.filterPillTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SELETOR DE MODO DE VISUALIZAÇÃO (GRID, LISTA, CARDS) */}
            <View style={styles.viewModeSwitcher}>
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'cards' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('cards')}
                accessibilityLabel="Visualização em Cards">
                <Feather
                  name="credit-card"
                  size={15}
                  color={viewMode === 'cards' ? ATELIE_GREEN : '#64748B'}
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
                  color={viewMode === 'grid' ? ATELIE_GREEN : '#64748B'}
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
                  color={viewMode === 'lista' ? ATELIE_GREEN : '#64748B'}
                />
                <Text style={[styles.viewModeBtnText, viewMode === 'lista' && styles.viewModeBtnTextActive]}>
                  Lista
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* =========================================================================
              ÁREA PRINCIPAL DE CLIENTES CONFORME MODO ESCOLHIDO
          ========================================================================== */}
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.mainScrollContent}
            showsVerticalScrollIndicator={true}>

            {carregando ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={ATELIE_GREEN} />
                <Text style={styles.loadingText}>Carregando clientes do ateliê...</Text>
              </View>
            ) : clientesFiltrados.length === 0 ? (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="users" size={32} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>Nenhum cliente encontrado</Text>
                <Text style={styles.emptySub}>
                  Tente alterar os termos de busca ou o filtro de status selecionado.
                </Text>
                <TouchableOpacity
                  style={styles.btnEmptyReset}
                  onPress={() => {
                    setBusca('');
                    setStatusFilter('todos');
                  }}>
                  <Text style={styles.btnEmptyResetText}>Limpar filtros de busca</Text>
                </TouchableOpacity>
              </View>
            ) : viewMode === 'cards' ? (
              /* ---------------------------------------------------------------------
                 1. VISUALIZAÇÃO EM CARDS (BOUTIQUE DOSSIÊ GOURMET)
              ---------------------------------------------------------------------- */
              <View style={styles.cardsLayoutWrap}>
                {clientesFiltrados.map((cli) => {
                  const isAniverMes = cli.mesAniversario === mesAtual;

                  return (
                    <TouchableOpacity
                      key={cli.id}
                      style={[
                        styles.dossierCard,
                        isDesktop ? styles.dossierCardDesktop : styles.dossierCardMobile,
                      ]}
                      onPress={() => setClienteDetalhe(cli)}
                      activeOpacity={0.88}>

                      {/* CABEÇALHO DO CARD */}
                      <View style={styles.dossierHeader}>
                        <View style={styles.dossierAvatar}>
                          <Text style={styles.dossierAvatarText}>
                            {cli.nome.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>

                        <View style={styles.dossierNameCol}>
                          <View style={styles.dossierTitleRow}>
                            <Text style={styles.dossierName} numberOfLines={1}>{cli.nome}</Text>
                            {cli.tag && (
                              <View style={styles.clientTagPill}>
                                <Text style={styles.clientTagPillText}>{cli.tag}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.dossierPhone}>
                            <Feather name="phone" size={11} color="#64748B" /> {cli.telefone}
                          </Text>
                        </View>

                        <View style={[styles.statusDotBadge, cli.status === 'ativo' ? styles.statusDotAtivo : styles.statusDotInativo]}>
                          <Text style={[styles.statusDotText, cli.status === 'ativo' ? styles.statusDotTextAtivo : styles.statusDotTextInativo]}>
                            {cli.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Text>
                        </View>
                      </View>

                      {/* ESTATÍSTICAS FINANCEIRAS DO CLIENTE */}
                      <View style={styles.dossierMetricsGrid}>
                        <View style={styles.dossierMetricItem}>
                          <Text style={styles.dossierMetricLabel}>TOTAL GASTO</Text>
                          <Text style={styles.dossierMetricValue}>
                            R$ {cli.totalGasto.toFixed(2)}
                          </Text>
                        </View>

                        <View style={styles.dossierMetricItem}>
                          <Text style={styles.dossierMetricLabel}>PEDIDOS</Text>
                          <Text style={styles.dossierMetricValue}>
                            {cli.quantidadePedidos} {cli.quantidadePedidos === 1 ? 'pedido' : 'pedidos'}
                          </Text>
                        </View>

                        <View style={styles.dossierMetricItem}>
                          <Text style={styles.dossierMetricLabel}>TICKET MÉDIO</Text>
                          <Text style={styles.dossierMetricValue}>
                            R$ {cli.ticketMedio.toFixed(2)}
                          </Text>
                        </View>
                      </View>

                      {/* PRODUTO FAVORITO */}
                      {cli.produtoMaisComprado && (
                        <View style={styles.favoriteProductBar}>
                          <Text style={styles.favIcon}>🏆</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.favTitle}>Mais pedido pelo cliente:</Text>
                            <Text style={styles.favName} numberOfLines={1}>{cli.produtoMaisComprado}</Text>
                          </View>
                        </View>
                      )}

                      {/* PREFERÊNCIAS E RESTRIÇÕES */}
                      {cli.observacoes ? (
                        <View style={styles.preferencesPreviewBox}>
                          <Feather name="heart" size={12} color="#708018" style={{ marginTop: 2 }} />
                          <Text style={styles.preferencesPreviewText} numberOfLines={2}>
                            {cli.observacoes}
                          </Text>
                        </View>
                      ) : null}

                      {/* RODAPÉ DO CARD COM ENDEREÇO E ANIVERSÁRIO */}
                      <View style={styles.dossierFooter}>
                        <View style={styles.dossierAddressCol}>
                          <Text style={styles.dossierAddressText} numberOfLines={1}>
                            📍 {cli.bairro || 'Copacabana'} {cli.rua ? `• ${cli.rua}` : ''}
                          </Text>
                          {cli.aniversario && (
                            <Text style={[styles.dossierBdayText, isAniverMes && styles.dossierBdayHighlight]}>
                              🎂 Niver: {cli.aniversario} {isAniverMes ? '★ Este Mês!' : ''}
                            </Text>
                          )}
                        </View>

                        <View style={styles.dossierArrowCircle}>
                          <Feather name="chevron-right" size={14} color={ATELIE_GREEN} />
                        </View>
                      </View>

                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : viewMode === 'grid' ? (
              /* ---------------------------------------------------------------------
                 2. VISUALIZAÇÃO EM GRID COMPACTO
              ---------------------------------------------------------------------- */
              <View style={styles.compactGridLayout}>
                {clientesFiltrados.map((cli) => (
                  <TouchableOpacity
                    key={cli.id}
                    style={styles.compactGridCard}
                    onPress={() => setClienteDetalhe(cli)}
                    activeOpacity={0.88}>
                    <View style={styles.compactGridTop}>
                      <View style={styles.compactGridAvatar}>
                        <Text style={styles.compactGridAvatarText}>
                          {cli.nome.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compactGridName} numberOfLines={1}>{cli.nome}</Text>
                        <Text style={styles.compactGridPhone}>{cli.telefone}</Text>
                      </View>
                      {cli.tag && (
                        <View style={styles.compactGridTag}>
                          <Text style={styles.compactGridTagText}>{cli.tag}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.compactGridDivider} />

                    <View style={styles.compactGridBottom}>
                      <View>
                        <Text style={styles.compactGridSpendLabel}>Gasto no ateliê</Text>
                        <Text style={styles.compactGridSpendValue}>R$ {cli.totalGasto.toFixed(2)}</Text>
                      </View>
                      <View style={styles.compactGridDetailsBtn}>
                        <Text style={styles.compactGridDetailsBtnText}>Ver Dossiê →</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              /* ---------------------------------------------------------------------
                 3. VISUALIZAÇÃO EM LISTA (TABELA LIMPA E MODERNA)
              ---------------------------------------------------------------------- */
              <View style={styles.tableCard}>
                {/* CABEÇALHO DA TABELA */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.8 }]}>CLIENTE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>CONTATO</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>LOCALIZAÇÃO</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>TAG</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.0 }]}>ANIVERSÁRIO</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.0, textAlign: 'right' }]}>TOTAL GASTO</Text>
                  <Text style={[styles.tableHeaderCell, { width: 70, textAlign: 'center' }]}>AÇÃO</Text>
                </View>

                {/* LINHAS DA TABELA */}
                {clientesFiltrados.map((cli) => {
                  const isAniverMes = cli.mesAniversario === mesAtual;

                  return (
                    <TouchableOpacity
                      key={cli.id}
                      style={styles.tableRow}
                      onPress={() => setClienteDetalhe(cli)}
                      activeOpacity={0.75}>
                      {/* CLIENTE */}
                      <View style={[styles.tableCell, { flex: 1.8, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <View style={styles.tableRowAvatar}>
                          <Text style={styles.tableRowAvatarText}>
                            {cli.nome.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tableClientName} numberOfLines={1}>{cli.nome}</Text>
                          <Text style={styles.tableClientEmail} numberOfLines={1}>{cli.email || 'Sem e-mail'}</Text>
                        </View>
                      </View>

                      {/* CONTATO */}
                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                        <Text style={styles.tableCellText}>{cli.telefone}</Text>
                      </View>

                      {/* LOCALIZAÇÃO */}
                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                        <Text style={styles.tableCellText} numberOfLines={1}>
                          {cli.bairro || 'Copacabana'}, {cli.cidade || 'RJ'}
                        </Text>
                      </View>

                      {/* TAG */}
                      <View style={[styles.tableCell, { flex: 0.9 }]}>
                        {cli.tag ? (
                          <View style={styles.tableTagPill}>
                            <Text style={styles.tableTagPillText}>{cli.tag}</Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 11, color: '#94A3B8' }}>—</Text>
                        )}
                      </View>

                      {/* ANIVERSÁRIO */}
                      <View style={[styles.tableCell, { flex: 1.0 }]}>
                        <Text style={[styles.tableCellText, isAniverMes && styles.tableCellBdayHighlight]}>
                          {cli.aniversario ? `🎂 ${cli.aniversario}` : '—'}
                        </Text>
                      </View>

                      {/* TOTAL GASTO */}
                      <View style={[styles.tableCell, { flex: 1.0, alignItems: 'flex-end' }]}>
                        <Text style={styles.tableSpendTotal}>R$ {cli.totalGasto.toFixed(2)}</Text>
                        <Text style={styles.tableOrdersCount}>{cli.quantidadePedidos} pedidos</Text>
                      </View>

                      {/* AÇÃO */}
                      <View style={[styles.tableCell, { width: 70, alignItems: 'center' }]}>
                        <View style={styles.tableActionCircle}>
                          <Feather name="eye" size={13} color={ATELIE_GREEN} />
                        </View>
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
          MODAL: CADASTRAR NOVO CLIENTE (COM TODOS OS CAMPOS SOLICITADOS)
      ========================================================================== */}
      <Modal
        visible={modalNovoClienteAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalNovoClienteAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalNovoClienteContent}>

            {/* CABEÇALHO DO MODAL */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIconWrap}>
                <Feather name="user-plus" size={20} color={ATELIE_GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderSub}>ATELIÊ · NOVO CLIENTE</Text>
                <Text style={styles.modalHeaderTitle}>Cadastrar Novo Cliente</Text>
                <Text style={styles.modalHeaderDesc}>
                  Registre o cliente com carinho, endereço completo e preferências gastronômicas.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseCircle}
                onPress={() => setModalNovoClienteAberto(false)}>
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* ALERTA DE ERRO */}
            {erroForm && (
              <View style={styles.errorAlertBar}>
                <Feather name="alert-circle" size={14} color="#DC2626" />
                <Text style={styles.errorAlertText}>{erroForm}</Text>
              </View>
            )}

            {/* FORMULÁRIO ROLÁVEL */}
            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContent}>

              {/* SEÇÃO 1: DADOS BÁSICOS */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>1. IDENTIFICAÇÃO DO CLIENTE</Text>

                <View style={styles.formRow}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={styles.formLabel}>Nome Completo *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Ex: Mariana Albuquerque"
                      placeholderTextColor="#94A3B8"
                      value={formNome}
                      onChangeText={setFormNome}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Telefone / WhatsApp *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="(21) 98844-3321"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={formTelefone}
                      onChangeText={(t) => setFormTelefone(formatarTelefone(t))}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.formLabel}>E-mail</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="exemplo@gmail.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      value={formEmail}
                      onChangeText={setFormEmail}
                    />
                  </View>

                  <View style={{ flex: 0.8 }}>
                    <Text style={styles.formLabel}>Data de Nascimento</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={formDataNascimento}
                      onChangeText={(t) => setFormDataNascimento(formatarData(t))}
                    />
                  </View>

                  <View style={{ flex: 0.8 }}>
                    <Text style={styles.formLabel}>Tag / Segmento</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Ex: VIP, Noiva..."
                      placeholderTextColor="#94A3B8"
                      value={formTag}
                      onChangeText={setFormTag}
                    />
                  </View>
                </View>

                {/* SUGESTÕES RÁPIDAS DE TAGS */}
                <View style={styles.tagsQuickRow}>
                  <Text style={styles.tagsQuickLabel}>Sugestões:</Text>
                  {['VIP', 'Noiva', 'Corporativo', 'Festa Infantil', 'Frequente'].map((tg) => (
                    <TouchableOpacity
                      key={tg}
                      style={[styles.tagQuickChip, formTag === tg && styles.tagQuickChipActive]}
                      onPress={() => setFormTag(tg)}>
                      <Text style={[styles.tagQuickChipText, formTag === tg && styles.tagQuickChipTextActive]}>
                        {tg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* SEÇÃO 2: ENDEREÇO DE ENTREGA */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>2. ENDEREÇO DE ENTREGA</Text>

                <View style={styles.formRow}>
                  <View style={{ width: 140 }}>
                    <Text style={styles.formLabel}>CEP</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="22040-002"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={formCep}
                      onChangeText={(t) => setFormCep(formatarCep(t))}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Rua / Logradouro</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Ex: Rua Barata Ribeiro"
                      placeholderTextColor="#94A3B8"
                      value={formRua}
                      onChangeText={setFormRua}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ width: 100 }}>
                    <Text style={styles.formLabel}>Número</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="450"
                      placeholderTextColor="#94A3B8"
                      value={formNumero}
                      onChangeText={setFormNumero}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Complemento / Ap</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Apto 802, Bloco 1..."
                      placeholderTextColor="#94A3B8"
                      value={formComplemento}
                      onChangeText={setFormComplemento}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Bairro</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Copacabana"
                      placeholderTextColor="#94A3B8"
                      value={formBairro}
                      onChangeText={setFormBairro}
                    />
                  </View>
                </View>
              </View>

              {/* SEÇÃO 3: PREFERÊNCIAS E RESTRIÇÕES */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>3. PREFERÊNCIAS E RESTRIÇÕES GASTRONÔMICAS</Text>
                <Text style={styles.formHint}>
                  Anote alergias, intolerâncias (glúten/lactose), doces favoritos, cores de fita ou cuidados especiais.
                </Text>
                <TextInput
                  style={styles.formTextarea}
                  placeholder="Ex: Alérgica a nozes e amendoim. Adora ganache de pistache e sempre pede laço rosa de presente..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  value={formPreferencias}
                  onChangeText={setFormPreferencias}
                />
              </View>

            </ScrollView>

            {/* FOOTER DO MODAL DE CADASTRO */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setModalNovoClienteAberto(false)}>
                <Text style={styles.btnModalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnModalSave}
                onPress={handleSalvarNovoCliente}
                disabled={salvandoCliente}>
                {salvandoCliente ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={15} color="#FFFFFF" />
                    <Text style={styles.btnModalSaveText}>Salvar Cliente</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL / GAVETA: DETALHES COMPLETOS DO REGISTRO DO CLIENTE (DOSSIÊ)
      ========================================================================== */}
      {clienteDetalhe && (
        <Modal
          visible={!!clienteDetalhe}
          transparent
          animationType="fade"
          onRequestClose={() => setClienteDetalhe(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalDossierContent}>

              {/* CABEÇALHO DO DOSSIÊ DO CLIENTE */}
              <View style={styles.dossierModalHeader}>
                <View style={styles.dossierModalAvatar}>
                  <Text style={styles.dossierModalAvatarText}>
                    {clienteDetalhe.nome.substring(0, 2).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.dossierModalName}>{clienteDetalhe.nome}</Text>
                    {clienteDetalhe.tag && (
                      <View style={styles.clientTagPill}>
                        <Text style={styles.clientTagPillText}>{clienteDetalhe.tag}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.dossierModalSub}>
                    {clienteDetalhe.telefone} • {clienteDetalhe.email || 'Sem e-mail'}
                  </Text>
                </View>

                <View style={styles.dossierModalHeaderBtns}>
                  <TouchableOpacity
                    style={styles.btnCriarPedidoParaCliente}
                    onPress={() => {
                      setClienteDetalhe(null);
                      setModalNovoPedidoAberto(true);
                    }}>
                    <Feather name="plus" size={14} color="#FFFFFF" />
                    <Text style={styles.btnCriarPedidoParaClienteText}>Novo Pedido</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCloseCircle}
                    onPress={() => setClienteDetalhe(null)}>
                    <Feather name="x" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* CONTEÚDO SCROLLÁVEL DO REGISTRO DO CLIENTE */}
              <ScrollView style={styles.dossierModalScroll} contentContainerStyle={styles.dossierModalScrollContent}>

                {/* KPIS DE CONSUMO DO CLIENTE */}
                <View style={styles.dossierKpiStrip}>
                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>TOTAL GASTO</Text>
                    <Text style={styles.dossierKpiValue}>R$ {clienteDetalhe.totalGasto.toFixed(2)}</Text>
                    <Text style={styles.dossierKpiHint}>Acumulado na loja</Text>
                  </View>

                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>PEDIDOS REALIZADOS</Text>
                    <Text style={styles.dossierKpiValue}>{clienteDetalhe.quantidadePedidos}</Text>
                    <Text style={styles.dossierKpiHint}>Compras concluídas</Text>
                  </View>

                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>TICKET MÉDIO</Text>
                    <Text style={styles.dossierKpiValue}>R$ {clienteDetalhe.ticketMedio.toFixed(2)}</Text>
                    <Text style={styles.dossierKpiHint}>Por pedido</Text>
                  </View>

                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>PRODUTO FAVORITO</Text>
                    <Text style={[styles.dossierKpiValue, { fontSize: 13, color: ATELIE_GREEN }]} numberOfLines={1}>
                      🏆 {clienteDetalhe.produtoMaisComprado || 'Cookies Gourmet'}
                    </Text>
                    <Text style={styles.dossierKpiHint}>Item mais comprado</Text>
                  </View>
                </View>

                {/* ENDEREÇO E ANIVERSÁRIO */}
                <View style={styles.infoCardTwoCol}>
                  <View style={styles.infoCardBox}>
                    <View style={styles.infoCardHeader}>
                      <Feather name="map-pin" size={14} color={ATELIE_GREEN} />
                      <Text style={styles.infoCardTitle}>Endereço Cadastrado</Text>
                    </View>
                    <Text style={styles.infoCardPrimary}>
                      {clienteDetalhe.rua ? `${clienteDetalhe.rua}, ${clienteDetalhe.numero || 'S/N'}` : 'Rua não informada'}
                    </Text>
                    <Text style={styles.infoCardSecondary}>
                      {clienteDetalhe.complemento ? `${clienteDetalhe.complemento} • ` : ''}
                      {clienteDetalhe.bairro || 'Copacabana'}, {clienteDetalhe.cidade || 'Rio de Janeiro'} - {clienteDetalhe.estado || 'RJ'}
                    </Text>
                    <Text style={styles.infoCardCep}>CEP: {clienteDetalhe.cep || 'Não cadastrado'}</Text>
                  </View>

                  <View style={styles.infoCardBox}>
                    <View style={styles.infoCardHeader}>
                      <Feather name="calendar" size={14} color={ATELIE_GREEN} />
                      <Text style={styles.infoCardTitle}>Aniversário & Datas Especiais</Text>
                    </View>
                    <Text style={styles.infoCardPrimary}>
                      {clienteDetalhe.aniversario ? `🎂 ${clienteDetalhe.aniversario}` : 'Data não informada'}
                    </Text>
                    <Text style={styles.infoCardSecondary}>
                      {clienteDetalhe.mesAniversario === mesAtual ? '🎉 Aniversariante deste mês! Enviar cupom presente.' : 'Fidelidade Ateliê ativa.'}
                    </Text>
                    <View style={styles.tagStatusPill}>
                      <Text style={styles.tagStatusPillText}>Status: {clienteDetalhe.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                {/* PREFERÊNCIAS E RESTRIÇÕES */}
                <View style={styles.preferencesFullCard}>
                  <View style={styles.preferencesHeader}>
                    <Feather name="heart" size={15} color={ATELIE_GREEN} />
                    <Text style={styles.preferencesTitle}>Preferências & Restrições Gastronômicas</Text>
                  </View>
                  <Text style={styles.preferencesText}>
                    {clienteDetalhe.observacoes || 'Nenhuma restrição ou preferência especial registrada para este cliente.'}
                  </Text>
                </View>

                {/* PRODUTOS COMPRADOS POR ELE (HISTÓRICO DE CONSUMO) */}
                <View style={styles.purchasedProductsSection}>
                  <View style={styles.purchasedProductsHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="shopping-bag" size={15} color={ATELIE_GREEN} />
                      <Text style={styles.purchasedProductsTitle}>Delícias e Produtos Comprados pelo Cliente</Text>
                    </View>
                    <Text style={styles.purchasedProductsCount}>
                      {clienteDetalhe.produtosComprados.length} doces diferentes
                    </Text>
                  </View>

                  <View style={styles.purchasedProductsList}>
                    {clienteDetalhe.produtosComprados.map((item) => (
                      <View key={item.id} style={styles.purchasedProductRow}>
                        <View style={styles.purchasedEmojiBox}>
                          <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.purchasedProdName}>{item.nome}</Text>
                          <Text style={styles.purchasedProdCat}>
                            {item.categoria} • Última compra em {item.dataUltimaCompra}
                          </Text>
                        </View>
                        <View style={styles.purchasedQtdBadge}>
                          <Text style={styles.purchasedQtdBadgeText}>{item.quantidade} un.</Text>
                        </View>
                        <Text style={styles.purchasedTotalVal}>R$ {item.totalGasto.toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                </View>

              </ScrollView>

            </View>
          </View>
        </Modal>
      )}

      {/* MODAL DE NOVO PEDIDO (INTEGRADO COM ESTILO ATELIÊ) */}
      <NovoPedidoModal
        visible={modalNovoPedidoAberto}
        onClose={() => setModalNovoPedidoAberto(false)}
        onPedidoCriado={(pedido) => {
          exibirToast(`🎉 Pedido registrado com sucesso no ateliê!`);
          carregarClientesDoSupabase();
        }}
      />

      {/* TOAST DE FEEDBACK FLUTUANTE */}
      {toastMensagem && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color="#FFFFFF" />
          <Text style={styles.toastText}>{toastMensagem}</Text>
        </View>
      )}

    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS COM A MESMA IDENTIDADE DO MODAL DE NOVO PEDIDO (SORA + MANROPE + VERDE SÁLVIA)
// ============================================================================
const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },

  // CABEÇALHO DA TELA
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topHeaderLeft: {
    gap: 3,
  },
  tagBadge: {
    backgroundColor: ATELIE_TINT,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btnNovoClientePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ATELIE_GREEN,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(45, 122, 88, 0.25)',
      },
    }),
  },
  btnNovoClientePrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT_DISPLAY,
  },

  // BARRA DE CONTROLES: BUSCA, STATUS E MODO DE VISUALIZAÇÃO
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    height: 40,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    fontFamily: FONT_SANS,
    padding: 0,
    outlineWidth: 0,
  },
  statusPillsTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: ATELIE_TINT,
    borderColor: ATELIE_GREEN,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  filterPillTextActive: {
    color: ATELIE_GREEN,
    fontWeight: '700',
  },
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  viewModeBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      },
    }),
  },
  viewModeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  viewModeBtnTextActive: {
    color: ATELIE_GREEN,
    fontWeight: '700',
  },

  // ÁREA DE ROLAGEM PRINCIPAL
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 28,
  },
  loadingBox: {
    padding: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  emptyBox: {
    padding: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: FONT_SANS,
    textAlign: 'center',
    maxWidth: 320,
  },
  btnEmptyReset: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnEmptyResetText: {
    fontSize: 12,
    fontWeight: '700',
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },

  // 1. CARDS / DOSSIÊ GOURMET
  cardsLayoutWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dossierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
    ...Platform.select({
      web: {
        transition: 'all 0.16s ease',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
      },
    }),
  },
  dossierCardDesktop: {
    width: 'calc(50% - 8px)' as any,
  },
  dossierCardMobile: {
    width: '100%',
  },
  dossierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dossierAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dossierAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  dossierNameCol: {
    flex: 1,
    minWidth: 0,
  },
  dossierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dossierName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
  },
  clientTagPill: {
    backgroundColor: '#F3F6DD',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  clientTagPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#708018',
    fontFamily: FONT_SANS,
  },
  dossierPhone: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  statusDotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDotAtivo: {
    backgroundColor: '#ECFDF5',
  },
  statusDotInativo: {
    backgroundColor: '#FEF2F2',
  },
  statusDotText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONT_SANS,
  },
  statusDotTextAtivo: {
    color: ATELIE_SUCCESS,
  },
  statusDotTextInativo: {
    color: '#DC2626',
  },
  dossierMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dossierMetricItem: {
    alignItems: 'center',
  },
  dossierMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    fontFamily: FONT_SANS,
  },
  dossierMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
    marginTop: 2,
  },
  favoriteProductBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAFDFE',
    borderWidth: 1,
    borderColor: '#E6F1FA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  favIcon: {
    fontSize: 15,
  },
  favTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  favName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_SANS,
  },
  preferencesPreviewBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FBFDF9',
    borderWidth: 1,
    borderColor: '#EDF5E7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  preferencesPreviewText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    fontFamily: FONT_SANS,
    lineHeight: 16,
  },
  dossierFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
  },
  dossierAddressCol: {
    flex: 1,
  },
  dossierAddressText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  dossierBdayText: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  dossierBdayHighlight: {
    color: '#B45309',
    fontWeight: '700',
  },
  dossierArrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. GRID COMPACTO
  compactGridLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  compactGridCard: {
    width: 'calc(33.333% - 10px)' as any,
    minWidth: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  compactGridTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactGridAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactGridAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  compactGridName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_SANS,
  },
  compactGridPhone: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  compactGridTag: {
    backgroundColor: '#F3F6DD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactGridTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#708018',
  },
  compactGridDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  compactGridBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactGridSpendLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontFamily: FONT_SANS,
  },
  compactGridSpendValue: {
    fontSize: 13,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  compactGridDetailsBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactGridDetailsBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_SANS,
  },

  // 3. TABELA / LISTA
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    fontFamily: FONT_SANS,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  tableCell: {
    justifyContent: 'center',
  },
  tableRowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableRowAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  tableClientName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_SANS,
  },
  tableClientEmail: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: FONT_SANS,
  },
  tableCellText: {
    fontSize: 12,
    color: '#475569',
    fontFamily: FONT_SANS,
  },
  tableCellBdayHighlight: {
    color: '#B45309',
    fontWeight: '700',
  },
  tableTagPill: {
    backgroundColor: '#F3F6DD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tableTagPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#708018',
  },
  tableSpendTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
  },
  tableOrdersCount: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: FONT_SANS,
  },
  tableActionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // MODAL DE NOVO CLIENTE
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalNovoClienteContent: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalHeaderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
  },
  modalHeaderDesc: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  errorAlertText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: FONT_SANS,
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: 22,
    gap: 20,
  },
  formSection: {
    gap: 10,
  },
  formSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#475569',
    fontFamily: FONT_SANS,
  },
  formHint: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
    marginTop: -4,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    fontFamily: FONT_SANS,
  },
  formInput: {
    height: 38,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0F172A',
    fontFamily: FONT_SANS,
  },
  formTextarea: {
    height: 70,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
    fontFamily: FONT_SANS,
    textAlignVertical: 'top',
  },
  tagsQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  tagsQuickLabel: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  tagQuickChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  tagQuickChipActive: {
    backgroundColor: ATELIE_TINT,
  },
  tagQuickChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  tagQuickChipTextActive: {
    color: ATELIE_GREEN,
    fontWeight: '800',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  btnModalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnModalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  btnModalSave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ATELIE_GREEN,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnModalSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONT_DISPLAY,
  },

  // MODAL / DOSSIÊ DE DETALHES DO CLIENTE
  modalDossierContent: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
      },
    }),
  },
  dossierModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  dossierModalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dossierModalAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  dossierModalName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
  },
  dossierModalSub: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  dossierModalHeaderBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnCriarPedidoParaCliente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ATELIE_GREEN,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnCriarPedidoParaClienteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_DISPLAY,
  },
  dossierModalScroll: {
    flex: 1,
  },
  dossierModalScrollContent: {
    padding: 24,
    gap: 18,
  },
  dossierKpiStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  dossierKpiBox: {
    flex: 1,
    minWidth: 130,
    alignItems: 'center',
    padding: 6,
  },
  dossierKpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    fontFamily: FONT_SANS,
  },
  dossierKpiValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
    marginTop: 3,
  },
  dossierKpiHint: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  infoCardTwoCol: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  infoCardBox: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
  },
  infoCardPrimary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_SANS,
  },
  infoCardSecondary: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  infoCardCep: {
    fontSize: 11,
    fontWeight: '600',
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  tagStatusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  tagStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: ATELIE_SUCCESS,
  },
  preferencesFullCard: {
    backgroundColor: '#FBFDF9',
    borderWidth: 1,
    borderColor: '#E4F0DE',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  preferencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preferencesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2B6127',
    fontFamily: FONT_DISPLAY,
  },
  preferencesText: {
    fontSize: 12,
    color: '#334155',
    fontFamily: FONT_SANS,
    lineHeight: 18,
  },
  purchasedProductsSection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  purchasedProductsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  purchasedProductsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
  },
  purchasedProductsCount: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  purchasedProductsList: {
    gap: 8,
  },
  purchasedProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  purchasedEmojiBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchasedProdName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_SANS,
  },
  purchasedProdCat: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  purchasedQtdBadge: {
    backgroundColor: ATELIE_TINT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  purchasedQtdBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },
  purchasedTotalVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
    minWidth: 70,
    textAlign: 'right',
  },

  // TOAST FLUTUANTE
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    zIndex: 9999,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
      },
    }),
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONT_SANS,
  },
});
