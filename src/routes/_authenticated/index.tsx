import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Building2,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  DollarSign,
  Package,
  PackageCheck,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Estrutura } from "@/components/app/estrutura";
import { CartaoIndicador, Etiqueta, Painel, TituloSecao, Vazio } from "@/components/app/painel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dataHora, num } from "@/lib/format";
import {
  custoProduto,
  statusInsumo,
  useInsumos,
  useProdutos,
  useClientes,
  useVendas,
  useRevendedoras,
  type Insumo,
  type Produto,
  type Venda,
} from "@/lib/dados";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Início — Meu Ateliê" },
      {
        name: "description",
        content: "Centro de comando diário: entregas de hoje, financeiro e lista de compras.",
      },
      { property: "og:title", content: "Início — Meu Ateliê" },
      {
        property: "og:description",
        content: "Centro de comando diário: entregas de hoje, financeiro e lista de compras.",
      },
    ],
  }),
  component: PainelInicial,
});

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function PainelMasterSaaS({
  listaEmpresas,
  listaUsuarios,
}: {
  listaEmpresas: any[];
  listaUsuarios: any[];
}) {
  const totalEmpresas = listaEmpresas.length;
  const empresasAtivas = listaEmpresas.filter((e) => e.status === "ativa").length;
  const empresasSuspensas = listaEmpresas.filter((e) => e.status === "suspensa").length;

  const empresasStarter = listaEmpresas.filter((e) => e.plano === "Starter").length;
  const empresasPro = listaEmpresas.filter((e) => e.plano === "Pro").length;
  const empresasEnterprise = listaEmpresas.filter((e) => e.plano === "Enterprise").length;

  const mrrEstimado = empresasStarter * 97 + empresasPro * 197 + empresasEnterprise * 397;
  const ticketMedio = empresasAtivas > 0 ? mrrEstimado / empresasAtivas : 0;
  const totalUsuarios = listaUsuarios.length;

  return (
    <Estrutura
      exibirBannerBoasVindas={true}
      titulo="Painel Gestor SaaS — Kipi"
      subtitulo="Visão Geral de Vendas do seu Site & Assinaturas Comercializadas"
      acao={
        <Button asChild className="rounded-2xl gap-2 font-bold shadow-lg shadow-brand/25">
          <Link to="/usuarios">
            <Building2 className="size-4" /> Gestão de Empresas & Clientes
          </Link>
        </Button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5">
        <CartaoIndicador
          rotulo="Receita Recorrente (MRR)"
          valor={brl(mrrEstimado)}
          detalhe="Estimativa mensal de assinaturas ativas"
          etiqueta="faturamento"
          tom="brand"
        />
        <CartaoIndicador
          rotulo="Empresas Contratantes"
          valor={`${totalEmpresas} clientes`}
          detalhe={`${empresasAtivas} ativas · ${empresasSuspensas} suspensas`}
          etiqueta="tenants"
          tom="blossom"
        />
        <CartaoIndicador
          rotulo="Usuários da Plataforma"
          valor={`${totalUsuarios} contas`}
          detalhe="Admins e operadores nas empresas"
          etiqueta="acessos"
          tom="success"
        />
        <CartaoIndicador
          rotulo="Ticket Médio (ARPU)"
          valor={brl(ticketMedio)}
          detalhe="Média mensal por empresa cliente"
          etiqueta="média"
          tom="warning"
        />
      </section>

      <section className="space-y-4">
        <TituloSecao
          titulo="Planos Comercializados no seu Site"
          descricao="Valores de contratação e quantidade de assinantes por categoria de plano."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Painel className="p-6 space-y-4 border border-border/60 hover:border-brand/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plano Starter</span>
              <Etiqueta tom="neutro">R$ 97 /mês</Etiqueta>
            </div>
            <div>
              <p className="font-display text-3xl font-bold">{empresasStarter} <span className="text-xs font-normal text-muted-foreground">empresas</span></p>
              <p className="text-xs text-muted-foreground mt-1">Faturamento: <strong className="text-foreground">{brl(empresasStarter * 97)}/mês</strong></p>
            </div>
            <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-3">
              Destinado a ateliês e artesãos autônomos. Inclui pronta-entrega, encomendas e catálogo.
            </p>
          </Painel>

          <Painel className="p-6 space-y-4 border-2 border-[#FFC64F] shadow-lg shadow-amber-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#FFC64F] text-[#084463] text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Popular
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#084463]">Plano Pro</span>
              <Etiqueta tom="saffron">R$ 197 /mês</Etiqueta>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-brand">{empresasPro} <span className="text-xs font-normal text-muted-foreground">empresas</span></p>
              <p className="text-xs text-muted-foreground mt-1">Faturamento: <strong className="text-foreground">{brl(empresasPro * 197)}/mês</strong></p>
            </div>
            <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-3">
              Para quem vende em consignação e parceiros. Inclui controle de produção e lista de compras.
            </p>
          </Painel>

          <Painel className="p-6 space-y-4 border border-border/60 hover:border-blossom/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blossom">Plano Enterprise</span>
              <Etiqueta tom="blossom">R$ 397 /mês</Etiqueta>
            </div>
            <div>
              <p className="font-display text-3xl font-bold">{empresasEnterprise} <span className="text-xs font-normal text-muted-foreground">empresas</span></p>
              <p className="text-xs text-muted-foreground mt-1">Faturamento: <strong className="text-foreground">{brl(empresasEnterprise * 397)}/mês</strong></p>
            </div>
            <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-3">
              Para marcas com alta escala, equipes e múltiplos ateliês.
            </p>
          </Painel>
        </div>
      </section>
    </Estrutura>
  );
}

function PainelInicial() {
  const { ehSuperAdmin, listaEmpresas, listaUsuarios } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<"hoje" | "financeiro" | "compras">("hoje");
  const [modoGrafico, setModoGrafico] = useState<"divisao" | "faturamento">("divisao");

  const { data: vendas = [] } = useVendas();
  const { data: insumos = [] } = useInsumos();
  const { data: produtos = [] } = useProdutos();
  const { data: clientes = [] } = useClientes();
  const { data: revendedoras = [] } = useRevendedoras();

  if (ehSuperAdmin) {
    return <PainelMasterSaaS listaEmpresas={listaEmpresas} listaUsuarios={listaUsuarios} />;
  }

  const validas = useMemo(() => vendas.filter((v) => v.status !== "cancelado"), [vendas]);

  // Datas
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const fimHoje = new Date(inicioHoje.getTime() + 86400000);
  const fimAmanha = new Date(inicioHoje.getTime() + 2 * 86400000);

  // 1. ABA HOJE: Encomendas do Dia e Amanhã
  const encomendasHojeAmanha = useMemo(() => {
    return validas.filter((v) => {
      if (v.tipo_pedido !== "sob_encomenda") return false;
      const dataAlvo = v.data_entrega_prometida ? new Date(v.data_entrega_prometida) : new Date(v.data);
      return dataAlvo >= inicioHoje && dataAlvo <= fimAmanha;
    });
  }, [validas, inicioHoje, fimAmanha]);

  const encomendasHoje = useMemo(() => {
    return validas.filter((v) => {
      if (v.tipo_pedido !== "sob_encomenda") return false;
      const dataAlvo = v.data_entrega_prometida ? new Date(v.data_entrega_prometida) : new Date(v.data);
      return dataAlvo >= inicioHoje && dataAlvo < fimHoje;
    });
  }, [validas, inicioHoje, fimHoje]);

  const encomendasAmanha = useMemo(() => {
    return validas.filter((v) => {
      if (v.tipo_pedido !== "sob_encomenda") return false;
      const dataAlvo = v.data_entrega_prometida ? new Date(v.data_entrega_prometida) : new Date(v.data);
      return dataAlvo >= fimHoje && dataAlvo <= fimAmanha;
    });
  }, [validas, fimHoje, fimAmanha]);

  // Valores a Receber (Saldos na entrega das encomendas imediatas)
  const encomendasComSaldo = useMemo(() => {
    return encomendasHojeAmanha.filter((v) => Number(v.saldo_na_entrega) > 0);
  }, [encomendasHojeAmanha]);

  const saldoAReceberHojeAmanha = useMemo(() => {
    return encomendasComSaldo.reduce((s, v) => s + Number(v.saldo_na_entrega || 0), 0);
  }, [encomendasComSaldo]);

  const encomendasQuitadasOuSinal = useMemo(() => {
    return encomendasHojeAmanha.filter(
      (v) => Number(v.valor_sinal_pago || 0) > 0 || Number(v.saldo_na_entrega || 0) === 0 || v.status === "pago"
    );
  }, [encomendasHojeAmanha]);

  const taxaQuitada = encomendasHojeAmanha.length > 0
    ? Math.round((encomendasQuitadasOuSinal.length / encomendasHojeAmanha.length) * 100)
    : 100;

  // Alertas de estoque
  const produtosZerados = useMemo(
    () => produtos.filter((p) => p.disponibilidade !== "sob_encomenda" && Number(p.estoque) <= 0),
    [produtos]
  );
  const insumosCriticos = useMemo(
    () => insumos.filter((i) => Number(i.quantidade) <= Number(i.minimo)),
    [insumos]
  );

  // 2. ABA FINANCEIRO: Métricas Gerais
  const faturamentoHoje = useMemo(() => {
    return validas
      .filter((v) => new Date(v.data) >= inicioHoje)
      .reduce((s, v) => s + Number(v.total), 0);
  }, [validas, inicioHoje]);

  const seteDias = new Date(Date.now() - 6 * 86400000);
  seteDias.setHours(0, 0, 0, 0);
  const daSemana = useMemo(() => validas.filter((v) => new Date(v.data) >= seteDias), [validas, seteDias]);
  const faturamentoSemana = useMemo(() => daSemana.reduce((s, v) => s + Number(v.total), 0), [daSemana]);
  const lucroSemana = useMemo(() => daSemana.reduce((s, v) => s + Number(v.total) - Number(v.custo_total || 0), 0), [daSemana]);
  const ticketMedioSemana = useMemo(() => (daSemana.length > 0 ? faturamentoSemana / daSemana.length : 0), [daSemana, faturamentoSemana]);

  const vendasProprias = useMemo(() => validas.filter((v) => v.canal !== "revendedora"), [validas]);
  const vendasParceiros = useMemo(() => validas.filter((v) => v.canal === "revendedora"), [validas]);
  const totalProprio = useMemo(() => vendasProprias.reduce((s, v) => s + Number(v.total), 0), [vendasProprias]);
  const totalParceiro = useMemo(() => vendasParceiros.reduce((s, v) => s + Number(v.total), 0), [vendasParceiros]);

  // Comissões acumuladas a pagar aos parceiros
  const totalComissoesAcumuladas = useMemo(() => {
    return vendasParceiros.reduce((s, v) => {
      const rev = revendedoras.find((r) => r.id === v.revendedora_id);
      if (!rev) return s + Number(v.total) * 0.15;
      if (rev.tipo_comissao === "porcentagem") return s + (Number(v.total) * Number(rev.comissao_percentual || 0)) / 100;
      return s + (v.venda_itens?.length || 1) * Number(rev.comissao_fixa || 0);
    }, 0);
  }, [vendasParceiros, revendedoras]);

  // Gráfico semanal
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

    return {
      rotulo: DIAS[dia.getDay()],
      faturamentoDia,
      qtdItensVendidos,
      hoje: indice === 6,
    };
  });
  const maiorFaturamento = Math.max(...barras.map((b) => b.faturamentoDia), 1);

  // 3. ABA O QUE COMPRAR: Cálculo Determinístico
  const listaComprasSemana = useMemo(() => {
    const seteDiasFrente = new Date(Date.now() + 7 * 86400000);
    const encomendasProximaSemana = validas.filter((v) => {
      if (v.tipo_pedido !== "sob_encomenda") return false;
      const dataEntrega = v.data_entrega_prometida ? new Date(v.data_entrega_prometida) : new Date(v.data);
      return dataEntrega >= inicioHoje && dataEntrega <= seteDiasFrente;
    });

    const mapaDemanda = new Map<string, { material: Insumo; necessario: number }>();

    for (const ped of encomendasProximaSemana) {
      for (const item of ped.venda_itens || []) {
        if (!item.produto_id) continue;
        const prod = produtos.find((p) => p.id === item.produto_id);
        const qtdItem = Number(item.quantidade) || 1;

        insumos.forEach((mat) => {
          if (
            (prod?.categoria && mat.nome.toLowerCase().includes("embalagem")) ||
            mat.nome.toLowerCase().includes("kraft")
          ) {
            const atual = mapaDemanda.get(mat.id) ?? { material: mat, necessario: 0 };
            atual.necessario += qtdItem * 1;
            mapaDemanda.set(mat.id, atual);
          }
        });
      }
    }

    const itensFaltando: Array<{
      material: Insumo;
      necessario: number;
      estoqueAtual: number;
      faltaComprar: number;
      custoEstimado: number;
    }> = [];

    insumos.forEach((mat) => {
      const demanda = mapaDemanda.get(mat.id)?.necessario || 0;
      const estoqueAtual = Number(mat.quantidade);
      const minimo = Number(mat.minimo);
      const necessidadeTotal = Math.max(demanda, minimo);

      if (estoqueAtual < necessidadeTotal || estoqueAtual === 0) {
        const faltaComprar = Math.max(necessidadeTotal - estoqueAtual, 1);
        const custoEstimado = faltaComprar * Number(mat.custo_unitario);
        itensFaltando.push({
          material: mat,
          necessario: necessidadeTotal,
          estoqueAtual,
          faltaComprar,
          custoEstimado,
        });
      }
    });

    return itensFaltando;
  }, [validas, produtos, insumos, inicioHoje]);

  const totalGastoEstimadoCompras = listaComprasSemana.reduce((s, i) => s + i.custoEstimado, 0);

  const copiarListaWhatsApp = () => {
    if (listaComprasSemana.length === 0) {
      toast.info("Tudo abastecido! Não há materiais em falta para esta semana.");
      return;
    }
    const texto = [
      "🛒 *LISTA DE COMPRAS DO ATELIÊ:*",
      `Data: ${new Date().toLocaleDateString("pt-BR")}`,
      "",
      ...listaComprasSemana.map(
        (i) => `• ${i.material.nome}: Comprar ${num(i.faltaComprar)} ${i.material.unidade} (Estoque: ${num(i.estoqueAtual)} ${i.material.unidade})`
      ),
      "",
      `💰 Custo estimado total: ${brl(totalGastoEstimadoCompras)}`,
    ].join("\n");

    navigator.clipboard.writeText(texto);
    toast.success("Lista de compras copiada para o WhatsApp!");
  };

  return (
    <Estrutura
      exibirBannerBoasVindas={false}
      titulo="Início"
      subtitulo="Centro de comando diário: entregas, financeiro e lista de compras"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: 3 ABAS COMO KPIS FIXOS */}
        <aside className="w-full lg:col-span-4 xl:col-span-3 lg:sticky lg:top-6 space-y-3 self-start">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
              Visão Geral
            </p>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-muted dark:text-muted-foreground px-2 py-0.5 rounded-full">
              Selecione o Painel
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
            {/* KPI 1: OPERAÇÃO & HOJE */}
            <button
              type="button"
              onClick={() => setAbaAtiva("hoje")}
              className={cn(
                "w-full text-left p-4 rounded-3xl transition-all duration-200 border relative group",
                abaAtiva === "hoje"
                  ? "bg-white dark:bg-card border-[#084463] ring-2 ring-[#084463]/25 shadow-md shadow-[#084463]/10"
                  : "bg-white/70 dark:bg-card/70 border-slate-200/80 dark:border-border/60 hover:bg-white dark:hover:bg-card hover:border-[#084463]/40 shadow-xs"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "size-10 rounded-2xl grid place-items-center transition-colors",
                    abaAtiva === "hoje"
                      ? "bg-[#084463] text-white"
                      : "bg-[#084463]/10 text-[#084463] dark:bg-[#084463]/20"
                  )}
                >
                  <Calendar className="size-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full transition-colors",
                    abaAtiva === "hoje"
                      ? "bg-[#084463] text-white"
                      : "bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground group-hover:bg-[#084463]/10 group-hover:text-[#084463]"
                  )}
                >
                  {abaAtiva === "hoje" ? "Ativo" : `${encomendasHojeAmanha.length} pedidos`}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider">
                1. Operação & Hoje
              </p>
              <p className="font-display text-2xl font-black text-[#084463] dark:text-foreground mt-1">
                {encomendasHojeAmanha.length}{" "}
                <span className="text-xs font-normal text-slate-500">encomendas</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-muted-foreground mt-1 font-medium">
                {encomendasHoje.length} para hoje · {encomendasAmanha.length} para amanhã
              </p>
            </button>

            {/* KPI 2: FINANCEIRO & VENDAS */}
            <button
              type="button"
              onClick={() => setAbaAtiva("financeiro")}
              className={cn(
                "w-full text-left p-4 rounded-3xl transition-all duration-200 border relative group",
                abaAtiva === "financeiro"
                  ? "bg-white dark:bg-card border-emerald-600 ring-2 ring-emerald-600/25 shadow-md shadow-emerald-600/10"
                  : "bg-white/70 dark:bg-card/70 border-slate-200/80 dark:border-border/60 hover:bg-white dark:hover:bg-card hover:border-emerald-600/40 shadow-xs"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "size-10 rounded-2xl grid place-items-center transition-colors",
                    abaAtiva === "financeiro"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40"
                  )}
                >
                  <DollarSign className="size-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full transition-colors",
                    abaAtiva === "financeiro"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground group-hover:bg-emerald-500/10 group-hover:text-emerald-600"
                  )}
                >
                  {abaAtiva === "financeiro" ? "Ativo" : `${daSemana.length} vendas`}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider">
                2. Financeiro & Vendas
              </p>
              <p className="font-display text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                {brl(faturamentoSemana)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-muted-foreground mt-1 font-medium">
                Lucro líq. est.: {brl(lucroSemana)}
              </p>
            </button>

            {/* KPI 3: O QUE COMPRAR & ESTOQUE */}
            <button
              type="button"
              onClick={() => setAbaAtiva("compras")}
              className={cn(
                "w-full text-left p-4 rounded-3xl transition-all duration-200 border relative group",
                abaAtiva === "compras"
                  ? "bg-white dark:bg-card border-amber-600 ring-2 ring-amber-600/25 shadow-md shadow-amber-600/10"
                  : "bg-white/70 dark:bg-card/70 border-slate-200/80 dark:border-border/60 hover:bg-white dark:hover:bg-card hover:border-amber-600/40 shadow-xs"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "size-10 rounded-2xl grid place-items-center transition-colors",
                    abaAtiva === "compras"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-500/10 text-amber-600 dark:bg-amber-950/40"
                  )}
                >
                  <ShoppingCart className="size-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full transition-colors",
                    abaAtiva === "compras"
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground group-hover:bg-amber-500/10 group-hover:text-amber-600"
                  )}
                >
                  {abaAtiva === "compras" ? "Ativo" : `${listaComprasSemana.length} em falta`}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider">
                3. O que Comprar
              </p>
              <p className="font-display text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
                {listaComprasSemana.length}{" "}
                <span className="text-xs font-normal text-slate-500">materiais</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-muted-foreground mt-1 font-medium">
                Custo previsto: {brl(totalGastoEstimadoCompras)}
              </p>
            </button>
          </div>
        </aside>

        {/* COLUNA DIREITA: CONTEÚDO DINÂMICO CONFORME O KPI SELECIONADO */}
        <section className="w-full lg:col-span-8 xl:col-span-9 space-y-6">
          {/* CABEÇALHO DO PAINEL SELECIONADO + AÇÃO NOVO PEDIDO */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
            <div>
              <h2 className="text-xl font-black text-[#084463] dark:text-foreground tracking-tight">
                {abaAtiva === "hoje" && "Operação & Entregas de Hoje"}
                {abaAtiva === "financeiro" && "Demonstrativo Financeiro & Vendas"}
                {abaAtiva === "compras" && "Planejamento de Compras & Suprimentos"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-muted-foreground font-medium mt-0.5">
                {abaAtiva === "hoje" && "Cronograma de encomendas imediatas, horários prometidos e saldos a receber na entrega"}
                {abaAtiva === "financeiro" && "Faturamento no período, margem de lucro operacional, ticket médio e vendas por canal"}
                {abaAtiva === "compras" && "Materiais calculados com base nas encomendas da semana e níveis mínimos de segurança"}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {abaAtiva === "compras" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copiarListaWhatsApp}
                  className="rounded-2xl gap-1.5 text-xs font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 h-10 px-4"
                >
                  <Copy className="size-3.5" /> Copiar Lista p/ WhatsApp
                </Button>
              )}

              <Button
                asChild
                className="rounded-2xl gap-1.5 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25 px-5 h-10"
              >
                <Link to="/vendas" search={{ nova: true }}>
                  <Plus className="size-4" /> Novo Pedido
                </Link>
              </Button>
            </div>
          </div>

          {/* ================= ABA 1: OPERAÇÃO & HOJE ================= */}
          {abaAtiva === "hoje" && (
            <div className="space-y-6">
              {/* INDICADORES OPERACIONAIS REVISADOS (SEM REPETIÇÃO) */}
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <CartaoIndicador
                  rotulo="Saídas Hoje"
                  valor={`${encomendasHoje.length} pedidos`}
                  detalhe="Horários prometidos para hoje"
                  etiqueta="hoje"
                  tom="brand"
                />
                <CartaoIndicador
                  rotulo="Saídas Amanhã"
                  valor={`${encomendasAmanha.length} pedidos`}
                  detalhe="Próximas entregas da fila"
                  etiqueta="amanhã"
                  tom="blossom"
                />
                <CartaoIndicador
                  rotulo="Saldo a Receber"
                  valor={brl(saldoAReceberHojeAmanha)}
                  detalhe={`${encomendasComSaldo.length} pedidos c/ saldo na entrega`}
                  etiqueta="recebimento"
                  tom="warning"
                />
                <CartaoIndicador
                  rotulo="Taxa Quitado / Sinal"
                  valor={`${taxaQuitada}%`}
                  detalhe={`${encomendasQuitadasOuSinal.length} de ${encomendasHojeAmanha.length || 1} pedidos com sinal`}
                  etiqueta="segurança"
                  tom="success"
                />
              </section>

              {/* ENCOMENDAS COM ENTREGA IMEDIATA */}
              <Painel className="p-6 space-y-4">
                <TituloSecao
                  titulo="Cronograma de Encomendas: Hoje e Próximos Dias"
                  descricao="Pedidos que precisam ser entregues com horários agendados e status financeiro"
                  acao={
                    <Button asChild variant="outline" size="sm" className="rounded-full text-xs font-bold">
                      <Link to="/planejamento">
                        <Truck className="size-3.5 mr-1 text-brand" /> Ver Fila de Produção
                      </Link>
                    </Button>
                  }
                />

                {encomendasHojeAmanha.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto">
                      <CheckCircle2 className="size-6" />
                    </div>
                    <p className="text-sm font-bold text-foreground">Nenhuma encomenda urgente para hoje!</p>
                    <p className="text-xs text-muted-foreground">Você está com todas as entregas do dia em dia.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {encomendasHojeAmanha.map((enc) => {
                      const temSaldo = Number(enc.saldo_na_entrega) > 0;
                      return (
                        <div
                          key={enc.id}
                          className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-3 hover:border-brand/40 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#084463] dark:text-foreground">
                              {enc.clientes?.nome || "Cliente"}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                              {enc.data_entrega_prometida ? enc.data_entrega_prometida.slice(11, 16) || "15:00" : "Hoje"}
                            </span>
                          </div>

                          <div className="text-xs space-y-1">
                            <p className="font-medium text-foreground">
                              {enc.venda_itens.map((i) => `${i.quantidade}× ${i.nome_produto}`).join(", ")}
                            </p>
                            {enc.observacoes && (
                              <p className="text-[11px] text-muted-foreground italic truncate">
                                "{enc.observacoes}"
                              </p>
                            )}
                          </div>

                          <div className="border-t border-border/40 pt-2 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[10px] text-muted-foreground block">Financeiro</span>
                              <span className={cn("font-bold", temSaldo ? "text-amber-600" : "text-emerald-600")}>
                                {temSaldo ? `Falta ${brl(Number(enc.saldo_na_entrega))}` : "100% Pago"}
                              </span>
                            </div>
                            <Button asChild size="sm" variant="ghost" className="rounded-full h-7 text-xs">
                              <Link to="/vendas">Ver Pedido</Link>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Painel>
            </div>
          )}

          {/* ================= ABA 2: FINANCEIRO & VENDAS ================= */}
          {abaAtiva === "financeiro" && (
            <div className="space-y-6">
              {/* INDICADORES FINANCEIROS REVISADOS */}
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <CartaoIndicador
                  rotulo="Faturamento Hoje"
                  valor={brl(faturamentoHoje)}
                  detalhe="Receita das vendas fechadas hoje"
                  etiqueta="diário"
                  tom="brand"
                />
                <CartaoIndicador
                  rotulo="Faturamento 7 Dias"
                  valor={brl(faturamentoSemana)}
                  detalhe={`${daSemana.length} pedidos fechados no período`}
                  etiqueta="semanal"
                  tom="blossom"
                />
                <CartaoIndicador
                  rotulo="Lucro Líquido Est."
                  valor={brl(lucroSemana)}
                  detalhe={`${faturamentoSemana > 0 ? Math.round((lucroSemana / faturamentoSemana) * 100) : 0}% de margem operacional`}
                  etiqueta="margem"
                  tom="success"
                />
                <CartaoIndicador
                  rotulo="Ticket Médio"
                  valor={brl(ticketMedioSemana)}
                  detalhe="Média por pedido finalizado"
                  etiqueta="médio"
                  tom="warning"
                />
              </section>

              {/* DIVISÃO DE CANAIS: PRÓPRIO VS PARCEIROS */}
              <section className="grid gap-4 sm:grid-cols-2">
                <Painel className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Venda Direta / Balcão (Ateliê)</p>
                    <Etiqueta tom="brand">direta</Etiqueta>
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold">{brl(totalProprio)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {vendasProprias.length} vendas diretas ({validas.length > 0 ? Math.round((vendasProprias.length / validas.length) * 100) : 0}%)
                  </p>
                </Painel>

                <Painel className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Parceiros & Revendedores (Consignação)</p>
                    <Etiqueta tom="saffron">parceria</Etiqueta>
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold">{brl(totalParceiro)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {vendasParceiros.length} vendas intermediadas · {brl(totalComissoesAcumuladas)} em comissões
                  </p>
                </Painel>
              </section>

              {/* GRÁFICO SEMANAL */}
              <Painel className="p-6">
                <TituloSecao
                  titulo="Ritmo de Vendas nos Últimos 7 Dias"
                  descricao="Faturamento diário registrado no período"
                />
                <div className="mt-6 flex items-end justify-between gap-2 h-44 pt-4 border-b border-border/40 pb-2">
                  {barras.map((b, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[10px] font-bold text-muted-foreground">{brl(b.faturamentoDia)}</span>
                      <div
                        className={cn(
                          "w-full rounded-t-xl transition-all",
                          b.hoje ? "bg-[#084463]" : "bg-[#6BB9D4]/40 hover:bg-[#6BB9D4]/70"
                        )}
                        style={{ height: `${Math.max((b.faturamentoDia / maiorFaturamento) * 100, 8)}%` }}
                      />
                      <span className="text-xs font-bold text-muted-foreground uppercase">{b.rotulo}</span>
                    </div>
                  ))}
                </div>
              </Painel>
            </div>
          )}

          {/* ================= ABA 3: O QUE COMPRAR ================= */}
          {abaAtiva === "compras" && (
            <div className="space-y-6">
              {/* INDICADORES DE COMPRAS & SUPRIMENTOS (SEM DUPLICAÇÃO) */}
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <CartaoIndicador
                  rotulo="Falta p/ Encomendas"
                  valor={`${listaComprasSemana.length} materiais`}
                  detalhe="Insumos em falta para a demanda da semana"
                  etiqueta="prioritário"
                  tom="brand"
                />
                <CartaoIndicador
                  rotulo="Custo Estimado Compras"
                  valor={brl(totalGastoEstimadoCompras)}
                  detalhe="Estimativa total para fornecedores"
                  etiqueta="orçamento"
                  tom="warning"
                />
                <CartaoIndicador
                  rotulo="Insumos Abaixo do Mínimo"
                  valor={`${insumosCriticos.length} itens`}
                  detalhe="Itens do armário que atingiram o limite"
                  etiqueta="armazém"
                  tom="danger"
                />
                <CartaoIndicador
                  rotulo="Vitrine Zerada"
                  valor={`${produtosZerados.length} produtos`}
                  detalhe="Produtos de pronta-entrega sem estoque"
                  etiqueta="pronta-entrega"
                  tom="neutro"
                />
              </section>

              {/* LISTA DETERMINÍSTICA */}
              <Painel className="p-6 space-y-4">
                <TituloSecao
                  titulo="Lista de Compras Determinística"
                  descricao="Materiais exatos que você precisa comprar para não atrasar nenhuma encomenda da semana"
                  acao={
                    <Button
                      onClick={copiarListaWhatsApp}
                      className="rounded-full gap-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                    >
                      <Copy className="size-3.5" /> Copiar para WhatsApp
                    </Button>
                  }
                />

                {listaComprasSemana.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="size-14 rounded-3xl bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto">
                      <CheckCircle2 className="size-8" />
                    </div>
                    <h3 className="font-display text-base font-bold text-foreground">
                      Armário Completo para as Encomendas!
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Você possui materiais suficientes em estoque para produzir e entregar todos os pedidos confirmados desta semana.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border/50">
                        <tr>
                          <th className="py-3 px-4">Material / Embalagem</th>
                          <th className="py-3 px-4">Unidade</th>
                          <th className="py-3 px-4 text-right">Estoque Atual</th>
                          <th className="py-3 px-4 text-right">Necessário</th>
                          <th className="py-3 px-4 text-right font-black text-[#084463]">Falta Comprar</th>
                          <th className="py-3 px-4 text-right">Custo Est.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {listaComprasSemana.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-bold text-foreground">{item.material.nome}</td>
                            <td className="py-3 px-4 text-muted-foreground">{item.material.unidade}</td>
                            <td className="py-3 px-4 text-right text-muted-foreground">{num(item.estoqueAtual)}</td>
                            <td className="py-3 px-4 text-right font-medium">{num(item.necessario)}</td>
                            <td className="py-3 px-4 text-right">
                              <span className="font-display text-sm font-black text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg">
                                +{num(item.faltaComprar)} {item.material.unidade}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-foreground">
                              {brl(item.custoEstimado)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Painel>

              {/* ALERTAS RÁPIDOS DE ESTOQUE FÍSICO */}
              <div className="grid gap-6 md:grid-cols-2">
                <Painel className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-foreground">Produtos Pronta-Entrega Zerados</h3>
                    <Etiqueta tom={produtosZerados.length > 0 ? "danger" : "success"}>
                      {produtosZerados.length} zerados
                    </Etiqueta>
                  </div>
                  {produtosZerados.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Prateleira abastecida! Nenhum produto zerado.</p>
                  ) : (
                    <div className="space-y-2">
                      {produtosZerados.slice(0, 4).map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/40 text-xs">
                          <span className="font-medium">{p.nome}</span>
                          <Button asChild size="sm" variant="outline" className="h-7 rounded-full text-xs">
                            <Link to="/planejamento">Produzir Lote</Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Painel>

                <Painel className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-foreground">Materiais Abaixo do Mínimo</h3>
                    <Etiqueta tom={insumosCriticos.length > 0 ? "warning" : "success"}>
                      {insumosCriticos.length} em falta
                    </Etiqueta>
                  </div>
                  {insumosCriticos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Armário com todos os materiais acima do mínimo.</p>
                  ) : (
                    <div className="space-y-2">
                      {insumosCriticos.slice(0, 4).map((i) => (
                        <div key={i.id} className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/40 text-xs">
                          <div>
                            <span className="font-medium">{i.nome}</span>
                            <span className="text-[10px] text-muted-foreground block">
                              Saldo: {num(i.quantidade)} {i.unidade} (Mín: {num(i.minimo)})
                            </span>
                          </div>
                          <Button asChild size="sm" variant="outline" className="h-7 rounded-full text-xs">
                            <Link to="/produtos">Comprar</Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Painel>
              </div>
            </div>
          )}
        </section>
      </div>
    </Estrutura>
  );
}
