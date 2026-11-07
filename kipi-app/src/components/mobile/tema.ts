import { Platform } from 'react-native';

// ============================================================================
// TEMA DA VERSÃO CELULAR — nova identidade (caramelo + mirtilo, Bricolage Grotesque/Instrument Sans).
// Os nomes antigos (azul*, pistache*) foram mantidos para não mexer em todas as telas.
// ============================================================================
export const cor = {
  fundo: '#F8F6F2',
  cartao: '#FFFDFA',
  texto: '#2E211A',
  textoForte: '#2E211A',
  textoMedio: '#4A3E37',
  textoSuave: '#6B615A',
  borda: '#E8E0D6',
  bordaSuave: '#F3EEE7',
  cinzaClaro: '#F3EEE7',
  apagado: '#D9CFC4',
  // Caramelo (marca e ação principal)
  azul: '#B06A2C',
  azulBotao: '#9E5D25',
  // Mirtilo (navegação, seleção e links)
  azulTexto: '#4B4FC4',
  azulClaro: '#ECEBFA',
  // Caramelo claro (antigo pistache)
  pistache: '#B06A2C',
  pistacheTexto: '#7A4520',
  pistacheClaro: '#F6E8D6',
  verde: '#2F7D55',
  verdeClaro: '#E4F1E9',
  verdeBorda: '#BFDCCB',
  vermelho: '#B42318',
  vermelhoForte: '#B42318',
  vermelhoClaro: '#FBE7E4',
  ambar: '#9A6516',
  ambarTexto: '#9A6516',
  ambarClaro: '#FBF0DC',
  ambarFundo: '#FBF0DC',
  escuro: '#2E211A',
  veu: 'rgba(43,36,33,0.45)',
  // Nova identidade
  caramelo: '#B06A2C',
  carameloEscuro: '#7A4520',
  carameloTinta: '#5A3318',
  carameloClaro: '#F6E8D6',
  creme: '#FFF6EA',
  mirtilo: '#4B4FC4',
  mirtiloEscuro: '#3A3D9E',
  mirtiloClaro: '#ECEBFA',
};

export const fonte = {
  titulo: Platform.select({ web: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', default: undefined }),
  texto: Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: undefined }),
};

export const numeros = { fontVariant: ['tabular-nums' as const] };

export const sombra = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(43,36,33,0.06)' } as object,
  default: { shadowColor: '#2E211A', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});

// Etapas de produção (mesma ordem e nomes da versão de computador)
export const ETAPAS_PRODUCAO = [
  { id: 'a_fazer', label: 'A fazer', fg: '#4A3E37', bg: '#F3EEE7' },
  { id: 'em_producao', label: 'Em produção', fg: '#9A6516', bg: '#FBF0DC' },
  { id: 'pronto', label: 'Pronto p/ retirada', fg: '#3A3D9E', bg: '#ECEBFA' },
  { id: 'entregue', label: 'Entregue', fg: '#2F7D55', bg: '#E4F1E9' },
] as const;

export const NOME_FORMA: Record<string, string> = {
  pix: 'Pix',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  dinheiro: 'Dinheiro',
  pendente: 'Pendente',
};

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
