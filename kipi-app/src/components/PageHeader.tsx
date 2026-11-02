import { paraCelular } from '@/lib/responsivo';
import React from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';

// ============================================================================
// TOPO PADRÃO DAS TELAS (COMPACTO) — mesmo visual da Gestão de Clientes:
// faixa branca com etiqueta, título e subtítulo à esquerda e ações à direita
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });

const ATELIE_GREEN = '#2D7A58';
const ATELIE_TINT = '#EAF5F1';

// Faixa do topo para telas cujo conteúdo tem padding 28 (lados) e 24 (topo):
// as margens negativas fazem a faixa ir de ponta a ponta, como na tela de Clientes
export const TOPO_COMPACTO: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  marginHorizontal: -28,
  marginTop: -24,
  marginBottom: 16,
  paddingHorizontal: 28,
  paddingVertical: 18,
  backgroundColor: '#FFFFFF',
  borderBottomWidth: 1,
  borderBottomColor: '#E2E8F0',
};

interface PageHeaderTituloProps {
  etiqueta: string; // ex: "ATELIÊ · CLIENTES & FIDELIDADE"
  titulo: string;
  subtitulo?: string;
}

export function PageHeaderTitulo({ etiqueta, titulo, subtitulo }: PageHeaderTituloProps) {
  return (
    <View style={styles.topHeaderLeft}>
      <View style={styles.tagBadge}>
        <Text style={styles.tagBadgeText}>{etiqueta}</Text>
      </View>
      <Text style={styles.pageTitle}>{titulo}</Text>
      {subtitulo ? <Text style={styles.pageSubtitle}>{subtitulo}</Text> : null}
    </View>
  );
}

const styles = paraCelular(StyleSheet.create({
  topHeaderLeft: {
    gap: 3,
    flexShrink: 1,
  },
  tagBadge: {
    backgroundColor: ATELIE_TINT,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
}));
