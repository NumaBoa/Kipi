import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
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
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="blob-a absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand/25 blur-3xl" />
      <div className="blob-b absolute top-1/3 -right-16 h-[28rem] w-[28rem] rounded-full bg-blossom/20 blur-3xl" />
      <div className="blob-a absolute -bottom-20 left-1/3 h-80 w-80 rounded-full bg-chart-3/25 blur-3xl" />
    </div>
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
                  className="flex items-center gap-2 rounded-full bg-muted/60 hover:bg-muted p-1 pr-3 transition-colors border border-border/40"
                >
                  <div className="grid size-8 place-items-center rounded-full bg-brand text-white font-bold text-xs shadow-sm">
                    {(usuario?.nome || "C").charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-xs font-bold truncate max-w-[100px]">{usuario?.nome ?? "Camila"}</span>
                </button>

                {profileAberto && (
                  <div className="absolute right-0 mt-2 w-56 glass-panel rounded-3xl p-2 shadow-2xl border border-border/60 z-50 space-y-1">
                    <div className="px-3 py-2 border-b border-border/40">
                      <p className="text-xs font-bold">{usuario?.nome}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{usuario?.email}</p>
                      <span className="inline-block mt-1 text-[9px] font-extrabold text-brand bg-brand/10 px-2 py-0.5 rounded-full uppercase">
                        {rotuloPapel(usuario?.papel)}
                      </span>
                    </div>
                    {ehAdmin && (
                      <Link
                        to="/usuarios"
                        onClick={() => setProfileAberto(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl hover:bg-muted text-foreground"
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

        {/* TOP WELCOME & STATS BANNER ROW (REPRODUZINDO O TOPO DO ANEXO) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 rounded-3xl p-5 border border-border/40">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">
              Welcome in, <span className="text-brand">{ehSuperAdmin ? "Master Kipi" : (usuario?.nome ?? "Ateliê")}</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {subtitulo ?? "Acompanhe as métricas do seu sistema em tempo real e gestione sua produção com alta performance."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Stat Pill 1 */}
            <div className="flex items-center gap-2 bg-background/80 px-3.5 py-1.5 rounded-full border border-border/50 text-xs font-semibold">
              <span className="bg-brand text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">18%</span>
              <span className="text-muted-foreground">Conversão</span>
            </div>

            {/* Stat Pill 2 */}
            <div className="flex items-center gap-2 bg-background/80 px-3.5 py-1.5 rounded-full border border-border/50 text-xs font-semibold">
              <span className="bg-blossom text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">65%</span>
              <span className="text-muted-foreground">Meta Mensal</span>
            </div>

            {/* Stat Pill 3 */}
            <div className="hidden xl:flex items-center gap-2 bg-background/80 px-3.5 py-1.5 rounded-full border border-border/50 text-xs font-semibold">
              <span className="bg-emerald-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">84%</span>
              <span className="text-muted-foreground">Desempenho</span>
            </div>

            {acao}
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

