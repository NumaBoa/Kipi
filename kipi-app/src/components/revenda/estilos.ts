import { paraCelular } from '@/lib/responsivo';
import { StyleSheet, Platform } from 'react-native';

// ============================================================================
// TIPOGRAFIA & CONSTANTES DE TEMA (KIPI ATELIÊ / UX SÊNIOR)
// ============================================================================
export const FONT_DISPLAY = Platform.select({ web: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', default: 'System' });
export const FONT_SANS = Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: 'System' });

export const KIPI_BLUE = '#9E5D25';
export const KIPI_BLUE_DARK = '#7A4520';
export const KIPI_BLUE_TINT = '#ECEBFA';
export const KIPI_BLUE_ACCENT = '#4B4FC4';
export const KIPI_FROST_BG = '#F8F6F2';
export const SUCCESS_GREEN = '#2F7D55';
export const SUCCESS_TINT = '#E4F1E9';
export const WARNING_AMBER = '#B9781A';
export const WARNING_TINT = '#FBF0DC';
export const DANGER_RED = '#B42318';
export const DANGER_TINT = '#FBE7E4';

const semOutline = Platform.select({ web: { outlineStyle: 'none' } as any });

// Estilos compartilhados pelos modais de revenda (dossiê, entrega e acerto)
export const estilosRevenda = paraCelular(StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 36, 33, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    backgroundColor: '#FFFDFA',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE7',
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
    color: '#2E211A',
  },
  modalSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#6B615A',
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
    borderTopColor: '#F3EEE7',
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
    borderColor: '#E8E0D6',
    borderRadius: 14,
    padding: 12,
  },
  kpiLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
    color: '#9A8F87',
    letterSpacing: 0.6,
  },
  kpiValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '800',
    color: '#2E211A',
    marginTop: 4,
  },
  kpiSub: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: '#9A8F87',
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
    color: '#9A8F87',
    paddingVertical: 14,
    textAlign: 'center',
  },

  // LISTAS (tabela simples)
  listCard: {
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 14,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE7',
    gap: 10,
  },
  listRowEven: {
    backgroundColor: '#F8F6F2',
  },
  listMain: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
  },
  listSub: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#6B615A',
    marginTop: 1,
  },
  listValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: '#2E211A',
    textAlign: 'right',
  },

  // FORMULÁRIO
  inputLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#4A3E37',
    marginBottom: 6,
  },
  formInput: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#2E211A',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E8E0D6',
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
    backgroundColor: '#D9CFC4',
  },
  btnPrimaryText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFDFA',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FFFDFA',
    gap: 6,
  },
  btnSecondaryText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#4A3E37',
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
}));
