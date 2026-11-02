import { Dimensions, StyleSheet } from 'react-native';

// ============================================================================
// AJUSTE PARA CELULAR — as telas foram desenhadas para computador. Em tela estreita,
// antes de criar os estilos, encolhe o que não cabe:
//   · larguras fixas e mínimas maiores que a tela → cabem na tela
//   · cartões com largura mínima média (KPIs) → duas por linha
//   · espaçamentos e títulos grandes → menores
//   · linhas com espaço entre blocos → quebram para a linha de baixo em vez de cortar
// Lido uma vez ao abrir (celular não muda de largura no uso).
// ============================================================================
type Estilos = Record<string, any>;

const LARGURA_CELULAR = 768;

export const ehCelular = () => Dimensions.get('window').width < LARGURA_CELULAR;

const ajustarUm = (e: any, largura: number) => {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return e;
  const util = largura - 32; // tela menos as margens laterais
  const r = { ...e };

  if (typeof r.width === 'number' && r.width > util) r.width = util;
  if (typeof r.minWidth === 'number') {
    if (r.minWidth > 260) r.minWidth = Math.min(r.minWidth, util);
    else if (r.minWidth >= 120) r.minWidth = Math.min(r.minWidth, Math.floor((util - 16) / 2));
  }

  for (const k of ['padding', 'paddingHorizontal']) {
    if (typeof r[k] === 'number' && r[k] >= 20) r[k] = 14;
  }
  for (const k of ['paddingLeft', 'paddingRight']) {
    if (typeof r[k] === 'number' && r[k] >= 20) r[k] = 14;
  }
  if (typeof r.gap === 'number' && r.gap >= 18) r.gap = 12;
  if (typeof r.fontSize === 'number' && r.fontSize >= 26) r.fontSize = Math.round(r.fontSize * 0.82);

  if (r.flexDirection === 'row' && !r.flexWrap && typeof r.gap === 'number' && r.gap >= 12) r.flexWrap = 'wrap';
  return r;
};

// Uso: paraCelular(StyleSheet.create({...})) — mantém os tipos do StyleSheet
export const paraCelular = <T extends Estilos>(estilos: T): T => {
  const largura = Dimensions.get('window').width;
  if (largura >= LARGURA_CELULAR) return estilos;
  const r: Estilos = {};
  for (const [nome, e] of Object.entries(estilos)) r[nome] = ajustarUm(e, largura);
  return StyleSheet.create(r) as T;
};
