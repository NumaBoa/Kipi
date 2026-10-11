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
import { Estrutura } from "@/components/app/estrutura";
import { CartaoIndicador, Painel, TituloSecao, Vazio } from "@/components/app/painel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dataCurta, num } from "@/lib/format";
import { useProdutos, useVendas } from "@/lib/dados";

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
  const { data: vendas = [] } = useVendas();
  const { data: produtos = [] } = useProdutos();
  const [periodo, setPeriodo] = useState<"7" | "30" | "90">("30");

  const dias = Number(periodo);
  const inicio = new Date(Date.now() - (dias - 1) * 86400000);
  inicio.setHours(0, 0, 0, 0);

  const validas = vendas.filter((v) => v.status !== "cancelado" && new Date(v.data) >= inicio);
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
      titulo="Relatórios"
      subtitulo="Resultado do período"
      acao={
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
          <TabsList className="rounded-full">
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5 2xl:gap-6">
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
