import { StyleSheet, Platform } from 'react-native';

// ============================================================================
// TIPOGRAFIA & CONSTANTES DE TEMA (KIPI ATELIÊ / UX SÊNIOR)
// ============================================================================
export const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
export const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });

export const KIPI_BLUE = '#5798D7';
export const KIPI_BLUE_DARK = '#3E7BB8';
export const KIPI_BLUE_TINT = '#EAF3FA';
export const KIPI_BLUE_ACCENT = '#2563EB';
export const KIPI_FROST_BG = '#F8FAFC';
export const SUCCESS_GREEN = '#16A34A';
export const SUCCESS_TINT = '#DCFCE7';
export const WARNING_AMBER = '#D97706';
export const WARNING_TINT = '#FEF3C7';
export const DANGER_RED = '#DC2626';
export const DANGER_TINT = '#FEE2E2';

const semOutline = Platform.select({ web: { outlineStyle: 'none' } as any });

// Estilos compartilhados pelos modais de revenda (dossiê, entrega e acerto)
export const estilosRevenda = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: KIPI_BLUE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    padding: 20,
    paddingTop: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  // KPIs
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  kpiLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  kpiValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  kpiSub: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },

  // SEÇÕES
  sectionTitle: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '800',
    color: KIPI_BLUE_DARK,
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 10,
  },
  emptyText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#94A3B8',
    paddingVertical: 14,
    textAlign: 'center',
  },

  // LISTAS (tabela simples)
  listCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  listRowEven: {
    backgroundColor: '#FAFCFE',
  },
  listMain: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  listSub: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  listValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },

  // FORMULÁRIO
  inputLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  formInput: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...semOutline,
  },
  formTextarea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DANGER_TINT,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorAlertText: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: DANGER_RED,
  },

  // BOTÕES
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KIPI_BLUE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  btnPrimaryDisabled: {
    backgroundColor: '#CBD5E1',
  },
  btnPrimaryText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  btnSecondaryText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-end',
    marginTop: 3,
  },
  statusPillText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
  },
});
