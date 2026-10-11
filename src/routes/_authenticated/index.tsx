import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CheckCircle2, Plus } from "lucide-react";
import { useState } from "react";
import { Estrutura } from "@/components/app/estrutura";
import { CartaoIndicador, Etiqueta, Painel, TituloSecao, Vazio } from "@/components/app/painel";
import { Button } from "@/components/ui/button";
import { brl, dataHora, num } from "@/lib/format";
import { statusInsumo, useInsumos, useProdutos, useClientes, useVendas, useRevendedoras } from "@/lib/dados";
import { useAuth } from "@/lib/auth";
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
      {/* BANNER RECEPTIVO MASTER */}
      <Painel className="p-6 md:p-8 bg-gradient-to-r from-brand/15 via-blossom/10 to-transparent border border-brand/20 relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-3xl">
          <Etiqueta tom="brand" className="px-3 py-1 text-xs">👑 Plataforma Master Kipi</Etiqueta>
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
            Desempenho Comercial do seu Software SaaS
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
            Bem-vinda ao seu centro de controle comercial. Acompanhe a contratação dos planos do seu site, total de empresas clientes ativas, receita recorrente mensal (MRR) e gestione o acesso das contas.
          </p>
        </div>
      </Painel>

      {/* METRICAS CHAVE DO SAAS */}
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

      {/* PLANOS COMERCIALIZADOS NO SEU SITE */}
      <section className="space-y-4">
        <TituloSecao
          titulo="Planos Comercializados no seu Site"
          descricao="Valores de contratação e quantidade de assinantes por categoria de plano."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {/* STARTER */}
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
              Destinado a pequenos ateliês e confeiteiras autônomas. Inclui gestão de insumos, receitas e catálogo.
            </p>
          </Painel>

          {/* PRO (RECOMENDADO) */}
          <Painel className="p-6 space-y-4 border-2 border-brand/50 shadow-lg shadow-brand/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-brand text-primary-foreground text-[9px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Popular
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand">Plano Pro</span>
              <Etiqueta tom="brand">R$ 197 /mês</Etiqueta>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-brand">{empresasPro} <span className="text-xs font-normal text-muted-foreground">empresas</span></p>
              <p className="text-xs text-muted-foreground mt-1">Faturamento: <strong className="text-foreground">{brl(empresasPro * 197)}/mês</strong></p>
            </div>
            <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-3">
              Destinado a ateliês com equipe e vendas via revendedoras parceiras. Inclui comissões e relatórios.
            </p>
          </Painel>

          {/* ENTERPRISE */}
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
              Para indústrias, franquias e redes de alta produção. Suporte dedicado e gestão avançada de acessos.
            </p>
          </Painel>
        </div>
      </section>

      {/* TABELA DE EMPRESAS CONTRATANTES & WIDGET DARK */}
      <section className="space-y-4">
        <TituloSecao
          titulo="Empresas Clientes Cadastradas & Status de Operação"
          descricao="Lista de ateliês e indústrias contratantes do seu sistema."
        />

        <div className="grid gap-6 lg:grid-cols-12">
          {/* TABELA (8 COLS) */}
          <div className="lg:col-span-8 space-y-4">
            {totalEmpresas === 0 ? (
              <Painel className="p-12 text-center space-y-4 border-dashed border-2">
                <div className="grid size-16 place-items-center rounded-3xl bg-brand/10 text-brand mx-auto">
                  <Building2 className="size-8" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="font-display text-lg font-bold">Nenhuma Empresa Contratante Cadastrada</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    O seu sistema Kipi está zerado e pronto para a comercialização. Cadastre a primeira empresa cliente para liberar as credenciais de acesso ao ateliê.
                  </p>
                </div>
                <Button asChild className="rounded-full font-bold shadow-lg shadow-brand/25 h-11 px-6 bg-brand text-white">
                  <Link to="/usuarios">
                    <Plus className="size-4 mr-2" /> Cadastrar Primeira Empresa Cliente
                  </Link>
                </Button>
              </Painel>
            ) : (
              <Painel className="p-0 overflow-hidden border border-border/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border/50">
                      <tr>
                        <th className="py-3 px-4">Empresa</th>
                        <th className="py-3 px-4">Documento</th>
                        <th className="py-3 px-4">Plano</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {listaEmpresas.map((emp) => (
                        <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-semibold">{emp.nome}</td>
                          <td className="py-3 px-4 text-muted-foreground">{emp.documento || "Não informado"}</td>
                          <td className="py-3 px-4">
                            <Etiqueta tom={emp.plano === "Enterprise" ? "blossom" : emp.plano === "Pro" ? "brand" : "neutro"}>
                              {emp.plano}
                            </Etiqueta>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 font-semibold text-[11px]",
                              emp.status === "ativa" ? "text-emerald-500" : "text-amber-500"
                            )}>
                              <span className={cn("size-2 rounded-full", emp.status === "ativa" ? "bg-emerald-500" : "bg-amber-500")} />
                              {emp.status === "ativa" ? "Ativa" : "Suspensa"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button asChild variant="ghost" size="sm" className="h-7 text-xs rounded-full">
                              <Link to="/usuarios">Gerenciar</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Painel>
            )}
          </div>

          {/* DARK HIGHLIGHT WIDGET CARD (EXATAMENTE COMO O CARD ESCURO DO ANEXO) */}
          <div className="lg:col-span-4">
            <div className="bg-[#18182B] text-white p-6 rounded-3xl space-y-6 shadow-2xl border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold tracking-tight text-white">Tarefas & Onboarding</h3>
                  <p className="text-[11px] text-slate-400">Status de Comercialização Kipi</p>
                </div>
                <span className="font-display text-xl font-extrabold text-brand bg-brand/20 px-3 py-1 rounded-2xl border border-brand/30">
                  3/5
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { id: 1, text: "Configurar Domínio & SSL Vercel", done: true, time: "Concluído" },
                  { id: 2, text: "Banco Multi-Tenant Supabase", done: true, time: "Concluído" },
                  { id: 3, text: "Criar Conta Admin Master (Camila)", done: true, time: "Concluído" },
                  { id: 4, text: "Cadastrar 1ª Empresa Contratante", done: false, time: "Em andamento" },
                  { id: 5, text: "Lançar Campanhas de Divulgação", done: false, time: "Pendente" },
                ].map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "grid size-7 place-items-center rounded-full transition-colors",
                          task.done
                            ? "bg-brand text-white shadow-md shadow-brand/40"
                            : "border border-slate-600 text-transparent"
                        )}
                      >
                        <CheckCircle2 className="size-4 fill-current text-white" />
                      </div>
                      <div>
                        <p className={cn("text-xs font-semibold", task.done ? "line-through text-slate-400" : "text-white")}>
                          {task.text}
                        </p>
                        <p className="text-[10px] text-slate-400">{task.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </Estrutura>
  );
}

function PainelInicial() {
  const { ehSuperAdmin, listaEmpresas, listaUsuarios } = useAuth();
  const [modoGrafico, setModoGrafico] = useState<"divisao" | "faturamento">("divisao");
  const { data: vendas = [] } = useVendas();
  const { data: insumos = [] } = useInsumos();
  const { data: produtos = [] } = useProdutos();
  const { data: clientes = [] } = useClientes();
  const { data: revendedoras = [] } = useRevendedoras();

  if (ehSuperAdmin) {
    return <PainelMasterSaaS listaEmpresas={listaEmpresas} listaUsuarios={listaUsuarios} />;
  }

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
