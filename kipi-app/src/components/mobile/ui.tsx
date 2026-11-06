import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { cor, fonte } from './tema';

// ============================================================================
// PEÇAS VISUAIS DA VERSÃO CELULAR (gaveta, aviso, botões, etiquetas)
// ============================================================================

// Texto com a fonte do app
export const T = ({ style, titulo, ...props }: React.ComponentProps<typeof Text> & { titulo?: boolean }) => (
  <Text {...props} style={[{ fontFamily: titulo ? fonte.titulo : fonte.texto, color: cor.texto }, style]} />
);

// Gaveta que sobe de baixo (filtros, recebimento, ações...)
export function Gaveta({
  aberta,
  aoFechar,
  titulo,
  subtitulo,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <View style={s.veu}>
        <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel="Fechar" />
        <View style={[s.gaveta, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={s.alca} />
          <View style={s.gavetaTopo}>
            <View style={{ flex: 1, gap: 2 }}>
              <T titulo style={s.gavetaTitulo}>{titulo}</T>
              {!!subtitulo && <T style={s.gavetaSub}>{subtitulo}</T>}
            </View>
            <TouchableOpacity onPress={aoFechar} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar">
              <Feather name="x" size={16} color={cor.textoMedio} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Aviso rápido embaixo da tela ("Pedido quitado!")
export const useAviso = () => {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { msg, avisar };
};

export const Aviso = ({ msg, base = 110 }: { msg: string | null; base?: number }) =>
  msg ? (
    <View style={[s.aviso, { bottom: base }]} accessibilityRole="alert" pointerEvents="none">
      <Feather name="check" size={18} color={cor.pistache} />
      <T style={s.avisoTexto}>{msg}</T>
    </View>
  ) : null;

type Variante = 'primario' | 'secundario' | 'perigo' | 'sutil' | 'verde';
const VARIANTES: Record<Variante, { bg: string; fg: string; borda?: string }> = {
  primario: { bg: cor.azulBotao, fg: '#FFFFFF' },
  secundario: { bg: '#FFFFFF', fg: cor.texto, borda: cor.apagado },
  perigo: { bg: cor.vermelhoForte, fg: '#FFFFFF' },
  sutil: { bg: 'transparent', fg: cor.textoMedio },
  verde: { bg: cor.verde, fg: '#FFFFFF' },
};

export function Botao({
  rotulo,
  aoTocar,
  variante = 'primario',
  icone,
  desativado,
  altura = 52,
  style,
}: {
  rotulo: string;
  aoTocar?: () => void;
  variante?: Variante;
  icone?: keyof typeof Feather.glyphMap;
  desativado?: boolean;
  altura?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = desativado ? { bg: cor.borda, fg: cor.textoSuave } : VARIANTES[variante];
  return (
    <TouchableOpacity
      onPress={aoTocar}
      disabled={desativado}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desativado }}
      style={[s.botao, { height: altura, borderRadius: altura / 2, backgroundColor: v.bg }, v.borda ? { borderWidth: 1.5, borderColor: v.borda } : null, style]}>
      {icone && <Feather name={icone} size={18} color={v.fg} />}
      <T style={[s.botaoTexto, { color: v.fg }]}>{rotulo}</T>
    </TouchableOpacity>
  );
}

// Opção selecionável (filtros, forma de pagamento...)
export function Opcao({
  rotulo,
  ativo,
  aoTocar,
  forte,
  style,
  textoStyle,
  icone,
}: {
  rotulo: string;
  ativo: boolean;
  aoTocar: () => void;
  forte?: boolean; // ativo em escuro (filtros) em vez de azul claro (escolhas de formulário)
  style?: StyleProp<ViewStyle>;
  textoStyle?: StyleProp<TextStyle>;
  icone?: keyof typeof Feather.glyphMap;
}) {
  const bg = ativo ? (forte ? cor.escuro : cor.azulClaro) : '#FFFFFF';
  const borda = ativo ? (forte ? cor.escuro : cor.azulBotao) : cor.borda;
  const fg = ativo ? (forte ? '#FFFFFF' : cor.texto) : cor.texto;
  return (
    <TouchableOpacity
      onPress={aoTocar}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo }}
      style={[s.opcao, { backgroundColor: bg, borderColor: borda }, style]}>
      {icone && <Feather name={icone} size={17} color={ativo ? cor.azulTexto : cor.textoSuave} />}
      <T style={[s.opcaoTexto, { color: fg }, textoStyle]}>{rotulo}</T>
    </TouchableOpacity>
  );
}

export const Etiqueta = ({ texto, bg = cor.cinzaClaro, fg = cor.textoMedio }: { texto: string; bg?: string; fg?: string }) => (
  <View style={[s.etiqueta, { backgroundColor: bg }]}>
    <T style={[s.etiquetaTexto, { color: fg }]}>{texto}</T>
  </View>
);

export const Bloco = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[s.bloco, style]}>{children}</View>
);

const s = StyleSheet.create({
  veu: { flex: 1, backgroundColor: cor.veu, justifyContent: 'flex-end' },
  gaveta: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: '92%',
    gap: 14,
  },
  alca: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: cor.apagado },
  gavetaTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  gavetaTitulo: { fontSize: 20, fontWeight: '700' },
  gavetaSub: { fontSize: 13, color: cor.textoSuave },
  fechar: { width: 36, height: 36, borderRadius: 18, backgroundColor: cor.cinzaClaro, alignItems: 'center', justifyContent: 'center' },
  aviso: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: cor.escuro,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 50,
  },
  avisoTexto: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  botaoTexto: { fontSize: 15, fontWeight: '800' },
  opcao: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  opcaoTexto: { fontSize: 13, fontWeight: '700' },
  etiqueta: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, alignSelf: 'flex-start' },
  etiquetaTexto: { fontSize: 11, fontWeight: '700' },
  bloco: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, gap: 12 },
});
