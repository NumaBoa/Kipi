import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CakeSlice,
  Camera,
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
import { useState, useEffect, type ReactNode } from "react";
import { useTema } from "@/lib/theme";
import { hoje } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth, temPermissaoRota, type PapelUsuario, type Usuario } from "@/lib/auth";
import { lerValorHoraPadrao, gravarValorHoraPadrao } from "@/lib/dados";
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

const itensNegocio = [
  { para: "/", rotulo: "Início", Icone: LayoutDashboard },
  { para: "/vendas", rotulo: "Pedidos", Icone: ShoppingBag },
  { para: "/planejamento", rotulo: "Produção", Icone: CalendarRange },
  { para: "/produtos", rotulo: "Catálogo & Estoque", Icone: Boxes },
  { para: "/clientes", rotulo: "Contatos", Icone: Users },
] as const;

const itensSuperAdmin = [
  { para: "/", rotulo: "Painel SaaS", Icone: LayoutDashboard },
  { para: "/usuarios", rotulo: "Empresas & Contas", Icone: ShieldCheck },
  { para: "/relatorios", rotulo: "Relatórios Globais", Icone: BarChart3 },
  { para: "/vendas", rotulo: "Pedidos & Revenda", Icone: ShoppingBag },
  { para: "/clientes", rotulo: "Meus Clientes", Icone: Users },
] as const;

const itensRevendedor = [
  { para: "/vendas", rotulo: "Pedidos & Vendas", Icone: ShoppingBag },
  { para: "/clientes", rotulo: "Meus Clientes", Icone: Users },
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
  const ehSuperAdmin = papel === "super_admin";
  const ehRevendedor = papel === "revendedor";
  const itens = ehSuperAdmin ? itensSuperAdmin : ehRevendedor ? itensRevendedor : itensNegocio;

  return (
    <nav className={cn("space-y-1 text-sm font-medium", compacto && "flex gap-1 space-y-0")}>
      {itens.map(({ para, rotulo, Icone }) => {
        let textoExibido: string = rotulo;
        if (ehSuperAdmin) {
          if (para === "/") textoExibido = "Painel SaaS";
          if (para === "/usuarios") textoExibido = "Empresas & Clientes";
          if (para === "/relatorios") textoExibido = "Relatórios Globais";
          if (para === "/vendas") textoExibido = "Pedidos & Revenda";
          if (para === "/clientes") textoExibido = "Meus Clientes";
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
  exibirBannerBoasVindas = false,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  children: ReactNode;
  exibirBannerBoasVindas?: boolean;
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
    salvarEmpresa,
  } = useAuth();
  const navigate = useNavigate();

  const [loginEmail, setLoginEmail] = useState("camila.c.lima08@gmail.com");
  const [loginSenha, setLoginSenha] = useState("P&ix1nh0!");
  const [loginCarregando, setLoginCarregando] = useState(false);
  const [profileAberto, setProfileAberto] = useState(false);
  const [logoMarca, setLogoMarca] = useState<string | null>(null);

  // Modal de Configurações
  const [modalConfiguracoes, setModalConfiguracoes] = useState(false);
  const [configNomeAtelie, setConfigNomeAtelie] = useState(empresaAtual?.nome || "Ateliê Gourmet Bella");
  const [configDocumento, setConfigDocumento] = useState(empresaAtual?.documento || "12.345.678/0001-90");
  const [configValorHora, setConfigValorHora] = useState(() => String(lerValorHoraPadrao()));

  useEffect(() => {
    if (empresaAtual) {
      setConfigNomeAtelie(empresaAtual.nome);
      setConfigDocumento(empresaAtual.documento);
    }
  }, [empresaAtual]);

  const handleSalvarConfiguracoes = async () => {
    try {
      if (empresaAtual) {
        await salvarEmpresa({
          id: empresaAtual.id,
          nome: configNomeAtelie.trim() || empresaAtual.nome,
          documento: configDocumento.trim() || empresaAtual.documento,
        });
      }
      const vHoraNum = Number(configValorHora.replace(",", ".")) || 25;
      gravarValorHoraPadrao(vHoraNum);
      toast.success("Configurações do Ateliê salvas com sucesso!");
      setModalConfiguracoes(false);
    } catch {
      toast.error("Erro ao salvar configurações.");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const chave = `meu-atelie-logo-${empresaAtual?.id ?? "padrao"}`;
      setLogoMarca(localStorage.getItem(chave));
    }
  }, [empresaAtual?.id]);

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida (PNG, JPG, SVG ou WebP).");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setLogoMarca(dataUrl);
        if (typeof window !== "undefined") {
          const chave = `meu-atelie-logo-${empresaAtual?.id ?? "padrao"}`;
          localStorage.setItem(chave, dataUrl);
        }
        toast.success("Foto da marca atualizada com sucesso!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginSenha.trim()) {
      toast.error("Informe seu e-mail e senha.");
      return;
    }
    setLoginCarregando(true);
    try {
      const u = await login({ email: loginEmail, senha: loginSenha });
      toast.success("Login realizado com sucesso!");
      if (u?.papel === "revendedor") {
        navigate({ to: "/vendas" });
      } else {
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao realizar login.");
    } finally {
      setLoginCarregando(false);
    }
  };

  const ehRevendedor = usuario?.papel === "revendedor";

  useEffect(() => {
    if (ehRevendedor && typeof window !== "undefined") {
      const pathname = window.location.pathname;
      if (pathname !== "/vendas") {
        navigate({ to: "/vendas" });
      }
    }
  }, [ehRevendedor, navigate]);

  const rotuloPapel = (papel?: PapelUsuario) => {
    switch (papel) {
      case "super_admin":
        return "👑 Master SaaS";
      case "admin":
        return "🛡️ Dono da Empresa";
      case "revendedor":
        return "🏪 Revendedor (PDV)";
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
              Informe seu e-mail e senha para acessar o painel de gestão.
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

  const itensNav = ehSuperAdmin ? itensSuperAdmin : ehRevendedor ? itensRevendedor : itensNegocio;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground font-sans">
      <Fundo />
      
      <div className="relative z-10 mx-auto w-full max-w-[1920px] px-3.5 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-24 lg:pb-8 space-y-4 sm:space-y-6">
        
        {/* TOP FLOATING HEADER NAVBAR (MENU ACIMA - DESIGN PEOPLEIO) */}
        <header className="w-full">
          <div className="flex items-center justify-between gap-2.5 sm:gap-4 rounded-2xl sm:rounded-3xl bg-card/90 p-2.5 px-3.5 sm:p-3 sm:px-5 shadow-sm shadow-brand/5 backdrop-blur-xl border border-border/50">
            
            {/* LOGO & BRANDING (FOTO DA MARCA COM UPLOAD + NOME DO ATELIÊ) */}
            <div className="flex items-center gap-3 shrink-0">
              <input
                id="upload-logo-marca"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadLogo}
              />
              <label
                htmlFor="upload-logo-marca"
                className="group relative size-11 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-border/60 shadow-sm cursor-pointer grid place-items-center bg-gradient-to-br from-[#E8F4F8] to-[#C9E7F2] dark:from-slate-800 dark:to-slate-900 transition-all hover:ring-2 hover:ring-[#084463]/40 shrink-0"
                title="Clique para enviar a foto da marca"
              >
                {logoMarca ? (
                  <img
                    src={logoMarca}
                    alt={empresaAtual?.nome ?? "Logo da marca"}
                    className="size-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#084463] dark:text-[#6BB9D4]">
                    <CakeSlice className="size-5" />
                  </div>
                )}

                {/* Overlay no hover para troca de foto */}
                <div className="absolute inset-0 bg-[#084463]/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                  <Camera className="size-4" />
                  <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Trocar</span>
                </div>
              </label>

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="font-display text-sm sm:text-base lg:text-lg font-extrabold tracking-tight text-[#084463] dark:text-foreground truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
                  {ehSuperAdmin ? "Kipi" : (empresaAtual?.nome ?? "Ateliê Gourmet Bella")}
                </span>
                {ehSuperAdmin && listaEmpresas.length > 1 && (
                  <Select
                    value={empresaAtual?.id ?? ""}
                    onValueChange={(val) => alternarEmpresaAtiva(val)}
                  >
                    <SelectTrigger className="h-7 text-[11px] font-bold rounded-lg border-slate-200 bg-white/80 dark:bg-card px-2 gap-1.5 text-[#084463] shadow-none">
                      <Building2 className="size-3 text-brand" />
                      <SelectValue placeholder="Empresa Ativa" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {listaEmpresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs font-semibold">
                          🏢 {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* HORIZONTAL PILL NAVIGATION (MENU ACIMA - 100% RESPONSIVO E ALINHADO) */}
            <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1.5 bg-muted/60 p-1 rounded-full border border-border/40 overflow-x-auto no-scrollbar shrink-0">
              {itensNav.map(({ para, rotulo, Icone }) => {
                let textoExibido: string = rotulo;
                if (ehSuperAdmin) {
                  if (para === "/") textoExibido = "Painel SaaS";
                  if (para === "/usuarios") textoExibido = "Clientes & Contas";
                  if (para === "/relatorios") textoExibido = "Relatórios";
                  if (para === "/vendas") textoExibido = "Pedidos & Revenda";
                  if (para === "/clientes") textoExibido = "Meus Clientes";
                }

                return (
                  <Link
                    key={para}
                    to={para}
                    activeOptions={{ exact: para === "/" }}
                    activeProps={{
                      className: "bg-[#084463] text-white font-bold shadow-md shadow-[#084463]/25",
                    }}
                    inactiveProps={{
                      className: "text-[#557385] dark:text-muted-foreground hover:text-[#084463] dark:hover:text-foreground hover:bg-background/80 font-semibold",
                    }}
                    className="flex items-center gap-1 xl:gap-1.5 rounded-full px-2 xl:px-3 py-1.5 text-[11px] xl:text-xs whitespace-nowrap shrink-0 transition-all duration-200"
                    title={rotulo}
                  >
                    <Icone className="size-3.5 shrink-0" />
                    <span>{textoExibido}</span>
                  </Link>
                );
              })}
            </nav>

            {/* ACTION BUTTONS & PROFILE */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

              {/* Profile Pill & User Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileAberto(!profileAberto)}
                  className="grid size-9 place-items-center rounded-full bg-[#E8F4F8] dark:bg-muted border border-[#6BB9D4]/40 text-[#084463] dark:text-foreground font-black text-xs hover:bg-[#D5EDF5] transition-colors"
                  title="Perfil e Configurações"
                >
                  {(usuario?.nome || "C").charAt(0).toUpperCase()}
                </button>

                {profileAberto && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileAberto(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-card rounded-3xl p-3 shadow-2xl border border-slate-200 dark:border-border z-50 space-y-2.5">
                      {/* DADOS DO USUÁRIO */}
                      <div className="px-2 py-1.5 border-b border-slate-100 dark:border-border/40">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[#084463] dark:text-foreground">{usuario?.nome}</p>
                          <span className="text-[9px] font-extrabold text-brand bg-brand/10 px-2 py-0.5 rounded-full uppercase">
                            {rotuloPapel(usuario?.papel)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-muted-foreground truncate mt-0.5">{usuario?.email}</p>
                      </div>

                      {/* AÇÕES E CONFIGURAÇÕES */}
                      <div className="space-y-0.5 pt-1">
                        {ehSuperAdmin ? (
                          <>
                            <Link
                              to="/usuarios"
                              onClick={() => setProfileAberto(false)}
                              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-foreground transition-colors"
                            >
                              <ShieldCheck className="size-4 text-brand" /> Gestão de Empresas & Contas
                            </Link>
                            <Link
                              to="/relatorios"
                              onClick={() => setProfileAberto(false)}
                              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-foreground transition-colors"
                            >
                              <BarChart3 className="size-4 text-brand" /> Relatórios Globais
                            </Link>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setProfileAberto(false);
                                setModalConfiguracoes(true);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-foreground transition-colors"
                            >
                              <Settings className="size-4 text-brand" /> Configurações do Ateliê
                            </button>

                            {ehAdmin && !ehRevendedor && (
                              <Link
                                to="/usuarios"
                                onClick={() => setProfileAberto(false)}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-foreground transition-colors"
                              >
                                <ShieldCheck className="size-4 text-brand" /> Controle de Acessos
                              </Link>
                            )}
                          </>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            setProfileAberto(false);
                            await logout();
                            navigate({ to: "/" });
                            toast.info("Sessão encerrada com sucesso.");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <LogOut className="size-4" /> Sair do Sistema
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </header>

        {/* BANNER DE BOAS-VINDAS: APENAS NO PAINEL DO GESTOR SAAS (100% EM PORTUGUÊS) */}
        {exibirBannerBoasVindas && ehSuperAdmin ? (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-card rounded-[28px] p-6 shadow-sm border border-slate-200/70 dark:border-border/50">
            <div className="space-y-3">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#084463] dark:text-foreground">
                Bem-vinda de volta, <span className="text-[#084463] font-black">{usuario?.nome ?? "Camila Lima"}</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Visão geral da sua plataforma SaaS, clientes ativos e assinaturas comercializadas.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <div className="flex items-center gap-2 bg-[#084463] text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  <span>Assinaturas Ativas</span>
                  <span className="bg-[#6BB9D4] text-[#084463] font-black px-2 py-0.5 rounded-full text-[10px]">24%</span>
                </div>
                <div className="flex items-center gap-2 bg-[#FFC64F] text-[#084463] px-4 py-1.5 rounded-full text-xs font-black shadow-sm">
                  <span>Novos Clientes</span>
                  <span className="bg-[#084463] text-white px-2 py-0.5 rounded-full text-[10px]">18%</span>
                </div>
                <div className="flex items-center gap-2 bg-[#E8F4F8] text-[#084463] dark:bg-muted dark:text-muted-foreground px-4 py-1.5 rounded-full text-xs font-bold">
                  <span>Uso da Plataforma</span>
                  <span className="text-[#084463] font-extrabold">65%</span>
                </div>
                <div className="flex items-center gap-2 border border-[#084463]/20 text-[#084463] dark:border-border px-4 py-1.5 rounded-full text-xs font-bold">
                  <span>Retenção</span>
                  <span className="text-[#084463] font-extrabold">98%</span>
                </div>
              </div>

              {acao && <div className="pt-2">{acao}</div>}
            </div>

            <div className="flex items-center gap-6 divide-x divide-slate-200 dark:divide-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-[#E8F4F8] dark:bg-slate-800 grid place-items-center text-[#084463]">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-black text-[#084463] dark:text-foreground leading-none">128</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Usuários Ativos</p>
                </div>
              </div>

              <div className="pl-6 flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-[#FFF5DC] dark:bg-amber-950/40 grid place-items-center text-[#D97706]">
                  <Boxes className="size-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-black text-[#084463] dark:text-foreground leading-none">36</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Empresas Clientes</p>
                </div>
              </div>

              <div className="pl-6 flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-[#E8F4F8] dark:bg-slate-800 grid place-items-center text-[#6BB9D4]">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-black text-[#084463] dark:text-foreground leading-none">54</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Planos Ativos</p>
                </div>
              </div>
            </div>
          </div>
        ) : acao ? (
          /* LINHA DE AÇÃO COMPACTA (SEM TÍTULOS GRANDES PARA MAXIMIZAR O ESPAÇO EM TELA) */
          <div className="flex items-center justify-end -mb-2">
            <div className="shrink-0">{acao}</div>
          </div>
        ) : null}

        {/* MAIN PAGE CONTENT */}
        <main className="w-full space-y-6">
          {children}
        </main>
      </div>

      {/* MODAL DE CONFIGURAÇÕES DO ATELIÊ */}
      <Dialog open={modalConfiguracoes} onOpenChange={setModalConfiguracoes}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463] dark:text-foreground flex items-center gap-2">
              <Settings className="size-5 text-brand" /> Configurações do Ateliê
            </DialogTitle>
            <DialogDescription>
              Ajuste as informações da empresa, identidade da marca e parâmetros de custo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* LOGO DA MARCA */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Foto / Logo da Marca</Label>
              <div className="flex items-center gap-4 mt-2">
                <div className="size-16 rounded-2xl overflow-hidden border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted grid place-items-center shrink-0">
                  {logoMarca ? (
                    <img src={logoMarca} alt="Logo" className="size-full object-cover" />
                  ) : (
                    <CakeSlice className="size-7 text-[#084463]" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="upload-logo-modal"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#084463] text-white hover:bg-[#06344C] transition-colors"
                  >
                    <Camera className="size-3.5" /> Alterar Foto
                  </label>
                  <input
                    id="upload-logo-modal"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadLogo}
                  />
                  {logoMarca && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoMarca(null);
                        if (typeof window !== "undefined") {
                          localStorage.removeItem(`meu-atelie-logo-${empresaAtual?.id ?? "padrao"}`);
                        }
                        toast.info("Foto removida.");
                      }}
                      className="text-[11px] text-rose-600 hover:underline font-semibold text-left"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* NOME DO ATELIÊ */}
            <div>
              <Label htmlFor="cfg-nome" className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome Fantasia do Ateliê</Label>
              <Input
                id="cfg-nome"
                value={configNomeAtelie}
                onChange={(e) => setConfigNomeAtelie(e.target.value)}
                placeholder="Ex: Ateliê Gourmet Bella"
                className="mt-1 rounded-xl text-xs font-semibold"
              />
            </div>

            {/* CNPJ / DOCUMENTO */}
            <div>
              <Label htmlFor="cfg-doc" className="text-xs font-bold text-slate-700 dark:text-slate-300">Documento (CNPJ ou CPF)</Label>
              <Input
                id="cfg-doc"
                value={configDocumento}
                onChange={(e) => setConfigDocumento(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="mt-1 rounded-xl text-xs font-semibold"
              />
            </div>

            {/* VALOR DA HORA DE TRABALHO PADRÃO */}
            <div className="p-3.5 bg-slate-50 dark:bg-muted/40 rounded-2xl border border-slate-200 dark:border-border/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cfg-hora" className="text-xs font-extrabold text-slate-800 dark:text-foreground">
                  Valor da Hora de Mão de Obra
                </Label>
                <span className="text-[11px] font-bold text-brand">R$ / hora</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                <Input
                  id="cfg-hora"
                  type="text"
                  inputMode="decimal"
                  value={configValorHora}
                  onChange={(e) => setConfigValorHora(e.target.value)}
                  placeholder="25,00"
                  className="pl-9 rounded-xl font-bold text-sm bg-white dark:bg-card"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-muted-foreground pt-0.5">
                Utilizado para o cálculo automático do custo de mão de obra nas receitas, fornadas e produtos.
              </p>
            </div>

            {/* TEMA VISUAL */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tema do Sistema</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <Button
                  type="button"
                  variant={tema === "light" ? "default" : "outline"}
                  size="sm"
                  className={cn("rounded-xl text-xs font-bold gap-1.5", tema === "light" && "bg-[#084463] text-white")}
                  onClick={() => { if (tema !== "light") alternar(); }}
                >
                  <Sun className="size-3.5" /> Modo Claro
                </Button>
                <Button
                  type="button"
                  variant={tema === "dark" ? "default" : "outline"}
                  size="sm"
                  className={cn("rounded-xl text-xs font-bold gap-1.5", tema === "dark" && "bg-[#084463] text-white")}
                  onClick={() => { if (tema !== "dark") alternar(); }}
                >
                  <Moon className="size-3.5" /> Modo Escuro
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-5 gap-2">
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setModalConfiguracoes(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5 text-xs"
              onClick={handleSalvarConfiguracoes}
            >
              Salvar Configurações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MOBILE BAR */}
      <div className="lg:hidden fixed bottom-3 left-3 right-3 sm:left-4 sm:right-4 z-50 glass-panel rounded-full p-1.5 sm:p-2 border border-border/60 shadow-2xl flex items-center justify-around bg-card/95 backdrop-blur-xl">
        {itensNav.slice(0, 5).map(({ para, rotulo, Icone }) => (
          <Link
            key={para}
            to={para}
            activeOptions={{ exact: para === "/" }}
            activeProps={{ className: "bg-[#084463] text-white font-bold shadow-md shadow-[#084463]/25 scale-105" }}
            inactiveProps={{ className: "text-[#557385] dark:text-muted-foreground hover:text-[#084463] dark:hover:text-foreground" }}
            className="flex flex-col items-center justify-center p-1.5 rounded-full size-11 transition-all active:scale-95"
            title={rotulo}
          >
            <Icone className="size-5 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

