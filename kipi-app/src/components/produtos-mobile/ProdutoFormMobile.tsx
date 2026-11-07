import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, type ScrollViewInstance, type TextInputProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { atualizarProduto, cadastrarProduto, type ProdutoVitrine } from '@/lib/estoqueVitrine';
import { brl, cor, fonte } from '@/components/mobile/tema';
import { Botao, Opcao, T } from '@/components/mobile/ui';
import { ImagemProduto, escolherFotoProduto } from '@/components/ImagemProduto';
import { dinheiroParaCampo, mascaraDinheiro } from '@/lib/dinheiro';

// ============================================================================
// CADASTRO / EDIÇÃO DE PRODUTO NO CELULAR — mesmas regras da versão de computador:
// nome, categoria, preço e "como vende" obrigatórios; promoção em R$ ou %, menor que o
// preço; imagem pode ser ícone ou foto. Estoque não se informa aqui: ele vem de vendas,
// produção e ajustes do Estoque Central. Aqui ficam só os mínimos (vitrine e freezer).
// ============================================================================

export type Disponibilidade = NonNullable<ProdutoVitrine['disponibilidade']>;
export const EMOJIS_SUGESTOES = ['🍪', '🎂', '🧁', '🍬', '🥧', '🍫', '✨', '☕', '🥐', '🍓', '🎁', '🍩'];
// Sem categorias prontas: cada ateliê cria as suas (a lista vem dos próprios produtos)
export const CATEGORIAS_PADRAO: string[] = [];
const DISPONIBILIDADES: { id: Disponibilidade; rotulo: string; sub: string }[] = [
  { id: 'pronta_entrega', rotulo: 'Pronta-entrega', sub: 'Fica na vitrine, sai na hora' },
  { id: 'sob_encomenda', rotulo: 'Sob encomenda', sub: 'Só faz quando alguém pede, com data' },
  { id: 'hibrido', rotulo: 'Os dois', sub: 'Tem na vitrine e também aceita encomenda' },
];

const lerValor = (t: string) => parseFloat(t.replace(/\./g, '').replace(',', '.'));
const campoWeb = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

function Campo({ rotulo, style, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <T style={s.rotulo}>{rotulo}</T>
      <TextInput placeholderTextColor="#9A8F87" {...props} style={s.input} />
    </View>
  );
}

export type ProdutoSalvo = { id: string; novo: boolean; montarReceita: boolean; congelados: number };

export default function ProdutoFormMobile({
  visivel,
  produto,
  emojiAtual,
  categorias,
  resumoCusto,
  aoFechar,
  aoSalvo,
}: {
  visivel: boolean;
  produto: ProdutoVitrine | null; // null = cadastro novo
  emojiAtual?: string;
  categorias: string[];
  resumoCusto?: { custo: number; margem: number; sugerido: number } | null;
  aoFechar: () => void;
  aoSalvo: (r: ProdutoSalvo, emoji: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const rolagem = useRef<ScrollViewInstance>(null);
  const editando = !!produto;

  const [emoji, setEmoji] = useState('🍪');
  const [foto, setFoto] = useState<string | null>(null);
  const [escolhendoIcone, setEscolhendoIcone] = useState(false);
  const [promoTipo, setPromoTipo] = useState<'valor' | 'porcentagem'>('valor');
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [criandoCat, setCriandoCat] = useState(false);
  const [novaCat, setNovaCat] = useState('');
  const [catsExtras, setCatsExtras] = useState<string[]>([]);
  const [preco, setPreco] = useState('');
  const [desconto, setDesconto] = useState('');
  const [disp, setDisp] = useState<Disponibilidade | null>(null);
  const [minimo, setMinimo] = useState('');
  const [minimoFreezer, setMinimoFreezer] = useState('');
  const [montarReceita, setMontarReceita] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel) return;
    const p = produto;
    setEmoji(p?.emoji ?? emojiAtual ?? '🍪');
    setFoto(p?.foto ?? null);
    setEscolhendoIcone(false);
    setPromoTipo('valor');
    setNome(p?.nome ?? '');
    setCategoria(p?.categoria ?? '');
    setCriandoCat(!p && categorias.length === 0); // ateliê sem categorias: já abre o campo para criar a primeira
    setNovaCat('');
    setPreco(dinheiroParaCampo(p?.preco));
    setDesconto(dinheiroParaCampo(p?.desconto));
    // Cadastro novo começa sem "como vende": a pessoa precisa escolher
    setDisp(p ? p.disponibilidade ?? 'pronta_entrega' : null);
    setMinimo(p ? String(p.estoqueMinimo) : '');
    setMinimoFreezer(p?.minimoFreezer ? String(p.minimoFreezer) : '');
    setMontarReceita(true);
    setErro(null);
  }, [visivel, produto, emojiAtual]);

  const todasCats = Array.from(new Set([...categorias, ...catsExtras, ...(categoria ? [categoria] : [])]));

  const falhar = (m: string) => {
    setErro(m);
    rolagem.current?.scrollTo({ y: 0, animated: true });
  };

  const salvar = () => {
    if (!nome.trim()) return falhar('Informe o nome do produto.');
    if (!categoria.trim()) return falhar('Escolha a categoria do produto.');
    const precoNum = lerValor(preco);
    if (isNaN(precoNum) || precoNum <= 0) return falhar('Informe o preço de venda do produto.');
    const promoNum = lerValor(desconto) || 0;
    if (promoTipo === 'porcentagem' && promoNum >= 100) return falhar('A promoção em % precisa ser menor que 100%.');
    const descontoNum = promoTipo === 'porcentagem' ? Math.round(precoNum * promoNum) / 100 : promoNum;
    if (descontoNum >= precoNum) return falhar('O desconto da promoção precisa ser menor que o preço de venda.');
    if (!disp) return falhar('Escolha como o produto é vendido.');
    const minNum = parseFloat(minimo) || 0;
    const minFreezerNum = parseFloat(minimoFreezer) || 0;

    if (produto) {
      atualizarProduto(produto.id, {
        nome: nome.trim(),
        categoria,
        preco: precoNum,
        estoqueMinimo: minNum,
        minimoFreezer: minFreezerNum,
        disponibilidade: disp,
        desconto: descontoNum || undefined,
        emoji,
        foto,
      });
      aoSalvo({ id: produto.id, novo: false, montarReceita: false, congelados: 0 }, emoji);
      return;
    }
    const id = `prod-${Date.now()}`;
    cadastrarProduto({
      id,
      nome: nome.trim(),
      detalhe: categoria,
      categoria,
      preco: precoNum,
      custo: 0,
      estoque: 0,
      estoqueMinimo: minNum,
      minimoFreezer: minFreezerNum,
      disponibilidade: disp,
      desconto: descontoNum || undefined,
      emoji,
      foto,
    });
    aoSalvo({ id, novo: true, montarReceita, congelados: 0 }, emoji);
  };

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.topo}>
            <View style={{ flex: 1, gap: 1 }}>
              <T titulo style={s.titulo}>{editando ? 'Editar produto' : 'Novo produto'}</T>
              <T style={s.sub}>Nome, categoria, preço e como vende são obrigatórios</T>
            </View>
            <TouchableOpacity onPress={aoFechar} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar">
              <Feather name="x" size={18} color={cor.textoMedio} />
            </TouchableOpacity>
          </View>

          <ScrollView ref={rolagem} contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!!erro && (
              <View style={s.erro} accessibilityRole="alert">
                <Feather name="alert-circle" size={16} color={cor.vermelho} />
                <T style={s.erroTexto}>{erro}</T>
              </View>
            )}

            {/* IDENTIDADE */}
            <View style={s.bloco}>
              <View style={{ gap: 10 }}>
                <T style={s.rotulo}>Imagem do produto</T>
                <View style={s.imagemLinha}>
                  <ImagemProduto foto={foto} emoji={emoji} tamanho={76} raio={20} fundo={cor.carameloClaro} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <TouchableOpacity style={[s.imgBotao, escolhendoIcone && s.imgBotaoOn]} onPress={() => setEscolhendoIcone(!escolhendoIcone)} accessibilityRole="button">
                      <T style={{ fontSize: 16 }}>{emoji}</T>
                      <T style={s.imgBotaoTexto}>Escolher ícone</T>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.imgBotao}
                      accessibilityRole="button"
                      onPress={async () => {
                        const r = await escolherFotoProduto();
                        if (!r) return;
                        if (r.erro) return falhar(r.erro);
                        setFoto(r.foto ?? null);
                        setEscolhendoIcone(false);
                      }}>
                      <Feather name="camera" size={16} color={cor.carameloEscuro} />
                      <T style={s.imgBotaoTexto}>{foto ? 'Trocar foto' : 'Anexar foto'}</T>
                    </TouchableOpacity>
                  </View>
                </View>
                {!!foto && (
                  <TouchableOpacity onPress={() => setFoto(null)} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
                    <T style={s.removerFoto}>Remover foto e usar o ícone</T>
                  </TouchableOpacity>
                )}
                {escolhendoIcone && (
                  <View style={s.gradeEmoji}>
                    {EMOJIS_SUGESTOES.map((e) => {
                      const on = e === emoji && !foto;
                      return (
                        <TouchableOpacity
                          key={e}
                          style={[s.emoji, on && s.emojiOn]}
                          onPress={() => {
                            setEmoji(e);
                            setFoto(null);
                            setEscolhendoIcone(false);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`Ícone ${e}`}>
                          <T style={{ fontSize: 22 }}>{e}</T>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
              <Campo rotulo="Nome do produto *" value={nome} onChangeText={setNome} placeholder="Ex: Cookie Black Nutella & Avelã" />
              <View style={{ gap: 8 }}>
                <T style={s.rotulo}>Categoria *</T>
                {todasCats.length === 0 && <T style={{ fontSize: 13, color: '#6B615A' }}>Você ainda não tem categorias. Crie a primeira, por exemplo "Cookies" ou "Bolos".</T>}
                <View style={s.chips}>
                  {todasCats.map((c) => (
                    <Opcao key={c} rotulo={c} ativo={categoria === c} aoTocar={() => setCategoria(c)} style={s.chip} />
                  ))}
                  <TouchableOpacity style={s.chipNova} onPress={() => setCriandoCat(!criandoCat)} accessibilityRole="button">
                    <T style={s.chipNovaTexto}>+ Nova</T>
                  </TouchableOpacity>
                </View>
                {criandoCat && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput value={novaCat} onChangeText={setNovaCat} placeholder="Nome da nova categoria" placeholderTextColor="#9A8F87" style={[s.input, { flex: 1 }]} accessibilityLabel="Nova categoria" autoFocus />
                    <Botao
                      rotulo="Criar"
                      altura={50}
                      style={{ paddingHorizontal: 18, borderRadius: 14 }}
                      aoTocar={() => {
                        const n = novaCat.trim();
                        if (!n) return;
                        setCatsExtras((prev) => (prev.includes(n) ? prev : [...prev, n]));
                        setCategoria(n);
                        setNovaCat('');
                        setCriandoCat(false);
                      }}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* PREÇO */}
            <View style={s.bloco}>
              <View style={s.linha}>
                <Campo style={{ flex: 1 }} rotulo="Preço de venda *" value={preco} onChangeText={(t) => setPreco(mascaraDinheiro(t))} placeholder="R$ 0,00" keyboardType="decimal-pad" />
              </View>
              <View style={{ gap: 6 }}>
                <T style={s.rotulo}>Promoção</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={s.segmento}>
                    {(['valor', 'porcentagem'] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[s.segItem, promoTipo === t && s.segItemOn]}
                        onPress={() => {
                          // Troca o modo convertendo o valor já digitado
                          const pr = lerValor(preco);
                          const v = lerValor(desconto);
                          if (pr > 0 && v > 0 && t !== promoTipo) {
                            if (t === 'porcentagem') setDesconto(String(Math.round((v / pr) * 1000) / 10).replace('.', ','));
                            else setDesconto(dinheiroParaCampo(Math.round(pr * v) / 100));
                          } else if (t !== promoTipo) {
                            setDesconto('');
                          }
                          setPromoTipo(t);
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: promoTipo === t }}>
                        <T style={[s.segTexto, promoTipo === t && { color: cor.texto }]}>{t === 'valor' ? 'R$' : '%'}</T>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={desconto}
                    onChangeText={(t) => setDesconto(promoTipo === 'valor' ? mascaraDinheiro(t) : t.replace(/[^\d,]/g, ''))}
                    placeholder={promoTipo === 'valor' ? 'R$ 0,00 por unidade' : 'Ex: 10'}
                    placeholderTextColor="#9A8F87"
                    keyboardType="decimal-pad"
                    style={[s.input, { flex: 1, minWidth: 0 }]}
                    accessibilityLabel={promoTipo === 'valor' ? 'Desconto em reais' : 'Desconto em porcentagem'}
                  />
                </View>
                <T style={s.dica}>{promoTipo === 'valor' ? 'Desconto em R$ em cada unidade (opcional)' : 'Desconto em % no preço de venda (opcional)'}</T>
                {(() => {
                  const pr = lerValor(preco);
                  const v = lerValor(desconto);
                  if (!(pr > 0 && v > 0)) return null;
                  const d = promoTipo === 'porcentagem' ? (pr * v) / 100 : v;
                  if (d >= pr) return <T style={[s.dica, { color: cor.vermelho }]}>O desconto passa do preço de venda.</T>;
                  return (
                    <T style={s.dica}>
                      Sai por <T style={s.dicaForte}>{brl(pr - d)}</T> ({promoTipo === 'porcentagem' ? `−${brl(d)}` : `−${Math.round((d / pr) * 100)}%`})
                    </T>
                  );
                })()}
              </View>
              {editando && resumoCusto && (
                <T style={s.dica}>
                  Custo pela receita: <T style={s.dicaForte}>{brl(resumoCusto.custo)}</T> · margem{' '}
                  <T style={[s.dicaForte, { color: resumoCusto.margem < 40 ? cor.vermelho : cor.verde }]}>{Math.round(resumoCusto.margem)}%</T> · sugerido {brl(resumoCusto.sugerido)}
                </T>
              )}
              <View style={{ gap: 8 }}>
                <T style={s.rotulo}>Como vende *</T>
                {DISPONIBILIDADES.map((d) => {
                  const on = disp === d.id;
                  return (
                    <TouchableOpacity key={d.id} style={[s.dispo, on && s.dispoOn]} onPress={() => setDisp(d.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <T style={s.dispoTitulo}>{d.rotulo}</T>
                      <T style={s.dica}>{d.sub}</T>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ESTOQUE MÍNIMO (o estoque em si vem da produção, das vendas e do Estoque Central) */}
            <View style={s.bloco}>
              <View style={{ gap: 2 }}>
                <T style={s.rotulo}>Estoque mínimo</T>
                <T style={s.dica}>Avisa quando for hora de fazer mais. Deixe em branco se não quiser aviso.</T>
              </View>
              <View style={s.linha}>
                <Campo style={{ flex: 1 }} rotulo="✓ Na vitrine" value={minimo} onChangeText={setMinimo} placeholder="Ex: 10" keyboardType="numeric" />
                <Campo style={{ flex: 1 }} rotulo="❄ No freezer" value={minimoFreezer} onChangeText={setMinimoFreezer} placeholder="Ex: 12" keyboardType="numeric" />
              </View>
            </View>

            {/* RECEITA */}
            {!editando && (
              <TouchableOpacity
                style={[s.interruptor, montarReceita && s.interruptorOn]}
                onPress={() => setMontarReceita(!montarReceita)}
                accessibilityRole="switch"
                accessibilityState={{ checked: montarReceita }}
                activeOpacity={0.85}>
                <View style={[s.trilho, { backgroundColor: montarReceita ? cor.azulBotao : cor.apagado }]}>
                  <View style={[s.bolinha, { left: montarReceita ? 18 : 2 }]} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={s.dispoTitulo}>Montar a receita depois de salvar</T>
                  <T style={s.dica}>Ingredientes, embalagens, rendimento e lucro. Calcula custo e preço sugerido.</T>
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <Botao rotulo={editando ? 'Salvar alterações' : montarReceita ? 'Salvar e montar receita' : 'Cadastrar produto'} aoTocar={salvar} altura={54} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 12, paddingTop: 8, paddingBottom: 6 },
  titulo: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  sub: { fontSize: 12, color: cor.textoSuave },
  fechar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: 16, paddingTop: 8, gap: 12, paddingBottom: 32 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro },
  erroTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: cor.vermelho },
  bloco: { backgroundColor: '#FFFDFA', borderRadius: 22, padding: 16, gap: 14 },
  linha: { flexDirection: 'row', gap: 10 },
  rotulo: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  input: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFDFA', paddingHorizontal: 14, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  dica: { fontSize: 12, color: cor.textoSuave },
  dicaForte: { fontSize: 12, fontWeight: '800', color: cor.texto },
  imagemLinha: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  imgBotao: { height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: cor.borda, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  imgBotaoOn: { borderColor: cor.mirtilo, backgroundColor: cor.mirtiloClaro },
  imgBotaoTexto: { fontSize: 14, fontWeight: '700', color: cor.texto },
  removerFoto: { fontSize: 13, fontWeight: '700', color: cor.vermelho, paddingVertical: 4 },
  // Mesmo seletor R$ / % do lucro desejado da receita
  segmento: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: '#F3EEE7' },
  segItem: { width: 52, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: '#FFFDFA' },
  segTexto: { fontSize: 14, fontWeight: '800', color: cor.textoSuave },
  gradeEmoji: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emoji: { width: '15%', flexGrow: 1, height: 46, borderRadius: 14, borderWidth: 1.5, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
  emojiOn: { borderColor: cor.azulBotao, backgroundColor: cor.azulClaro },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19 },
  chipNova: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D6D7F3', alignItems: 'center', justifyContent: 'center' },
  chipNovaTexto: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  dispo: { minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: cor.borda, justifyContent: 'center', gap: 1 },
  dispoOn: { borderColor: cor.azulBotao, backgroundColor: cor.azulClaro },
  dispoTitulo: { fontSize: 14, fontWeight: '800' },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, borderWidth: 1.5, borderColor: '#FFFDFA', backgroundColor: '#FFFDFA' },
  interruptorOn: { borderColor: cor.azulBotao, backgroundColor: cor.azulClaro },
  trilho: { width: 40, height: 24, borderRadius: 12 },
  bolinha: { position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFDFA' },
  rodape: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFDFA', borderTopWidth: 1, borderTopColor: cor.borda },
});
