import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { alternarAtivoProduto, produtoAtivo, useEstoqueFreezer, useEstoqueVitrine, type ProdutoVitrine } from '@/lib/estoqueVitrine';
import { assarDoFreezer, calcularFicha, congelarMassas, margemReal, MARGEM_MINIMA, useFichas, useInsumos } from '@/lib/insumos';
import { custoMaterialUnitario, MOTIVOS_DESCARTE, registrarDescarte, type MotivoDescarte, type OrigemDescarte } from '@/lib/descarte';
import TabBar from '@/components/mobile/TabBar';
import { brl, cor, fonte, numeros, sombra } from '@/components/mobile/tema';
import { Aviso, Botao, Gaveta, Opcao, T, useAviso } from '@/components/mobile/ui';
import ProdutoFormMobile, { CATEGORIAS_PADRAO, type ProdutoSalvo } from './ProdutoFormMobile';
import ReceitaMobile from './ReceitaMobile';

// ============================================================================
// PRODUTOS NO CELULAR: lista, detalhe, cadastro e receita (mesmos dados da versão de computador)
// ============================================================================

const AZUL_FREEZER = '#0369A1';
const LARANJA = '#C2410C';
const LARANJA_ESCURO = '#9A3412';
const LARANJA_CLARO = '#FFEDD5';

// Ícone de cada produto (o mesmo da versão de computador); escolhas novas ficam guardadas aqui
export const FOTOS: Record<string, string> = {
  'prod-1': '🍪', 'prod-2': '🍪', 'prod-3': '🍪', 'prod-4': '🎂', 'prod-5': '🎂', 'prod-6': '✨', 'prod-7': '✨',
  'prod-8': '🍰', 'prod-9': '🍬', 'prod-10': '🎁', 'prod-11': '🥐', 'prod-12': '🍯', 'prod-13': '🥧', 'prod-14': '☕',
};
const ROTULO_DISP = { pronta_entrega: 'Pronta-entrega', sob_encomenda: 'Sob encomenda', hibrido: 'Pronta-entrega e encomenda' } as const;

type Situacao = 'todos' | 'baixo' | 'com_ficha' | 'sem_ficha' | 'encomenda' | 'inativos';
const SITUACOES: { id: Situacao; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos ativos' },
  { id: 'baixo', rotulo: 'Estoque baixo' },
  { id: 'com_ficha', rotulo: 'Com receita' },
  { id: 'sem_ficha', rotulo: 'Sem receita' },
  { id: 'encomenda', rotulo: 'Encomenda' },
  { id: 'inativos', rotulo: 'Inativos' },
];

type Produto = {
  v: ProdutoVitrine;
  id: string;
  nome: string;
  categoria: string;
  emoji: string;
  ativo: boolean;
  disp: NonNullable<ProdutoVitrine['disponibilidade']>;
  freezer: number;
  baixo: boolean;
  temFicha: boolean;
  custo?: number;
  margem?: number;
  sugerido?: number;
  rendimento?: number;
  tempo?: number;
  insumos: { id: string; nome: string; qtd: string; custo: number }[];
};

export default function ProdutosMobile() {
  const insets = useSafeAreaInsets();
  const { msg, avisar } = useAviso();
  const vitrine = useEstoqueVitrine();
  const freezer = useEstoqueFreezer();
  const insumos = useInsumos();
  const { fichas, horaTrabalhada } = useFichas();
  const [fotos, setFotos] = useState<Record<string, string>>(FOTOS);

  const produtos: Produto[] = useMemo(
    () =>
      vitrine.map((v) => {
        const disp = v.disponibilidade ?? 'pronta_entrega';
        const ativo = produtoAtivo(v);
        const base: Produto = {
          v,
          id: v.id,
          nome: v.nome,
          categoria: v.categoria,
          emoji: fotos[v.id] ?? '🧁',
          ativo,
          disp,
          freezer: freezer[v.id] ?? 0,
          // Estoque baixo só conta o que fica na vitrine (sob encomenda com 0 não é falta)
          baixo: ativo && disp !== 'sob_encomenda' && v.estoque <= v.estoqueMinimo,
          temFicha: false,
          insumos: [],
        };
        const ft = fichas.find((f) => f.produtoId === v.id);
        if (!ft) return base;
        const c = calcularFicha(ft, insumos, horaTrabalhada);
        return {
          ...base,
          temFicha: true,
          custo: c.custoUnitario,
          margem: Math.round(margemReal(v.preco, c.custoUnitario)),
          sugerido: c.precoSugerido,
          rendimento: ft.rendimento,
          tempo: ft.tempoPreparoMinutos,
          insumos: c.linhas.map((l) => ({ id: l.insumoId, nome: l.item.nome, qtd: `${l.quantidade} ${l.item.unidadeFracionada}`, custo: l.custo })),
        };
      }),
    [vitrine, freezer, fichas, insumos, horaTrabalhada, fotos]
  );

  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<Situacao>('todos');
  const [categoria, setCategoria] = useState('Todas');
  const [gavetaFiltros, setGavetaFiltros] = useState(false);
  const [fabCompacto, setFabCompacto] = useState(false);
  const ultimoY = useRef(0);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [form, setForm] = useState<{ aberto: boolean; id: string | null }>({ aberto: false, id: null });
  const [receita, setReceita] = useState<{ id: string; congelarDepois: number } | null>(null);

  // Atalho "Ver produto" (Estoque Central): ?produto=<id> abre o detalhe
  const { produto: atalho, t: atalhoEm, descartar: atalhoDescartar } = useLocalSearchParams<{ produto?: string; t?: string; descartar?: string }>();
  const [descarteInicial, setDescarteInicial] = useState(false);
  useEffect(() => {
    // ?descartar=1 (Estoque Central): já abre o descarte do produto
    setDescarteInicial(atalhoDescartar === '1');
    if (atalho && vitrine.some((v) => v.id === atalho)) setDetalheId(atalho);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atalho, atalhoEm]);

  const ativos = produtos.filter((p) => p.ativo);
  const comFicha = ativos.filter((p) => p.temFicha).length;
  const inativos = produtos.length - ativos.length;
  const baixos = ativos.filter((p) => p.baixo).length;
  const prontas = ativos.reduce((a, p) => a + p.v.estoque, 0);
  const valorPrateleira = ativos.reduce((a, p) => a + p.v.estoque * p.v.preco, 0);
  const noFreezer = ativos.reduce((a, p) => a + p.freezer, 0);
  const valorFreezer = ativos.reduce((a, p) => a + p.freezer * p.v.preco, 0);
  const totalEncomenda = ativos.filter((p) => p.disp !== 'pronta_entrega').length;
  const categorias = useMemo(
    () => Array.from(new Set([...CATEGORIAS_PADRAO, ...produtos.filter((p) => p.ativo).map((p) => p.categoria)])),
    [produtos]
  );

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (situacao === 'inativos' ? p.ativo : !p.ativo) return false;
      if (situacao === 'com_ficha' && !p.temFicha) return false;
      if (situacao === 'sem_ficha' && p.temFicha) return false;
      if (situacao === 'encomenda' && p.disp === 'pronta_entrega') return false;
      if (situacao === 'baixo' && !p.baixo) return false;
      if (categoria !== 'Todas' && p.categoria !== categoria) return false;
      if (q && !p.nome.toLowerCase().includes(q) && !p.categoria.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [produtos, busca, situacao, categoria]);

  const qtdFiltros = (situacao !== 'todos' ? 1 : 0) + (categoria !== 'Todas' ? 1 : 0);
  const textoFiltros = [situacao !== 'todos' ? SITUACOES.find((x) => x.id === situacao)?.rotulo : null, categoria !== 'Todas' ? categoria : null].filter(Boolean).join(' · ');
  const limpar = () => {
    setBusca('');
    setSituacao('todos');
    setCategoria('Todas');
    setGavetaFiltros(false);
  };

  const detalhe = produtos.find((p) => p.id === detalheId) ?? null;
  const emEdicao = form.id ? produtos.find((p) => p.id === form.id) ?? null : null;

  const salvo = (r: ProdutoSalvo, emoji: string) => {
    setFotos((prev) => ({ ...prev, [r.id]: emoji }));
    FOTOS[r.id] = emoji;
    setForm({ aberto: false, id: null });
    if (!r.novo) return avisar('Produto atualizado!');
    if (r.montarReceita) {
      setReceita({ id: r.id, congelarDepois: r.congelados });
      return;
    }
    // Massas já feitas vão para o freezer (sem receita, não há insumo para descontar)
    if (r.congelados > 0) congelarMassas(r.id, r.congelados, true, 'cadastro do produto');
    avisar('Produto cadastrado!');
  };

  const sobrepostos = (
    <>
      <ProdutoFormMobile
        visivel={form.aberto}
        produto={emEdicao?.v ?? null}
        emojiAtual={emEdicao?.emoji}
        categorias={categorias}
        resumoCusto={emEdicao?.temFicha ? { custo: emEdicao.custo ?? 0, margem: emEdicao.margem ?? 0, sugerido: emEdicao.sugerido ?? 0 } : null}
        aoFechar={() => setForm({ aberto: false, id: null })}
        aoSalvo={salvo}
      />
      {receita && (
        <ReceitaMobile
          produtoId={receita.id}
          aoSalvo={avisar}
          aoFechar={() => {
            // Massas informadas no cadastro entram no freezer depois da receita (descontam os insumos dela)
            if (receita.congelarDepois > 0) congelarMassas(receita.id, receita.congelarDepois, true, 'cadastro do produto');
            setReceita(null);
          }}
        />
      )}
      {/* Aviso por cima do detalhe também */}
      {detalhe && <Aviso msg={msg} base={100 + insets.bottom} />}
    </>
  );

  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 170 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={64}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const compacto = y > ultimoY.current && y > 80;
          if (compacto !== fabCompacto) setFabCompacto(compacto);
          ultimoY.current = y;
        }}>
        <View style={s.topo}>
          <T titulo style={s.titulo}>Produtos</T>
          <T style={[s.subtitulo, numeros]}>
            {ativos.length} ativos · {comFicha} com receita{inativos > 0 ? ` · ${inativos} ${inativos === 1 ? 'inativo' : 'inativos'}` : ''}
          </T>
        </View>

        {/* RESUMO DO ESTOQUE */}
        <View style={[s.resumo, sombra]}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={[s.resumoRotulo, { color: cor.verde }]}>✓ Prontas para venda</T>
              <T titulo style={[s.resumoValor, numeros]}>{prontas} un</T>
              <T style={[s.dica, numeros]}>{brl(valorPrateleira)} em prateleira</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={[s.resumoRotulo, { color: AZUL_FREEZER }]}>❄ No freezer</T>
              <T titulo style={[s.resumoValor, numeros]}>{noFreezer} un</T>
              <T style={[s.dica, numeros]}>{brl(valorFreezer)} para assar</T>
            </View>
          </View>
          {baixos > 0 && (
            <TouchableOpacity style={s.alerta} onPress={() => setSituacao(situacao === 'baixo' ? 'todos' : 'baixo')} accessibilityRole="button">
              <Feather name="alert-circle" size={16} color={cor.vermelho} />
              <T style={s.alertaTexto}>
                {baixos} {baixos === 1 ? 'produto com estoque baixo' : 'produtos com estoque baixo'}
              </T>
              <T style={s.alertaAcao}>{situacao === 'baixo' ? 'Ver todos' : 'Ver ›'}</T>
            </TouchableOpacity>
          )}
        </View>

        {/* BUSCA + FILTROS */}
        <View style={s.buscaLinha}>
          <View style={[s.busca, sombra]}>
            <Feather name="search" size={18} color="#94A3B8" />
            <TextInput value={busca} onChangeText={setBusca} placeholder="Nome ou categoria…" placeholderTextColor="#94A3B8" style={s.buscaInput} accessibilityLabel="Buscar produto" />
            {!!busca && (
              <TouchableOpacity onPress={() => setBusca('')} style={s.limpar} accessibilityRole="button" accessibilityLabel="Limpar busca">
                <Feather name="x" size={14} color={cor.textoMedio} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[s.filtroBotao, sombra, qtdFiltros > 0 && { backgroundColor: cor.azulClaro }]}
            onPress={() => setGavetaFiltros(true)}
            accessibilityRole="button"
            accessibilityLabel="Filtros">
            <Feather name="filter" size={18} color={qtdFiltros > 0 ? cor.azulTexto : cor.textoMedio} />
            {qtdFiltros > 0 && (
              <View style={s.filtroBadge}>
                <T style={s.filtroBadgeTexto}>{qtdFiltros}</T>
              </View>
            )}
          </TouchableOpacity>
        </View>
        {qtdFiltros > 0 && (
          <View style={s.mostrando}>
            <T style={s.mostrandoTexto} numberOfLines={1}>
              Mostrando: <T style={[s.mostrandoTexto, { fontWeight: '800', color: cor.texto }]}>{textoFiltros}</T>
            </T>
            <TouchableOpacity onPress={limpar} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
              <T style={s.link}>Limpar</T>
            </TouchableOpacity>
          </View>
        )}

        {/* LISTA */}
        {lista.length === 0 ? (
          <View style={s.vazio}>
            <T titulo style={s.vazioTitulo}>Nenhum produto encontrado</T>
            <T style={s.vazioTexto}>Troque a busca ou os filtros, ou cadastre um produto novo.</T>
            <Botao rotulo="Limpar busca e filtros" variante="secundario" altura={44} aoTocar={limpar} />
          </View>
        ) : (
          <View style={[s.lista, sombra]}>
            {lista.map((p, i) => {
              const promo = (p.v.desconto ?? 0) > 0;
              const selo = !p.ativo ? 'Inativo' : !p.temFicha ? 'Sem receita' : p.disp === 'sob_encomenda' ? 'Sob encomenda' : p.disp === 'hibrido' ? 'Híbrido' : null;
              const [seloBg, seloFg] = selo === 'Sem receita' ? [cor.ambarClaro, cor.ambarTexto] : selo === 'Inativo' ? [cor.cinzaClaro, cor.textoSuave] : [cor.azulClaro, cor.azulTexto];
              const margemBaixa = p.temFicha && (p.margem ?? 0) < MARGEM_MINIMA;
              const estoqueTexto =
                p.disp === 'sob_encomenda' && p.v.estoque === 0
                  ? 'Feito sob encomenda'
                  : p.baixo
                    ? `⚠ ${p.v.estoque} prontas · mín ${p.v.estoqueMinimo}`
                    : `${p.v.estoque} prontas`;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.linha, i > 0 && s.borda, !p.ativo && { opacity: 0.6 }]}
                  onPress={() => setDetalheId(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${p.nome}`}
                  activeOpacity={0.7}>
                  <View style={s.icone}>
                    <T style={{ fontSize: 24 }}>{p.emoji}</T>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <T style={s.nome} numberOfLines={1}>{p.nome}</T>
                    <View style={s.seloLinha}>
                      {!!selo && (
                        <View style={[s.selo, { backgroundColor: seloBg }]}>
                          <T style={[s.seloTexto, { color: seloFg }]}>{selo}</T>
                        </View>
                      )}
                      <T style={[s.dica, { flex: 1 }]} numberOfLines={1}>{p.categoria}</T>
                    </View>
                    <T style={[s.estoque, numeros, { color: p.baixo ? cor.vermelho : cor.verde }]} numberOfLines={1}>
                      {estoqueTexto} <T style={[s.estoque, { color: AZUL_FREEZER }]}>· ❄ {p.freezer}</T>
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <T style={[s.preco, numeros]}>{brl(p.v.preco)}</T>
                    {promo && <T style={[s.nota, numeros, { color: cor.ambar }]}>🏷 {brl(p.v.preco - (p.v.desconto ?? 0))}</T>}
                    <T style={[s.nota, numeros, { color: !p.temFicha ? '#94A3B8' : margemBaixa ? cor.vermelho : cor.verde }]}>
                      {!p.temFicha ? 'sem custo' : `${margemBaixa ? '⚠ ' : ''}margem ${p.margem}%`}
                    </T>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[s.fab, fabCompacto && s.fabCompacto, { bottom: 78 + Math.max(insets.bottom, 8) }]}
        onPress={() => setForm({ aberto: true, id: null })}
        accessibilityRole="button"
        accessibilityLabel="Novo produto"
        activeOpacity={0.9}>
        <Feather name="plus" size={22} color="#FFFFFF" />
        {!fabCompacto && <T style={s.fabTexto}>Novo produto</T>}
      </TouchableOpacity>

      <Aviso msg={msg} base={150 + insets.bottom} />
      <TabBar ativa="/mais" />

      {/* FILTROS */}
      <Gaveta aberta={gavetaFiltros} aoFechar={() => setGavetaFiltros(false)} titulo="Filtros">
        <T style={s.rotulo}>Situação</T>
        <View style={s.chips}>
          {SITUACOES.map((x) => (
            <Opcao
              key={x.id}
              rotulo={x.id === 'encomenda' ? `${x.rotulo} · ${totalEncomenda}` : x.id === 'baixo' ? `${x.rotulo} · ${baixos}` : x.rotulo}
              ativo={situacao === x.id}
              aoTocar={() => setSituacao(x.id)}
              forte
              style={{ minHeight: 40 }}
            />
          ))}
        </View>
        <T style={s.rotulo}>Categoria</T>
        <View style={s.chips}>
          {['Todas', ...categorias].map((c) => (
            <Opcao key={c} rotulo={c} ativo={categoria === c} aoTocar={() => setCategoria(c)} forte style={{ minHeight: 40 }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Botao rotulo="Limpar" variante="secundario" aoTocar={limpar} style={{ flex: 1 }} />
          <Botao rotulo={`Ver ${lista.length} produtos`} aoTocar={() => setGavetaFiltros(false)} style={{ flex: 1.4 }} />
        </View>
      </Gaveta>

      {/* Cadastro e receita: quando o detalhe está aberto, abrem por cima dele (dentro dele) */}
      {detalhe ? (
        <DetalheProduto
          p={detalhe}
          descarteInicial={descarteInicial}
          aoFechar={() => {
            setDetalheId(null);
            setDescarteInicial(false);
          }}
          aoEditar={() => setForm({ aberto: true, id: detalhe.id })}
          aoReceita={() => setReceita({ id: detalhe.id, congelarDepois: 0 })}>
          {sobrepostos}
        </DetalheProduto>
      ) : (
        sobrepostos
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// DETALHE DO PRODUTO (tela inteira)
// ============================================================================
function DetalheProduto({
  p,
  aoFechar,
  aoEditar,
  aoReceita,
  descarteInicial,
  children,
}: {
  p: Produto;
  descarteInicial?: boolean;
  aoFechar: () => void;
  aoEditar: () => void;
  aoReceita: () => void;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { msg, avisar } = useAviso();
  const [gaveta, setGaveta] = useState<null | 'mais' | 'assar' | 'descartar' | 'inativar'>(null);
  const [qtdAssar, setQtdAssar] = useState(1);
  const [origem, setOrigem] = useState<OrigemDescarte>('vitrine');
  const [qtdDesc, setQtdDesc] = useState(1);
  const [motivo, setMotivo] = useState<MotivoDescarte>('Vencido');
  const [obs, setObs] = useState('');
  const [erroDesc, setErroDesc] = useState<string | null>(null);

  const v = p.v;
  const desconto = v.desconto ?? 0;
  const margemBaixa = p.temFicha && (p.margem ?? 0) < MARGEM_MINIMA;
  const precoPromo = v.preco - desconto;
  const margemPromo = desconto > 0 && p.custo ? Math.round(margemReal(precoPromo, p.custo)) : null;
  const podeAssar = p.freezer > 0 && p.ativo;
  const podeDescartar = v.estoque + p.freezer > 0;
  const disponivel = origem === 'freezer' ? p.freezer : v.estoque;
  const custoUnit = custoMaterialUnitario(p.id, origem);

  const abrirAssar = () => {
    setQtdAssar(Math.max(1, Math.min(6, p.freezer)));
    setGaveta('assar');
  };
  const abrirDescarte = () => {
    setOrigem(v.estoque > 0 ? 'vitrine' : 'freezer');
    setQtdDesc(1);
    setMotivo('Vencido');
    setObs('');
    setErroDesc(null);
    setGaveta('descartar');
  };
  useEffect(() => {
    if (descarteInicial && podeDescartar) abrirDescarte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descarteInicial]);
  const confirmarAssar = () => {
    const qtd = Math.min(qtdAssar, p.freezer);
    if (qtd <= 0) return;
    assarDoFreezer(p.id, p.nome, qtd, p.freezer);
    setGaveta(null);
    avisar(`${qtd}x ${p.nome} prontos para venda`);
  };
  const confirmarDescarte = () => {
    const erro = registrarDescarte({ produtoId: p.id, quantidade: qtdDesc, origem, disponivel, motivo, observacao: obs });
    if (erro) return setErroDesc(erro);
    setGaveta(null);
    avisar(`${qtdDesc}x ${p.nome} descartado · entra em Perdas`);
  };
  const alternar = () => {
    alternarAtivoProduto(p.id);
    setGaveta(null);
    avisar(p.ativo ? 'Produto inativado. Some do Novo pedido e da Produção.' : 'Produto reativado!');
  };

  return (
    <Modal visible animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <View style={s.detTopo}>
          <TouchableOpacity onPress={aoFechar} style={[s.redondo, sombra]} accessibilityRole="button" accessibilityLabel="Voltar para produtos">
            <Feather name="chevron-left" size={22} color={cor.texto} />
          </TouchableOpacity>
          <T style={s.detTopoTexto}>Produtos</T>
          <TouchableOpacity onPress={() => setGaveta('mais')} style={[s.redondo, sombra]} accessibilityRole="button" accessibilityLabel="Mais ações">
            <Feather name="more-horizontal" size={20} color={cor.textoMedio} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {/* IDENTIDADE */}
          <View style={s.identidade}>
            <View style={[s.iconeGrande, sombra]}>
              <T style={{ fontSize: 34 }}>{p.emoji}</T>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T titulo style={s.detNome}>{p.nome}</T>
              <View style={s.etiquetas}>
                <T style={s.dica}>{p.categoria}</T>
                <View style={[s.selo, { backgroundColor: cor.azulClaro }]}>
                  <T style={[s.seloTexto, { color: cor.azulTexto }]}>{ROTULO_DISP[p.disp]}</T>
                </View>
                {!p.ativo && (
                  <View style={[s.selo, { backgroundColor: cor.cinzaClaro }]}>
                    <T style={[s.seloTexto, { color: cor.textoSuave }]}>Inativo</T>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* PREÇO E MARGEM */}
          <View style={[s.cartao, sombra]}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={s.numRotulo}>Preço de venda</T>
                <T titulo style={[s.numValor, numeros]}>{brl(v.preco)}</T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={s.numRotulo}>Custo por un</T>
                <T titulo style={[s.numValor, numeros, { color: cor.textoMedio }]}>{p.custo ? brl(p.custo) : '—'}</T>
              </View>
              <View style={[s.margemCaixa, { backgroundColor: !p.temFicha ? cor.fundo : margemBaixa ? cor.vermelhoClaro : '#DCFCE7' }]}>
                <T style={[s.numRotulo, { color: !p.temFicha ? cor.textoSuave : margemBaixa ? cor.vermelho : cor.verde, fontWeight: '800' }]}>
                  {margemBaixa ? '⚠ Margem baixa' : 'Margem'}
                </T>
                <T titulo style={[s.numValor, numeros, { color: !p.temFicha ? cor.textoSuave : margemBaixa ? cor.vermelho : cor.verde }]}>
                  {p.temFicha ? `${p.margem}%` : '—'}
                </T>
              </View>
            </View>
            {desconto > 0 && (
              <View style={s.promo}>
                <T style={[s.promoTexto, numeros]}>
                  🏷 Promoção: −{brl(desconto)}/un · cliente paga <T style={[s.promoTexto, { fontWeight: '800' }]}>{brl(precoPromo)}</T>
                </T>
                {margemPromo !== null && (
                  <T style={[s.promoTexto, numeros, { fontWeight: '800', color: margemPromo < MARGEM_MINIMA ? cor.vermelho : cor.ambarTexto }]}>
                    {margemPromo < MARGEM_MINIMA ? '⚠ ' : ''}Margem na promoção: {margemPromo}%
                  </T>
                )}
              </View>
            )}
          </View>

          {/* ESTOQUE */}
          <View style={[s.cartao, sombra, { padding: 0, gap: 0 }]}>
            <View style={s.estLinha}>
              <View style={[s.estIcone, { backgroundColor: '#DCFCE7' }]}>
                <Feather name="check" size={17} color={cor.verde} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <T style={s.numRotulo}>Prontas para venda</T>
                <T style={[s.estValor, numeros, p.baixo && { color: cor.vermelho }]}>
                  {v.estoque} un{' '}
                  <T style={[s.dica, { fontWeight: '700', color: p.baixo ? cor.vermelho : cor.textoSuave }]}>
                    {p.baixo ? `· abaixo do mínimo (${v.estoqueMinimo})` : `· mínimo ${v.estoqueMinimo}`}
                  </T>
                </T>
              </View>
            </View>
            <View style={[s.estLinha, s.borda]}>
              <View style={[s.estIcone, { backgroundColor: '#E0F2FE' }]}>
                <T style={{ fontSize: 15, color: AZUL_FREEZER }}>❄</T>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <T style={s.numRotulo}>No freezer, para assar</T>
                <T style={[s.estValor, numeros]}>{p.freezer} un</T>
              </View>
              {podeAssar && (
                <TouchableOpacity style={s.assar} onPress={abrirAssar} accessibilityRole="button" accessibilityLabel={`Assar ${p.nome}`}>
                  <T style={s.assarTexto}>🔥 Assar</T>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.estAcoes}>
              <TouchableOpacity
                style={s.abrirProducao}
                onPress={() => {
                  aoFechar();
                  router.replace('/producao');
                }}
                accessibilityRole="button">
                <T style={s.link}>Abrir na Produção</T>
              </TouchableOpacity>
              {podeDescartar && (
                <TouchableOpacity style={s.lixeira} onPress={abrirDescarte} accessibilityRole="button" accessibilityLabel="Descartar">
                  <Feather name="trash-2" size={17} color={cor.vermelho} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* RECEITA */}
          <View style={[s.cartao, sombra, { paddingBottom: 8 }]}>
            <View style={s.cartaoTopo}>
              <T titulo style={s.cartaoTitulo}>Receita</T>
              {p.temFicha && (
                <T style={[s.dica, numeros]}>
                  rende {p.rendimento} un · {p.tempo} min
                </T>
              )}
            </View>
            {p.temFicha ? (
              <>
                {p.insumos.map((i) => (
                  <View key={i.id} style={[s.insumo, s.borda]}>
                    <T style={s.insumoNome} numberOfLines={1}>{i.nome}</T>
                    <T style={[s.dica, numeros]}>{i.qtd}</T>
                    <T style={[s.insumoCusto, numeros]}>{brl(i.custo)}</T>
                  </View>
                ))}
                <Botao rotulo="Editar receita" variante="secundario" altura={44} aoTocar={aoReceita} style={{ marginTop: 6, marginBottom: 8 }} />
              </>
            ) : (
              <View style={{ gap: 10, paddingBottom: 8 }}>
                <T style={s.explica}>Sem receita, o app não sabe o custo nem a margem, e a produção não desconta os insumos.</T>
                <Botao rotulo="Criar receita" altura={48} aoTocar={aoReceita} />
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <Botao rotulo="Editar produto" icone="edit-2" variante="secundario" aoTocar={aoEditar} style={{ flex: 1 }} />
          {!p.ativo && <Botao rotulo="Reativar" variante="verde" aoTocar={alternar} style={{ flex: 1 }} />}
        </View>

        <Aviso msg={msg} base={100 + insets.bottom} />

        <Gaveta aberta={gaveta === 'mais'} aoFechar={() => setGaveta(null)} titulo={p.nome} subtitulo="O que você quer fazer?">
          <View>
            {[
              { rotulo: 'Editar produto', icone: 'edit-2' as const, cor: cor.texto, acao: () => { setGaveta(null); aoEditar(); }, mostra: true },
              { rotulo: p.temFicha ? 'Editar receita' : 'Criar receita', icone: 'book-open' as const, cor: cor.texto, acao: () => { setGaveta(null); aoReceita(); }, mostra: true },
              { rotulo: 'Descartar unidades', icone: 'trash-2' as const, cor: cor.texto, acao: abrirDescarte, mostra: podeDescartar },
              p.ativo
                ? { rotulo: 'Inativar produto', icone: 'eye-off' as const, cor: cor.vermelho, acao: () => setGaveta('inativar'), mostra: true }
                : { rotulo: 'Reativar produto', icone: 'rotate-ccw' as const, cor: cor.verde, acao: alternar, mostra: true },
            ]
              .filter((o) => o.mostra)
              .map((o, i) => (
                <TouchableOpacity key={o.rotulo} style={[s.menuItem, i > 0 && s.borda]} onPress={o.acao} accessibilityRole="button">
                  <Feather name={o.icone} size={18} color={o.cor} />
                  <T style={[s.menuTexto, { color: o.cor }]}>{o.rotulo}</T>
                </TouchableOpacity>
              ))}
          </View>
        </Gaveta>

        <Gaveta aberta={gaveta === 'inativar'} aoFechar={() => setGaveta(null)} titulo="Inativar produto?" subtitulo="Dá para desfazer depois">
          <T style={s.explica}>{p.nome} some do Novo pedido e da Produção. Os pedidos antigos e os indicadores continuam guardados.</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao rotulo="Voltar" variante="secundario" aoTocar={() => setGaveta(null)} style={{ flex: 1 }} />
            <Botao rotulo="Sim, inativar" variante="perigo" aoTocar={alternar} style={{ flex: 1.3 }} />
          </View>
        </Gaveta>

        <Gaveta aberta={gaveta === 'assar'} aoFechar={() => setGaveta(null)} titulo="Registrar fornada" subtitulo={`${p.nome} · sai do freezer e fica pronto para venda`}>
          <T style={s.rotulo}>Quantas unidades saíram do forno?</T>
          <Contador valor={qtdAssar} min={1} max={p.freezer} aoMudar={setQtdAssar} corMais={LARANJA_ESCURO} fundoMais={LARANJA_CLARO} />
          <T style={[s.dica, numeros, { textAlign: 'center' }]}>
            Freezer fica com {Math.max(0, p.freezer - qtdAssar)} · pronto para venda: {v.estoque + Math.min(qtdAssar, p.freezer)} un
          </T>
          <Botao rotulo="Registrar fornada" aoTocar={confirmarAssar} style={{ backgroundColor: LARANJA }} />
        </Gaveta>

        <Gaveta aberta={gaveta === 'descartar'} aoFechar={() => setGaveta(null)} titulo="Descartar" subtitulo={p.nome}>
          {!!erroDesc && (
            <View style={s.erro}>
              <T style={s.erroTexto}>{erroDesc}</T>
            </View>
          )}
          <T style={s.rotulo}>Sai de onde?</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['vitrine', 'freezer'] as OrigemDescarte[]).map((o) => (
              <Opcao
                key={o}
                rotulo={`${o === 'vitrine' ? 'Pronto para venda' : 'Freezer'} · ${o === 'vitrine' ? v.estoque : p.freezer}`}
                ativo={origem === o}
                aoTocar={() => {
                  setOrigem(o);
                  setQtdDesc(1);
                }}
                style={{ flex: 1, minHeight: 50, borderRadius: 16 }}
              />
            ))}
          </View>
          <T style={s.rotulo}>Quantidade</T>
          <Contador valor={qtdDesc} min={1} max={Math.max(1, disponivel)} aoMudar={setQtdDesc} corMais={cor.texto} fundoMais={cor.cinzaClaro} />
          <T style={s.rotulo}>Motivo</T>
          <View style={s.chips}>
            {MOTIVOS_DESCARTE.map((m) => (
              <Opcao key={m} rotulo={m} ativo={motivo === m} aoTocar={() => setMotivo(m)} style={{ minHeight: 40 }} />
            ))}
          </View>
          <T style={s.rotulo}>
            Observação <T style={[s.dica, { fontWeight: '500' }]}>(opcional)</T>
          </T>
          <TextInput value={obs} onChangeText={setObs} placeholder="Ex.: doado para a feira do bairro" placeholderTextColor="#94A3B8" style={s.campo} />
          <View style={s.perda}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T style={[s.perdaTexto, { flex: 1 }]}>Perda de material</T>
              <T style={[s.perdaTexto, numeros]}>{brl(custoUnit * qtdDesc)}</T>
            </View>
            <T style={[s.dica, { color: '#991B1B' }]}>
              {brl(custoUnit)}/un · {origem === 'freezer' ? 'ingredientes da massa' : 'ingredientes + embalagem'} · entra em Perdas e desconta do estoque
            </T>
          </View>
          <Botao rotulo="Descartar" variante="perigo" aoTocar={confirmarDescarte} desativado={disponivel <= 0} />
        </Gaveta>
        {children}
      </SafeAreaView>
    </Modal>
  );
}

// Seletor grande de quantidade (− número +), igual ao da Produção
function Contador({ valor, min, max, aoMudar, corMais, fundoMais }: { valor: number; min: number; max?: number; aoMudar: (n: number) => void; corMais: string; fundoMais: string }) {
  const noMax = max !== undefined && valor >= max;
  return (
    <View style={s.contador}>
      <TouchableOpacity style={s.contadorMenos} onPress={() => aoMudar(Math.max(min, valor - 1))} accessibilityLabel="Menos">
        <Feather name="minus" size={22} color={cor.texto} />
      </TouchableOpacity>
      <TextInput
        value={String(valor)}
        onChangeText={(t) => {
          const n = parseInt(t.replace(/\D/g, ''), 10) || 0;
          aoMudar(Math.max(min, max !== undefined ? Math.min(max, n) : n));
        }}
        keyboardType="number-pad"
        style={[s.contadorValor, numeros]}
        accessibilityLabel="Quantidade"
      />
      <TouchableOpacity
        style={[s.contadorMais, { backgroundColor: fundoMais }, noMax && { opacity: 0.4 }]}
        disabled={noMax}
        onPress={() => aoMudar(max !== undefined ? Math.min(max, valor + 1) : valor + 1)}
        accessibilityLabel="Mais">
        <Feather name="plus" size={22} color={corMais} />
      </TouchableOpacity>
    </View>
  );
}

const campoWeb = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { paddingHorizontal: 20, paddingTop: 10, gap: 2 },
  titulo: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subtitulo: { fontSize: 13, fontWeight: '600', color: cor.textoSuave },
  dica: { fontSize: 12, color: cor.textoSuave },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  rotulo: { fontSize: 13, fontWeight: '800', color: cor.textoMedio },
  resumo: { marginHorizontal: 16, marginTop: 14, padding: 16, borderRadius: 22, backgroundColor: '#FFFFFF', gap: 12 },
  resumoRotulo: { fontSize: 12, fontWeight: '700' },
  resumoValor: { fontSize: 20, fontWeight: '700' },
  alerta: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro, flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertaTexto: { flex: 1, fontSize: 13, fontWeight: '800', color: cor.vermelho },
  alertaAcao: { fontSize: 13, fontWeight: '800', color: cor.vermelho },
  buscaLinha: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  busca: { flex: 1, height: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 10 },
  buscaInput: { flex: 1, minWidth: 0, height: 44, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  limpar: { width: 32, height: 32, borderRadius: 16, backgroundColor: cor.cinzaClaro, alignItems: 'center', justifyContent: 'center' },
  filtroBotao: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  filtroBadge: { position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: cor.azulBotao, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filtroBadgeTexto: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  mostrando: { marginHorizontal: 20, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mostrandoTexto: { flex: 1, fontSize: 13, color: cor.textoMedio },
  lista: { marginHorizontal: 16, marginTop: 12, borderRadius: 22, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  linha: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  borda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  icone: { width: 46, height: 46, borderRadius: 14, backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 15, fontWeight: '700' },
  seloLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  selo: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 7 },
  seloTexto: { fontSize: 11, fontWeight: '800' },
  estoque: { fontSize: 12, fontWeight: '700' },
  preco: { fontSize: 14, fontWeight: '800' },
  nota: { fontSize: 11, fontWeight: '700' },
  vazio: { margin: 16, marginTop: 24, padding: 28, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', gap: 6 },
  vazioTitulo: { fontSize: 16, fontWeight: '700' },
  vazioTexto: { fontSize: 13, color: cor.textoSuave, marginBottom: 8, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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

  // DETALHE
  detTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  detTopoTexto: { flex: 1, fontSize: 15, fontWeight: '700', color: cor.textoMedio },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 4 },
  iconeGrande: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  detNome: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, lineHeight: 25 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  cartao: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 22, backgroundColor: '#FFFFFF', gap: 12 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700' },
  numRotulo: { fontSize: 11, fontWeight: '700', color: cor.textoSuave },
  numValor: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  margemCaixa: { flex: 1, gap: 2, marginVertical: -6, marginHorizontal: -2, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 14 },
  promo: { padding: 12, borderRadius: 14, backgroundColor: cor.ambarFundo, gap: 2 },
  promoTexto: { fontSize: 13, color: cor.ambarTexto },
  estLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  estIcone: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  estValor: { fontSize: 16, fontWeight: '800' },
  assar: { height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: LARANJA_CLARO, alignItems: 'center', justifyContent: 'center' },
  assarTexto: { fontSize: 13, fontWeight: '800', color: LARANJA_ESCURO },
  estAcoes: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },
  abrirProducao: { flex: 1, height: 40, borderRadius: 20, backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center' },
  lixeira: { width: 40, height: 40, borderRadius: 20, backgroundColor: cor.vermelhoClaro, alignItems: 'center', justifyContent: 'center' },
  insumo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  insumoNome: { flex: 1, fontSize: 14 },
  insumoCusto: { width: 72, textAlign: 'right', fontSize: 13, fontWeight: '800' },
  explica: { fontSize: 14, lineHeight: 20, color: cor.textoMedio },
  rodape: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: cor.borda },
  menuItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuTexto: { fontSize: 15, fontWeight: '700' },
  erro: { padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro },
  erroTexto: { fontSize: 13, fontWeight: '700', color: cor.vermelho },
  campo: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, paddingHorizontal: 14, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  perda: { padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro, gap: 2 },
  perdaTexto: { fontSize: 14, fontWeight: '800', color: '#991B1B' },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contadorMenos: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
  contadorMais: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  contadorValor: { flex: 1, textAlign: 'center', fontSize: 32, fontWeight: '700', color: cor.texto, padding: 0, fontFamily: fonte.titulo, ...campoWeb },
});
