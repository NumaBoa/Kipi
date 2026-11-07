// ============================================================================
// MÁSCARA DE DINHEIRO — a pessoa digita só números e o campo preenche da
// direita para a esquerda: 1 → 0,01 · 18 → 0,18 · 1800 → 18,00 · 125000 → 1.250,00.
// O texto continua no formato "1.250,00", que as telas já sabem ler
// (tiram os pontos e trocam a vírgula por ponto).
// ============================================================================

const milhar = (inteiro: string) => inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Use no onChangeText: onChangeText={(t) => setPreco(mascaraDinheiro(t))}
export const mascaraDinheiro = (texto: string) => {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11);
  if (!digitos) return '';
  const centavos = digitos.padStart(3, '0');
  return `${milhar(centavos.slice(0, -2))},${centavos.slice(-2)}`;
};

// Valor guardado (número) → texto do campo já mascarado. 0 ou vazio → campo vazio
export const dinheiroParaCampo = (valor?: number | null) =>
  valor ? mascaraDinheiro(String(Math.round(valor * 100))) : '';

// Texto do campo → número
export const lerDinheiro = (texto: string) => parseFloat(texto.replace(/\./g, '').replace(',', '.')) || 0;
