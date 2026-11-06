import { Platform } from 'react-native';

// ============================================================================
// TEMA DA VERSÃO CELULAR — mesma identidade da web (azul + pistache, Sora/Manrope),
// com o azul um pouco mais escuro em botões preenchidos para o texto branco ficar legível.
// ============================================================================
export const cor = {
  fundo: '#F4F7FB',
  cartao: '#FFFFFF',
  texto: '#0F172A',
  textoForte: '#1E293B',
  textoMedio: '#475569',
  textoSuave: '#64748B',
  borda: '#E2E8F0',
  bordaSuave: '#F1F5F9',
  cinzaClaro: '#F1F5F9',
  apagado: '#CBD5E1',
  azul: '#5798D7',
  azulBotao: '#3E7BB8',
  azulTexto: '#2F6AA3',
  azulClaro: '#EAF3FA',
  pistache: '#B9C255',
  pistacheTexto: '#4F5A12',
  pistacheClaro: '#F1F6D8',
  verde: '#15803D',
  verdeClaro: '#F0FDF4',
  verdeBorda: '#BBF7D0',
  vermelho: '#B91C1C',
  vermelhoForte: '#DC2626',
  vermelhoClaro: '#FEF2F2',
  ambar: '#B45309',
  ambarTexto: '#92400E',
  ambarClaro: '#FEF3C7',
  ambarFundo: '#FFFBEB',
  escuro: '#0F172A',
  veu: 'rgba(15,23,42,0.45)',
};

export const fonte = {
  titulo: Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: undefined }),
  texto: Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: undefined }),
};

export const numeros = { fontVariant: ['tabular-nums' as const] };

export const sombra = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(15,23,42,0.06)' } as object,
  default: { shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});

// Etapas de produção (mesma ordem e nomes da versão de computador)
export const ETAPAS_PRODUCAO = [
  { id: 'a_fazer', label: 'A fazer', fg: '#475569', bg: '#F1F5F9' },
  { id: 'em_producao', label: 'Em produção', fg: '#92400E', bg: '#FEF3C7' },
  { id: 'pronto', label: 'Pronto p/ retirada', fg: '#1D4ED8', bg: '#EAF3FA' },
  { id: 'entregue', label: 'Entregue', fg: '#15803D', bg: '#DCFCE7' },
] as const;

export const NOME_FORMA: Record<string, string> = {
  pix: 'Pix',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  dinheiro: 'Dinheiro',
  pendente: 'Pendente',
};

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
