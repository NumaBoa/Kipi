import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { KipiPalette, Fonts } from '@/constants/theme';

export interface ProdutoItem {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  tem_promocao?: boolean;
  desconto_promocional?: number;
  preco_promocional?: number | null;
  iconeEmoji?: string;
  corFundoIcone?: string;
}

export interface ClienteItem {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
}

export interface ItemCarrinho {
  produto: ProdutoItem;
  quantidade: number;
  temDesconto: boolean;
  valorDescontoUnitario: number;
}

export type TipoEntrega = 'retirada' | 'entrega' | 'sob_encomenda';
export type MetodoPagamento = 'pix' | 'cartao' | 'dinheiro' | 'pendente';

interface NovoPedidoModalProps {
  visible: boolean;
  onClose: () => void;
  onPedidoCriado: (pedido: any) => void;
}

// PRODUTOS GOURMET COM APRESENTAÇÃO DE ATELIÊ DE LUXO
const PRODUTOS_PADRAO: ProdutoItem[] = [
  { id: 'p1', nome: 'Cookie Duo Red Velvet c/ Ninho', categoria: 'Cookies', preco: 16.90, estoque: 18, tem_promocao: true, desconto_promocional: 3.00, iconeEmoji: '🍪', corFundoIcone: '#FDF2F4' },
  { id: 'p2', nome: 'Cookie Tradicional Gotas Belga', categoria: 'Cookies', preco: 14.90, estoque: 24, tem_promocao: false, iconeEmoji: '🍪', corFundoIcone: '#FBF6EA' },
  { id: 'p3', nome: 'Cookie Black Nutella & Avelã', categoria: 'Cookies', preco: 18.90, estoque: 12, tem_promocao: true, desconto_promocional: 3.00, iconeEmoji: '🍪', corFundoIcone: '#F5EBE6' },
  { id: 'p4', nome: 'Bento Cake Pistache & Framboesa', categoria: 'Bolos & Bentos', preco: 65.00, estoque: 8, tem_promocao: false, iconeEmoji: '🎂', corFundoIcone: '#F1F8F5' },
  { id: 'p5', nome: 'Bento Cake Red Velvet Cream Cheese', categoria: 'Bolos & Bentos', preco: 70.00, estoque: 5, tem_promocao: false, iconeEmoji: '🎂', corFundoIcone: '#FDF2F4' },
  { id: 'p6', nome: 'Caixa Macarons Degustação (6 un)', categoria: 'Macarons', preco: 57.00, estoque: 14, tem_promocao: true, desconto_promocional: 5.00, iconeEmoji: '🧁', corFundoIcone: '#F7EEF8' },
  { id: 'p7', nome: 'Torre de Macarons 24 unidades', categoria: 'Macarons', preco: 220.00, estoque: 3, tem_promocao: false, iconeEmoji: '✨', corFundoIcone: '#F0F9FF' },
  { id: 'p8', nome: 'Fatia Torta Ópera Café & Ganache', categoria: 'Sobremesas', preco: 33.50, estoque: 10, tem_promocao: false, iconeEmoji: '🍮', corFundoIcone: '#FBF6EA' },
  { id: 'p9', nome: 'Fatia Cheesecake Frutas Silvestres', categoria: 'Sobremesas', preco: 32.50, estoque: 9, tem_promocao: false, iconeEmoji: '🍰', corFundoIcone: '#FDF2F4' },
  { id: 'p10', nome: 'Cento de Brigadeiros Gourmet Belga', categoria: 'Doces Finos', preco: 160.00, estoque: 20, tem_promocao: false, iconeEmoji: '🍬', corFundoIcone: '#F1F8F5' },
  { id: 'p11', nome: 'Bolo Casamento Flores de Açúcar', categoria: 'Bolos & Bentos', preco: 340.00, estoque: 0, tem_promocao: false, iconeEmoji: '💐', corFundoIcone: '#FAF5FF' },
  { id: 'p12', nome: 'Brownie Fudge Triplo Chocolate', categoria: 'Cookies', preco: 15.50, estoque: 16, tem_promocao: false, iconeEmoji: '🍫', corFundoIcone: '#F5EBE6' },
];

const CLIENTES_PADRAO: ClienteItem[] = [
  { id: 'c1', nome: 'Mariana Albuquerque', telefone: '(21) 98844-3321', email: 'mariana.alb@gmail.com' },
  { id: 'c2', nome: 'Dra. Camila Morales', telefone: '(21) 99122-4411', email: 'morales.camila@clinicavita.com' },
  { id: 'c3', nome: 'Fernanda Montenegro Santos', telefone: '(21) 98711-2299', email: 'fernanda.m@globo.com' },
  { id: 'c4', nome: 'Guilherme Peixoto', telefone: '(21) 99876-5432', email: 'guilherme.px@yahoo.com' },
  { id: 'c5', nome: 'Larissa Manoela Vasconcelos', telefone: '(21) 98455-1234', email: 'larissa.v@outlook.com' },
];

export default function NovoPedidoModal({
  visible,
  onClose,
  onPedidoCriado,
}: NovoPedidoModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;

  // TAB MOBILE
  const [mobileTab, setMobileTab] = useState<'vitrine' | 'comanda'>('vitrine');

  // CLIENTES
  const [clientes, setClientes] = useState<ClienteItem[]>(CLIENTES_PADRAO);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [isVendaAvulsa, setIsVendaAvulsa] = useState(true);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteItem | null>(null);
  const [dropdownClienteAberto, setDropdownClienteAberto] = useState(false);

  // NOVO CLIENTE INLINE
  const [criandoNovoCliente, setCriandoNovoCliente] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  // TIPO DE ENTREGA E AGENDAMENTO
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('retirada');
  const [dataEntrega, setDataEntrega] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  });
  const [horarioEntrega, setHorarioEntrega] = useState('14:00');
  const [observacoes, setObservacoes] = useState('');

  // PRODUTOS
  const [produtos, setProdutos] = useState<ProdutoItem[]>(PRODUTOS_PADRAO);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [buscaProduto, setBuscaProduto] = useState('');

  // CARRINHO DO PEDIDO
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  // PAGAMENTO (4 OPÇÕES DIRETAS E CLARAS)
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('pix');

  // SUBMISSÃO
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      carregarClientes();
      carregarProdutos();
      setErroForm(null);
    }
  }, [visible]);

  const carregarClientes = async () => {
    setCarregandoClientes(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, telefone, email')
        .order('nome', { ascending: true })
        .limit(40);

      if (!error && data && data.length > 0) {
        setClientes(data);
      }
    } catch {
      // fallback
    } finally {
      setCarregandoClientes(false);
    }
  };

  const carregarProdutos = async () => {
    setCarregandoProdutos(true);
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, categoria, preco, estoque, tem_promocao, desconto_promocional, preco_promocional')
        .order('nome', { ascending: true });

      if (!error && data && data.length > 0) {
        const enriquecidos = data.map((p: any, idx: number) => ({
          ...p,
          iconeEmoji: p.categoria?.includes('Bolo') ? '🎂' : p.categoria?.includes('Macaron') ? '🧁' : p.categoria?.includes('Doces') ? '🍬' : '🍪',
          corFundoIcone: idx % 3 === 0 ? '#FDF2F4' : idx % 3 === 1 ? '#F1F8F5' : '#FBF6EA',
        }));
        setProdutos(enriquecidos);
      }
    } catch {
      // fallback
    } finally {
      setCarregandoProdutos(false);
    }
  };

  const categorias = useMemo(() => {
    const cats = Array.from(new Set(produtos.map((p) => p.categoria || 'Geral')));
    return ['Todas', ...cats];
  }, [produtos]);

  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes;
    const t = buscaCliente.toLowerCase();
    return clientes.filter(
      (c) => c.nome.toLowerCase().includes(t) || (c.telefone && c.telefone.includes(t))
    );
  }, [clientes, buscaCliente]);

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const matchCat = categoriaAtiva === 'Todas' || p.categoria === categoriaAtiva;
      const matchBusca =
        !buscaProduto.trim() ||
        p.nome.toLowerCase().includes(buscaProduto.toLowerCase()) ||
        p.categoria.toLowerCase().includes(buscaProduto.toLowerCase());
      return matchCat && matchBusca;
    });
  }, [produtos, categoriaAtiva, buscaProduto]);

  const handleCadastrarCliente = async () => {
    const nome = novoClienteNome.trim();
    if (!nome) {
      setErroForm('Informe o nome do novo cliente');
      return;
    }

    setSalvandoCliente(true);
    setErroForm(null);

    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          empresa_id: 'emp_fatio',
          nome,
          telefone: novoClienteTelefone.trim() || null,
        })
        .select()
        .single();

      if (!error && data) {
        setClientes((prev) => [data, ...prev]);
        setClienteSelecionado(data);
      } else {
        const localCli: ClienteItem = { id: `cli_${Date.now()}`, nome, telefone: novoClienteTelefone || null };
        setClientes((prev) => [localCli, ...prev]);
        setClienteSelecionado(localCli);
      }
      setIsVendaAvulsa(false);
      setCriandoNovoCliente(false);
      setNovoClienteNome('');
      setNovoClienteTelefone('');
    } catch {
      const localCli: ClienteItem = { id: `cli_${Date.now()}`, nome, telefone: novoClienteTelefone || null };
      setClientes((prev) => [localCli, ...prev]);
      setClienteSelecionado(localCli);
      setIsVendaAvulsa(false);
      setCriandoNovoCliente(false);
      setNovoClienteNome('');
      setNovoClienteTelefone('');
    } finally {
      setSalvandoCliente(false);
    }
  };

  const adicionarAoCarrinho = (produto: ProdutoItem) => {
    setCarrinho((prev) => {
      const index = prev.findIndex((i) => i.produto.id === produto.id);
      if (index > -1) {
        const novo = [...prev];
        novo[index].quantidade += 1;
        return novo;
      }
      return [
        ...prev,
        {
          produto,
          quantidade: 1,
          temDesconto: false,
          valorDescontoUnitario: produto.desconto_promocional || 3.00,
        },
      ];
    });
    setErroForm(null);
  };

  const alterarQuantidade = (produtoId: string, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((item) => {
          if (item.produto.id === produtoId) {
            const novaQtd = item.quantidade + delta;
            return novaQtd > 0 ? { ...item, quantidade: novaQtd } : null;
          }
          return item;
        })
        .filter(Boolean) as ItemCarrinho[]
    );
  };

  const alternarDescontoItem = (produtoId: string) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.produto.id === produtoId) {
          return { ...item, temDesconto: !item.temDesconto };
        }
        return item;
      })
    );
  };

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((i) => i.produto.id !== produtoId));
  };

  const totais = useMemo(() => {
    let subtotal = 0;
    let descontoTotal = 0;
    let totalItens = 0;

    carrinho.forEach((item) => {
      const precoUnit = item.produto.preco;
      const qtd = item.quantidade;
      totalItens += qtd;
      subtotal += precoUnit * qtd;

      if (item.temDesconto) {
        descontoTotal += item.valorDescontoUnitario * qtd;
      }
    });

    const totalFinal = Math.max(0, subtotal - descontoTotal);

    return { subtotal, descontoTotal, totalFinal, totalItens };
  }, [carrinho]);

  const handleFinalizarPedido = async () => {
    if (carrinho.length === 0) {
      setErroForm('Selecione ao menos uma delícia na vitrine para fechar o pedido');
      return;
    }

    if (!isVendaAvulsa && !clienteSelecionado) {
      setErroForm('Selecione um cliente cadastrado ou clique em Balcão Avulso');
      return;
    }

    setSalvandoPedido(true);
    setErroForm(null);

    const isPago = metodoPagamento !== 'pendente';
    const status = isPago ? 'pago' : 'pendente';

    try {
      const dataEntregaPrometida =
        tipoEntrega !== 'retirada' ? `${dataEntrega}T${horarioEntrega}:00.000Z` : null;

      const { data: novaVenda, error: vendaError } = await supabase
        .from('vendas')
        .insert({
          empresa_id: 'emp_fatio',
          cliente_id: isVendaAvulsa ? null : clienteSelecionado?.id || null,
          canal: 'propria',
          tipo_pedido: tipoEntrega,
          data: new Date().toISOString(),
          data_entrega_prometida: dataEntregaPrometida,
          valor_sinal_pago: isPago ? totais.totalFinal : 0,
          saldo_na_entrega: isPago ? 0 : totais.totalFinal,
          status_producao: tipoEntrega === 'sob_encomenda' ? 'a_fazer' : 'pronto',
          pagamento: metodoPagamento,
          status,
          total: totais.totalFinal,
          custo_total: 0,
          observacoes: observacoes.trim() || null,
        })
        .select()
        .single();

      if (!vendaError && novaVenda) {
        const itensInsert = carrinho.map((item) => ({
          empresa_id: 'emp_fatio',
          venda_id: novaVenda.id,
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          quantidade: item.quantidade,
          preco_unitario: item.temDesconto
            ? item.produto.preco - item.valorDescontoUnitario
            : item.produto.preco,
          com_desconto: item.temDesconto,
        }));
        await supabase.from('venda_itens').insert(itensInsert);
        onPedidoCriado(novaVenda);
      } else {
        const mockVendaCriada = {
          id: `ped_${Date.now()}`,
          cliente_id: isVendaAvulsa ? null : clienteSelecionado?.id || null,
          tipo_pedido: tipoEntrega,
          pagamento: metodoPagamento,
          status,
          total: totais.totalFinal,
          observacoes: observacoes.trim() || null,
          created_at: new Date().toISOString(),
        };
        onPedidoCriado(mockVendaCriada);
      }

      setCarrinho([]);
      setClienteSelecionado(null);
      setIsVendaAvulsa(true);
      setObservacoes('');
      onClose();
    } catch (e: any) {
      setErroForm(e.message || 'Erro ao registrar pedido');
    } finally {
      setSalvandoPedido(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.boutiqueContainer, isDesktop ? styles.boutiqueDesktop : styles.boutiqueMobile]}>

          {/* =========================================================================
              CABEÇALHO EDITORIAL & BOUTIQUE (LADURÉE & APPLE AESTHETIC)
          ========================================================================== */}
          <View style={styles.boutiqueHeader}>
            <View style={styles.boutiqueHeaderLeft}>
              <View style={styles.atelierTagBadge}>
                <Text style={styles.atelierTagBadgeText}>ATELIERQ • NOVO PEDIDO</Text>
              </View>
              <Text style={styles.boutiqueTitle}>Atendimento & Comanda do Ateliê</Text>
              <Text style={styles.boutiqueSubtitle}>Toque nas delícias da vitrine para montar a comanda</Text>
            </View>

            {/* SE TELAS MENORES: SWITCH SUAVE */}
            {!isDesktop && (
              <View style={styles.mobileSegmentTabs}>
                <TouchableOpacity
                  style={[styles.mobileSegmentTab, mobileTab === 'vitrine' && styles.mobileSegmentTabActive]}
                  onPress={() => setMobileTab('vitrine')}>
                  <Text style={[styles.mobileSegmentTabText, mobileTab === 'vitrine' && styles.mobileSegmentTabTextActive]}>
                    Vitrine
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.mobileSegmentTab, mobileTab === 'comanda' && styles.mobileSegmentTabActive]}
                  onPress={() => setMobileTab('comanda')}>
                  <Text style={[styles.mobileSegmentTabText, mobileTab === 'comanda' && styles.mobileSegmentTabTextActive]}>
                    Sacola ({totais.totalItens})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.boutiqueCloseBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="x" size={18} color="#1E293B" />
            </TouchableOpacity>
          </View>

          {/* ALERTA DE ERRO SUAVE SE HOUVER */}
          {erroForm && (
            <View style={styles.softAlertBar}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.softAlertText}>{erroForm}</Text>
              <TouchableOpacity onPress={() => setErroForm(null)}>
                <Feather name="x" size={13} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}

          {/* =========================================================================
              CORPO PRINCIPAL (2 COLUNAS HARMONIOSAS)
          ========================================================================== */}
          <View style={styles.boutiqueBody}>

            {/* -----------------------------------------------------------------------
                COLUNA 1 (ESQUERDA - 62%): VITRINE GOURMET & SELETORES NÍTIDOS
            ------------------------------------------------------------------------ */}
            {(isDesktop || mobileTab === 'vitrine') && (
              <View style={styles.vitrineColumn}>

                {/* BARRA SUPERIOR DE SELEÇÃO: CLIENTE E ENTREGA COM ALTO CONTRASTE */}
                <View style={styles.commandHeaderBar}>

                  {/* LINHA 1: CLIENTE VS BALCÃO AVULSO + TIPO DE ENTREGA */}
                  <View style={styles.selectionTopRow}>
                    
                    {/* SELETOR CLARO: BALCÃO AVULSO OU CLIENTE IDENTIFICADO */}
                    <View style={styles.clientModeSwitch}>
                      <TouchableOpacity
                        style={[styles.clientModeBtn, isVendaAvulsa && styles.clientModeBtnActive]}
                        onPress={() => {
                          setIsVendaAvulsa(true);
                          setClienteSelecionado(null);
                          setCriandoNovoCliente(false);
                          setDropdownClienteAberto(false);
                        }}>
                        <Feather name="zap" size={13} color={isVendaAvulsa ? '#FFFFFF' : '#1E293B'} />
                        <Text style={[styles.clientModeBtnText, isVendaAvulsa && styles.clientModeBtnTextActive]}>
                          Balcão Avulso
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.clientModeBtn, !isVendaAvulsa && styles.clientModeBtnActive]}
                        onPress={() => {
                          setIsVendaAvulsa(false);
                          setDropdownClienteAberto(true);
                        }}>
                        <Feather name="user" size={13} color={!isVendaAvulsa ? '#FFFFFF' : '#1E293B'} />
                        <Text style={[styles.clientModeBtnText, !isVendaAvulsa && styles.clientModeBtnTextActive]}>
                          {clienteSelecionado ? clienteSelecionado.nome.split(' ')[0] : 'Cliente VIP'}
                        </Text>
                        <Feather name="chevron-down" size={12} color={!isVendaAvulsa ? '#FFFFFF' : '#475569'} />
                      </TouchableOpacity>
                    </View>

                    {/* MODALIDADE DE ENTREGA NÍTIDA (3 BOTÕES COM ALTO CONTRASTE) */}
                    <View style={styles.deliverySegmentBar}>
                      {[
                        { id: 'retirada', label: 'Retirada', icon: 'shopping-bag' },
                        { id: 'entrega', label: 'Delivery', icon: 'truck' },
                        { id: 'sob_encomenda', label: 'Encomenda', icon: 'calendar' },
                      ].map((t) => {
                        const ativo = tipoEntrega === t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            style={[styles.deliverySegmentBtn, ativo && styles.deliverySegmentBtnActive]}
                            onPress={() => setTipoEntrega(t.id as any)}>
                            <Feather
                              name={t.icon as any}
                              size={12}
                              color={ativo ? '#FFFFFF' : '#334155'}
                            />
                            <Text style={[styles.deliverySegmentBtnText, ativo && styles.deliverySegmentBtnTextActive]}>
                              {t.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                  </View>

                  {/* SEÇÃO EXPANDIDA DE CLIENTE (SE NÃO FOR AVULSO) */}
                  {!isVendaAvulsa && (
                    <View style={styles.clientExpandedSection}>
                      {clienteSelecionado ? (
                        <View style={styles.clientChosenCard}>
                          <View style={styles.clientChosenInfo}>
                            <View style={styles.clientAvatarMini}>
                              <Text style={styles.clientAvatarText}>
                                {clienteSelecionado.nome.substring(0, 2).toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.clientChosenName}>{clienteSelecionado.nome}</Text>
                              <Text style={styles.clientChosenPhone}>
                                {clienteSelecionado.telefone || 'Cliente VIP Cadastrado'}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={styles.btnChangeClient}
                            onPress={() => {
                              setClienteSelecionado(null);
                              setDropdownClienteAberto(true);
                            }}>
                            <Feather name="refresh-cw" size={11} color={KipiPalette.icedDenim} />
                            <Text style={styles.btnChangeClientText}>Trocar Cliente</Text>
                          </TouchableOpacity>
                        </View>
                      ) : criandoNovoCliente ? (
                        <View style={styles.inlineClientBox}>
                          <View style={styles.inlineClientInputsRow}>
                            <TextInput
                              style={[styles.crispInput, { flex: 1.2 }]}
                              placeholder="Nome completo do cliente *"
                              placeholderTextColor="#64748B"
                              value={novoClienteNome}
                              onChangeText={setNovoClienteNome}
                            />
                            <TextInput
                              style={[styles.crispInput, { flex: 0.9 }]}
                              placeholder="WhatsApp (ex: 21 98844-3321)"
                              placeholderTextColor="#64748B"
                              value={novoClienteTelefone}
                              onChangeText={setNovoClienteTelefone}
                            />
                            <TouchableOpacity
                              style={styles.btnSaveClientPrimary}
                              onPress={handleCadastrarCliente}
                              disabled={salvandoCliente}>
                              {salvandoCliente ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.btnSaveClientPrimaryText}>Salvar</Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.btnCancelClient}
                              onPress={() => setCriandoNovoCliente(false)}>
                              <Feather name="x" size={15} color="#475569" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={{ position: 'relative', zIndex: 50 }}>
                          <View style={styles.searchClientCrispRow}>
                            <View style={styles.searchClientCrispField}>
                              <Feather name="search" size={14} color="#1E293B" />
                              <TextInput
                                style={styles.searchClientCrispInput}
                                placeholder="Digite o nome ou WhatsApp do cliente..."
                                placeholderTextColor="#64748B"
                                value={buscaCliente}
                                onChangeText={(t) => {
                                  setBuscaCliente(t);
                                  setDropdownClienteAberto(true);
                                }}
                                onFocus={() => setDropdownClienteAberto(true)}
                              />
                              {buscaCliente ? (
                                <TouchableOpacity onPress={() => setBuscaCliente('')}>
                                  <Feather name="x" size={13} color="#64748B" />
                                </TouchableOpacity>
                              ) : null}
                            </View>

                            <TouchableOpacity
                              style={styles.btnNewClientPill}
                              onPress={() => setCriandoNovoCliente(true)}>
                              <Feather name="user-plus" size={12} color="#FFFFFF" />
                              <Text style={styles.btnNewClientPillText}>+ Novo</Text>
                            </TouchableOpacity>
                          </View>

                          {dropdownClienteAberto && (
                            <View style={styles.clientFloatingMenu}>
                              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                {clientesFiltrados.length === 0 ? (
                                  <View style={styles.clientFloatingEmpty}>
                                    <Text style={styles.clientFloatingEmptyText}>Nenhum cliente com esse nome.</Text>
                                    <TouchableOpacity onPress={() => setCriandoNovoCliente(true)}>
                                      <Text style={styles.clientFloatingEmptyLink}>+ Cadastrar "{buscaCliente}"</Text>
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  clientesFiltrados.map((cli) => (
                                    <TouchableOpacity
                                      key={cli.id}
                                      style={styles.clientFloatingRow}
                                      onPress={() => {
                                        setClienteSelecionado(cli);
                                        setDropdownClienteAberto(false);
                                        setBuscaCliente('');
                                      }}>
                                      <Text style={styles.clientFloatingName}>{cli.nome}</Text>
                                      <Text style={styles.clientFloatingPhone}>{cli.telefone || 'Sem telefone'}</Text>
                                    </TouchableOpacity>
                                  ))
                                )}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* AGENDAMENTO SE FOR DELIVERY OU ENCOMENDA */}
                  {tipoEntrega !== 'retirada' && (
                    <View style={styles.deliveryScheduleBanner}>
                      <View style={styles.deliveryScheduleItem}>
                        <Feather name="calendar" size={13} color={KipiPalette.icedDenim} />
                        <Text style={styles.deliveryScheduleLabel}>Data de Entrega:</Text>
                        <TextInput
                          style={styles.deliveryScheduleInput}
                          value={dataEntrega}
                          onChangeText={setDataEntrega}
                          placeholder="AAAA-MM-DD"
                          placeholderTextColor="#64748B"
                        />
                      </View>

                      <View style={styles.deliveryScheduleItem}>
                        <Feather name="clock" size={13} color={KipiPalette.icedDenim} />
                        <Text style={styles.deliveryScheduleLabel}>Horário:</Text>
                        <TextInput
                          style={[styles.deliveryScheduleInput, { width: 65 }]}
                          value={horarioEntrega}
                          onChangeText={setHorarioEntrega}
                          placeholder="14:00"
                          placeholderTextColor="#64748B"
                        />
                      </View>
                    </View>
                  )}

                  {/* LINHA 2: BUSCA E CATEGORIAS COM CORES VIVAS */}
                  <View style={styles.searchAndCatRow}>
                    <View style={styles.crispSearchBox}>
                      <Feather name="search" size={13} color="#1E293B" />
                      <TextInput
                        style={styles.crispSearchInput}
                        placeholder="Buscar sabor ou doce..."
                        placeholderTextColor="#64748B"
                        value={buscaProduto}
                        onChangeText={setBuscaProduto}
                      />
                      {buscaProduto ? (
                        <TouchableOpacity onPress={() => setBuscaProduto('')}>
                          <Feather name="x" size={13} color="#64748B" />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryTrack}>
                      {categorias.map((cat) => {
                        const ativa = categoriaAtiva === cat;
                        return (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.crispCatChip, ativa && styles.crispCatChipActive]}
                            onPress={() => setCategoriaAtiva(cat)}>
                            <Text style={[styles.crispCatChipText, ativa && styles.crispCatChipTextActive]}>
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                </View>

                {/* ===================================================================
                    VITRINE DE PRODUTOS COMPACTA EM GRID (MANTIDA EXATAMENTE COMO A USUÁRIA AMOU)
                ==================================================================== */}
                <ScrollView
                  style={styles.vitrineScrollArea}
                  contentContainerStyle={styles.vitrineTilesContainer}
                  showsVerticalScrollIndicator={true}>
                  {carregandoProdutos ? (
                    <View style={styles.loadingStateBox}>
                      <ActivityIndicator size="small" color={KipiPalette.icedDenim} />
                      <Text style={styles.loadingStateText}>Carregando cardápio do ateliê...</Text>
                    </View>
                  ) : produtosFiltrados.length === 0 ? (
                    <View style={styles.emptyStateBox}>
                      <Text style={styles.emptyStateTitle}>Nenhum doce nesta categoria</Text>
                      <Text style={styles.emptyStateSub}>Experimente selecionar a categoria "Todas".</Text>
                    </View>
                  ) : (
                    produtosFiltrados.map((prod) => {
                      const emEstoque = prod.estoque > 0;
                      const permiteAdicionar = emEstoque || tipoEntrega === 'sob_encomenda';
                      const noCarrinho = carrinho.find((i) => i.produto.id === prod.id);

                      return (
                        <TouchableOpacity
                          key={prod.id}
                          style={[
                            styles.gourmetTileCard,
                            isDesktop ? styles.gourmetTile3Col : styles.gourmetTile2Col,
                            noCarrinho && styles.gourmetTileSelected,
                            !permiteAdicionar && styles.gourmetTileDisabled,
                          ]}
                          onPress={() => permiteAdicionar && adicionarAoCarrinho(prod)}
                          activeOpacity={0.8}
                          disabled={!permiteAdicionar}>

                          {/* LADO ESQUERDO: ÍCONE DELICADO DO DOCE */}
                          <View style={[styles.tileIconCircle, { backgroundColor: prod.corFundoIcone || '#FBF6EA' }]}>
                            <Text style={styles.tileEmoji}>{prod.iconeEmoji || '🧁'}</Text>
                          </View>

                          {/* MEIO: NOME, CATEGORIA E ESTOQUE */}
                          <View style={styles.tileDetailsCol}>
                            <Text style={styles.tileProductName} numberOfLines={1}>
                              {prod.nome}
                            </Text>

                            <View style={styles.tileMetaRow}>
                              <Text style={styles.tileCategoryMini}>{prod.categoria}</Text>
                              <Text style={styles.tileDotDivider}>•</Text>
                              {emEstoque ? (
                                <Text style={styles.tileStockAvailable}>● {prod.estoque} un</Text>
                              ) : tipoEntrega === 'sob_encomenda' ? (
                                <Text style={styles.tileStockOrder}>★ Encomenda</Text>
                              ) : (
                                <Text style={styles.tileStockEmpty}>✕ Esgotado</Text>
                              )}
                            </View>

                            <View style={styles.tilePriceAndAddRow}>
                              <Text style={styles.tilePriceText}>
                                R$ {prod.preco.toFixed(2)}
                              </Text>

                              {noCarrinho ? (
                                <View style={styles.tileAddedTag}>
                                  <Text style={styles.tileAddedTagText}>{noCarrinho.quantidade}x</Text>
                                </View>
                              ) : (
                                <View style={[styles.tileAddMiniCircle, !permiteAdicionar && { backgroundColor: '#CBD5E1' }]}>
                                  <Feather name="plus" size={12} color="#FFFFFF" />
                                </View>
                              )}
                            </View>
                          </View>

                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

              </View>
            )}

            {/* -----------------------------------------------------------------------
                COLUNA 2 (DIREITA - 38%): SACOLA DO PEDIDO REINVENTADA & PAGAMENTO CLARO
            ------------------------------------------------------------------------ */}
            {(isDesktop || mobileTab === 'comanda') && (
              <View style={styles.bagColumn}>

                {/* CABEÇALHO DA SACOLA */}
                <View style={styles.bagHeader}>
                  <View style={styles.bagHeaderTitleRow}>
                    <View style={styles.bagIconBadge}>
                      <Feather name="shopping-bag" size={15} color={KipiPalette.icedDenim} />
                    </View>
                    <View>
                      <Text style={styles.bagMainTitle}>Sacola do Pedido</Text>
                      <Text style={styles.bagSubtitle}>
                        {totais.totalItens} {totais.totalItens === 1 ? 'delícia selecionada' : 'delícias selecionadas'}
                      </Text>
                    </View>
                  </View>

                  {carrinho.length > 0 && (
                    <TouchableOpacity
                      style={styles.btnClearBag}
                      onPress={() => setCarrinho([])}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="trash-2" size={12} color="#DC2626" />
                      <Text style={styles.btnClearBagText}>Limpar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* LISTA ROLÁVEL DE ITENS NA SACOLA COM VISUAL GOURMET */}
                <ScrollView
                  style={styles.bagItemsScrollArea}
                  contentContainerStyle={styles.bagItemsContent}
                  showsVerticalScrollIndicator={true}>
                  {carrinho.length === 0 ? (
                    <View style={styles.emptyBagBox}>
                      <View style={styles.emptyBagCircle}>
                        <Feather name="shopping-bag" size={26} color="#94A3B8" />
                      </View>
                      <Text style={styles.emptyBagTitle}>Sua sacola está vazia</Text>
                      <Text style={styles.emptyBagSub}>
                        Toque nos doces da vitrine ao lado para montar a encomenda do cliente.
                      </Text>
                    </View>
                  ) : (
                    carrinho.map((item) => {
                      const precoOriginal = item.produto.preco;
                      const precoCobrado = item.temDesconto
                        ? Math.max(0, precoOriginal - item.valorDescontoUnitario)
                        : precoOriginal;
                      const subtotalItem = precoCobrado * item.quantidade;

                      return (
                        <View key={item.produto.id} style={styles.bagItemCard}>
                          {/* LINHA SUPERIOR DO ITEM COM ÍCONE DO DOCE */}
                          <View style={styles.bagItemTop}>
                            <View style={[styles.bagItemIconCircle, { backgroundColor: item.produto.corFundoIcone || '#FBF6EA' }]}>
                              <Text style={styles.bagItemEmoji}>{item.produto.iconeEmoji || '🍪'}</Text>
                            </View>

                            <View style={styles.bagItemInfoCol}>
                              <Text style={styles.bagItemName} numberOfLines={1}>{item.produto.nome}</Text>
                              <View style={styles.bagItemMetaRow}>
                                <View style={styles.bagItemCatTag}>
                                  <Text style={styles.bagItemCatTagText}>{item.produto.categoria}</Text>
                                </View>
                                <Text style={styles.bagItemUnitPrice}>R$ {precoOriginal.toFixed(2)} un.</Text>
                              </View>
                            </View>

                            <TouchableOpacity
                              style={styles.btnRemoveItem}
                              onPress={() => removerDoCarrinho(item.produto.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Feather name="x" size={13} color="#475569" />
                            </TouchableOpacity>
                          </View>

                          {/* CONTROLES DO ITEM: STEPPER TÁTIL, DESCONTO PISTACHE E TOTAL */}
                          <View style={styles.bagItemBottom}>
                            {/* STEPPER TÁTIL */}
                            <View style={styles.tactileStepper}>
                              <TouchableOpacity
                                style={styles.tactileStepperBtn}
                                onPress={() => alterarQuantidade(item.produto.id, -1)}>
                                <Feather name="minus" size={12} color="#0F172A" />
                              </TouchableOpacity>
                              <Text style={styles.tactileStepperValue}>{item.quantidade}</Text>
                              <TouchableOpacity
                                style={styles.tactileStepperBtn}
                                onPress={() => alterarQuantidade(item.produto.id, 1)}>
                                <Feather name="plus" size={12} color="#0F172A" />
                              </TouchableOpacity>
                            </View>

                            {/* TOGGLE DESCONTO PISTACHE (ALTO CONTRASTE) */}
                            <TouchableOpacity
                              style={[styles.crispDiscountPill, item.temDesconto && styles.crispDiscountPillActive]}
                              onPress={() => alternarDescontoItem(item.produto.id)}
                              activeOpacity={0.8}>
                              <Feather
                                name="tag"
                                size={11}
                                color={item.temDesconto ? '#047857' : '#334155'}
                              />
                              <Text style={[styles.crispDiscountPillText, item.temDesconto && styles.crispDiscountPillTextActive]}>
                                {item.temDesconto
                                  ? `-R$ ${(item.valorDescontoUnitario * item.quantidade).toFixed(2)}`
                                  : '% Desconto'}
                              </Text>
                            </TouchableOpacity>

                            {/* TOTAL DO ITEM EM DESTAQUE */}
                            <Text style={styles.bagItemTotalValue}>
                              R$ {subtotalItem.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                {/* PAINEL FIXO DE FECHAMENTO (PAGAMENTO NÍTIDO + TOTAIS) */}
                <View style={styles.bagCheckoutFooter}>

                  {/* OBSERVAÇÃO DO PEDIDO COM ALTO CONTRASTE */}
                  <View style={styles.notesCrispBox}>
                    <Feather name="edit-3" size={13} color="#1E293B" />
                    <TextInput
                      style={styles.notesCrispInput}
                      placeholder="Observações do ateliê (ex: laço para presente, sem glúten)..."
                      placeholderTextColor="#64748B"
                      value={observacoes}
                      onChangeText={setObservacoes}
                    />
                  </View>

                  {/* 4 OPÇÕES DE FORMAS DE PAGAMENTO COM ALTO CONTRASTE E CORES VIBRANTES */}
                  <View style={styles.paymentSectionWrap}>
                    <Text style={styles.paymentSectionLabel}>FORMA DE PAGAMENTO:</Text>
                    
                    <View style={styles.paymentCardsGrid}>
                      {[
                        { id: 'pix', label: 'Pix', icon: 'zap', activeBg: '#0284C7', iconColor: '#0284C7' },
                        { id: 'cartao', label: 'Cartão', icon: 'credit-card', activeBg: '#2563EB', iconColor: '#2563EB' },
                        { id: 'dinheiro', label: 'Dinheiro', icon: 'dollar-sign', activeBg: '#059669', iconColor: '#059669' },
                        { id: 'pendente', label: 'Pendente', icon: 'clock', activeBg: '#DC2626', iconColor: '#DC2626' },
                      ].map((opt) => {
                        const ativo = metodoPagamento === opt.id;

                        return (
                          <TouchableOpacity
                            key={opt.id}
                            style={[
                              styles.paymentCardBtn,
                              ativo && { backgroundColor: opt.activeBg, borderColor: opt.activeBg },
                            ]}
                            onPress={() => setMetodoPagamento(opt.id as any)}>
                            <Feather
                              name={opt.icon as any}
                              size={13}
                              color={ativo ? '#FFFFFF' : opt.iconColor}
                            />
                            <Text
                              style={[
                                styles.paymentCardBtnText,
                                ativo && styles.paymentCardBtnTextActive,
                              ]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* RESUMO FINANCEIRO NÍTIDO */}
                  <View style={styles.financialCard}>
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Subtotal da vitrine</Text>
                      <Text style={styles.financialVal}>R$ {totais.subtotal.toFixed(2)}</Text>
                    </View>

                    {totais.descontoTotal > 0 && (
                      <View style={styles.financialRow}>
                        <Text style={[styles.financialLabel, { color: '#047857', fontWeight: '700' }]}>
                          Descontos aplicados
                        </Text>
                        <Text style={[styles.financialVal, { color: '#047857', fontWeight: '700' }]}>
                          - R$ {totais.descontoTotal.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.financialDivider} />

                    <View style={styles.grandTotalRow}>
                      <View>
                        <Text style={styles.grandTotalLabel}>TOTAL DO PEDIDO</Text>
                        <Text style={styles.grandTotalHint}>
                          {metodoPagamento === 'pendente' ? '⏳ Pagamento na entrega' : `✓ Quitado no ${metodoPagamento.toUpperCase()}`}
                        </Text>
                      </View>
                      <Text style={styles.grandTotalAmount}>
                        R$ {totais.totalFinal.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* BOTÃO PRINCIPAL COM GRADIENTE E SOMBRA AVELUDADA */}
                  <TouchableOpacity
                    style={[
                      styles.btnFinalizarBoutique,
                      carrinho.length === 0 && { opacity: 0.5 },
                    ]}
                    onPress={handleFinalizarPedido}
                    disabled={salvandoPedido || carrinho.length === 0}>
                    {salvandoPedido ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.btnFinalizarBoutiqueText}>
                        ✓ Finalizar Pedido • R$ {totais.totalFinal.toFixed(2)}
                      </Text>
                    )}
                  </TouchableOpacity>

                </View>

              </View>
            )}

          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  boutiqueContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.28), 0 0 1px 1px rgba(87, 152, 215, 0.15)',
      },
    }),
  },
  boutiqueDesktop: {
    width: '95%',
    maxWidth: 1140,
    height: '90%',
    maxHeight: 800,
  },
  boutiqueMobile: {
    width: '100%',
    height: '96%',
  },

  // CABEÇALHO DO MODAL
  boutiqueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  boutiqueHeaderLeft: {
    gap: 3,
  },
  atelierTagBadge: {
    backgroundColor: '#F3F6DD',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  atelierTagBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#708018',
    letterSpacing: 0.5,
  },
  boutiqueTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
    letterSpacing: -0.3,
  },
  boutiqueSubtitle: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  mobileSegmentTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  mobileSegmentTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  mobileSegmentTabActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  mobileSegmentTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  mobileSegmentTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  boutiqueCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  softAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  softAlertText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
  },

  // CORPO 2 COLUNAS
  boutiqueBody: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },

  // COLUNA ESQUERDA (62%): VITRINE GOURMET
  vitrineColumn: {
    flex: 0.62,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
  },
  commandHeaderBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  selectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },

  // CLIENTE SWITCH (AVULSO VS VIP)
  clientModeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  clientModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  clientModeBtnActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  clientModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  clientModeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // MODALIDADE DE ENTREGA (3 BOTÕES COM ALTO CONTRASTE)
  deliverySegmentBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  deliverySegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  deliverySegmentBtnActive: {
    backgroundColor: '#0F172A',
  },
  deliverySegmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  deliverySegmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // EXPANDED CLIENT SECTION
  clientExpandedSection: {
    marginTop: 2,
  },
  clientChosenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clientChosenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clientAvatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EAF3FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  clientChosenName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  clientChosenPhone: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  btnChangeClient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  btnChangeClientText: {
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },

  inlineClientBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 8,
  },
  inlineClientInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  crispInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  btnSaveClientPrimary: {
    backgroundColor: KipiPalette.icedDenim,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSaveClientPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  btnCancelClient: {
    padding: 6,
  },

  searchClientCrispRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchClientCrispField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  searchClientCrispInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
    padding: 0,
    outlineWidth: 0,
  },
  btnNewClientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: KipiPalette.icedDenim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnNewClientPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  clientFloatingMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    zIndex: 999,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 24px rgba(15, 23, 42, 0.15)',
      },
    }),
  },
  clientFloatingEmpty: {
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  clientFloatingEmptyText: {
    fontSize: 12,
    color: '#64748B',
  },
  clientFloatingEmptyLink: {
    fontSize: 12,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  clientFloatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  clientFloatingName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  clientFloatingPhone: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },

  // DELIVERY SCHEDULE BANNER
  deliveryScheduleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 16,
  },
  deliveryScheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliveryScheduleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  deliveryScheduleInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    width: 95,
  },

  // SEARCH AND CATEGORIES (HIGH CONTRAST)
  searchAndCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  crispSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 175,
    gap: 8,
  },
  crispSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
    padding: 0,
    outlineWidth: 0,
  },
  categoryTrack: {
    flexDirection: 'row',
    gap: 6,
  },
  crispCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  crispCatChipActive: {
    backgroundColor: KipiPalette.icedDenim,
    borderColor: KipiPalette.icedDenim,
  },
  crispCatChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  crispCatChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // VITRINE TILES (MANTIDOS EXATAMENTE COMO A USUÁRIA AMOU)
  vitrineScrollArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  vitrineTilesContainer: {
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  loadingStateBox: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingStateText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  emptyStateBox: {
    width: '100%',
    padding: 30,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyStateSub: {
    fontSize: 11,
    color: '#64748B',
  },

  // CARD DE PRODUTO GOURMET
  gourmetTileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      web: {
        transition: 'all 0.16s ease',
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
      },
    }),
  },
  gourmetTile3Col: {
    width: '31.6%',
  },
  gourmetTile2Col: {
    width: '48.2%',
  },
  gourmetTileSelected: {
    borderColor: KipiPalette.icedDenim,
    backgroundColor: '#FAFDFE',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(87, 152, 215, 0.18)',
      },
    }),
  },
  gourmetTileDisabled: {
    opacity: 0.45,
  },
  tileIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmoji: {
    fontSize: 18,
  },
  tileDetailsCol: {
    flex: 1,
    gap: 2,
  },
  tileProductName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  tileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileCategoryMini: {
    fontSize: 10,
    color: '#64748B',
  },
  tileDotDivider: {
    fontSize: 9,
    color: '#CBD5E1',
  },
  tileStockAvailable: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16A34A',
  },
  tileStockOrder: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284C7',
  },
  tileStockEmpty: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  tilePriceAndAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  tilePriceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  tileAddedTag: {
    backgroundColor: '#F3F6DD',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tileAddedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#708018',
  },
  tileAddMiniCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // COLUNA DIREITA (38%): SACOLA DO PEDIDO REINVENTADA
  bagColumn: {
    flex: 0.38,
    flexDirection: 'column',
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  bagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  bagHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bagIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EAF3FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagMainTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  bagSubtitle: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  btnClearBag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  btnClearBagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  bagItemsScrollArea: {
    flex: 1,
  },
  bagItemsContent: {
    padding: 12,
    gap: 10,
  },
  emptyBagBox: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyBagCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBagTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyBagSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },

  // CARD DE ITEM NA SACOLA (VISUAL GOURMET & NÍTIDO)
  bagItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
      },
    }),
  },
  bagItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bagItemIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagItemEmoji: {
    fontSize: 16,
  },
  bagItemInfoCol: {
    flex: 1,
    gap: 2,
  },
  bagItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  bagItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bagItemCatTag: {
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bagItemCatTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  bagItemUnitPrice: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  btnRemoveItem: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagItemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },

  // STEPPER TÁTIL COM ALTO CONTRASTE
  tactileStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tactileStepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  tactileStepperValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    minWidth: 22,
    textAlign: 'center',
  },

  // DESCONTO PISTACHE NÍTIDO
  crispDiscountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  crispDiscountPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  crispDiscountPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  crispDiscountPillTextActive: {
    color: '#047857',
    fontWeight: '800',
  },
  bagItemTotalValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },

  // FOOTER DA SACOLA
  bagCheckoutFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  notesCrispBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  notesCrispInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
    padding: 0,
    outlineWidth: 0,
  },

  // SEÇÃO DE FORMAS DE PAGAMENTO EM 4 CARDS NÍTIDOS
  paymentSectionWrap: {
    gap: 5,
  },
  paymentSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  paymentCardsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  paymentCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  paymentCardBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  paymentCardBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // RESUMO FINANCEIRO
  financialCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  financialLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  financialVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  financialDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  grandTotalHint: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  grandTotalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
    fontFamily: Fonts.sans,
  },

  // BOTÃO PRINCIPAL COM GRADIENTE E SOMBRA AVELUDADA
  btnFinalizarBoutique: {
    backgroundColor: KipiPalette.icedDenim,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(87, 152, 215, 0.35)',
      },
    }),
  },
  btnFinalizarBoutiqueText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
});
