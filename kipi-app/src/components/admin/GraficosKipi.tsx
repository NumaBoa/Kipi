import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FONT_DISPLAY, FONT_SANS, COR } from '@/components/PaginaPortal';

// ============================================================================
// GRÁFICOS DO PAINEL KIPI — feitos com Views (passar o mouse / tocar mostra o valor).
// Uma série = um tom (azul da marca); cores de status sempre com rótulo.
// ============================================================================
const SERIE = '#5798D7';
const SERIE_DESTAQUE = '#2563EB';
const GRADE = '#EEF2F7';

interface Barra {
  rotulo: string;
  valor: number;
  detalhe?: string;
}

// Colunas por mês: o último (mês atual) em destaque e com o valor escrito
export function BarrasVerticais({ dados, formatar, altura = 150 }: { dados: Barra[]; formatar: (v: number) => string; altura?: number }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(1, ...dados.map((d) => d.valor));
  const ultimo = dados.length - 1;
  const foco = ativo ?? ultimo;
  return (
    <View>
      <View style={[g.plot, { height: altura }]}>
        {/* Grade discreta: 0, metade, topo */}
        {[0, 0.5, 1].map((f) => (
          <View key={f} style={[g.gradeLinha, { bottom: f * (altura - 22) }]}>
            <Text style={g.gradeRotulo}>{formatar(max * f)}</Text>
          </View>
        ))}
        <View style={g.colunas}>
          {dados.map((d, i) => {
            const h = Math.max(d.valor > 0 ? 3 : 0, (d.valor / max) * (altura - 22));
            const emFoco = i === foco;
            return (
              <Pressable
                key={d.rotulo}
                style={g.coluna}
                onHoverIn={() => setAtivo(i)}
                onHoverOut={() => setAtivo(null)}
                onPress={() => setAtivo(i === ativo ? null : i)}>
                {emFoco && (
                  <View style={g.dica}>
                    <Text style={g.dicaValor}>{formatar(d.valor)}</Text>
                    {d.detalhe ? <Text style={g.dicaDetalhe}>{d.detalhe}</Text> : null}
                  </View>
                )}
                <View style={[g.barra, { height: h, backgroundColor: i === ultimo ? SERIE_DESTAQUE : SERIE, opacity: ativo === null || emFoco ? 1 : 0.55 }]} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={g.eixoX}>
        {dados.map((d, i) => (
          <Text key={d.rotulo} style={[g.eixoRotulo, i === foco && { color: COR.texto, fontWeight: '800' }]}>
            {d.rotulo}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Barras deitadas (ranking): rótulo à esquerda, valor à direita
export function BarrasHorizontais({ dados, formatar }: { dados: Barra[]; formatar: (v: number) => string }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <View style={{ gap: 10 }}>
      {dados.map((d) => (
        <View key={d.rotulo}>
          <View style={g.hLinha}>
            <Text style={g.hRotulo}>{d.rotulo}</Text>
            <Text style={g.hValor}>{formatar(d.valor)}</Text>
          </View>
          <View style={g.hTrilho}>
            <View style={[g.hBarra, { width: `${(d.valor / max) * 100}%` }]} />
          </View>
          {d.detalhe ? <Text style={g.hDetalhe}>{d.detalhe}</Text> : null}
        </View>
      ))}
    </View>
  );
}

// Barra única dividida por situação + legenda com ícone, nome e quantidade
export function BarraSegmentada({ segmentos }: { segmentos: { rotulo: string; valor: number; cor: string; icone: string }[] }) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  const visiveis = segmentos.filter((s) => s.valor > 0);
  return (
    <View>
      <View style={g.segTrilho}>
        {visiveis.map((s, i) => (
          <View
            key={s.rotulo}
            style={[
              { flex: s.valor, backgroundColor: s.cor },
              i > 0 && { marginLeft: 2 },
              i === 0 && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
              i === visiveis.length - 1 && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
            ]}
          />
        ))}
      </View>
      <View style={g.legenda}>
        {segmentos.map((s) => (
          <View key={s.rotulo} style={g.legendaItem}>
            <View style={[g.legendaCor, { backgroundColor: s.cor }]} />
            <Text style={g.legendaTexto}>
              {s.icone} {s.rotulo}
            </Text>
            <Text style={g.legendaValor}>
              {s.valor}
              <Text style={g.legendaPct}> · {total > 0 ? Math.round((s.valor / total) * 100) : 0}%</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Barrinha de progresso (meta do mês)
export function Progresso({ pct, cor = SERIE_DESTAQUE }: { pct: number; cor?: string }) {
  return (
    <View style={g.progTrilho}>
      <View style={[g.progBarra, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: cor }]} />
    </View>
  );
}

const g = StyleSheet.create({
  plot: { position: 'relative', justifyContent: 'flex-end' },
  gradeLinha: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderTopColor: GRADE },
  gradeRotulo: { position: 'absolute', left: 0, top: -14, fontFamily: FONT_SANS, fontSize: 9, color: '#94A3B8' },
  colunas: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingLeft: 52, height: '100%' },
  coluna: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barra: { width: '100%', maxWidth: 34, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  dica: { backgroundColor: COR.texto, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginBottom: 4, alignItems: 'center' },
  dicaValor: { fontFamily: FONT_DISPLAY, fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  dicaDetalhe: { fontFamily: FONT_SANS, fontSize: 9, color: '#CBD5E1' },
  eixoX: { flexDirection: 'row', gap: 10, paddingLeft: 52, marginTop: 6 },
  eixoRotulo: { flex: 1, textAlign: 'center', fontFamily: FONT_SANS, fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  hLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  hRotulo: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: COR.texto },
  hValor: { fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: '800', color: COR.texto },
  hTrilho: { height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  hBarra: { height: '100%', borderRadius: 4, backgroundColor: SERIE },
  hDetalhe: { fontFamily: FONT_SANS, fontSize: 10, color: COR.suave, marginTop: 3 },
  segTrilho: { flexDirection: 'row', height: 14, borderRadius: 6, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  legenda: { marginTop: 12, gap: 6 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendaCor: { width: 10, height: 10, borderRadius: 3 },
  legendaTexto: { flex: 1, fontFamily: FONT_SANS, fontSize: 12, color: '#334155' },
  legendaValor: { fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: '800', color: COR.texto },
  legendaPct: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  progTrilho: { height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden', marginTop: 8 },
  progBarra: { height: '100%', borderRadius: 3 },
});
