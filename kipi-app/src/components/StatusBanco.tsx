import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useStatusBanco } from '@/lib/sincronizacao';

// Selo no canto da tela: mostra que o app está nos dados reais (área do banco) e se salvou
const FONT_SANS = Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: 'System' });

const VISUAL = {
  carregando: { cor: '#4B4FC4', fundo: '#ECEBFA', icone: 'download-cloud', texto: 'Carregando do banco…' },
  salvando: { cor: '#4B4FC4', fundo: '#ECEBFA', icone: 'upload-cloud', texto: 'Salvando…' },
  ok: { cor: '#2F7D55', fundo: '#E4F1E9', icone: 'check-circle', texto: 'Salvo no banco' },
  erro: { cor: '#B42318', fundo: '#FBE7E4', icone: 'alert-triangle', texto: 'Erro no banco' },
} as const;

export default function StatusBanco() {
  const { estado, mensagem, area } = useStatusBanco();
  const [aberto, setAberto] = useState(false);
  if (estado === 'desligado') return null;
  // Em produção, tudo salvo não precisa de selo (só aparece salvando, carregando ou com erro)
  if (area === 'public' && estado === 'ok') return null;
  const v = VISUAL[estado];
  return (
    <View style={s.posicao} pointerEvents="box-none">
      <TouchableOpacity style={[s.selo, { backgroundColor: v.fundo, borderColor: v.cor }]} onPress={() => setAberto((a) => !a)} activeOpacity={0.85}>
        <Feather name={v.icone as any} size={12} color={v.cor} />
        <Text style={[s.texto, { color: v.cor }]}>
          {area.toUpperCase()} · {v.texto}
        </Text>
      </TouchableOpacity>
      {aberto && estado === 'erro' && !!mensagem && (
        <View style={s.detalhe}>
          <Text style={s.detalheTexto}>{mensagem}</Text>
          <Text style={s.detalheDica}>O app tenta salvar de novo sozinho. Se continuar, mande esta mensagem.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  posicao: { position: 'absolute', left: 12, bottom: 12, zIndex: 9999, alignItems: 'flex-start', gap: 6 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  texto: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '800' },
  detalhe: { maxWidth: 360, backgroundColor: '#FFFDFA', borderWidth: 1, borderColor: '#F3C4BD', borderRadius: 10, padding: 10, gap: 4 },
  detalheTexto: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#8A1C12' },
  detalheDica: { fontFamily: FONT_SANS, fontSize: 11, color: '#6B615A' },
});
