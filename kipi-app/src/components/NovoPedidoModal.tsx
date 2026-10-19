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
type FormaPagamento = 'pix' | 'dinheiro' | 'cartao';
type StatusPagamento = 'pago' | 'pendente';

interface NovoPedidoModalProps {
  visible: boolean;
  onClose: () => void;
  onPedidoCriado: (pedido: any) => void;
}

export default function NovoPedidoModal({
  visible,
  onClose,
  onPedidoCriado,
}: NovoPedidoModalProps) {
  // CLIENTES
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [isVendaAvulsa, setIsVendaAvulsa] = useState(false);
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

  // PRODUTOS
  const [produtos, setProdutos] = useState<ProdutoItem[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [buscaProduto, setBuscaProduto] = useState('');

  // CARRINHO DO PEDIDO
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  // PAGAMENTO
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>('pago');

  // SUBMISSÃO
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // CARREGAR DADOS AO ABRIR O MODAL
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
        .limit(30);

      if (!error && data) {
        setClientes(data);
      }
    } catch {
      // continua sem travar
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
      } else {
        // Fallback elegante com produtos do ateliê caso tabela esteja vazia
        setProdutos([
          { id: 'p1', nome: 'Cookie Duo', categoria: 'Cookies', preco: 16.9, estoque: 4, tem_promocao: true, desconto_promocional: 3 },
          { id: 'p2', nome: 'Cookie Tradicional', categoria: 'Cookies', preco: 14.9, estoque: 2, tem_promocao: true, desconto_promocional: 3 },
          { id: 'p3', nome: 'Cookie Black Nutella', categoria: 'Cookies', preco: 18.9, estoque: 0, tem_promocao: true, desconto_promocional: 3 },
          { id: 'p4', nome: 'Bolo Red Velvet Floral', categoria: 'Bolos', preco: 120.0, estoque: 0, tem_promocao: false },
          { id: 'p5', nome: 'Cento de Brigadeiros Pistache', categoria: 'Doces', preco: 120.0, estoque: 0, tem_promocao: false },
        ]);
      }
    } catch {
      // fallback
    } finally {
      setCarregandoProdutos(false);
    }
  };

  // CATEGORIAS DISPONÍVEIS
  const categorias = useMemo(() => {
    const cats = Array.from(new Set(produtos.map((p) => p.categoria || 'Geral')));
    return ['Todas', ...cats];
  }, [produtos]);

  // CLIENTES FILTRADOS PELA BUSCA
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

      if (error) throw new Error(error.message);

      if (data) {
        setClientes((prev) => [data, ...prev]);
        setClienteSelecionado(data);
        setIsVendaAvulsa(false);
        setCriandoNovoCliente(false);
        setNovoClienteNome('');
        setNovoClienteTelefone('');
      }
    } catch (e: any) {
      // Caso ocorra erro de permissão ou rede, seleciona localmente
      const localCli: ClienteItem = {
        id: `local_${Date.now()}`,
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
          valorDescontoUnitario: produto.desconto_promocional || 3.0,
        },
      ];
    });
    setErroForm(null);
  };

  const alterarQuantidade = (produtoId: string, delta: number) => {
    setCarrinho((prev) => {
      return prev
        .map((item) => {
          if (item.produto.id === produtoId) {
            const novaQtd = item.quantidade + delta;
            return novaQtd > 0 ? { ...item, quantidade: novaQtd } : null;
          }
          return item;
        })
        .filter(Boolean) as ItemCarrinho[];
    });
  };

  const alternarDescontoItem = (produtoId: string) => {
    setCarrinho((prev) =>
      prev.map((item) =>
        item.produto.id === produtoId
          ? { ...item, temDesconto: !item.temDesconto }
          : item
      )
    );
  };

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((i) => i.produto.id !== produtoId));
  };

  // TOTAIS CALCULADOS
  const totais = useMemo(() => {
    let subtotal = 0;
    let descontoTotal = 0;

    for (const item of carrinho) {
      const precoItem = item.produto.preco * item.quantidade;
      subtotal += precoItem;

      if (item.temDesconto) {
        const descontoItem = item.valorDescontoUnitario * item.quantidade;
        descontoTotal += Math.min(descontoItem, precoItem);
      }
    }

    const totalFinal = Math.max(0, subtotal - descontoTotal);

    return {
      subtotal,
      descontoTotal,
      totalFinal,
    };
  }, [carrinho]);

  // FINALIZAR PEDIDO
  const handleFinalizarPedido = async () => {
    if (carrinho.length === 0) {
      setErroForm('Adicione ao menos um produto ao pedido');
      return;
    }

    if (!isVendaAvulsa && !clienteSelecionado) {
      setErroForm('Selecione um cliente ou escolha a opção "Venda Avulsa (Balcão)"');
      return;
    }

    // Validação de estoque para retirada/entrega imediata
    if (tipoEntrega !== 'sob_encomenda') {
      const itemSemEstoque = carrinho.find(
        (i) => i.produto.estoque < i.quantidade && i.produto.estoque <= 0
      );
      if (itemSemEstoque) {
        setErroForm(
          `O produto "${itemSemEstoque.produto.nome}" está sem estoque imediato. Mude para "Sob Encomenda" para produzir sob medida!`
        );
        return;
      }
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

      if (vendaError) throw new Error(vendaError.message);

      // Inserir itens da venda
      if (novaVenda) {
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
      }

      // Limpar formulário e fechar
      setCarrinho([]);
      setClienteSelecionado(null);
      setIsVendaAvulsa(false);
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>

          {/* CABEÇALHO DO MODAL */}
          <View style={styles.modalHeader}>
            <View>
              <View style={styles.headerBadgeRow}>
                <View style={styles.headerTag}>
                  <Text style={styles.headerTagText}>ATELIÊ • ATENDIMENTO</Text>
                </View>
                <Text style={styles.modalTitle}>Novo Pedido</Text>
              </View>
              <Text style={styles.modalSubtitle}>
                Registre uma venda de balcão, entrega ou encomenda personalizada
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* ALERTA DE ERRO SE HOUVER */}
          {erroForm && (
            <View style={styles.errorAlert}>
              <Feather name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorAlertText}>{erroForm}</Text>
            </View>
          )}

          {/* CORPO COM SCROLL */}
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}>

            {/* =====================================================================
                SEÇÃO 1: CLIENTE
            ====================================================================== */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionStep}>
                  <Text style={styles.sectionStepText}>1</Text>
                </View>
                <Text style={styles.sectionTitle}>Identificação do Cliente</Text>
              </View>

              {/* OPÇÕES: CLIENTE CADASTRADO OU VENDA AVULSA */}
              <View style={styles.clientModeTabs}>
                <TouchableOpacity
                  style={[
                    styles.clientModeTab,
                    !isVendaAvulsa && styles.clientModeTabActive,
                  ]}
                  onPress={() => {
                    setIsVendaAvulsa(false);
                    setCriandoNovoCliente(false);
                  }}
                  activeOpacity={0.8}>
                  <Feather
                    name="user"
                    size={15}
                    color={!isVendaAvulsa ? KipiPalette.icedDenim : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.clientModeTabText,
                      !isVendaAvulsa && styles.clientModeTabTextActive,
                    ]}>
                    Cliente Cadastrado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.clientModeTab,
                    isVendaAvulsa && styles.clientModeTabActive,
                  ]}
                  onPress={() => {
                    setIsVendaAvulsa(true);
                    setClienteSelecionado(null);
                    setCriandoNovoCliente(false);
                    setDropdownClienteAberto(false);
                  }}
                  activeOpacity={0.8}>
                  <Feather
                    name="zap"
                    size={15}
                    color={isVendaAvulsa ? KipiPalette.icedDenim : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.clientModeTabText,
                      isVendaAvulsa && styles.clientModeTabTextActive,
                    ]}>
                    Venda Avulsa (Balcão)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SE VENDA AVULSA SELECIONADA */}
              {isVendaAvulsa ? (
                <View style={styles.avulsaNotice}>
                  <Feather name="check" size={16} color="#708018" />
                  <Text style={styles.avulsaNoticeText}>
                    Venda direta no balcão sem vínculo com cadastro de cliente.
                  </Text>
                </View>
              ) : (
                /* SE CLIENTE CADASTRADO */
                <View style={styles.clientSelectArea}>
                  {clienteSelecionado ? (
                    /* CLIENTE JÁ SELECIONADO */
                    <View style={styles.selectedClientCard}>
                      <View style={styles.selectedClientLeft}>
                        <View style={styles.clientAvatar}>
                          <Text style={styles.clientAvatarText}>
                            {clienteSelecionado.nome[0].toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.selectedClientName}>{clienteSelecionado.nome}</Text>
                          <Text style={styles.selectedClientPhone}>
                            {clienteSelecionado.telefone || 'Sem telefone'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.changeClientBtn}
                        onPress={() => {
                          setClienteSelecionado(null);
                          setDropdownClienteAberto(true);
                        }}>
                        <Text style={styles.changeClientBtnText}>Trocar</Text>
                      </TouchableOpacity>
                    </View>
                  ) : criandoNovoCliente ? (
                    /* FORMULÁRIO DE NOVO CLIENTE RÁPIDO */
                    <View style={styles.newClientForm}>
                      <Text style={styles.newClientTitle}>+ Cadastrar Novo Cliente</Text>
                      <View style={styles.inputRow}>
                        <View style={[styles.fieldWrap, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Nome do Cliente *</Text>
                          <TextInput
                            style={styles.textInput}
                            placeholder="Ex: Mariana Albuquerque"
                            placeholderTextColor="#94A3B8"
                            value={novoClienteNome}
                            onChangeText={setNovoClienteNome}
                          />
                        </View>
                        <View style={[styles.fieldWrap, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Telefone / WhatsApp</Text>
                          <TextInput
                            style={styles.textInput}
                            placeholder="(21) 99999-9999"
                            placeholderTextColor="#94A3B8"
                            value={novoClienteTelefone}
                            onChangeText={setNovoClienteTelefone}
                            keyboardType="phone-pad"
                          />
                        </View>
                      </View>
                      <View style={styles.newClientActions}>
                        <TouchableOpacity
                          style={styles.cancelNewClientBtn}
                          onPress={() => setCriandoNovoCliente(false)}>
                          <Text style={styles.cancelNewClientBtnText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.saveNewClientBtn}
                          onPress={handleCadastrarCliente}
                          disabled={salvandoCliente}>
                          {salvandoCliente ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.saveNewClientBtnText}>Salvar e Selecionar</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    /* CAMPO DE BUSCA E DROPDOWN DE CLIENTES */
                    <View style={styles.clientSearchBox}>
                      <View style={styles.searchInputContainer}>
                        <Feather name="search" size={16} color="#94A3B8" />
                        <TextInput
                          style={styles.clientSearchInput}
                          placeholder="Buscar cliente por nome ou telefone..."
                          placeholderTextColor="#94A3B8"
                          value={buscaCliente}
                          onChangeText={(t) => {
                            setBuscaCliente(t);
                            setDropdownClienteAberto(true);
                          }}
                          onFocus={() => setDropdownClienteAberto(true)}
                        />
                        {buscaCliente ? (
                          <TouchableOpacity onPress={() => setBuscaCliente('')}>
                            <Feather name="x" size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {/* DROPDOWN DE CLIENTES */}
                      {dropdownClienteAberto && (
                        <View style={styles.clientDropdownList}>
                          <ScrollView
                            style={{ maxHeight: 180 }}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={true}>
                            {carregandoClientes ? (
                              <View style={styles.dropdownLoading}>
                                <ActivityIndicator size="small" color={KipiPalette.icedDenim} />
                                <Text style={styles.dropdownLoadingText}>Carregando clientes...</Text>
                              </View>
                            ) : clientesFiltrados.length === 0 ? (
                              <View style={styles.dropdownEmpty}>
                                <Text style={styles.dropdownEmptyText}>Nenhum cliente encontrado.</Text>
                              </View>
                            ) : (
                              clientesFiltrados.map((cli) => (
                                <TouchableOpacity
                                  key={cli.id}
                                  style={styles.clientDropdownItem}
                                  onPress={() => {
                                    setClienteSelecionado(cli);
                                    setDropdownClienteAberto(false);
                                    setBuscaCliente('');
                                  }}>
                                  <View style={styles.clientItemLeft}>
                                    <View style={styles.clientMiniAvatar}>
                                      <Text style={styles.clientMiniAvatarText}>
                                        {cli.nome[0].toUpperCase()}
                                      </Text>
                                    </View>
                                    <View>
                                      <Text style={styles.clientDropdownName}>{cli.nome}</Text>
                                      <Text style={styles.clientDropdownPhone}>
                                        {cli.telefone || 'Sem telefone'}
                                      </Text>
                                    </View>
                                  </View>
                                  <Feather name="arrow-right" size={14} color="#94A3B8" />
                                </TouchableOpacity>
                              ))
                            )}
                          </ScrollView>

                          {/* BOTÃO + NOVO CLIENTE */}
                          <TouchableOpacity
                            style={styles.dropdownNewBtn}
                            onPress={() => {
                              setCriandoNovoCliente(true);
                              setDropdownClienteAberto(false);
                            }}>
                            <Feather name="plus-circle" size={15} color={KipiPalette.icedDenim} />
                            <Text style={styles.dropdownNewBtnText}>+ Cadastrar Novo Cliente</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* =====================================================================
                SEÇÃO 2: TIPO DE ENTREGA / ATENDIMENTO
            ====================================================================== */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionStep}>
                  <Text style={styles.sectionStepText}>2</Text>
                </View>
                <Text style={styles.sectionTitle}>Tipo de Atendimento / Entrega</Text>
              </View>

              {/* 3 OPÇÕES DE ATENDIMENTO */}
              <View style={styles.deliveryCardsRow}>
                {/* 1. Retirada */}
                <TouchableOpacity
                  style={[
                    styles.deliveryCard,
                    tipoEntrega === 'retirada' && styles.deliveryCardActive,
                  ]}
                  onPress={() => setTipoEntrega('retirada')}
                  activeOpacity={0.8}>
                  <View style={styles.deliveryCardIconBox}>
                    <Feather
                      name="shopping-bag"
                      size={18}
                      color={tipoEntrega === 'retirada' ? KipiPalette.icedDenim : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.deliveryCardTitle,
                      tipoEntrega === 'retirada' && styles.deliveryCardTitleActive,
                    ]}>
                    Retirada no Balcão
                  </Text>
                  <Text style={styles.deliveryCardDesc}>Pronta entrega no ateliê</Text>
                </TouchableOpacity>

                {/* 2. Entrega */}
                <TouchableOpacity
                  style={[
                    styles.deliveryCard,
                    tipoEntrega === 'entrega' && styles.deliveryCardActive,
                  ]}
                  onPress={() => setTipoEntrega('entrega')}
                  activeOpacity={0.8}>
                  <View style={styles.deliveryCardIconBox}>
                    <Feather
                      name="truck"
                      size={18}
                      color={tipoEntrega === 'entrega' ? KipiPalette.icedDenim : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.deliveryCardTitle,
                      tipoEntrega === 'entrega' && styles.deliveryCardTitleActive,
                    ]}>
                    Entrega / Delivery
                  </Text>
                  <Text style={styles.deliveryCardDesc}>Envio programado com data e hora</Text>
                </TouchableOpacity>

                {/* 3. Sob Encomenda */}
                <TouchableOpacity
                  style={[
                    styles.deliveryCard,
                    tipoEntrega === 'sob_encomenda' && styles.deliveryCardActive,
                  ]}
                  onPress={() => setTipoEntrega('sob_encomenda')}
                  activeOpacity={0.8}>
                  <View style={styles.deliveryCardIconBox}>
                    <Feather
                      name="calendar"
                      size={18}
                      color={tipoEntrega === 'sob_encomenda' ? KipiPalette.icedDenim : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.deliveryCardTitle,
                      tipoEntrega === 'sob_encomenda' && styles.deliveryCardTitleActive,
                    ]}>
                    Sob Encomenda
                  </Text>
                  <Text style={styles.deliveryCardDesc}>Produção artesanal personalizada</Text>
                </TouchableOpacity>
              </View>

              {/* CAMPOS CONDICIONAIS */}
              {tipoEntrega === 'retirada' ? (
                <View style={styles.deliveryNotice}>
                  <Feather name="check" size={14} color="#708018" />
                  <Text style={styles.deliveryNoticeText}>
                    Retirada imediata no balcão. Não é necessário agendar data nem horário de entrega.
                  </Text>
                </View>
              ) : (
                <View style={styles.deliveryInputsArea}>
                  <View style={styles.inputRow}>
                    <View style={[styles.fieldWrap, { flex: 1.2 }]}>
                      <Text style={styles.fieldLabel}>
                        {tipoEntrega === 'sob_encomenda' ? 'Data Prometida *' : 'Data da Entrega *'}
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="AAAA-MM-DD"
                        placeholderTextColor="#94A3B8"
                        value={dataEntrega}
                        onChangeText={setDataEntrega}
                      />
                    </View>
                    <View style={[styles.fieldWrap, { flex: 0.8 }]}>
                      <Text style={styles.fieldLabel}>Horário Previsto *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Ex: 14:00"
                        placeholderTextColor="#94A3B8"
                        value={horarioEntrega}
                        onChangeText={setHorarioEntrega}
                      />
                    </View>
                  </View>

                  {tipoEntrega === 'sob_encomenda' && (
                    <View style={styles.sobEncomendaNotice}>
                      <Feather name="star" size={14} color="#5798D7" />
                      <Text style={styles.sobEncomendaNoticeText}>
                        Itens sob encomenda podem ser vendidos mesmo sem estoque disponível em bancada.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* =====================================================================
                SEÇÃO 3: SELEÇÃO DE PRODUTOS
            ====================================================================== */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionStep}>
                  <Text style={styles.sectionStepText}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Produtos do Pedido</Text>
                  <Text style={styles.sectionSubtitle}>
                    Filtre por categoria, consulte o estoque e adicione produtos
                  </Text>
                </View>
              </View>

              {/* FILTROS DE CATEGORIA */}
              <View style={styles.categoryPillsScroll}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryPillsContent}>
                  {categorias.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catPill,
                        categoriaAtiva === cat && styles.catPillActive,
                      ]}
                      onPress={() => setCategoriaAtiva(cat)}
                      activeOpacity={0.8}>
                      <Text
                        style={[
                          styles.catPillText,
                          categoriaAtiva === cat && styles.catPillTextActive,
                        ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* CAMPO DE BUSCA DE PRODUTOS */}
              <View style={styles.productSearchInputContainer}>
                <Feather name="search" size={15} color="#94A3B8" />
                <TextInput
                  style={styles.productSearchInput}
                  placeholder="Buscar produto por nome..."
                  placeholderTextColor="#94A3B8"
                  value={buscaProduto}
                  onChangeText={setBuscaProduto}
                />
              </View>

              {/* LISTA DE PRODUTOS DISPONÍVEIS */}
              <View style={styles.productsGrid}>
                {carregandoProdutos ? (
                  <ActivityIndicator size="small" color={KipiPalette.icedDenim} />
                ) : produtosFiltrados.length === 0 ? (
                  <Text style={styles.emptyProductsText}>Nenhum produto nesta categoria.</Text>
                ) : (
                  produtosFiltrados.map((prod) => {
                    const emEstoque = prod.estoque > 0;
                    const permiteAdicionar = emEstoque || tipoEntrega === 'sob_encomenda';
                    const jaNoCarrinho = carrinho.some((i) => i.produto.id === prod.id);

                    return (
                      <View key={prod.id} style={styles.productCard}>
                        <View style={styles.productCardTop}>
                          <View style={styles.prodCatBadge}>
                            <Text style={styles.prodCatBadgeText}>{prod.categoria}</Text>
                          </View>
                          {/* BADGE DE ESTOQUE */}
                          {emEstoque ? (
                            <View style={styles.stockBadgeGreen}>
                              <Text style={styles.stockBadgeGreenText}>
                                {prod.estoque} em estoque
                              </Text>
                            </View>
                          ) : tipoEntrega === 'sob_encomenda' ? (
                            <View style={styles.stockBadgeBlue}>
                              <Text style={styles.stockBadgeBlueText}>Sob Encomenda</Text>
                            </View>
                          ) : (
                            <View style={styles.stockBadgeRed}>
                              <Text style={styles.stockBadgeRedText}>Sem estoque</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.prodName}>{prod.nome}</Text>

                        <View style={styles.prodPriceRow}>
                          <Text style={styles.prodPrice}>
                            R$ {prod.preco.toFixed(2).replace('.', ',')}
                          </Text>

                          <TouchableOpacity
                            style={[
                              styles.addProdBtn,
                              !permiteAdicionar && styles.addProdBtnDisabled,
                              jaNoCarrinho && styles.addProdBtnInCart,
                            ]}
                            onPress={() => adicionarAoCarrinho(prod)}
                            disabled={!permiteAdicionar}
                            activeOpacity={0.8}>
                            <Feather
                              name={jaNoCarrinho ? 'check' : 'plus'}
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.addProdBtnText}>
                              {jaNoCarrinho ? 'Adicionado' : 'Adicionar'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* ===================================================================
                  ITENS SELECIONADOS NO PEDIDO (CARRINHO COM DESCONTO)
              ==================================================================== */}
              <View style={styles.cartSection}>
                <View style={styles.cartHeaderRow}>
                  <Text style={styles.cartTitle}>
                    Itens no Pedido ({carrinho.length})
                  </Text>
                  {carrinho.length > 0 && (
                    <TouchableOpacity onPress={() => setCarrinho([])}>
                      <Text style={styles.clearCartText}>Limpar tudo</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {carrinho.length === 0 ? (
                  <View style={styles.emptyCartBox}>
                    <Feather name="shopping-bag" size={24} color="#CBD5E1" />
                    <Text style={styles.emptyCartText}>
                      Nenhum produto adicionado ainda. Escolha os itens acima!
                    </Text>
                  </View>
                ) : (
                  <View style={styles.cartList}>
                    {carrinho.map((item) => {
                      const precoUnitOriginal = item.produto.preco;
                      const precoUnitFinal = item.temDesconto
                        ? Math.max(0, precoUnitOriginal - item.valorDescontoUnitario)
                        : precoUnitOriginal;
                      const subtotalItem = precoUnitFinal * item.quantidade;

                      return (
                        <View key={item.produto.id} style={styles.cartItemCard}>
                          {/* LINHA SUPERIOR DO ITEM */}
                          <View style={styles.cartItemTop}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.cartItemName}>{item.produto.nome}</Text>
                              <Text style={styles.cartItemCat}>{item.produto.categoria}</Text>
                            </View>

                            <TouchableOpacity
                              style={styles.removeItemBtn}
                              onPress={() => removerDoCarrinho(item.produto.id)}>
                              <Feather name="trash-2" size={15} color="#DC2626" />
                            </TouchableOpacity>
                          </View>

                          {/* CONTROLES DO ITEM: QUANTIDADE + BOTÃO DE DESCONTO + TOTAL */}
                          <View style={styles.cartItemBottom}>
                            {/* CONTADOR DE QUANTIDADE */}
                            <View style={styles.quantityCounter}>
                              <TouchableOpacity
                                style={styles.counterBtn}
                                onPress={() => alterarQuantidade(item.produto.id, -1)}>
                                <Feather name="minus" size={13} color="#475569" />
                              </TouchableOpacity>
                              <Text style={styles.counterValue}>{item.quantidade}</Text>
                              <TouchableOpacity
                                style={styles.counterBtn}
                                onPress={() => alterarQuantidade(item.produto.id, 1)}>
                                <Feather name="plus" size={13} color="#475569" />
                              </TouchableOpacity>
                            </View>

                            {/* BOTÃO PARA INDICAR DESCONTO */}
                            <TouchableOpacity
                              style={[
                                styles.discountToggleBtn,
                                item.temDesconto && styles.discountToggleBtnActive,
                              ]}
                              onPress={() => alternarDescontoItem(item.produto.id)}
                              activeOpacity={0.8}>
                              <Feather
                                name="tag"
                                size={12}
                                color={item.temDesconto ? '#708018' : '#64748B'}
                              />
                              <Text
                                style={[
                                  styles.discountToggleBtnText,
                                  item.temDesconto && styles.discountToggleBtnTextActive,
                                ]}>
                                {item.temDesconto
                                  ? `Desconto (-R$ ${(item.valorDescontoUnitario * item.quantidade).toFixed(2).replace('.', ',')})`
                                  : 'Aplicar Desconto'}
                              </Text>
                            </TouchableOpacity>

                            {/* PREÇO FINAL DO ITEM */}
                            <View style={styles.itemPricesCol}>
                              {item.temDesconto && (
                                <Text style={styles.itemOldPrice}>
                                  R$ {(precoUnitOriginal * item.quantidade).toFixed(2).replace('.', ',')}
                                </Text>
                              )}
                              <Text style={styles.itemFinalPrice}>
                                R$ {subtotalItem.toFixed(2).replace('.', ',')}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* =====================================================================
                SEÇÃO 4: REGISTRO DE PAGAMENTO & OBSERVAÇÕES
            ====================================================================== */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionStep}>
                  <Text style={styles.sectionStepText}>4</Text>
                </View>
                <Text style={styles.sectionTitle}>Registro de Pagamento & Totais</Text>
              </View>

              {/* FORMAS DE PAGAMENTO */}
              <View style={styles.paymentMethodsRow}>
                {/* Pix */}
                <TouchableOpacity
                  style={[
                    styles.payMethodBtn,
                    formaPagamento === 'pix' && styles.payMethodBtnActive,
                  ]}
                  onPress={() => setFormaPagamento('pix')}
                  activeOpacity={0.8}>
                  <Feather
                    name="zap"
                    size={16}
                    color={formaPagamento === 'pix' ? KipiPalette.icedDenim : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.payMethodText,
                      formaPagamento === 'pix' && styles.payMethodTextActive,
                    ]}>
                    Pix
                  </Text>
                </TouchableOpacity>

                {/* Dinheiro */}
                <TouchableOpacity
                  style={[
                    styles.payMethodBtn,
                    formaPagamento === 'dinheiro' && styles.payMethodBtnActive,
                  ]}
                  onPress={() => setFormaPagamento('dinheiro')}
                  activeOpacity={0.8}>
                  <Feather
                    name="dollar-sign"
                    size={16}
                    color={formaPagamento === 'dinheiro' ? KipiPalette.icedDenim : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.payMethodText,
                      formaPagamento === 'dinheiro' && styles.payMethodTextActive,
                    ]}>
                    Dinheiro
                  </Text>
                </TouchableOpacity>

                {/* Cartão */}
                <TouchableOpacity
                  style={[
                    styles.payMethodBtn,
                    formaPagamento === 'cartao' && styles.payMethodBtnActive,
                  ]}
                  onPress={() => setFormaPagamento('cartao')}
                  activeOpacity={0.8}>
                  <Feather
                    name="credit-card"
                    size={16}
                    color={formaPagamento === 'cartao' ? KipiPalette.icedDenim : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.payMethodText,
                      formaPagamento === 'cartao' && styles.payMethodTextActive,
                    ]}>
                    Cartão
                  </Text>
                </TouchableOpacity>
              </View>

              {/* STATUS DO PAGAMENTO */}
              <View style={styles.paymentStatusRow}>
                <TouchableOpacity
                  style={[
                    styles.payStatusChip,
                    statusPagamento === 'pago' && styles.payStatusChipActive,
                  ]}
                  onPress={() => setStatusPagamento('pago')}
                  activeOpacity={0.8}>
                  <Feather
                    name="check-circle"
                    size={14}
                    color={statusPagamento === 'pago' ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.payStatusText,
                      statusPagamento === 'pago' && styles.payStatusTextActive,
                    ]}>
                    Pago Imediato
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.payStatusChip,
                    statusPagamento === 'pendente' && styles.payStatusChipPending,
                  ]}
                  onPress={() => setStatusPagamento('pendente')}
                  activeOpacity={0.8}>
                  <Feather
                    name="clock"
                    size={14}
                    color={statusPagamento === 'pendente' ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.payStatusText,
                      statusPagamento === 'pendente' && styles.payStatusTextActive,
                    ]}>
                    Pagar na Entrega / Retirada
                  </Text>
                </TouchableOpacity>
              </View>

              {/* OBSERVAÇÕES OPCIONAIS */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Observações do Pedido</Text>
                <TextInput
                  style={styles.textInputArea}
                  placeholder="Ex: Embalagem para presente, sem açúcar, velas..."
                  placeholderTextColor="#94A3B8"
                  value={observacoes}
                  onChangeText={setObservacoes}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* RESUMO FINANCEIRO (TOTAIS AUTOMÁTICOS) */}
              <View style={styles.totalsBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalRowLabel}>Subtotal dos Produtos</Text>
                  <Text style={styles.totalRowValue}>
                    R$ {totais.subtotal.toFixed(2).replace('.', ',')}
                  </Text>
                </View>

                {totais.descontoTotal > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalRowLabelDiscount}>Descontos Aplicados</Text>
                    <Text style={styles.totalRowValueDiscount}>
                      - R$ {totais.descontoTotal.toFixed(2).replace('.', ',')}
                    </Text>
                  </View>
                )}

                <View style={styles.totalDivider} />

                <View style={styles.totalRowGrand}>
                  <Text style={styles.totalGrandLabel}>TOTAL DO PEDIDO</Text>
                  <Text style={styles.totalGrandValue}>
                    R$ {totais.totalFinal.toFixed(2).replace('.', ',')}
                  </Text>
                </View>
              </View>
            </View>

          </ScrollView>

          {/* RODAPÉ FIXO DO MODAL (AÇÕES) */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelFooterBtn}
              onPress={onClose}
              disabled={salvandoPedido}>
              <Text style={styles.cancelFooterBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitFooterBtn,
                salvandoPedido && styles.submitFooterBtnDisabled,
              ]}
              onPress={handleFinalizarPedido}
              disabled={salvandoPedido}
              activeOpacity={0.85}>
              {salvandoPedido ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitFooterBtnText}>Finalizando Pedido...</Text>
                </View>
              ) : (
                <Text style={styles.submitFooterBtnText}>
                  Finalizar Pedido • R$ {totais.totalFinal.toFixed(2).replace('.', ',')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 1000,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#F1F5F9',
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTag: {
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  headerTagText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: '#708018',
  },
  modalTitle: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
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
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorAlertText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 24,
    gap: 24,
  },

  // SEÇÕES PADRÃO
  sectionBlock: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionStep: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: KipiPalette.icedDenimLight,
    borderWidth: 1.5,
    borderColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionStepText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  sectionTitle: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },

  // SEÇÃO 1: CLIENTE
  clientModeTabs: {
    flexDirection: 'row',
    gap: 10,
  },
  clientModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  clientModeTabActive: {
    backgroundColor: '#EAF3FA',
    borderColor: KipiPalette.icedDenim,
  },
  clientModeTabText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  clientModeTabTextActive: {
    color: KipiPalette.icedDenim,
    fontWeight: '700',
  },
  avulsaNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  avulsaNoticeText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#46500F',
    fontWeight: '500',
  },
  clientSelectArea: {
    position: 'relative',
    zIndex: 10,
  },
  selectedClientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#D4DCED',
    borderRadius: 12,
    padding: 12,
  },
  selectedClientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: KipiPalette.icedDenimLight,
    borderWidth: 1.5,
    borderColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  selectedClientName: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  selectedClientPhone: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
  },
  changeClientBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
  },
  changeClientBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  clientSearchBox: {
    gap: 6,
    position: 'relative',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4DCED',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  clientSearchInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#0F172A',
    outlineWidth: 0,
  },
  clientDropdownList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4DCED',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 4,
  },
  dropdownLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  dropdownLoadingText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  dropdownEmpty: {
    padding: 12,
  },
  dropdownEmptyText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#94A3B8',
  },
  clientDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  clientItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientMiniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientMiniAvatarText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  clientDropdownName: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  clientDropdownPhone: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
  },
  dropdownNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  dropdownNewBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  newClientForm: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#D4DCED',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  newClientTitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldWrap: {
    gap: 5,
  },
  fieldLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#0F172A',
    outlineWidth: 0,
  },
  textInputArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 50,
    outlineWidth: 0,
  },
  newClientActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelNewClientBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelNewClientBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  saveNewClientBtn: {
    backgroundColor: KipiPalette.icedDenim,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  saveNewClientBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // SEÇÃO 2: TIPO DE ENTREGA
  deliveryCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  deliveryCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  deliveryCardActive: {
    backgroundColor: '#EAF3FA',
    borderColor: KipiPalette.icedDenim,
  },
  deliveryCardIconBox: {
    marginBottom: 2,
  },
  deliveryCardTitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  deliveryCardTitleActive: {
    color: KipiPalette.icedDenim,
  },
  deliveryCardDesc: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
  },
  deliveryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F6D8',
    borderRadius: 10,
    padding: 10,
  },
  deliveryNoticeText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#46500F',
    fontWeight: '500',
  },
  deliveryInputsArea: {
    gap: 8,
  },
  sobEncomendaNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EAF3FA',
    borderRadius: 8,
    padding: 8,
  },
  sobEncomendaNoticeText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: KipiPalette.icedDenim,
    fontWeight: '600',
  },

  // SEÇÃO 3: PRODUTOS
  categoryPillsScroll: {
    marginBottom: 4,
  },
  categoryPillsContent: {
    gap: 8,
  },
  catPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
  },
  catPillActive: {
    backgroundColor: KipiPalette.icedDenim,
    borderColor: KipiPalette.icedDenim,
  },
  catPillText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  catPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  productSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4DCED',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  productSearchInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#0F172A',
    outlineWidth: 0,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emptyProductsText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#94A3B8',
    padding: 8,
  },
  productCard: {
    flex: 1,
    minWidth: 190,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  productCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prodCatBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  prodCatBadgeText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  stockBadgeGreen: {
    backgroundColor: '#F1F6D8',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  stockBadgeGreenText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '700',
    color: '#708018',
  },
  stockBadgeBlue: {
    backgroundColor: '#EAF3FA',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  stockBadgeBlueText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  stockBadgeRed: {
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  stockBadgeRedText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  prodName: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  prodPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  prodPrice: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  addProdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: KipiPalette.icedDenim,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  addProdBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  addProdBtnInCart: {
    backgroundColor: '#16A34A',
  },
  addProdBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // CARRINHO DO PEDIDO
  cartSection: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartTitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  clearCartText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  emptyCartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 6,
  },
  emptyCartText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  cartList: {
    gap: 8,
  },
  cartItemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  cartItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cartItemName: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  cartItemCat: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
  },
  removeItemBtn: {
    padding: 4,
  },
  cartItemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 6,
  },
  quantityCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 2,
    gap: 6,
  },
  counterBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    minWidth: 16,
    textAlign: 'center',
  },
  discountToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  discountToggleBtnActive: {
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
  },
  discountToggleBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  discountToggleBtnTextActive: {
    color: '#708018',
  },
  itemPricesCol: {
    alignItems: 'flex-end',
  },
  itemOldPrice: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  itemFinalPrice: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },

  // SEÇÃO 4: PAGAMENTO
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  payMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
  },
  payMethodBtnActive: {
    backgroundColor: '#EAF3FA',
    borderColor: KipiPalette.icedDenim,
  },
  payMethodText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  payMethodTextActive: {
    color: KipiPalette.icedDenim,
    fontWeight: '800',
  },
  paymentStatusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  payStatusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 7,
  },
  payStatusChipActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  payStatusChipPending: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  payStatusText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  payStatusTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  totalsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    gap: 6,
    marginTop: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRowLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  totalRowValue: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  totalRowLabelDiscount: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#708018',
    fontWeight: '600',
  },
  totalRowValueDiscount: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#708018',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  totalRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  totalGrandLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  totalGrandValue: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },

  // FOOTER FIXO
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1.5,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  cancelFooterBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelFooterBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  submitFooterBtn: {
    backgroundColor: KipiPalette.icedDenim,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitFooterBtnDisabled: {
    opacity: 0.7,
  },
  submitFooterBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
