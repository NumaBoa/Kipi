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

export type TipoEntrega = 'retirada' | 'entrega' | 'sob_encomenda';
export type MetodoPagamento = 'pix' | 'cartao' | 'dinheiro' | 'pendente';

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
  { id: 'p12', nome: 'Brownie Fudge Triplo Chocolate', categoria: 'Cookies', preco: 15.50, estoque: 16, tem_promocao: false },
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
  const isDesktop = width >= 960;

  // TAB MOBILE (VITRINE VS COMANDA)
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

  // PRODUTOS & CATÁLOGO
  const [produtos, setProdutos] = useState<ProdutoItem[]>(PRODUTOS_PADRAO);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [buscaProduto, setBuscaProduto] = useState('');

  // CARRINHO DO PEDIDO
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  // PAGAMENTO (PIX, CARTÃO, DINHEIRO OU PENDENTE)
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('pix');

  // SUBMISSÃO & FEEDBACK
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
        setProdutos(data);
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
      setErroForm('Adicione ao menos um produto à comanda');
      return;
    }

    if (!isVendaAvulsa && !clienteSelecionado) {
      setErroForm('Selecione um cliente cadastrado ou clique em Venda Balcão');
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
        <View style={[styles.posContainer, isDesktop ? styles.posDesktop : styles.posMobile]}>

          {/* =========================================================================
              BARRA SUPERIOR COMPACTA E ELEGANTE (SEM SCROLL)
          ========================================================================== */}
          <View style={styles.posHeader}>
            <View style={styles.posHeaderLeft}>
              <View style={styles.posLogoChip}>
                <Text style={styles.posLogoChipText}>KIPI</Text>
              </View>
              <View>
                <Text style={styles.posTitle}>Novo Pedido • Atendimento Balcão</Text>
                <Text style={styles.posSubtitle}>Selecione produtos na vitrine e finalize na comanda</Text>
              </View>
            </View>

            {/* SE MOBILE / TELA MENOR: SWITCH COMPACTO */}
            {!isDesktop && (
              <View style={styles.mobileTabsSwitch}>
                <TouchableOpacity
                  style={[styles.mobileTabBtn, mobileTab === 'vitrine' && styles.mobileTabBtnActive]}
                  onPress={() => setMobileTab('vitrine')}>
                  <Text style={[styles.mobileTabBtnText, mobileTab === 'vitrine' && styles.mobileTabBtnTextActive]}>
                    Vitrine
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.mobileTabBtn, mobileTab === 'comanda' && styles.mobileTabBtnActive]}
                  onPress={() => setMobileTab('comanda')}>
                  <Text style={[styles.mobileTabBtnText, mobileTab === 'comanda' && styles.mobileTabBtnTextActive]}>
                    Comanda ({totais.totalItens})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* ALERTA DE ERRO SE HOUVER */}
          {erroForm && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorBannerText}>{erroForm}</Text>
              <TouchableOpacity onPress={() => setErroForm(null)}>
                <Feather name="x" size={13} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}

          {/* =========================================================================
              CORPO 2 COLUNAS (SPLIT STUDIO - NADA DE SCROLL GIGANTE!)
          ========================================================================== */}
          <View style={styles.posBody}>

            {/* -----------------------------------------------------------------------
                COLUNA 1 (ESQUERDA - 62%): COMANDOS DE ATENDIMENTO + VITRINE COMPACTA
            ------------------------------------------------------------------------ */}
            {(isDesktop || mobileTab === 'vitrine') && (
              <View style={styles.leftVitrineCol}>

                {/* COMANDOS SUPERIORES ULTRA-COMPACTOS: CLIENTE E ATENDIMENTO */}
                <View style={styles.commandStrip}>

                  {/* LINHA 1: CLIENTE + ATENDIMENTO LADO A LADO */}
                  <View style={styles.commandRow}>
                    {/* CLIENTE TOGGLE */}
                    <View style={styles.clientCommandGroup}>
                      <View style={styles.modePillsGroup}>
                        <TouchableOpacity
                          style={[styles.modePill, isVendaAvulsa && styles.modePillActive]}
                          onPress={() => {
                            setIsVendaAvulsa(true);
                            setClienteSelecionado(null);
                            setCriandoNovoCliente(false);
                            setDropdownClienteAberto(false);
                          }}>
                          <Feather name="zap" size={12} color={isVendaAvulsa ? '#FFFFFF' : '#64748B'} />
                          <Text style={[styles.modePillText, isVendaAvulsa && styles.modePillTextActive]}>
                            Balcão Avulso
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.modePill, !isVendaAvulsa && styles.modePillActive]}
                          onPress={() => {
                            setIsVendaAvulsa(false);
                            setDropdownClienteAberto(true);
                          }}>
                          <Feather name="user" size={12} color={!isVendaAvulsa ? '#FFFFFF' : '#64748B'} />
                          <Text style={[styles.modePillText, !isVendaAvulsa && styles.modePillTextActive]}>
                            {clienteSelecionado ? clienteSelecionado.nome.split(' ')[0] : 'Cliente VIP ▾'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* ATENDIMENTO SEGMENTADO */}
                    <View style={styles.deliverySegmentGroup}>
                      {[
                        { id: 'retirada', label: 'Retirada', icon: 'shopping-bag' },
                        { id: 'entrega', label: 'Delivery', icon: 'truck' },
                        { id: 'sob_encomenda', label: 'Encomenda', icon: 'calendar' },
                      ].map((t) => (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.deliverySegmentBtn, tipoEntrega === t.id && styles.deliverySegmentBtnActive]}
                          onPress={() => setTipoEntrega(t.id as any)}>
                          <Feather
                            name={t.icon as any}
                            size={12}
                            color={tipoEntrega === t.id ? KipiPalette.icedDenim : '#64748B'}
                          />
                          <Text style={[styles.deliverySegmentText, tipoEntrega === t.id && styles.deliverySegmentTextActive]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* LINHA CONDICIONAL: SE CLIENTE CADASTRADO OU AGENDAMENTO ATIVO */}
                  {(!isVendaAvulsa || tipoEntrega !== 'retirada') && (
                    <View style={styles.secondaryCommandRow}>
                      {!isVendaAvulsa && (
                        <View style={styles.clientInlineSearchWrap}>
                          {clienteSelecionado ? (
                            <View style={styles.clientPickedBadge}>
                              <Text style={styles.clientPickedName} numberOfLines={1}>
                                👤 {clienteSelecionado.nome} {clienteSelecionado.telefone ? `(${clienteSelecionado.telefone})` : ''}
                              </Text>
                              <TouchableOpacity onPress={() => setClienteSelecionado(null)}>
                                <Text style={styles.clientChangeText}>Trocar</Text>
                              </TouchableOpacity>
                            </View>
                          ) : criandoNovoCliente ? (
                            <View style={styles.quickNewClientRow}>
                              <TextInput
                                style={[styles.quickInput, { flex: 1.2 }]}
                                placeholder="Nome completo *"
                                placeholderTextColor="#94A3B8"
                                value={novoClienteNome}
                                onChangeText={setNovoClienteNome}
                              />
                              <TextInput
                                style={[styles.quickInput, { flex: 0.8 }]}
                                placeholder="WhatsApp"
                                placeholderTextColor="#94A3B8"
                                value={novoClienteTelefone}
                                onChangeText={setNovoClienteTelefone}
                              />
                              <TouchableOpacity style={styles.btnQuickSave} onPress={handleCadastrarCliente}>
                                <Text style={styles.btnQuickSaveText}>Salvar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => setCriandoNovoCliente(false)}>
                                <Feather name="x" size={14} color="#64748B" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={{ flex: 1, position: 'relative' }}>
                              <View style={styles.clientSearchMiniField}>
                                <Feather name="search" size={13} color="#94A3B8" />
                                <TextInput
                                  style={styles.clientSearchMiniInput}
                                  placeholder="Digite nome ou celular do cliente..."
                                  placeholderTextColor="#94A3B8"
                                  value={buscaCliente}
                                  onChangeText={(t) => {
                                    setBuscaCliente(t);
                                    setDropdownClienteAberto(true);
                                  }}
                                  onFocus={() => setDropdownClienteAberto(true)}
                                />
                                <TouchableOpacity onPress={() => setCriandoNovoCliente(true)}>
                                  <Text style={styles.quickAddLinkText}>+ Novo</Text>
                                </TouchableOpacity>
                              </View>

                              {dropdownClienteAberto && (
                                <View style={styles.clientFloatingList}>
                                  <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                                    {clientesFiltrados.map((cli) => (
                                      <TouchableOpacity
                                        key={cli.id}
                                        style={styles.clientFloatingItem}
                                        onPress={() => {
                                          setClienteSelecionado(cli);
                                          setDropdownClienteAberto(false);
                                          setBuscaCliente('');
                                        }}>
                                        <Text style={styles.clientFloatingName}>{cli.nome}</Text>
                                        <Text style={styles.clientFloatingPhone}>{cli.telefone || 'Sem fone'}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}

                      {tipoEntrega !== 'retirada' && (
                        <View style={styles.deliveryDateTimeGroup}>
                          <Text style={styles.scheduleMiniLabel}>Previsão:</Text>
                          <TextInput
                            style={styles.scheduleMiniInput}
                            value={dataEntrega}
                            onChangeText={setDataEntrega}
                            placeholder="AAAA-MM-DD"
                          />
                          <TextInput
                            style={[styles.scheduleMiniInput, { width: 55 }]}
                            value={horarioEntrega}
                            onChangeText={setHorarioEntrega}
                            placeholder="14:00"
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* LINHA 2: PESQUISA DE PRODUTO + CATEGORIAS */}
                  <View style={styles.filterBarRow}>
                    <View style={styles.searchProductCompact}>
                      <Feather name="search" size={13} color="#94A3B8" />
                      <TextInput
                        style={styles.searchProductCompactInput}
                        placeholder="Buscar por sabor, nome..."
                        placeholderTextColor="#94A3B8"
                        value={buscaProduto}
                        onChangeText={setBuscaProduto}
                      />
                      {buscaProduto ? (
                        <TouchableOpacity onPress={() => setBuscaProduto('')}>
                          <Feather name="x" size={13} color="#94A3B8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.catPillsContainer}>
                      {categorias.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.catChip, categoriaAtiva === cat && styles.catChipActive]}
                          onPress={() => setCategoriaAtiva(cat)}>
                          <Text style={[styles.catChipText, categoriaAtiva === cat && styles.catChipTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                </View>

                {/* VITRINE DE PRODUTOS COMPACTA (CARDS MENORES, SEM SCROLL GIGANTE) */}
                <ScrollView
                  style={styles.vitrineScroll}
                  contentContainerStyle={styles.vitrineGrid}
                  showsVerticalScrollIndicator={true}>
                  {carregandoProdutos ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="small" color={KipiPalette.icedDenim} />
                    </View>
                  ) : produtosFiltrados.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>Nenhum produto encontrado nesta busca.</Text>
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
                            styles.compactProdTile,
                            isDesktop ? styles.compactProdTile3Col : styles.compactProdTile2Col,
                            noCarrinho && styles.compactProdTileInCart,
                            !permiteAdicionar && styles.compactProdTileDisabled,
                          ]}
                          onPress={() => permiteAdicionar && adicionarAoCarrinho(prod)}
                          activeOpacity={0.75}
                          disabled={!permiteAdicionar}>

                          {/* CORPO DO CARD COMPACTO */}
                          <View style={styles.tileHeaderRow}>
                            <Text style={styles.tileCatTag} numberOfLines={1}>
                              {prod.categoria}
                            </Text>

                            {emEstoque ? (
                              <View style={styles.tileStockBadgeGreen}>
                                <Text style={styles.tileStockTextGreen}>● {prod.estoque} un</Text>
                              </View>
                            ) : tipoEntrega === 'sob_encomenda' ? (
                              <View style={styles.tileStockBadgeBlue}>
                                <Text style={styles.tileStockTextBlue}>★ Encomenda</Text>
                              </View>
                            ) : (
                              <View style={styles.tileStockBadgeRed}>
                                <Text style={styles.tileStockTextRed}>✕ Esgotado</Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.tileTitle} numberOfLines={2}>
                            {prod.nome}
                          </Text>

                          <View style={styles.tileFooterRow}>
                            <Text style={styles.tilePrice}>
                              R$ {prod.preco.toFixed(2)}
                            </Text>

                            {noCarrinho ? (
                              <View style={styles.tileCartBadge}>
                                <Text style={styles.tileCartBadgeText}>
                                  {noCarrinho.quantidade}x
                                </Text>
                              </View>
                            ) : (
                              <View style={[styles.tileAddPlus, !permiteAdicionar && { backgroundColor: '#CBD5E1' }]}>
                                <Feather name="plus" size={13} color="#FFFFFF" />
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
                COLUNA 2 (DIREITA - 38%): COMANDA DO PEDIDO + PAGAMENTO SIMPLIFICADO
            ------------------------------------------------------------------------ */}
            {(isDesktop || mobileTab === 'comanda') && (
              <View style={styles.rightComandaCol}>

                {/* CABEÇALHO DA COMANDA */}
                <View style={styles.comandaHeader}>
                  <View style={styles.comandaTitleRow}>
                    <Feather name="shopping-bag" size={16} color={KipiPalette.icedDenim} />
                    <Text style={styles.comandaTitle}>Comanda do Pedido</Text>
                    <View style={styles.comandaCountBadge}>
                      <Text style={styles.comandaCountText}>{totais.totalItens} un.</Text>
                    </View>
                  </View>

                  {carrinho.length > 0 && (
                    <TouchableOpacity onPress={() => setCarrinho([])}>
                      <Text style={styles.comandaClearText}>Limpar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* ITENS DA COMANDA (SCROLL DEDICADO) */}
                <ScrollView
                  style={styles.comandaScroll}
                  contentContainerStyle={styles.comandaItemsContent}
                  showsVerticalScrollIndicator={true}>
                  {carrinho.length === 0 ? (
                    <View style={styles.emptyComandaBox}>
                      <Feather name="shopping-cart" size={26} color="#94A3B8" />
                      <Text style={styles.emptyComandaTitle}>Comanda vazia</Text>
                      <Text style={styles.emptyComandaSub}>
                        Toque nos produtos ao lado para adicionar ao pedido.
                      </Text>
                    </View>
                  ) : (
                    carrinho.map((item) => {
                      const precoUnit = item.produto.preco;
                      const precoCobrado = item.temDesconto
                        ? Math.max(0, precoUnit - item.valorDescontoUnitario)
                        : precoUnit;
                      const subtotalItem = precoCobrado * item.quantidade;

                      return (
                        <View key={item.produto.id} style={styles.cartCardCompact}>
                          <View style={styles.cartCardTop}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.cartCardName} numberOfLines={1}>{item.produto.nome}</Text>
                              <Text style={styles.cartCardSub}>
                                {item.produto.categoria} • R$ {precoUnit.toFixed(2)} un.
                              </Text>
                            </View>

                            <TouchableOpacity
                              onPress={() => removerDoCarrinho(item.produto.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                              <Feather name="x" size={14} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.cartCardBottom}>
                            {/* STEPPER */}
                            <View style={styles.miniStepper}>
                              <TouchableOpacity
                                style={styles.miniStepperBtn}
                                onPress={() => alterarQuantidade(item.produto.id, -1)}>
                                <Feather name="minus" size={11} color="#475569" />
                              </TouchableOpacity>
                              <Text style={styles.miniStepperValue}>{item.quantidade}</Text>
                              <TouchableOpacity
                                style={styles.miniStepperBtn}
                                onPress={() => alterarQuantidade(item.produto.id, 1)}>
                                <Feather name="plus" size={11} color="#475569" />
                              </TouchableOpacity>
                            </View>

                            {/* TOGGLE DESCONTO */}
                            <TouchableOpacity
                              style={[styles.btnMiniDesconto, item.temDesconto && styles.btnMiniDescontoActive]}
                              onPress={() => alternarDescontoItem(item.produto.id)}>
                              <Feather
                                name="percent"
                                size={11}
                                color={item.temDesconto ? '#708018' : '#64748B'}
                              />
                              <Text style={[styles.btnMiniDescontoText, item.temDesconto && styles.btnMiniDescontoTextActive]}>
                                {item.temDesconto
                                  ? `-R$ ${(item.valorDescontoUnitario * item.quantidade).toFixed(2)}`
                                  : 'Desconto'}
                              </Text>
                            </TouchableOpacity>

                            {/* TOTAL DO ITEM */}
                            <Text style={styles.cartCardItemTotal}>
                              R$ {subtotalItem.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                {/* PAINEL FIXO DE FECHAMENTO (PAGAMENTO SIMPLIFICADO EM 4 PILAS) */}
                <View style={styles.comandaFooter}>

                  {/* OBSERVAÇÃO COMPACTA */}
                  <View style={styles.obsFieldRow}>
                    <Feather name="edit-2" size={12} color="#94A3B8" />
                    <TextInput
                      style={styles.obsInputField}
                      placeholder="Observações do pedido (ex: laço rosa)..."
                      placeholderTextColor="#94A3B8"
                      value={observacoes}
                      onChangeText={setObservacoes}
                    />
                  </View>

                  {/* PAGAMENTO SIMPLIFICADO: PIX, CARTÃO, DINHEIRO OU PENDENTE (SOLICITADO PELO USUÁRIO) */}
                  <View style={styles.payMethodsGrid}>
                    {[
                      { id: 'pix', label: 'Pix', icon: 'zap' },
                      { id: 'cartao', label: 'Cartão', icon: 'credit-card' },
                      { id: 'dinheiro', label: 'Dinheiro', icon: 'dollar-sign' },
                      { id: 'pendente', label: 'Pendente', icon: 'clock' },
                    ].map((opt) => {
                      const ativo = metodoPagamento === opt.id;
                      const isPendente = opt.id === 'pendente';
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.payPill,
                            ativo && (isPendente ? styles.payPillPendenteActive : styles.payPillActive),
                          ]}
                          onPress={() => setMetodoPagamento(opt.id as any)}>
                          <Feather
                            name={opt.icon as any}
                            size={12}
                            color={ativo ? '#FFFFFF' : isPendente ? '#DC2626' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.payPillText,
                              ativo && styles.payPillTextActive,
                              isPendente && !ativo && { color: '#DC2626' },
                            ]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* RESUMO DE TOTAIS */}
                  <View style={styles.totalsStrip}>
                    <View style={styles.totalLine}>
                      <Text style={styles.totalLabel}>Subtotal</Text>
                      <Text style={styles.totalVal}>R$ {totais.subtotal.toFixed(2)}</Text>
                    </View>

                    {totais.descontoTotal > 0 && (
                      <View style={styles.totalLine}>
                        <Text style={[styles.totalLabel, { color: '#708018', fontWeight: '700' }]}>Descontos</Text>
                        <Text style={[styles.totalVal, { color: '#708018', fontWeight: '700' }]}>
                          - R$ {totais.descontoTotal.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.totalDivider} />

                    <View style={styles.grandTotalLine}>
                      <View>
                        <Text style={styles.grandTotalLabel}>TOTAL DO PEDIDO</Text>
                        <Text style={styles.grandTotalHint}>
                          {metodoPagamento === 'pendente' ? '⏳ Pagar na entrega' : `✓ Quitado via ${metodoPagamento.toUpperCase()}`}
                        </Text>
                      </View>
                      <Text style={styles.grandTotalValue}>
                        R$ {totais.totalFinal.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* BOTÃO PRINCIPAL DE FINALIZAÇÃO */}
                  <TouchableOpacity
                    style={[
                      styles.btnFinalizar,
                      carrinho.length === 0 && { backgroundColor: '#CBD5E1' },
                    ]}
                    onPress={handleFinalizarPedido}
                    disabled={salvandoPedido || carrinho.length === 0}
                    activeOpacity={0.85}>
                    {salvandoPedido ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Feather name="check-circle" size={15} color="#FFFFFF" />
                        <Text style={styles.btnFinalizarText}>
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
// FOLHA DE ESTILOS MODERNA (COMPACTA, RESPONSIVA E DE ALTA FIDELIDADE)
// ============================================================================

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    zIndex: 1000,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
      },
    }),
  },
  posContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.25)',
      },
    }),
  },
  posDesktop: {
    width: '95%',
    maxWidth: 1080,
    height: '88%',
    maxHeight: 780,
  },
  posMobile: {
    width: '100%',
    height: '94%',
  },

  // CABEÇALHO DO MODAL
  posHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  posHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  posLogoChip: {
    backgroundColor: KipiPalette.icedDenim,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  posLogoChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  posTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  posSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  mobileTabsSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    gap: 4,
  },
  mobileTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  mobileTabBtnActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  mobileTabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  mobileTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },

  // CORPO 2 COLUNAS
  posBody: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },

  // COLUNA ESQUERDA (62%): VITRINE & CONTROLES
  leftVitrineCol: {
    flex: 0.62,
    borderRightWidth: 1.5,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
  },
  commandStrip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFCFE',
    gap: 8,
  },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  clientCommandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modePillsGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    gap: 4,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  modePillActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  modePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  deliverySegmentGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    gap: 4,
  },
  deliverySegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
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
  secondaryCommandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 4,
  },
  clientInlineSearchWrap: {
    flex: 1,
  },
  clientPickedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  clientPickedName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  clientChangeText: {
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  quickNewClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    color: '#0F172A',
  },
  btnQuickSave: {
    backgroundColor: KipiPalette.icedDenim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnQuickSaveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clientSearchMiniField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  clientSearchMiniInput: {
    flex: 1,
    fontSize: 11,
    color: '#0F172A',
    padding: 0,
    outlineWidth: 0,
  },
  quickAddLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenim,
  },
  clientFloatingList: {
    position: 'absolute',
    top: 32,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    zIndex: 999,
  },
  clientFloatingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  clientFloatingName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  clientFloatingPhone: {
    fontSize: 10,
    color: '#64748B',
  },
  deliveryDateTimeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleMiniLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  scheduleMiniInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 11,
    color: '#0F172A',
    width: 85,
  },

  // LINHA DE BUSCA DE PRODUTO + CATEGORIAS
  filterBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchProductCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 170,
    gap: 6,
  },
  searchProductCompactInput: {
    flex: 1,
    fontSize: 11,
    color: '#0F172A',
    padding: 0,
    outlineWidth: 0,
  },
  catPillsContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  catChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  catChipActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // VITRINE GRID DE CARDS COMPACTOS (MENOS SCROLL!)
  vitrineScroll: {
    flex: 1,
  },
  vitrineGrid: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  loadingBox: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
  },
  emptyBox: {
    width: '100%',
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
  },
  compactProdTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 9,
    gap: 4,
    justifyContent: 'space-between',
    minHeight: 74,
  },
  compactProdTile3Col: {
    width: '31.8%',
  },
  compactProdTile2Col: {
    width: '48.5%',
  },
  compactProdTileInCart: {
    borderColor: KipiPalette.icedDenim,
    backgroundColor: '#F9FCFF',
  },
  compactProdTileDisabled: {
    opacity: 0.45,
  },
  tileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileCatTag: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  tileStockBadgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tileStockTextGreen: {
    fontSize: 8,
    fontWeight: '700',
    color: '#16A34A',
  },
  tileStockBadgeBlue: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tileStockTextBlue: {
    fontSize: 8,
    fontWeight: '700',
    color: '#0284C7',
  },
  tileStockBadgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tileStockTextRed: {
    fontSize: 8,
    fontWeight: '700',
    color: '#DC2626',
  },
  tileTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Fonts.sans,
    lineHeight: 15,
  },
  tileFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  tilePrice: {
    fontSize: 12,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
    fontFamily: Fonts.sans,
  },
  tileCartBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tileCartBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
  },
  tileAddPlus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: KipiPalette.icedDenim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // COLUNA DIREITA (38%): COMANDA & FECHAMENTO
  rightComandaCol: {
    flex: 0.38,
    flexDirection: 'column',
    backgroundColor: '#F8FAFC',
  },
  comandaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  comandaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comandaTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Fonts.sans,
  },
  comandaCountBadge: {
    backgroundColor: '#EAF3FA',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  comandaCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  comandaClearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  comandaScroll: {
    flex: 1,
  },
  comandaItemsContent: {
    padding: 10,
    gap: 6,
  },
  emptyComandaBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyComandaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyComandaSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  cartCardCompact: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    gap: 6,
  },
  cartCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cartCardName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  cartCardSub: {
    fontSize: 9,
    color: '#64748B',
  },
  cartCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
  },
  miniStepperBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  miniStepperValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    minWidth: 16,
    textAlign: 'center',
  },
  btnMiniDesconto: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  btnMiniDescontoActive: {
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1,
  },
  btnMiniDescontoText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
  },
  btnMiniDescontoTextActive: {
    color: '#708018',
    fontWeight: '700',
  },
  cartCardItemTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  // FOOTER DA COMANDA
  comandaFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  obsFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  obsInputField: {
    flex: 1,
    fontSize: 10,
    color: '#0F172A',
    padding: 0,
    outlineWidth: 0,
  },

  // PAGAMENTO EM 4 PILAS SIMPLIFICADAS
  payMethodsGrid: {
    flexDirection: 'row',
    gap: 4,
  },
  payPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  payPillActive: {
    backgroundColor: KipiPalette.icedDenim,
  },
  payPillPendenteActive: {
    backgroundColor: '#DC2626',
  },
  payPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  payPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // RESUMO DE TOTAIS
  totalsStrip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    gap: 2,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  totalVal: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0F172A',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  grandTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  grandTotalHint: {
    fontSize: 9,
    color: '#64748B',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
    fontFamily: Fonts.sans,
  },

  // BOTÃO FINALIZAR
  btnFinalizar: {
    backgroundColor: KipiPalette.icedDenim,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 3px 10px rgba(87, 152, 215, 0.3)',
      },
    }),
  },
  btnFinalizarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
});
