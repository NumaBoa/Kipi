import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { atualizarPedido, chaveDoDia, rotuloEntrega, useClientes, usePedidos, type Pedido } from '@/lib/clientesPedidos';
import { pedidosDoEscopo, useEscopoRevendedora } from '@/lib/minhaRevenda';
import { produtoAtivo, useEstoqueVitrine } from '@/lib/estoqueVitrine';
import { useConfigLoja } from '@/lib/configuracoes';
import TabBar from '@/components/mobile/TabBar';
import { Aviso, Botao, Etiqueta, Gaveta, Opcao, T, useAviso } from '@/components/mobile/ui';
import { brl, cor, ETAPAS_PRODUCAO, numeros, sombra } from '@/components/mobile/tema';
import { abrirWhatsApp, copiarComprovante } from './acoes';
import { GavetaAcoes, GavetaCancelar, GavetaReceber, type AcaoPedido } from './GavetasPedido';
import DetalhePedidoMobile from './DetalhePedidoMobile';
import NovoPedidoMobile from './NovoPedidoMobile';

// ============================================================================
// PEDIDOS (celular) — o que se faz todo dia primeiro: ver os pedidos e agir.
// Indicadores ficam num cartão de resumo; o detalhe completo, numa gaveta.
// Mesmos dados e regras da versão de computador (pedidos.tsx).
// ============================================================================
type Periodo = 'hoje' | '7dias' | 'mes' | 'personalizar';
type Tipo = 'todos' | 'pronta_entrega' | 'sob_encomenda';
type Pagamento = 'todos' | 'pendentes' | 'pagos';
type Gav = null | 'periodo' | 'filtros' | 'resumo' | 'receber' | 'estoque';

const ROTULO_PERIODO: Record<Periodo, string> = { hoje: 'Hoje', '7dias': 'Últimos 7 dias', mes: 'Este mês', personalizar: 'Personalizado' };
const MEDALHA = ['#FDE68A', '#E2E8F0', '#FED7AA'];

const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const chaveValida = (t: string) => /^\d{4}-\d{2}-\d{2}$/.test(t);

// Intervalo [início, fim] do período em chaves AAAA-MM-DD, e o intervalo anterior de mesmo tamanho
const intervalos = (p: Periodo, ini: string, fim: string) => {
  const hoje = new Date();
  if (p === 'hoje') return { atual: [chaveDoDia(hoje), chaveDoDia(hoje)], anterior: [chaveDoDia(somarDias(hoje, -1)), chaveDoDia(somarDias(hoje, -1))] };
  if (p === '7dias') return { atual: [chaveDoDia(somarDias(hoje, -6)), chaveDoDia(hoje)], anterior: [chaveDoDia(somarDias(hoje, -13)), chaveDoDia(somarDias(hoje, -7))] };
  if (p === 'mes') {
    const i = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ai = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const af = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return { atual: [chaveDoDia(i), chaveDoDia(hoje)], anterior: [chaveDoDia(ai), chaveDoDia(af)] };
  }
  const a = chaveValida(ini) ? ini : '0000-00-00';
  const b = chaveValida(fim) ? fim : '9999-12-31';
  const dias = chaveValida(ini) && chaveValida(fim) ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1 : 0;
  const di = new Date(a + 'T12:00:00');
  return { atual: [a, b], anterior: dias > 0 ? [chaveDoDia(somarDias(di, -dias)), chaveDoDia(somarDias(di, -1))] : null };
};

// "Hoje", "Ontem" ou o dia da semana; e a data curta
const tituloDoDia = (chave: string) => {
  const hoje = chaveDoDia(new Date());
  const ontem = chaveDoDia(somarDias(new Date(), -1));
  const d = new Date(chave + 'T12:00:00');
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const curta = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  const titulo = chave === hoje ? 'Hoje' : chave === ontem ? 'Ontem' : semana.charAt(0).toUpperCase() + semana.slice(1);
  return { titulo, data: chave === hoje || chave === ontem ? `${semana}, ${curta}` : curta };
};

export default function PedidosMobile() {
  const insets = useSafeAreaInsets();
  const { config } = useConfigLoja();
  const escopo = useEscopoRevendedora();
  const rev = escopo.ehRevendedora;
  const todosPedidos = pedidosDoEscopo(usePedidos(), escopo.revendedoraId);
  const pedidos = useMemo(() => todosPedidos.filter((p) => !p.deletado), [todosPedidos]);
  const clientes = useClientes();
  const vitrine = useEstoqueVitrine();
  const { msg, avisar } = useAviso();

  const [periodo, setPeriodo] = useState<Periodo>('7dias');
  const [dataIni, setDataIni] = useState(chaveDoDia(somarDias(new Date(), -30)));
  const [dataFim, setDataFim] = useState(chaveDoDia(new Date()));
  const [tipo, setTipo] = useState<Tipo>('todos');
  const [pag, setPag] = useState<Pagamento>('todos');
  const [vendedor, setVendedor] = useState('todos');
  const [gaveta, setGaveta] = useState<Gav>(null);
  const [buscaEst, setBuscaEst] = useState('');
  const [catEst, setCatEst] = useState('Todas');
  const [receber, setReceber] = useState<Pedido | null>(null);
  const [acoes, setAcoes] = useState<Pedido | null>(null);
  const [cancelar, setCancelar] = useState<Pedido | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [fabCompacto, setFabCompacto] = useState(false);
  const ultimoY = useRef(0);
  const [novo, setNovo] = useState<{ aberto: boolean; editando: Pedido | null }>({ aberto: false, editando: null });

  const tagDoCliente = (p: Pedido) => (p.clienteId ? clientes.find((c) => c.id === p.clienteId)?.tag || null : null);
  const { atual, anterior } = intervalos(periodo, dataIni, dataFim);
  const noIntervalo = (p: Pedido, i: string[] | null) => !!i && p.diaChave >= i[0] && p.diaChave <= i[1];

  const filtrar = (p: Pedido) =>
    (tipo === 'todos' || p.tipoPedido === tipo) &&
    (pag === 'todos' || (pag === 'pendentes' ? p.status === 'pendente' : p.status === 'pago')) &&
    (vendedor === 'todos' || p.vendedor === vendedor);
  const visiveis = pedidos.filter((p) => noIntervalo(p, atual) && filtrar(p));
  const doAnterior = pedidos.filter((p) => noIntervalo(p, anterior) && filtrar(p));

  // INDICADORES (mesmo cálculo da versão de computador)
  const saldo = (p: Pedido) => (p.saldoNaEntrega > 0 ? p.saldoNaEntrega : p.total - p.valorSinalPago);
  const totalVendido = visiveis.reduce((a, p) => a + p.total, 0);
  const totalAnterior = doAnterior.reduce((a, p) => a + p.total, 0);
  const variacao = totalAnterior > 0 ? Math.round(((totalVendido - totalAnterior) / totalAnterior) * 100) : null;
  const itensVendidos = visiveis.reduce((a, p) => a + p.itens.reduce((b, it) => b + it.quantidade, 0), 0);
  // A receber não "vence" com o período: soma tudo o que está pendente (igual à lista que abre ao tocar)
  const pendentesTodos = pedidos.filter((p) => p.status === 'pendente');
  const aReceber = pendentesTodos.reduce((a, p) => a + saldo(p), 0);
  const temReceber = pendentesTodos.length > 0;
  const clientesDevendo = new Set(pendentesTodos.map((p) => p.clienteId ?? p.clienteNome)).size;
  const comissao = visiveis.reduce((a, p) => a + escopo.comissaoDoPedido(p), 0);

  const estoque = useMemo(
    () =>
      rev
        ? escopo.sabores.map((x) => {
            const v = vitrine.find((p) => p.id === x.produtoId);
            return { id: x.produtoId || x.nome, nome: x.nome, categoria: v?.categoria ?? 'Revenda', preco: v?.preco ?? 0, estoque: x.saldo, status: x.status === 'esgotado' ? 'zerado' : x.status === 'baixo' ? 'baixo' : 'normal' };
          })
        : vitrine.filter(produtoAtivo).map((p) => ({
            id: p.id,
            nome: p.nome,
            categoria: p.categoria,
            preco: p.preco,
            estoque: p.estoque,
            status: p.estoque === 0 ? 'zerado' : p.estoque <= p.estoqueMinimo ? 'baixo' : 'normal',
          })),
    [vitrine, rev, escopo.sabores]
  );
  const totalEstoque = estoque.reduce((a, e) => a + e.estoque, 0);
  const baixos = estoque.filter((e) => e.status !== 'normal').length;

  // TOP 3 (todos os pedidos, como na versão de computador)
  const top3Produtos = useMemo(() => {
    const m = new Map<string, { nome: string; categoria: string; qtd: number; fat: number }>();
    pedidos.forEach((p) =>
      p.itens.forEach((it) => {
        const x = m.get(it.nome) ?? { nome: it.nome, categoria: it.categoria, qtd: 0, fat: 0 };
        x.qtd += it.quantidade;
        x.fat += it.totalItem;
        m.set(it.nome, x);
      })
    );
    return [...m.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 3);
  }, [pedidos]);
  const top3Clientes = useMemo(() => {
    const m = new Map<string, { nome: string; tag: string | null; itens: number; total: number; pedidos: number }>();
    pedidos.forEach((p) => {
      if (p.clienteNome.toLowerCase().includes('venda avulsa')) return;
      const k = p.clienteId ?? `nome:${p.clienteNome.toLowerCase()}`;
      const x = m.get(k) ?? { nome: p.clienteNome, tag: tagDoCliente(p), itens: 0, total: 0, pedidos: 0 };
      x.pedidos += 1;
      x.total += p.total;
      x.itens += p.itens.reduce((a, it) => a + it.quantidade, 0);
      m.set(k, x);
    });
    return [...m.values()].sort((a, b) => b.itens - a.itens).slice(0, 3);
  }, [pedidos, clientes]);

  // AGRUPADO POR DIA (mais recente primeiro)
  const grupos = useMemo(() => {
    const m = new Map<string, Pedido[]>();
    visiveis.forEach((p) => m.set(p.diaChave, [...(m.get(p.diaChave) ?? []), p]));
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([chave, lista]) => ({ chave, lista: lista.sort((a, b) => b.data.localeCompare(a.data)) }));
  }, [visiveis]);

  const todosPendentes = pedidos.filter((p) => p.status === 'pendente').sort((a, b) => saldo(b) - saldo(a));
  const vendedores = [...new Set(pedidos.map((p) => p.vendedor))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const nFiltros = (tipo !== 'todos' ? 1 : 0) + (vendedor !== 'todos' ? 1 : 0);
  const limpar = () => {
    setTipo('todos');
    setPag('todos');
    setVendedor('todos');
  };

  const avancar = (p: Pedido) => {
    const i = ETAPAS_PRODUCAO.findIndex((e) => e.id === p.statusProducao);
    if (i < 0 || i >= ETAPAS_PRODUCAO.length - 1) return;
    const prox = ETAPAS_PRODUCAO[i + 1];
    atualizarPedido({ ...p, statusProducao: prox.id });
    avisar(`${p.codigoDisplay} agora está: ${prox.label}`);
  };

  const escolherAcao = async (a: AcaoPedido) => {
    const p = acoes;
    setAcoes(null);
    if (!p) return;
    if (a === 'receber') setReceber(p);
    if (a === 'comprovante') {
      await copiarComprovante(p, config);
      avisar('Mensagem formatada copiada para o WhatsApp!');
    }
    if (a === 'detalhes') setDetalheId(p.id);
    if (a === 'editar') setNovo({ aberto: true, editando: p });
    if (a === 'cancelar') setCancelar(p);
  };

  // Contagem por situação de pagamento, dentro do período e dos outros filtros
  const semPag = pedidos.filter((p) => noIntervalo(p, atual) && (tipo === 'todos' || p.tipoPedido === tipo) && (vendedor === 'todos' || p.vendedor === vendedor));
  const abasPagamento: { id: Pagamento; rotulo: string; qtd: number; cor: string }[] = [
    { id: 'todos', rotulo: 'Todos', qtd: semPag.length, cor: cor.texto },
    { id: 'pendentes', rotulo: 'A receber', qtd: semPag.filter((p) => p.status === 'pendente').length, cor: cor.vermelho },
    { id: 'pagos', rotulo: 'Pagos', qtd: semPag.filter((p) => p.status === 'pago').length, cor: cor.verde },
  ];
  const etiquetasExtras = [
    ...(tipo !== 'todos' ? [{ rotulo: tipo === 'sob_encomenda' ? 'Encomendas' : 'Pronta entrega', limpar: () => setTipo('todos') }] : []),
    ...(vendedor !== 'todos' ? [{ rotulo: `Vendedor: ${vendedor}`, limpar: () => setVendedor('todos') }] : []),
  ];
  const rotuloPeriodo = periodo === 'personalizar' && chaveValida(dataIni) && chaveValida(dataFim) ? `${dataIni.slice(8)}/${dataIni.slice(5, 7)} – ${dataFim.slice(8)}/${dataFim.slice(5, 7)}` : ROTULO_PERIODO[periodo];

  const qEst = buscaEst.trim().toLowerCase();
  const categoriasEst = ['Todas', ...new Set(estoque.map((e) => e.categoria))];
  const listaEst = estoque.filter((e) => (catEst === 'Todas' || e.categoria === catEst) && (!qEst || e.nome.toLowerCase().includes(qEst)));

  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={64}
        onScroll={(e) => {
          // Rolando para baixo: o botão vira só "+" para não cobrir os pedidos
          const y = e.nativeEvent.contentOffset.y;
          const compacto = y > ultimoY.current && y > 80;
          if (compacto !== fabCompacto) setFabCompacto(compacto);
          ultimoY.current = y;
        }}>
        {/* TOPO: título, período (texto) e filtros; embaixo, a situação de pagamento */}
        <View style={s.topo}>
          <View style={{ flex: 1, gap: 2 }}>
            <T titulo style={s.titulo}>Pedidos</T>
            <TouchableOpacity style={s.periodo} onPress={() => setGaveta('periodo')} accessibilityRole="button" accessibilityLabel={`Período: ${rotuloPeriodo}. Trocar`}>
              <T style={s.periodoTexto}>{rotuloPeriodo}</T>
              <Feather name="chevron-down" size={16} color={cor.azulTexto} />
            </TouchableOpacity>
          </View>
          {!rev && <TouchableOpacity style={[s.redondo, sombra]} onPress={() => setGaveta('filtros')} accessibilityRole="button" accessibilityLabel={`Filtros, ${nFiltros} ativos`}>
            <Feather name="filter" size={18} color={nFiltros ? cor.azulBotao : cor.texto} />
            {nFiltros > 0 && (
              <View style={s.seloFiltro}>
                <T style={s.seloFiltroTexto}>{nFiltros}</T>
              </View>
            )}
          </TouchableOpacity>}
        </View>

        <View style={s.segmento} accessibilityRole="tablist">
          {abasPagamento.map((a) => {
            const on = pag === a.id;
            return (
              <TouchableOpacity key={a.id} style={[s.segItem, on && s.segItemOn]} onPress={() => setPag(a.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <T style={[s.segTexto, on && s.segTextoOn]}>{a.rotulo}</T>
                <T style={[s.segNum, on && { color: a.cor }]}>{a.qtd}</T>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* RESUMO */}
        <View style={[s.resumo, sombra]}>
          <View style={s.resumoLinha}>
            <TouchableOpacity style={s.resumoCelula} onPress={() => setGaveta('resumo')} accessibilityRole="button">
              <T style={s.resumoRotulo}>Vendido</T>
              <T titulo style={[s.resumoValor, numeros]}>{brl(totalVendido)}</T>
              <T style={[s.resumoNota, { color: variacao === null ? cor.textoSuave : variacao >= 0 ? cor.verde : cor.vermelho }]}>
                {variacao === null ? 'Sem período anterior' : `${variacao >= 0 ? '+' : ''}${variacao}% vs anterior`}
              </T>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.resumoCelula, { backgroundColor: temReceber ? cor.vermelhoClaro : cor.verdeClaro }]}
              onPress={() => setGaveta('receber')}
              accessibilityRole="button">
              <T style={[s.resumoRotulo, { color: temReceber ? cor.vermelho : cor.verde }]}>A receber</T>
              <T titulo style={[s.resumoValor, numeros, { color: temReceber ? cor.vermelho : cor.verde }]}>{brl(aReceber)}</T>
              <T style={[s.resumoNota, { color: temReceber ? cor.vermelho : cor.verde }]}>
                {temReceber ? `${clientesDevendo} ${clientesDevendo === 1 ? 'cliente' : 'clientes'} ›` : 'Tudo recebido ✓'}
              </T>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.resumoRodape} onPress={() => setGaveta('resumo')} accessibilityRole="button">
            <T style={s.link}>Ver resumo do período</T>
            <Feather name="chevron-right" size={16} color={cor.azulTexto} />
          </TouchableOpacity>
        </View>

        {etiquetasExtras.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.faixa, { paddingTop: 12 }]}>
            {etiquetasExtras.map((e) => (
              <TouchableOpacity key={e.rotulo} style={s.etqFiltro} onPress={e.limpar} accessibilityLabel={`Remover filtro ${e.rotulo}`}>
                <T style={s.etqFiltroTexto}>{e.rotulo}</T>
                <Feather name="x" size={14} color={cor.azulTexto} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* LISTA POR DIA: cliente e valor em destaque; o resto fica no detalhe */}
        {grupos.map((g) => {
          const { titulo, data } = tituloDoDia(g.chave);
          return (
            <View key={g.chave} style={s.grupo}>
              <View style={s.grupoTopo}>
                <T titulo style={s.grupoTitulo}>{titulo}</T>
                <T style={s.grupoData}>{data}</T>
                <T style={[s.grupoTotal, numeros]}>{brl(g.lista.reduce((a, p) => a + p.total, 0))}</T>
              </View>
              <View style={[s.lista, sombra]}>
                {g.lista.map((p, i) => {
                  const pendente = p.status === 'pendente';
                  const iE = ETAPAS_PRODUCAO.findIndex((e) => e.id === p.statusProducao);
                  const e = ETAPAS_PRODUCAO[Math.max(0, iE)];
                  const tag = tagDoCliente(p);
                  const parcial = pendente && p.valorSinalPago > 0;
                  const encomenda = !p.revendedoraId && p.tipoPedido === 'sob_encomenda';
                  // Etapa de produção só em pedido do ateliê que ainda não foi entregue
                  const mostraEtapa = !p.revendedoraId && iE < 3;
                  const temAcoes = mostraEtapa || pendente;
                  return (
                    <View key={p.id} style={[s.pedido, i > 0 && s.pedidoBorda]}>
                      <TouchableOpacity
                        style={s.pedidoInfo}
                        activeOpacity={0.7}
                        onPress={() => setDetalheId(p.id)}
                        onLongPress={() => setAcoes(p)}
                        accessibilityRole="button"
                        accessibilityLabel={`Pedido de ${p.clienteNome}, ${brl(p.total)}, ${pendente ? 'pendente' : 'pago'}`}
                        accessibilityHint="Toque para ver detalhes; toque e segure para mais ações">
                        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                          <View style={s.linhaNome}>
                            <T style={s.cliente} numberOfLines={1}>{p.clienteNome}</T>
                            {!!tag && <Etiqueta texto={tag} />}
                          </View>
                          <T style={s.itens} numberOfLines={1}>{p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(' • ')}</T>
                          {encomenda && (
                            <View style={s.entrega}>
                              <Feather name="calendar" size={12} color={cor.ambar} />
                              <T style={s.entregaTexto}>Encomenda · {rotuloEntrega(p.dataEntrega)}</T>
                            </View>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <T titulo style={[s.valor, numeros, { color: pendente ? cor.vermelho : cor.verde }]}>{brl(p.total)}</T>
                          {parcial && <T style={[s.falta, numeros]}>falta {brl(saldo(p))}</T>}
                        </View>
                      </TouchableOpacity>
                      {temAcoes && (
                        <View style={s.pedidoAcoes}>
                          {mostraEtapa && (
                            <TouchableOpacity
                              style={[s.status, { backgroundColor: e.bg }]}
                              onPress={() => avancar(p)}
                              accessibilityRole="button"
                              accessibilityLabel={`Produção: ${e.label}. Tocar avança a etapa`}>
                              <View style={[s.statusPonto, { backgroundColor: e.fg }]} />
                              <T style={[s.statusTexto, { color: e.fg }]}>{e.label}</T>
                              <Feather name="chevron-right" size={13} color={e.fg} />
                            </TouchableOpacity>
                          )}
                          <View style={{ flex: 1 }} />
                          {pendente && (
                            <TouchableOpacity style={s.receber} onPress={() => setReceber(p)} accessibilityRole="button" accessibilityLabel={`Receber de ${p.clienteNome}`}>
                              <T style={s.receberTexto}>Receber</T>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {grupos.length === 0 && (
          <View style={[s.vazio, sombra]}>
            <Feather name="inbox" size={34} color={cor.apagado} />
            <T titulo style={s.vazioTitulo}>Nenhum pedido encontrado</T>
            <T style={s.vazioTexto}>Ajuste o período ou os filtros.</T>
            {nFiltros > 0 && <Botao rotulo="Limpar filtros" variante="secundario" altura={42} aoTocar={limpar} />}
          </View>
        )}
      </ScrollView>

      {/* NOVO PEDIDO */}
      <TouchableOpacity
        style={[s.fab, fabCompacto && s.fabCompacto, { bottom: 78 + Math.max(insets.bottom, 8) }]}
        onPress={() => setNovo({ aberto: true, editando: null })}
        accessibilityRole="button"
        accessibilityLabel="Novo pedido"
        activeOpacity={0.9}>
        <Feather name="plus" size={22} color="#FFFFFF" />
        {!fabCompacto && <T style={s.fabTexto}>Novo pedido</T>}
      </TouchableOpacity>

      <Aviso msg={msg} base={150 + insets.bottom} />
      <TabBar ativa="/pedidos" />

      {/* GAVETA: PERÍODO */}
      <Gaveta aberta={gaveta === 'periodo'} aoFechar={() => setGaveta(null)} titulo="Período" subtitulo="Quais pedidos aparecem na lista">
        <View style={{ gap: 8 }}>
          {(['hoje', '7dias', 'mes', 'personalizar'] as Periodo[]).map((p) => (
            <Opcao key={p} rotulo={p === 'personalizar' ? 'Personalizar datas' : ROTULO_PERIODO[p]} ativo={periodo === p} aoTocar={() => setPeriodo(p)} style={s.opcaoLarga} textoStyle={{ fontSize: 15 }} />
          ))}
        </View>
        {periodo === 'personalizar' && (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { r: 'De', v: dataIni, set: setDataIni },
                { r: 'Até', v: dataFim, set: setDataFim },
              ].map((c) => (
                <View key={c.r} style={{ flex: 1, gap: 4 }}>
                  <T style={s.rotuloCampo}>{c.r}</T>
                  <TextInput value={c.v} onChangeText={c.set} placeholder="AAAA-MM-DD" placeholderTextColor={cor.textoSuave} style={s.campo} accessibilityLabel={`Data ${c.r}`} />
                </View>
              ))}
            </View>
            <T style={s.dica}>Consultando pedidos entre {dataIni} e {dataFim}</T>
          </View>
        )}
        <Botao rotulo="Aplicar" aoTocar={() => setGaveta(null)} />
      </Gaveta>

      {/* GAVETA: FILTROS */}
      <Gaveta aberta={gaveta === 'filtros'} aoFechar={() => setGaveta(null)} titulo="Filtros" subtitulo="Tipo de pedido e vendedor">
        {!rev && (
          <View style={{ gap: 8 }}>
            <T style={s.rotuloCampo}>Tipo</T>
            <View style={s.wrap}>
              {([['todos', 'Todos'], ['pronta_entrega', 'Pronta entrega'], ['sob_encomenda', 'Sob encomenda']] as [Tipo, string][]).map(([id, r]) => (
                <Opcao key={id} rotulo={r} ativo={tipo === id} aoTocar={() => setTipo(id)} forte />
              ))}
            </View>
          </View>
        )}
        {!rev && (
          <View style={{ gap: 8 }}>
            <T style={s.rotuloCampo}>Vendedor</T>
            <View style={s.wrap}>
              {['todos', ...vendedores].map((v) => (
                <Opcao key={v} rotulo={v === 'todos' ? 'Todos' : v} ativo={vendedor === v} aoTocar={() => setVendedor(v)} forte />
              ))}
            </View>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Botao rotulo="Limpar" variante="secundario" aoTocar={limpar} style={{ flex: 1 }} />
          <Botao rotulo={`Ver ${visiveis.length} pedidos`} aoTocar={() => setGaveta(null)} style={{ flex: 1.4 }} />
        </View>
      </Gaveta>

      {/* GAVETA: RESUMO */}
      <Gaveta aberta={gaveta === 'resumo'} aoFechar={() => setGaveta(null)} titulo={`Resumo · ${rotuloPeriodo}`} subtitulo="Indicadores e destaques do período">
        <View style={s.grade2}>
          <View style={s.kpi}>
            <T style={s.kpiRotulo}>Total vendido</T>
            <T titulo style={[s.kpiValor, numeros]}>{brl(totalVendido)}</T>
            <T style={[s.kpiNota, { color: cor.pistacheTexto }]}>{variacao === null ? 'Sem período anterior' : `${variacao >= 0 ? '+' : ''}${variacao}% vs anterior`}</T>
            <T style={s.kpiSub}>Faturamento acumulado</T>
          </View>
          <View style={s.kpi}>
            <T style={s.kpiRotulo}>{rev ? 'Minha comissão' : 'Itens vendidos'}</T>
            <T titulo style={[s.kpiValor, numeros]}>{rev ? brl(comissao) : `${itensVendidos} un.`}</T>
            <T style={[s.kpiNota, { color: cor.azulTexto }]}>{rev ? `${itensVendidos} vendidos` : `Média ${(itensVendidos / Math.max(1, visiveis.length)).toFixed(1)}/ped`}</T>
            <T style={s.kpiSub}>{rev ? 'Pelas vendas do período' : 'Volume de produção'}</T>
          </View>
          <TouchableOpacity style={[s.kpi, { backgroundColor: cor.vermelhoClaro }]} onPress={() => setGaveta('receber')}>
            <T style={[s.kpiRotulo, { color: cor.vermelho }]}>A receber ›</T>
            <T titulo style={[s.kpiValor, numeros, { color: cor.vermelho }]}>{brl(aReceber)}</T>
            <T style={[s.kpiNota, { color: cor.vermelho }]}>{pendentesTodos.length} pendentes</T>
            <T style={[s.kpiSub, { color: '#7F1D1D' }]}>Ver clientes devedores</T>
          </TouchableOpacity>
          <TouchableOpacity style={s.kpi} onPress={() => setGaveta('estoque')}>
            <T style={s.kpiRotulo}>{rev ? 'Estoque comigo ›' : 'Estoque geral ›'}</T>
            <T titulo style={[s.kpiValor, numeros]}>{totalEstoque} un.</T>
            <T style={[s.kpiNota, { color: cor.ambar }]}>{baixos} baixos</T>
            <T style={s.kpiSub}>Consultar cardápio</T>
          </TouchableOpacity>
        </View>
        <View style={{ gap: 10 }}>
          <View style={s.linhaEntre}>
            <T titulo style={s.subtitulo}>Top 3 Produtos</T>
            <T style={s.dica}>Campeões</T>
          </View>
          {top3Produtos.map((t, i) => (
            <View key={t.nome} style={s.top}>
              <View style={[s.medalha, { backgroundColor: MEDALHA[i] }]}><T style={s.medalhaTexto}>{i + 1}</T></View>
              <View style={{ flex: 1 }}>
                <T style={s.topNome}>{t.nome}</T>
                <T style={s.dica}>{t.categoria}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T style={[s.forte, numeros]}>{t.qtd} un.</T>
                <T style={[s.dica, numeros]}>{brl(t.fat)}</T>
              </View>
            </View>
          ))}
        </View>
        <View style={{ gap: 10 }}>
          <View style={s.linhaEntre}>
            <T titulo style={s.subtitulo}>Top 3 Clientes</T>
            <T style={s.dica}>Clientes VIP</T>
          </View>
          {top3Clientes.map((t, i) => (
            <View key={t.nome + i} style={s.top}>
              <View style={[s.medalha, { backgroundColor: MEDALHA[i] }]}><T style={s.medalhaTexto}>{i + 1}</T></View>
              <View style={s.iniciais}><T style={s.iniciaisTexto}>{t.nome.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</T></View>
              <View style={{ flex: 1 }}>
                <T style={s.topNome} numberOfLines={1}>{t.nome}{t.tag ? <T style={s.dica}>  {t.tag}</T> : null}</T>
                <T style={s.dica}>{t.pedidos} pedidos realizados</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T style={[s.forte, numeros, { color: cor.verde }]}>{t.itens} itens</T>
                <T style={[s.dica, numeros]}>{brl(t.total)}</T>
              </View>
            </View>
          ))}
        </View>
      </Gaveta>

      {/* GAVETA: A RECEBER */}
      <Gaveta aberta={gaveta === 'receber'} aoFechar={() => setGaveta(null)} titulo="A receber" subtitulo={rev ? 'Clientes que ainda te devem' : 'Pedidos com pagamento pendente'}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={[s.mini, { flex: 1.5, backgroundColor: cor.vermelhoClaro }]}>
            <T style={[s.miniRotulo, { color: cor.vermelho }]}>Total a receber</T>
            <T titulo style={[s.miniValor, numeros, { color: cor.vermelho }]}>{brl(todosPendentes.reduce((a, p) => a + saldo(p), 0))}</T>
          </View>
          <View style={s.mini}>
            <T style={s.miniRotulo}>Pedidos</T>
            <T titulo style={s.miniValor}>{todosPendentes.length}</T>
          </View>
          <View style={s.mini}>
            <T style={s.miniRotulo}>Clientes</T>
            <T titulo style={s.miniValor}>{new Set(todosPendentes.map((p) => p.clienteId ?? p.clienteNome)).size}</T>
          </View>
        </View>
        {todosPendentes.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 20, gap: 4 }}>
            <T style={s.forte}>Nada a receber</T>
            <T style={s.dica}>Todos os pedidos estão pagos.</T>
          </View>
        ) : (
          todosPendentes.map((p) => (
            <View key={p.id} style={s.devedor}>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={s.topNome} numberOfLines={1}>
                  {p.clienteNome}
                  {tagDoCliente(p) ? <T style={s.dica}>  {tagDoCliente(p)}</T> : null}
                </T>
                <T style={s.dica} numberOfLines={1}>
                  {p.codigoDisplay} · {p.dataDisplay}{rev ? '' : ` · ${p.vendedor}`}{p.valorSinalPago > 0 ? ` · já pagou ${brl(p.valorSinalPago)}` : ''}
                </T>
                <T style={[s.forte, numeros, { color: cor.vermelho }]}>{brl(saldo(p))}</T>
              </View>
              <TouchableOpacity style={s.wpp} onPress={() => abrirWhatsApp(p, config)} accessibilityLabel={`WhatsApp de ${p.clienteNome}`}>
                <Feather name="message-circle" size={18} color={cor.verde} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.receberGrande}
                onPress={() => {
                  setGaveta(null);
                  setReceber(p);
                }}>
                <T style={s.receberTexto}>Receber</T>
              </TouchableOpacity>
            </View>
          ))
        )}
      </Gaveta>

      {/* GAVETA: ESTOQUE */}
      <Gaveta aberta={gaveta === 'estoque'} aoFechar={() => setGaveta(null)} titulo={rev ? 'Estoque com você' : 'Cardápio e estoque'} subtitulo="Consulta rápida da vitrine">
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[
            { r: 'Unidades', v: totalEstoque, bg: cor.fundo, fg: cor.texto },
            { r: 'Produtos', v: estoque.length, bg: cor.fundo, fg: cor.texto },
            { r: 'Acabando', v: estoque.filter((e) => e.status === 'baixo').length, bg: cor.ambarClaro, fg: cor.ambarTexto },
            { r: 'Esgotados', v: estoque.filter((e) => e.status === 'zerado').length, bg: '#FEE2E2', fg: cor.vermelho },
          ].map((k) => (
            <View key={k.r} style={[s.mini, { backgroundColor: k.bg, paddingHorizontal: 8 }]}>
              <T style={[s.miniRotulo, { color: k.fg }]}>{k.r}</T>
              <T titulo style={[s.miniValor, { color: k.fg }]}>{k.v}</T>
            </View>
          ))}
        </View>
        <View style={s.busca}>
          <Feather name="search" size={16} color={cor.textoSuave} />
          <TextInput value={buscaEst} onChangeText={setBuscaEst} placeholder="Buscar produto..." placeholderTextColor={cor.textoSuave} style={s.buscaInput} accessibilityLabel="Buscar produto" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {categoriasEst.map((c) => (
            <Opcao key={c} rotulo={c} ativo={catEst === c} aoTocar={() => setCatEst(c)} forte style={{ minHeight: 36 }} />
          ))}
        </ScrollView>
        {listaEst.length === 0 && <T style={s.dica}>Nenhum produto encontrado.</T>}
        {listaEst.map((e) => (
          <View key={e.id} style={s.devedor}>
            <View style={{ flex: 1 }}>
              <T style={s.topNome}>{e.nome}</T>
              <T style={[s.dica, numeros]}>{e.categoria} · {brl(e.preco)}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T titulo style={[s.forte, numeros, { fontSize: 15 }]}>{e.estoque} un</T>
              <T style={[s.statusEst, { color: e.status === 'zerado' ? cor.vermelho : e.status === 'baixo' ? cor.ambar : cor.verde }]}>
                {e.status === 'zerado' ? 'Esgotado' : e.status === 'baixo' ? 'Acabando' : 'Disponível'}
              </T>
            </View>
          </View>
        ))}
      </Gaveta>

      <GavetaReceber pedido={receber} aoFechar={() => setReceber(null)} avisar={avisar} />
      <GavetaAcoes pedido={acoes} aoFechar={() => setAcoes(null)} aoEscolher={escolherAcao} />
      <GavetaCancelar pedido={cancelar} aoFechar={() => setCancelar(null)} avisar={avisar} />

      {detalheId && (
        <DetalhePedidoMobile
          pedidoId={detalheId}
          ocultarCustos={rev}
          aoFechar={() => setDetalheId(null)}
          aoEditar={(p) => {
            setDetalheId(null);
            setNovo({ aberto: true, editando: p });
          }}
        />
      )}
      {novo.aberto && (
        <NovoPedidoMobile
          pedidoEditando={novo.editando}
          aoFechar={() => setNovo({ aberto: false, editando: null })}
          aoSalvo={(p, editado) => avisar(editado ? `Pedido ${p.codigoDisplay} atualizado!` : `Pedido ${p.codigoDisplay} registrado com sucesso!`)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingRight: 16 },
  etiquetaTopo: { fontSize: 12, fontWeight: '700', color: cor.textoSuave },
  titulo: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  seloFiltro: { position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: cor.azulBotao, alignItems: 'center', justifyContent: 'center' },
  seloFiltroTexto: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  faixa: { gap: 8, paddingHorizontal: 20, paddingTop: 14 },
  periodo: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 32 },
  periodoTexto: { color: cor.azulTexto, fontSize: 14, fontWeight: '700' },
  segmento: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, padding: 4, gap: 4, borderRadius: 16, backgroundColor: '#E8EEF5' },
  segItem: { flex: 1, height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segItemOn: { backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTexto: { fontSize: 13, fontWeight: '600', color: cor.textoMedio },
  segTextoOn: { fontWeight: '800', color: cor.texto },
  segNum: { fontSize: 12, fontWeight: '800', color: cor.textoSuave },
  atalho: { minHeight: 38, borderRadius: 19, borderWidth: 1 },
  resumo: { marginHorizontal: 16, marginTop: 14, padding: 4, borderRadius: 22, backgroundColor: '#FFFFFF' },
  resumoLinha: { flexDirection: 'row', gap: 4 },
  resumoCelula: { flex: 1, padding: 12, borderRadius: 18, gap: 4 },
  resumoRotulo: { fontSize: 13, fontWeight: '600', color: cor.textoSuave },
  resumoValor: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  resumoNota: { fontSize: 12, fontWeight: '800' },
  resumoRodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 44, paddingHorizontal: 12 },
  resumoRodapeTexto: { flex: 1, fontSize: 13, color: cor.textoMedio },
  forte: { fontSize: 13, fontWeight: '800', color: cor.texto },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  etqFiltro: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingLeft: 12, paddingRight: 8, borderRadius: 16, backgroundColor: cor.azulClaro },
  etqFiltroTexto: { fontSize: 12, fontWeight: '800', color: cor.azulTexto },
  grupo: { paddingHorizontal: 16, paddingTop: 22 },
  grupoTopo: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 4, paddingBottom: 8 },
  grupoTitulo: { fontSize: 15, fontWeight: '700', color: cor.textoMedio },
  grupoData: { fontSize: 13, fontWeight: '500', color: cor.textoSuave },
  grupoTotal: { marginLeft: 'auto', fontSize: 13, fontWeight: '600', color: cor.textoSuave },
  grupoPend: { paddingHorizontal: 4, paddingBottom: 8, fontSize: 12, fontWeight: '800', color: cor.vermelho },
  lista: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  pedido: { paddingVertical: 14, paddingLeft: 16, paddingRight: 16, gap: 10 },
  pedidoBorda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  pedidoInfo: { flexDirection: 'row', gap: 12 },
  linhaNome: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  cliente: { flexShrink: 1, fontSize: 16, fontWeight: '700' },
  itens: { fontSize: 13, color: cor.textoSuave },
  entrega: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  entregaTexto: { fontSize: 12, fontWeight: '700', color: cor.ambar },
  falta: { fontSize: 12, fontWeight: '700', color: cor.vermelho },
  meta: { fontSize: 12, color: cor.textoSuave },
  valor: { fontSize: 17, fontWeight: '700' },
  pag: { fontSize: 12, fontWeight: '800' },
  pedidoAcoes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingLeft: 10, paddingRight: 10, borderRadius: 17 },
  statusPonto: { width: 8, height: 8, borderRadius: 4 },
  statusTexto: { fontSize: 12, fontWeight: '800' },
  receber: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: cor.azulBotao, justifyContent: 'center' },
  receberGrande: { height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: cor.azulBotao, justifyContent: 'center' },
  receberTexto: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  mais: { width: 38, height: 38, borderRadius: 19, backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center' },
  vazio: { margin: 16, marginTop: 24, padding: 28, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', gap: 6 },
  vazioTitulo: { fontSize: 15, fontWeight: '700' },
  vazioTexto: { fontSize: 13, color: cor.textoSuave, marginBottom: 8 },
  fab: {
    position: 'absolute',
    right: 16,
    height: 56,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 28,
    backgroundColor: cor.azulBotao,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: cor.azulBotao,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabCompacto: { width: 56, paddingLeft: 0, paddingRight: 0, justifyContent: 'center' },
  fabTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  opcaoLarga: { minHeight: 52, borderRadius: 16, justifyContent: 'flex-start', paddingHorizontal: 16 },
  rotuloCampo: { fontSize: 13, fontWeight: '800', color: cor.textoMedio },
  campo: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, paddingHorizontal: 12, fontSize: 15, color: cor.texto },
  dica: { fontSize: 12, color: cor.textoSuave },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grade2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48.5%', padding: 14, borderRadius: 18, backgroundColor: cor.fundo, gap: 3 },
  kpiRotulo: { fontSize: 12, fontWeight: '700', color: cor.textoSuave },
  kpiValor: { fontSize: 18, fontWeight: '700' },
  kpiNota: { fontSize: 11, fontWeight: '800' },
  kpiSub: { fontSize: 11, color: cor.textoSuave },
  linhaEntre: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  subtitulo: { fontSize: 15, fontWeight: '700' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medalha: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  medalhaTexto: { fontSize: 13, fontWeight: '800' },
  iniciais: { width: 36, height: 36, borderRadius: 18, backgroundColor: cor.azulClaro, alignItems: 'center', justifyContent: 'center' },
  iniciaisTexto: { fontSize: 12, fontWeight: '800', color: cor.azulTexto },
  topNome: { fontSize: 14, fontWeight: '700' },
  mini: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: cor.fundo, gap: 2 },
  miniRotulo: { fontSize: 11, fontWeight: '700', color: cor.textoSuave },
  miniValor: { fontSize: 16, fontWeight: '700' },
  devedor: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  wpp: { width: 44, height: 44, borderRadius: 22, backgroundColor: cor.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 14, borderRadius: 23, backgroundColor: cor.fundo },
  buscaInput: { flex: 1, minWidth: 0, fontSize: 14, color: cor.texto, padding: 0 },
  statusEst: { fontSize: 11, fontWeight: '800' },
});
