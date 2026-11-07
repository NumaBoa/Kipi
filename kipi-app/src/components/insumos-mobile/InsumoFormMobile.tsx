import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, type ScrollViewInstance, type TextInputProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ajustarEstoqueInsumo, fatorDaUnidade, salvarInsumo, unidadeFracionadaDe, type Armazenamento, type Insumo } from '@/lib/insumos';
import { cor, fonte, numeros } from '@/components/mobile/tema';
import { Botao, Opcao, T } from '@/components/mobile/ui';

// ============================================================================
// CADASTRO / EDIÇÃO DE INSUMO NO CELULAR — mesmas regras da versão de computador:
// nome e preço obrigatórios; custo na receita = preço pago ÷ conteúdo da embalagem.
// ============================================================================

type Tipo = 'ingrediente' | 'embalagem' | 'outro';
const UNIDADES: Record<Tipo, { v: string; comum: boolean }[]> = {
  ingrediente: [
    { v: 'kg', comum: true }, { v: 'g', comum: true }, { v: 'L', comum: true }, { v: 'ml', comum: true }, { v: 'un', comum: true }, { v: 'pct', comum: true },
    { v: 'lata', comum: false }, { v: 'pote', comum: false }, { v: 'cx', comum: false }, { v: 'garrafa', comum: false }, { v: 'balde', comum: false }, { v: 'tb', comum: false }, { v: 'medida', comum: false },
  ],
  outro: [
    { v: 'un', comum: true }, { v: 'pacote', comum: true }, { v: 'caixa', comum: true }, { v: 'm', comum: true },
  ],
  embalagem: [
    { v: 'un', comum: true }, { v: 'pacote', comum: true }, { v: 'caixa', comum: true }, { v: 'rolo', comum: true }, { v: 'duzia', comum: true }, { v: 'fardo', comum: true }, { v: 'm', comum: true },
    { v: 'cento', comum: false }, { v: 'milheiro', comum: false },
  ],
};
const ROTULO_UN: Record<string, string> = { medida: 'xícara / colher', duzia: 'dúzia' };
export const ARMAZENAMENTOS: { id: Armazenamento; emoji: string; rotulo: string; desc: string }[] = [
  { id: 'seco', emoji: '🌾', rotulo: 'Seco', desc: 'Despensa' },
  { id: 'refrigerado', emoji: '❄️', rotulo: 'Refrigerado', desc: '0 a 8 °C' },
  { id: 'congelado', emoji: '🧊', rotulo: 'Congelado', desc: '−18 °C' },
  { id: 'perecivel', emoji: '⏳', rotulo: 'Perecível', desc: 'Uso rápido' },
  { id: 'in_natura', emoji: '🍃', rotulo: 'In natura', desc: 'Hortifrúti' },
];

const num = (t: string) => parseFloat(t.replace(/\./g, '').replace(',', '.'));
const numSimples = (t: string) => parseFloat(t.replace(',', '.'));
const campoWeb = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

function Campo({ rotulo, style, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <T style={s.rotulo}>{rotulo}</T>
      <TextInput placeholderTextColor="#9A8F87" {...props} style={s.input} />
    </View>
  );
}

export default function InsumoFormMobile({
  visivel,
  insumo,
  aoFechar,
  aoSalvo,
}: {
  visivel: boolean;
  insumo: Insumo | null; // null = cadastro novo
  aoFechar: () => void;
  aoSalvo: (msg: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const rolagem = useRef<ScrollViewInstance>(null);
  const editando = !!insumo;

  const [tipo, setTipo] = useState<Tipo>('ingrediente');
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [unidade, setUnidade] = useState('kg');
  const [todas, setTodas] = useState(false);
  const [preco, setPreco] = useState('');
  const [conteudo, setConteudo] = useState('1000');
  const [armazenamento, setArmazenamento] = useState<Armazenamento>('seco');
  const [estoque, setEstoque] = useState('');
  const [minimo, setMinimo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState(''); // categoria do ingrediente ou "usado em"

  useEffect(() => {
    if (!visivel) return;
    const i = insumo;
    const t: Tipo = i ? i.tipo : 'ingrediente';
    setTipo(t);
    setNome(i?.nome ?? '');
    setMarca(i?.marcaFornecedor ?? '');
    setUnidade(i?.unidade ?? 'kg');
    setTodas(!!i && !UNIDADES[t].some((u) => u.comum && u.v === i.unidade));
    setPreco(i ? i.precoPago.toFixed(2).replace('.', ',') : '');
    setConteudo(i ? String(i.conteudoEmbalagem).replace('.', ',') : '1000');
    setArmazenamento(i?.armazenamento ?? 'seco');
    setEstoque(i ? String(i.quantidadeEstoque).replace('.', ',') : '');
    setMinimo(i ? String(i.estoqueMinimo).replace('.', ',') : '');
    setDetalhe((i?.tipo === 'ingrediente' ? i?.categoria : i?.usadoEm) ?? '');
    setErro(null);
  }, [visivel, insumo]);

  const trocarTipo = (t: Tipo) => {
    setTipo(t);
    setUnidade(t === 'ingrediente' ? 'kg' : t === 'outro' ? 'un' : 'pacote');
    setConteudo(t === 'ingrediente' ? '1000' : t === 'outro' ? '1' : '50');
    setTodas(false);
  };

  const precoNum = num(preco);
  const conteudoNum = numSimples(conteudo) || 1;
  const fracionada = unidadeFracionadaDe(tipo, unidade);
  const custo = precoNum > 0 ? precoNum / conteudoNum : 0;

  const falhar = (m: string) => {
    setErro(m);
    rolagem.current?.scrollTo({ y: 0, animated: true });
  };

  const salvar = () => {
    if (!nome.trim()) return falhar('Informe o nome do item.');
    if (isNaN(precoNum) || precoNum <= 0) return falhar('Digite um preço válido (ex: 29,90).');
    const estoqueNum = numSimples(estoque) || 0;
    const minimoNum = numSimples(minimo) || 0;
    const base = {
      nome: nome.trim(),
      tipo,
      unidade,
      precoPago: precoNum,
      conteudoEmbalagem: conteudoNum,
      unidadeFracionada: fracionada,
      fatorFracionado: fatorDaUnidade(unidade, conteudoNum),
      custoUnitario: custo,
      estoqueMinimo: minimoNum,
      armazenamento,
      marcaFornecedor: marca.trim() || undefined,
      ...(tipo === 'ingrediente' ? { categoria: detalhe.trim() || undefined } : { usadoEm: detalhe.trim() || undefined }),
    };
    if (insumo) {
      // O estoque muda pelo mesmo caminho do ajuste (−/+), para não pular o registro
      salvarInsumo({ ...insumo, ...base });
      const delta = Number((estoqueNum - insumo.quantidadeEstoque).toFixed(3));
      if (delta !== 0) ajustarEstoqueInsumo(insumo.id, delta);
      aoSalvo('Insumo atualizado!');
      return;
    }
    salvarInsumo({
      id: `ins-${Date.now()}`,
      ...base,
      quantidadeEstoque: estoqueNum,
      status: 'ativo',
      emoji: tipo === 'ingrediente' ? '🥫' : tipo === 'outro' ? '🧷' : '📦',
      ultimaCompra: new Date().toLocaleDateString('pt-BR'),
    });
    aoSalvo('Insumo cadastrado!');
  };

  const unidades = UNIDADES[tipo].filter((u) => u.comum || todas || u.v === unidade);

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.topo}>
            <View style={{ flex: 1, gap: 1 }}>
              <T titulo style={s.titulo}>{editando ? 'Editar insumo' : 'Novo insumo'}</T>
              <T style={s.sub}>Nome e preço pago são obrigatórios</T>
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

            {/* TIPO */}
            <View style={s.linha}>
              {([
                ['ingrediente', '🥫', 'Ingrediente', 'Farinha, chocolate, laticínio…'],
                ['embalagem', '📦', 'Embalagem', 'Caixa, fita, saco…'],
                ['outro', '🧷', 'Outro', 'Vela, topper, etiqueta…'],
              ] as const).map(([id, emoji, rotulo, sub]) => {
                const on = tipo === id;
                return (
                  <TouchableOpacity key={id} style={[s.tipo, on && s.tipoOn]} onPress={() => trocarTipo(id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <T style={{ fontSize: 22 }}>{emoji}</T>
                    <T style={s.tipoTitulo}>{rotulo}</T>
                    <T style={s.dica}>{sub}</T>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* COMPRA */}
            <View style={s.bloco}>
              <Campo rotulo="Nome *" value={nome} onChangeText={setNome} placeholder={tipo === 'ingrediente' ? 'Ex: Chocolate Belga 54% Callebaut' : tipo === 'outro' ? 'Ex: Topper de aniversário' : 'Ex: Caixa Kraft c/ Visor 6 Cookies'} />
              <Campo rotulo="Marca / fornecedor" value={marca} onChangeText={setMarca} placeholder="Ex: Callebaut, Nestlé, Cromus…" />
              <Campo
                rotulo={tipo === 'ingrediente' ? 'Categoria (opcional)' : 'Usado em (opcional)'}
                value={detalhe}
                onChangeText={setDetalhe}
                placeholder={tipo === 'ingrediente' ? 'Ex: Laticínio' : 'Ex: Bolos de aniversário'}
              />
              <View style={{ gap: 8 }}>
                <T style={s.rotulo}>Como você compra *</T>
                <View style={s.chips}>
                  {unidades.map((u) => (
                    <Opcao key={u.v} rotulo={ROTULO_UN[u.v] ?? u.v} ativo={unidade === u.v} aoTocar={() => setUnidade(u.v)} style={s.chip} />
                  ))}
                  <TouchableOpacity onPress={() => setTodas(!todas)} accessibilityRole="button" style={{ minHeight: 38, justifyContent: 'center', paddingHorizontal: 8 }}>
                    <T style={s.link}>{todas ? 'Menos' : 'Mais unidades'}</T>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={s.linha}>
                <Campo style={{ flex: 1 }} rotulo="Preço pago *" value={preco} onChangeText={setPreco} placeholder="R$ 0,00" keyboardType="decimal-pad" />
                <Campo style={{ flex: 1 }} rotulo={tipo === 'ingrediente' ? 'Vem quanto (g ou ml)' : 'Vem quantas (un, m)'} value={conteudo} onChangeText={setConteudo} keyboardType="decimal-pad" />
              </View>
              <View style={s.custo}>
                <T style={s.custoRotulo}>Custo na receita</T>
                <T style={[s.custoValor, numeros]}>{custo > 0 ? `R$ ${custo.toFixed(4).replace('.', ',')}/${fracionada}` : '—'}</T>
              </View>
            </View>

            {/* ARMAZENAMENTO */}
            <View style={[s.bloco, { gap: 8 }]}>
              <T style={s.rotulo}>Armazenamento</T>
              <View style={s.grade}>
                {ARMAZENAMENTOS.map((a) => {
                  const on = armazenamento === a.id;
                  return (
                    <TouchableOpacity key={a.id} style={[s.arm, on && s.tipoOn]} onPress={() => setArmazenamento(a.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <T style={{ fontSize: 18 }}>{a.emoji}</T>
                      <T style={s.armTitulo}>{a.rotulo}</T>
                      <T style={[s.dica, { fontSize: 10 }]}>{a.desc}</T>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ESTOQUE */}
            <View style={s.bloco}>
              <View style={s.linha}>
                <Campo style={{ flex: 1 }} rotulo={`Em estoque (${unidade})`} value={estoque} onChangeText={setEstoque} placeholder="Ex: 5" keyboardType="decimal-pad" />
                <Campo style={{ flex: 1 }} rotulo={`Mínimo (${unidade})`} value={minimo} onChangeText={setMinimo} placeholder="Avisa abaixo disso" keyboardType="decimal-pad" />
              </View>
            </View>
          </ScrollView>

          <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <Botao rotulo={editando ? 'Salvar alterações' : 'Salvar insumo'} aoTocar={salvar} altura={54} />
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
  dica: { fontSize: 11, color: cor.textoSuave },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  tipo: { flex: 1, minHeight: 76, padding: 10, borderRadius: 20, borderWidth: 1.5, borderColor: '#FFFDFA', backgroundColor: '#FFFDFA', gap: 4 },
  tipoOn: { borderColor: cor.azulBotao, backgroundColor: cor.azulClaro },
  tipoTitulo: { fontSize: 14, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19 },
  custo: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: cor.azulClaro, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  custoRotulo: { fontSize: 13, fontWeight: '700', color: cor.azulTexto },
  custoValor: { fontSize: 15, fontWeight: '800', color: cor.azulTexto },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  arm: { width: '31%', flexGrow: 1, minHeight: 64, padding: 6, borderRadius: 16, borderWidth: 1.5, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center', gap: 2 },
  armTitulo: { fontSize: 12, fontWeight: '800' },
  rodape: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFDFA', borderTopWidth: 1, borderTopColor: cor.borda },
});
