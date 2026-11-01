import { calcularFicha, fichaDoProduto } from '@/lib/insumos';
import { custoUnitarioProduto, nomeDoProduto, removerDoEstoque, retirarDoFreezer } from '@/lib/estoqueVitrine';
import { registrarProducao, type RegistroProducao } from '@/lib/historicoProducao';

// ============================================================================
// DESCARTE — produto vencido, doado, quebrado... sai da vitrine ou do freezer e
// entra como perda: o custo de material (insumos da receita) vira o indicador
// "Perdas" e desconta do lucro. Não sai de novo do caixa, porque o insumo já
// saiu quando foi comprado.
// ============================================================================
export type OrigemDescarte = 'vitrine' | 'freezer';

export const MOTIVOS_DESCARTE = ['Vencido', 'Doação / brinde', 'Queimou / quebrou', 'Degustação / teste', 'Outro'] as const;
export type MotivoDescarte = (typeof MOTIVOS_DESCARTE)[number];

export const EMOJI_MOTIVO: Record<string, string> = {
  Vencido: '⏰',
  'Doação / brinde': '🎁',
  'Queimou / quebrou': '💥',
  'Degustação / teste': '🍪',
  Outro: '🗑',
};

// Custo de material por unidade: massa no freezer = só ingredientes; pronto na vitrine
// = ingredientes + embalagem + extras. Sem receita, usa o custo cadastrado no produto.
export const custoMaterialUnitario = (produtoId: string, origem: OrigemDescarte) => {
  const ficha = fichaDoProduto(produtoId);
  if (!ficha) return custoUnitarioProduto({ produtoId, nome: nomeDoProduto(produtoId), quantidade: 0 });
  const c = calcularFicha(ficha);
  const material = origem === 'freezer' ? c.ingredientes : c.ingredientes + c.embalagens + c.extras;
  return material / Math.max(1, ficha.rendimento);
};

// Retorna a mensagem de erro, ou null quando registrou
export const registrarDescarte = (dados: {
  produtoId: string;
  quantidade: number;
  origem: OrigemDescarte;
  disponivel: number;
  motivo: MotivoDescarte;
  observacao?: string;
}): string | null => {
  const { produtoId, quantidade, origem, disponivel, motivo } = dados;
  if (quantidade <= 0) return 'Informe quantas unidades vão ser descartadas.';
  if (quantidade > disponivel) return `Só há ${disponivel} un ${origem === 'freezer' ? 'no freezer' : 'na vitrine'}.`;

  const nome = nomeDoProduto(produtoId);
  const custo = Number((custoMaterialUnitario(produtoId, origem) * quantidade).toFixed(2));
  if (origem === 'freezer') retirarDoFreezer(produtoId, quantidade);
  else removerDoEstoque([{ produtoId, nome, quantidade }]);

  const obs = dados.observacao?.trim();
  registrarProducao({
    tipo: 'perda',
    produtoId,
    produtoNome: nome,
    quantidade,
    motivo,
    origem,
    custo,
    detalhes: `${motivo}${obs ? ` — ${obs}` : ''} (${origem})`,
  });
  return null;
};

// Custo de um descarte (registros antigos sem custo usam o custo atual do produto)
export const custoDoDescarte = (r: RegistroProducao) =>
  r.custo ?? r.quantidade * custoMaterialUnitario(r.produtoId, r.origem ?? 'vitrine');

// Perdas de um intervalo: total em R$, unidades e quebra por motivo
export const resumoDePerdas = (registros: RegistroProducao[], inicio: Date, fim = new Date()) => {
  const lista = registros.filter((r) => r.tipo === 'perda' && new Date(r.data) >= inicio && new Date(r.data) <= fim);
  const porMotivo = new Map<string, { unidades: number; custo: number }>();
  lista.forEach((r) => {
    const motivo = r.motivo ?? 'Outro';
    const atual = porMotivo.get(motivo) ?? { unidades: 0, custo: 0 };
    porMotivo.set(motivo, { unidades: atual.unidades + r.quantidade, custo: atual.custo + custoDoDescarte(r) });
  });
  return {
    lista,
    total: lista.reduce((acc, r) => acc + custoDoDescarte(r), 0),
    unidades: lista.reduce((acc, r) => acc + r.quantidade, 0),
    porMotivo: [...porMotivo.entries()].map(([motivo, v]) => ({ motivo, ...v })).sort((a, b) => b.custo - a.custo),
  };
};

export const ultimosDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  return d;
};
