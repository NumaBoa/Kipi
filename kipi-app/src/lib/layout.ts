import { useWindowDimensions } from 'react-native';

// ============================================================================
// LAYOUT DO APP — uma regra só para decidir entre a versão de celular e a de computador.
// Vale para o app das lojas (Android/iPhone) e para o navegador: abaixo desta largura
// as telas usam o layout mobile (abas embaixo, gavetas); acima, o layout com menu lateral.
// ============================================================================
export const LARGURA_CELULAR = 768;

export const useEhCelular = () => {
  const { width } = useWindowDimensions();
  return width < LARGURA_CELULAR;
};
