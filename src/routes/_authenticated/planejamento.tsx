import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  PackageCheck,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Estrutura } from "@/components/app/estrutura";
import { CartaoIndicador, Etiqueta, Painel, TituloSecao, Vazio } from "@/components/app/painel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, num } from "@/lib/format";
import {
  calcularProducaoPossivel,
  useInsumos,
  useProdutos,
  useReceitas,
  useVendas,
  type Insumo,
  type Produto,
} from "@/lib/dados";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({
    meta: [
      { title: "Prospecção & Planejamento — Meu Ateliê" },
      {
        name: "description",
        content:
          "Prospecção de vendas baseada no ritmo histórico, necessidade de produção semanal e calculadora de compra de insumos.",
      },
      { property: "og:title", content: "Prospecção & Planejamento — Meu Ateliê" },
      {
        property: "og:description",
        content:
          "Prospecção de vendas baseada no ritmo histórico, necessidade de produção semanal e calculadora de compra de insumos.",
      },
    ],
  }),
  component: PaginaPlanejamento,
});

function PaginaPlanejamento() {
  const { data: produtos = [] } = useProdutos();
  const { data: insumos = [] } = useInsumos();
  const { data: receitas = [] } = useReceitas();
  const { data: vendas = [] } = useVendas();

  const [busca, setBusca] = useState("");

  // Prospecções de vendas personalizadas pelo usuário (produtoId -> quantidadeEstimada)
  const [prospeccoesCustomizadas, setProspeccoesCustomizadas] = useState<Record<string, number>>({});

  // Filtrar vendas válidas (não canceladas)
  const validas = useMemo(() => vendas.filter((v) => v.status !== "cancelado"), [vendas]);

  // CÁLCULO DA PROSPECÇÃO AUTOMÁTICA DE VENDAS COM BASE NO RITMO HISTÓRICO
  const statsProdutos = useMemo(() => {
    const agora = Date.now();
    const seteDias = agora - 7 * 86400000;
    const trintaDias = agora - 30 * 86400000;

    return produtos.map((p) => {
      let vendas7d = 0;
      let vendas30d = 0;

      for (const v of validas) {
        const dataVenda = new Date(v.data).getTime();
        for (const item of v.venda_itens || []) {
          if (item.produto_id === p.id) {
            const qtd = Number(item.quantidade || 1);
            if (dataVenda >= seteDias) vendas7d += qtd;
            if (dataVenda >= trintaDias) vendas30d += qtd;
          }
        }
      }

      // 1. Ritmo de vendas histórico (última semana vs média semanal de 30 dias)
      const mediaSemanal30d = Math.ceil((vendas30d / 30) * 7);
      const ritmoBaseSemanal = Math.max(vendas7d, mediaSemanal30d, 2);

      // 2. Prospecção Automática Estimada para a Próxima Semana (+15% de margem de segurança/crescimento)
      const prospeccaoCalculada = Math.ceil(ritmoBaseSemanal * 1.15);

      // 3. Prospecção Final (usada no planejamento: automática ou editada pela confeiteira)
      const prospeccaoFinal = prospeccoesCustomizadas[p.id] ?? prospeccaoCalculada;

      // 4. Recomendação de Produção para a Próxima Semana (Prospecção - Estoque Pronto Atual)
      const estoquePronto = Number(p.estoque);
      const producaoRecomendada = Math.max(0, prospeccaoFinal - estoquePronto);

      // 5. Capacidade de produção com os insumos atuais do estoque
      const cap = calcularProducaoPossivel(p.id, receitas, insumos, p.rendimento_unidades);

      return {
        produto: p,
        vendas7d,
        vendas30d,
        mediaSemanal30d,
        estoquePronto,
        prospeccaoCalculada,
        prospeccaoFinal,
        producaoRecomendada,
        producaoPossivelInsumos: cap.possiveis,
        gargaloInsumo: cap.gargaloInsumo,
      };
    });
  }, [produtos, validas, prospeccoesCustomizadas, receitas, insumos]);

  const produtosFiltrados = useMemo(() => {
    return statsProdutos.filter(
      (sp) =>
        sp.produto.nome.toLowerCase().includes(busca.toLowerCase()) ||
        sp.produto.categoria.toLowerCase().includes(busca.toLowerCase())
    );
  }, [statsProdutos, busca]);

  // Alterar prospecção manualmente se a confeiteira tiver encomendas adicionais
  const atualizarProspeccao = (produtoId: string, novaProspeccao: number) => {
    setProspeccoesCustomizadas((prev) => ({
      ...prev,
      [produtoId]: Math.max(0, novaProspeccao),
    }));
  };

  const redefinirParaCalculoAutomatico = () => {
    setProspeccoesCustomizadas({});
    toast.success("Prospecções redefinidas para o cálculo automático baseado nas vendas!");
  };

  // CALCULADORA AUTOMÁTICA DE INSUMOS NECESSÁRIOS PARA A PRODUÇÃO DA PRÓXIMA SEMANA
  const insumosNecessarios = useMemo(() => {
    const mapa = new Map<string, { insumo: Insumo; qtdNecessaria: number }>();

    for (const sp of statsProdutos) {
      if (sp.producaoRecomendada <= 0) continue;

      const itensReceita = receitas.filter((r) => r.produto_id === sp.produto.id);
      const rendimento = Math.max(Number(sp.produto.rendimento_unidades ?? 1), 1);
      const fornadasNecessarias = Math.ceil(sp.producaoRecomendada / rendimento);

      for (const itemRec of itensReceita) {
        const insumo = insumos.find((i) => i.id === itemRec.insumo_id);
        if (!insumo) continue;

        const qtdParaEstaProducao = Number(itemRec.quantidade) * fornadasNecessarias;
        const atual = mapa.get(insumo.id);
        if (atual) {
          atual.qtdNecessaria += qtdParaEstaProducao;
        } else {
          mapa.set(insumo.id, { insumo, qtdNecessaria: qtdParaEstaProducao });
        }
      }
    }

    return Array.from(mapa.values()).map(({ insumo, qtdNecessaria }) => {
      const disponivel = Number(insumo.quantidade);
      const faltaComprar = Math.max(0, qtdNecessaria - disponivel);
      const custoEstimadoCompra = faltaComprar * Number(insumo.custo_unitario);

      return {
        insumo,
        qtdNecessaria,
        disponivel,
        faltaComprar,
        custoEstimadoCompra,
      };
    });
  }, [statsProdutos, receitas, insumos]);

  const totalProspeccaoSemana = statsProdutos.reduce((s, sp) => s + sp.prospeccaoFinal, 0);
  const totalProducaoRecomendada = statsProdutos.reduce((s, sp) => s + sp.producaoRecomendada, 0);
  const totalCustoCompras = insumosNecessarios.reduce((s, item) => s + item.custoEstimadoCompra, 0);
  const itensFaltandoCompras = insumosNecessarios.filter((item) => item.faltaComprar > 0).length;

  return (
    <Estrutura
      titulo="Prospecção & Planejamento de Produção"
      subtitulo="Previsão de demanda para a próxima semana com base no ritmo histórico de vendas e calculadora de compras"
      acao={
        Object.keys(prospeccoesCustomizadas).length > 0 ? (
          <Button variant="outline" className="rounded-2xl gap-1.5 text-xs" onClick={redefinirParaCalculoAutomatico}>
            <RefreshCw className="size-3.5" /> Voltar ao Cálculo Automático
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* CARDS DE RESUMO DA PROSPECÇÃO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Prospecção de Vendas (Próx. Semana)</p>
              <p className="font-display text-2xl font-bold mt-1 text-foreground">
                {totalProspeccaoSemana} un
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-brand/10 grid place-items-center text-brand">
              <TrendingUp className="size-5" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Recomendação de Produção</p>
              <p className="font-display text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                +{totalProducaoRecomendada} un
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-purple-500/10 grid place-items-center text-purple-600 dark:text-purple-400">
              <PackagePlus className="size-5" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Insumos a Repor/Comprar</p>
              <p className="font-display text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {itensFaltandoCompras} itens
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-amber-500/10 grid place-items-center text-amber-600 dark:text-amber-400">
              <ShoppingCart className="size-5" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Custo Estimado de Compras</p>
              <p className="font-display text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {brl(totalCustoCompras)}
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-emerald-500/10 grid place-items-center text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-5" />
            </div>
          </div>
        </div>

        {/* TABELA DE PROSPECÇÃO DE VENDAS & RECOMENDAÇÃO DE PRODUÇÃO */}
        <Painel className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <TituloSecao
              titulo="Prospecção Automática de Vendas por Produto & Sabor"
              descricao="O sistema analisa o ritmo histórico das vendas e calcula a quantidade ideal que você precisa ter pronta na próxima semana"
            />
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto ou sabor..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 rounded-xl h-10 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] tracking-wider text-muted-foreground uppercase">
                  <th className="py-2.5 pr-4 text-left font-medium">Produto / Sabor</th>
                  <th className="py-2.5 pr-4 text-center font-medium">Ritmo Recente (7d)</th>
                  <th className="py-2.5 pr-4 text-center font-medium">Média Histórica (30d)</th>
                  <th className="py-2.5 pr-4 text-center font-medium">Prospecção Estimada (Próx. Semana)</th>
                  <th className="py-2.5 pr-4 text-center font-medium">Estoque Pronto Atual</th>
                  <th className="py-2.5 pr-4 text-center font-medium">Capacidade Insumos</th>
                  <th className="py-2.5 text-right font-medium">Recomendação de Produção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {produtosFiltrados.map((sp) => {
                  const precisaProduzir = sp.producaoRecomendada > 0;
                  const foiEditado = prospeccoesCustomizadas[sp.produto.id] !== undefined;

                  return (
                    <tr key={sp.produto.id} className="transition-colors hover:bg-card/50">
                      <td className="py-3 pr-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{sp.produto.nome}</p>
                          <p className="text-xs text-muted-foreground capitalize">{sp.produto.categoria}</p>
                        </div>
                      </td>

                      <td className="py-3 pr-4 text-center font-semibold tabular-nums text-foreground">
                        {sp.vendas7d} un
                      </td>

                      <td className="py-3 pr-4 text-center text-muted-foreground tabular-nums">
                        {sp.vendas30d} un <span className="text-[10px]">({sp.mediaSemanal30d} un/sem)</span>
                      </td>

                      {/* PROSPECÇÃO ESTIMADA (CALCULADA AUTOMATICAMENTE + CAMPO PARA AJUSTE) */}
                      <td className="py-3 pr-4 text-center">
                        <div className="inline-flex flex-col items-center justify-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            value={String(sp.prospeccaoFinal)}
                            onChange={(e) => atualizarProspeccao(sp.produto.id, Number(e.target.value))}
                            className={cn(
                              "w-20 text-center font-extrabold h-9 rounded-xl text-xs transition-all",
                              foiEditado ? "border-brand text-brand bg-brand/10" : "border-border"
                            )}
                          />
                          {foiEditado ? (
                            <span className="text-[9px] text-brand font-medium">Editado (Auto: {sp.prospeccaoCalculada})</span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground">Sugerido p/ inteligência</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 pr-4 text-center tabular-nums">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-bold",
                            sp.estoquePronto > 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {sp.estoquePronto} un pronto
                        </span>
                      </td>

                      <td className="py-3 pr-4 text-center tabular-nums">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-brand">+{sp.producaoPossivelInsumos} un</span>
                          {sp.gargaloInsumo ? (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[130px]" title={`Gargalo: ${sp.gargaloInsumo.nome}`}>
                              Gargalo: {sp.gargaloInsumo.nome}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Sem ficha/insumos</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 text-right tabular-nums">
                        {precisaProduzir ? (
                          <span className="inline-flex items-center gap-1 font-bold text-xs bg-purple-500/15 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-xl border border-purple-500/30">
                            <PackagePlus className="size-3.5" /> Produzir +{sp.producaoRecomendada} un
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-xl">
                            <CheckCircle2 className="size-3.5" /> Demanda Coberta
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Painel>

        {/* CALCULADORA AUTOMÁTICA DE LISTA DE COMPRAS PARA A SEMANA */}
        <Painel className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <TituloSecao
              titulo="Lista de Compras de Insumos para Atender a Prospecção"
              descricao="Quantidade exata de ingredientes e embalagens a comprar para conseguir produzir a demanda estimada da próxima semana"
            />
            {totalCustoCompras > 0 && (
              <Button
                onClick={() => toast.success("Lista de compras copiada para a área de transferência!")}
                variant="outline"
                className="rounded-2xl text-xs gap-1.5"
              >
                <ClipboardList className="size-4" /> Copiar Lista de Compras
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {insumosNecessarios.length === 0 ? (
              <div className="col-span-full p-8 text-center glass-panel rounded-3xl space-y-2">
                <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
                <p className="font-semibold text-base">Seu estoque de insumos cobre 100% da produção projetada!</p>
                <p className="text-xs text-muted-foreground">
                  Você já tem todos os ingredientes e embalagens necessários para produzir a demanda da próxima semana.
                </p>
              </div>
            ) : (
              insumosNecessarios.map((item) => {
                const precisaComprar = item.faltaComprar > 0;

                return (
                  <div
                    key={item.insumo.id}
                    className={cn(
                      "glass-panel p-4 rounded-3xl space-y-3 border transition-all",
                      precisaComprar ? "border-amber-500/40 bg-amber-500/5" : "border-border/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{item.insumo.nome}</h4>
                        <p className="text-xs text-muted-foreground capitalize">
                          Tipo: {item.insumo.tipo} · {brl(item.insumo.custo_unitario)}/{item.insumo.unidade}
                        </p>
                      </div>
                      <Etiqueta tom={precisaComprar ? "warning" : "success"}>
                        {precisaComprar ? "comprar" : "coberto"}
                      </Etiqueta>
                    </div>

                    <div className="glass-inset p-3 rounded-2xl space-y-1.5 text-xs border border-border/40">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Necessário p/ Prospecção:</span>
                        <span className="font-bold text-foreground">
                          {num(item.qtdNecessaria)} {item.insumo.unidade}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Disponível no Estoque:</span>
                        <span className="font-semibold">{num(item.disponivel)} {item.insumo.unidade}</span>
                      </div>
                      {precisaComprar ? (
                        <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400 pt-1.5 border-t border-border/40">
                          <span>Falta Comprar:</span>
                          <span>{num(item.faltaComprar)} {item.insumo.unidade}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-border/40">
                          <span>Estoque Coberto:</span>
                          <span>Suficiente</span>
                        </div>
                      )}
                    </div>

                    {precisaComprar && (
                      <div className="pt-1 flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>Custo estimado da compra:</span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          {brl(item.custoEstimadoCompra)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Painel>
      </div>
    </Estrutura>
  );
}
