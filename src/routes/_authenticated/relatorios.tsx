import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Trophy, Users } from "lucide-react";
import { Estrutura } from "@/components/app/estrutura";
import { CartaoIndicador, Painel, TituloSecao, Vazio } from "@/components/app/painel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dataCurta, num } from "@/lib/format";
import { useClientes, useProdutos, useRevendedoras, useVendas } from "@/lib/dados";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Meu Ateliê" },
      {
        name: "description",
        content: "Faturamento, lucro, produtos mais vendidos e formas de pagamento do ateliê.",
      },
      { property: "og:title", content: "Relatórios — Meu Ateliê" },
      {
        property: "og:description",
        content: "Faturamento, lucro, produtos mais vendidos e formas de pagamento do ateliê.",
      },
    ],
  }),
  component: PaginaRelatorios,
});

const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function PaginaRelatorios() {
  const { usuario } = useAuth();
  const { data: vendas = [] } = useVendas();
  const { data: produtos = [] } = useProdutos();
  const { data: clientes = [] } = useClientes();
  const { data: revendedoras = [] } = useRevendedoras();

  const revendedorVinculado = useMemo(() => {
    return (
      revendedoras.find(
        (r) =>
          (r.usuario_id && r.usuario_id === usuario?.id) ||
          (r.email && usuario?.email && r.email.toLowerCase() === usuario.email.toLowerCase()) ||
          (r.nome && usuario?.nome && r.nome.toLowerCase() === usuario.nome.toLowerCase())
      ) ?? null
    );
  }, [revendedoras, usuario]);

  const ehRevendedor = usuario?.papel === "revendedor" || Boolean(revendedorVinculado);
  const revendedorLogado = useMemo(() => {
    if (!ehRevendedor) return null;
    return revendedorVinculado ?? revendedoras[0] ?? null;
  }, [ehRevendedor, revendedorVinculado, revendedoras]);

  const [periodo, setPeriodo] = useState<"7" | "30" | "90">("30");

  const dias = Number(periodo);
  const inicio = new Date(Date.now() - (dias - 1) * 86400000);
  inicio.setHours(0, 0, 0, 0);

  const validas = useMemo(() => {
    const list = vendas.filter((v) => v.status !== "cancelado" && new Date(v.data) >= inicio);
    if (ehRevendedor && revendedorLogado) {
      return list.filter((v) => v.canal === "revendedora" && v.revendedora_id === revendedorLogado.id);
    }
    return list;
  }, [vendas, inicio, ehRevendedor, revendedorLogado]);

  const faturamento = validas.reduce((s, v) => s + Number(v.total), 0);
  const custo = validas.reduce((s, v) => s + Number(v.custo_total), 0);
  const lucro = faturamento - custo;
  const ticket = validas.length ? faturamento / validas.length : 0;

  const serie = useMemo(
    () =>
      Array.from({ length: dias }, (_, i) => {
        const dia = new Date(inicio.getTime() + i * 86400000);
        const fim = new Date(dia.getTime() + 86400000);
        const doDia = validas.filter((v) => new Date(v.data) >= dia && new Date(v.data) < fim);
        return {
          dia: dataCurta(dia.toISOString()),
          faturamento: doDia.reduce((s, v) => s + Number(v.total), 0),
          lucro: doDia.reduce((s, v) => s + Number(v.total) - Number(v.custo_total), 0),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendas, periodo],
  );

  // Top 3 Produtos mais vendidos (por quantidade)
  const top3ProdutosQtd = useMemo(() => {
    const mapa = new Map<string, { nome: string; quantidade: number; valorTotal: number }>();
    for (const venda of validas) {
      for (const item of venda.venda_itens || []) {
        const nome = item.nome_produto?.trim() || "Produto";
        const atual = mapa.get(nome) ?? { nome, quantidade: 0, valorTotal: 0 };
        const qtd = Number(item.quantidade) || 0;
        atual.quantidade += qtd;
        atual.valorTotal += (Number(item.preco_unitario) || 0) * qtd;
        mapa.set(nome, atual);
      }
    }
    return [...mapa.values()]
      .sort((a, b) => b.quantidade - a.quantidade || b.valorTotal - a.valorTotal)
      .slice(0, 3);
  }, [validas]);

  // Top 3 Clientes que mais compram (por quantidade de itens/produtos)
  const top3ClientesQtd = useMemo(() => {
    const mapa = new Map<string, {
      id: string;
      nome: string;
      tag?: string | null;
      quantidadeItens: number;
      totalPedidos: number;
      valorTotal: number;
    }>();

    for (const v of validas) {
      const cli = v.cliente_id ? clientes.find((c) => c.id === v.cliente_id) : null;
      const nome = v.clientes?.nome || cli?.nome || (v.cliente_id ? "Cliente" : "Venda Balcão / Avulsa");
      const tag = (cli as any)?.tag || null;
      const chave = v.cliente_id || `balcao_${nome.toLowerCase()}`;

      const qtdItens = (v.venda_itens || []).reduce((acc, item) => acc + (Number(item.quantidade) || 1), 0);
      const val = Number(v.total) || 0;

      const atual = mapa.get(chave) ?? {
        id: chave,
        nome,
        tag,
        quantidadeItens: 0,
        totalPedidos: 0,
        valorTotal: 0,
      };

      atual.quantidadeItens += qtdItens;
      atual.totalPedidos += 1;
      atual.valorTotal += val;
      if (tag && !atual.tag) atual.tag = tag;
      mapa.set(chave, atual);
    }

    const todos = Array.from(mapa.values());
    const identificados = todos.filter((c) => !c.id.startsWith("balcao_"));
    const listaParaOrdenar = identificados.length > 0 ? identificados : todos;

    return listaParaOrdenar
      .sort((a, b) => b.quantidadeItens - a.quantidadeItens || b.totalPedidos - a.totalPedidos)
      .slice(0, 3);
  }, [validas, clientes]);

  const topProdutos = useMemo(() => {
    const mapa = new Map<string, { nome: string; valor: number; unidades: number }>();
    for (const venda of validas) {
      for (const item of venda.venda_itens || []) {
        const atual = mapa.get(item.nome_produto) ?? {
          nome: item.nome_produto,
          valor: 0,
          unidades: 0,
        };
        atual.valor += Number(item.preco_unitario) * Number(item.quantidade);
        atual.unidades += Number(item.quantidade);
        mapa.set(item.nome_produto, atual);
      }
    }
    return [...mapa.values()].sort((a, b) => b.valor - a.valor).slice(0, 6);
  }, [validas]);

  const porPagamento = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const venda of validas)
      mapa.set(venda.pagamento, (mapa.get(venda.pagamento) ?? 0) + Number(venda.total));
    return [...mapa.entries()].map(([nome, valor]) => ({ nome, valor }));
  }, [validas]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const venda of validas) {
      for (const item of venda.venda_itens || []) {
        const produto = produtos.find((p) => p.id === item.produto_id);
        const chave = produto?.categoria ?? "outro";
        mapa.set(
          chave,
          (mapa.get(chave) ?? 0) + Number(item.preco_unitario) * Number(item.quantidade),
        );
      }
    }
    return [...mapa.entries()].map(([nome, valor]) => ({ nome, valor }));
  }, [validas, produtos]);

  return (
    <Estrutura
      titulo={ehRevendedor ? "Relatórios do Revendedor" : "Relatórios"}
      subtitulo={
        ehRevendedor
          ? `Desempenho e métricas de ${revendedorLogado?.nome || "Revenda Autorizada"} no período`
          : "Resultado e métricas consolidadas do ateliê"
      }
      acao={
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)} className="w-full sm:w-auto">
          <TabsList className="rounded-full w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-9 sm:h-10">
            <TabsTrigger value="7" className="rounded-full text-xs">
              7 dias
            </TabsTrigger>
            <TabsTrigger value="30" className="rounded-full text-xs">
              30 dias
            </TabsTrigger>
            <TabsTrigger value="90" className="rounded-full text-xs">
              90 dias
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 xl:gap-5 2xl:gap-6">
        <CartaoIndicador rotulo="Faturamento" valor={brl(faturamento)} detalhe={`${validas.length} vendas`} />
        <CartaoIndicador rotulo="Custo de produção" valor={brl(custo)} etiqueta="insumos" tom="warning" />
        <CartaoIndicador
          rotulo="Lucro"
          valor={brl(lucro)}
          detalhe={`Margem de ${num(faturamento > 0 ? (lucro / faturamento) * 100 : 0, 0)}%`}
          etiqueta="líquido"
          tom="success"
        />
        <CartaoIndicador rotulo="Ticket médio" valor={brl(ticket)} etiqueta="por venda" tom="blossom" />
      </section>

      {/* TOP 3 PRODUTOS E TOP 3 CLIENTES (VISÃO REVENDEDORA / VISÃO DONA) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1.5">
        {/* CARD: TOP 3 PRODUTOS MAIS VENDIDOS */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-card border border-slate-200/80 dark:border-border/60 shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-border/40">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                <Trophy className="size-3.5" />
              </div>
              <div>
                <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-foreground leading-tight">
                  Top 3 Produtos Mais Vendidos
                </h3>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {ehRevendedor ? "No seu ponto de venda" : "Em todo o ateliê"} · por quantidade no período
                </p>
              </div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60">
              Quantidade (un)
            </span>
          </div>

          {top3ProdutosQtd.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center">
              Nenhuma venda registrada no período selecionado.
            </p>
          ) : (
            <div className="space-y-1.5">
              {top3ProdutosQtd.map((p, idx) => {
                const maxQtd = top3ProdutosQtd[0]?.quantidade || 1;
                const perc = Math.round((p.quantidade / maxQtd) * 100);
                const medalhas = ["🥇 1º", "🥈 2º", "🥉 3º"];
                const coresMedalha = [
                  "bg-amber-500 text-white shadow-2xs",
                  "bg-slate-400 text-white",
                  "bg-amber-700/80 text-white",
                ];

                return (
                  <div
                    key={p.nome}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/30 border border-slate-100 dark:border-border/40 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${coresMedalha[idx]}`}>
                          {medalhas[idx]}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {p.nome}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-slate-900 dark:text-foreground leading-tight">
                          {num(p.quantidade)} <span className="text-[10px] font-semibold text-slate-500">un</span>
                        </span>
                        <span className="text-[9px] text-slate-500 block leading-tight">
                          {brl(p.valorTotal)}
                        </span>
                      </div>
                    </div>

                    {/* BARRA DE PROGRESSO RELATIVO */}
                    <div className="w-full h-1 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#084463] rounded-full transition-all duration-500"
                        style={{ width: `${perc}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CARD: TOP 3 CLIENTES QUE MAIS COMPRAM */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-card border border-slate-200/80 dark:border-border/60 shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-border/40">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-2xs">
                <Users className="size-3.5" />
              </div>
              <div>
                <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-foreground leading-tight">
                  Top 3 Clientes Que Mais Compram
                </h3>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {ehRevendedor ? "No seu ponto de venda" : "Em todo o ateliê"} · por quantidade no período
                </p>
              </div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200/60">
              Itens Comprados
            </span>
          </div>

          {top3ClientesQtd.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center">
              Nenhum cliente com compras no período selecionado.
            </p>
          ) : (
            <div className="space-y-1.5">
              {top3ClientesQtd.map((c, idx) => {
                const maxQtd = top3ClientesQtd[0]?.quantidadeItens || 1;
                const perc = Math.round((c.quantidadeItens / maxQtd) * 100);
                const medalhas = ["🥇 1º", "🥈 2º", "🥉 3º"];
                const coresMedalha = [
                  "bg-purple-600 text-white shadow-2xs",
                  "bg-slate-400 text-white",
                  "bg-amber-700/80 text-white",
                ];

                return (
                  <div
                    key={c.id}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/30 border border-slate-100 dark:border-border/40 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${coresMedalha[idx]}`}>
                          {medalhas[idx]}
                        </span>
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                            {c.nome}
                          </span>
                          {c.tag && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 px-1.5 py-0.2 rounded-md shrink-0">
                              🏷️ {c.tag}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-slate-900 dark:text-foreground leading-tight">
                          {num(c.quantidadeItens)} <span className="text-[10px] font-semibold text-slate-500">itens</span>
                        </span>
                        <span className="text-[9px] text-slate-500 block leading-tight">
                          {c.totalPedidos} {c.totalPedidos === 1 ? "pedido" : "pedidos"} · {brl(c.valorTotal)}
                        </span>
                      </div>
                    </div>

                    {/* BARRA DE PROGRESSO RELATIVO */}
                    <div className="w-full h-1 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${perc}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Painel className="p-6">
        <TituloSecao titulo="Faturamento e lucro" descricao="Evolução dia a dia" />
        <div className="mt-4 h-64 sm:h-80 xl:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ left: -18, right: 6, top: 6 }}>
              <defs>
                <linearGradient id="grad-fat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="grad-luc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                interval="preserveStartEnd"
                stroke="var(--border)"
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
              <Tooltip
                formatter={(valor: number) => brl(Number(valor))}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="faturamento"
                name="Faturamento"
                stroke="var(--chart-1)"
                fill="url(#grad-fat)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="lucro"
                name="Lucro"
                stroke="var(--chart-2)"
                fill="url(#grad-luc)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Painel>

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:gap-6">
        <Painel className="p-6 lg:col-span-2 xl:col-span-3">
          <TituloSecao titulo="Mais vendidos" descricao="Por valor no período" />
          {topProdutos.length === 0 ? (
            <div className="mt-4">
              <Vazio texto="Sem vendas no período." />
            </div>
          ) : (
            <div className="mt-4 h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProdutos} margin={{ left: -18, right: 6, top: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="nome"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                    stroke="var(--border)"
                  />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                  <Tooltip
                    formatter={(valor: number) => brl(Number(valor))}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="valor" name="Valor" radius={[10, 10, 0, 0]} fill="var(--chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Painel>

        <Painel className="p-6">
          <TituloSecao titulo="Como recebeu" descricao="Formas de pagamento" />
          {porPagamento.length === 0 ? (
            <div className="mt-4">
              <Vazio texto="Sem vendas no período." />
            </div>
          ) : (
            <div className="mt-2 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porPagamento} dataKey="valor" nameKey="nome" innerRadius={44} outerRadius={70}>
                    {porPagamento.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(valor: number) => brl(Number(valor))}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-3 text-xs tracking-wide text-muted-foreground uppercase">Por categoria</p>
          <div className="mt-2 space-y-1.5 text-sm">
            {porCategoria.map((linha, i) => (
              <div
                key={linha.nome}
                className="glass-inset grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: CORES[i % CORES.length] }}
                  />
                  <span className="truncate capitalize">{linha.nome}</span>
                </span>
                <span className="tabular-nums">{brl(linha.valor)}</span>
              </div>
            ))}
          </div>
        </Painel>
      </div>
    </Estrutura>
  );
}
