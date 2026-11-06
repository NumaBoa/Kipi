import React, { useMemo, useState } from 'react';
import { Image, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { type ClienteCadastrado } from '@/components/ClienteFormModal';
import ClienteFormMobile from '@/components/clientes-mobile/ClienteFormMobile';
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
import { Botao, Etiqueta, Gaveta, Opcao, T } from '@/components/mobile/ui';
import { brl, cor, numeros, sombra } from '@/components/mobile/tema';

// ============================================================================
// NOVO PEDIDO (celular) em 2 etapas: 1) produtos  2) cliente, entrega e pagamento.
// Cálculos, validações e gravação iguais ao NovoPedidoModal (versão de computador).
// ============================================================================
const fotoProduto = require('../../../assets/images/cookies.jpg');

type Modo = 'Retirada' | 'Delivery' | 'Encomenda';
type Forma = 'Pix' | 'Cartão' | 'Dinheiro' | 'Pendente';
type Motivo = 'Próximo a vencer' | 'Compra em lote';
const BALCAO = '__balcao__';
const FORMAS: { id: Forma; rotulo: string; icone: keyof typeof Feather.glyphMap }[] = [
  { id: 'Pix', rotulo: 'Pix', icone: 'zap' },
  { id: 'Cartão', rotulo: 'Cartão', icone: 'credit-card' },
  { id: 'Dinheiro', rotulo: 'Dinheiro', icone: 'dollar-sign' },
  { id: 'Pendente', rotulo: 'Pagar depois', icone: 'clock' },
];
const ICONE_MODO: Record<Modo, keyof typeof Feather.glyphMap> = { Retirada: 'shopping-bag', Delivery: 'truck', Encomenda: 'calendar' };
const reais = (centavos: number) => brl(centavos / 100);
const doisDig = (n: number) => String(n).padStart(2, '0');

export default function NovoPedidoMobile({
  pedidoEditando = null,
  clienteInicialId,
  aoFechar,
  aoSalvo,
}: {
  pedidoEditando?: Pedido | null;
  clienteInicialId?: string; // aberto pela ficha do cliente: já vem escolhido
  aoFechar: () => void;
  aoSalvo: (p: Pedido, editado: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const { config } = useConfigLoja();
  const escopo = useEscopoRevendedora();
  const { revendedoras } = useRevenda();
  const vitrine = useEstoqueVitrine();
  const editando = pedidoEditando;

  // PREENCHIMENTO INICIAL (novo ou edição)
  const inicial = useMemo(() => {
    const p = editando;
    if (!p) return null;
    const cart: Record<string, number> = {};
    const promo: Record<string, Motivo> = {};
    p.itens.forEach((it) => {
      const id = it.produtoId ?? vitrine.find((v) => v.nome === it.nome)?.id;
      if (!id) return;
      cart[id] = (cart[id] ?? 0) + it.quantidade;
      if (it.comDesconto) promo[id] = (it.motivoPromocao as Motivo) || 'Próximo a vencer';
    });
    const entrega = p.observacoes?.startsWith('Entrega: ') ? p.observacoes.slice(9) : '';
    const d = p.dataEntrega ? new Date(p.dataEntrega) : null;
    const formas: Record<Pedido['formaPagamento'], Forma> = { pix: 'Pix', cartao_credito: 'Cartão', cartao_debito: 'Cartão', dinheiro: 'Dinheiro', pendente: 'Pendente' };
    return {
      cart,
      promo,
      cliente: p.clienteId ?? BALCAO,
      modo: (p.tipoPedido === 'sob_encomenda' ? 'Encomenda' : entrega ? 'Delivery' : 'Retirada') as Modo,
      endereco: entrega,
      notas: entrega ? '' : p.observacoes ?? '',
      data: d ? `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}/${d.getFullYear()} ${doisDig(d.getHours())}:${doisDig(d.getMinutes())}` : '',
      forma: (p.status === 'pendente' ? 'Pendente' : formas[p.formaPagamento]) as Forma,
      sinalModo: 'valor' as const,
      sinalValor: p.tipoPedido === 'sob_encomenda' ? p.valorSinalPago.toFixed(2).replace('.', ',') : '',
    };
  }, []);

  const [etapa, setEtapa] = useState<'produtos' | 'finalizar' | 'pronto'>('produtos');
  const [cart, setCart] = useState<Record<string, number>>(inicial?.cart ?? {});
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todos');
  const [soDisponiveis, setSoDisponiveis] = useState(true);
  const [clienteId, setClienteId] = useState<string>(inicial?.cliente ?? clienteInicialId ?? '');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [gavetaClientes, setGavetaClientes] = useState(false);
  const [formCliente, setFormCliente] = useState(false);
  const [promo, setPromo] = useState<Record<string, Motivo>>(inicial?.promo ?? {});
  const [promoEscolhendo, setPromoEscolhendo] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>(inicial?.modo ?? 'Retirada');
  const [forma, setForma] = useState<Forma | ''>(inicial?.forma ?? '');
  const [notas, setNotas] = useState(inicial?.notas ?? '');
  const [endereco, setEndereco] = useState(inicial?.endereco ?? '');
  const [data, setData] = useState(inicial?.data ?? '');
  const [recebido, setRecebido] = useState('');
  const [sinalModo, setSinalModo] = useState<'porcentagem' | 'valor'>(inicial?.sinalModo ?? 'porcentagem');
  const [sinalValor, setSinalValor] = useState(inicial?.sinalValor ?? '');
  const [criado, setCriado] = useState<Pedido | null>(null);
  const [copiado, setCopiado] = useState(false);

  // CLIENTES (revendedora só vende para os dela)
  const clientesDb = useClientes().filter(
    (c) => (c.status === 'ativo' || c.id === editando?.clienteId) && (!escopo.ehRevendedora || c.revendedoraId === escopo.revendedoraId)
  );
  const clienteSel = clientesDb.find((c) => c.id === clienteId);

  // PRODUTOS (na edição, o que o próprio pedido tirou do estoque volta a contar)
  const devolveNaEdicao = !!editando && (pedidoBaixouEstoque(editando) || !!editando.revendedoraId);
  const noOriginal = (id: string) => (devolveNaEdicao ? editando!.itens.filter((it) => it.produtoId === id).reduce((a, it) => a + it.quantidade, 0) : 0);
  const produtos = useMemo(
    () =>
      vitrine
        .filter((p) => produtoAtivo(p) && (!escopo.ehRevendedora || escopo.sabores.some((x) => x.produtoId === p.id)))
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          detalhe: p.detalhe,
          categoria: p.categoria,
          preco: Math.round(p.preco * 100),
          desconto: p.desconto ? Math.round(p.desconto * 100) : 0,
          custo: Math.round(p.custo * 100),
          estoque: (escopo.ehRevendedora ? escopo.sabores.find((x) => x.produtoId === p.id)?.saldo ?? 0 : p.estoque) + noOriginal(p.id),
        })),
    [vitrine, escopo.ehRevendedora, escopo.sabores]
  );
  type Prod = (typeof produtos)[number];
  const categorias = ['Todos', ...new Set(produtos.map((p) => p.categoria))];
  const enc = modo === 'Encomenda';
  const emPromo = (p: Prod) => p.desconto > 0 && !!promo[p.id];
  const precoEf = (p: Prod) => (emPromo(p) ? Math.max(p.preco - p.desconto, 0) : p.preco);
  const mudar = (p: Prod, d: number) =>
    setCart((c) => ({ ...c, [p.id]: Math.max(0, Math.min(enc ? 999 : p.estoque, (c[p.id] ?? 0) + d)) }));

  const q = busca.trim().toLowerCase();
  const visiveis = produtos.filter((p) => (categoria === 'Todos' || p.categoria === categoria) && (!q || p.nome.toLowerCase().includes(q)) && (!soDisponiveis || p.estoque > 0));
  const escolhidos = produtos.filter((p) => (cart[p.id] ?? 0) > 0);
  const qtd = escolhidos.reduce((a, p) => a + (cart[p.id] ?? 0), 0);
  const total = escolhidos.reduce((a, p) => a + (cart[p.id] ?? 0) * precoEf(p), 0);
  const desconto = escolhidos.reduce((a, p) => a + (emPromo(p) ? (cart[p.id] ?? 0) * p.desconto : 0), 0);

  // COMISSÃO (cliente de revendedora ou venda da própria revendedora)
  const revDoPedido = escopo.ehRevendedora ? escopo.revendedora : clienteSel?.revendedoraId ? revendedoras.find((r) => r.id === clienteSel.revendedoraId) ?? null : null;
  const comissaoItem = (p: Prod) =>
    revDoPedido
      ? comissaoDaVenda(
          {
            id: '',
            revendedoraId: revDoPedido.id,
            data: '',
            total: ((cart[p.id] ?? 0) * precoEf(p)) / 100,
            status: 'pago',
            itens: [{ produtoId: p.id, nome: p.nome, quantidade: cart[p.id] ?? 0, precoUnitario: precoEf(p) / 100, comDesconto: emPromo(p) }],
          } as any,
          revDoPedido
        )
      : 0;

  // PAGAMENTO
  const sinalNum = parseFloat(sinalValor.replace(',', '.')) || 0;
  const sinalCent = sinalModo === 'porcentagem' ? Math.round((total * sinalNum) / 100) : Math.round(sinalNum * 100);
  const sinalInvalido = sinalModo === 'porcentagem' ? sinalNum > 100 : sinalCent > total;
  const pagoAgora = forma === 'Pendente' ? (editando ? Math.min(Math.round(editando.valorSinalPago * 100), total) : 0) : enc ? Math.min(sinalCent, total) : total;
  const saldo = total - pagoAgora;
  const recebidoCent = Math.round((parseFloat(recebido.replace(',', '.')) || 0) * 100);

  const pendencia =
    qtd === 0
      ? 'Adicione pelo menos um produto'
      : clienteId === ''
      ? 'Escolha quem está comprando para finalizar'
      : modo === 'Delivery' && !endereco.trim()
      ? 'Informe o endereço de entrega'
      : enc && !data
      ? 'Informe a data e o horário da encomenda'
      : forma === ''
      ? 'Escolha a forma de pagamento para finalizar'
      : enc && forma !== 'Pendente' && sinalInvalido
      ? 'O sinal não pode passar do total'
      : forma === 'Dinheiro' && recebidoCent < pagoAgora
      ? 'Valor recebido menor que o valor a pagar'
      : null;
  const valido = pendencia === null;

  const finalizar = () => {
    if (!valido) return;
    const itens = escolhidos.map((p) => ({
      produtoId: p.id,
      custoUnitario: p.custo / 100,
      nome: p.nome,
      categoria: p.categoria,
      quantidade: cart[p.id] ?? 0,
      precoUnitario: precoEf(p) / 100,
      desconto: emPromo(p) ? p.desconto / 100 : 0,
      comDesconto: emPromo(p),
      motivoPromocao: emPromo(p) ? promo[p.id] : undefined,
      totalItem: ((cart[p.id] ?? 0) * precoEf(p)) / 100,
    }));
    const custoTotal = escolhidos.reduce((a, p) => a + (cart[p.id] ?? 0) * p.custo, 0) / 100;
    const formas = { Pix: 'pix', Cartão: 'cartao_credito', Dinheiro: 'dinheiro', Pendente: 'pendente' } as const;
    const tipoPedido = enc ? 'sob_encomenda' : 'pronta_entrega';

    if (editando) {
      const formaAntiga = editando.formaPagamento === 'cartao_debito' && forma === 'Cartão' ? 'cartao_debito' : null;
      const atualizado: Pedido = {
        ...editando,
        clienteId: clienteId === BALCAO ? null : clienteSel?.id ?? editando.clienteId,
        clienteNome: clienteId === BALCAO ? 'Venda Avulsa (Balcão)' : clienteSel?.nome ?? editando.clienteNome,
        clienteTelefone: clienteId === BALCAO ? null : clienteSel?.telefone ?? editando.clienteTelefone,
        clienteEmail: clienteId === BALCAO ? null : clienteSel?.email ?? editando.clienteEmail,
        tipoPedido,
        tag: editando.revendedoraId ? editando.tag : tipoPedido === 'sob_encomenda' ? 'Encomenda' : 'Pronta Entrega',
        formaPagamento: formaAntiga ?? formas[forma as Forma] ?? 'pix',
        itens: itens.map((it, idx) => ({ ...it, id: `${editando.id}-it-${idx}` })),
        total: total / 100,
        valorSinalPago: pagoAgora / 100,
        saldoNaEntrega: saldo / 100,
        status: saldo > 0 ? 'pendente' : 'pago',
        custoTotal,
        dataEntrega: tipoPedido === 'sob_encomenda' ? lerDataEntrega(data) : null,
        statusProducao:
          editando.revendedoraId || editando.tipoPedido === tipoPedido ? editando.statusProducao : tipoPedido === 'sob_encomenda' ? 'a_fazer' : 'pronto',
        observacoes: notas.trim() || (modo === 'Delivery' && endereco ? `Entrega: ${endereco}` : null),
      };
      editarPedido(atualizado);
      aoSalvo(atualizado, true);
      setCriado(atualizado);
      setEtapa('pronto');
      return;
    }

    const novo = criarPedido({
      clienteNome: clienteId === BALCAO ? null : clienteSel?.nome ?? null,
      clienteId: clienteId === BALCAO ? null : clienteSel?.id ?? null,
      tipoPedido,
      formaPagamento: formas[forma as Forma] ?? 'pix',
      itens,
      total: total / 100,
      valorSinalPago: pagoAgora / 100,
      saldoNaEntrega: saldo / 100,
      custoTotal,
      dataEntrega: enc ? lerDataEntrega(data) : null,
      observacoes: notas.trim() || (modo === 'Delivery' && endereco ? `Entrega: ${endereco}` : null),
      revendedoraId: escopo.revendedoraId,
    });
    aoSalvo(novo, false);
    setCriado(novo);
    setEtapa('pronto');
  };

  const recomecar = () => {
    setEtapa('produtos');
    setCart({});
    setPromo({});
    setClienteId('');
    setModo('Retirada');
    setForma('');
    setNotas('');
    setEndereco('');
    setData('');
    setRecebido('');
    setSinalModo('porcentagem');
    setSinalValor('');
    setCriado(null);
  };

  const cadastrado = (c: ClienteCadastrado) => {
    salvarCliente(cadastroDoFormulario(c));
    setClienteId(c.id);
    setFormCliente(false);
    setGavetaClientes(false);
  };

  const modos: Modo[] = escopo.ehRevendedora ? ['Retirada', 'Delivery'] : ['Retirada', 'Delivery', 'Encomenda'];
  const termo = buscaCliente.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, '');
  const clientesFiltrados = clientesDb.filter(
    (c) => !termo || c.nome.toLowerCase().includes(termo) || (!!digitos && (c.telefone ?? '').replace(/\D/g, '').includes(digitos)) || (c.tag ?? '').toLowerCase().includes(termo)
  );
  const rotuloCliente = clienteId === BALCAO ? 'Balcão avulso' : clienteSel?.nome ?? '';
  const titulo = editando ? `Editar pedido ${editando.codigoDisplay}` : escopo.ehRevendedora ? 'Nova venda' : 'Novo pedido';
  const rodapeBase = Math.max(insets.bottom, 12) + 8;

  // ======================= ETAPA 3: CONFIRMADO =======================
  if (etapa === 'pronto' && criado) {
    const mensagem = mensagemWhatsAppDoPedido(criado, config);
    const enviar = () => {
      const url = linkWhatsAppDoPedido(criado, mensagem);
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
      else Linking.openURL(url).catch(() => {});
    };
    return (
      <Modal visible animationType="slide" onRequestClose={aoFechar} presentationStyle="fullScreen">
        <SafeAreaView style={s.tela} edges={['top']}>
          <ScrollView contentContainerStyle={[s.conteudo, { paddingTop: 24, paddingBottom: 120 + insets.bottom }]}>
            <View style={[s.bloco, sombra, { alignItems: 'center' }]}>
              <View style={s.ok}>
                <Feather name="check" size={28} color={cor.verde} />
              </View>
              <T titulo style={s.okTitulo}>{editando ? 'Pedido atualizado!' : 'Pedido confirmado!'}</T>
              <T style={s.medio}>
                <T style={s.forte}>{criado.codigoDisplay}</T> · {criado.clienteNome}
                {clienteSel?.tag ? ` · ${clienteSel.tag}` : ''}
              </T>
              <View style={s.wrapCentro}>
                <Etiqueta texto={`${qtd} ${qtd === 1 ? 'item' : 'itens'}`} />
                <Etiqueta texto={modo} />
                <Etiqueta texto={saldo > 0 ? `Falta ${reais(saldo)}` : `Pago · ${forma}`} bg={saldo > 0 ? cor.ambarClaro : '#DCFCE7'} fg={saldo > 0 ? cor.ambarTexto : cor.verde} />
              </View>
              <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 6 }}>
                {escolhidos.map((p) => (
                  <View key={p.id} style={s.linha}>
                    <T style={[s.forte, { width: 30 }]}>{cart[p.id]}x</T>
                    <View style={{ flex: 1 }}>
                      <T style={s.medioForte}>{p.nome}</T>
                      {emPromo(p) && <T style={s.promoTexto}>Promoção · {promo[p.id]}</T>}
                    </View>
                    <T style={[s.forte, numeros]}>{reais((cart[p.id] ?? 0) * precoEf(p))}</T>
                  </View>
                ))}
                <View style={[s.linhaEntre, s.divisa]}>
                  <T style={s.forte}>Total</T>
                  <T titulo style={[s.totalGrande, numeros]}>{reais(total)}</T>
                </View>
              </View>
            </View>
            <View style={[s.bloco, sombra]}>
              <View>
                <T titulo style={s.blocoTitulo}>Mensagem para o cliente</T>
                <T style={s.suave}>{criado.clienteTelefone || 'Sem telefone: você escolhe o contato'}</T>
              </View>
              <View style={s.mensagem}>
                <T style={s.mensagemTexto}>{mensagem}</T>
              </View>
              {!config.chavePix && <T style={s.suave}>Cadastre a chave PIX em Configurações para ela sair na mensagem.</T>}
              <View style={{ gap: 8 }}>
                <Botao rotulo="Enviar no WhatsApp" variante="verde" icone="message-circle" altura={50} aoTocar={enviar} />
                <Botao
                  rotulo={copiado ? 'Copiado!' : 'Copiar mensagem'}
                  variante="secundario"
                  icone={copiado ? 'check' : 'copy'}
                  altura={50}
                  style={{ borderColor: cor.verdeBorda }}
                  aoTocar={async () => {
                    await Clipboard.setStringAsync(mensagem);
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 2000);
                  }}
                />
              </View>
            </View>
          </ScrollView>
          <View style={[s.rodape, s.linha, { paddingBottom: rodapeBase }]}>
            <Botao rotulo="Fechar" variante="secundario" aoTocar={aoFechar} style={{ flex: 1 }} />
            {!editando && <Botao rotulo="Novo pedido" aoTocar={recomecar} style={{ flex: 1 }} />}
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ======================= ETAPAS 1 E 2 =======================
  const naEtapa1 = etapa === 'produtos';
  return (
    <Modal visible animationType="slide" onRequestClose={() => (naEtapa1 ? aoFechar() : setEtapa('produtos'))} presentationStyle="fullScreen">
      <SafeAreaView style={s.tela} edges={['top']}>
        <View style={s.topo}>
          <TouchableOpacity
            style={s.icone44}
            onPress={() => (naEtapa1 ? aoFechar() : setEtapa('produtos'))}
            accessibilityRole="button"
            accessibilityLabel={naEtapa1 ? 'Fechar sem salvar' : 'Voltar para produtos'}>
            <Feather name={naEtapa1 ? 'x' : 'chevron-left'} size={23} color={cor.texto} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T style={s.topoTitulo}>{naEtapa1 ? titulo : 'Finalizar pedido'}</T>
            <T style={s.topoSub}>{naEtapa1 ? 'Etapa 1 de 2 · Produtos' : 'Etapa 2 de 2 · Cliente e pagamento'}</T>
          </View>
          <View style={s.icone44} />
        </View>
        <View style={s.progresso}>
          <View style={[s.progressoCheio, { width: naEtapa1 ? '50%' : '100%' }]} />
        </View>

        {naEtapa1 ? (
          <>
            <View style={s.cabecalhoFixo}>
              <View style={s.segmento} accessibilityRole="radiogroup">
                {modos.map((m) => {
                  const on = modo === m;
                  return (
                    <TouchableOpacity key={m} style={[s.segItem, on && s.segItemOn]} onPress={() => setModo(m)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <Feather name={ICONE_MODO[m]} size={15} color={cor.texto} />
                      <T style={[s.segTexto, on && { fontWeight: '800' }]}>{m}</T>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={[s.busca, sombra]}>
                <Feather name="search" size={16} color={cor.textoSuave} />
                <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar um doce ou sabor…" placeholderTextColor={cor.textoSuave} style={s.buscaInput} accessibilityLabel="Buscar produto" />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.faixa}>
                <Opcao rotulo="Só disponíveis" ativo={soDisponiveis} aoTocar={() => setSoDisponiveis((v) => !v)} icone={soDisponiveis ? 'check' : 'plus'} style={s.chip} />
                <View style={s.separador} />
                {categorias.map((c) => (
                  <Opcao key={c} rotulo={c} ativo={categoria === c} aoTocar={() => setCategoria(c)} forte style={s.chip} />
                ))}
              </ScrollView>
            </View>
            <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: 110 + insets.bottom }]} keyboardShouldPersistTaps="handled">
              <View style={s.linhaEntre}>
                <T style={s.medioForte}>{escopo.ehRevendedora ? 'Meu estoque' : 'Vitrine do ateliê'}</T>
                <T style={s.suave}>{visiveis.length} produtos</T>
              </View>
              {visiveis.length === 0 ? (
                <View style={[s.bloco, { alignItems: 'center' }]}>
                  <T style={s.suave}>Nenhum produto encontrado.</T>
                </View>
              ) : (
                <View style={[s.lista, sombra]}>
                  {visiveis.map((p, i) => {
                    const n = cart[p.id] ?? 0;
                    const indisp = p.estoque === 0 && !enc;
                    const noMax = !enc && n >= p.estoque;
                    const disp = p.estoque > 0 ? `${p.estoque - n} disponíveis` : enc ? 'Sob encomenda' : 'Indisponível hoje';
                    return (
                      <View key={p.id} style={[s.produto, i > 0 && s.borda]}>
                        <Image source={fotoProduto} style={[s.foto, indisp && { opacity: 0.5 }]} />
                        <View style={{ flex: 1, minWidth: 0, gap: 2, opacity: indisp ? 0.5 : 1 }}>
                          <T style={s.produtoNome}>{p.nome}</T>
                          {!!p.detalhe && <T style={s.suave} numberOfLines={1}>{p.detalhe}</T>}
                          <T style={numeros}>
                            <T style={s.forte}>{reais(p.preco)}</T>
                            <T style={[s.dispTexto, { color: p.estoque > 0 ? (p.estoque <= 5 ? cor.ambar : cor.verde) : cor.textoSuave }]}> · {disp}</T>
                          </T>
                          {noMax && <T style={s.limite}>Limite do estoque atingido</T>}
                        </View>
                        {n === 0 ? (
                          <TouchableOpacity
                            style={[s.mais, { borderColor: indisp ? cor.borda : cor.azulBotao }]}
                            disabled={indisp}
                            onPress={() => mudar(p, 1)}
                            accessibilityRole="button"
                            accessibilityLabel={`Adicionar ${p.nome}`}>
                            <Feather name="plus" size={18} color={indisp ? cor.apagado : cor.azulTexto} />
                          </TouchableOpacity>
                        ) : (
                          <View style={s.passo}>
                            <TouchableOpacity style={s.passoBotao} onPress={() => mudar(p, -1)} accessibilityLabel={`Tirar um ${p.nome}`}>
                              <Feather name="minus" size={15} color="#FFFFFF" />
                            </TouchableOpacity>
                            <T style={[s.passoNum, numeros]}>{n}</T>
                            <TouchableOpacity style={[s.passoBotao, noMax && { opacity: 0.4 }]} disabled={noMax} onPress={() => mudar(p, 1)} accessibilityLabel={`Mais um ${p.nome}`}>
                              <Feather name="plus" size={15} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <View style={[s.rodape, { paddingBottom: rodapeBase }]}>
              {qtd === 0 ? (
                <View style={{ alignItems: 'center', minHeight: 54, justifyContent: 'center' }}>
                  <T style={s.forte}>Toda delícia começa aqui</T>
                  <T style={s.suave}>Seu pedido está esperando o primeiro doce.</T>
                </View>
              ) : (
                <TouchableOpacity style={s.continuar} onPress={() => setEtapa('finalizar')} accessibilityRole="button" activeOpacity={0.9}>
                  <View style={s.contador}>
                    <T style={s.contadorTexto}>{qtd}</T>
                  </View>
                  <T titulo style={[s.continuarTotal, numeros]}>{reais(total)}</T>
                  <View style={s.continuarAcao}>
                    <T style={s.continuarTexto}>Continuar</T>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: 170 + insets.bottom }]} keyboardShouldPersistTaps="handled">
              {/* CLIENTE */}
              <View style={[s.bloco, sombra]}>
                <T titulo style={s.blocoTitulo}>
                  Quem está comprando? <T style={{ color: cor.vermelhoForte }}>*</T>
                </T>
                <TouchableOpacity
                  style={[s.cliente, clienteId ? s.clienteOk : s.clienteVazio]}
                  onPress={() => setGavetaClientes(true)}
                  accessibilityRole="button">
                  <View style={[s.avatar, { backgroundColor: clienteId ? cor.azulClaro : '#FFFFFF' }]}>
                    {clienteId ? <T style={s.avatarTexto}>{(rotuloCliente[0] ?? '?').toUpperCase()}</T> : <Feather name="plus" size={18} color={cor.azulTexto} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={[s.produtoNome, !clienteId && { color: cor.azulTexto }]}>
                      {rotuloCliente || 'Escolher cliente'}
                      {clienteSel?.tag ? <T style={s.suave}>  {clienteSel.tag}</T> : null}
                    </T>
                    <T style={s.suave}>
                      {clienteId === BALCAO
                        ? 'Venda sem cadastro'
                        : clienteSel
                        ? `${clienteSel.telefone || 'Sem telefone'}${clienteSel.revendedoraId && !escopo.ehRevendedora ? ' · cliente de revendedora' : ''}`
                        : 'Buscar, cadastrar ou balcão avulso'}
                    </T>
                  </View>
                  {!!clienteId && <T style={s.link}>Trocar</T>}
                </TouchableOpacity>
              </View>

              {/* ENTREGA */}
              <View style={[s.bloco, sombra]}>
                <View style={s.linhaEntre}>
                  <T titulo style={s.blocoTitulo}>{modo}</T>
                  <TouchableOpacity onPress={() => setEtapa('produtos')}>
                    <T style={s.link}>Alterar</T>
                  </TouchableOpacity>
                </View>
                {modo === 'Encomenda' && (
                  <View style={{ gap: 6 }}>
                    <T style={s.rotuloCampo}>Data e horário da encomenda</T>
                    <TextInput value={data} onChangeText={setData} placeholder="Ex: 25/10 14:00" placeholderTextColor={cor.textoSuave} style={[s.campo, !data && { borderColor: cor.azul }]} />
                  </View>
                )}
                {modo === 'Delivery' && (
                  <View style={{ gap: 6 }}>
                    <T style={s.rotuloCampo}>Endereço de entrega</T>
                    <TextInput value={endereco} onChangeText={setEndereco} placeholder="Endereço de entrega" placeholderTextColor={cor.textoSuave} style={[s.campo, !endereco && { borderColor: cor.azul }]} />
                  </View>
                )}
                {modo === 'Retirada' && <T style={s.suave}>O cliente retira no ateliê.</T>}
              </View>

              {/* SEU PEDIDO */}
              <View style={[s.bloco, sombra, { gap: 4 }]}>
                <View style={[s.linhaEntre, { paddingBottom: 6 }]}>
                  <T titulo style={s.blocoTitulo}>Seu pedido · {qtd}</T>
                  <TouchableOpacity onPress={() => setEtapa('produtos')}>
                    <T style={s.link}>+ Produtos</T>
                  </TouchableOpacity>
                </View>
                {escolhidos.map((p) => {
                  const n = cart[p.id] ?? 0;
                  const ep = emPromo(p);
                  const com = comissaoItem(p);
                  return (
                    <View key={p.id} style={[s.itemCarrinho, s.borda]}>
                      <View style={[s.linha, { alignItems: 'baseline' }]}>
                        <T style={[s.produtoNome, { flex: 1, minWidth: 0 }]}>{p.nome}</T>
                        <T style={[s.forte, numeros, { fontSize: 14 }]}>{reais(n * precoEf(p))}</T>
                      </View>
                      <View style={s.linha}>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <T style={[s.suave, numeros]}>{ep ? `${reais(precoEf(p))} un. (era ${reais(p.preco)})` : `${reais(p.preco)} un.`}</T>
                          {ep && <T style={s.promoTexto}>Promoção −{reais(p.desconto)}/un · {promo[p.id]}</T>}
                          {com > 0 && <T style={[s.comissaoTexto, numeros]}>Comissão {brl(com)}</T>}
                          {!enc && n >= p.estoque && <T style={s.limite}>{escopo.ehRevendedora ? `Você tem só ${p.estoque} com você` : `Só ${p.estoque} no estoque`}</T>}
                        </View>
                        {p.desconto > 0 && (
                          <TouchableOpacity
                            style={[s.etiquetaPromo, ep && s.etiquetaPromoOn]}
                            onPress={() => {
                              if (ep) {
                                const np = { ...promo };
                                delete np[p.id];
                                setPromo(np);
                              } else setPromoEscolhendo(promoEscolhendo === p.id ? null : p.id);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: ep }}
                            accessibilityLabel={ep ? `Tirar promoção de ${p.nome}` : `Marcar promoção em ${p.nome} (−${reais(p.desconto)} por unidade)`}>
                            <Feather name="tag" size={17} color={ep ? '#FFFFFF' : cor.ambar} />
                          </TouchableOpacity>
                        )}
                        <View style={s.passoClaro}>
                          <TouchableOpacity style={s.passoBotao} onPress={() => mudar(p, -1)} accessibilityLabel={`Tirar um ${p.nome}`}>
                            <Feather name="minus" size={14} color={cor.texto} />
                          </TouchableOpacity>
                          <T style={[s.passoNumEscuro, numeros]}>{n}</T>
                          <TouchableOpacity style={[s.passoBotao, !enc && n >= p.estoque && { opacity: 0.4 }]} disabled={!enc && n >= p.estoque} onPress={() => mudar(p, 1)} accessibilityLabel={`Mais um ${p.nome}`}>
                            <Feather name="plus" size={14} color={cor.texto} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {promoEscolhendo === p.id && (
                        <View style={s.motivo}>
                          <T style={s.promoTexto}>Motivo da promoção:</T>
                          <View style={s.linha}>
                            {(['Próximo a vencer', 'Compra em lote'] as Motivo[]).map((m) => (
                              <TouchableOpacity
                                key={m}
                                style={s.motivoBotao}
                                onPress={() => {
                                  setPromo({ ...promo, [p.id]: m });
                                  setPromoEscolhendo(null);
                                }}>
                                <T style={s.promoTexto}>{m}</T>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
                <View style={[s.borda, { paddingTop: 10, gap: 6 }]}>
                  <T style={s.rotuloCampo}>
                    Algum cuidado especial? <T style={s.suave}>(opcional)</T>
                  </T>
                  <TextInput value={notas} onChangeText={setNotas} placeholder="Ex.: embalagem para presente" placeholderTextColor={cor.textoSuave} multiline style={[s.campo, { height: 72, paddingTop: 12, textAlignVertical: 'top' }]} />
                </View>
              </View>

              {/* PAGAMENTO */}
              <View style={[s.bloco, sombra]}>
                <T titulo style={s.blocoTitulo}>Pagamento</T>
                <View style={s.grade2}>
                  {FORMAS.map((f) => (
                    <Opcao key={f.id} rotulo={f.rotulo} ativo={forma === f.id} aoTocar={() => setForma(f.id)} icone={f.icone} style={s.formaCelula} textoStyle={{ fontSize: 14, fontWeight: '800' }} />
                  ))}
                </View>
                {enc && forma !== '' && forma !== 'Pendente' && (
                  <View style={s.caixa}>
                    <T style={s.rotuloCampo}>Sinal pago agora</T>
                    <View style={s.linha}>
                      <View style={s.segPequeno}>
                        {(['porcentagem', 'valor'] as const).map((m) => (
                          <TouchableOpacity key={m} style={[s.segPequenoItem, sinalModo === m && { backgroundColor: '#FFFFFF' }]} onPress={() => setSinalModo(m)} accessibilityRole="radio" accessibilityState={{ selected: sinalModo === m }}>
                            <T style={s.forte}>{m === 'porcentagem' ? '%' : 'R$'}</T>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={[s.campoSinal, sinalInvalido && { borderColor: cor.vermelhoForte }]}>
                        <TextInput
                          value={sinalValor}
                          onChangeText={(t) => setSinalValor(t.replace(/[^\d,]/g, ''))}
                          placeholder={sinalModo === 'porcentagem' ? 'Ex: 50' : '0,00'}
                          placeholderTextColor={cor.textoSuave}
                          keyboardType="decimal-pad"
                          style={s.inputSinal}
                          accessibilityLabel="Valor do sinal"
                        />
                        <T style={s.suaveForte}>{sinalModo === 'porcentagem' ? '%' : 'R$'}</T>
                      </View>
                    </View>
                  </View>
                )}
                {forma === 'Dinheiro' && (
                  <View style={s.caixa}>
                    <T style={s.rotuloCampo}>Valor recebido (R$)</T>
                    <TextInput value={recebido} onChangeText={setRecebido} placeholder="0,00" placeholderTextColor={cor.textoSuave} keyboardType="decimal-pad" style={[s.campo, { backgroundColor: '#FFFFFF' }]} />
                    <T style={[s.forte, numeros, { color: cor.verde }]}>Troco: {reais(Math.max(0, recebidoCent - pagoAgora))}</T>
                  </View>
                )}
                <View style={[s.borda, { paddingTop: 10, gap: 6 }]}>
                  {desconto > 0 && (
                    <View style={s.linhaEntre}>
                      <T style={[s.medio, { color: cor.ambar }]}>Desconto de promoção</T>
                      <T style={[s.medio, numeros, { color: cor.ambar }]}>−{reais(desconto)}</T>
                    </View>
                  )}
                  <View style={s.linhaEntre}>
                    <T style={s.medio}>Pago agora</T>
                    <T style={[s.forte, numeros, { color: cor.verde }]}>{reais(pagoAgora)}</T>
                  </View>
                  <View style={s.linhaEntre}>
                    <T style={s.medio}>A receber na entrega</T>
                    <T style={[s.forte, numeros, { color: cor.ambar }]}>{reais(saldo)}</T>
                  </View>
                </View>
              </View>
            </ScrollView>
            <View style={[s.rodape, { paddingBottom: rodapeBase, gap: 10 }]}>
              <View style={s.linha}>
                <View style={[s.ponto, { backgroundColor: valido ? cor.verde : cor.ambar }]} />
                <T style={[s.dicaRodape, { color: valido ? cor.verde : cor.ambar }]}>
                  {pendencia ?? (forma === 'Pendente' ? 'Pagamento será realizado depois' : `Pagamento informado: ${forma}`)}
                </T>
                <T titulo style={[s.totalRodape, numeros]}>{reais(total)}</T>
              </View>
              <Botao
                rotulo={editando ? 'Salvar alterações' : forma === 'Pendente' ? 'Criar pedido pendente' : 'Finalizar pedido'}
                aoTocar={finalizar}
                desativado={!valido}
                altura={56}
              />
            </View>
          </>
        )}

        {/* QUEM ESTÁ COMPRANDO */}
        <Gaveta aberta={gavetaClientes} aoFechar={() => setGavetaClientes(false)} titulo="Quem está comprando?">
          <View style={s.busca}>
            <Feather name="search" size={16} color={cor.textoSuave} />
            <TextInput value={buscaCliente} onChangeText={setBuscaCliente} placeholder="Nome, telefone ou tag" placeholderTextColor={cor.textoSuave} style={s.buscaInput} accessibilityLabel="Buscar cliente" />
          </View>
          <View style={s.linha}>
            <TouchableOpacity style={[s.atalhoCliente, { backgroundColor: cor.azulClaro }]} onPress={() => setFormCliente(true)} accessibilityRole="button">
              <Feather name="user-plus" size={17} color={cor.azulTexto} />
              <T style={[s.forte, { color: cor.azulTexto }]}>Novo cliente</T>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.atalhoCliente, { backgroundColor: cor.pistacheClaro }]}
              onPress={() => {
                setClienteId(BALCAO);
                setGavetaClientes(false);
              }}
              accessibilityRole="button">
              <View style={{ alignItems: 'center' }}>
                <T style={[s.forte, { color: cor.pistacheTexto }]}>Balcão avulso</T>
                <T style={[s.suave, { color: cor.pistacheTexto }]}>Venda sem cadastro</T>
              </View>
            </TouchableOpacity>
          </View>
          {clientesFiltrados.length === 0 && <T style={s.suave}>Nenhum cliente encontrado.</T>}
          {clientesFiltrados.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[s.clienteLinha, s.borda]}
              onPress={() => {
                setClienteId(c.id);
                setGavetaClientes(false);
              }}
              accessibilityRole="button">
              <View style={[s.avatar, { backgroundColor: cor.azulClaro }]}>
                <T style={s.avatarTexto}>{c.nome.slice(0, 1).toUpperCase()}</T>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={s.produtoNome} numberOfLines={1}>{c.nome}</T>
                <T style={s.suave} numberOfLines={1}>{c.telefone || 'Sem telefone'}</T>
              </View>
              {!!c.tag && <Etiqueta texto={c.tag} />}
            </TouchableOpacity>
          ))}
        </Gaveta>

        <ClienteFormMobile visible={formCliente} onClose={() => setFormCliente(false)} onSalvo={cadastrado} revendedoraFixa={escopo.revendedoraId} />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  icone44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topoTitulo: { fontSize: 15, fontWeight: '800' },
  topoSub: { fontSize: 12, fontWeight: '600', color: cor.textoSuave },
  progresso: { height: 4, marginHorizontal: 16, borderRadius: 2, backgroundColor: cor.borda, marginBottom: 6 },
  progressoCheio: { height: '100%', borderRadius: 2, backgroundColor: cor.azulBotao },
  cabecalhoFixo: { gap: 12, paddingTop: 8, paddingBottom: 6 },
  segmento: { flexDirection: 'row', marginHorizontal: 16, padding: 4, gap: 4, borderRadius: 18, backgroundColor: '#E8EEF5' },
  segItem: { flex: 1, height: 40, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segItemOn: { backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTexto: { fontSize: 13, fontWeight: '600' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, marginHorizontal: 16, paddingHorizontal: 14, borderRadius: 23, backgroundColor: '#FFFFFF' },
  buscaInput: { flex: 1, minWidth: 0, fontSize: 14, color: cor.texto, padding: 0 },
  faixa: { gap: 6, paddingHorizontal: 16, alignItems: 'center' },
  chip: { minHeight: 36, borderRadius: 18, borderWidth: 1 },
  separador: { width: 1, height: 22, backgroundColor: cor.apagado, marginHorizontal: 2 },
  conteudo: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  lista: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  produto: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  borda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  foto: { width: 56, height: 56, borderRadius: 16, backgroundColor: cor.pistacheClaro },
  produtoNome: { fontSize: 14, fontWeight: '800', lineHeight: 18 },
  dispTexto: { fontSize: 12, fontWeight: '700' },
  limite: { fontSize: 12, fontWeight: '700', color: cor.ambar },
  mais: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  passo: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, backgroundColor: cor.azulBotao },
  passoClaro: { flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 19, backgroundColor: cor.cinzaClaro },
  passoBotao: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  passoNum: { minWidth: 18, textAlign: 'center', color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  passoNumEscuro: { minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: cor.borda,
  },
  continuar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingLeft: 18, paddingRight: 8, borderRadius: 28, backgroundColor: cor.azulBotao },
  contador: { minWidth: 26, height: 26, paddingHorizontal: 6, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  contadorTexto: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  continuarTotal: { flex: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  continuarAcao: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)' },
  continuarTexto: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  bloco: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, gap: 10 },
  blocoTitulo: { fontSize: 15, fontWeight: '700' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wrapCentro: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  suave: { fontSize: 12, color: cor.textoSuave },
  suaveForte: { fontWeight: '800', color: cor.textoSuave },
  medio: { fontSize: 13, color: cor.textoMedio },
  medioForte: { fontSize: 13, fontWeight: '800', color: cor.textoMedio },
  forte: { fontSize: 13, fontWeight: '800', color: cor.texto },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  cliente: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5 },
  clienteOk: { borderColor: cor.borda, borderStyle: 'solid', backgroundColor: '#FFFFFF' },
  clienteVazio: { borderColor: cor.azul, borderStyle: 'dashed', backgroundColor: '#F5F9FD' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontWeight: '800', color: cor.azulTexto },
  rotuloCampo: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  campo: { height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: cor.borda, paddingHorizontal: 14, fontSize: 15, color: cor.texto },
  itemCarrinho: { paddingVertical: 10, gap: 8 },
  promo: { height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderColor: cor.borda, justifyContent: 'center' },
  promoOn: { backgroundColor: cor.ambarClaro, borderColor: '#FCD34D' },
  promoTexto: { fontSize: 12, fontWeight: '800', color: cor.ambarTexto },
  comissao: { height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: cor.azulClaro, justifyContent: 'center' },
  comissaoTexto: { fontSize: 12, fontWeight: '700', color: cor.azulTexto },
  etiquetaPromo: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: '#FCD34D', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  etiquetaPromoOn: { backgroundColor: '#D97706', borderColor: '#D97706' },
  motivo: { padding: 12, borderRadius: 16, backgroundColor: cor.ambarFundo, gap: 8 },
  motivoBotao: { flex: 1, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  grade2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formaCelula: { width: '48.5%', minHeight: 52, borderRadius: 16, justifyContent: 'flex-start', paddingHorizontal: 14 },
  caixa: { padding: 12, borderRadius: 16, backgroundColor: cor.fundo, gap: 8 },
  segPequeno: { flexDirection: 'row', padding: 3, borderRadius: 14, backgroundColor: cor.borda },
  segPequenoItem: { width: 46, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  campoSinal: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: '#FFFFFF' },
  inputSinal: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: '800', color: cor.texto, padding: 0 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  dicaRodape: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  totalRodape: { fontSize: 18, fontWeight: '700' },
  atalhoCliente: { flex: 1, height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  clienteLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 8 },
  ok: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  okTitulo: { fontSize: 24, fontWeight: '700' },
  divisa: { borderTopWidth: 1, borderTopColor: cor.borda, paddingTop: 10 },
  totalGrande: { fontSize: 20, fontWeight: '700' },
  mensagem: { padding: 14, borderRadius: 16, backgroundColor: cor.verdeClaro },
  mensagemTexto: { fontSize: 13, lineHeight: 19, color: '#14532D' },
});
