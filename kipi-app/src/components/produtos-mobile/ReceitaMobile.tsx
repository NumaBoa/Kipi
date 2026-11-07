import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  calcularFicha,
  excluirFicha,
  fichaDoProduto,
  margemReal,
  MARGEM_MINIMA,
  salvarFicha,
  useFichas,
  useInsumos,
  type FichaTecnica,
  type ModoLucro,
} from '@/lib/insumos';
import { definirPrecoProduto, useEstoqueVitrine } from '@/lib/estoqueVitrine';
import { brl, cor, fonte, numeros } from '@/components/mobile/tema';
import { Botao, Gaveta, T } from '@/components/mobile/ui';
import InsumoFormMobile from '@/components/insumos-mobile/InsumoFormMobile';
import { dinheiroParaCampo, lerDinheiro, mascaraDinheiro } from '@/lib/dinheiro';

// ============================================================================
// RECEITA (FICHA TÉCNICA) NO CELULAR — mesmas regras do FichaTecnicaModal:
// custo pelo custo médio dos insumos, mão de obra = tempo × hora trabalhada,
// o preço só muda em "Salvar e usar o sugerido". Receita nova começa em branco
// (rende, preparo, custos extras e lucro) e todos os campos são obrigatórios.
// ============================================================================

const num = (s: string) => parseFloat(s.replace(',', '.')) || 0;
const campoWeb = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

export default function ReceitaMobile({
  produtoId,
  aoFechar,
  aoSalvo,
}: {
  produtoId: string | null;
  aoFechar: () => void;
  aoSalvo?: (msg: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const insumos = useInsumos();
  const { fichas, horaTrabalhada } = useFichas();
  const vitrine = useEstoqueVitrine();
  const produto = vitrine.find((p) => p.id === produtoId);
  const existente = !!produtoId && fichas.some((f) => f.produtoId === produtoId);

  const [rendimento, setRendimento] = useState('');
  const [tempo, setTempo] = useState('');
  const [itens, setItens] = useState<{ insumoId: string; qtd: string }[]>([]);
  const [extras, setExtras] = useState<{ id: string; descricao: string; valor: string }[]>([]);
  const [modoLucro, setModoLucro] = useState<ModoLucro | null>(null);
  const [lucro, setLucro] = useState('');
  const [cadastrandoInsumo, setCadastrandoInsumo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState('');
  const [resumoAberto, setResumoAberto] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);

  // Carrega a receita existente (ou rascunho vazio), igual ao editor do computador
  useEffect(() => {
    if (!produtoId) return;
    const f = fichaDoProduto(produtoId);
    setRendimento(f ? String(f.rendimento) : '');
    setTempo(f ? String(f.tempoPreparoMinutos) : '');
    setItens(f?.itens.map((it) => ({ insumoId: it.insumoId, qtd: String(it.quantidade).replace('.', ',') })) ?? []);
    setExtras(f?.custosExtras.map((c) => ({ id: c.id, descricao: c.descricao, valor: dinheiroParaCampo(c.valor) })) ?? []);
    setModoLucro(f?.modoLucro ?? null);
    setLucro(!f ? '' : f.modoLucro === 'reais' ? dinheiroParaCampo(f.lucroDesejado) : String(f.lucroDesejado).replace('.', ','));
    setErro(null);
    setResumoAberto(false);
  }, [produtoId]);

  const rascunho: FichaTecnica = {
    produtoId: produtoId ?? '',
    rendimento: Math.max(1, num(rendimento)),
    tempoPreparoMinutos: num(tempo),
    itens: itens.map((it) => ({ insumoId: it.insumoId, quantidade: num(it.qtd) })),
    custosExtras: extras.map((c) => ({ id: c.id, descricao: c.descricao.trim() || 'Custo extra', valor: lerDinheiro(c.valor) })),
    modoLucro: modoLucro ?? 'porcentagem',
    lucroDesejado: !modoLucro ? 0 : modoLucro === 'reais' ? lerDinheiro(lucro) : num(lucro),
  };
  const calc = calcularFicha(rascunho, insumos, horaTrabalhada);
  const margemAtual = produto ? margemReal(produto.preco, calc.custoUnitario) : 0;
  const margemSugerida = margemReal(calc.precoSugerido, calc.custoUnitario);
  const rend = Math.max(1, num(rendimento));
  const partes = [
    { id: 'ing', rotulo: 'Ingredientes', valor: calc.ingredientes / rend, cor: '#4B4FC4' },
    { id: 'emb', rotulo: 'Embalagens', valor: calc.embalagens / rend, cor: '#9EA0E0' },
    { id: 'mao', rotulo: `Mão de obra (${num(tempo)} min)`, valor: calc.maoDeObra / rend, cor: '#B9781A' },
    { id: 'ext', rotulo: 'Extras', valor: calc.extras / rend, cor: '#9A8F87' },
  ];

  const opcoes = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return insumos
      .filter((i) => i.status === 'ativo' && !itens.some((it) => it.insumoId === i.id))
      .filter((i) => !q || i.nome.toLowerCase().includes(q))
      .slice(0, 12);
  }, [insumos, itens, busca]);

  const salvar = (aplicarPreco: boolean) => {
    if (!produtoId) return;
    if (!(num(rendimento) > 0)) return setErro('Informe quanto a receita rende.');
    if (!(num(tempo) > 0)) return setErro('Informe o tempo de preparo em minutos.');
    if (itens.length === 0) return setErro('Inclua ao menos um ingrediente ou embalagem.');
    if (rascunho.itens.some((it) => !(it.quantidade > 0))) return setErro('Informe a quantidade de todos os insumos.');
    if (extras.some((c) => !c.descricao.trim() || !(lerDinheiro(c.valor) > 0))) return setErro('Preencha descrição e valor de cada custo extra (ou tire o que não usar).');
    if (!modoLucro) return setErro('Escolha o lucro desejado em % ou em R$.');
    if (!(rascunho.lucroDesejado > 0)) return setErro('Informe o lucro desejado.');
    salvarFicha({ ...rascunho, itens: rascunho.itens.filter((it) => it.quantidade > 0) });
    if (aplicarPreco) definirPrecoProduto(produtoId, Number(calc.precoSugerido.toFixed(2)));
    aoSalvo?.(aplicarPreco ? `Receita salva e preço agora é ${brl(calc.precoSugerido)}` : 'Receita salva. Custo e margem atualizados.');
    aoFechar();
  };

  const margemBaixa = !!produto && margemAtual < MARGEM_MINIMA;

  return (
    <Modal visible={!!produtoId} animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.topo}>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <T titulo style={s.titulo} numberOfLines={1}>Receita · {produto?.nome ?? ''}</T>
              <T style={s.sub}>Custo médio atual dos insumos · hora {brl(horaTrabalhada)}</T>
            </View>
            <TouchableOpacity onPress={aoFechar} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar">
              <Feather name="x" size={18} color={cor.textoMedio} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!!erro && (
              <View style={s.erro} accessibilityRole="alert">
                <Feather name="alert-circle" size={16} color={cor.vermelho} />
                <T style={s.erroTexto}>{erro}</T>
              </View>
            )}

            {/* RENDIMENTO E TEMPO */}
            <View style={[s.bloco, { flexDirection: 'row', gap: 10 }]}>
              <View style={{ flex: 1, gap: 6 }}>
                <T style={s.rotulo}>Rende (un) *</T>
                <TextInput value={rendimento} onChangeText={setRendimento} keyboardType="numeric" placeholder="Ex: 12" placeholderTextColor="#9A8F87" style={s.input} accessibilityLabel="Rendimento em unidades" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <T style={s.rotulo}>Preparo (min) *</T>
                <TextInput value={tempo} onChangeText={setTempo} keyboardType="numeric" placeholder="Ex: 45" placeholderTextColor="#9A8F87" style={s.input} accessibilityLabel="Tempo de preparo em minutos" />
              </View>
            </View>

            {/* INSUMOS */}
            <View style={[s.bloco, { gap: 4 }]}>
              <View style={s.blocoTopo}>
                <T titulo style={s.blocoTitulo}>Insumos da receita</T>
                <T style={[s.sub, numeros]}>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</T>
              </View>
              {itens.length === 0 && <T style={[s.sub, { paddingVertical: 8 }]}>Nenhum insumo ainda. Toque abaixo para incluir.</T>}
              {itens.map((it, idx) => {
                const item = insumos.find((i) => i.id === it.insumoId);
                if (!item) return null;
                const emb = item.tipo !== 'ingrediente';
                return (
                  <View key={it.insumoId} style={[s.itemLinha, s.borda]}>
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <T style={s.itemNome} numberOfLines={1}>{item.nome}</T>
                      <T style={[s.sub, numeros, emb && { color: '#4B4FC4' }]}>
                        {emb ? 'Embalagem' : 'Ingrediente'} · {brl(num(it.qtd) * item.custoUnitario)}
                      </T>
                    </View>
                    <View style={s.qtdCaixa}>
                      <TextInput
                        value={it.qtd}
                        onChangeText={(v) => setItens((prev) => prev.map((x, i) => (i === idx ? { ...x, qtd: v } : x)))}
                        keyboardType="decimal-pad"
                        style={[s.qtdInput, numeros]}
                        accessibilityLabel={`Quantidade de ${item.nome}`}
                      />
                      <T style={s.sub}>{item.unidadeFracionada}</T>
                    </View>
                    <TouchableOpacity style={s.tirar} onPress={() => setItens((prev) => prev.filter((_, i) => i !== idx))} accessibilityRole="button" accessibilityLabel={`Tirar ${item.nome}`}>
                      <Feather name="x" size={14} color={cor.textoSuave} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              <TouchableOpacity style={s.adicionar} onPress={() => { setBusca(''); setBuscando(true); }} accessibilityRole="button">
                <T style={s.adicionarTexto}>+ Adicionar ingrediente ou embalagem</T>
              </TouchableOpacity>
              {!!calc.gargalo && (
                <T style={[s.sub, { marginTop: 6 }]}>📦 O estoque dá para {calc.receitasPossiveis} {calc.receitasPossiveis === 1 ? 'receita' : 'receitas'} · falta primeiro: {calc.gargalo}</T>
              )}
            </View>

            {/* CUSTOS EXTRAS */}
            <View style={[s.bloco, { gap: 8 }]}>
              <T titulo style={s.blocoTitulo}>Custos extras por receita</T>
              <T style={s.sub}>Opcional. Gás, energia… A mão de obra já entra pelo tempo de preparo.</T>
              {extras.map((c, idx) => (
                <View key={c.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    value={c.descricao}
                    onChangeText={(v) => setExtras((prev) => prev.map((x, i) => (i === idx ? { ...x, descricao: v } : x)))}
                    placeholder="Descrição"
                    placeholderTextColor="#9A8F87"
                    style={[s.input, { flex: 1, minWidth: 0 }]}
                    accessibilityLabel="Descrição do custo"
                  />
                  <TextInput
                    value={c.valor}
                    onChangeText={(v) => setExtras((prev) => prev.map((x, i) => (i === idx ? { ...x, valor: mascaraDinheiro(v) } : x)))}
                    placeholder="R$ 0,00"
                    placeholderTextColor="#9A8F87"
                    keyboardType="decimal-pad"
                    style={[s.input, { width: 96, flexShrink: 0 }]}
                    accessibilityLabel="Valor do custo"
                  />
                  <TouchableOpacity style={s.tirar} onPress={() => setExtras((prev) => prev.filter((_, i) => i !== idx))} accessibilityRole="button" accessibilityLabel="Tirar custo">
                    <Feather name="x" size={14} color={cor.textoSuave} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setExtras((prev) => [...prev, { id: `extra-${Date.now()}`, descricao: '', valor: '' }])} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' }}>
                <T style={s.link}>+ custo extra</T>
              </TouchableOpacity>
            </View>

            {/* LUCRO */}
            <View style={[s.bloco, { gap: 10 }]}>
              <T titulo style={s.blocoTitulo}>Lucro desejado *</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={s.segmento}>
                  {(['porcentagem', 'reais'] as ModoLucro[]).map((m) => {
                    const on = modoLucro === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[s.segItem, on && s.segItemOn]}
                        onPress={() => {
                          if (m !== modoLucro) setLucro('');
                          setModoLucro(m);
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}>
                        <T style={[s.segTexto, on && { color: cor.texto }]}>{m === 'porcentagem' ? '%' : 'R$'}</T>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  value={lucro}
                  onChangeText={(t) => setLucro(modoLucro === 'reais' ? mascaraDinheiro(t) : t.replace(/[^\d,]/g, ''))}
                  editable={!!modoLucro}
                  placeholder={!modoLucro ? 'Escolha % ou R$' : modoLucro === 'reais' ? 'R$ 0,00' : 'Ex: 200'}
                  placeholderTextColor="#9A8F87"
                  keyboardType="decimal-pad"
                  style={[s.input, { flex: 1, minWidth: 0 }, !modoLucro && { backgroundColor: cor.cinzaClaro }]}
                  accessibilityLabel="Lucro desejado"
                />
              </View>
              <T style={s.sub}>{!modoLucro ? 'Escolha se o lucro é uma % do custo ou um valor fixo por unidade' : modoLucro === 'porcentagem' ? '% em cima do custo de cada unidade' : 'R$ de lucro em cada unidade'}</T>
            </View>

            {existente && (
              <TouchableOpacity onPress={() => setConfirmarExcluir(true)} style={{ minHeight: 46, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button">
                <T style={[s.link, { color: cor.vermelho }]}>Excluir receita</T>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* RESUMO FIXO + SALVAR */}
          <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <TouchableOpacity style={s.resumo} onPress={() => setResumoAberto(!resumoAberto)} accessibilityRole="button" accessibilityState={{ expanded: resumoAberto }} accessibilityLabel="Resumo por unidade">
              <View style={{ flex: 1 }}>
                <T style={s.resumoRotulo}>Custo por un</T>
                <T titulo style={[s.resumoValor, numeros]}>{brl(calc.custoUnitario)}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T style={[s.resumoRotulo, { color: cor.verde }]}>Preço sugerido</T>
                <T titulo style={[s.resumoValor, numeros, { color: cor.verde }]}>{brl(calc.precoSugerido)}</T>
              </View>
              {produto && (
                <View style={{ flex: 1 }}>
                  <T style={[s.resumoRotulo, margemBaixa && { color: cor.vermelho }]}>Na vitrine</T>
                  <T style={[s.resumoVitrine, numeros, margemBaixa && { color: cor.vermelho }]}>
                    {brl(produto.preco)} · {margemBaixa ? '⚠ ' : ''}{Math.round(margemAtual)}%
                  </T>
                </View>
              )}
              <Feather name={resumoAberto ? 'chevron-down' : 'chevron-up'} size={16} color={cor.textoSuave} />
            </TouchableOpacity>
            {resumoAberto && (
              <View style={{ gap: 6 }}>
                <View style={s.barra}>
                  {partes.map((p) => (p.valor > 0 ? <View key={p.id} style={{ flex: p.valor, backgroundColor: p.cor }} /> : null))}
                </View>
                {partes.map((p) => (
                  <View key={p.id} style={s.parte}>
                    <View style={[s.parteCor, { backgroundColor: p.cor }]} />
                    <T style={[s.sub, { flex: 1, color: cor.textoMedio }]}>{p.rotulo}</T>
                    <T style={[s.parteValor, numeros]}>{brl(p.valor)}</T>
                  </View>
                ))}
                <T style={s.sub}>Margem do preço sugerido: {Math.round(margemSugerida)}%</T>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Botao rotulo="Salvar receita" variante="secundario" aoTocar={() => salvar(false)} style={{ flex: 1 }} />
              <Botao rotulo={`Salvar e usar ${brl(calc.precoSugerido)}`} aoTocar={() => salvar(true)} style={{ flex: 1.4 }} />
            </View>
          </View>
        </KeyboardAvoidingView>

        <Gaveta aberta={buscando} aoFechar={() => setBuscando(false)} titulo="Adicionar insumo" subtitulo="Ingredientes e embalagens ativos">
          <View style={s.buscaCaixa}>
            <Feather name="search" size={16} color={cor.textoSuave} />
            <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar ingrediente ou embalagem…" placeholderTextColor="#9A8F87" style={s.buscaInput} accessibilityLabel="Buscar insumo" />
          </View>
          <TouchableOpacity
            style={s.cadastrarInsumo}
            onPress={() => {
              setBuscando(false);
              setCadastrandoInsumo(true);
            }}
            accessibilityRole="button">
            <Feather name="plus-circle" size={18} color={cor.mirtilo} />
            <T style={s.adicionarTexto}>{busca.trim() ? `Cadastrar "${busca.trim()}"` : 'Cadastrar ingrediente ou embalagem novo'}</T>
          </TouchableOpacity>
          <View>
            {opcoes.length === 0 && <T style={s.sub}>Nenhum insumo encontrado.</T>}
            {opcoes.map((i, idx) => (
              <TouchableOpacity
                key={i.id}
                style={[s.opcao, idx > 0 && s.borda]}
                onPress={() => {
                  setItens((prev) => [...prev, { insumoId: i.id, qtd: '' }]);
                  setBuscando(false);
                  setErro(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Incluir ${i.nome}`}>
                <T style={{ fontSize: 20 }}>{i.emoji}</T>
                <View style={{ flex: 1 }}>
                  <T style={s.itemNome}>{i.nome}</T>
                  <T style={[s.sub, numeros]}>
                    {i.tipo === 'ingrediente' ? 'Ingrediente' : 'Embalagem'} · {brl(i.custoUnitario)}/{i.unidadeFracionada}
                  </T>
                </View>
                <Feather name="plus" size={20} color={cor.azulTexto} />
              </TouchableOpacity>
            ))}
          </View>
        </Gaveta>

        {/* Cadastro de insumo sem sair da receita (abre por cima dela) */}
        <InsumoFormMobile
          visivel={cadastrandoInsumo}
          insumo={null}
          nomeInicial={busca.trim()}
          aoFechar={() => setCadastrandoInsumo(false)}
          aoSalvo={() => setCadastrandoInsumo(false)}
          aoCriado={(id) => {
            setItens((prev) => [...prev, { insumoId: id, qtd: '' }]);
            setErro(null);
          }}
        />

        <Gaveta aberta={confirmarExcluir} aoFechar={() => setConfirmarExcluir(false)} titulo="Excluir receita?" subtitulo={produto?.nome}>
          <T style={s.explica}>O produto fica sem custo e sem margem, e a produção deixa de descontar os insumos.</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao rotulo="Voltar" variante="secundario" aoTocar={() => setConfirmarExcluir(false)} style={{ flex: 1 }} />
            <Botao
              rotulo="Excluir"
              variante="perigo"
              aoTocar={() => {
                if (produtoId) excluirFicha(produtoId);
                setConfirmarExcluir(false);
                aoSalvo?.('Receita excluída');
                aoFechar();
              }}
              style={{ flex: 1.3 }}
            />
          </View>
        </Gaveta>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 12, paddingTop: 8, paddingBottom: 6 },
  titulo: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sub: { fontSize: 12, color: cor.textoSuave },
  fechar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: 16, paddingTop: 8, gap: 12, paddingBottom: 24 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro },
  erroTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: cor.vermelho },
  bloco: { backgroundColor: '#FFFDFA', borderRadius: 22, padding: 16 },
  blocoTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  blocoTitulo: { fontSize: 15, fontWeight: '700' },
  rotulo: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  input: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFDFA', paddingHorizontal: 12, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  borda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  itemLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  itemNome: { fontSize: 14, fontWeight: '700' },
  qtdCaixa: { width: 96, height: 42, borderRadius: 12, borderWidth: 1, borderColor: cor.borda, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 4 },
  qtdInput: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', textAlign: 'right', color: cor.texto, fontFamily: fonte.texto, padding: 0, ...campoWeb },
  tirar: { width: 36, height: 36, borderRadius: 18, backgroundColor: cor.cinzaClaro, alignItems: 'center', justifyContent: 'center' },
  adicionar: { marginTop: 6, height: 46, borderRadius: 23, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D6D7F3', alignItems: 'center', justifyContent: 'center' },
  cadastrarInsumo: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: cor.mirtiloClaro },
  adicionarTexto: { fontSize: 14, fontWeight: '800', color: cor.azulTexto },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  segmento: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: '#F3EEE7' },
  segItem: { width: 52, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: '#FFFDFA' },
  segTexto: { fontSize: 14, fontWeight: '800', color: cor.textoSuave },
  rodape: { backgroundColor: '#FFFDFA', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: cor.borda },
  resumo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resumoRotulo: { fontSize: 11, fontWeight: '700', color: cor.textoSuave },
  resumoValor: { fontSize: 17, fontWeight: '700' },
  resumoVitrine: { fontSize: 14, fontWeight: '800' },
  barra: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', backgroundColor: cor.cinzaClaro },
  parte: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parteCor: { width: 10, height: 10, borderRadius: 3 },
  parteValor: { fontSize: 12, fontWeight: '800' },
  buscaCaixa: { height: 46, borderRadius: 14, backgroundColor: cor.fundo, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  buscaInput: { flex: 1, height: 44, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  opcao: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  explica: { fontSize: 14, lineHeight: 20, color: cor.textoMedio },
});
