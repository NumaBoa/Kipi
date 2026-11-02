import { paraCelular } from '@/lib/responsivo';
import React, { useState, useMemo, useEffect } from 'react';
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
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ClienteFormModal, { ClienteCadastrado } from '@/components/ClienteFormModal';
import { useEstoqueVitrine, produtoAtivo } from '@/lib/estoqueVitrine';
import {
  useClientes,
  criarPedido,
  editarPedido,
  pedidoBaixouEstoque,
  salvarCliente,
  cadastroDoFormulario,
  lerDataEntrega,
  mensagemWhatsAppDoPedido,
  linkWhatsAppDoPedido,
  type Pedido,
} from '@/lib/clientesPedidos';
import { useConfigLoja } from '@/lib/configuracoes';
import { useRevenda, comissaoDaVenda } from '@/lib/revenda';
import { useEscopoRevendedora } from '@/lib/minhaRevenda';

// IMAGEM REAL DO PRODUTO (COOKIES DO ATELIÊ)
const cookiePhoto = require('../../assets/images/cookies.jpg');

export interface ProductItem {
  id: string;
  name: string;
  detail: string;
  price: number; // em centavos (ex: 1890 = R$ 18,90) ou reais
  stock: number;
  category: string;
  discount?: number; // desconto promocional por unidade, em centavos
  cost: number; // custo unitário pela ficha técnica, em centavos
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
  onPedidoCriado: (pedido: Pedido) => void;
  // Com um pedido aqui, o modal abre preenchido para editar
  pedidoEditando?: Pedido | null;
}

const money = (cents: number) => {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const PAYMENTS = [
  { name: 'Pix', icon: 'zap' },
  { name: 'Cartão', icon: 'credit-card' },
  { name: 'Dinheiro', icon: 'dollar-sign' },
  { name: 'Pendente', icon: 'clock' },
] as const;

// Venda sem cadastro de cliente (precisa ser escolhida de propósito)
const BALCAO = '__balcao__';

// Promoção só entra quando marcada no item, sempre com um motivo
export type MotivoPromocao = 'Próximo a vencer' | 'Compra em lote';
const MOTIVOS_PROMOCAO: { id: MotivoPromocao; emoji: string }[] = [
  { id: 'Próximo a vencer', emoji: '⏰' },
  { id: 'Compra em lote', emoji: '📦' },
];

const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });

export default function NovoPedidoModal({
  visible,
  onClose,
  onPedidoCriado,
  pedidoEditando = null,
}: NovoPedidoModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // ESTADOS DO PEDIDO
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [availableOnly, setAvailableOnly] = useState(true);
  // Cliente obrigatório: começa sem ninguém escolhido ('' = não escolhido, BALCAO = venda avulsa)
  const [clienteId, setClienteId] = useState<string>('');
  const [buscaCliente, setBuscaCliente] = useState('');
  // Promoção por item: só quando a pessoa marca, com o motivo
  const [promo, setPromo] = useState<Record<string, MotivoPromocao>>({});
  const [promoEscolhendo, setPromoEscolhendo] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<'Retirada' | 'Delivery' | 'Encomenda'>('Retirada');
  // Sem forma de pagamento marcada: obriga a escolher antes de finalizar
  const [payment, setPayment] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [received, setReceived] = useState('');
  const [sinalModo, setSinalModo] = useState<'porcentagem' | 'valor'>('porcentagem');
  const [sinalValor, setSinalValor] = useState('');
  const [completed, setCompleted] = useState(false);
  // Pedido em edição (mesmo modal do Novo Pedido, já preenchido)
  const [editando, setEditando] = useState<Pedido | null>(null);

  // CLIENTES COMPARTILHADOS (MESMA LISTA DA TELA DE CLIENTES) & DROPDOWN
  // Revendedora: vende do estoque que está com ela e só para os clientes dela
  const escopo = useEscopoRevendedora();
  const clientesDb = useClientes().filter(
    (c) =>
      (c.status === 'ativo' || c.id === editando?.clienteId) &&
      (!escopo.ehRevendedora || c.revendedoraId === escopo.revendedoraId)
  );

  // Na edição, o que o próprio pedido já tirou do estoque volta a contar como disponível
  const devolveNaEdicao = !!editando && (pedidoBaixouEstoque(editando) || !!editando.revendedoraId);
  const qtdNoPedidoOriginal = (produtoId: string) =>
    devolveNaEdicao ? editando!.itens.filter((it) => it.produtoId === produtoId).reduce((a, it) => a + it.quantidade, 0) : 0;
  const [selectClientOpen, setSelectClientOpen] = useState(false);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [salvandoPedido, setSalvandoPedido] = useState(false);

  // PRODUTOS DA VITRINE (ESTOQUE COMPARTILHADO ENTRE AS TELAS)
  const vitrine = useEstoqueVitrine();
  const products = useMemo<ProductItem[]>(
    () =>
      vitrine
        .filter((p) => produtoAtivo(p) && (!escopo.ehRevendedora || escopo.sabores.some((x) => x.produtoId === p.id)))
        .map((p) => ({
        id: p.id,
        name: p.nome,
        detail: p.detalhe,
        price: Math.round(p.preco * 100),
        stock: (escopo.ehRevendedora ? escopo.sabores.find((x) => x.produtoId === p.id)?.saldo ?? 0 : p.estoque) + qtdNoPedidoOriginal(p.id),
        category: p.categoria,
        discount: p.desconto ? Math.round(p.desconto * 100) : undefined,
        cost: Math.round(p.custo * 100),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vitrine, escopo.ehRevendedora, escopo.sabores, editando]
  );
  const categorias = useMemo(() => ['Todos', ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  const selectedProducts = useMemo(() => {
    return products.filter((p) => (cart[p.id] ?? 0) > 0);
  }, [products, cart]);

  const count = useMemo(() => {
    return selectedProducts.reduce((acc, p) => acc + (cart[p.id] ?? 0), 0);
  }, [selectedProducts, cart]);

  // Promoção só quando marcada no item (produto com desconto cadastrado em Produtos), com motivo
  const emPromo = (p: ProductItem) => !!p.discount && !!promo[p.id];
  const precoEfetivo = (p: ProductItem) => (emPromo(p) ? Math.max(p.price - (p.discount ?? 0), 0) : p.price);

  const total = useMemo(() => {
    return selectedProducts.reduce((acc, p) => acc + (cart[p.id] ?? 0) * precoEfetivo(p), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProducts, cart, promo]);

  // SINAL DA ENCOMENDA: configurável em % ou R$ a cada pedido
  const sinalNumero = parseFloat(sinalValor.replace(',', '.')) || 0;
  const sinalCentavos =
    sinalModo === 'porcentagem' ? Math.round((total * sinalNumero) / 100) : Math.round(sinalNumero * 100);
  const sinalInvalido = sinalModo === 'porcentagem' ? sinalNumero > 100 : sinalCentavos > total;
  // Pendente na edição mantém o que o cliente já tinha pago
  const pagoAgora =
    payment === 'Pendente'
      ? editando ? Math.min(Math.round(editando.valorSinalPago * 100), total) : 0
      : delivery === 'Encomenda' ? Math.min(sinalCentavos, total) : total;
  const saldoNaEntrega = total - pagoAgora;

  // Cliente de revendedora: o pedido gera comissão para ela (item na promoção paga metade)
  const { revendedoras } = useRevenda();
  const clienteSelecionado = clientesDb.find((c) => c.id === clienteId);
  const rotuloCliente = clienteId === BALCAO ? 'Balcão avulso (sem cadastro)' : clienteSelecionado?.nome ?? '';
  const revendedoraDoPedido = escopo.ehRevendedora
    ? escopo.revendedora
    : clienteSelecionado?.revendedoraId
    ? revendedoras.find((r) => r.id === clienteSelecionado.revendedoraId) ?? null
    : null;
  const comissaoDoPedido = revendedoraDoPedido
    ? comissaoDaVenda(
        {
          id: '',
          revendedoraId: revendedoraDoPedido.id,
          data: '',
          total: total / 100,
          status: 'pago',
          itens: selectedProducts.map((p) => ({
            produtoId: p.id,
            nome: p.name,
            quantidade: cart[p.id] ?? 0,
            precoUnitario: precoEfetivo(p) / 100,
            comDesconto: emPromo(p),
          })),
        },
        revendedoraDoPedido
      )
    : 0;
  const descontoTotal = selectedProducts.reduce((acc, p) => acc + (emPromo(p) ? (cart[p.id] ?? 0) * (p.discount ?? 0) : 0), 0);
  // Comissão de um item só (etiqueta ao lado do Promo)
  const comissaoDoItem = (p: ProductItem) =>
    revendedoraDoPedido
      ? comissaoDaVenda(
          {
            id: '',
            revendedoraId: revendedoraDoPedido.id,
            data: '',
            total: ((cart[p.id] ?? 0) * precoEfetivo(p)) / 100,
            status: 'pago',
            itens: [{ produtoId: p.id, nome: p.name, quantidade: cart[p.id] ?? 0, precoUnitario: precoEfetivo(p) / 100, comDesconto: emPromo(p) }],
          },
          revendedoraDoPedido
        )
      : 0;

  // Busca de cliente por nome, telefone ou tag
  const termoCliente = buscaCliente.trim().toLowerCase();
  const clientesFiltrados = clientesDb.filter(
    (c) =>
      !termoCliente ||
      c.nome.toLowerCase().includes(termoCliente) ||
      (c.telefone ?? '').replace(/[^0-9]/g, '').includes(termoCliente.replace(/[^0-9]/g, '') || '§') ||
      (c.tag ?? '').toLowerCase().includes(termoCliente)
  );

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
    clienteId !== '' &&
    payment !== '' &&
    (delivery !== 'Delivery' || address.trim().length > 0) &&
    (delivery !== 'Encomenda' || date.length > 0) &&
    !(delivery === 'Encomenda' && payment !== 'Pendente' && sinalInvalido) &&
    (payment !== 'Dinheiro' || Number(received || 0) * 100 >= pagoAgora);

  // Pedido recém-criado: mensagem de WhatsApp com a chave PIX das Configurações
  const { config } = useConfigLoja();
  const [pedidoCriado, setPedidoCriado] = useState<Pedido | null>(null);
  const [wppCopiado, setWppCopiado] = useState(false);
  const mensagemWpp = pedidoCriado ? mensagemWhatsAppDoPedido(pedidoCriado, config) : '';

  const reset = () => {
    setPedidoCriado(null);
    setCompleted(false);
    setCart({});
    setNotes('');
    setAddress('');
    setDate('');
    setReceived('');
    setSinalModo('porcentagem');
    setSinalValor('');
    setClienteId('');
    setBuscaCliente('');
    setPromo({});
    setPromoEscolhendo(null);
    setDelivery('Retirada');
    setPayment('');
    setEditando(null);
  };

  // Abre preenchido com o pedido a editar (ou limpo, se antes estava editando)
  useEffect(() => {
    if (!visible) return;
    if (!pedidoEditando) {
      if (editando) reset();
      return;
    }
    const p = pedidoEditando;
    const doisDig = (n: number) => String(n).padStart(2, '0');
    const formas: Record<Pedido['formaPagamento'], string> = {
      pix: 'Pix',
      cartao_credito: 'Cartão',
      cartao_debito: 'Cartão',
      dinheiro: 'Dinheiro',
      pendente: 'Pendente',
    };
    const carrinho: Record<string, number> = {};
    const promos: Record<string, MotivoPromocao> = {};
    p.itens.forEach((it) => {
      const id = it.produtoId ?? vitrine.find((v) => v.nome === it.nome)?.id;
      if (!id) return;
      carrinho[id] = (carrinho[id] ?? 0) + it.quantidade;
      if (it.comDesconto) promos[id] = (it.motivoPromocao as MotivoPromocao) || 'Próximo a vencer';
    });
    const entrega = p.observacoes?.startsWith('Entrega: ') ? p.observacoes.slice(9) : '';
    const d = p.dataEntrega ? new Date(p.dataEntrega) : null;

    setPedidoCriado(null);
    setCompleted(false);
    setEditando(p);
    setCart(carrinho);
    setPromo(promos);
    setPromoEscolhendo(null);
    setClienteId(p.clienteId ?? BALCAO);
    setBuscaCliente('');
    setDelivery(p.tipoPedido === 'sob_encomenda' ? 'Encomenda' : entrega ? 'Delivery' : 'Retirada');
    setAddress(entrega);
    setNotes(entrega ? '' : p.observacoes ?? '');
    setDate(d ? `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}/${d.getFullYear()} ${doisDig(d.getHours())}:${doisDig(d.getMinutes())}` : '');
    setPayment(p.status === 'pendente' ? 'Pendente' : formas[p.formaPagamento]);
    setReceived('');
    setSinalModo('valor');
    setSinalValor(p.tipoPedido === 'sob_encomenda' ? p.valorSinalPago.toFixed(2).replace('.', ',') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pedidoEditando]);

  const handleClienteCadastrado = (cliente: ClienteCadastrado) => {
    // Cadastrado aqui já aparece na tela de Clientes
    salvarCliente(cadastroDoFormulario(cliente));
    setClienteId(cliente.id);
    setModalClienteAberto(false);
    setSelectClientOpen(false);
  };

  const handleFinalizar = async () => {
    if (!valid) return;
    setSalvandoPedido(true);

    try {
      const itens = selectedProducts.map((p) => ({
        id: p.id,
        produtoId: p.id,
        custoUnitario: p.cost / 100,
        nome: p.name,
        categoria: p.category,
        quantidade: cart[p.id] ?? 0,
        precoUnitario: precoEfetivo(p) / 100,
        desconto: emPromo(p) ? (p.discount ?? 0) / 100 : 0,
        comDesconto: emPromo(p),
        motivoPromocao: emPromo(p) ? promo[p.id] : undefined,
        totalItem: ((cart[p.id] ?? 0) * precoEfetivo(p)) / 100,
      }));
      const clienteNome = clienteId === BALCAO ? null : clienteSelecionado?.nome ?? null;
      const custoTotal = selectedProducts.reduce((acc, p) => acc + (cart[p.id] ?? 0) * p.cost, 0) / 100;
      const formas = { Pix: 'pix', Cartão: 'cartao_credito', Dinheiro: 'dinheiro', Pendente: 'pendente' } as const;

      // EDIÇÃO: mesmo pedido (código, data, vendedor), com os dados novos
      if (editando) {
        const tipoPedido = delivery === 'Encomenda' ? 'sob_encomenda' : 'pronta_entrega';
        const formaAntiga = editando.formaPagamento === 'cartao_debito' && payment === 'Cartão' ? 'cartao_debito' : null;
        const atualizado: Pedido = {
          ...editando,
          clienteId: clienteId === BALCAO ? null : clienteSelecionado?.id ?? editando.clienteId,
          clienteNome: clienteId === BALCAO ? 'Venda Avulsa (Balcão)' : clienteSelecionado?.nome ?? editando.clienteNome,
          clienteTelefone: clienteId === BALCAO ? null : clienteSelecionado?.telefone ?? editando.clienteTelefone,
          clienteEmail: clienteId === BALCAO ? null : clienteSelecionado?.email ?? editando.clienteEmail,
          tipoPedido,
          tag: editando.revendedoraId ? editando.tag : tipoPedido === 'sob_encomenda' ? 'Encomenda' : 'Pronta Entrega',
          formaPagamento: formaAntiga ?? formas[payment as keyof typeof formas] ?? 'pix',
          itens: itens.map(({ id, ...it }, idx) => ({ ...it, id: `${editando.id}-it-${idx}` })),
          total: total / 100,
          valorSinalPago: pagoAgora / 100,
          saldoNaEntrega: saldoNaEntrega / 100,
          status: saldoNaEntrega > 0 ? 'pendente' : 'pago',
          custoTotal,
          dataEntrega: tipoPedido === 'sob_encomenda' ? lerDataEntrega(date) : null,
          // Virou encomenda: volta para a fila da cozinha; deixou de ser: fica pronto
          statusProducao:
            editando.revendedoraId || editando.tipoPedido === tipoPedido
              ? editando.statusProducao
              : tipoPedido === 'sob_encomenda' ? 'a_fazer' : 'pronto',
          observacoes: notes.trim() || (delivery === 'Delivery' && address ? `Entrega: ${address}` : null),
        };
        editarPedido(atualizado);
        onPedidoCriado(atualizado);
        setPedidoCriado(atualizado);
        setCompleted(true);
        return;
      }

      // Registra na lista compartilhada (Pedidos, Clientes, Produção) e baixa a vitrine
      const novo = criarPedido({
        clienteNome,
        clienteId: clienteId === BALCAO ? null : clienteSelecionado?.id ?? null,
        tipoPedido: delivery === 'Encomenda' ? 'sob_encomenda' : 'pronta_entrega',
        formaPagamento: formas[payment as keyof typeof formas] ?? 'pix',
        itens: itens.map(({ id, ...it }) => it),
        total: total / 100,
        valorSinalPago: pagoAgora / 100,
        saldoNaEntrega: saldoNaEntrega / 100,
        custoTotal,
        dataEntrega: delivery === 'Encomenda' ? lerDataEntrega(date) : null,
        observacoes: notes.trim() || (address ? `Entrega: ${address}` : null),
        revendedoraId: escopo.revendedoraId,
      });
      onPedidoCriado(novo);
      setPedidoCriado(novo);

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
              <Text style={styles.headerSubUpper}>{editando ? `EDITAR PEDIDO · ${editando.codigoDisplay}` : escopo.ehRevendedora ? 'REVENDA · MINHA VENDA' : 'ATELIÊ · ATENDIMENTO'}</Text>
              <Text style={styles.headerTitle}>{editando ? 'Ajustando o pedido.' : escopo.ehRevendedora ? 'Mais uma venda pra sua conta.' : 'Mais um pedido saindo do forno.'}</Text>
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
            <ScrollView contentContainerStyle={styles.fimScroll}>
              <View style={[styles.fimGrid, !isDesktop && { flexDirection: 'column' }]}>
                {/* RESUMO DO PEDIDO */}
                <View style={styles.fimResumo}>
                  <View style={styles.fimTopo}>
                    <View style={styles.fimIcone}>
                      <Feather name="check" size={22} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fimTitulo}>{editando ? 'Pedido atualizado!' : 'Pedido confirmado!'}</Text>
                      <Text style={styles.fimSub}>
                        {pedidoCriado?.codigoDisplay ?? ''} · {rotuloCliente}
                        {clienteSelecionado?.tag ? ` · 🏷️ ${clienteSelecionado.tag}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.fimChips}>
                    <View style={styles.fimChip}>
                      <Feather name="package" size={12} color="#475569" />
                      <Text style={styles.fimChipTexto}>{count} {count === 1 ? 'item' : 'itens'}</Text>
                    </View>
                    <View style={styles.fimChip}>
                      <Feather name={delivery === 'Encomenda' ? 'calendar' : delivery === 'Delivery' ? 'truck' : 'shopping-bag'} size={12} color="#475569" />
                      <Text style={styles.fimChipTexto}>{delivery}</Text>
                    </View>
                    <View style={[styles.fimChip, saldoNaEntrega > 0 ? styles.fimChipPendente : styles.fimChipPago]}>
                      <Feather name={saldoNaEntrega > 0 ? 'clock' : 'check-circle'} size={12} color={saldoNaEntrega > 0 ? '#B45309' : '#15803D'} />
                      <Text style={[styles.fimChipTexto, { color: saldoNaEntrega > 0 ? '#B45309' : '#15803D' }]}>
                        {saldoNaEntrega > 0 ? `Falta ${money(saldoNaEntrega)}` : `Pago · ${payment}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.fimItens}>
                    {selectedProducts.map((p) => (
                      <View key={p.id} style={styles.fimItem}>
                        <Text style={styles.fimItemQtd}>{cart[p.id]}x</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fimItemNome} numberOfLines={1}>{p.name}</Text>
                          {emPromo(p) && <Text style={styles.fimItemPromo}>🏷️ {promo[p.id]}</Text>}
                        </View>
                        <Text style={styles.fimItemValor}>{money((cart[p.id] ?? 0) * precoEfetivo(p))}</Text>
                      </View>
                    ))}
                    <View style={styles.fimTotal}>
                      <Text style={styles.fimTotalRotulo}>Total</Text>
                      <Text style={styles.fimTotalValor}>{money(total)}</Text>
                    </View>
                  </View>

                  <View style={styles.fimAcoes}>
                    <TouchableOpacity style={styles.btnStartAnother} onPress={reset}>
                      <Feather name="plus" size={15} color="#FFFFFF" />
                      <Text style={styles.btnStartAnotherText}>Novo pedido</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.fimBtnFechar} onPress={onClose}>
                      <Text style={styles.fimBtnFecharTexto}>Fechar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* MENSAGEM PRONTA PARA O WHATSAPP DO CLIENTE (prévia como no celular) */}
                {pedidoCriado && (
                  <View style={styles.wppBox}>
                    <View style={styles.wppCabecalho}>
                      <View style={styles.wppAvatar}>
                        <Feather name="message-circle" size={14} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.wppTitulo}>Mensagem para o cliente</Text>
                        <Text style={styles.wppSubtitulo}>{pedidoCriado.clienteTelefone || 'Sem telefone: você escolhe o contato'}</Text>
                      </View>
                    </View>
                    <View style={styles.wppConversa}>
                      <View style={styles.wppBalao}>
                        <TextoWhatsApp texto={mensagemWpp} />
                      </View>
                    </View>
                    {!config.chavePix?.trim() && saldoNaEntrega > 0 && (
                      <Text style={styles.wppAviso}>💡 Cadastre a chave PIX em Configurações para ela sair na mensagem.</Text>
                    )}
                    <View style={styles.wppAcoes}>
                      <TouchableOpacity
                        style={styles.wppBtn}
                        onPress={() => {
                          if (Platform.OS === 'web' && typeof window !== 'undefined') {
                            window.open(linkWhatsAppDoPedido(pedidoCriado, mensagemWpp), '_blank');
                          } else {
                            Linking.openURL(linkWhatsAppDoPedido(pedidoCriado, mensagemWpp));
                          }
                        }}>
                        <Feather name="send" size={14} color="#FFFFFF" />
                        <Text style={styles.wppBtnText}>Enviar no WhatsApp</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.wppBtnSec}
                        onPress={() => {
                          if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(mensagemWpp);
                            setWppCopiado(true);
                            setTimeout(() => setWppCopiado(false), 2000);
                          }
                        }}>
                        <Feather name={wppCopiado ? 'check' : 'copy'} size={14} color="#15803D" />
                        <Text style={styles.wppBtnSecText}>{wppCopiado ? 'Copiado!' : 'Copiar'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          ) : (
            <View style={[styles.dialogBody, !isDesktop && styles.dialogBodyMobile]}>

              {/* ---------------------------------------------------------------------
                  COLUNA 1 (ESQUERDA): SELETORES E VITRINE DO ATELIÊ
              ---------------------------------------------------------------------- */}
              <View style={[styles.leftSection, !isDesktop && styles.leftSectionMobile]}>

                {/* BARRA SUPERIOR: QUEM ESTÁ COMPRANDO? E COMO VAI RECEBER? */}
                <View style={styles.topSelectorsRow}>
                  <View style={styles.selectorGridCol}>
                    {/* QUEM ESTÁ COMPRANDO (obrigatório: começa vazio; busca por nome, telefone ou tag) */}
                    <View style={styles.clienteCol}>
                      <Text style={styles.fieldLabel}>
                        <Feather name="user" size={12} color="#2D7A58" /> Quem está comprando? <Text style={{ color: '#DC2626' }}>*</Text>
                      </Text>

                      <View style={styles.clienteLinha}>
                        <TouchableOpacity
                          style={[styles.selectTrigger, { flex: 1 }, selectClientOpen && styles.selectTriggerAberto, clienteId === '' && count > 0 && styles.selectTriggerErro]}
                          onPress={() => setSelectClientOpen(!selectClientOpen)}>
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.selectTriggerText, { flexShrink: 1 }, !rotuloCliente && { color: '#94A3B8' }]} numberOfLines={1}>
                              {rotuloCliente || 'Escolha o cliente...'}
                            </Text>
                            {clienteSelecionado?.tag ? (
                              <View style={styles.clienteTag}>
                                <Text style={styles.clienteTagTexto}>{clienteSelecionado.tag}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Feather name={selectClientOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#64748B" />
                        </TouchableOpacity>
                        {/* Cadastrar cliente sem abrir a lista; ao salvar ele já vem escolhido */}
                        <TouchableOpacity
                          style={styles.btnNovoCliente}
                          accessibilityLabel="Cadastrar novo cliente"
                          onPress={() => {
                            setSelectClientOpen(false);
                            setModalClienteAberto(true);
                          }}>
                          <Feather name="user-plus" size={16} color="#2D7A58" />
                        </TouchableOpacity>
                      </View>

                      {selectClientOpen && (
                        <View style={styles.selectDropdownMenu}>
                          <View style={styles.clienteBuscaBox}>
                            <Feather name="search" size={13} color="#94A3B8" />
                            <TextInput
                              style={styles.clienteBuscaInput}
                              placeholder="Nome, telefone ou tag"
                              placeholderTextColor="#94A3B8"
                              value={buscaCliente}
                              onChangeText={setBuscaCliente}
                              autoFocus
                            />
                          </View>

                          <ScrollView style={{ maxHeight: 230 }} keyboardShouldPersistTaps="handled">
                            {!termoCliente && (
                              <TouchableOpacity
                                style={[styles.selectDropdownItem, clienteId === BALCAO && styles.selectDropdownItemAtivo]}
                                onPress={() => {
                                  setClienteId(BALCAO);
                                  setSelectClientOpen(false);
                                }}>
                                <View style={styles.clienteAvatar}>
                                  <Feather name="shopping-bag" size={12} color="#64748B" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.selectDropdownItemText}>Balcão avulso</Text>
                                  <Text style={styles.clienteSub}>Venda sem cadastro</Text>
                                </View>
                              </TouchableOpacity>
                            )}

                            {clientesFiltrados.length === 0 && (
                              <Text style={[styles.clienteSub, { padding: 12 }]}>Nenhum cliente encontrado.</Text>
                            )}
                            {clientesFiltrados.map((cli) => (
                              <TouchableOpacity
                                key={cli.id}
                                style={[styles.selectDropdownItem, clienteId === cli.id && styles.selectDropdownItemAtivo]}
                                onPress={() => {
                                  setClienteId(cli.id);
                                  setBuscaCliente('');
                                  setSelectClientOpen(false);
                                }}>
                                <View style={styles.clienteAvatar}>
                                  <Text style={styles.clienteAvatarTexto}>{cli.nome.slice(0, 1).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.selectDropdownItemText} numberOfLines={1}>{cli.nome}</Text>
                                  <Text style={styles.clienteSub} numberOfLines={1}>{cli.telefone || 'Sem telefone'}</Text>
                                </View>
                                {cli.tag ? (
                                  <View style={styles.clienteTag}>
                                    <Text style={styles.clienteTagTexto}>{cli.tag}</Text>
                                  </View>
                                ) : null}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>

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
                          // Revendedora vende só o que já está com ela (sem encomenda)
                          ...(escopo.ehRevendedora ? [] : [{ name: 'Encomenda', icon: 'calendar' }]),
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
                        placeholder="Ex: 25/10 14:00"
                        placeholderTextColor="#94A3B8"
                        value={date}
                        onChangeText={setDate}
                      />
                    </View>
                  )}
                </View>

                {/* VITRINE DO ATELIÊ */}
                <View style={styles.vitrineSection}>
                  {/* TÍTULO + BUSCA NA MESMA LINHA (ECONOMIZA ESPAÇO) */}
                  <View style={styles.vitrineHeaderRow}>
                    <View>
                      <Text style={styles.vitrineTitle}>{escopo.ehRevendedora ? 'Meu estoque' : 'Vitrine do ateliê'}</Text>
                      <Text style={styles.vitrineCountHint}>
                        {products.filter((p) => p.stock > 0).length} opções disponíveis
                      </Text>
                    </View>
                    <View style={[styles.searchBarBox, styles.searchBarInline]}>
                      <Feather name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.searchBarInput}
                        placeholder="Buscar um doce ou sabor…"
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                      />
                    </View>
                  </View>

                  {/* FILTROS DE CATEGORIA E CHECKBOX SÓ DISPONÍVEIS */}
                  <View style={styles.categoryFiltersRow}>
                    <View style={styles.categoryButtonsRow}>
                      {categorias.map((c) => {
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
                                  <View>
                                    <Text style={styles.productPriceText}>{money(p.price)}</Text>
                                  </View>
                                  <TouchableOpacity
                                    style={[
                                      styles.btnAddProductCircle,
                                      isUnavailable && styles.btnAddProductCircleDisabled,
                                    ]}
                                    disabled={isUnavailable || (delivery !== 'Encomenda' && p.stock > 0 && (cart[p.id] ?? 0) >= p.stock)}
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
                    <Text style={styles.asideClientSub} numberOfLines={1}>{rotuloCliente || 'Cliente não escolhido'}</Text>
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
                        const subtotalCents = precoEfetivo(p) * q;

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
                              {p.discount ? (
                                <TouchableOpacity
                                  style={[styles.promoBtn, (promo[p.id] || promoEscolhendo === p.id) && styles.promoBtnAtivo]}
                                  onPress={() => {
                                    if (promo[p.id]) {
                                      // Tira a promoção: volta ao preço cheio
                                      setPromo(({ [p.id]: _tirada, ...resto }) => resto);
                                    } else {
                                      setPromoEscolhendo(promoEscolhendo === p.id ? null : p.id);
                                    }
                                  }}>
                                  <Text style={[styles.promoBtnText, (promo[p.id] || promoEscolhendo === p.id) && styles.promoBtnTextAtivo]}>
                                    {promo[p.id] ? '🏷️ Promo ✕' : '🏷️ Promo'}
                                  </Text>
                                </TouchableOpacity>
                              ) : null}
                              {/* Comissão deste item (metade quando está na promoção) */}
                              {revendedoraDoPedido ? (
                                <View style={styles.comissaoPill}>
                                  <Text style={styles.comissaoPillText}>🤝 {money(Math.round(comissaoDoItem(p) * 100))}</Text>
                                </View>
                              ) : null}
                              <Text style={styles.cartItemSubtotalText}>{money(subtotalCents)}</Text>
                            </View>

                            {/* PROMOÇÃO: só quando marcada, com o motivo (botão pequeno ao lado da quantidade) */}
                            {p.discount && promoEscolhendo === p.id && !promo[p.id] ? (
                              <View style={styles.promoToggleRow}>
                                <Text style={styles.promoToggleText}>Motivo da promoção:</Text>
                                {MOTIVOS_PROMOCAO.map((m) => (
                                  <TouchableOpacity
                                    key={m.id}
                                    style={styles.promoMotivoChip}
                                    onPress={() => {
                                      setPromo((atual) => ({ ...atual, [p.id]: m.id }));
                                      setPromoEscolhendo(null);
                                    }}>
                                    <Text style={styles.promoMotivoChipText}>
                                      {m.emoji} {m.id}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            ) : null}
                            {promo[p.id] && p.discount ? (
                              <View style={styles.promoToggleRow}>
                                <Text style={[styles.promoToggleText, styles.promoToggleTextActive]}>
                                  🏷️ {promo[p.id]}: {money(p.price)} − {money(p.discount)} = {money(precoEfetivo(p))}/un
                                </Text>
                              </View>
                            ) : null}
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

                  {/* SINAL DA ENCOMENDA (% OU R$) */}
                  {delivery === 'Encomenda' && payment !== 'Pendente' && (
                    <View style={styles.sinalBox}>
                      <View style={styles.sinalHeaderRow}>
                        <Text style={styles.asideSectionLabel}>Sinal pago agora</Text>
                        <View style={styles.sinalModoToggle}>
                          {[
                            { id: 'porcentagem', label: '%' },
                            { id: 'valor', label: 'R$' },
                          ].map((m) => {
                            const ativo = sinalModo === m.id;
                            return (
                              <TouchableOpacity
                                key={m.id}
                                style={[styles.sinalModoBtn, ativo && styles.sinalModoBtnActive]}
                                onPress={() => {
                                  setSinalModo(m.id as 'porcentagem' | 'valor');
                                  setSinalValor('');
                                }}>
                                <Text style={[styles.sinalModoText, ativo && styles.sinalModoTextActive]}>{m.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                      <View style={styles.sinalInputWrap}>
                        {sinalModo === 'valor' && <Text style={styles.sinalAffix}>R$</Text>}
                        <TextInput
                          style={styles.sinalInput}
                          keyboardType="decimal-pad"
                          placeholder={sinalModo === 'porcentagem' ? 'Ex: 50' : '0,00'}
                          placeholderTextColor="#94A3B8"
                          value={sinalValor}
                          onChangeText={(t) => setSinalValor(t.replace(/[^\d,]/g, ''))}
                        />
                        {sinalModo === 'porcentagem' && <Text style={styles.sinalAffix}>%</Text>}
                      </View>
                      {sinalInvalido ? (
                        <Text style={styles.sinalErro}>
                          {sinalModo === 'porcentagem' ? 'O sinal não pode passar de 100%.' : 'O sinal não pode ser maior que o total.'}
                        </Text>
                      ) : (
                        <Text style={styles.changeHintText}>
                          Sinal de {money(pagoAgora)} · falta {money(saldoNaEntrega)} na entrega
                        </Text>
                      )}
                    </View>
                  )}

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
                        Troco: {money(Math.max(0, Number(received || 0) * 100 - pagoAgora))}
                      </Text>
                    </View>
                  )}

                  {/* ECONOMIA COM PROMOÇÃO */}
                  {descontoTotal > 0 && (
                    <Text style={styles.changeHintText}>🏷️ Desconto de promoção: −{money(descontoTotal)}</Text>
                  )}

                  {/* TOTAL DO PEDIDO */}
                  <View style={styles.asideTotalRow}>
                    <View>
                      <Text style={styles.asideTotalLabel}>Total do pedido</Text>
                      <Text style={styles.asideTotalHint}>
                        {count} {count === 1 ? 'item' : 'itens'} · {delivery.toLowerCase()}
                        {revendedoraDoPedido && count > 0
                          ? ` · 🤝 ${escopo.ehRevendedora ? 'sua comissão' : 'comissão'} ${money(Math.round(comissaoDoPedido * 100))}`
                          : ''}
                      </Text>
                    </View>
                    <Text style={styles.asideTotalAmount}>{money(total)}</Text>
                  </View>
                  {saldoNaEntrega > 0 && count > 0 && (
                    <View style={styles.saldoEntregaRow}>
                      <Text style={styles.saldoEntregaLabel}>
                        {pagoAgora > 0 ? `Pago agora ${money(pagoAgora)} · ` : ''}A receber na entrega
                      </Text>
                      <Text style={styles.saldoEntregaValor}>{money(saldoNaEntrega)}</Text>
                    </View>
                  )}

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
                          {editando ? 'Salvar alterações' : payment === 'Pendente' ? 'Criar pedido pendente' : 'Finalizar pedido'}
                        </Text>
                        <Feather name="arrow-right" size={15} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* NOTA DE STATUS DO PAGAMENTO */}
                  <View style={styles.paymentStatusFooterLine}>
                    <Feather name={payment && clienteId ? 'check' : 'alert-circle'} size={11} color={payment && clienteId ? '#64748B' : '#DC2626'} />
                    <Text style={[styles.paymentStatusFooterText, (!payment || !clienteId) && { color: '#DC2626', fontWeight: '700' }]}>
                      {!clienteId
                        ? 'Escolha quem está comprando para finalizar'
                        : !payment
                        ? 'Escolha a forma de pagamento para finalizar'
                        : payment === 'Pendente'
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

      {/* CADASTRO COMPLETO DE CLIENTE (MESMO FORMULÁRIO DA TELA DE CLIENTES) */}
      <ClienteFormModal
        visible={modalClienteAberto}
        onClose={() => setModalClienteAberto(false)}
        onSalvo={handleClienteCadastrado}
        revendedoraFixa={escopo.revendedoraId}
      />
    </Modal>
  );
}


// Mostra a mensagem como no WhatsApp: *negrito* e _itálico_
function TextoWhatsApp({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <Text style={styles.wppTexto} selectable>
      {partes.map((parte, i) =>
        parte.startsWith('*') && parte.endsWith('*') && parte.length > 2 ? (
          <Text key={i} style={{ fontWeight: '800' }}>{parte.slice(1, -1)}</Text>
        ) : parte.startsWith('_') && parte.endsWith('_') && parte.length > 2 ? (
          <Text key={i} style={{ fontStyle: 'italic', color: '#54656F' }}>{parte.slice(1, -1)}</Text>
        ) : (
          <Text key={i}>{parte}</Text>
        )
      )}
    </Text>
  );
}
const styles = paraCelular(StyleSheet.create({
  // SINAL DA ENCOMENDA
  sinalBox: {
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sinalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sinalModoToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sinalModoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  sinalModoBtnActive: {
    backgroundColor: '#2D7A58',
  },
  sinalModoText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  sinalModoTextActive: {
    color: '#FFFFFF',
  },
  sinalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  sinalAffix: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  sinalInput: {
    flex: 1,
    paddingVertical: 7,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: FONT_SANS,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  sinalErro: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    fontFamily: FONT_SANS,
  },
  saldoEntregaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  saldoEntregaLabel: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  saldoEntregaValor: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
    fontFamily: FONT_SANS,
  },
  // PROMOÇÃO / DESCONTO POR ITEM
  promoTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    fontFamily: FONT_SANS,
    marginTop: 1,
  },
  promoBtn: {
    marginLeft: 8,
    marginRight: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFFFF',
  },
  promoBtnAtivo: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  promoBtnText: { fontSize: 10, fontWeight: '700', color: '#B45309', fontFamily: FONT_SANS },
  promoBtnTextAtivo: { color: '#92400E', fontWeight: '800' },
  comissaoPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE' },
  comissaoPillText: { fontSize: 10, fontWeight: '800', color: '#6D28D9', fontFamily: FONT_SANS },
  promoMotivoChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  promoMotivoChipText: { fontSize: 10, fontWeight: '700', color: '#92400E', fontFamily: FONT_SANS },
  promoToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  promoCheckboxActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  promoToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  promoToggleTextActive: {
    color: '#92400E',
    fontWeight: '800',
  },
  promoAllBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 8,
  },
  promoAllBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    fontFamily: FONT_SANS,
  },

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
    fontFamily: FONT_SANS as any,
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
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#2D7A58',
    marginBottom: 3,
    fontFamily: Platform.select({ web: '"Manrope", sans-serif' }),
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    letterSpacing: 0,
    fontFamily: Platform.select({ web: '"Sora", sans-serif' }),
  },
  headerDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontFamily: Platform.select({ web: '"Manrope", sans-serif' }),
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
    // Fica por cima da vitrine para a lista de clientes não ficar "transparente"
    position: 'relative',
    zIndex: 20,
    backgroundColor: '#FFFFFF',
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
    top: 72,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    backgroundColor: '#FFFFFF',
  },
  selectDropdownItemAtivo: { backgroundColor: '#EAF5F1' },
  selectTriggerAberto: { borderColor: '#2D7A58' },
  selectTriggerErro: { borderColor: '#FCA5A5' },
  clienteCol: { flex: 1, position: 'relative', zIndex: 30 },
  clienteLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnNovoCliente: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#CDE7DC', backgroundColor: '#EAF5F1', alignItems: 'center', justifyContent: 'center' },
  clienteBuscaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    margin: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clienteBuscaInput: { flex: 1, fontSize: 12, color: '#0F172A', fontFamily: FONT_SANS, outlineStyle: 'none' } as any,
  clienteAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  clienteAvatarTexto: { fontSize: 11, fontWeight: '800', color: '#2D7A58', fontFamily: FONT_SANS },
  clienteSub: { fontSize: 10, color: '#94A3B8', fontFamily: FONT_SANS, marginTop: 1 },
  clienteTag: { backgroundColor: '#EAF5F1', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  clienteTagTexto: { fontSize: 9, fontWeight: '800', color: '#2D7A58', fontFamily: FONT_SANS },
  selectDropdownItemText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
    fontFamily: FONT_SANS,
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
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
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
  searchBarInline: {
    flex: 1,
    maxWidth: 320,
    height: 36,
    marginBottom: 0,
    marginLeft: 12,
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
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
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
    fontWeight: '600',
    color: '#2D7A58',
    fontFamily: FONT_DISPLAY,
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
    fontWeight: '600',
    fontFamily: FONT_SANS,
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
    fontFamily: FONT_SANS,
  },

  // TELA DE PEDIDO CONFIRMADO: resumo à esquerda, prévia do WhatsApp à direita
  fimScroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  fimGrid: { flexDirection: 'row', gap: 20, alignItems: 'stretch', maxWidth: 920, width: '100%', alignSelf: 'center' },
  fimResumo: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 20, gap: 16 },
  fimTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fimIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2D7A58', alignItems: 'center', justifyContent: 'center' },
  fimTitulo: { fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  fimSub: { fontFamily: FONT_SANS, fontSize: 12, color: '#64748B', marginTop: 2 },
  fimChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fimChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F1F5F9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  fimChipPendente: { backgroundColor: '#FEF3C7' },
  fimChipPago: { backgroundColor: '#DCFCE7' },
  fimChipTexto: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '700', color: '#475569' },
  fimItens: { borderRadius: 12, backgroundColor: '#F8FAFC', padding: 12, gap: 8 },
  fimItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fimItemQtd: { width: 28, fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: '800', color: '#2D7A58' },
  fimItemNome: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '600', color: '#1E293B' },
  fimItemPromo: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '700', color: '#B45309', marginTop: 1 },
  fimItemValor: { fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: '700', color: '#334155' },
  fimTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 2 },
  fimTotalRotulo: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#475569' },
  fimTotalValor: { fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: '800', color: '#2D7A58' },
  fimAcoes: { flexDirection: 'row', gap: 8, marginTop: 'auto' },
  fimBtnFechar: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center' },
  fimBtnFecharTexto: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: '700', color: '#475569' },
  wppBox: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#D1E7DD', backgroundColor: '#FFFFFF' },
  wppCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#075E54', paddingHorizontal: 14, paddingVertical: 10 },
  wppAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  wppTitulo: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  wppSubtitulo: { fontFamily: FONT_SANS, fontSize: 10, color: '#C8E6DF', marginTop: 1 },
  wppConversa: { flex: 1, backgroundColor: '#ECE5DD', padding: 14 },
  wppBalao: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    backgroundColor: '#DCF8C6',
    borderRadius: 10,
    borderTopRightRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Platform.select({ web: { boxShadow: '0 1px 1px rgba(0,0,0,0.12)' } }),
  },
  wppTexto: { fontFamily: FONT_SANS, fontSize: 12.5, lineHeight: 18, color: '#111B21' },
  wppAviso: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '600', color: '#B45309', paddingHorizontal: 14, paddingTop: 10 },
  wppAcoes: { flexDirection: 'row', gap: 8, padding: 12 },
  wppBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', paddingVertical: 11, borderRadius: 10 },
  wppBtnText: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  wppBtnSec: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  wppBtnSecText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#15803D' },
  btnStartAnother: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2D7A58', paddingVertical: 11, borderRadius: 10 },
  btnStartAnotherText: { fontFamily: FONT_SANS, color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
}));
