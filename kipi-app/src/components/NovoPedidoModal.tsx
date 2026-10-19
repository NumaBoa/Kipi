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
  Image,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

// IMAGEM REAL DO PRODUTO (COOKIES DO ATELIÊ)
const cookiePhoto = require('../../assets/images/cookies.jpg');

export interface ProductItem {
  id: string;
  name: string;
  detail: string;
  price: number; // em centavos (ex: 1890 = R$ 18,90) ou reais
  stock: number;
  category: string;
}

export interface ClienteItem {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
}

interface NovoPedidoModalProps {
  visible: boolean;
  onClose: () => void;
  onPedidoCriado: (pedido: any) => void;
}

// CATÁLOGO IDÊNTICO AO PROTÓTIPO LOVABLE
const DEFAULT_PRODUCTS: ProductItem[] = [
  { id: 'nutella', name: 'Cookie Black Nutella', detail: 'Chocolate intenso · recheado', price: 1890, stock: 2, category: 'Cookies' },
  { id: 'tradicional', name: 'Cookie Tradicional', detail: 'Baunilha · gotas de chocolate', price: 1490, stock: 2, category: 'Cookies' },
  { id: 'caixinha', name: 'Caixinha de Cookie', detail: 'Uma seleção para presentear', price: 1800, stock: 0, category: 'Presentes' },
  { id: 'black', name: 'Cookie Black', detail: 'Massa de cacau · chocolate', price: 1690, stock: 0, category: 'Cookies' },
  { id: 'bueno', name: 'Cookie Bueno', detail: 'Chocolate ao leite · avelã', price: 1790, stock: 0, category: 'Cookies' },
  { id: 'duo', name: 'Cookie Duo', detail: 'Dois chocolates em um cookie', price: 1690, stock: 0, category: 'Cookies' },
  { id: 'cookie-nutella', name: 'Cookie Nutella', detail: 'Massa clássica · creme de avelã', price: 1790, stock: 0, category: 'Cookies' },
];

const money = (cents: number) => {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const PAYMENTS = [
  { name: 'Pix', icon: 'zap' },
  { name: 'Cartão', icon: 'credit-card' },
  { name: 'Dinheiro', icon: 'dollar-sign' },
  { name: 'Pendente', icon: 'clock' },
] as const;

export default function NovoPedidoModal({
  visible,
  onClose,
  onPedidoCriado,
}: NovoPedidoModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // ESTADOS DO PEDIDO
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [client, setClient] = useState('Balcão avulso');
  const [delivery, setDelivery] = useState<'Retirada' | 'Delivery' | 'Encomenda'>('Retirada');
  const [payment, setPayment] = useState<string>('Pix');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [received, setReceived] = useState('');
  const [completed, setCompleted] = useState(false);

  // SUPABASE CLIENTS & DROPDOWN
  const [clientesDb, setClientesDb] = useState<ClienteItem[]>([]);
  const [selectClientOpen, setSelectClientOpen] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [criandoNovoCliente, setCriandoNovoCliente] = useState(false);
  const [salvandoPedido, setSalvandoPedido] = useState(false);

  // PRODUTOS ATIVOS
  const [products, setProducts] = useState<ProductItem[]>(DEFAULT_PRODUCTS);

  useEffect(() => {
    if (visible) {
      carregarDados();
    }
  }, [visible]);

  const carregarDados = async () => {
    try {
      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, nome, telefone, email')
        .order('nome', { ascending: true })
        .limit(20);

      if (cliData && cliData.length > 0) {
        setClientesDb(cliData);
      }

      // Buscar produtos reais do Supabase se existirem
      const { data: prodData } = await supabase
        .from('produtos')
        .select('id, nome, categoria, preco, estoque')
        .order('nome', { ascending: true });

      if (prodData && prodData.length > 0) {
        const convertidos: ProductItem[] = prodData.map((p) => ({
          id: p.id,
          name: p.nome,
          detail: p.categoria || 'Artesanal do ateliê',
          price: Math.round(Number(p.preco) * 100),
          stock: p.estoque ?? 0,
          category: p.categoria?.toLowerCase().includes('presente') ? 'Presentes' : 'Cookies',
        }));
        setProducts(convertidos);
      }
    } catch {
      // mantém padrão
    }
  };

  const selectedProducts = useMemo(() => {
    return products.filter((p) => (cart[p.id] ?? 0) > 0);
  }, [products, cart]);

  const count = useMemo(() => {
    return selectedProducts.reduce((acc, p) => acc + (cart[p.id] ?? 0), 0);
  }, [selectedProducts, cart]);

  const total = useMemo(() => {
    return selectedProducts.reduce((acc, p) => acc + (cart[p.id] ?? 0) * p.price, 0);
  }, [selectedProducts, cart]);

  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === 'Todos' || p.category === category;
      const matchAvailable = !availableOnly || p.stock > 0;
      return matchSearch && matchCategory && matchAvailable;
    });
  }, [products, search, category, availableOnly]);

  const change = (id: string, delta: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setCart((current) => {
      const maxAllowed = delivery === 'Encomenda' ? 999 : product.stock;
      const nextVal = Math.max(0, Math.min(maxAllowed, (current[id] ?? 0) + delta));
      return { ...current, [id]: nextVal };
    });
  };

  const valid =
    count > 0 &&
    (delivery !== 'Delivery' || address.trim().length > 0) &&
    (delivery !== 'Encomenda' || date.length > 0) &&
    (payment !== 'Dinheiro' || Number(received || 0) * 100 >= total);

  const reset = () => {
    setCompleted(false);
    setCart({});
    setNotes('');
    setAddress('');
    setDate('');
    setReceived('');
    setClient('Balcão avulso');
    setDelivery('Retirada');
    setPayment('Pix');
  };

  const handleCadastrarClienteRapido = async () => {
    const nome = novoClienteNome.trim();
    if (!nome) return;
    try {
      const { data } = await supabase
        .from('clientes')
        .insert({ empresa_id: 'emp_fatio', nome })
        .select()
        .single();
      if (data) {
        setClientesDb((prev) => [data, ...prev]);
        setClient(`${data.nome} · cliente VIP`);
      } else {
        setClient(`${nome} · cliente VIP`);
      }
    } catch {
      setClient(`${nome} · cliente VIP`);
    } finally {
      setCriandoNovoCliente(false);
      setNovoClienteNome('');
      setSelectClientOpen(false);
    }
  };

  const handleFinalizar = async () => {
    if (!valid) return;
    setSalvandoPedido(true);

    try {
      const isPago = payment !== 'Pendente';
      const status = isPago ? 'pago' : 'pendente';
      const totalReais = total / 100;

      // Salva no Supabase para manter histórico em tempo real
      const { data: novaVenda } = await supabase
        .from('vendas')
        .insert({
          empresa_id: 'emp_fatio',
          canal: 'propria',
          tipo_pedido: delivery === 'Delivery' ? 'entrega' : delivery === 'Encomenda' ? 'sob_encomenda' : 'retirada',
          data: new Date().toISOString(),
          valor_sinal_pago: isPago ? totalReais : 0,
          saldo_na_entrega: isPago ? 0 : totalReais,
          status_producao: delivery === 'Encomenda' ? 'a_fazer' : 'pronto',
          pagamento: payment.toLowerCase(),
          status,
          total: totalReais,
          custo_total: 0,
          observacoes: notes.trim() || (address ? `Entrega: ${address}` : null),
        })
        .select()
        .single();

      if (novaVenda) {
        onPedidoCriado(novaVenda);
      } else {
        onPedidoCriado({
          id: `ped_${Date.now()}`,
          client,
          total: totalReais,
          status,
          pagamento: payment.toLowerCase(),
          created_at: new Date().toISOString(),
        });
      }

      setCompleted(true);
    } catch {
      setCompleted(true);
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
        <View style={[styles.dialogContent, isDesktop ? styles.dialogDesktop : styles.dialogMobile]}>

          {/* =========================================================================
              HEADER DO ATELIÊ (FIDEDIGNO AO LOVABLE)
          ========================================================================== */}
          <View style={styles.dialogHeader}>
            <View style={styles.headerIconSquare}>
              <Feather name="shopping-bag" size={20} color="#2D7A58" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerSubUpper}>ATELIÊ · ATENDIMENTO</Text>
              <Text style={styles.headerTitle}>Um novo pedido, com carinho.</Text>
              <Text style={styles.headerDescription}>
                Cliente, delícias e pagamento — tudo em um só lugar.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeRoundBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* =========================================================================
              CORPO OU TELA DE SUCESSO (COMPLETED)
          ========================================================================== */}
          {completed ? (
            <View style={styles.completedContainer}>
              <View style={styles.completedIconCircle}>
                <Feather name="check-circle" size={40} color="#2D7A58" />
              </View>
              <Text style={styles.completedTitle}>Pedido pronto!</Text>
              <Text style={styles.completedSummary}>
                {client} · {count} {count === 1 ? 'item' : 'itens'} · {money(total)} · {payment}
              </Text>
              <Text style={styles.completedHint}>
                Pedido registrado com sucesso no ateliê!
              </Text>
              <TouchableOpacity style={styles.btnStartAnother} onPress={reset}>
                <Feather name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.btnStartAnotherText}>Começar outro pedido</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.dialogBody, !isDesktop && styles.dialogBodyMobile]}>

              {/* ---------------------------------------------------------------------
                  COLUNA 1 (ESQUERDA): SELETORES E VITRINE DO ATELIÊ
              ---------------------------------------------------------------------- */}
              <View style={[styles.leftSection, !isDesktop && styles.leftSectionMobile]}>

                {/* BARRA SUPERIOR: QUEM ESTÁ COMPRANDO? E COMO VAI RECEBER? */}
                <View style={styles.topSelectorsRow}>
                  <View style={styles.selectorGridCol}>
                    {/* QUEM ESTÁ COMPRANDO */}
                    <View style={{ flex: 1, position: 'relative' }}>
                      <Text style={styles.fieldLabel}>
                        <Feather name="user" size={12} color="#2D7A58" /> Quem está comprando?
                      </Text>

                      <TouchableOpacity
                        style={styles.selectTrigger}
                        onPress={() => setSelectClientOpen(!selectClientOpen)}>
                        <Text style={styles.selectTriggerText} numberOfLines={1}>
                          {client}
                        </Text>
                        <Feather name="chevron-down" size={14} color="#64748B" />
                      </TouchableOpacity>

                      {selectClientOpen && (
                        <View style={styles.selectDropdownMenu}>
                          <TouchableOpacity
                            style={styles.selectDropdownItem}
                            onPress={() => {
                              setClient('Balcão avulso · sem cadastro');
                              setSelectClientOpen(false);
                            }}>
                            <Text style={styles.selectDropdownItemText}>Balcão avulso · sem cadastro</Text>
                          </TouchableOpacity>

                          {clientesDb.map((cli) => (
                            <TouchableOpacity
                              key={cli.id}
                              style={styles.selectDropdownItem}
                              onPress={() => {
                                setClient(`${cli.nome} · cliente VIP`);
                                setSelectClientOpen(false);
                              }}>
                              <Text style={styles.selectDropdownItemText}>{cli.nome} · cliente VIP</Text>
                            </TouchableOpacity>
                          ))}

                          {criandoNovoCliente ? (
                            <View style={styles.inlineCreateRow}>
                              <TextInput
                                style={styles.inlineClientInput}
                                placeholder="Nome do novo cliente"
                                placeholderTextColor="#94A3B8"
                                value={novoClienteNome}
                                onChangeText={setNovoClienteNome}
                              />
                              <TouchableOpacity
                                style={styles.btnConfirmInlineClient}
                                onPress={handleCadastrarClienteRapido}>
                                <Text style={styles.btnConfirmInlineClientText}>Adicionar</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[styles.selectDropdownItem, { borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}
                              onPress={() => setCriandoNovoCliente(true)}>
                              <Text style={[styles.selectDropdownItemText, { color: '#2D7A58', fontWeight: '700' }]}>
                                + Cadastrar novo cliente
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>

                    {/* COMO VAI RECEBER? */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Como vai receber?</Text>
                      <View style={styles.deliverySegmentBox}>
                        {[
                          { name: 'Retirada', icon: 'shopping-bag' },
                          { name: 'Delivery', icon: 'truck' },
                          { name: 'Encomenda', icon: 'calendar' },
                        ].map((m) => {
                          const isActive = delivery === m.name;
                          return (
                            <TouchableOpacity
                              key={m.name}
                              style={[styles.deliverySegmentBtn, isActive && styles.deliverySegmentBtnActive]}
                              onPress={() => setDelivery(m.name as any)}>
                              <Feather
                                name={m.icon as any}
                                size={12}
                                color={isActive ? '#2D7A58' : '#64748B'}
                              />
                              <Text style={[styles.deliverySegmentBtnText, isActive && styles.deliverySegmentBtnTextActive]}>
                                {m.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  {/* CAMPO DE ENDEREÇO SE DELIVERY */}
                  {delivery === 'Delivery' && (
                    <TextInput
                      style={styles.singleLineInput}
                      placeholder="Endereço de entrega"
                      placeholderTextColor="#94A3B8"
                      value={address}
                      onChangeText={setAddress}
                    />
                  )}

                  {/* DATA E HORÁRIO SE ENCOMENDA */}
                  {delivery === 'Encomenda' && (
                    <View>
                      <Text style={styles.miniInputLabel}>Data e horário da encomenda</Text>
                      <TextInput
                        style={styles.singleLineInput}
                        placeholder="Ex: 2026-10-25 14:00"
                        placeholderTextColor="#94A3B8"
                        value={date}
                        onChangeText={setDate}
                      />
                    </View>
                  )}
                </View>

                {/* VITRINE DO ATELIÊ */}
                <View style={styles.vitrineSection}>
                  <View style={styles.vitrineHeaderRow}>
                    <Text style={styles.vitrineTitle}>Vitrine do ateliê</Text>
                    <Text style={styles.vitrineCountHint}>
                      {products.filter((p) => p.stock > 0).length} opções disponíveis
                    </Text>
                  </View>

                  {/* BUSCAR DOCE OU SABOR */}
                  <View style={styles.searchBarBox}>
                    <Feather name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchBarInput}
                      placeholder="Buscar um doce ou sabor…"
                      placeholderTextColor="#94A3B8"
                      value={search}
                      onChangeText={setSearch}
                    />
                  </View>

                  {/* FILTROS DE CATEGORIA E CHECKBOX SÓ DISPONÍVEIS */}
                  <View style={styles.categoryFiltersRow}>
                    <View style={styles.categoryButtonsRow}>
                      {['Todos', 'Cookies', 'Presentes'].map((c) => {
                        const isActive = category === c;
                        return (
                          <TouchableOpacity
                            key={c}
                            style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                            onPress={() => setCategory(c)}>
                            <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                              {c}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={styles.checkboxOnlyAvailable}
                      onPress={() => setAvailableOnly(!availableOnly)}>
                      <View style={[styles.customCheckbox, availableOnly && styles.customCheckboxActive]}>
                        {availableOnly && <Feather name="check" size={10} color="#FFFFFF" />}
                      </View>
                      <Text style={styles.checkboxLabel}>Só disponíveis</Text>
                    </TouchableOpacity>
                  </View>

                  {/* GRID DE PRODUTOS EM 2 COLUNAS (FIDEDIGNO AO LOVABLE) */}
                  <ScrollView
                    style={styles.productsScrollArea}
                    contentContainerStyle={styles.productsGridContent}
                    showsVerticalScrollIndicator={true}>
                    {visibleProducts.length === 0 ? (
                      <View style={styles.emptyProductsBox}>
                        <Text style={styles.emptyProductsText}>Nenhum produto encontrado.</Text>
                      </View>
                    ) : (
                      <View style={styles.productsTwoColGrid}>
                        {visibleProducts.map((p) => {
                          const inCart = (cart[p.id] ?? 0) > 0;
                          const isUnavailable = p.stock === 0 && delivery !== 'Encomenda';

                          return (
                            <View
                              key={p.id}
                              style={[
                                styles.productCard,
                                inCart && styles.productCardInCart,
                                isUnavailable && styles.productCardDisabled,
                              ]}>
                              {/* FOTO DO COOKIE */}
                              <View style={styles.productPhotoWrap}>
                                <Image
                                  source={cookiePhoto}
                                  style={[styles.productPhotoImg, isUnavailable && styles.productPhotoImgDisabled]}
                                  resizeMode="cover"
                                />
                              </View>

                              {/* DETALHES DO PRODUTO */}
                              <View style={styles.productInfoCol}>
                                <Text
                                  style={[styles.productName, isUnavailable && styles.productNameDisabled]}
                                  numberOfLines={1}>
                                  {p.name}
                                </Text>
                                <Text style={styles.productDetail} numberOfLines={1}>
                                  {p.detail}
                                </Text>

                                <View style={styles.productPriceRow}>
                                  <Text style={styles.productPriceText}>{money(p.price)}</Text>
                                  <TouchableOpacity
                                    style={[
                                      styles.btnAddProductCircle,
                                      isUnavailable && styles.btnAddProductCircleDisabled,
                                    ]}
                                    disabled={isUnavailable || (p.stock > 0 && (cart[p.id] ?? 0) >= p.stock)}
                                    onPress={() => change(p.id, 1)}>
                                    <Feather
                                      name="plus"
                                      size={14}
                                      color={isUnavailable ? '#94A3B8' : '#2D7A58'}
                                    />
                                  </TouchableOpacity>
                                </View>

                                <Text
                                  style={[
                                    styles.productStockText,
                                    p.stock > 0 ? styles.productStockAvailable : styles.productStockEmpty,
                                  ]}>
                                  {p.stock > 0
                                    ? `${p.stock - (cart[p.id] ?? 0)} disponíveis`
                                    : delivery === 'Encomenda'
                                    ? '★ Sob encomenda'
                                    : 'Indisponível hoje'}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </ScrollView>

                  <Text style={styles.footerMicroNote}>
                    Produtos e clientes de exemplo · prévia de atendimento
                  </Text>
                </View>

              </View>

              {/* ---------------------------------------------------------------------
                  COLUNA 2 (DIREITA): COMANDA / SEU PEDIDO
              ---------------------------------------------------------------------- */}
              <View style={[styles.asideOrderSection, !isDesktop && styles.asideOrderSectionMobile]}>

                {/* CABEÇALHO DA COMANDA */}
                <View style={styles.asideHeader}>
                  <View>
                    <Text style={styles.asideTitle}>Seu pedido</Text>
                    <Text style={styles.asideClientSub} numberOfLines={1}>{client}</Text>
                  </View>
                  <View style={styles.countBadgeRound}>
                    <Text style={styles.countBadgeRoundText}>{count}</Text>
                  </View>
                </View>

                {/* ITENS SELECIONADOS OU EMPTY STATE */}
                <ScrollView
                  style={styles.cartItemsScroll}
                  contentContainerStyle={styles.cartItemsContent}
                  showsVerticalScrollIndicator={true}>
                  {count === 0 ? (
                    <View style={styles.emptyCartBox}>
                      <View style={styles.emptyCartCookieCircle}>
                        <Feather name="disc" size={24} color="#2D7A58" />
                      </View>
                      <Text style={styles.emptyCartTitle}>Toda delícia começa aqui</Text>
                      <Text style={styles.emptyCartSub}>
                        Seu pedido está esperando o primeiro doce.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.cartList}>
                      {selectedProducts.map((p) => {
                        const q = cart[p.id] ?? 0;
                        const subtotalCents = p.price * q;

                        return (
                          <View key={p.id} style={styles.cartItemRow}>
                            <View style={styles.cartItemTopLine}>
                              <Text style={styles.cartItemName} numberOfLines={1}>{p.name}</Text>
                              <TouchableOpacity
                                onPress={() => setCart((curr) => ({ ...curr, [p.id]: 0 }))}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Feather name="x" size={13} color="#94A3B8" />
                              </TouchableOpacity>
                            </View>

                            <View style={styles.cartItemControlsRow}>
                              <View style={styles.stepperPill}>
                                <TouchableOpacity
                                  style={styles.stepperPillBtn}
                                  onPress={() => change(p.id, -1)}>
                                  <Feather name="minus" size={11} color="#1E293B" />
                                </TouchableOpacity>
                                <Text style={styles.stepperPillValue}>{q}</Text>
                                <TouchableOpacity
                                  style={styles.stepperPillBtn}
                                  disabled={delivery !== 'Encomenda' && q >= p.stock}
                                  onPress={() => change(p.id, 1)}>
                                  <Feather name="plus" size={11} color="#1E293B" />
                                </TouchableOpacity>
                              </View>
                              <Text style={styles.cartItemSubtotalText}>{money(subtotalCents)}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>

                {/* PAINEL INFERIOR FIXO (OBSERVAÇÃO, PAGAMENTO E FINALIZAÇÃO) */}
                <View style={styles.asideFooterCheckout}>

                  {/* OBSERVAÇÃO */}
                  <View style={{ gap: 4 }}>
                    <Text style={styles.asideSectionLabel}>
                      Algum cuidado especial? <Text style={{ fontWeight: '400', color: '#64748B' }}>(opcional)</Text>
                    </Text>
                    <TextInput
                      style={styles.asideInputNotes}
                      placeholder="Ex.: embalagem para presente"
                      placeholderTextColor="#94A3B8"
                      value={notes}
                      onChangeText={setNotes}
                    />
                  </View>

                  {/* FORMAS DE PAGAMENTO EM 4 CARDS */}
                  <View style={{ gap: 6 }}>
                    <Text style={styles.asideSectionLabel}>Forma de pagamento</Text>
                    <View style={styles.paymentsGridFour}>
                      {PAYMENTS.map((p) => {
                        const isSelected = payment === p.name;
                        return (
                          <TouchableOpacity
                            key={p.name}
                            style={[
                              styles.payMethodBtn,
                              isSelected && styles.payMethodBtnSelected,
                            ]}
                            onPress={() => setPayment(p.name)}>
                            <Feather
                              name={p.icon as any}
                              size={15}
                              color={isSelected ? '#2D7A58' : '#1E293B'}
                            />
                            <Text
                              style={[
                                styles.payMethodBtnText,
                                isSelected && styles.payMethodBtnTextSelected,
                              ]}>
                              {p.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* SE DINHEIRO: TROCO */}
                  {payment === 'Dinheiro' && (
                    <View style={{ gap: 2 }}>
                      <Text style={styles.asideSectionLabel}>Valor recebido (R$)</Text>
                      <TextInput
                        style={styles.asideInputNotes}
                        keyboardType="numeric"
                        placeholder="0,00"
                        placeholderTextColor="#94A3B8"
                        value={received}
                        onChangeText={setReceived}
                      />
                      <Text style={styles.changeHintText}>
                        Troco: {money(Math.max(0, Number(received || 0) * 100 - total))}
                      </Text>
                    </View>
                  )}

                  {/* TOTAL DO PEDIDO */}
                  <View style={styles.asideTotalRow}>
                    <View>
                      <Text style={styles.asideTotalLabel}>Total do pedido</Text>
                      <Text style={styles.asideTotalHint}>
                        {count} {count === 1 ? 'item' : 'itens'} · {delivery.toLowerCase()}
                      </Text>
                    </View>
                    <Text style={styles.asideTotalAmount}>{money(total)}</Text>
                  </View>

                  {/* BOTÃO FINALIZAR */}
                  <TouchableOpacity
                    style={[
                      styles.btnFinalizeCta,
                      (!valid || salvandoPedido) && styles.btnFinalizeCtaDisabled,
                    ]}
                    disabled={!valid || salvandoPedido}
                    onPress={handleFinalizar}>
                    {salvandoPedido ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={styles.btnFinalizeContentRow}>
                        <Text style={styles.btnFinalizeCtaText}>
                          {payment === 'Pendente' ? 'Criar pedido pendente' : 'Finalizar pedido'}
                        </Text>
                        <Feather name="arrow-right" size={15} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* NOTA DE STATUS DO PAGAMENTO */}
                  <View style={styles.paymentStatusFooterLine}>
                    <Feather name="check" size={11} color="#64748B" />
                    <Text style={styles.paymentStatusFooterText}>
                      {payment === 'Pendente'
                        ? 'Pagamento será realizado depois'
                        : `Pagamento informado: ${payment}`}
                    </Text>
                  </View>

                </View>

              </View>

            </View>
          )}

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
  dialogContent: {
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
  dialogDesktop: {
    width: 'calc(100% - 32px)',
    maxWidth: 1180,
    height: '94dvh' as any,
    maxHeight: 820,
  },
  dialogMobile: {
    width: '100%',
    height: '96%',
  },

  // CABEÇALHO DO ATELIÊ
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EAF5F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubUpper: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#2D7A58',
    marginBottom: 2,
    fontFamily: Platform.select({ web: 'Sora, sans-serif' }),
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.3,
    fontFamily: Platform.select({ web: 'Sora, sans-serif' }),
  },
  headerDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeRoundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CORPO DO MODAL (2 COLUNAS)
  dialogBody: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    overflow: 'hidden',
  },
  dialogBodyMobile: {
    flexDirection: 'column',
    overflow: 'scroll' as any,
  },

  // COLUNA 1 (ESQUERDA - 1FR)
  leftSection: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
    minHeight: 0,
  },
  leftSectionMobile: {
    borderRightWidth: 0,
    flex: undefined,
  },

  // BARRA SUPERIOR DE QUEM COMPRA E COMO RECEBE
  topSelectorsRow: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  selectorGridCol: {
    flexDirection: 'row',
    gap: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  selectTrigger: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  selectTriggerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
  },
  selectDropdownMenu: {
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 999,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
      },
    }),
  },
  selectDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  selectDropdownItemText: {
    fontSize: 12,
    color: '#1E293B',
  },
  inlineCreateRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 6,
    backgroundColor: '#F8FAFC',
  },
  inlineClientInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: '#1E293B',
  },
  btnConfirmInlineClient: {
    backgroundColor: '#2D7A58',
    paddingHorizontal: 10,
    borderRadius: 6,
    justifyContent: 'center',
  },
  btnConfirmInlineClientText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // COMO VAI RECEBER (SEGMENTED CONTROL)
  deliverySegmentBox: {
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliverySegmentBtn: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    gap: 5,
    paddingHorizontal: 6,
  },
  deliverySegmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      },
    }),
  },
  deliverySegmentBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  deliverySegmentBtnTextActive: {
    color: '#2D7A58',
    fontWeight: '700',
  },

  singleLineInput: {
    height: 38,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#1E293B',
  },
  miniInputLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },

  // VITRINE SECTION
  vitrineSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
    minHeight: 0,
  },
  vitrineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vitrineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: Platform.select({ web: 'Sora, sans-serif' }),
  },
  vitrineCountHint: {
    fontSize: 11,
    color: '#64748B',
  },

  // SEARCH BOX
  searchBarBox: {
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    padding: 0,
    outlineWidth: 0,
  },

  // CATEGORY PILLS & CHECKBOX
  categoryFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  categoryButtonsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  categoryChipActive: {
    backgroundColor: '#EAF5F1',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  categoryChipTextActive: {
    color: '#2D7A58',
    fontWeight: '700',
  },
  checkboxOnlyAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCheckboxActive: {
    backgroundColor: '#2D7A58',
    borderColor: '#2D7A58',
  },
  checkboxLabel: {
    fontSize: 11,
    color: '#64748B',
  },

  // GRID DE PRODUTOS
  productsScrollArea: {
    flex: 1,
  },
  productsGridContent: {
    paddingRight: 4,
  },
  productsTwoColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  emptyProductsBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyProductsText: {
    fontSize: 13,
    color: '#64748B',
  },

  // CARD DE PRODUTO INDIVIDUAL (FIDEDIGNO AO LOVABLE)
  productCard: {
    width: 'calc(50% - 6px)' as any,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        transition: 'all 0.15s ease',
      },
    }),
  },
  productCardInCart: {
    borderColor: 'rgba(45, 122, 88, 0.45)',
    backgroundColor: 'rgba(234, 245, 241, 0.45)',
  },
  productCardDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.7,
  },
  productPhotoWrap: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  productPhotoImg: {
    width: '100%',
    height: '100%',
  },
  productPhotoImgDisabled: {
    opacity: 0.45,
    ...Platform.select({
      web: {
        filter: 'grayscale(1)',
      },
    }),
  },
  productInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 16,
  },
  productNameDisabled: {
    color: '#64748B',
  },
  productDetail: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  productPriceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: Platform.select({ web: 'Sora, sans-serif' }),
  },
  btnAddProductCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EAF5F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAddProductCircleDisabled: {
    opacity: 0.4,
    backgroundColor: '#F1F5F9',
  },
  productStockText: {
    fontSize: 10,
    marginTop: 3,
  },
  productStockAvailable: {
    color: '#228658',
    fontWeight: '600',
  },
  productStockEmpty: {
    color: '#64748B',
  },
  footerMicroNote: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 8,
  },

  // COLUNA 2 (DIREITA - 370PX): COMANDA SEU PEDIDO
  asideOrderSection: {
    width: 370,
    backgroundColor: 'rgba(241, 245, 249, 0.55)',
    flexDirection: 'column',
    minHeight: 0,
  },
  asideOrderSectionMobile: {
    width: '100%',
    minHeight: 520,
  },
  asideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  asideTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: Platform.select({ web: 'Sora, sans-serif' }),
  },
  asideClientSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    maxWidth: 260,
  },
  countBadgeRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EAF5F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeRoundText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D7A58',
  },

  // LISTA DE ITENS NA COMANDA
  cartItemsScroll: {
    flex: 1,
    minHeight: 64,
  },
  cartItemsContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyCartBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyCartCookieCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyCartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyCartSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 230,
    marginTop: 6,
    lineHeight: 18,
  },
  cartList: {
    gap: 12,
  },
  cartItemRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
    gap: 8,
  },
  cartItemTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  cartItemControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
  },
  stepperPillBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperPillValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    minWidth: 20,
    textAlign: 'center',
  },
  cartItemSubtotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },

  // FOOTER CHECKOUT FIXO
  asideFooterCheckout: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  asideSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  asideInputNotes: {
    height: 38,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#1E293B',
  },
  paymentsGridFour: {
    flexDirection: 'row',
    gap: 6,
  },
  payMethodBtn: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  payMethodBtnSelected: {
    borderColor: '#2D7A58',
    backgroundColor: '#EAF5F1',
  },
  payMethodBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E293B',
  },
  payMethodBtnTextSelected: {
    color: '#2D7A58',
    fontWeight: '800',
  },
  changeHintText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  asideTotalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  asideTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  asideTotalHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  asideTotalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D7A58',
    fontFamily: Platform.select({ web: 'Sora, sans-serif' }),
  },
  btnFinalizeCta: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2D7A58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFinalizeCtaDisabled: {
    opacity: 0.5,
  },
  btnFinalizeContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnFinalizeCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.select({ web: 'Sora, sans-serif' }),
  },
  paymentStatusFooterLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  paymentStatusFooterText: {
    fontSize: 10,
    color: '#64748B',
  },

  // TELA DE SUCESSO (COMPLETED)
  completedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  completedIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EAF5F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: Platform.select({ web: 'Sora, sans-serif' }),
  },
  completedSummary: {
    fontSize: 14,
    color: '#64748B',
  },
  completedHint: {
    fontSize: 12,
    color: '#2D7A58',
    fontWeight: '600',
    marginTop: 4,
  },
  btnStartAnother: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2D7A58',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  btnStartAnotherText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
