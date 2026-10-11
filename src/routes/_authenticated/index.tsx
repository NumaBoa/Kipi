import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Laptop,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Timer,
  Users,
} from "lucide-react";
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

function PeoplexioGrid({ ehSuperAdmin = false }: { ehSuperAdmin?: boolean }) {
  const [accordionAberto, setAccordionAberto] = useState<string | null>("devices");

  return (
    <div className="grid gap-6 lg:grid-cols-12 xl:gap-6">
      
      {/* COLUMN 1: HERO PROFILE CARD & ACCORDION MENU (3 COLS) */}
      <div className="lg:col-span-3 space-y-6">
        {/* HERO FEATURED PROFILE CARD */}
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-[#E8F4F8] to-[#C9E7F2] p-5 pt-8 shadow-sm flex flex-col justify-end min-h-[320px]">
          <img
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80"
            alt={ehSuperAdmin ? "Ananya Sharma" : "Bella Silva"}
            className="absolute inset-0 size-full object-cover object-top opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#084463]/90 via-[#084463]/25 to-transparent" />
          <div className="relative z-10 flex items-end justify-between gap-2 text-white">
            <div>
              <h3 className="font-display text-xl font-bold leading-tight">
                {ehSuperAdmin ? "Ananya Sharma" : "Bella Silva"}
              </h3>
              <p className="text-xs text-cyan-100 font-medium">
                {ehSuperAdmin ? "Senior HR Manager" : "Chef Confeiteira & Sócia"}
              </p>
            </div>
            <div className="bg-[#FFC64F] text-[#084463] px-3 py-1.5 rounded-2xl shadow-sm text-right">
              <p className="font-display text-sm font-black">
                {ehSuperAdmin ? "₹95,000" : "R$ 42.500"}
              </p>
              <p className="text-[9px] uppercase tracking-wider font-extrabold opacity-90">
                {ehSuperAdmin ? "Monthly Salary" : "Faturamento Mês"}
              </p>
            </div>
          </div>
        </div>

        {/* ACCORDION MENU LIST CARD */}
        <div className="bg-white dark:bg-card rounded-[28px] p-5 shadow-sm border border-slate-200/70 dark:border-border/50 space-y-3">
          {/* Item 1 */}
          <button
            type="button"
            onClick={() => setAccordionAberto(accordionAberto === "pension" ? null : "pension")}
            className="flex w-full items-center justify-between py-2 text-xs font-bold text-[#084463] dark:text-foreground hover:text-[#6BB9D4] transition-colors"
          >
            <span>{ehSuperAdmin ? "Pension contributions" : "Custos Fixos & Despesas"}</span>
            <ChevronDown className="size-4 text-slate-400" />
          </button>

          {/* Item 2: Devices (Expanded) */}
          <div className="border-t border-slate-100 dark:border-border/40 pt-3">
            <button
              type="button"
              onClick={() => setAccordionAberto(accordionAberto === "devices" ? null : "devices")}
              className="flex w-full items-center justify-between pb-2 text-xs font-bold text-[#084463] dark:text-foreground hover:text-[#6BB9D4] transition-colors"
            >
              <span>{ehSuperAdmin ? "Devices" : "Dispositivos de Atendimento"}</span>
              <ChevronUp className="size-4 text-[#084463]" />
            </button>

            {accordionAberto === "devices" && (
              <div className="mt-2 flex items-center justify-between p-3 rounded-2xl bg-[#F8FAFB] dark:bg-muted/50 border border-slate-200/60 dark:border-border/40">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[#084463] grid place-items-center text-white shadow-sm">
                    <Laptop className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#084463] dark:text-foreground">
                      {ehSuperAdmin ? "MacBook Air" : "iPad Balcão de Pedidos"}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {ehSuperAdmin ? "Version M1" : "Terminal PDV Ativo"}
                    </p>
                  </div>
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-600">
                  <MoreVertical className="size-4" />
                </button>
              </div>
            )}
          </div>

          {/* Item 3 */}
          <button
            type="button"
            onClick={() => setAccordionAberto(accordionAberto === "compensation" ? null : "compensation")}
            className="flex w-full items-center justify-between border-t border-slate-100 dark:border-border/40 pt-3 text-xs font-bold text-[#084463] dark:text-foreground hover:text-[#6BB9D4] transition-colors"
          >
            <span>{ehSuperAdmin ? "Compensation Summary" : "Comissões de Revendedoras"}</span>
            <ChevronDown className="size-4 text-slate-400" />
          </button>

          {/* Item 4 */}
          <button
            type="button"
            onClick={() => setAccordionAberto(accordionAberto === "benefits" ? null : "benefits")}
            className="flex w-full items-center justify-between border-t border-slate-100 dark:border-border/40 pt-3 text-xs font-bold text-[#084463] dark:text-foreground hover:text-[#6BB9D4] transition-colors"
          >
            <span>{ehSuperAdmin ? "Employee Benefits" : "Equipe da Cozinha & Produção"}</span>
            <ChevronDown className="size-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* COLUMN 2 & 3: CENTER CHARTS & TIMELINE (6 COLS) */}
      <div className="lg:col-span-6 space-y-6">
        
        {/* TOP ROW: PROGRESS & TIME TRACKER */}
        <div className="grid gap-6 sm:grid-cols-2">
          
          {/* PROGRESS BAR CHART CARD */}
          <div className="bg-white dark:bg-card rounded-[28px] p-6 shadow-sm border border-slate-200/70 dark:border-border/50 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-[#084463] dark:text-foreground">
                {ehSuperAdmin ? "Hiring Progress" : "Meta de Encomendas"}
              </h3>
              <ArrowUpRight className="size-4 text-slate-400" />
            </div>

            <div>
              <p className="font-display text-3xl font-black text-[#084463] dark:text-foreground leading-none">24</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {ehSuperAdmin ? "Hires this month" : "Encomendas entregues no mês"}
              </p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#084463] mt-2">
                <span>↑ 20% vs mês anterior</span>
              </div>
            </div>

            {/* BAR CHART DISPLAY */}
            <div className="relative pt-6">
              {/* Badge 24 over Saturday */}
              <div className="absolute top-0 right-0 bg-[#FFC64F] text-[#084463] text-[9px] font-black px-2.5 py-0.5 rounded-lg shadow-sm">
                {ehSuperAdmin ? "24 Hires" : "24 Entregas"}
              </div>

              <div className="flex items-end justify-between gap-2 h-28 pt-4">
                {[
                  { day: "S", h: 40 },
                  { day: "M", h: 60 },
                  { day: "T", h: 75 },
                  { day: "W", h: 65 },
                  { day: "T", h: 80 },
                  { day: "F", h: 50 },
                  { day: "S", h: 95, active: true },
                ].map((b, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      className={cn(
                        "w-full rounded-t-lg transition-all",
                        b.active ? "bg-[#084463]" : "bg-[#6BB9D4]/40 hover:bg-[#6BB9D4]/70"
                      )}
                      style={{ height: `${b.h}%` }}
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{b.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TIME TRACKER CIRCULAR PROGRESS CARD */}
          <div className="bg-white dark:bg-card rounded-[28px] p-6 shadow-sm border border-slate-200/70 dark:border-border/50 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-[#084463] dark:text-foreground">
                {ehSuperAdmin ? "Time tracker" : "Tempo em Produção / Forno"}
              </h3>
              <ArrowUpRight className="size-4 text-slate-400" />
            </div>

            {/* CIRCULAR GAUGE SVG */}
            <div className="relative size-36 mx-auto grid place-items-center">
              <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#EBF1F5"
                  strokeWidth="6"
                  strokeDasharray="4 4"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#084463"
                  strokeWidth="7"
                  strokeDasharray="264"
                  strokeDashoffset="75"
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute text-center">
                <p className="font-display text-2xl font-black text-[#084463] dark:text-foreground leading-none">02:35</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  {ehSuperAdmin ? "Work Time" : "Tempo Ativo"}
                </p>
              </div>
            </div>

            {/* CONTROLS */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <button type="button" className="size-8 rounded-full border border-slate-200 grid place-items-center text-slate-700 hover:bg-slate-100 transition-colors">
                  <Play className="size-3.5 fill-current ml-0.5" />
                </button>
                <button type="button" className="size-8 rounded-full border border-slate-200 grid place-items-center text-slate-700 hover:bg-slate-100 transition-colors">
                  <Pause className="size-3.5 fill-current" />
                </button>
              </div>
              <button type="button" className="size-9 rounded-full bg-[#084463] text-white grid place-items-center shadow-sm hover:bg-[#06344C] transition-colors">
                <Timer className="size-4" />
              </button>
            </div>
          </div>

        </div>

        {/* BOTTOM ROW: CALENDAR TIMELINE WIDGET CARD */}
        <div className="bg-white dark:bg-card rounded-[28px] p-6 shadow-sm border border-slate-200/70 dark:border-border/50 space-y-5">
          {/* Calendar Month Header */}
          <div className="flex items-center justify-between">
            <button type="button" className="text-xs text-slate-400 font-bold flex items-center gap-1 hover:text-slate-700 transition-colors">
              ‹ Outubro
            </button>
            <h3 className="font-display text-sm font-bold text-[#084463] dark:text-foreground">
              {ehSuperAdmin ? "September 2024" : "Cronograma de Encomendas & Entregas"}
            </h3>
            <button type="button" className="text-xs text-slate-400 font-bold flex items-center gap-1 hover:text-slate-700 transition-colors">
              Novembro ›
            </button>
          </div>

          {/* Days selector row */}
          <div className="grid grid-cols-6 gap-2 text-center border-b border-slate-100 dark:border-border/40 pb-4">
            {[
              { day: "Seg", date: 22 },
              { day: "Ter", date: 23 },
              { day: "Qua", date: 24, active: true },
              { day: "Qui", date: 25 },
              { day: "Sex", date: 26 },
              { day: "Sáb", date: 27 },
            ].map((d, i) => (
              <div
                key={i}
                className={cn(
                  "p-2.5 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer",
                  d.active
                    ? "bg-[#084463] text-white font-bold shadow-md shadow-cyan-950/20"
                    : "hover:bg-slate-100 dark:hover:bg-muted text-slate-600 dark:text-muted-foreground"
                )}
              >
                <span className="text-[10px] font-medium opacity-80">{d.day}</span>
                <span className="text-sm font-black mt-0.5">{d.date}</span>
              </div>
            ))}
          </div>

          {/* Timeline hours and event pills */}
          <div className="space-y-3 pt-1 text-xs">
            <div className="flex items-center gap-4">
              <span className="text-slate-400 font-semibold w-16">09:00</span>
              <div className="flex-1 border-t border-dashed border-slate-200" />
            </div>

            <div className="flex items-center gap-4">
              <span className="text-slate-400 font-semibold w-16">10:00</span>
              <div className="flex-1 bg-[#E8F4F8] dark:bg-muted/40 p-3 rounded-2xl border border-[#6BB9D4]/40 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#084463]">
                    {ehSuperAdmin ? "Weekly Team Sync" : "Bolo de Casamento 3 Andares"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {ehSuperAdmin ? "Discuss progress on projects" : "Entrega agendada no Salão Luar"}
                  </p>
                </div>
                <div className="flex -space-x-2">
                  <div className="size-6 rounded-full bg-[#084463] border-2 border-white text-[9px] font-bold text-white grid place-items-center">🎂</div>
                  <div className="size-6 rounded-full bg-[#6BB9D4] border-2 border-white text-[9px] font-bold text-[#084463] grid place-items-center">🧁</div>
                  <div className="size-6 rounded-full bg-[#FFC64F] border-2 border-white text-[9px] font-bold text-[#084463] grid place-items-center">+2</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-slate-400 font-semibold w-16">11:00</span>
              <div className="flex-1 border-t border-dashed border-slate-200" />
            </div>

            <div className="flex items-center gap-4">
              <span className="text-slate-400 font-semibold w-16">12:00</span>
              <div className="flex-1 bg-[#FFF5DC] dark:bg-amber-950/30 p-3 rounded-2xl border border-[#FFC64F]/50 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#92400E] dark:text-amber-200">
                    {ehSuperAdmin ? "Onboarding Session" : "Kit 100 Doces Finos & Trufas"}
                  </p>
                  <p className="text-[10px] text-[#B45309] dark:text-amber-300/80 font-medium">
                    {ehSuperAdmin ? "Introduction for new hires" : "Retirada balcão — Cliente Juliana"}
                  </p>
                </div>
                <div className="flex -space-x-2">
                  <div className="size-6 rounded-full bg-[#FFC64F] border-2 border-white text-[9px] font-bold text-[#084463] grid place-items-center">🍫</div>
                  <div className="size-6 rounded-full bg-[#F59E0B] border-2 border-white text-[9px] font-bold text-white grid place-items-center">🎁</div>
                  <div className="size-6 rounded-full bg-[#084463] border-2 border-white text-[9px] font-bold text-white grid place-items-center">+3</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-slate-400 font-semibold w-16">13:00</span>
              <div className="flex-1 border-t border-dashed border-slate-200" />
            </div>
          </div>
        </div>

      </div>

      {/* COLUMN 4: RIGHT ONBOARDING & DARK PEACOCK TASK WIDGET (3 COLS) */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* ONBOARDING PROGRESS PERCENTAGE CARD */}
        <div className="bg-white dark:bg-card rounded-[28px] p-6 shadow-sm border border-slate-200/70 dark:border-border/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-[#084463] dark:text-foreground">
              {ehSuperAdmin ? "Onboarding" : "Metas Concluídas"}
            </h3>
            <p className="font-display text-2xl font-black text-[#084463] dark:text-foreground">
              {ehSuperAdmin ? "18%" : "82%"}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>{ehSuperAdmin ? "30%" : "60%"}</span>
            <span>{ehSuperAdmin ? "25%" : "30%"}</span>
            <span>{ehSuperAdmin ? "0%" : "10%"}</span>
          </div>

          {/* SEGMENTED PROGRESS PILL */}
          <div className="grid grid-cols-3 gap-2">
            <div className="h-9 rounded-2xl bg-[#084463] text-white flex items-center justify-center text-xs font-bold shadow-sm">
              {ehSuperAdmin ? "Task" : "Produção"}
            </div>
            <div className="h-9 rounded-2xl bg-[#FFC64F] text-[#084463] flex items-center justify-center text-xs font-black">
              {!ehSuperAdmin && "Vendas"}
            </div>
            <div className="h-9 rounded-2xl bg-[#E8F4F8] dark:bg-muted flex items-center justify-center text-xs font-bold">
              {!ehSuperAdmin && "Giro"}
            </div>
          </div>
        </div>

        {/* DARK PEACOCK TASK HIGHLIGHT CARD (#084463) */}
        <div className="bg-[#084463] text-white p-6 rounded-[28px] space-y-6 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold tracking-tight text-white">
              {ehSuperAdmin ? "Onboarding Task" : "Tarefas do Ateliê"}
            </h3>
            <span className="font-display text-2xl font-black text-[#FFC64F]">2/5</span>
          </div>

          <div className="space-y-3">
            {[
              { id: 1, text: ehSuperAdmin ? "Welcome Kit" : "Confirmar Encomenda #104", done: true, time: "Hoje, 09:30" },
              { id: 2, text: ehSuperAdmin ? "Team Meeting" : "Separar Cacau Belga & Frutas", done: true, time: "Hoje, 10:30" },
              { id: 3, text: ehSuperAdmin ? "Project Update" : "Comprar Caixas Kraft & Fitas", done: false, time: "Amanhã, 12:00" },
              { id: 4, text: ehSuperAdmin ? "Discuss OK Goals" : "Agendar com Revendedora Paula", done: false, time: "Quarta, 14:45" },
              { id: 5, text: ehSuperAdmin ? "HR Policy Review" : "Calcular Custo da Fornada Trufas", done: false, time: "Quinta, 16:00" },
            ].map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid size-8 place-items-center rounded-xl transition-colors",
                      task.done ? "bg-[#FFC64F] text-[#084463]" : "bg-white/10 text-cyan-200"
                    )}
                  >
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{task.text}</p>
                    <p className="text-[10px] text-cyan-200/70 font-medium">{task.time}</p>
                  </div>
                </div>

                <div
                  className={cn(
                    "size-5 rounded-full border-2 grid place-items-center",
                    task.done
                      ? "bg-[#FFC64F] border-[#FFC64F] text-[#084463]"
                      : "border-cyan-300/40 bg-transparent"
                  )}
                >
                  {task.done && <CheckCircle2 className="size-3 fill-current" />}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}


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
      {/* PEOPLEIO EXACT 4-COLUMN DASHBOARD GRID */}
      <PeoplexioGrid />

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

      {/* TABELA DE EMPRESAS CONTRATANTES */}
      <section className="space-y-4">
        <TituloSecao
          titulo="Empresas Clientes Cadastradas & Status de Operação"
          descricao="Lista de ateliês e indústrias contratantes do seu sistema."
        />

        <div className="w-full">
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
      {/* PEOPLEIO EXACT 4-COLUMN DASHBOARD GRID */}
      <PeoplexioGrid />

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

