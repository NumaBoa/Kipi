import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sidebar from '@/components/Sidebar';
import { PageHeaderTitulo, TOPO_COMPACTO } from '@/components/PageHeader';

// ============================================================================
// MOLDURA DAS TELAS DO PORTAL DA REVENDEDORA E DO PAINEL KIPI:
// menu lateral + topo compacto + conteúdo rolável + aviso flutuante
// ============================================================================
export const FONT_DISPLAY = Platform.select({ web: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', default: 'System' });
export const FONT_SANS = Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: 'System' });
export const COR = {
  azul: '#9E5D25',
  azulForte: '#7A4520',
  azulClaro: '#ECEBFA',
  fundo: '#F8F6F2',
  verde: '#2F7D55',
  verdeClaro: '#E4F1E9',
  ambar: '#B9781A',
  ambarClaro: '#FBF0DC',
  vermelho: '#B42318',
  vermelhoClaro: '#FBE7E4',
  texto: '#2E211A',
  suave: '#6B615A',
  borda: '#E8E0D6',
};

export const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

// Aviso flutuante simples (some sozinho)
export const useAviso = () => {
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3200);
    return () => clearTimeout(t);
  }, [aviso]);
  return { aviso, avisar: setAviso };
};

interface Props {
  rota: string;
  etiqueta: string;
  titulo: string;
  subtitulo?: string;
  acoes?: React.ReactNode;
  aviso?: string | null;
  children: React.ReactNode;
}

export default function PaginaPortal({ rota, etiqueta, titulo, subtitulo, acoes, aviso, children }: Props) {
  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <View style={s.wrapper}>
        <Sidebar activeRoute={rota} />
        <View style={s.main}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={TOPO_COMPACTO}>
              <PageHeaderTitulo etiqueta={etiqueta} titulo={titulo} subtitulo={subtitulo} />
              {acoes ? <View style={s.acoes}>{acoes}</View> : null}
            </View>
            {children}
          </ScrollView>
          {aviso ? (
            <View style={s.aviso}>
              <Text style={s.avisoText}>{aviso}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// PEÇAS REPETIDAS NAS TELAS DO PORTAL
// ============================================================================
export function FaixaKpis({ itens }: { itens: { rotulo: string; valor: string; detalhe?: string; cor?: string; onPress?: () => void }[] }) {
  return (
    <View style={estilosPortal.kpiStrip}>
      {itens.map((k, idx) => {
        const Conteudo = (
          <>
            <Text style={estilosPortal.kpiLabel}>{k.rotulo}</Text>
            <Text style={[estilosPortal.kpiValor, k.cor ? { color: k.cor } : null]}>{k.valor}</Text>
            {k.detalhe ? <Text style={estilosPortal.kpiDetalhe}>{k.detalhe}</Text> : null}
          </>
        );
        return k.onPress ? (
          <TouchableOpacity key={k.rotulo} style={[estilosPortal.kpiItem, idx > 0 && estilosPortal.kpiDivisor]} onPress={k.onPress} activeOpacity={0.8}>
            {Conteudo}
          </TouchableOpacity>
        ) : (
          <View key={k.rotulo} style={[estilosPortal.kpiItem, idx > 0 && estilosPortal.kpiDivisor]}>
            {Conteudo}
          </View>
        );
      })}
    </View>
  );
}

export function Pill({ texto, cor, fundo }: { texto: string; cor: string; fundo: string }) {
  return (
    <View style={[estilosPortal.pill, { backgroundColor: fundo }]}>
      <Text style={[estilosPortal.pillText, { color: cor }]}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFDFA' },
  wrapper: { flex: 1, flexDirection: 'row', backgroundColor: COR.fundo },
  main: { flex: 1, backgroundColor: COR.fundo },
  scroll: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 40 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  aviso: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#2E211A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: 520,
  },
  avisoText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '600', color: '#FFFDFA' },
});

export const estilosPortal = StyleSheet.create({
  kpiStrip: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFFDFA', borderRadius: 14, borderWidth: 1, borderColor: COR.borda, marginBottom: 14 },
  kpiItem: { flexGrow: 1, flexBasis: 150, paddingHorizontal: 14, paddingVertical: 10 },
  kpiDivisor: { borderLeftWidth: 1, borderLeftColor: '#F3EEE7' },
  kpiLabel: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '700', color: COR.suave, letterSpacing: 0.3 },
  kpiValor: { fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: '800', color: COR.texto, marginTop: 2 },
  kpiDetalhe: { fontFamily: FONT_SANS, fontSize: 10, color: '#9A8F87', marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
  card: { flexGrow: 1, flexBasis: 340, backgroundColor: '#FFFDFA', borderRadius: 14, borderWidth: 1, borderColor: COR.borda, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  cardTitle: { fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: '800', color: COR.texto },
  cardSub: { fontFamily: FONT_SANS, fontSize: 11, color: COR.suave, marginTop: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#F3EEE7' },
  linhaNome: { flex: 1, fontFamily: FONT_SANS, fontSize: 12, fontWeight: '600', color: COR.texto },
  linhaSub: { fontFamily: FONT_SANS, fontSize: 10, color: COR.suave, marginTop: 1 },
  linhaValor: { fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: '800', color: COR.texto, textAlign: 'right' },
  vazio: { fontFamily: FONT_SANS, fontSize: 12, color: '#9A8F87', paddingVertical: 14, textAlign: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '800' },
  btnPri: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COR.azul, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  btnPriText: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: '700', color: '#FFFDFA' },
  btnSec: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFDFA', borderWidth: 1, borderColor: COR.borda, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  btnSecText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#3D312A' },
  btnMini: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: COR.borda, backgroundColor: '#FFFDFA' },
  btnMiniText: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '700', color: '#3D312A' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFDFA', borderWidth: 1, borderColor: COR.borda, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 220 },
  buscaInput: { flex: 1, fontFamily: FONT_SANS, fontSize: 13, color: COR.texto, outlineStyle: 'none' } as any,
  filtros: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: COR.borda, backgroundColor: '#FFFDFA' },
  chipAtivo: { backgroundColor: COR.azul, borderColor: COR.azul },
  chipText: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '700', color: '#4A3E37' },
  chipTextAtivo: { color: '#FFFDFA' },
  // Modal simples
  overlay: { flex: 1, backgroundColor: 'rgba(43, 36, 33, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 520, maxHeight: '92%', backgroundColor: '#FFFDFA', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: COR.borda },
  modalTitle: { fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: '800', color: COR.texto },
  label: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '700', color: '#4A3E37', letterSpacing: 0.4, marginBottom: 5, marginTop: 10 },
  input: { fontFamily: FONT_SANS, fontSize: 13, color: COR.texto, backgroundColor: COR.fundo, borderWidth: 1, borderColor: COR.borda, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  erro: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '600', color: COR.vermelho, backgroundColor: '#FBE7E4', borderRadius: 8, padding: 8, marginTop: 10 },
  rodape: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3EEE7' },
});
