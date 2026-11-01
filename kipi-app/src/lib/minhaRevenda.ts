import { useSessao } from '@/lib/acesso';
import { useRevenda, saboresComRevendedora, resumoFinanceiro, comissaoDaVenda, MINIMO_POR_SABOR, type Revendedora, type VendaRevenda } from '@/lib/revenda';
import type { Pedido } from '@/lib/clientesPedidos';

// ============================================================================
// ESCOPO DA REVENDEDORA — as telas da dona (Visão Geral, Pedidos, Clientes) usam
// este hook para mostrar à revendedora só o que é dela: os pedidos que ela
// lançou, os clientes dela, o estoque que está com ela e o acerto de contas.
// Ela nunca recebe dados do ateliê (custos, lucro, outros clientes) nem de outras revendedoras.
// ============================================================================
export const useEscopoRevendedora = () => {
  const { sessao } = useSessao();
  const { revendedoras, vendas, entregas, pagamentos } = useRevenda();
  const ehRevendedora = sessao?.perfil === 'revendedora';
  const revendedora: Revendedora | null = ehRevendedora ? revendedoras.find((r) => r.id === sessao?.revendedoraId) ?? null : null;
  const id = revendedora?.id ?? '__nenhuma__';

  const minhasVendas = vendas.filter((v) => v.revendedoraId === id).sort((a, b) => b.data.localeCompare(a.data));
  const meusPagamentos = pagamentos.filter((p) => p.revendedoraId === id).sort((a, b) => b.data.localeCompare(a.data));
  const minhasEntregas = entregas.filter((e) => e.revendedoraId === id).sort((a, b) => b.data.localeCompare(a.data));
  const sabores = saboresComRevendedora(id, entregas, vendas);
  const resumo = revendedora ? resumoFinanceiro(revendedora, vendas, pagamentos) : null;
  const comissao = (v: VendaRevenda) => (revendedora ? comissaoDaVenda(v, revendedora) : 0);
  // Comissão de um pedido (pela venda ligada a ele)
  const comissaoDoPedido = (p: Pedido) => {
    const v = minhasVendas.find((x) => x.pedidoId === p.id);
    return v ? comissao(v) : 0;
  };

  return {
    ehRevendedora,
    revendedora,
    revendedoraId: ehRevendedora ? id : null,
    minhasVendas,
    meusPagamentos,
    minhasEntregas,
    sabores,
    resumo,
    comissao,
    comissaoDoPedido,
    minimoPorSabor: MINIMO_POR_SABOR,
  };
};

// Filtra pedidos: a revendedora vê só os que ela lançou; a dona vê todos
export const pedidosDoEscopo = (pedidos: Pedido[], revendedoraId: string | null) =>
  revendedoraId ? pedidos.filter((p) => p.revendedoraId === revendedoraId) : pedidos;
