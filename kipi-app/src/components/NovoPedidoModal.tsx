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

type TipoEntrega = 'retirada' | 'entrega' | 'sob_encomenda';
type FormaPagamento = 'pix' | 'cartao' | 'dinheiro';
type StatusPagamento = 'pago' | 'pendente';

interface NovoPedidoModalProps {
  visible: boolean;
  onClose: () => void;
  onPedidoCriado: (pedido: any) => void;
}

const PRODUTOS_PADRAO: ProdutoItem[] = [
  { id: 'p1', nome: 'Cookie Duo Red Velvet c/ Ninho', categoria: 'Cookies', preco: 16.90, estoque: 18, tem_promocao: true, desconto_promocional: 3.00 },
  { id: 'p2', nome: 'Cookie Tradicional Gotas Belga', categoria: 'Cookies', preco: 14.90, estoque: 24, tem_promocao: false },
  { id: 'p3', nome: 'Cookie Black Nutella & Avelã', categoria: 'Cookies', preco: 18.90, estoque: 12, tem_promocao: true, desconto_promocional: 3.00 },
  { id: 'p4', nome: 'Bento Cake Pistache & Framboesa', categoria: 'Bolos & Bentos', preco: 65.00, estoque: 8, tem_promocao: false },
  { id: 'p5', nome: 'Bento Cake Red Velvet Cream Cheese', categoria: 'Bolos & Bentos', preco: 70.00, estoque: 5, tem_promocao: false },
  { id: 'p6', nome: 'Caixa Macarons Degustação (6 un)', categoria: 'Macarons', preco: 57.00, estoque: 14, tem_promocao: true, desconto_promocional: 5.00 },
  { id: 'p7', nome: 'Torre de Macarons 24 unidades', categoria: 'Macarons', preco: 220.00, estoque: 3, tem_promocao: false },
  { id: 'p8', nome: 'Fatia Torta Ópera Café & Ganache', categoria: 'Sobremesas', preco: 33.50, estoque: 10, tem_promocao: false },
  { id: 'p9', nome: 'Fatia Cheesecake Frutas Silvestres', categoria: 'Sobremesas', preco: 32.50, estoque: 9, tem_promocao: false },
  { id: 'p10', nome: 'Cento de Brigadeiros Gourmet Belga', categoria: 'Doces Finos', preco: 160.00, estoque: 20, tem_promocao: false },
  { id: 'p11', nome: 'Bolo Casamento Flores de Açúcar', categoria: 'Bolos & Bentos', preco: 340.00, estoque: 0, tem_promocao: false },
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
  const isWide = width >= 940;

  // TAB ATIVA EM DISPOSITIVOS MENORES (CATÁLOGO OU COMANDA)
  const [mobileTab, setMobileTab] = useState<'catalogo' | 'comanda'>('catalogo');

  // CLIENTES
  const [clientes, setClientes] = useState<ClienteItem[]>(CLIENTES_PADRAO);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [isVendaAvulsa, setIsVendaAvulsa] = useState(true);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteItem | null>(null);
  const [dropdownClienteAberto, setDropdownClienteAberto] = useState(false);

  // NOVO CLIENTE (INLINE)
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

  // PRODUTOS & CATÁLOGO
  const [produtos, setProdutos] = useState<ProdutoItem[]>(PRODUTOS_PADRAO);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [buscaProduto, setBuscaProduto] = useState('');

  // CARRINHO DO PEDIDO
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  // PAGAMENTO
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>('pago');

  // SUBMISSÃO & FEEDBACK
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // CARREGAR DADOS DO SUPABASE QUANDO ABERTO
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
      // mantém padrão
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
        setProdutos(data);
      }
    } catch {
      // mantém padrão
    } finally {
      setCarregandoProdutos(false);
    }
  };

  // CATEGORIAS
  const categorias = useMemo(() => {
    const cats = Array.from(new Set(produtos.map((p) => p.categoria || 'Geral')));
    return ['Todas', ...cats];
  }, [produtos]);

  // CLIENTES FILTRADOS
  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes;
    const termo = buscaCliente.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        (c.telefone && c.telefone.includes(termo))
    );
  }, [clientes, buscaCliente]);

  // PRODUTOS FILTRADOS
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

  // CADASTRAR NOVO CLIENTE RÁPIDO
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
        const localCli: ClienteItem = {
          id: `cli_${Date.now()}`,
          nome,
          telefone: novoClienteTelefone || null,
        };
        setClientes((prev) => [localCli, ...prev]);
        setClienteSelecionado(localCli);
      }
      setIsVendaAvulsa(false);
      setCriandoNovoCliente(false);
      setNovoClienteNome('');
      setNovoClienteTelefone('');
    } catch {
      const localCli: ClienteItem = {
        id: `cli_${Date.now()}`,
        nome,
        telefone: novoClienteTelefone || null,
      };
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

  // GERENCIAMENTO DO CARRINHO
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

  // CÁLCULO DE TOTAIS
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

    return {
      subtotal,
      descontoTotal,
      totalFinal,
      totalItens,
    };
  }, [carrinho]);

  // FINALIZAR PEDIDO
  const handleFinalizarPedido = async () => {
    if (carrinho.length === 0) {
      setErroForm('Adicione ao menos um produto à comanda');
      return;
    }

    if (!isVendaAvulsa && !clienteSelecionado) {
      setErroForm('Selecione um cliente cadastrado ou clique em Venda Balcão');
      return;
    }

    setSalvandoPedido(true);
    setErroForm(null);

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
          valor_sinal_pago: statusPagamento === 'pago' ? totais.totalFinal : 0,
          saldo_na_entrega: statusPagamento === 'pago' ? 0 : totais.totalFinal,
          status_producao: tipoEntrega === 'sob_encomenda' ? 'a_fazer' : 'pronto',
          pagamento: formaPagamento,
          status: statusPagamento === 'pago' ? 'pago' : 'pendente',
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
        // Fallback local se estiver offline
        const mockVendaCriada = {
          id: `ped_${Date.now()}`,
          cliente_id: isVendaAvulsa ? null : clienteSelecionado?.id || null,
          tipo_pedido: tipoEntrega,
          pagamento: formaPagamento,
          status: statusPagamento,
          total: totais.totalFinal,
          observacoes: observacoes.trim() || null,
          created_at: new Date().toISOString(),
        };
        onPedidoCriado(mockVendaCriada);
      }

      // Limpar formulário e fechar
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
        <View style={[styles.posContainer, isWide ? styles.posContainerDesktop : styles.posContainerMobile]}>

          {/* =========================================================================
              CABEÇALHO FIXO DO POS TERMINAL
          ========================================================================== */}
          <View style={styles.posHeader}>
            <View style={styles.posHeaderLeft}>
              <View style={styles.headerBadge}>
                <View style={styles.headerPulseDot} />
                <Text style={styles.headerBadgeText}>KIPI POS • TERMINAL DE ATENDIMENTO</Text>
              </View>
              <Text style={styles.posMainTitle}>Novo Pedido & Venda de Balcão</Text>
            </View>

            {/* SE MOBILE: SWITCH ENTRE CATÁLOGO E COMANDA */}
            {!isWide && (
              <View style={styles.mobileTabSwitch}>
                <TouchableOpacity
                  style={[styles.mobileTabBtn, mobileTab === 'catalogo' && styles.mobileTabBtnActive]}
                  onPress={() => setMobileTab('catalogo')}>
                  <Feather name="grid" size={14} color={mobileTab === 'catalogo' ? '#FFFFFF' : '#64748B'} />
                  <Text style={[styles.mobileTabText, mobileTab === 'catalogo' && styles.mobileTabTextActive]}>
                    Vitrine
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.mobileTabBtn, mobileTab === 'comanda' && styles.mobileTabBtnActive]}
                  onPress={() => setMobileTab('comanda')}>
                  <Feather name="shopping-bag" size={14} color={mobileTab === 'comanda' ? '#FFFFFF' : '#64748B'} />
                  <Text style={[styles.mobileTabText, mobileTab === 'comanda' && styles.mobileTabTextActive]}>
                    Comanda ({totais.totalItens})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* ALERTA DE ERRO SE HOUVER */}
          {erroForm && (
            <View style={styles.errorAlertBar}>
              <Feather name="alert-circle" size={15} color="#DC2626" />
              <Text style={styles.errorAlertText}>{erroForm}</Text>
              <TouchableOpacity onPress={() => setErroForm(null)}>
                <Feather name="x" size={14} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}

          {/* =========================================================================
              CORPO PRINCIPAL EM 2 COLUNAS (SPLIT STUDIO - CATÁLOGO À ESQUERDA, COMANDA À DIREITA)
          ========================================================================== */}
          <View style={styles.posBodyLayout}>

            {/* -----------------------------------------------------------------------
                COLUNA ESQUERDA: CLIENTE + ATENDIMENTO + CATÁLOGO DE PRODUTOS
            ------------------------------------------------------------------------ */}
            {(isWide || mobileTab === 'catalogo') && (
              <View style={styles.catalogColumn}>

                {/* 1. BARRA SUPERIOR: CLIENTE & TIPO DE ENTREGA */}
                <View style={styles.topControlsStrip}>

                  {/* IDENTIFICAÇÃO DO CLIENTE */}
                  <View style={styles.clientStripBlock}>
                    <View style={styles.stripLabelRow}>
                      <Feather name="user" size={13} color={KipiPalette.icedDenim} />
                      <Text style={styles.stripLabel}>CLIENTE DO PEDIDO:</Text>
                    </View>

                    <View style={styles.clientModePills}>
                      <TouchableOpacity
                        style={[styles.clientModePill, isVendaAvulsa && styles.clientModePillActive]}
                        onPress={() => {
                          setIsVendaAvulsa(true);
                          setClienteSelecionado(null);
                          setCriandoNovoCliente(false);
                          setDropdownClienteAberto(false);
                        }}>
                        <Feather name="zap" size={13} color={isVendaAvulsa ? '#FFFFFF' : '#64748B'} />
                        <Text style={[styles.clientModePillText, isVendaAvulsa && styles.clientModePillTextActive]}>
                          Venda Balcão (Avulsa)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.clientModePill, !isVendaAvulsa && styles.clientModePillActive]}
                        onPress={() => {
                          setIsVendaAvulsa(false);
                          setDropdownClienteAberto(true);
                        }}>
                        <Feather name="user-check" size={13} color={!isVendaAvulsa ? '#FFFFFF' : '#64748B'} />
                        <Text style={[styles.clientModePillText, !isVendaAvulsa && styles.clientModePillTextActive]}>
                          {clienteSelecionado ? clienteSelecionado.nome : 'Cliente Cadastrado ▾'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* SE CLIENTE CADASTRADO: BUSCA / DROPDOWN OU CADASTRO INLINE */}
                    {!isVendaAvulsa && (
                      <View style={styles.clientSearchDrawer}>
                        {clienteSelecionado ? (
                          <View style={styles.selectedClientBadge}>
                            <View style={styles.selectedClientBadgeLeft}>
                              <View style={styles.clientAvatarMini}>
                                <Text style={styles.clientAvatarMiniText}>
                                  {clienteSelecionado.nome[0].toUpperCase()}
                                </Text>
                              </View>
                              <View>
                                <Text style={styles.selectedClientBadgeName}>
                                  {clienteSelecionado.nome}
                                </Text>
                                <Text style={styles.selectedClientBadgeSub}>
                                  {clienteSelecionado.telefone || 'Sem telefone'}
                                </Text>
                              </View>
                            </View>

                            <TouchableOpacity
                              style={styles.btnTrocarCliente}
                              onPress={() => {
                                setClienteSelecionado(null);
                                setDropdownClienteAberto(true);
                              }}>
                              <Text style={styles.btnTrocarClienteText}>Trocar</Text>
                            </TouchableOpacity>
                          </View>
                        ) : criandoNovoCliente ? (
                          <View style={styles.inlineNewClientBox}>
                            <View style={styles.inlineNewClientHeader}>
                              <Text style={styles.inlineNewClientTitle}>+ Cadastrar Cliente Rápido</Text>
                              <TouchableOpacity onPress={() => setCriandoNovoCliente(false)}>
                                <Feather name="x" size={14} color="#64748B" />
                              </TouchableOpacity>
                            </View>

                            <View style={styles.inlineInputsRow}>
                              <TextInput
                                style={[styles.inlineInput, { flex: 1.2 }]}
                                placeholder="Nome completo *"
                                placeholderTextColor="#94A3B8"
                                value={novoClienteNome}
                                onChangeText={setNovoClienteNome}
                              />
                              <TextInput
                                style={[styles.inlineInput, { flex: 0.8 }]}
                                placeholder="Telefone / WPP"
                                placeholderTextColor="#94A3B8"
                                value={novoClienteTelefone}
                                onChangeText={setNovoClienteTelefone}
                              />
                              <TouchableOpacity
                                style={styles.btnInlineSaveClient}
                                onPress={handleCadastrarCliente}
                                disabled={salvandoCliente}>
                                {salvandoCliente ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text style={styles.btnInlineSaveClientText}>Salvar</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.clientPickerContainer}>
                            <View style={styles.clientSearchInputBox}>
                              <Feather name="search" size={14} color="#94A3B8" />
                              <TextInput
                                style={styles.clientSearchInputField}
                                placeholder="Buscar cliente por nome ou celular..."
                                placeholderTextColor="#94A3B8"
                                value={buscaCliente}
                                onChangeText={(t) => {
                                  setBuscaCliente(t);
                                  setDropdownClienteAberto(true);
                                }}
                                onFocus={() => setDropdownClienteAberto(true)}
                              />
                              <TouchableOpacity
                                style={styles.btnOpenNewClientForm}
                                onPress={() => setCriandoNovoCliente(true)}>
                                <Text style={styles.btnOpenNewClientFormText}>+ Novo</Text>
                              </TouchableOpacity>
                            </View>

                            {dropdownClienteAberto && (
                              <View style={styles.floatingClientDropdown}>
                                <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                                  {clientesFiltrados.map((cli) => (
                                    <TouchableOpacity
                                      key={cli.id}
                                      style={styles.dropdownClientRow}
                                      onPress={() => {
                                        setClienteSelecionado(cli);
                                        setDropdownClienteAberto(false);
                                        setBuscaCliente('');
                                      }}>
                                      <View>
                                        <Text style={styles.dropdownClientRowName}>{cli.nome}</Text>
                                        <Text style={styles.dropdownClientRowSub}>{cli.telefone || 'Sem telefone'}</Text>
                                      </View>
                                      <Feather name="check" size={14} color={KipiPalette.icedDenim} />
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* TIPO DE ATENDIMENTO / ENTREGA */}
                  <View style={styles.deliveryStripBlock}>
                    <View style={styles.stripLabelRow}>
                      <Feather name="truck" size={13} color={KipiPalette.icedDenim} />
                      <Text style={styles.stripLabel}>ATENDIMENTO:</Text>
                    </View>

                    <View style={styles.deliverySegmentedBar}>
                      <TouchableOpacity
                        style={[styles.deliverySegmentBtn, tipoEntrega === 'retirada' && styles.deliverySegmentBtnActive]}
                        onPress={() => setTipoEntrega('retirada')}>
                        <Feather name="shopping-bag" size={13} color={tipoEntrega === 'retirada' ? KipiPalette.icedDenim : '#64748B'} />
                        <Text style={[styles.deliverySegmentText, tipoEntrega === 'retirada' && styles.deliverySegmentTextActive]}>
                          Retirada
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.deliverySegmentBtn, tipoEntrega === 'entrega' && styles.deliverySegmentBtnActive]}
                        onPress={() => setTipoEntrega('entrega')}>
                        <Feather name="truck" size={13} color={tipoEntrega === 'entrega' ? KipiPalette.icedDenim : '#64748B'} />
                        <Text style={[styles.deliverySegmentText, tipoEntrega === 'entrega' && styles.deliverySegmentTextActive]}>
                          Delivery
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.deliverySegmentBtn, tipoEntrega === 'sob_encomenda' && styles.deliverySegmentBtnActive]}
                        onPress={() => setTipoEntrega('sob_encomenda')}>
                        <Feather name="calendar" size={13} color={tipoEntrega === 'sob_encomenda' ? KipiPalette.icedDenim : '#64748B'} />
                        <Text style={[styles.deliverySegmentText, tipoEntrega === 'sob_encomenda' && styles.deliverySegmentTextActive]}>
                          Sob Encomenda
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* DATA E HORA SE ENTREGA OU ENCOMENDA */}
                    {tipoEntrega !== 'retirada' && (
                      <View style={styles.inlineDeliveryScheduleRow}>
                        <View style={styles.scheduleItem}>
                          <Text style={styles.scheduleLabel}>Data:</Text>
                          <TextInput
                            style={styles.scheduleInput}
                            value={dataEntrega}
                            onChangeText={setDataEntrega}
                            placeholder="AAAA-MM-DD"
                          />
                        </View>
                        <View style={styles.scheduleItem}>
                          <Text style={styles.scheduleLabel}>Hora:</Text>
                          <TextInput
                            style={styles.scheduleInput}
                            value={horarioEntrega}
                            onChangeText={setHorarioEntrega}
                            placeholder="14:00"
                          />
                        </View>
                      </View>
                    )}
                  </View>

                </View>

                {/* 2. BARRA DE BUSCA DE PRODUTOS & CATEGORIAS */}
                <View style={styles.catalogFilterBar}>
                  <View style={styles.productSearchBox}>
                    <Feather name="search" size={15} color="#94A3B8" />
                    <TextInput
                      style={styles.productSearchField}
                      placeholder="Buscar por nome, sabor, categoria..."
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

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryPillsRow}>
                    {categorias.map((cat) => {
                      const ativo = categoriaAtiva === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.catPillBtn, ativo && styles.catPillBtnActive]}
                          onPress={() => setCategoriaAtiva(cat)}>
                          <Text style={[styles.catPillBtnText, ativo && styles.catPillBtnTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 3. VITRINE DE PRODUTOS (GRID ROLÁVEL COM CARDS MODERNOS) */}
                <ScrollView
                  style={styles.productsScrollArea}
                  contentContainerStyle={styles.productsGridContent}
                  showsVerticalScrollIndicator={true}>
                  {carregandoProdutos ? (
                    <View style={styles.catalogLoadingBox}>
                      <ActivityIndicator size="large" color={KipiPalette.icedDenim} />
                      <Text style={styles.catalogLoadingText}>Carregando cardápio do ateliê...</Text>
                    </View>
                  ) : produtosFiltrados.length === 0 ? (
                    <View style={styles.catalogEmptyBox}>
                      <Feather name="coffee" size={32} color="#CBD5E1" />
                      <Text style={styles.catalogEmptyTitle}>Nenhum produto encontrado</Text>
                      <Text style={styles.catalogEmptySub}>Tente buscar outro termo ou selecione a categoria "Todas".</Text>
                    </View>
                  ) : (
                    produtosFiltrados.map((prod) => {
                      const emEstoque = prod.estoque > 0;
                      const permiteAdicionar = emEstoque || tipoEntrega === 'sob_encomenda';
                      const itemNoCarrinho = carrinho.find((i) => i.produto.id === prod.id);

                      return (
                        <TouchableOpacity
                          key={prod.id}
                          style={[
                            styles.productStudioCard,
                            itemNoCarrinho && styles.productStudioCardSelected,
                            !permiteAdicionar && styles.productStudioCardDisabled,
                          ]}
                          onPress={() => permiteAdicionar && adicionarAoCarrinho(prod)}
                          activeOpacity={0.8}
                          disabled={!permiteAdicionar}>

                          {/* TOPO DO CARD: CATEGORIA & ESTOQUE */}
                          <View style={styles.prodCardTopRow}>
                            <View style={styles.prodCatBadge}>
                              <Text style={styles.prodCatBadgeText}>{prod.categoria}</Text>
                            </View>

                            {emEstoque ? (
                              <View style={styles.stockBadgeGreen}>
                                <Text style={styles.stockBadgeGreenText}>
                                  ● {prod.estoque} un.
                                </Text>
                              </View>
                            ) : tipoEntrega === 'sob_encomenda' ? (
                              <View style={styles.stockBadgeBlue}>
                                <Text style={styles.stockBadgeBlueText}>★ Encomenda</Text>
                              </View>
                            ) : (
                              <View style={styles.stockBadgeRed}>
                                <Text style={styles.stockBadgeRedText}>✕ Esgotado</Text>
                              </View>
                            )}
                          </View>

                          {/* NOME DO PRODUTO */}
                          <Text style={styles.prodCardName} numberOfLines={2}>
                            {prod.nome}
                          </Text>

                          {/* PREÇO E BOTÃO RÁPIDO DE ADIÇÃO */}
                          <View style={styles.prodCardBottomRow}>
                            <View>
                              <Text style={styles.prodPriceLabel}>Preço unitário</Text>
                              <Text style={styles.prodCardPrice}>
                                R$ {prod.preco.toFixed(2)}
                              </Text>
                            </View>

                            {itemNoCarrinho ? (
                              <View style={styles.inCartCountBadge}>
                                <Text style={styles.inCartCountText}>
                                  {itemNoCarrinho.quantidade}x na comanda
                                </Text>
                              </View>
                            ) : (
                              <View style={[styles.quickAddCircle, !permiteAdicionar && { backgroundColor: '#CBD5E1' }]}>
                                <Feather name="plus" size={16} color="#FFFFFF" />
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

              </View>
            )}

            {/* -----------------------------------------------------------------------
                COLUNA DIREITA: COMANDA DO PEDIDO & FECHAMENTO EM TEMPO REAL
            ------------------------------------------------------------------------ */}
            {(isWide || mobileTab === 'comanda') && (
              <View style={styles.orderSummaryColumn}>

                {/* CABEÇALHO DA COMANDA */}
                <View style={styles.cartColumnHeader}>
                  <View style={styles.cartTitleRow}>
                    <Feather name="shopping-bag" size={18} color={KipiPalette.icedDenim} />
                    <Text style={styles.cartMainTitle}>Comanda do Pedido</Text>
                    <View style={styles.cartCountBadge}>
                      <Text style={styles.cartCountBadgeText}>{totais.totalItens} un.</Text>
                    </View>
                  </View>

                  {carrinho.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setCarrinho([])}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.btnClearCartText}>Limpar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* LISTA ROLÁVEL DE ITENS NA COMANDA */}
                <ScrollView
                  style={styles.cartItemsScrollArea}
                  contentContainerStyle={styles.cartItemsContent}
                  showsVerticalScrollIndicator={true}>
                  {carrinho.length === 0 ? (
                    <View style={styles.emptyCartStudioBox}>
                      <View style={styles.emptyCartIconWrap}>
                        <Feather name="shopping-cart" size={28} color="#94A3B8" />
                      </View>
                      <Text style={styles.emptyCartStudioTitle}>Comanda Vazia</Text>
                      <Text style={styles.emptyCartStudioSub}>
                        Clique nos produtos ao lado para montar o pedido do cliente.
                      </Text>
                    </View>
                  ) : (
                    carrinho.map((item) => {
                      const precoOriginal = item.produto.preco;
                      const precoFinalUnit = item.temDesconto
                        ? Math.max(0, precoOriginal - item.valorDescontoUnitario)
                        : precoOriginal;
                      const subtotalItem = precoFinalUnit * item.quantidade;

                      return (
                        <View key={item.produto.id} style={styles.cartItemStudioCard}>
                          {/* LINHA SUPERIOR DO ITEM */}
                          <View style={styles.cartItemStudioTop}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.cartItemStudioName}>{item.produto.nome}</Text>
                              <Text style={styles.cartItemStudioCat}>
                                {item.produto.categoria} • R$ {precoOriginal.toFixed(2)} un.
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={styles.btnRemoveItem}
                              onPress={() => removerDoCarrinho(item.produto.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Feather name="x" size={16} color="#DC2626" />
                            </TouchableOpacity>
                          </View>

                          {/* CONTROLES: QUANTIDADE + DESCONTO + TOTAL DO ITEM */}
                          <View style={styles.cartItemStudioControls}>
                            {/* STEPPER DE QUANTIDADE */}
                            <View style={styles.stepperBox}>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => alterarQuantidade(item.produto.id, -1)}>
                                <Feather name="minus" size={13} color="#475569" />
                              </TouchableOpacity>
                              <Text style={styles.stepperValue}>{item.quantidade}</Text>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => alterarQuantidade(item.produto.id, 1)}>
                                <Feather name="plus" size={13} color="#475569" />
                              </TouchableOpacity>
                            </View>

                            {/* TOGGLE DESCONTO UNITÁRIO */}
                            <TouchableOpacity
                              style={[
                                styles.btnDescontoItem,
                                item.temDesconto && styles.btnDescontoItemActive,
                              ]}
                              onPress={() => alternarDescontoItem(item.produto.id)}
                              activeOpacity={0.8}>
                              <Feather
                                name="percent"
                                size={12}
                                color={item.temDesconto ? '#708018' : '#64748B'}
                              />
                              <Text
                                style={[
                                  styles.btnDescontoItemText,
                                  item.temDesconto && styles.btnDescontoItemTextActive,
                                ]}>
                                {item.temDesconto
                                  ? `-R$ ${(item.valorDescontoUnitario * item.quantidade).toFixed(2)}`
                                  : 'Desconto'}
                              </Text>
                            </TouchableOpacity>

                            {/* TOTAL DO ITEM */}
                            <Text style={styles.cartItemTotal}>
                              R$ {subtotalItem.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                {/* PAINEL INFERIOR FIXO: FORMA DE PAGAMENTO + TOTAIS + FINALIZAR */}
                <View style={styles.checkoutFooterPanel}>

                  {/* OBSERVAÇÕES COMPACTAS */}
                  <View style={styles.notesCompactBox}>
                    <Feather name="edit-3" size={13} color="#94A3B8" />
                    <TextInput
                      style={styles.notesCompactInput}
                      placeholder="Observações do pedido (opcional)..."
                      placeholderTextColor="#94A3B8"
                      value={observacoes}
                      onChangeText={setObservacoes}
                    />
                  </View>

                  {/* FORMAS DE PAGAMENTO */}
                  <View style={styles.paymentSelectorRow}>
                    <TouchableOpacity
                      style={[styles.payPillBtn, formaPagamento === 'pix' && styles.payPillBtnActive]}
                      onPress={() => setFormaPagamento('pix')}>
                      <Feather name="zap" size={13} color={formaPagamento === 'pix' ? KipiPalette.icedDenim : '#64748B'} />
                      <Text style={[styles.payPillText, formaPagamento === 'pix' && styles.payPillTextActive]}>
                        Pix
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.payPillBtn, formaPagamento === 'cartao' && styles.payPillBtnActive]}
                      onPress={() => setFormaPagamento('cartao')}>
                      <Feather name="credit-card" size={13} color={formaPagamento === 'cartao' ? KipiPalette.icedDenim : '#64748B'} />
                      <Text style={[styles.payPillText, formaPagamento === 'cartao' && styles.payPillTextActive]}>
                        Cartão
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.payPillBtn, formaPagamento === 'dinheiro' && styles.payPillBtnActive]}
                      onPress={() => setFormaPagamento('dinheiro')}>
                      <Feather name="dollar-sign" size={13} color={formaPagamento === 'dinheiro' ? KipiPalette.icedDenim : '#64748B'} />
                      <Text style={[styles.payPillText, formaPagamento === 'dinheiro' && styles.payPillTextActive]}>
                        Dinheiro
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* STATUS DO PAGAMENTO */}
                  <View style={styles.payStatusToggleRow}>
                    <TouchableOpacity
                      style={[styles.payStatusBtn, statusPagamento === 'pago' && styles.payStatusBtnPaid]}
                      onPress={() => setStatusPagamento('pago')}>
                      <Feather name="check" size={13} color={statusPagamento === 'pago' ? '#FFFFFF' : '#64748B'} />
                      <Text style={[styles.payStatusBtnText, statusPagamento === 'pago' && styles.payStatusBtnTextPaid]}>
                        Pago Imediato
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.payStatusBtn, statusPagamento === 'pendente' && styles.payStatusBtnPending]}
                      onPress={() => setStatusPagamento('pendente')}>
                      <Feather name="clock" size={13} color={statusPagamento === 'pendente' ? '#FFFFFF' : '#64748B'} />
                      <Text style={[styles.payStatusBtnText, statusPagamento === 'pendente' && styles.payStatusBtnTextPending]}>
                        Pendente (Na entrega)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* TOTAIS FINANCEIROS */}
                  <View style={styles.totalsStudioBox}>
                    <View style={styles.totalStudioLine}>
                      <Text style={styles.totalStudioLineLabel}>Subtotal</Text>
                      <Text style={styles.totalStudioLineValue}>
                        R$ {totais.subtotal.toFixed(2)}
                      </Text>
                    </View>

                    {totais.descontoTotal > 0 && (
                      <View style={styles.totalStudioLine}>
                        <Text style={[styles.totalStudioLineLabel, { color: '#708018', fontWeight: '700' }]}>
                          Descontos concedidos
                        </Text>
                        <Text style={[styles.totalStudioLineValue, { color: '#708018', fontWeight: '700' }]}>
                          - R$ {totais.descontoTotal.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.totalStudioDivider} />

                    <View style={styles.totalStudioGrandRow}>
                      <View>
                        <Text style={styles.totalStudioGrandLabel}>TOTAL DO PEDIDO</Text>
                        <Text style={styles.totalStudioStatusHint}>
                          {statusPagamento === 'pago' ? '✓ Quitado no caixa' : '⏳ Cobrar na entrega'}
                        </Text>
                      </View>
                      <Text style={styles.totalStudioGrandValue}>
                        R$ {totais.totalFinal.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* BOTÃO PRINCIPAL DE FINALIZAÇÃO */}
                  <TouchableOpacity
                    style={[
                      styles.btnFinalizarStudio,
                      salvandoPedido && { opacity: 0.7 },
                      carrinho.length === 0 && { backgroundColor: '#CBD5E1' },
                    ]}
                    onPress={handleFinalizarPedido}
                    disabled={salvandoPedido || carrinho.length === 0}
                    activeOpacity={0.85}>
                    {salvandoPedido ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.btnFinalizarStudioText}>Registrando pedido...</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Feather name="check-circle" size={17} color="#FFFFFF" />
                        <Text style={styles.btnFinalizarStudioText}>
                          Finalizar Pedido • R$ {totais.totalFinal.toFixed(2)}
                        </Text>
                      </View>
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

// ============================================================================
// FOLHA DE ESTILOS MODERNA (POINT OF SALE STUDIO • 2 COLUNAS)
// ============================================================================

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 1000,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
      },
    }),
  },
  posContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
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
  posContainerDesktop: {
    width: '95%',
    maxWidth: 1080,
    height: '88%',
    maxHeight: 820,
  },
  posContainerMobile: {
    width: '100%',
    height: '94%',
  },

  // --------------------------------------------------------------------------
  // CABEÇALHO DO POS
  // --------------------------------------------------------------------------
  posHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  posHeaderLeft: {
    gap: 3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 6,
  },
  headerPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: KipiPalette.icedDenim,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
    fontFamily: Fonts.sans,
    letterSpacing: 0.5,
  },
  posMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
    letterSpacing: -0.3,
  },
  mobileTabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  mobileTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  mobileTabBtnActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  mobileTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  mobileTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  errorAlertText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },

  // --------------------------------------------------------------------------
  // CORPO EM 2 COLUNAS (SPLIT LAYOUT)
  // --------------------------------------------------------------------------
  posBodyLayout: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },

  // --------------------------------------------------------------------------
  // COLUNA ESQUERDA: CATÁLOGO, CLIENTE & ATENDIMENTO (60%)
  // --------------------------------------------------------------------------
  catalogColumn: {
    flex: 0.60,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
  },
  topControlsStrip: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFCFE',
    gap: 12,
  },
  clientStripBlock: {
    gap: 6,
  },
  stripLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stripLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  clientModePills: {
    flexDirection: 'row',
    gap: 8,
  },
  clientModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  clientModePillActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  clientModePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  clientModePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  clientSearchDrawer: {
    marginTop: 4,
  },
  selectedClientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedClientBadgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientAvatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarMiniText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedClientBadgeName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectedClientBadgeSub: {
    fontSize: 10,
    color: '#64748B',
  },
  btnTrocarCliente: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnTrocarClienteText: {
    fontSize: 11,
    color: KipiPalette.icedDenim,
    fontWeight: '700',
  },
  clientPickerContainer: {
    position: 'relative',
    zIndex: 100,
  },
  clientSearchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  clientSearchInputField: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
    outlineWidth: 0,
  },
  btnOpenNewClientForm: {
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnOpenNewClientFormText: {
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  floatingClientDropdown: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
      },
    }),
  },
  dropdownClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownClientRowName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownClientRowSub: {
    fontSize: 10,
    color: '#64748B',
  },
  inlineNewClientBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  inlineNewClientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineNewClientTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  inlineInputsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  inlineInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: '#0F172A',
  },
  btnInlineSaveClient: {
    backgroundColor: KipiPalette.icedDenim,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnInlineSaveClientText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // TIPO DE ENTREGA
  deliveryStripBlock: {
    gap: 6,
  },
  deliverySegmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  deliverySegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  deliverySegmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      },
    }),
  },
  deliverySegmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  deliverySegmentTextActive: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
  },
  inlineDeliveryScheduleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  scheduleInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 11,
    color: '#0F172A',
  },

  // FILTROS DO CATÁLOGO (SEARCH + CATEGORIES)
  catalogFilterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  productSearchBox: {
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
  productSearchField: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
    outlineWidth: 0,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  catPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  catPillBtnActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  catPillBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  catPillBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // VITRINE GRID DE PRODUTOS
  productsScrollArea: {
    flex: 1,
  },
  productsGridContent: {
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catalogLoadingBox: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  catalogLoadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  catalogEmptyBox: {
    width: '100%',
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  catalogEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  catalogEmptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  productStudioCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 6,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        transition: 'all 0.15s ease',
      },
    }),
  },
  productStudioCardSelected: {
    borderColor: KipiPalette.icedDenim,
    backgroundColor: '#F9FCFF',
  },
  productStudioCardDisabled: {
    opacity: 0.5,
  },
  prodCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prodCatBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  prodCatBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  stockBadgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  stockBadgeGreenText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16A34A',
  },
  stockBadgeBlue: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  stockBadgeBlueText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284C7',
  },
  stockBadgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  stockBadgeRedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  prodCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Fonts.sans,
    lineHeight: 17,
  },
  prodCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  prodPriceLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  prodCardPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
    fontFamily: Fonts.sans,
  },
  quickAddCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartCountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inCartCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },

  // --------------------------------------------------------------------------
  // COLUNA DIREITA: COMANDA & FECHAMENTO (40%)
  // --------------------------------------------------------------------------
  orderSummaryColumn: {
    flex: 0.40,
    flexDirection: 'column',
    backgroundColor: '#F8FAFC',
  },
  cartColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartMainTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  cartCountBadge: {
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cartCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  btnClearCartText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  cartItemsScrollArea: {
    flex: 1,
  },
  cartItemsContent: {
    padding: 12,
    gap: 8,
  },
  emptyCartStudioBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCartIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartStudioTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyCartStudioSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  cartItemStudioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 8,
  },
  cartItemStudioTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cartItemStudioName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  cartItemStudioCat: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  btnRemoveItem: {
    padding: 2,
  },
  cartItemStudioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    minWidth: 18,
    textAlign: 'center',
  },
  btnDescontoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  btnDescontoItemActive: {
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1,
  },
  btnDescontoItemText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  btnDescontoItemTextActive: {
    color: '#708018',
    fontWeight: '700',
  },
  cartItemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },

  // PAINEL INFERIOR DE FECHAMENTO
  checkoutFooterPanel: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  notesCompactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
  },
  notesCompactInput: {
    flex: 1,
    fontSize: 11,
    color: '#0F172A',
    padding: 0,
    outlineWidth: 0,
  },
  paymentSelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  payPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  payPillBtnActive: {
    backgroundColor: '#EAF3FA',
    borderWidth: 1,
    borderColor: KipiPalette.icedDenim,
  },
  payPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  payPillTextActive: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
  },
  payStatusToggleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  payStatusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  payStatusBtnPaid: {
    backgroundColor: '#16A34A',
  },
  payStatusBtnPending: {
    backgroundColor: '#DC2626',
  },
  payStatusBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  payStatusBtnTextPaid: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  payStatusBtnTextPending: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  totalsStudioBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 4,
  },
  totalStudioLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalStudioLineLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  totalStudioLineValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  totalStudioDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  totalStudioGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  totalStudioGrandLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  totalStudioStatusHint: {
    fontSize: 10,
    color: '#64748B',
  },
  totalStudioGrandValue: {
    fontSize: 18,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
    fontFamily: Fonts.sans,
  },
  btnFinalizarStudio: {
    backgroundColor: KipiPalette.icedDenim,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(87, 152, 215, 0.35)',
      },
    }),
  },
  btnFinalizarStudioText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
});
