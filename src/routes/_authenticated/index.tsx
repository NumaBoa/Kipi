import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Estrutura } from "@/components/app/estrutura";
import { CartaoIndicador, Etiqueta, Painel, TituloSecao, Vazio } from "@/components/app/painel";
import { Button } from "@/components/ui/button";
import { brl, dataHora, num } from "@/lib/format";
import { statusInsumo, useInsumos, useProdutos, useClientes, useVendas, useRevendedoras } from "@/lib/dados";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel — Meu Ateliê" },
      {
        name: "description",
        content: "Faturamento, pedidos do dia, vendas próprias vs revendedoras e estoque.",
      },
      { property: "og:title", content: "Painel — Meu Ateliê" },
      {
        property: "og:description",
        content: "Faturamento, pedidos do dia, vendas próprias vs revendedoras e estoque.",
      },
    ],
  }),
  component: PainelInicial,
});

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function PainelInicial() {
  const { data: vendas = [] } = useVendas();
  const { data: insumos = [] } = useInsumos();
  const { data: produtos = [] } = useProdutos();
  const { data: clientes = [] } = useClientes();
  const { data: revendedoras = [] } = useRevendedoras();

  const [modoGrafico, setModoGrafico] = useState<"divisao" | "faturamento">("divisao");

  const validas = vendas.filter((v) => v.status !== "cancelado");
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const doDia = validas.filter((v) => new Date(v.data) >= inicioHoje);
  const faturamentoDia = doDia.reduce((s, v) => s + Number(v.total), 0);

  const seteDias = new Date(Date.now() - 6 * 86400000);
  seteDias.setHours(0, 0, 0, 0);
  const daSemana = validas.filter((v) => new Date(v.data) >= seteDias);
  const faturamentoSemana = daSemana.reduce((s, v) => s + Number(v.total), 0);
  const lucroSemana = daSemana.reduce((s, v) => s + Number(v.total) - Number(v.custo_total), 0);
  const margem = faturamentoSemana > 0 ? (lucroSemana / faturamentoSemana) * 100 : 0;

  const pendentes = validas.filter((v) => v.status === "pendente");
  const aReceber = pendentes.reduce((s, v) => s + Number(v.total), 0);

  const baixos = insumos.filter((i) => statusInsumo(i) !== "ok");
  const estoquePronto = produtos.reduce((s, p) => s + Number(p.estoque), 0);
  const estoqueTotalExistente = Math.max(estoquePronto, 1);

  // Canais
  const vendasProprias = validas.filter((v) => v.canal !== "revendedora");
  const vendasRevendedor = validas.filter((v) => v.canal === "revendedora");

  const totalProprio = vendasProprias.reduce((s, v) => s + Number(v.total), 0);
  const totalRevendedor = vendasRevendedor.reduce((s, v) => s + Number(v.total), 0);

  const pctProprio = validas.length > 0 ? (vendasProprias.length / validas.length) * 100 : 0;
  const pctRevendedor = validas.length > 0 ? (vendasRevendedor.length / validas.length) * 100 : 0;

  const barras = Array.from({ length: 7 }, (_, indice) => {
    const dia = new Date(Date.now() - (6 - indice) * 86400000);
    dia.setHours(0, 0, 0, 0);
    const fim = new Date(dia.getTime() + 86400000);
    const vendasDoDia = validas.filter((v) => new Date(v.data) >= dia && new Date(v.data) < fim);
    const faturamentoDia = vendasDoDia.reduce((s, v) => s + Number(v.total), 0);

    const qtdItensVendidos = vendasDoDia.reduce((s, v) => {
      const sub = v.venda_itens?.reduce((acc, item) => acc + Number(item.quantidade), 0) ?? 0;
      return s + (sub > 0 ? sub : 1);
    }, 0);

    const pctGiroEstoque = (qtdItensVendidos / estoqueTotalExistente) * 100;

    return {
      rotulo: DIAS[dia.getDay()],
      faturamentoDia,
      qtdItensVendidos,
      pctGiroEstoque,
      fracaoTexto: `${qtdItensVendidos} / ${estoqueTotalExistente}`,
      hoje: indice === 6,
    };
  });

  const maiorFaturamento = Math.max(...barras.map((b) => b.faturamentoDia), 1);
  const maiorQtdVendida = Math.max(...barras.map((b) => b.qtdItensVendidos), 1);

  return (
    <Estrutura
      titulo="Painel"
      acao={
        <Button asChild className="rounded-2xl">
          <Link to="/vendas">
            <Plus className="size-4" /> Nova venda
          </Link>
        </Button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5 2xl:gap-6">
        <CartaoIndicador
          rotulo="Faturamento hoje"
          valor={brl(faturamentoDia)}
          detalhe={`${doDia.length} ${doDia.length === 1 ? "venda registrada" : "vendas registradas"}`}
          etiqueta="hoje"
          tom="brand"
        />
        <CartaoIndicador
          rotulo="Faturamento 7 dias"
          valor={brl(faturamentoSemana)}
          detalhe={`Lucro de ${brl(lucroSemana)} · margem ${num(margem, 0)}%`}
          etiqueta="semana"
          tom="blossom"
        />
        <CartaoIndicador
          rotulo="A receber"
          valor={brl(aReceber)}
          detalhe={`${pendentes.length} ${pendentes.length === 1 ? "pedido pendente" : "pedidos pendentes"}`}
          etiqueta={pendentes.length ? "atenção" : "em dia"}
          tom={pendentes.length ? "warning" : "success"}
        />
        <CartaoIndicador
          rotulo="Estoque de produtos"
          valor={`${num(estoquePronto, 0)} un`}
          detalhe={`${produtos.length} produtos · ${clientes.length} clientes`}
          etiqueta={baixos.length ? `${baixos.length} repor` : "ok"}
          tom={baixos.length ? "danger" : "success"}
        />
      </section>

      {/* Origem das Vendas */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Painel className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Venda Própria (Ateliê)</p>
            <Etiqueta tom="brand">direta</Etiqueta>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{brl(totalProprio)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{vendasProprias.length} vendas diretas ({num(pctProprio, 0)}%)</p>
        </Painel>

        <Painel className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Via Revendedoras</p>
            <Etiqueta tom="blossom">parceiras</Etiqueta>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{brl(totalRevendedor)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{vendasRevendedor.length} vendas por revenda ({num(pctRevendedor, 0)}%)</p>
        </Painel>

        <Painel className="p-5 sm:col-span-2 lg:col-span-1 xl:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Origem das Vendas (Canais)</p>
            <Etiqueta tom="neutro">{revendedoras.length} revendedoras</Etiqueta>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-foreground/10 flex mt-3">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.max(pctProprio, 5)}%` }} title="Venda Própria" />
            <div className="h-full bg-blossom transition-all" style={{ width: `${Math.max(pctRevendedor, 5)}%` }} title="Revendedoras" />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand inline-block"/> Venda Própria: {brl(totalProprio)}</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blossom inline-block"/> Revendedoras: {brl(totalRevendedor)}</span>
          </div>
        </Painel>
      </section>

      <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:gap-6">
        <Painel className="p-6 lg:col-span-2 xl:col-span-3 flex flex-col justify-between">
          <TituloSecao
            titulo="Vendas da semana"
            descricao={`Relação Vendas ÷ Estoque Existente (${estoqueTotalExistente} un total em estoque)`}
            acao={
              <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setModoGrafico("divisao")}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-semibold transition-all",
                    modoGrafico === "divisao"
                      ? "bg-card text-brand shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  📊 Vendas ÷ Estoque
                </button>
                <button
                  type="button"
                  onClick={() => setModoGrafico("faturamento")}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-semibold transition-all",
                    modoGrafico === "faturamento"
                      ? "bg-card text-brand shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  💰 Faturamento (R$)
                </button>
              </div>
            }
          />
          <div className="mt-6 flex h-48 sm:h-56 xl:h-64 items-end gap-2.5 sm:gap-4 lg:gap-5 px-2">
            {barras.map((barra, i) => {
              const alturaBarra =
                modoGrafico === "divisao"
                  ? Math.min(Math.max(barra.pctGiroEstoque, 8), 100)
                  : Math.min(Math.max((barra.faturamentoDia / maiorFaturamento) * 100, 8), 100);

              const rotuloTopo =
                modoGrafico === "divisao"
                  ? (barra.qtdItensVendidos > 0 ? `${barra.qtdItensVendidos} / ${estoqueTotalExistente}` : `0 / ${estoqueTotalExistente}`)
                  : (barra.faturamentoDia > 0 ? num(barra.faturamentoDia, 0) : "R$ 0");

              return (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground font-bold tabular-nums h-5 flex items-center text-center">
                    {rotuloTopo}
                  </span>
                  <div
                    className="relative w-full flex-1 flex items-end justify-center rounded-2xl bg-foreground/5 p-1 group cursor-pointer"
                    title={`Dia: ${(barra.rotulo ?? "").toUpperCase()} | Vendas: ${barra.qtdItensVendidos} un | Estoque Existente: ${estoqueTotalExistente} un | Divisão: ${barra.fracaoTexto} (${num(barra.pctGiroEstoque, 1)}%) | Faturamento: ${brl(barra.faturamentoDia)}`}
                  >
                    <div
                      className={cn(
                        "w-full rounded-xl transition-all duration-500 relative flex items-center justify-center overflow-hidden",
                        barra.hoje
                          ? "shadow-md bg-gradient-to-t from-brand via-brand/85 to-blossom"
                          : "bg-brand/40 hover:bg-brand/60"
                      )}
                      style={{ height: `${alturaBarra}%` }}
                    >
                      {modoGrafico === "divisao" && barra.pctGiroEstoque > 0 && (
                        <span className="text-[9px] sm:text-[10px] font-extrabold text-white drop-shadow-sm px-1 truncate">
                          {num(barra.pctGiroEstoque, 0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-wider",
                      barra.hoje ? "text-brand" : "text-muted-foreground"
                    )}
                  >
                    {barra.rotulo}
                  </span>
                </div>
              );
            })}
          </div>
        </Painel>

        <Painel className="p-6">
          <TituloSecao titulo="Precisa repor" descricao="Ingredientes e materiais no limite" />
          <div className="mt-4 space-y-3">
            {baixos.length === 0 ? (
              <Vazio texto="Tudo abastecido por aqui." />
            ) : (
              baixos.slice(0, 5).map((insumo) => {
                const alvo = Math.max(Number(insumo.minimo), 1);
                const proporcao = Math.min((Number(insumo.quantidade) / alvo) * 100, 100);
                return (
                  <div key={insumo.id} className="glass-inset rounded-2xl p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
                      <span className="truncate font-medium">{insumo.nome}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {num(Number(insumo.quantidade))} / {num(alvo)} {insumo.unidade}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full rounded-full bg-danger"
                        style={{ width: `${Math.max(proporcao, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Button asChild variant="outline" className="mt-4 w-full rounded-2xl">
            <Link to="/estoque">Abrir estoque</Link>
          </Button>
        </Painel>
      </section>

      <Painel className="p-6">
        <TituloSecao
          titulo="Pedidos recentes"
          descricao="As últimas vendas registradas"
          acao={
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/vendas">Ver todos</Link>
            </Button>
          }
        />
        <div className="mt-4 space-y-2 text-sm">
          {vendas.length === 0 ? (
            <Vazio texto="Nenhuma venda registrada ainda." />
          ) : (
            vendas.slice(0, 5).map((venda, indice) => (
              <div
                key={venda.id}
                className="glass-inset grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 sm:px-4"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-xs font-bold text-brand">
                  {String(vendas.length - indice).padStart(2, "0")}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {venda.venda_itens.map((i) => `${num(i.quantidade, 0)}× ${i.nome_produto}`).join(", ") ||
                      "Venda"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {venda.clientes?.nome ?? "Sem cliente"} · {dataHora(venda.data)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                  <Etiqueta tom={venda.canal === "revendedora" ? "blossom" : "brand"}>
                    {venda.canal === "revendedora"
                      ? `Revenda: ${venda.revendedoras?.nome ?? "Parceiro"}`
                      : "Venda própria"}
                  </Etiqueta>
                  <span className="text-sm font-semibold tabular-nums">{brl(Number(venda.total))}</span>
                  <Etiqueta
                    tom={
                      venda.status === "pago"
                        ? "success"
                        : venda.status === "pendente"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {venda.status}
                  </Etiqueta>
                </div>
              </div>
            ))
          )}
        </div>
      </Painel>
    </Estrutura>
  );
}
