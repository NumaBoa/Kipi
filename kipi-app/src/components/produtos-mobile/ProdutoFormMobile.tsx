import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, type ScrollViewInstance, type TextInputProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { atualizarProduto, cadastrarProduto, type ProdutoVitrine } from '@/lib/estoqueVitrine';
import { brl, cor, fonte } from '@/components/mobile/tema';
import { Botao, Opcao, T } from '@/components/mobile/ui';

// ============================================================================
// CADASTRO / EDIÇÃO DE PRODUTO NO CELULAR — mesmas regras da versão de computador:
// nome, categoria e preço obrigatórios; promoção menor que o preço; na edição o
// estoque não muda (vem de vendas, produção e ajustes do Estoque Central).
// ============================================================================

export type Disponibilidade = NonNullable<ProdutoVitrine['disponibilidade']>;
export const EMOJIS_SUGESTOES = ['🍪', '🎂', '🧁', '🍬', '🥧', '🍫', '✨', '☕', '🥐', '🍓', '🎁', '🍩'];
export const CATEGORIAS_PADRAO = ['Cookies', 'Bolos & Bentôs', 'Doces Finos & Brigadeiros', 'Macarons', 'Tortas & Fatias', 'Bebidas & Cafés', 'Kits & Presentes'];
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
      <TextInput placeholderTextColor="#94A3B8" {...props} style={s.input} />
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
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [criandoCat, setCriandoCat] = useState(false);
  const [novaCat, setNovaCat] = useState('');
  const [catsExtras, setCatsExtras] = useState<string[]>([]);
  const [preco, setPreco] = useState('');
  const [desconto, setDesconto] = useState('');
  const [disp, setDisp] = useState<Disponibilidade>('pronta_entrega');
  const [estoque, setEstoque] = useState('');
  const [congelados, setCongelados] = useState('');
  const [minimo, setMinimo] = useState('');
  const [montarReceita, setMontarReceita] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel) return;
    const p = produto;
    setEmoji(emojiAtual ?? '🍪');
    setNome(p?.nome ?? '');
    setCategoria(p?.categoria ?? '');
    setCriandoCat(false);
    setNovaCat('');
    setPreco(p ? p.preco.toFixed(2).replace('.', ',') : '');
    setDesconto(p?.desconto ? p.desconto.toFixed(2).replace('.', ',') : '');
    setDisp(p?.disponibilidade ?? 'pronta_entrega');
    setEstoque('');
    setCongelados('');
    setMinimo(p ? String(p.estoqueMinimo) : '');
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
    const descontoNum = lerValor(desconto) || 0;
    if (descontoNum >= precoNum) return falhar('O desconto da promoção precisa ser menor que o preço de venda.');
    const minNum = parseFloat(minimo) || 0;

    if (produto) {
      atualizarProduto(produto.id, {
        nome: nome.trim(),
        categoria,
        preco: precoNum,
        estoqueMinimo: minNum,
        disponibilidade: disp,
        desconto: descontoNum || undefined,
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
      estoque: parseFloat(estoque) || 0,
      estoqueMinimo: minNum,
      disponibilidade: disp,
      desconto: descontoNum || undefined,
    });
    aoSalvo({ id, novo: true, montarReceita, congelados: parseInt(congelados, 10) || 0 }, emoji);
  };

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.topo}>
            <View style={{ flex: 1, gap: 1 }}>
              <T titulo style={s.titulo}>{editando ? 'Editar produto' : 'Novo produto'}</T>
              <T style={s.sub}>Nome, categoria e preço são obrigatórios</T>
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
              <View style={{ gap: 8 }}>
                <T style={s.rotulo}>Ícone</T>
                <View style={s.gradeEmoji}>
                  {EMOJIS_SUGESTOES.map((e) => {
                    const on = e === emoji;
                    return (
                      <TouchableOpacity
                        key={e}
                        style={[s.emoji, on && s.emojiOn]}
                        onPress={() => setEmoji(e)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`Ícone ${e}`}>
                        <T style={{ fontSize: 22 }}>{e}</T>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <Campo rotulo="Nome do produto *" value={nome} onChangeText={setNome} placeholder="Ex: Cookie Black Nutella & Avelã" />
              <View style={{ gap: 8 }}>
                <T style={s.rotulo}>Categoria *</T>
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
                    <TextInput value={novaCat} onChangeText={setNovaCat} placeholder="Nome da nova categoria" placeholderTextColor="#94A3B8" style={[s.input, { flex: 1 }]} accessibilityLabel="Nova categoria" autoFocus />
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
                <Campo style={{ flex: 1 }} rotulo="Preço de venda *" value={preco} onChangeText={setPreco} placeholder="R$ 0,00" keyboardType="decimal-pad" />
                <Campo style={{ flex: 1 }} rotulo="Promoção (−R$/un)" value={desconto} onChangeText={setDesconto} placeholder="Sem promoção" keyboardType="decimal-pad" />
              </View>
              {editando && resumoCusto && (
                <T style={s.dica}>
                  Custo pela receita: <T style={s.dicaForte}>{brl(resumoCusto.custo)}</T> · margem{' '}
                  <T style={[s.dicaForte, { color: resumoCusto.margem < 40 ? cor.vermelho : cor.verde }]}>{Math.round(resumoCusto.margem)}%</T> · sugerido {brl(resumoCusto.sugerido)}
                </T>
              )}
              <View style={{ gap: 8 }}>
                <T style={s.rotulo}>Como vende</T>
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

            {/* ESTOQUE */}
            <View style={s.bloco}>
              {!editando ? (
                <>
                  <View style={s.linha}>
                    <Campo style={{ flex: 1 }} rotulo="✓ Prontos na vitrine" value={estoque} onChangeText={setEstoque} placeholder="0" keyboardType="numeric" />
                    <Campo style={{ flex: 1 }} rotulo="❄ Massas no freezer" value={congelados} onChangeText={setCongelados} placeholder="0" keyboardType="numeric" />
                  </View>
                  <T style={[s.dica, { marginTop: -6 }]}>Massas no freezer descontam os insumos da receita.</T>
                </>
              ) : (
                <T style={s.dica}>O estoque muda com vendas, produção e ajustes do Estoque Central.</T>
              )}
              <Campo rotulo="Estoque mínimo" value={minimo} onChangeText={setMinimo} placeholder="Avisa quando ficar abaixo" keyboardType="numeric" />
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
  fechar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: 16, paddingTop: 8, gap: 12, paddingBottom: 32 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro },
  erroTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: cor.vermelho },
  bloco: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, gap: 14 },
  linha: { flexDirection: 'row', gap: 10 },
  rotulo: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  input: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  dica: { fontSize: 12, color: cor.textoSuave },
  dicaForte: { fontSize: 12, fontWeight: '800', color: cor.texto },
  gradeEmoji: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emoji: { width: '15%', flexGrow: 1, height: 46, borderRadius: 14, borderWidth: 1.5, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
  emojiOn: { borderColor: cor.azulBotao, backgroundColor: cor.azulClaro },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19 },
  chipNova: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9CC3E8', alignItems: 'center', justifyContent: 'center' },
  chipNovaTexto: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  dispo: { minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: cor.borda, justifyContent: 'center', gap: 1 },
  dispoOn: { borderColor: cor.azulBotao, backgroundColor: cor.azulClaro },
  dispoTitulo: { fontSize: 14, fontWeight: '800' },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  interruptorOn: { borderColor: cor.azulBotao, backgroundColor: cor.azulClaro },
  trilho: { width: 40, height: 24, borderRadius: 12 },
  bolinha: { position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  rodape: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: cor.borda },
});
