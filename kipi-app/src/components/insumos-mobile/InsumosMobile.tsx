import React, { useMemo, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  ajustarEstoqueInsumo,
  calcularFicha,
  custoPorUnidadeEstoque,
  definirHoraTrabalhada,
  margemReal,
  MARGEM_MINIMA,
  salvarInsumo,
  useFichas,
  useInsumos,
  type Armazenamento,
  type Insumo,
} from '@/lib/insumos';
import { congelarMassas } from '@/lib/insumos';
import { produtoAtivo, useEstoqueVitrine } from '@/lib/estoqueVitrine';
import TabBar from '@/components/mobile/TabBar';
import { brl, cor, fonte, numeros, sombra } from '@/components/mobile/tema';
import { Aviso, Botao, Gaveta, Opcao, T, useAviso } from '@/components/mobile/ui';
import ReceitaMobile from '@/components/produtos-mobile/ReceitaMobile';
import ProdutoFormMobile, { CATEGORIAS_PADRAO, type ProdutoSalvo } from '@/components/produtos-mobile/ProdutoFormMobile';
import InsumoFormMobile, { ARMAZENAMENTOS } from './InsumoFormMobile';
import { dinheiroParaCampo, lerDinheiro, mascaraDinheiro } from '@/lib/dinheiro';

// ============================================================================
// INSUMOS E RECEITAS NO CELULAR (mesma lista única de insumos e fichas da versão de computador)
// ============================================================================

type Aba = 'insumos' | 'receitas';
type TipoFiltro = 'todos' | 'ingrediente' | 'embalagem';
type StatusFiltro = 'ativos' | 'inativos' | 'todos';

const EMOJI_CATEGORIA: Record<string, string> = {
  Cookies: '🍪', 'Bolos & Bentos': '🎂', 'Bolos & Bentôs': '🎂', Macarons: '✨', 'Doces Finos': '🍬', Folhados: '🥐', Sobremesas: '🥧', Bebidas: '☕', Presentes: '🎁',
};
const fmtQtd = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');
// Custo bem pequeno (por g) aparece com 4 casas, como na versão de computador
const fmtCusto = (v: number) => (v < 0.1 ? `R$ ${v.toFixed(4).replace('.', ',')}` : brl(v));
const ehBaixo = (i: Insumo) => i.status === 'ativo' && i.quantidadeEstoque <= i.estoqueMinimo;
const campoWeb = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

export default function InsumosMobile() {
  const insets = useSafeAreaInsets();
  const { msg, avisar } = useAviso();
  const insumos = useInsumos();
  const { fichas, horaTrabalhada } = useFichas();
  const vitrine = useEstoqueVitrine();

  const [aba, setAba] = useState<Aba>('insumos');
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<TipoFiltro>('todos');
  const [arm, setArm] = useState<Armazenamento | 'todos'>('todos');
  const [status, setStatus] = useState<StatusFiltro>('ativos');
  const [repor, setRepor] = useState(false);
  const [gaveta, setGaveta] = useState<null | 'filtros' | 'novaReceita'>(null);
  const [horaTxt, setHoraTxt] = useState(dinheiroParaCampo(horaTrabalhada));
  const [fabCompacto, setFabCompacto] = useState(false);
  const ultimoY = useRef(0);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [form, setForm] = useState<{ aberto: boolean; id: string | null }>({ aberto: false, id: null });
  const [receita, setReceita] = useState<{ id: string; congelarDepois: number } | null>(null);
  const [produtoNovo, setProdutoNovo] = useState(false);

  // Receitas que usam cada insumo (pelas fichas reais, não pelo texto dos exemplos)
  const usos = useMemo(() => {
    const m = new Map<string, { produtoId: string; nome: string; emoji: string; qtd: string }[]>();
    fichas.forEach((f) => {
      const prod = vitrine.find((p) => p.id === f.produtoId);
      if (!prod) return;
      f.itens.forEach((it) => {
        const ins = insumos.find((i) => i.id === it.insumoId);
        const lista = m.get(it.insumoId) ?? [];
        lista.push({ produtoId: prod.id, nome: prod.nome, emoji: prod.emoji ?? EMOJI_CATEGORIA[prod.categoria] ?? '🧁', qtd: `${fmtQtd(it.quantidade)} ${ins?.unidadeFracionada ?? ''}` });
        m.set(it.insumoId, lista);
      });
    });
    return m;
  }, [fichas, vitrine, insumos]);

  const ingredientes = insumos.filter((i) => i.tipo === 'ingrediente').length;
  const embalagens = insumos.length - ingredientes;
  const paraRepor = insumos.filter(ehBaixo).length;
  const valorEstoque = insumos.reduce((a, i) => a + i.quantidadeEstoque * custoPorUnidadeEstoque(i), 0);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return insumos
      .filter((i) => {
        if (status === 'ativos' && i.status !== 'ativo') return false;
        if (status === 'inativos' && i.status !== 'inativo') return false;
        if (tipo === 'ingrediente' && i.tipo !== 'ingrediente') return false;
        if (tipo === 'embalagem' && i.tipo === 'ingrediente') return false;
        if (arm !== 'todos' && i.armazenamento !== arm) return false;
        if (repor && !ehBaixo(i)) return false;
        if (q) {
          const nasReceitas = (usos.get(i.id) ?? []).some((u) => u.nome.toLowerCase().includes(q)) || (i.receitasOndeUsado ?? []).some((r) => r.toLowerCase().includes(q));
          if (!i.nome.toLowerCase().includes(q) && !(i.marcaFornecedor ?? '').toLowerCase().includes(q) && !i.unidade.toLowerCase().includes(q) && !nasReceitas) return false;
        }
        return true;
      })
      // Quem precisa repor vem primeiro
      .sort((a, b) => Number(ehBaixo(b)) - Number(ehBaixo(a)));
  }, [insumos, busca, status, tipo, arm, repor, usos]);

  const receitas = useMemo(
    () =>
      fichas
        .map((f) => {
          const prod = vitrine.find((p) => p.id === f.produtoId);
          if (!prod) return null;
          const c = calcularFicha(f, insumos, horaTrabalhada);
          return { f, prod, c, margem: margemReal(prod.preco, c.custoUnitario) };
        })
        .filter((x): x is NonNullable<typeof x> => !!x),
    [fichas, vitrine, insumos, horaTrabalhada]
  );
  const semReceita = vitrine.filter((p) => produtoAtivo(p) && !fichas.some((f) => f.produtoId === p.id));
  const categorias = useMemo(() => Array.from(new Set([...CATEGORIAS_PADRAO, ...vitrine.filter(produtoAtivo).map((p) => p.categoria)])), [vitrine]);

  const partesFiltro = [
    repor ? 'Para repor' : null,
    tipo !== 'todos' ? (tipo === 'ingrediente' ? 'Ingredientes' : 'Embalagens') : null,
    arm !== 'todos' ? ARMAZENAMENTOS.find((a) => a.id === arm)?.rotulo : null,
    status !== 'ativos' ? (status === 'inativos' ? 'Inativos' : 'Ativos e inativos') : null,
  ].filter(Boolean);
  const limpar = () => {
    setBusca('');
    setTipo('todos');
    setArm('todos');
    setStatus('ativos');
    setRepor(false);
    setGaveta(null);
  };

  const detalhe = insumos.find((i) => i.id === detalheId) ?? null;
  const emEdicao = form.id ? insumos.find((i) => i.id === form.id) ?? null : null;

  const produtoSalvo = (r: ProdutoSalvo) => {
    setProdutoNovo(false);
    setReceita({ id: r.id, congelarDepois: r.congelados });
  };

  // Formulário e receita: com o detalhe aberto, ficam dentro dele (senão abririam por trás)
  const sobrepostos = (
    <>
      <InsumoFormMobile
        visivel={form.aberto}
        insumo={emEdicao}
        aoFechar={() => setForm({ aberto: false, id: null })}
        aoSalvo={(m) => {
          setForm({ aberto: false, id: null });
          avisar(m);
        }}
      />
      {receita && (
        <ReceitaMobile
          produtoId={receita.id}
          aoSalvo={avisar}
          aoFechar={() => {
            if (receita.congelarDepois > 0) congelarMassas(receita.id, receita.congelarDepois, true, 'cadastro do produto');
            setReceita(null);
          }}
        />
      )}
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
          <T titulo style={s.titulo}>Insumos e Receitas</T>
          <T style={[s.subtitulo, numeros]}>
            {aba === 'insumos' ? `${ingredientes} ingredientes · ${embalagens} embalagens` : `${receitas.length} receitas · custo pelo custo médio dos insumos`}
          </T>
        </View>

        <View style={s.segmento} accessibilityRole="tablist">
          {([
            ['insumos', 'Insumos', insumos.length],
            ['receitas', 'Receitas', receitas.length],
          ] as const).map(([id, rotulo, qtd]) => {
            const on = aba === id;
            return (
              <TouchableOpacity key={id} style={[s.segItem, on && s.segItemOn]} onPress={() => setAba(id)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <T style={[s.segTexto, on && s.segTextoOn]}>{rotulo}</T>
                <T style={[s.segNum, numeros]}>{qtd}</T>
              </TouchableOpacity>
            );
          })}
        </View>

        {aba === 'insumos' ? (
          <>
            {/* RESUMO */}
            <View style={[s.resumo, sombra]}>
              <View style={s.resumoLinha}>
                <T style={s.resumoRotulo}>Valor em estoque</T>
                <T titulo style={[s.resumoValor, numeros]}>{brl(valorEstoque)}</T>
              </View>
              {paraRepor > 0 ? (
                <TouchableOpacity style={[s.alerta, repor && { backgroundColor: '#FBE7E4' }]} onPress={() => setRepor(!repor)} accessibilityRole="button">
                  <Feather name="alert-triangle" size={16} color={cor.vermelho} />
                  <T style={s.alertaTexto}>{paraRepor} {paraRepor === 1 ? 'insumo para repor' : 'insumos para repor'}</T>
                  <T style={s.alertaTexto}>{repor ? 'Ver todos' : 'Ver ›'}</T>
                </TouchableOpacity>
              ) : (
                <View style={[s.alerta, { backgroundColor: cor.verdeClaro }]}>
                  <Feather name="check-circle" size={16} color={cor.verde} />
                  <T style={[s.alertaTexto, { color: cor.verde }]}>Estoque em níveis seguros</T>
                </View>
              )}
            </View>

            {/* BUSCA + FILTROS */}
            <View style={s.buscaLinha}>
              <View style={[s.busca, sombra]}>
                <Feather name="search" size={18} color="#9A8F87" />
                <TextInput value={busca} onChangeText={setBusca} placeholder="Nome, marca, receita…" placeholderTextColor="#9A8F87" style={s.buscaInput} accessibilityLabel="Buscar insumo" />
                {!!busca && (
                  <TouchableOpacity onPress={() => setBusca('')} style={s.limpar} accessibilityRole="button" accessibilityLabel="Limpar busca">
                    <Feather name="x" size={14} color={cor.textoMedio} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={[s.filtroBotao, sombra, partesFiltro.length > 0 && { backgroundColor: cor.azulClaro }]} onPress={() => setGaveta('filtros')} accessibilityRole="button" accessibilityLabel="Filtros">
                <Feather name="filter" size={18} color={partesFiltro.length > 0 ? cor.azulTexto : cor.textoMedio} />
                {partesFiltro.length > 0 && (
                  <View style={s.filtroBadge}>
                    <T style={s.filtroBadgeTexto}>{partesFiltro.length}</T>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            {partesFiltro.length > 0 && (
              <View style={s.mostrando}>
                <T style={s.mostrandoTexto} numberOfLines={1}>
                  Mostrando: <T style={[s.mostrandoTexto, { fontWeight: '800', color: cor.texto }]}>{partesFiltro.join(' · ')}</T>
                </T>
                <TouchableOpacity onPress={limpar} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
                  <T style={s.link}>Limpar</T>
                </TouchableOpacity>
              </View>
            )}

            {lista.length === 0 ? (
              <View style={s.vazio}>
                <T titulo style={s.vazioTitulo}>Nenhum insumo encontrado</T>
                <T style={s.vazioTexto}>Troque a busca ou os filtros, ou cadastre um insumo novo.</T>
                <Botao rotulo="Limpar busca e filtros" variante="secundario" altura={44} aoTocar={limpar} />
              </View>
            ) : (
              <View style={[s.lista, sombra]}>
                {lista.map((i, idx) => {
                  const baixo = ehBaixo(i);
                  const ativo = i.status === 'ativo';
                  const pct = i.estoqueMinimo > 0 ? Math.min(100, (i.quantidadeEstoque / (i.estoqueMinimo * 2)) * 100) : 100;
                  return (
                    <TouchableOpacity
                      key={i.id}
                      style={[s.linha, idx > 0 && s.borda, !ativo && { opacity: 0.6 }]}
                      onPress={() => setDetalheId(i.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${i.nome}`}
                      activeOpacity={0.7}>
                      <View style={s.icone}>
                        <T style={{ fontSize: 22 }}>{i.emoji}</T>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <T style={s.nome} numberOfLines={1}>{i.nome}</T>
                        <View style={s.nivelLinha}>
                          <View style={s.nivel}>
                            <View style={{ width: `${Math.max(6, pct)}%`, height: '100%', backgroundColor: baixo ? cor.vermelhoForte : '#2F7D55' }} />
                          </View>
                          <T style={[s.estoque, numeros, { color: !ativo ? '#9A8F87' : baixo ? cor.vermelho : cor.verde }]} numberOfLines={1}>
                            {!ativo ? 'Inativo' : `${baixo ? '⚠ ' : ''}${fmtQtd(i.quantidadeEstoque)} ${i.unidade} · mín ${fmtQtd(i.estoqueMinimo)}`}
                          </T>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <T style={[s.custo, numeros]}>
                          {fmtCusto(i.custoUnitario)}/{i.unidadeFracionada}
                        </T>
                        <T style={[s.nota, numeros]}>
                          {brl(i.precoPago)}/{i.unidade === 'kg' || i.unidade === 'L' || i.unidade === 'un' || i.unidade === 'm' ? i.unidade : `${fmtQtd(i.conteudoEmbalagem)} ${i.unidadeFracionada}`}
                        </T>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            {/* HORA TRABALHADA */}
            <View style={[s.hora, sombra]}>
              <View style={{ flex: 1 }}>
                <T style={s.horaTitulo}>Hora trabalhada</T>
                <T style={s.dica}>Vale para a mão de obra de todas as receitas</T>
              </View>
              <View style={s.horaCaixa}>
                <T style={s.dica}>R$</T>
                <TextInput
                  value={horaTxt}
                  onChangeText={(v) => {
                    const m = mascaraDinheiro(v);
                    setHoraTxt(m);
                    definirHoraTrabalhada(lerDinheiro(m));
                  }}
                  keyboardType="decimal-pad"
                  style={[s.horaInput, numeros]}
                  accessibilityLabel="Valor da hora trabalhada"
                />
                <T style={s.dica}>/h</T>
              </View>
            </View>

            {receitas.length === 0 ? (
              <View style={s.vazio}>
                <T titulo style={s.vazioTitulo}>Nenhuma receita ainda</T>
                <T style={s.vazioTexto}>Crie a primeira para saber o custo e a margem dos produtos.</T>
              </View>
            ) : (
              <View style={[s.lista, sombra]}>
                {receitas.map(({ f, prod, c, margem }, idx) => {
                  const baixa = margem < MARGEM_MINIMA;
                  const sugeridoDiferente = Math.abs(c.precoSugerido - prod.preco) >= 0.01;
                  return (
                    <TouchableOpacity
                      key={f.produtoId}
                      style={[s.receita, idx > 0 && s.borda]}
                      onPress={() => setReceita({ id: f.produtoId, congelarDepois: 0 })}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir receita de ${prod.nome}`}
                      activeOpacity={0.7}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={s.icone}>
                          <T style={{ fontSize: 22 }}>{prod.emoji ?? EMOJI_CATEGORIA[prod.categoria] ?? '🧁'}</T>
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <T style={s.nome} numberOfLines={1}>{prod.nome}</T>
                          <T style={[s.dica, numeros]} numberOfLines={1}>
                            {prod.categoria} · rende {f.rendimento} un · {f.tempoPreparoMinutos} min · {c.linhas.length} insumos
                          </T>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <T style={[s.preco, numeros]}>{brl(prod.preco)}</T>
                          <T style={[s.nota, numeros, { fontWeight: '800', color: baixa ? cor.vermelho : cor.verde }]}>
                            {baixa ? '⚠ ' : ''}margem {Math.round(margem)}%
                          </T>
                        </View>
                      </View>
                      <T style={[s.receitaInfo, numeros]}>
                        Custo {brl(c.custoUnitario)}/un
                        {sugeridoDiferente ? ' · sugerido ' : ''}
                        {sugeridoDiferente && <T style={s.sugerido}>{brl(c.precoSugerido)}</T>}
                      </T>
                      {!!c.gargalo && (
                        <T style={[s.receitaInfo, { color: c.receitasPossiveis === 0 ? cor.vermelho : cor.textoSuave }]}>
                          📦 O estoque dá para {c.receitasPossiveis} {c.receitasPossiveis === 1 ? 'receita' : 'receitas'} · falta primeiro: {c.gargalo}
                        </T>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[s.fab, fabCompacto && s.fabCompacto, { bottom: 78 + Math.max(insets.bottom, 8) }]}
        onPress={() => (aba === 'insumos' ? setForm({ aberto: true, id: null }) : setGaveta('novaReceita'))}
        accessibilityRole="button"
        accessibilityLabel={aba === 'insumos' ? 'Novo insumo' : 'Nova receita'}
        activeOpacity={0.9}>
        <Feather name="plus" size={22} color="#FFFDFA" />
        {!fabCompacto && <T style={s.fabTexto}>{aba === 'insumos' ? 'Novo insumo' : 'Nova receita'}</T>}
      </TouchableOpacity>

      <Aviso msg={msg} base={150 + insets.bottom} />
      <TabBar ativa="/mais" />

      <Gaveta aberta={gaveta === 'filtros'} aoFechar={() => setGaveta(null)} titulo="Filtros">
        <T style={s.rotulo}>Tipo</T>
        <View style={s.chips}>
          {([['todos', 'Todos'], ['ingrediente', `Ingredientes · ${ingredientes}`], ['embalagem', `Embalagens · ${embalagens}`]] as const).map(([id, r]) => (
            <Opcao key={id} rotulo={r} ativo={tipo === id} aoTocar={() => setTipo(id)} forte style={{ minHeight: 40 }} />
          ))}
        </View>
        <T style={s.rotulo}>Armazenamento</T>
        <View style={s.chips}>
          <Opcao rotulo="Todos" ativo={arm === 'todos'} aoTocar={() => setArm('todos')} forte style={{ minHeight: 40 }} />
          {ARMAZENAMENTOS.map((a) => (
            <Opcao key={a.id} rotulo={`${a.emoji} ${a.rotulo}`} ativo={arm === a.id} aoTocar={() => setArm(a.id)} forte style={{ minHeight: 40 }} />
          ))}
        </View>
        <T style={s.rotulo}>Situação</T>
        <View style={s.chips}>
          {([['ativos', 'Ativos'], ['inativos', 'Inativos'], ['todos', 'Todos']] as const).map(([id, r]) => (
            <Opcao key={id} rotulo={r} ativo={status === id} aoTocar={() => setStatus(id)} forte style={{ minHeight: 40 }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Botao rotulo="Limpar" variante="secundario" aoTocar={limpar} style={{ flex: 1 }} />
          <Botao rotulo={`Ver ${lista.length} insumos`} aoTocar={() => setGaveta(null)} style={{ flex: 1.4 }} />
        </View>
      </Gaveta>

      <Gaveta aberta={gaveta === 'novaReceita'} aoFechar={() => setGaveta(null)} titulo="Nova receita" subtitulo="Para qual produto?">
        {semReceita.length > 0 ? (
          <>
            <T style={s.rotulo}>Produtos ativos ainda sem receita</T>
            <View>
              {semReceita.map((p, idx) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.opcaoProduto, idx > 0 && s.borda]}
                  onPress={() => {
                    setGaveta(null);
                    setReceita({ id: p.id, congelarDepois: 0 });
                  }}
                  accessibilityRole="button">
                  <T style={{ fontSize: 20 }}>{p.emoji ?? EMOJI_CATEGORIA[p.categoria] ?? '🧁'}</T>
                  <View style={{ flex: 1 }}>
                    <T style={s.nome}>{p.nome}</T>
                    <T style={s.dica}>{p.categoria}</T>
                  </View>
                  <Feather name="chevron-right" size={18} color="#9A8F87" />
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <T style={s.dica}>Todos os produtos ativos já têm receita.</T>
        )}
        <TouchableOpacity
          style={s.criarProduto}
          onPress={() => {
            setGaveta(null);
            setProdutoNovo(true);
          }}
          accessibilityRole="button">
          <T style={s.link}>+ Criar produto novo com receita</T>
        </TouchableOpacity>
      </Gaveta>

      <ProdutoFormMobile visivel={produtoNovo} produto={null} categorias={categorias} aoFechar={() => setProdutoNovo(false)} aoSalvo={produtoSalvo} />

      {detalhe ? (
        <DetalheInsumo
          i={detalhe}
          usos={usos.get(detalhe.id) ?? []}
          aoFechar={() => setDetalheId(null)}
          aoEditar={() => setForm({ aberto: true, id: detalhe.id })}
          aoReceita={(id) => setReceita({ id, congelarDepois: 0 })}>
          {sobrepostos}
        </DetalheInsumo>
      ) : (
        sobrepostos
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// DETALHE DO INSUMO (tela inteira)
// ============================================================================
function DetalheInsumo({
  i,
  usos,
  aoFechar,
  aoEditar,
  aoReceita,
  children,
}: {
  i: Insumo;
  usos: { produtoId: string; nome: string; emoji: string; qtd: string }[];
  aoFechar: () => void;
  aoEditar: () => void;
  aoReceita: (produtoId: string) => void;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { msg, avisar } = useAviso();
  const [menu, setMenu] = useState(false);
  const ativo = i.status === 'ativo';
  const baixo = ehBaixo(i);
  const corEstoque = baixo ? cor.vermelho : cor.verde;
  const pct = i.estoqueMinimo > 0 ? Math.min(100, (i.quantidadeEstoque / (i.estoqueMinimo * 2)) * 100) : 100;
  const arm = ARMAZENAMENTOS.find((a) => a.id === i.armazenamento);
  const ingrediente = i.tipo === 'ingrediente';

  const alternar = () => {
    salvarInsumo({ ...i, status: ativo ? 'inativo' : 'ativo' });
    setMenu(false);
    avisar(ativo ? 'Insumo inativado. Sai da busca das receitas.' : 'Insumo reativado!');
  };

  return (
    <Modal visible animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <View style={s.detTopo}>
          <TouchableOpacity onPress={aoFechar} style={[s.redondo, sombra]} accessibilityRole="button" accessibilityLabel="Voltar para insumos">
            <Feather name="chevron-left" size={22} color={cor.texto} />
          </TouchableOpacity>
          <T style={s.detTopoTexto}>Insumos</T>
          <TouchableOpacity onPress={() => setMenu(true)} style={[s.redondo, sombra]} accessibilityRole="button" accessibilityLabel="Mais ações">
            <Feather name="more-horizontal" size={20} color={cor.textoMedio} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <View style={s.identidade}>
            <View style={[s.iconeGrande, sombra]}>
              <T style={{ fontSize: 32 }}>{i.emoji}</T>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T titulo style={s.detNome}>{i.nome}</T>
              <View style={s.etiquetas}>
                <View style={[s.selo, { backgroundColor: ingrediente ? cor.ambarClaro : '#ECEBFA' }]}>
                  <T style={[s.seloTexto, { color: ingrediente ? cor.ambarTexto : '#3A3D9E' }]}>{ingrediente ? 'Ingrediente' : i.tipo === 'outro' ? 'Outro' : 'Embalagem'}</T>
                </View>
                {arm && (
                  <View style={[s.selo, { backgroundColor: '#ECEBFA' }]}>
                    <T style={[s.seloTexto, { color: '#3A3D9E' }]}>{arm.emoji} {arm.rotulo}</T>
                  </View>
                )}
                {!!i.marcaFornecedor && <T style={s.dica}>{i.marcaFornecedor}</T>}
                {!ativo && (
                  <View style={[s.selo, { backgroundColor: cor.cinzaClaro }]}>
                    <T style={[s.seloTexto, { color: cor.textoSuave }]}>Inativo</T>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* CUSTO */}
          <View style={[s.cartao, sombra, { flexDirection: 'row', gap: 8 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={s.numRotulo}>Preço de compra</T>
              <T titulo style={[s.numValor, numeros]}>{brl(i.precoPago)}</T>
              <T style={s.dica}>
                por {i.unidade}
                {i.ultimaCompra ? ` · última compra ${i.ultimaCompra.slice(0, 5)}` : ''}
              </T>
            </View>
            <View style={s.custoCaixa}>
              <T style={[s.numRotulo, { color: cor.azulTexto, fontWeight: '800' }]}>Custo na receita</T>
              <T titulo style={[s.numValor, numeros, { color: cor.azulTexto }]}>{fmtCusto(i.custoUnitario)}</T>
              <T style={[s.dica, { color: cor.azulTexto }]}>por {i.unidadeFracionada}</T>
            </View>
          </View>

          {/* ESTOQUE */}
          <View style={[s.cartao, sombra]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ gap: 2 }}>
                <T style={s.horaTitulo}>Em estoque</T>
                <T style={[s.dica, { fontWeight: '700', color: corEstoque }]}>
                  {baixo ? `⚠ Repor · mínimo ${fmtQtd(i.estoqueMinimo)} ${i.unidade}` : `Acima do mínimo (${fmtQtd(i.estoqueMinimo)} ${i.unidade})`}
                </T>
              </View>
              <T titulo style={[s.estoqueGrande, numeros, { color: corEstoque }]}>
                {fmtQtd(i.quantidadeEstoque)} <T style={[s.dica, { fontSize: 15 }]}>{i.unidade}</T>
              </T>
            </View>
            <View style={s.barraGrande}>
              <View style={{ width: `${Math.max(6, pct)}%`, height: '100%', backgroundColor: corEstoque }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.ajusteMenos} onPress={() => ajustarEstoqueInsumo(i.id, -1)} accessibilityRole="button" accessibilityLabel={`Tirar 1 ${i.unidade}`}>
                <T style={[s.ajusteTexto, { color: cor.vermelho }]}>− 1 {i.unidade} (saída)</T>
              </TouchableOpacity>
              <TouchableOpacity style={s.ajusteMais} onPress={() => ajustarEstoqueInsumo(i.id, 1)} accessibilityRole="button" accessibilityLabel={`Somar 1 ${i.unidade}`}>
                <T style={[s.ajusteTexto, { color: cor.verde }]}>+ 1 {i.unidade} (entrada)</T>
              </TouchableOpacity>
            </View>
          </View>

          {/* USADO NAS RECEITAS */}
          <View style={[s.cartao, sombra, { paddingBottom: 8, gap: 4 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <T titulo style={s.cartaoTitulo}>Usado nas receitas</T>
              <T style={s.dica}>
                {usos.length} {usos.length === 1 ? 'receita' : 'receitas'}
              </T>
            </View>
            {usos.length === 0 ? (
              <T style={[s.dica, { paddingBottom: 8 }]}>Nenhuma receita usa este insumo ainda.</T>
            ) : (
              usos.map((u) => (
                <TouchableOpacity key={u.produtoId} style={[s.uso, s.borda]} onPress={() => aoReceita(u.produtoId)} accessibilityRole="button" accessibilityLabel={`Abrir receita de ${u.nome}`}>
                  <T style={{ fontSize: 18 }}>{u.emoji}</T>
                  <T style={[s.nome, { flex: 1, fontSize: 14 }]} numberOfLines={1}>{u.nome}</T>
                  <T style={[s.dica, numeros]}>{u.qtd}</T>
                  <Feather name="chevron-right" size={16} color="#9A8F87" />
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <Botao rotulo="Editar insumo" icone="edit-2" variante="secundario" aoTocar={aoEditar} style={{ flex: 1 }} />
          {!ativo && <Botao rotulo="Reativar" variante="verde" aoTocar={alternar} style={{ flex: 1 }} />}
        </View>

        <Aviso msg={msg} base={100 + insets.bottom} />

        <Gaveta aberta={menu} aoFechar={() => setMenu(false)} titulo={i.nome}>
          <View>
            <TouchableOpacity style={s.menuItem} onPress={() => { setMenu(false); aoEditar(); }} accessibilityRole="button">
              <Feather name="edit-2" size={18} color={cor.texto} />
              <T style={s.menuTexto}>Editar insumo</T>
            </TouchableOpacity>
            <TouchableOpacity style={[s.menuItem, s.borda]} onPress={alternar} accessibilityRole="button">
              <Feather name={ativo ? 'eye-off' : 'rotate-ccw'} size={18} color={ativo ? cor.vermelho : cor.verde} />
              <T style={[s.menuTexto, { color: ativo ? cor.vermelho : cor.verde }]}>{ativo ? 'Inativar insumo' : 'Reativar insumo'}</T>
            </TouchableOpacity>
          </View>
        </Gaveta>
        {children}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { paddingHorizontal: 20, paddingTop: 10, gap: 2 },
  titulo: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitulo: { fontSize: 13, fontWeight: '600', color: cor.textoSuave },
  dica: { fontSize: 12, color: cor.textoSuave },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  rotulo: { fontSize: 13, fontWeight: '800', color: cor.textoMedio },
  segmento: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, padding: 4, gap: 4, borderRadius: 16, backgroundColor: '#F3EEE7' },
  segItem: { flex: 1, height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segItemOn: { backgroundColor: '#FFFDFA', shadowColor: '#2E211A', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTexto: { fontSize: 14, fontWeight: '600', color: cor.textoMedio },
  segTextoOn: { fontWeight: '800', color: cor.texto },
  segNum: { fontSize: 12, fontWeight: '800', color: cor.textoSuave },
  resumo: { marginHorizontal: 16, marginTop: 12, padding: 14, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#FFFDFA', gap: 10 },
  resumoLinha: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  resumoRotulo: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  resumoValor: { fontSize: 20, fontWeight: '700' },
  alerta: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro, flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertaTexto: { fontSize: 13, fontWeight: '800', color: cor.vermelho, flexShrink: 1 },
  buscaLinha: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  busca: { flex: 1, height: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFFDFA', flexDirection: 'row', alignItems: 'center', gap: 10 },
  buscaInput: { flex: 1, minWidth: 0, height: 44, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  limpar: { width: 32, height: 32, borderRadius: 16, backgroundColor: cor.cinzaClaro, alignItems: 'center', justifyContent: 'center' },
  filtroBotao: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  filtroBadge: { position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: cor.azulBotao, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filtroBadgeTexto: { fontSize: 11, fontWeight: '800', color: '#FFFDFA' },
  mostrando: { marginHorizontal: 20, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mostrandoTexto: { flex: 1, fontSize: 13, color: cor.textoMedio },
  lista: { marginHorizontal: 16, marginTop: 12, borderRadius: 22, backgroundColor: '#FFFDFA', overflow: 'hidden' },
  linha: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  borda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  icone: { width: 44, height: 44, borderRadius: 14, backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 15, fontWeight: '700' },
  nivelLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  nivel: { width: 56, height: 5, borderRadius: 3, backgroundColor: cor.cinzaClaro, overflow: 'hidden' },
  estoque: { flex: 1, fontSize: 12, fontWeight: '700' },
  custo: { fontSize: 14, fontWeight: '800', color: cor.azulTexto },
  nota: { fontSize: 11, color: cor.textoSuave },
  preco: { fontSize: 14, fontWeight: '800' },
  vazio: { margin: 16, marginTop: 24, padding: 28, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', gap: 6 },
  vazioTitulo: { fontSize: 16, fontWeight: '700' },
  vazioTexto: { fontSize: 13, color: cor.textoSuave, marginBottom: 8, textAlign: 'center' },
  hora: { marginHorizontal: 16, marginTop: 12, minHeight: 56, paddingVertical: 8, paddingLeft: 16, paddingRight: 8, borderRadius: 20, backgroundColor: '#FFFDFA', flexDirection: 'row', alignItems: 'center', gap: 10 },
  horaTitulo: { fontSize: 14, fontWeight: '700' },
  horaCaixa: { height: 44, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, flexDirection: 'row', alignItems: 'center', gap: 4 },
  horaInput: { width: 56, fontSize: 15, fontWeight: '800', color: cor.texto, textAlign: 'right', fontFamily: fonte.texto, padding: 0, ...campoWeb },
  receita: { paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  receitaInfo: { paddingLeft: 56, fontSize: 12, color: cor.textoMedio },
  sugerido: { fontSize: 12, fontWeight: '800', color: cor.verde },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opcaoProduto: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  criarProduto: { height: 52, borderRadius: 26, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D6D7F3', alignItems: 'center', justifyContent: 'center' },
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
  fabTexto: { color: '#FFFDFA', fontSize: 15, fontWeight: '800' },

  // DETALHE
  detTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  detTopoTexto: { flex: 1, fontSize: 15, fontWeight: '700', color: cor.textoMedio },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 4 },
  iconeGrande: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  detNome: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, lineHeight: 25 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  selo: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 7 },
  seloTexto: { fontSize: 11, fontWeight: '800' },
  cartao: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 22, backgroundColor: '#FFFDFA', gap: 12 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700' },
  numRotulo: { fontSize: 11, fontWeight: '700', color: cor.textoSuave },
  numValor: { fontSize: 18, fontWeight: '700' },
  custoCaixa: { flex: 1, gap: 2, marginVertical: -8, marginRight: -6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, backgroundColor: cor.azulClaro },
  estoqueGrande: { fontSize: 30, fontWeight: '700' },
  barraGrande: { height: 6, borderRadius: 3, backgroundColor: cor.cinzaClaro, overflow: 'hidden' },
  ajusteMenos: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: '#F3C4BD', alignItems: 'center', justifyContent: 'center' },
  ajusteMais: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: cor.verdeBorda, backgroundColor: cor.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  ajusteTexto: { fontSize: 14, fontWeight: '800' },
  uso: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rodape: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFDFA', borderTopWidth: 1, borderTopColor: cor.borda },
  menuItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuTexto: { fontSize: 15, fontWeight: '700' },
});
