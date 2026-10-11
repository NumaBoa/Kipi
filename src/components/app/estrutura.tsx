import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CakeSlice,
  CalendarRange,
  CheckCircle2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Moon,
  NotebookPen,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTema } from "@/lib/theme";
import { hoje } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth, temPermissaoRota, type PapelUsuario, type Usuario } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const todosItens = [
  { para: "/", rotulo: "Painel", Icone: LayoutDashboard },
  { para: "/vendas", rotulo: "Vendas", Icone: ShoppingBag },
  { para: "/produtos", rotulo: "Produtos", Icone: CakeSlice },
  { para: "/estoque", rotulo: "Estoque", Icone: Boxes },
  { para: "/receitas", rotulo: "Receitas", Icone: NotebookPen },
  { para: "/planejamento", rotulo: "Planejamento", Icone: CalendarRange },
  { para: "/clientes", rotulo: "Clientes", Icone: Users },
  { para: "/relatorios", rotulo: "Relatórios", Icone: BarChart3 },
  { para: "/usuarios", rotulo: "Controle de Acesso", Icone: ShieldCheck },
] as const;

function Fundo() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#F4F3F8] dark:bg-[#0F0E1A]" />
  );
}


function Navegacao({
  papel,
  compacto = false,
}: {
  papel: PapelUsuario | undefined;
  compacto?: boolean;
}) {
  const itens = todosItens.filter((item) => temPermissaoRota(papel, item.para));
  const ehSuperAdmin = papel === "super_admin";

  return (
    <nav className={cn("space-y-1 text-sm font-medium", compacto && "flex gap-1 space-y-0")}>
      {itens.map(({ para, rotulo, Icone }) => {
        let textoExibido: string = rotulo;
        if (ehSuperAdmin) {
          if (para === "/") textoExibido = "Painel SaaS";
          if (para === "/usuarios") textoExibido = "Empresas & Clientes";
          if (para === "/relatorios") textoExibido = "Relatórios Globais";
        }

        return (
          <Link
            key={para}
            to={para}
            activeOptions={{ exact: para === "/" }}
            activeProps={{ className: "bg-brand/12 text-brand font-semibold" }}
            inactiveProps={{ className: "text-muted-foreground hover:bg-card/60" }}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
              compacto && "flex-col gap-1 px-3 py-2 text-[11px]",
            )}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-foreground/5">
              <Icone className="size-4" />
            </span>
            {textoExibido}
          </Link>
        );
      })}
    </nav>
  );
}

export function Estrutura({
  titulo,
  subtitulo,
  acao,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  const { tema, alternar } = useTema();
  const {
    usuario,
    listaUsuarios,
    listaEmpresas,
    empresaAtual,
    ehSuperAdmin,
    ehAdmin,
    login,
    logout,
    salvarUsuario,
    apagarUsuario,
    alternarEmpresaAtiva,
    alternarModoVisao,
  } = useAuth();
  const navigate = useNavigate();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [loginCarregando, setLoginCarregando] = useState(false);
  const [profileAberto, setProfileAberto] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginSenha.trim()) {
      toast.error("Informe seu e-mail e senha.");
      return;
    }
    setLoginCarregando(true);
    try {
      await login({ email: loginEmail, senha: loginSenha });
      toast.success("Login realizado com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao realizar login.");
    } finally {
      setLoginCarregando(false);
    }
  };

  const rotuloPapel = (papel?: PapelUsuario) => {
    switch (papel) {
      case "super_admin":
        return "👑 Master Admin";
      case "admin":
        return "🛡️ Admin Empresa";
      case "operador":
      default:
        return "👤 Operador";
    }
  };

  if (!usuario) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
        <Fundo />
        <div className="relative z-10 w-full max-w-md glass-panel rounded-3xl p-8 space-y-6 shadow-2xl border border-border/60">
          <div className="text-center space-y-2">
            <div className="gradient-brand mx-auto grid size-14 place-items-center rounded-3xl font-display text-2xl font-bold text-white shadow-lg shadow-brand/30">
              K
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Kipi — Acessar Conta</h1>
            <p className="text-xs text-muted-foreground">
              Informe seu e-mail e senha de administrador para acessar o painel de gestão.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-login" className="text-xs font-semibold">E-mail</Label>
              <Input
                id="email-login"
                type="email"
                placeholder="camila.c.lima08@gmail.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="rounded-xl h-11 text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha-login" className="text-xs font-semibold">Senha</Label>
              <Input
                id="senha-login"
                type="password"
                placeholder="••••••••"
                value={loginSenha}
                onChange={(e) => setLoginSenha(e.target.value)}
                className="rounded-xl h-11 text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={loginCarregando}
              className="w-full h-11 rounded-xl font-semibold text-xs shadow-lg shadow-brand/25 mt-2"
            >
              {loginCarregando ? "Acessando..." : "Entrar no Sistema"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const itensNav = todosItens.filter((item) => temPermissaoRota(usuario?.papel, item.para));

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground font-sans">
      <Fundo />
      
      <div className="relative z-10 mx-auto w-full max-w-[1920px] px-4 py-4 sm:px-6 lg:px-8 sm:py-6 space-y-6">
        
        {/* TOP FLOATING HEADER NAVBAR (MENU ACIMA - DESIGN PEOPLEIO) */}
        <header className="w-full">
          <div className="flex items-center justify-between gap-4 rounded-3xl bg-card/90 p-3 px-5 shadow-sm shadow-brand/5 backdrop-blur-xl border border-border/50">
            
            {/* LOGO & BRANDING */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="gradient-brand grid size-10 place-items-center rounded-2xl font-display text-lg font-bold text-white shadow-md shadow-brand/20">
                P
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl font-extrabold tracking-tight">Kipi</span>
                  <span className="text-[10px] font-extrabold text-brand bg-brand/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {ehSuperAdmin ? "SaaS Master" : (empresaAtual?.nome ?? "Ateliê")}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium hidden sm:block">Empower. Engage. Elevate.</p>
              </div>
            </div>

            {/* HORIZONTAL PILL NAVIGATION (MENU ACIMA) */}
            <nav className="hidden lg:flex items-center gap-1.5 bg-muted/60 p-1.5 rounded-full border border-border/40">
              {itensNav.map(({ para, rotulo, Icone }) => {
                let textoExibido: string = rotulo;
                if (ehSuperAdmin) {
                  if (para === "/") textoExibido = "Dashboard";
                  if (para === "/usuarios") textoExibido = "Empresas & Clientes";
                  if (para === "/relatorios") textoExibido = "Relatórios Globais";
                }

                return (
                  <Link
                    key={para}
                    to={para}
                    activeOptions={{ exact: para === "/" }}
                    activeProps={{
                      className: "bg-brand text-white font-bold shadow-md shadow-brand/25",
                    }}
                    inactiveProps={{
                      className: "text-muted-foreground hover:text-foreground hover:bg-background/80 font-medium",
                    }}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-xs transition-all duration-200"
                  >
                    <Icone className="size-3.5" />
                    {textoExibido}
                  </Link>
                );
              })}
            </nav>

            {/* ACTION BUTTONS & PROFILE */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Multi-tenant selector */}
              {listaEmpresas.length > 0 && !ehSuperAdmin && (
                <div className="hidden md:block">
                  <Select
                    value={usuario?.empresaAtivaId ?? listaEmpresas[0]?.id ?? ""}
                    onValueChange={(empId) => {
                      alternarEmpresaAtiva(empId);
                      toast.success("Empresa alternada!");
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-full text-xs bg-muted/50 font-semibold border-border/50 px-3">
                      <Building2 className="size-3.5 mr-1.5 text-brand" />
                      <SelectValue placeholder="Empresa..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {listaEmpresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quick View Switcher (Master SaaS vs Dono de Empresa) */}
              <button
                type="button"
                onClick={() => {
                  const proximo = ehSuperAdmin ? "admin" : "super_admin";
                  alternarModoVisao(proximo);
                  toast.success(proximo === "admin" ? "Visualizando como Dono da Empresa (Ateliê Bella)!" : "Visualizando como Master SaaS!");
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black shadow-sm transition-all border",
                  ehSuperAdmin
                    ? "bg-[#FFC64F] text-[#084463] border-[#FFC64F] hover:bg-[#F5B83D]"
                    : "bg-[#084463] text-white border-[#084463] hover:bg-[#06344C]"
                )}
                title="Alternar entre visão Master SaaS e visão do Cliente Dono"
              >
                <span>{ehSuperAdmin ? "🏪" : "👑"}</span>
                <span className="hidden md:inline">{ehSuperAdmin ? "Ver como Dono de Empresa" : "Ver como Master SaaS"}</span>
                <span className="md:hidden">{ehSuperAdmin ? "Dono" : "Master"}</span>
              </button>

              {/* Settings button pill */}
              <button
                type="button"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300 dark:border-border text-xs font-semibold text-[#084463] dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted transition-colors"
              >
                <Settings className="size-3.5" />
                <span>Settings</span>
              </button>

              {/* Notification Bell with Badge */}
              <div className="relative">
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-full border border-slate-300 dark:border-border text-[#084463] dark:text-muted-foreground hover:text-foreground transition-colors"
                  title="Notificações"
                >
                  <Bell className="size-4" />
                </button>
                <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-[#FFC64F] text-[9px] font-black text-[#084463] shadow-sm">
                  3
                </span>
              </div>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={alternar}
                className="grid size-9 place-items-center rounded-full bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Alternar Tema"
              >
                {tema === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
              </button>

              {/* Profile Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileAberto(!profileAberto)}
                  className="grid size-9 place-items-center rounded-full bg-[#E8F4F8] dark:bg-muted border border-[#6BB9D4]/40 text-[#084463] dark:text-foreground font-black text-xs hover:bg-[#D5EDF5] transition-colors"
                  title="Perfil"
                >
                  {(usuario?.nome || "C").charAt(0).toUpperCase()}
                </button>

                {profileAberto && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-card rounded-3xl p-2 shadow-2xl border border-slate-200 dark:border-border z-50 space-y-1">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-border/40">
                      <p className="text-xs font-bold text-[#084463] dark:text-foreground">{usuario?.nome}</p>
                      <p className="text-[11px] text-slate-500 dark:text-muted-foreground truncate">{usuario?.email}</p>
                      <span className="inline-block mt-1 text-[9px] font-extrabold text-brand bg-brand/10 px-2 py-0.5 rounded-full uppercase">
                        {rotuloPapel(usuario?.papel)}
                      </span>
                    </div>
                    {ehAdmin && (
                      <Link
                        to="/usuarios"
                        onClick={() => setProfileAberto(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-foreground"
                      >
                        <ShieldCheck className="size-4 text-brand" /> Controle de Acessos
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileAberto(false);
                        logout();
                        toast.info("Sessão encerrada.");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="size-4" /> Sair do Sistema
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </header>

        {/* TOP WELCOME & STATS BANNER ROW (PEACOCK & SAFFRON COASTAL PALETTE) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-card rounded-[28px] p-6 shadow-sm border border-slate-200/70 dark:border-border/50">
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#084463] dark:text-foreground">
              Welcome in, <span className="text-[#084463] font-black">{ehSuperAdmin ? "Peoplexio" : (usuario?.nome ?? "Camila")}</span>
            </h1>
            
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 bg-[#084463] text-white px-5 py-2 rounded-full text-xs font-bold shadow-sm">
                <span>Interviews</span>
                <span className="bg-[#6BB9D4] text-[#084463] font-black px-2 py-0.5 rounded-full text-[10px]">18%</span>
              </div>
              <div className="flex items-center gap-2 bg-[#FFC64F] text-[#084463] px-5 py-2 rounded-full text-xs font-black shadow-sm">
                <span>Hired</span>
                <span className="bg-[#084463] text-white px-2 py-0.5 rounded-full text-[10px]">24%</span>
              </div>
              <div className="flex items-center gap-2 bg-[#E8F4F8] text-[#084463] dark:bg-muted dark:text-muted-foreground px-5 py-2 rounded-full text-xs font-bold">
                <span>Project time</span>
                <span className="text-[#084463] font-extrabold">65%</span>
              </div>
              <div className="flex items-center gap-2 border border-[#084463]/20 text-[#084463] dark:border-border px-5 py-2 rounded-full text-xs font-bold">
                <span>Output</span>
                <span className="text-[#084463] font-extrabold">12%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 divide-x divide-slate-200 dark:divide-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-[#E8F4F8] dark:bg-slate-800 grid place-items-center text-[#084463]">
                <Users className="size-5" />
              </div>
              <div>
                <p className="font-display text-2xl font-black text-[#084463] dark:text-foreground leading-none">128</p>
                <p className="text-xs text-slate-500 font-medium">Employees</p>
              </div>
            </div>

            <div className="pl-6 flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-[#FFF5DC] dark:bg-amber-950/40 grid place-items-center text-[#D97706]">
                <Boxes className="size-5" />
              </div>
              <div>
                <p className="font-display text-2xl font-black text-[#084463] dark:text-foreground leading-none">36</p>
                <p className="text-xs text-slate-500 font-medium">Openings</p>
              </div>
            </div>

            <div className="pl-6 flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-[#E8F4F8] dark:bg-slate-800 grid place-items-center text-[#6BB9D4]">
                <Building2 className="size-5" />
              </div>
              <div>
                <p className="font-display text-2xl font-black text-[#084463] dark:text-foreground leading-none">54</p>
                <p className="text-xs text-slate-500 font-medium">Departments</p>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN PAGE CONTENT */}
        <main className="w-full space-y-6">
          {children}
        </main>
      </div>

      {/* MOBILE BAR */}
      <div className="lg:hidden fixed bottom-3 left-4 right-4 z-50 glass-panel rounded-full p-2 border border-border/60 shadow-2xl flex items-center justify-around">
        {itensNav.slice(0, 5).map(({ para, rotulo, Icone }) => (
          <Link
            key={para}
            to={para}
            activeOptions={{ exact: para === "/" }}
            activeProps={{ className: "bg-brand text-white font-bold" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex flex-col items-center justify-center p-2 rounded-full size-10 transition-colors"
            title={rotulo}
          >
            <Icone className="size-4" />
          </Link>
        ))}
      </div>
    </div>
  );
}

