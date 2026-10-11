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

  return (
    <nav className={cn("space-y-1 text-sm font-medium", compacto && "flex gap-1 space-y-0")}>
      {itens.map(({ para, rotulo, Icone }) => (
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
          {rotulo}
        </Link>
      ))}
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

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      <Fundo />
      <div className="relative z-10 mx-auto flex w-full max-w-[1920px] gap-6 px-4 py-4 sm:px-6 lg:px-8 xl:px-10 sm:py-6">
        {/* ASIDE SIDEBAR */}
        <aside className="hidden w-60 shrink-0 lg:block xl:w-64 2xl:w-72">
          <div className="glass-panel sticky top-6 rounded-3xl p-4 space-y-4">
            <div className="flex items-center gap-2.5 px-2 pb-3 border-b border-border/50">
              <div className="gradient-brand grid size-10 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold text-primary-foreground">
                K
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg leading-none font-semibold">
                  Kipi
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {empresaAtual?.nome ?? "Gestão de Produção & Vendas"}
                </p>
              </div>
            </div>

            {/* Seletor de Empresa Ativa (Multi-Tenant) */}
            <div className="glass-inset rounded-2xl p-2.5 space-y-1.5 border border-border/40">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                  <Building2 className="size-3 text-brand" /> Empresa Selecionada
                </span>
                {ehAdmin && (
                  <span className="text-[9px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded-full">
                    {listaEmpresas.length} cadastradas
                  </span>
                )}
              </div>
              <Select
                value={usuario?.empresaAtivaId ?? listaEmpresas[0]?.id ?? ""}
                onValueChange={(empId) => {
                  alternarEmpresaAtiva(empId);
                  toast.success("Empresa alternada com sucesso!");
                }}
              >
                <SelectTrigger className="h-8 rounded-xl text-xs bg-background/80 font-medium border-border/60">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {listaEmpresas
                    .filter((emp) => ehSuperAdmin || usuario?.empresaIds?.includes(emp.id))
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Badge de Usuário Logado */}
            <div className="glass-inset rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Usuário Ativo
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                    ehAdmin ? "bg-brand/15 text-brand" : "bg-blossom/15 text-blossom"
                  )}
                >
                  {rotuloPapel(usuario?.papel)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{usuario?.nome ?? "Camila"}</p>
                <p className="truncate text-[11px] text-muted-foreground">{usuario?.email}</p>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                {ehAdmin ? (
                  <Link to="/usuarios" className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] rounded-xl w-full gap-1"
                    >
                      <ShieldCheck className="size-3" /> Acessos
                    </Button>
                  </Link>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] rounded-xl text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    logout();
                    toast.info("Sessão encerrada.");
                  }}
                >
                  <LogOut className="size-3" /> Sair
                </Button>
              </div>
            </div>

            <Navegacao papel={usuario?.papel} />

            <div className="rounded-2xl bg-brand/10 p-3">
              <p className="text-xs font-semibold">Tema da Interface</p>
              <button
                type="button"
                onClick={alternar}
                className="mt-2 flex w-full items-center justify-between rounded-xl bg-card/70 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-card"
              >
                {tema === "dark" ? "Modo escuro" : "Modo claro"}
                {tema === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="min-w-0 flex-1 space-y-5">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                {subtitulo ?? hoje()}
              </p>
              <h1 className="truncate text-2xl md:text-3xl">{titulo}</h1>
            </div>
            <div className="flex items-center gap-2">
              {acao}
              <button
                type="button"
                onClick={alternar}
                aria-label="Alternar tema"
                className="glass-panel grid size-11 shrink-0 place-items-center rounded-2xl lg:hidden"
              >
                {tema === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
              </button>
            </div>
          </header>

          {children}

          <div className="glass-panel sticky bottom-0 z-20 -mx-1 overflow-x-auto rounded-3xl p-2 lg:hidden">
            <Navegacao papel={usuario?.papel} compacto />
          </div>
        </main>
      </div>
    </div>
  );
}

