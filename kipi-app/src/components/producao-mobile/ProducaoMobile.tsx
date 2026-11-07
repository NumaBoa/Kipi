import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEstoqueVitrine, useEstoqueFreezer, produtoAtivo as produtoEstaAtivo } from '@/lib/estoqueVitrine';
import { usePedidos, encomendasEmAberto, resumoItens, rotuloEntrega, atualizarPedido, type Pedido } from '@/lib/clientesPedidos';
import { useInsumos, useFichas, receitaDoProduto, congelarMassas, assarDoFreezer } from '@/lib/insumos';
import { useHistoricoProducao, type RegistroProducao } from '@/lib/historicoProducao';
import { resumoDePerdas, ultimosDias, registrarDescarte, custoMaterialUnitario, MOTIVOS_DESCARTE, EMOJI_MOTIVO, type MotivoDescarte, type OrigemDescarte } from '@/lib/descarte';
import ReceitaMobile from '@/components/produtos-mobile/ReceitaMobile';
import TabBar from '@/components/mobile/TabBar';
import { Aviso, Botao, Gaveta, Opcao, T, useAviso } from '@/components/mobile/ui';
import { brl, cor, numeros, sombra } from '@/components/mobile/tema';

// ============================================================================
// PRODUÇÃO (celular) — para quem está na cozinha: primeiro os produtos (o que
// precisa assar sobe para o topo), depois as encomendas e o histórico.
// A fornada é registrada depois que sai do forno (sem timer).
// Mesmas regras e funções da versão de computador (producao.tsx).
// ============================================================================
const AZUL_FREEZER = '#3A3D9E';
const AZUL_FREEZER_ESCURO = '#3A3D9E';
const AZUL_FREEZER_CLARO = '#ECEBFA';
const AZUL_FREEZER_FUNDO = '#ECEBFA';
const LARANJA = '#9A6516';
const LARANJA_ESCURO = '#9A6516';
const LARANJA_CLARO = '#FBF0DC';
const LARANJA_FUNDO = '#FBF0DC';

const TEMPO_FORNO: Record<string, number> = { 'prod-1': 14, 'prod-2': 14, 'prod-4': 35, 'prod-6': 16, 'prod-9': 10, 'prod-11': 20, 'prod-12': 18 };
const TEMPO_FORNO_PADRAO = 15;
const STATUS_ENCOMENDA: Record<string, { label: string; fg: string; bg: string }> = {
  a_fazer: { label: 'A fazer', fg: '#4A3E37', bg: '#F3EEE7' },
  em_producao: { label: 'Em produção', fg: '#9A6516', bg: '#FBF0DC' },
  pronto: { label: 'Pronto', fg: '#3A3D9E', bg: '#ECEBFA' },
};
const PROXIMO: Record<string, { id: Pedido['statusProducao']; label: string } | undefined> = {
  a_fazer: { id: 'em_producao', label: 'Iniciar produção' },
  em_producao: { id: 'pronto', label: 'Marcar pronto' },
};
type Aba = 'produtos' | 'encomendas' | 'historico';
type PeriodoHist = 'hoje' | '7dias' | '30dias' | 'tudo';
type TipoHist = 'todos' | RegistroProducao['tipo'];
const ROTULO_PERIODO: Record<PeriodoHist, string> = { hoje: 'Hoje', '7dias': '7 dias', '30dias': '30 dias', tudo: 'Tudo' };
const ROTULO_TIPO: Record<TipoHist, string> = { todos: 'Todos', preparo_massa: 'Preparos', assar_fornada: 'Fornadas', perda: 'Descartes', ajuste: 'Ajustes' };
const VISUAL_TIPO: Record<RegistroProducao['tipo'], { acao: string; fg: string; bg: string; icone: keyof typeof MaterialCommunityIcons.glyphMap; sinal: string }> = {
  assar_fornada: { acao: 'Fornada registrada', fg: LARANJA, bg: LARANJA_CLARO, icone: 'fire', sinal: '+' },
  preparo_massa: { acao: 'Massa para o freezer', fg: AZUL_FREEZER, bg: AZUL_FREEZER_CLARO, icone: 'snowflake', sinal: '+' },
  perda: { acao: 'Descarte', fg: cor.vermelho, bg: '#FBE7E4', icone: 'trash-can-outline', sinal: '−' },
  ajuste: { acao: 'Ajuste de estoque', fg: cor.textoMedio, bg: cor.cinzaClaro, icone: 'pencil-outline', sinal: '' },
};
const POR_PAGINA = 15;

type ProdutoCozinha = {
  id: string;
  nome: string;
  categoria: string;
  emoji: string;
  tempo: number;
  freezer: number;
  vitrine: number;
  receita: ReturnType<typeof receitaDoProduto>;
};
type GavetaAtiva = null | 'preparar' | 'assar' | 'lote' | 'descartar' | 'filtroHist' | 'perdas';

export default function ProducaoMobile() {
  const vitrine = useEstoqueVitrine();
  const freezer = useEstoqueFreezer();
  const { fichas } = useFichas();
  const insumos = useInsumos();
  const historico = useHistoricoProducao();
  const encomendas = encomendasEmAberto(usePedidos());
  const { msg, avisar } = useAviso();

  const [aba, setAba] = useState<Aba>('produtos');
  const [busca, setBusca] = useState('');
  const [gaveta, setGaveta] = useState<GavetaAtiva>(null);
  const [alvoId, setAlvoId] = useState<string | null>(null);
  const [qtdPrep, setQtdPrep] = useState(12);
  const [descontar, setDescontar] = useState(true);
  const [qtdAssar, setQtdAssar] = useState(6);
  const [loteModo, setLoteModo] = useState<'preparo' | 'assar'>('preparo');
  const [lote, setLote] = useState<Record<string, number>>({});
  const [loteErro, setLoteErro] = useState<string | null>(null);
  const [descProd, setDescProd] = useState<string | null>(null);
  const [descBusca, setDescBusca] = useState('');
  const [descOrigem, setDescOrigem] = useState<OrigemDescarte>('vitrine');
  const [descQtd, setDescQtd] = useState(1);
  const [descMotivo, setDescMotivo] = useState<MotivoDescarte>('Vencido');
  const [descObs, setDescObs] = useState('');
  const [descErro, setDescErro] = useState<string | null>(null);
  const [histPer, setHistPer] = useState<PeriodoHist>('tudo');
  const [histTipo, setHistTipo] = useState<TipoHist>('todos');
  const [histBusca, setHistBusca] = useState('');
  const [histLimite, setHistLimite] = useState(POR_PAGINA);

  // Produtos produzidos aqui: todos os ativos (com ou sem receita; sem receita não desconta insumos)
  const produtos: ProdutoCozinha[] = useMemo(
    () =>
      vitrine
        .filter((v) => produtoEstaAtivo(v))
        .map((v) => ({
          id: v.id,
          nome: v.nome,
          categoria: v.categoria,
          emoji: v.emoji ?? '🧁',
          tempo: TEMPO_FORNO[v.id] ?? TEMPO_FORNO_PADRAO,
          freezer: freezer[v.id] ?? 0,
          vitrine: v.estoque,
          receita: receitaDoProduto(v.id, insumos),
        })),
    [vitrine, freezer, fichas, insumos]
  );
  const alvo = produtos.find((p) => p.id === alvoId) ?? null;

  // Atalhos de outras telas (Estoque Central, Produtos): ?assar=<id> ou ?preparar=<id>
  const { assar: atalhoAssar, preparar: atalhoPreparar, t: atalhoEm } = useLocalSearchParams<{ assar?: string; preparar?: string; t?: string }>();
  useEffect(() => {
    const pa = atalhoAssar ? produtos.find((p) => p.id === atalhoAssar) : undefined;
    if (pa && pa.freezer > 0) {
      setAlvoId(pa.id);
      setQtdAssar(Math.max(1, Math.min(6, pa.freezer)));
      setGaveta('assar');
      return;
    }
    const pp = atalhoPreparar ? produtos.find((p) => p.id === atalhoPreparar) : undefined;
    if (pp) {
      setAlvoId(pp.id);
      setQtdPrep(12);
      setGaveta('preparar');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atalhoAssar, atalhoPreparar, atalhoEm]);
  const horaDeAssar = (p: ProdutoCozinha) => p.vitrine <= 4 && p.freezer > 0;
  const fazerMassa = (p: ProdutoCozinha) => p.freezer <= 6;

  // Resumo
  const totalFreezer = produtos.reduce((a, p) => a + p.freezer, 0);
  const totalVitrine = produtos.reduce((a, p) => a + p.vitrine, 0);
  const semMassa = produtos.filter((p) => p.freezer === 0).length;
  const hoje = new Date().toDateString();
  const fornadasHoje = historico.filter((r) => r.tipo === 'assar_fornada' && new Date(r.data).toDateString() === hoje).length;
  const perdas = resumoDePerdas(historico, ultimosDias(30));
  const qtdAssarAgora = produtos.filter(horaDeAssar).length;
  const encomendasPendentes = encomendas.filter((e) => e.statusProducao !== 'pronto').length;

  // Lista de produtos: primeiro "hora de assar", depois "fazer massa", depois o resto
  const q = busca.trim().toLowerCase();
  const listaProdutos = produtos
    .filter((p) => !q || p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q))
    .map((p) => ({ p, ordem: horaDeAssar(p) ? 0 : fazerMassa(p) ? 1 : 2 }))
    .sort((a, b) => a.ordem - b.ordem || a.p.nome.localeCompare(b.p.nome, 'pt-BR'))
    .map((x) => x.p);

  // Histórico filtrado e agrupado por dia
  const histFiltrado = useMemo(() => {
    const agora = Date.now();
    const dias = { hoje: 0, '7dias': 7, '30dias': 30, tudo: Infinity }[histPer];
    const termo = histBusca.trim().toLowerCase();
    return [...historico]
      .sort((a, b) => b.data.localeCompare(a.data))
      .filter((r) => {
        if (histTipo !== 'todos' && r.tipo !== histTipo) return false;
        if (termo && !r.produtoNome.toLowerCase().includes(termo)) return false;
        if (histPer === 'hoje') return new Date(r.data).toDateString() === hoje;
        return (agora - new Date(r.data).getTime()) / 86400000 <= dias;
      });
  }, [historico, histPer, histTipo, histBusca, hoje]);
  const gruposHist = useMemo(() => {
    const ontem = new Date(Date.now() - 86400000).toDateString();
    const grupos: { titulo: string; itens: RegistroProducao[] }[] = [];
    histFiltrado.slice(0, histLimite).forEach((r) => {
      const d = new Date(r.data);
      const chave = d.toDateString();
      const titulo = chave === hoje ? 'Hoje' : chave === ontem ? 'Ontem' : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.titulo === titulo) ultimo.itens.push(r);
      else grupos.push({ titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), itens: [r] });
    });
    return grupos;
  }, [histFiltrado, histLimite, hoje]);

  // Ações
  const abrirPreparar = (p: ProdutoCozinha) => {
    setAlvoId(p.id);
    setQtdPrep(0); // sem sugestão: a pessoa informa quantas massas vai modelar
    setPrepErro(null);
    setGaveta('preparar');
  };
  const abrirAssar = (p: ProdutoCozinha) => {
    if (p.freezer <= 0) return;
    setAlvoId(p.id);
    setQtdAssar(Math.max(1, Math.min(6, p.freezer)));
    setGaveta('assar');
  };
  const abrirDescarte = (p?: ProdutoCozinha) => {
    setDescProd(p?.id ?? null);
    setDescOrigem(p && p.vitrine <= 0 ? 'freezer' : 'vitrine');
    setDescQtd(1);
    setDescMotivo('Vencido');
    setDescObs('');
    setDescBusca('');
    setDescErro(null);
    setGaveta('descartar');
  };
  const abrirLote = (modo: 'preparo' | 'assar') => {
    setLoteModo(modo);
    setLote({});
    setLoteErro(null);
    setGaveta('lote');
  };

  const [prepErro, setPrepErro] = useState<string | null>(null);
  const [receitaDe, setReceitaDe] = useState<string | null>(null);
  const ingredientes = (alvo?.receita ?? []).map((i) => {
    const precisa = i.quantidadePorUnidade * qtdPrep;
    return { ...i, precisa, ok: i.estoqueAtual >= precisa };
  });
  const faltaIngrediente = descontar && ingredientes.some((i) => !i.ok);

  const semReceita = !!alvo && alvo.receita.length === 0;
  const confirmarPreparo = () => {
    if (!alvo) return;
    if (qtdPrep <= 0) return setPrepErro('Informe quantas massas vai modelar.');
    congelarMassas(alvo.id, qtdPrep, descontar && !semReceita, 'preparo na Produção');
    setGaveta(null);
    avisar(`${qtdPrep} massas de ${alvo.nome} no freezer`);
  };
  const confirmarAssar = () => {
    if (!alvo) return;
    const qtd = Math.min(qtdAssar, alvo.freezer);
    if (qtd <= 0) return;
    assarDoFreezer(alvo.id, alvo.nome, qtd, alvo.freezer);
    setGaveta(null);
    avisar(`${qtd}x ${alvo.nome} prontos para venda`);
  };
  const confirmarLote = () => {
    const escolhidos = produtos.map((p) => ({ p, qtd: lote[p.id] ?? 0 })).filter((x) => x.qtd > 0);
    if (escolhidos.length === 0) {
      setLoteErro('Informe a quantidade de pelo menos um produto.');
      return;
    }
    if (loteModo === 'assar') {
      const semMassaSuf = escolhidos.find((x) => x.qtd > x.p.freezer);
      if (semMassaSuf) {
        setLoteErro(`${semMassaSuf.p.nome}: só há ${semMassaSuf.p.freezer} no freezer.`);
        return;
      }
      escolhidos.forEach(({ p, qtd }) => assarDoFreezer(p.id, p.nome, qtd, p.freezer));
    } else {
      escolhidos.forEach(({ p, qtd }) => congelarMassas(p.id, qtd, true, 'preparo em lote na Produção'));
    }
    setGaveta(null);
    avisar(loteModo === 'assar' ? 'Fornadas registradas: prontas para venda' : 'Massas no freezer');
  };

  const produtosComEstoque = produtos.filter((p) => p.freezer + p.vitrine > 0);
  const descAlvo = produtos.find((p) => p.id === descProd) ?? null;
  const descDisponivel = descAlvo ? (descOrigem === 'freezer' ? descAlvo.freezer : descAlvo.vitrine) : 0;
  const custoUnit = descAlvo ? custoMaterialUnitario(descAlvo.id, descOrigem) : 0;
  const confirmarDescarte = () => {
    if (!descAlvo) {
      setDescErro('Escolha o produto.');
      return;
    }
    const erro = registrarDescarte({ produtoId: descAlvo.id, quantidade: descQtd, origem: descOrigem, disponivel: descDisponivel, motivo: descMotivo, observacao: descObs });
    if (erro) {
      setDescErro(erro);
      return;
    }
    setGaveta(null);
    avisar(`${descQtd}x ${descAlvo.nome} descartado · perda de ${brl(custoUnit * descQtd)}`);
  };

  const ic = (nome: keyof typeof MaterialCommunityIcons.glyphMap, tam: number, c: string) => <MaterialCommunityIcons name={nome} size={tam} color={c} />;

  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.topo}>
          <T titulo style={s.titulo}>Produção</T>
          <T style={s.subtitulo}>Massas no freezer e o que está pronto para venda</T>
        </View>

        {/* AÇÕES EM LOTE: pílulas que cabem na largura (sem rolagem lateral) */}
        <View style={s.acoes}>
          <TouchableOpacity style={[s.pilula, { backgroundColor: AZUL_FREEZER_FUNDO, borderColor: '#D6D7F3' }]} onPress={() => abrirLote('preparo')} accessibilityRole="button">
            {ic('snowflake', 16, AZUL_FREEZER_ESCURO)}
            <T style={[s.pilulaTexto, { color: AZUL_FREEZER_ESCURO }]} numberOfLines={1}>Preparar massa</T>
          </TouchableOpacity>
          <TouchableOpacity style={[s.pilula, { backgroundColor: LARANJA_FUNDO, borderColor: '#F2DDB0' }]} onPress={() => abrirLote('assar')} accessibilityRole="button">
            {ic('fire', 16, LARANJA_ESCURO)}
            <T style={[s.pilulaTexto, { color: LARANJA_ESCURO }]} numberOfLines={1}>Registrar fornada</T>
          </TouchableOpacity>
          <TouchableOpacity style={s.pilulaIcone} onPress={() => abrirDescarte()} accessibilityRole="button" accessibilityLabel="Descartar produto">
            {ic('trash-can-outline', 17, cor.textoMedio)}
          </TouchableOpacity>
        </View>

        {/* RESUMO */}
        <View style={[s.resumo, sombra]}>
          <View style={s.resumoLinha}>
            <View style={[s.resumoCelula, { backgroundColor: AZUL_FREEZER_FUNDO }]}>
              <View style={s.linha}>
                {ic('snowflake', 14, AZUL_FREEZER)}
                <T style={[s.resumoRotulo, { color: AZUL_FREEZER }]}>No freezer</T>
              </View>
              <T titulo style={[s.resumoValor, numeros, { color: AZUL_FREEZER_ESCURO }]}>{totalFreezer} massas</T>
              <T style={[s.resumoNota, { color: semMassa ? cor.ambar : cor.verde }]}>
                {semMassa ? `${semMassa} ${semMassa === 1 ? 'sabor' : 'sabores'} sem massa` : 'Todos com massa'}
              </T>
            </View>
            <View style={[s.resumoCelula, { backgroundColor: cor.verdeClaro }]}>
              <View style={s.linha}>
                {ic('check-circle-outline', 14, cor.verde)}
                <T style={[s.resumoRotulo, { color: cor.verde }]}>Pronto para venda</T>
              </View>
              <T titulo style={[s.resumoValor, numeros, { color: '#24603F' }]}>{totalVitrine} un</T>
              <T style={[s.resumoNota, { color: cor.verde }]}>
                {fornadasHoje} {fornadasHoje === 1 ? 'fornada hoje' : 'fornadas hoje'}
              </T>
            </View>
          </View>
          <TouchableOpacity style={s.resumoRodape} onPress={() => setGaveta('perdas')} accessibilityRole="button">
            <T style={[s.medio, numeros, { flex: 1 }]}>
              Perdas nos últimos 30 dias: <T style={[s.forte, { color: perdas.total > 0 ? cor.vermelho : cor.verde }]}>{brl(perdas.total)}</T>
            </T>
            <T style={s.link}>Ver ›</T>
          </TouchableOpacity>
        </View>

        {/* ABAS */}
        <View style={s.segmento} accessibilityRole="tablist">
          {([
            ['produtos', 'Produtos', qtdAssarAgora, LARANJA],
            ['encomendas', 'Encomendas', encomendasPendentes, cor.ambar],
            ['historico', 'Histórico', 0, cor.textoSuave],
          ] as [Aba, string, number, string][]).map(([id, rotulo, n, c]) => {
            const on = aba === id;
            return (
              <TouchableOpacity key={id} style={[s.segItem, on && s.segItemOn]} onPress={() => setAba(id)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <T style={[s.segTexto, on && s.segTextoOn]}>{rotulo}</T>
                {n > 0 && (
                  <View style={[s.segNum, { backgroundColor: c }]}>
                    <T style={s.segNumTexto}>{n}</T>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* PRODUTOS */}
        {aba === 'produtos' && (
          <>
            <View style={[s.busca, sombra]}>
              <Feather name="search" size={16} color={cor.textoSuave} />
              <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar doce ou categoria…" placeholderTextColor={cor.textoSuave} style={s.buscaInput} accessibilityLabel="Buscar produto" />
            </View>
            {listaProdutos.length === 0 ? (
              <T style={[s.dica, { marginTop: 20 }]}>Nenhum produto encontrado.</T>
            ) : (
              <View style={[s.lista, sombra]}>
                {listaProdutos.map((p, i) => {
                  const assar = horaDeAssar(p);
                  const massa = fazerMassa(p);
                  const aviso = assar
                    ? { t: 'Hora de assar', bg: LARANJA_CLARO, fg: LARANJA_ESCURO }
                    : massa
                    ? p.freezer === 0
                      ? { t: 'Sem massa no freezer', bg: '#FBE7E4', fg: cor.vermelho }
                      : { t: 'Fazer massa', bg: cor.ambarClaro, fg: cor.ambarTexto }
                    : null;
                  return (
                    <View key={p.id} style={[s.produto, i > 0 && s.borda]}>
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <T style={s.produtoNome}>{p.nome}</T>
                        <View style={[s.linha, { gap: 10 }]}>
                          <View style={s.linha} accessibilityLabel={`${p.freezer} no freezer`}>
                            {ic('snowflake', 13, p.freezer === 0 ? cor.vermelho : AZUL_FREEZER_ESCURO)}
                            <T style={[s.qtd, numeros, { color: p.freezer === 0 ? cor.vermelho : AZUL_FREEZER_ESCURO }]}>{p.freezer}</T>
                          </View>
                          <View style={s.linha} accessibilityLabel={`${p.vitrine} prontos para venda`}>
                            {ic('check-circle-outline', 13, p.vitrine === 0 ? cor.textoSuave : cor.verde)}
                            <T style={[s.qtd, numeros, { color: p.vitrine === 0 ? cor.textoSuave : cor.verde }]}>{p.vitrine}</T>
                          </View>
                          <T style={s.dicaPequena}>{p.tempo} min</T>
                        </View>
                        {aviso && (
                          <View style={[s.aviso, { backgroundColor: aviso.bg }]}>
                            <T style={[s.avisoTexto, { color: aviso.fg }]}>{aviso.t}</T>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity style={[s.icone, { backgroundColor: AZUL_FREEZER_CLARO }]} onPress={() => abrirPreparar(p)} accessibilityRole="button" accessibilityLabel={`Preparar massa de ${p.nome}`}>
                        {ic('snowflake', 18, AZUL_FREEZER_ESCURO)}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.icone, { backgroundColor: p.freezer > 0 ? LARANJA_CLARO : cor.cinzaClaro }]}
                        onPress={() => abrirAssar(p)}
                        disabled={p.freezer <= 0}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: p.freezer <= 0 }}
                        accessibilityLabel={p.freezer > 0 ? `Registrar fornada de ${p.nome}` : `${p.nome}: sem massa no freezer`}>
                        {ic('fire', 18, p.freezer > 0 ? LARANJA_ESCURO : cor.apagado)}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.icone, { backgroundColor: cor.cinzaClaro }]}
                        onPress={() => abrirDescarte(p)}
                        disabled={p.freezer + p.vitrine <= 0}
                        accessibilityRole="button"
                        accessibilityLabel={`Descartar ${p.nome}`}>
                        {ic('trash-can-outline', 17, p.freezer + p.vitrine > 0 ? cor.textoSuave : cor.apagado)}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={s.legenda}>
              <View style={s.linha}>{ic('snowflake', 12, AZUL_FREEZER_ESCURO)}<T style={[s.dicaPequena, { color: AZUL_FREEZER_ESCURO }]}>massa no freezer</T></View>
              <View style={s.linha}>{ic('check-circle-outline', 12, cor.verde)}<T style={[s.dicaPequena, { color: cor.verde }]}>pronto para venda</T></View>
              <View style={s.linha}>{ic('fire', 12, LARANJA_ESCURO)}<T style={[s.dicaPequena, { color: LARANJA_ESCURO }]}>registrar fornada</T></View>
            </View>
          </>
        )}

        {/* ENCOMENDAS */}
        {aba === 'encomendas' && (
          <View style={[s.lista, sombra, { marginTop: 14 }]}>
            {encomendas.length === 0 && <T style={[s.dica, { padding: 24 }]}>Nenhuma encomenda para produzir.</T>}
            {encomendas.map((e, i) => {
              const st = STATUS_ENCOMENDA[e.statusProducao] ?? STATUS_ENCOMENDA.a_fazer;
              const px = PROXIMO[e.statusProducao];
              return (
                <View key={e.id} style={[s.encomenda, i > 0 && s.borda]}>
                  <View style={[s.linha, { alignItems: 'baseline' }]}>
                    <T style={[s.produtoNome, { flex: 1, fontSize: 16 }]} numberOfLines={1}>{e.clienteNome}</T>
                    <View style={s.linha}>
                      <Feather name="calendar" size={12} color={cor.ambar} />
                      <T style={[s.forte, { fontSize: 12, color: cor.ambar }]}>{rotuloEntrega(e.dataEntrega)}</T>
                    </View>
                  </View>
                  <T style={s.itensEnc}>{resumoItens(e)}</T>
                  {!!e.observacoes && <T style={s.obs}>“{e.observacoes}”</T>}
                  <View style={s.linha}>
                    <View style={[s.status, { backgroundColor: st.bg }]}>
                      <View style={[s.ponto, { backgroundColor: st.fg }]} />
                      <T style={[s.statusTexto, { color: st.fg }]}>{st.label}</T>
                    </View>
                    <View style={{ flex: 1 }} />
                    {px ? (
                      <TouchableOpacity
                        style={s.botaoBorda}
                        onPress={() => {
                          atualizarPedido({ ...e, statusProducao: px.id });
                          avisar(`${e.clienteNome}: ${STATUS_ENCOMENDA[px.id].label}`);
                        }}
                        accessibilityRole="button">
                        <T style={s.forte}>{px.label}</T>
                      </TouchableOpacity>
                    ) : (
                      <T style={[s.forte, { fontSize: 12, color: '#3A3D9E' }]}>Aguardando entrega</T>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* HISTÓRICO */}
        {aba === 'historico' && (
          <>
            <View style={s.histTopo}>
              <TouchableOpacity style={s.filtroHist} onPress={() => setGaveta('filtroHist')} accessibilityRole="button">
                <Feather name="filter" size={14} color={cor.texto} />
                <T style={s.forte}>
                  {ROTULO_PERIODO[histPer]}
                  {histTipo !== 'todos' ? ` · ${ROTULO_TIPO[histTipo]}` : ''}
                </T>
              </TouchableOpacity>
              <View style={s.buscaHist}>
                <Feather name="search" size={14} color={cor.textoSuave} />
                <TextInput value={histBusca} onChangeText={setHistBusca} placeholder="Produto…" placeholderTextColor={cor.textoSuave} style={s.buscaInput} accessibilityLabel="Filtrar por produto" />
              </View>
            </View>
            {gruposHist.length === 0 && <T style={[s.dica, { marginTop: 24 }]}>Nenhum registro para os filtros escolhidos.</T>}
            {gruposHist.map((g) => (
              <View key={g.titulo} style={{ paddingHorizontal: 16, paddingTop: 18 }}>
                <T titulo style={s.grupoTitulo}>{g.titulo}</T>
                <View style={[s.lista, sombra, { marginHorizontal: 0 }]}>
                  {g.itens.map((r, i) => {
                    const v = VISUAL_TIPO[r.tipo];
                    return (
                      <View key={r.id} style={[s.registro, i > 0 && s.borda]}>
                        <View style={[s.iconeHist, { backgroundColor: v.bg }]}>{ic(v.icone, 17, v.fg)}</View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <View style={[s.linha, { alignItems: 'baseline' }]}>
                            <T style={[s.produtoNome, { flex: 1, fontSize: 14 }]} numberOfLines={1}>{r.produtoNome}</T>
                            <T style={[s.forte, numeros, { color: v.fg }]}>{v.sinal}{r.quantidade} un</T>
                          </View>
                          <T style={s.dicaPequena}>
                            {v.acao}
                            {r.tipo === 'perda' && r.custo ? <T style={[s.dicaPequena, { color: cor.vermelho, fontWeight: '800' }]}> · perda {brl(r.custo)}</T> : null}
                          </T>
                          {!!r.detalhes && <T style={[s.dicaPequena, { color: cor.textoMedio }]}>{r.detalhes}</T>}
                          <T style={[s.dicaPequena, numeros, { fontSize: 11 }]}>{r.horario} · Por {r.responsavel}</T>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
            {histFiltrado.length > histLimite && (
              <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
                <Botao rotulo="Carregar mais registros" variante="secundario" altura={44} aoTocar={() => setHistLimite(histLimite + POR_PAGINA)} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Aviso msg={msg} base={100} />
      <TabBar ativa="/producao" />

      {/* PREPARAR MASSA (um produto) */}
      <Gaveta aberta={gaveta === 'preparar' && !!alvo} aoFechar={() => setGaveta(null)} titulo="Preparar massa" subtitulo={alvo ? `${alvo.nome} · vai para o freezer` : ''}>
        {!!prepErro && (
          <View style={s.erro}>
            <T style={s.erroTexto}>{prepErro}</T>
          </View>
        )}
        <T style={s.rotulo}>Quantas massas vai modelar?</T>
        <Contador
          valor={qtdPrep}
          min={0}
          aoMudar={(n) => {
            setQtdPrep(n);
            setPrepErro(null);
          }}
          cor={AZUL_FREEZER_ESCURO}
          fundo={AZUL_FREEZER_CLARO}
        />
        {semReceita ? (
          <View style={s.semReceita}>
            <View style={s.semReceitaIcone}>
              <Feather name="book-open" size={18} color="#9A6516" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T style={[s.forte, { fontSize: 14, color: '#6E4A10' }]}>Produto sem receita</T>
              <T style={[s.medio, { color: '#7A5A20', lineHeight: 19 }]}>A massa entra no freezer, mas nenhum ingrediente é descontado do estoque.</T>
              <TouchableOpacity
                onPress={() => {
                  setGaveta(null);
                  setReceitaDe(alvo!.id);
                }}
                accessibilityRole="button"
                style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
                <T style={[s.link, { color: '#7A4520' }]}>Montar receita agora →</T>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={s.checkLinha} onPress={() => setDescontar((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: descontar }}>
            <View style={[s.check, descontar && { backgroundColor: AZUL_FREEZER, borderColor: AZUL_FREEZER }]}>{descontar && <Feather name="check" size={13} color="#FFFDFA" />}</View>
            <T style={[s.forte, { flex: 1, fontSize: 14 }]}>Descontar os ingredientes do estoque de insumos</T>
          </TouchableOpacity>
        )}
        {!semReceita && descontar && ingredientes.length > 0 && qtdPrep > 0 && (
          <View style={{ gap: 6 }}>
            <T style={s.rotulo}>Ingredientes para {qtdPrep} unidades</T>
            {faltaIngrediente && (
              <View style={s.erro}>
                <T style={s.erroTexto}>Alguns ingredientes não são suficientes. Você pode produzir mesmo assim: o estoque deles ficará zerado.</T>
              </View>
            )}
            {ingredientes.map((i) => (
              <View key={i.insumoId} style={[s.linha, s.borda, { paddingVertical: 8, gap: 10 }]}>
                <Feather name={i.ok ? 'check-circle' : 'alert-circle'} size={18} color={i.ok ? cor.verde : cor.vermelhoForte} />
                <T style={[s.medio, { flex: 1, color: cor.texto, fontWeight: '600' }]}>{i.nome}</T>
                <View style={{ alignItems: 'flex-end' }}>
                  <T style={[s.forte, numeros, { color: i.ok ? cor.texto : cor.vermelho }]}>{i.precisa.toLocaleString('pt-BR')} {i.unidade}</T>
                  <T style={[s.dicaPequena, numeros, { fontSize: 11 }]}>tem {i.estoqueAtual.toLocaleString('pt-BR')} {i.unidade}</T>
                </View>
              </View>
            ))}
          </View>
        )}
        <Botao rotulo={!semReceita && faltaIngrediente ? 'Produzir mesmo assim' : 'Confirmar e congelar'} aoTocar={confirmarPreparo} style={{ backgroundColor: AZUL_FREEZER }} />
      </Gaveta>

      {/* Receita aberta direto da Produção (produto sem receita) */}
      <ReceitaMobile produtoId={receitaDe} aoFechar={() => setReceitaDe(null)} aoSalvo={avisar} />

      {/* REGISTRAR FORNADA (um produto) */}
      <Gaveta aberta={gaveta === 'assar' && !!alvo} aoFechar={() => setGaveta(null)} titulo="Registrar fornada" subtitulo={alvo ? `${alvo.nome} · sai do freezer e fica pronto para venda` : ''}>
        {alvo && (
          <>
            <View style={[s.faixa, { backgroundColor: AZUL_FREEZER_FUNDO }]}>
              <T style={[s.medio, { color: AZUL_FREEZER_ESCURO }]}>
                Você tem <T style={[s.forte, numeros, { color: AZUL_FREEZER_ESCURO }]}>{alvo.freezer} massas</T> no freezer.
              </T>
            </View>
            <T style={s.rotulo}>Quantas unidades saíram do forno?</T>
            <Contador valor={qtdAssar} min={1} max={alvo.freezer} aoMudar={setQtdAssar} cor={LARANJA_ESCURO} fundo={LARANJA_CLARO} />
            <View style={[s.faixa, { gap: 4 }]}>
              <T style={s.forte}>Depois de registrar</T>
              <T style={[s.medio, numeros]}>Freezer fica com <T style={[s.forte, { color: AZUL_FREEZER_ESCURO }]}>{Math.max(0, alvo.freezer - qtdAssar)} massas</T></T>
              <T style={[s.medio, numeros]}>Pronto para venda: <T style={[s.forte, { color: cor.verde }]}>{alvo.vitrine + Math.min(qtdAssar, alvo.freezer)} un</T></T>
            </View>
            <Botao rotulo="Registrar fornada" aoTocar={confirmarAssar} style={{ backgroundColor: LARANJA }} />
          </>
        )}
      </Gaveta>

      {/* LOTE */}
      <Gaveta
        aberta={gaveta === 'lote'}
        aoFechar={() => setGaveta(null)}
        titulo={loteModo === 'assar' ? 'Registrar fornadas' : 'Preparar massa'}
        subtitulo={loteModo === 'assar' ? 'Quanto saiu do forno de cada produto' : 'Entra no freezer descontando os insumos da ficha'}>
        {!!loteErro && (
          <View style={s.erro}>
            <T style={s.erroTexto}>{loteErro}</T>
          </View>
        )}
        <View>
          {produtos.map((p, i) => {
            const n = lote[p.id] ?? 0;
            const sem = loteModo === 'assar' && p.freezer <= 0;
            const noMax = loteModo === 'assar' && n >= p.freezer;
            return (
              <View key={p.id} style={[s.linha, i > 0 && s.borda, { paddingVertical: 10, gap: 10, opacity: sem ? 0.45 : 1 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={[s.produtoNome, { fontSize: 14 }]}>{p.nome}</T>
                  <T style={[s.dicaPequena, numeros]}>{p.freezer} no freezer{loteModo === 'assar' ? ` · ${p.tempo} min` : ''}</T>
                </View>
                <View style={s.passo}>
                  <TouchableOpacity style={s.passoBotao} onPress={() => setLote({ ...lote, [p.id]: Math.max(0, n - 1) })} accessibilityLabel={`Menos ${p.nome}`}>
                    <Feather name="minus" size={15} color={cor.texto} />
                  </TouchableOpacity>
                  <T style={[s.passoNum, numeros]}>{n}</T>
                  <TouchableOpacity
                    style={[s.passoBotao, (sem || noMax) && { opacity: 0.35 }]}
                    disabled={sem || noMax}
                    onPress={() => setLote({ ...lote, [p.id]: n + 1 })}
                    accessibilityLabel={`Mais ${p.nome}`}>
                    <Feather name="plus" size={15} color={loteModo === 'assar' ? LARANJA : AZUL_FREEZER} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
        <Botao rotulo={loteModo === 'assar' ? 'Registrar fornadas' : 'Preparar'} aoTocar={confirmarLote} style={{ backgroundColor: loteModo === 'assar' ? LARANJA : AZUL_FREEZER }} />
      </Gaveta>

      {/* DESCARTAR: 1) escolhe o produto · 2) de onde, quanto e por quê */}
      <Gaveta
        aberta={gaveta === 'descartar'}
        aoFechar={() => setGaveta(null)}
        titulo="Descartar produto"
        subtitulo={descAlvo ? 'De onde sai, quanto e por quê' : 'Qual produto vai descartar?'}>
        {!!descErro && (
          <View style={s.erro}>
            <T style={s.erroTexto}>{descErro}</T>
          </View>
        )}
        {!descAlvo ? (
          <>
            <View style={[s.busca, { marginHorizontal: 0, marginTop: 0, backgroundColor: cor.fundo }]}>
              <Feather name="search" size={16} color={cor.textoSuave} />
              <TextInput value={descBusca} onChangeText={setDescBusca} placeholder="Buscar produto..." placeholderTextColor={cor.textoSuave} style={s.buscaInput} accessibilityLabel="Buscar produto para descartar" />
            </View>
            {produtosComEstoque.length === 0 && <T style={s.dica}>Nenhum produto com estoque para descartar.</T>}
            <View style={{ gap: 8 }}>
              {produtosComEstoque
                .filter((p) => !descBusca.trim() || p.nome.toLowerCase().includes(descBusca.trim().toLowerCase()))
                .map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={s.descProduto}
                    onPress={() => {
                      setDescProd(p.id);
                      setDescOrigem(p.vitrine > 0 ? 'vitrine' : 'freezer');
                      setDescQtd(1);
                      setDescErro(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Descartar ${p.nome}`}>
                    <View style={s.descEmoji}>
                      <T style={{ fontSize: 22 }}>{p.emoji}</T>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <T style={[s.produtoNome, { fontSize: 14 }]} numberOfLines={1}>{p.nome}</T>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {p.vitrine > 0 && (
                          <View style={[s.descPill, { backgroundColor: cor.verdeClaro }]}>
                            <T style={[s.descPillTexto, numeros, { color: cor.verde }]}>✓ {p.vitrine} prontos</T>
                          </View>
                        )}
                        {p.freezer > 0 && (
                          <View style={[s.descPill, { backgroundColor: AZUL_FREEZER_FUNDO }]}>
                            <T style={[s.descPillTexto, numeros, { color: AZUL_FREEZER_ESCURO }]}>❄ {p.freezer} massas</T>
                          </View>
                        )}
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={cor.textoSuave} />
                  </TouchableOpacity>
                ))}
            </View>
          </>
        ) : (
          <>
            <View style={s.descSelecionado}>
              <View style={s.descEmoji}>
                <T style={{ fontSize: 22 }}>{descAlvo.emoji}</T>
              </View>
              <T style={[s.produtoNome, { flex: 1 }]} numberOfLines={2}>{descAlvo.nome}</T>
              <TouchableOpacity onPress={() => setDescProd(null)} accessibilityRole="button" style={{ paddingVertical: 6, paddingLeft: 8 }}>
                <T style={s.link}>Trocar</T>
              </TouchableOpacity>
            </View>

            <T style={s.rotulo}>Sai de onde?</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['vitrine', 'freezer'] as OrigemDescarte[]).map((o) => {
                const qtd = o === 'vitrine' ? descAlvo.vitrine : descAlvo.freezer;
                const on = descOrigem === o;
                return (
                  <TouchableOpacity
                    key={o}
                    disabled={qtd <= 0}
                    onPress={() => {
                      setDescOrigem(o);
                      setDescQtd(1);
                    }}
                    style={[s.descOrigem, on && s.descOrigemOn, qtd <= 0 && { opacity: 0.4 }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, disabled: qtd <= 0 }}>
                    <T style={{ fontSize: 18 }}>{o === 'vitrine' ? '🧁' : '❄️'}</T>
                    <T style={[s.forte, { fontSize: 14 }]}>{o === 'vitrine' ? 'Pronto p/ venda' : 'Freezer'}</T>
                    <T style={[s.dicaPequena, numeros]}>{qtd} {o === 'vitrine' ? 'un' : 'massas'}</T>
                  </TouchableOpacity>
                );
              })}
            </View>

            <T style={s.rotulo}>Quantas?</T>
            <Contador valor={descQtd} min={1} max={Math.max(1, descDisponivel)} aoMudar={setDescQtd} cor={cor.vermelho} fundo={cor.vermelhoClaro} />

            <T style={s.rotulo}>Motivo</T>
            <View style={s.wrap}>
              {MOTIVOS_DESCARTE.map((m) => (
                <Opcao key={m} rotulo={`${EMOJI_MOTIVO[m] ?? ''} ${m}`} ativo={descMotivo === m} aoTocar={() => setDescMotivo(m)} style={{ minHeight: 40 }} />
              ))}
            </View>

            <TextInput value={descObs} onChangeText={setDescObs} placeholder="Observação (opcional). Ex.: doado para a feira" placeholderTextColor={cor.textoSuave} style={s.campo} />

            <View style={s.descPerda}>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={[s.forte, { color: '#8A1C12', fontSize: 13 }]}>Perda de material</T>
                <T style={[s.dicaPequena, { color: '#8A1C12' }]}>
                  {brl(custoUnit)}/un · {descOrigem === 'freezer' ? 'ingredientes da massa' : 'ingredientes + embalagem'}
                </T>
              </View>
              <T titulo style={[s.forte, numeros, { color: '#8A1C12', fontSize: 20 }]}>{brl(custoUnit * descQtd)}</T>
            </View>
            <Botao rotulo={`Descartar ${descQtd} ${descOrigem === 'freezer' ? (descQtd === 1 ? 'massa' : 'massas') : 'un'}`} variante="perigo" aoTocar={confirmarDescarte} />
          </>
        )}
      </Gaveta>

      {/* FILTRO DO HISTÓRICO */}
      <Gaveta aberta={gaveta === 'filtroHist'} aoFechar={() => setGaveta(null)} titulo="Filtrar histórico" subtitulo="Período e tipo de registro">
        <T style={s.rotulo}>Período</T>
        <View style={s.wrap}>
          {(Object.keys(ROTULO_PERIODO) as PeriodoHist[]).map((k) => (
            <Opcao key={k} rotulo={ROTULO_PERIODO[k]} ativo={histPer === k} aoTocar={() => { setHistPer(k); setHistLimite(POR_PAGINA); }} forte />
          ))}
        </View>
        <T style={s.rotulo}>Tipo</T>
        <View style={s.wrap}>
          {(Object.keys(ROTULO_TIPO) as TipoHist[]).map((k) => (
            <Opcao key={k} rotulo={ROTULO_TIPO[k]} ativo={histTipo === k} aoTocar={() => { setHistTipo(k); setHistLimite(POR_PAGINA); }} forte />
          ))}
        </View>
        <Botao rotulo={`Ver ${histFiltrado.length} registros`} aoTocar={() => setGaveta(null)} />
      </Gaveta>

      {/* PERDAS */}
      <Gaveta aberta={gaveta === 'perdas'} aoFechar={() => setGaveta(null)} titulo="Perdas · 30 dias" subtitulo="Custo de material descartado por motivo">
        <View style={[s.faixa, s.linha, { backgroundColor: cor.vermelhoClaro }]}>
          <T style={[s.forte, { flex: 1, color: '#8A1C12' }]}>Total perdido</T>
          <T titulo style={[s.resumoValor, numeros, { color: cor.vermelho }]}>{brl(perdas.total)}</T>
        </View>
        {perdas.porMotivo.length === 0 && <T style={s.dica}>Nenhum descarte nos últimos 30 dias.</T>}
        {perdas.porMotivo.map((m) => (
          <View key={m.motivo} style={[s.linha, s.borda, { paddingVertical: 10 }]}>
            <T style={[s.produtoNome, { flex: 1, fontSize: 14 }]}>{m.motivo}</T>
            <T style={[s.dicaPequena, numeros]}>{m.unidades} un</T>
            <T style={[s.forte, numeros, { width: 90, textAlign: 'right', color: cor.vermelho }]}>{brl(m.custo)}</T>
          </View>
        ))}
        <Botao
          rotulo="Ver descartes no histórico"
          variante="secundario"
          altura={48}
          aoTocar={() => {
            setGaveta(null);
            setAba('historico');
            setHistTipo('perda');
            setHistPer('30dias');
          }}
        />
      </Gaveta>
    </SafeAreaView>
  );
}

// Seletor grande de quantidade (− número +)
function Contador({ valor, min, max, aoMudar, cor: c, fundo }: { valor: number; min: number; max?: number; aoMudar: (n: number) => void; cor: string; fundo: string }) {
  const noMax = max !== undefined && valor >= max;
  return (
    <View style={s.contador}>
      <TouchableOpacity style={s.contadorMenos} onPress={() => aoMudar(Math.max(min, valor - 1))} accessibilityLabel="Menos">
        <Feather name="minus" size={22} color={cor.texto} />
      </TouchableOpacity>
      <TextInput
        value={valor ? String(valor) : ''}
        placeholder="0"
        placeholderTextColor={cor.apagado}
        onChangeText={(t) => {
          const n = parseInt(t.replace(/\D/g, ''), 10) || 0;
          aoMudar(Math.max(min, max !== undefined ? Math.min(max, n) : n));
        }}
        keyboardType="number-pad"
        style={[s.contadorValor, numeros]}
        accessibilityLabel="Quantidade"
      />
      <TouchableOpacity style={[s.contadorMais, { backgroundColor: fundo }, noMax && { opacity: 0.4 }]} disabled={noMax} onPress={() => aoMudar(max !== undefined ? Math.min(max, valor + 1) : valor + 1)} accessibilityLabel="Mais">
        <Feather name="plus" size={22} color={c} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { paddingHorizontal: 20, paddingTop: 10, gap: 2 },
  titulo: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subtitulo: { fontSize: 14, color: cor.textoSuave },
  acoes: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  pilula: { flex: 1, height: 40, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 6 },
  pilulaIcone: { width: 40, height: 40, flexGrow: 0, flexShrink: 0, borderRadius: 20, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  pilulaTexto: { fontSize: 12.5, fontWeight: '700' },
  resumo: { marginHorizontal: 16, marginTop: 12, padding: 4, borderRadius: 22, backgroundColor: '#FFFDFA' },
  resumoLinha: { flexDirection: 'row', gap: 4 },
  resumoCelula: { flex: 1, padding: 12, borderRadius: 18, gap: 2 },
  resumoRotulo: { fontSize: 13, fontWeight: '600' },
  resumoValor: { fontSize: 22, fontWeight: '700' },
  resumoNota: { fontSize: 12, fontWeight: '700' },
  resumoRodape: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  medio: { fontSize: 13, color: cor.textoMedio },
  forte: { fontSize: 13, fontWeight: '800', color: cor.texto },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  segmento: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, padding: 4, gap: 4, borderRadius: 16, backgroundColor: '#F3EEE7' },
  segItem: { flex: 1, height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segItemOn: { backgroundColor: '#FFFDFA', shadowColor: '#2E211A', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTexto: { fontSize: 13, fontWeight: '600', color: cor.textoMedio },
  segTextoOn: { fontWeight: '800', color: cor.texto },
  segNum: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segNumTexto: { color: '#FFFDFA', fontSize: 11, fontWeight: '800' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, marginHorizontal: 16, marginTop: 14, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#FFFDFA' },
  buscaInput: { flex: 1, minWidth: 0, fontSize: 14, color: cor.texto, padding: 0 },
  lista: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#FFFDFA', borderRadius: 22, overflow: 'hidden' },
  produto: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 },
  borda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  produtoNome: { fontSize: 15, fontWeight: '700', lineHeight: 19 },
  qtd: { fontSize: 13, fontWeight: '800' },
  dica: { fontSize: 13, color: cor.textoSuave, textAlign: 'center' },
  dicaPequena: { fontSize: 12, color: cor.textoSuave },
  aviso: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 7 },
  avisoTexto: { fontSize: 11, fontWeight: '800' },
  icone: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 12, paddingHorizontal: 20 },
  encomenda: { padding: 16, gap: 8 },
  itensEnc: { fontSize: 14, color: '#3D312A' },
  obs: { fontSize: 13, fontStyle: 'italic', color: cor.textoSuave },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  statusTexto: { fontSize: 12, fontWeight: '800' },
  botaoBorda: { height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.5, borderColor: cor.apagado, justifyContent: 'center' },
  histTopo: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, alignItems: 'center' },
  filtroHist: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFDFA' },
  buscaHist: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFDFA' },
  grupoTitulo: { fontSize: 15, fontWeight: '700', color: cor.textoMedio, paddingHorizontal: 4, paddingBottom: 8 },
  registro: { flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  iconeHist: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rotulo: { fontSize: 13, fontWeight: '800', color: cor.textoMedio },
  checkLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: cor.borda },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: cor.apagado, alignItems: 'center', justifyContent: 'center' },
  erro: { padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro },
  erroTexto: { fontSize: 13, lineHeight: 18, color: '#8A1C12' },
  faixa: { padding: 12, borderRadius: 16, backgroundColor: cor.fundo },
  passo: { flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 20, backgroundColor: cor.cinzaClaro },
  passoBotao: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  passoNum: { minWidth: 22, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  campo: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, paddingHorizontal: 14, fontSize: 14, color: cor.texto },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contadorMenos: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
  contadorMais: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  contadorValor: { flex: 1, minWidth: 0, width: '100%', textAlign: 'center', fontSize: 30, fontWeight: '700', color: cor.texto, padding: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  semReceita: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#FBF0DC', borderWidth: 1, borderColor: '#F2DDB0' },
  semReceitaIcone: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F6E3BD', alignItems: 'center', justifyContent: 'center' },
  descProduto: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFDFA' },
  descEmoji: { width: 44, height: 44, borderRadius: 14, backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center' },
  descPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  descPillTexto: { fontSize: 11, fontWeight: '800' },
  descSelecionado: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: cor.fundo },
  descOrigem: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 1.5, borderColor: cor.borda, gap: 2 },
  descOrigemOn: { borderColor: cor.vermelho, backgroundColor: cor.vermelhoClaro },
  descPerda: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: cor.vermelhoClaro },
});
