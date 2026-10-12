import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  Edit2,
  KeyRound,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import { Estrutura } from "@/components/app/estrutura";
import { useAuth, type Empresa, type PapelUsuario, type StatusUsuario, type Usuario } from "@/lib/auth";
import { useRevendedoras, useSalvarRevendedora } from "@/lib/dados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: PaginaControleAcesso,
});

function PaginaControleAcesso() {
  const {
    usuario: usuarioLogado,
    listaUsuarios,
    listaEmpresas,
    ehSuperAdmin,
    ehAdmin,
    salvarUsuario,
    toggleStatusUsuario,
    apagarUsuario,
    salvarEmpresa,
    apagarEmpresa,
  } = useAuth();

  const { data: revendedoras = [] } = useRevendedoras();
  const salvarRevendedora = useSalvarRevendedora();

  const [abaAtiva, setAbaAtiva] = useState<"usuarios" | "empresas">("usuarios");

  // Filtros de Usuários
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");

  // Modais de Usuários
  const [modalUsuario, setModalUsuario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Partial<Usuario> | null>(null);

  // Modais de Empresas
  const [modalEmpresa, setModalEmpresa] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<Partial<Empresa> | null>(null);

  // Form State para Usuário
  const [formUsuario, setFormUsuario] = useState<{
    id?: string;
    nome: string;
    email: string;
    senha: string;
    status: StatusUsuario;
    papel: PapelUsuario;
    empresaIds: string[];
  }>({
    nome: "",
    email: "",
    senha: "123",
    status: "ativo",
    papel: "operador",
    empresaIds: [listaEmpresas[0]?.id ?? "emp_matriz"],
  });

  // Form State para Empresa
  const [formEmpresa, setFormEmpresa] = useState<{
    id?: string;
    nome: string;
    documento: string;
    plano: "Starter" | "Pro" | "Enterprise";
    status: "ativa" | "suspensa";
  }>({
    nome: "",
    documento: "",
    plano: "Pro",
    status: "ativa",
  });

  // KPI Computations
  const totalUsuarios = listaUsuarios.length;
  const totalAtivos = listaUsuarios.filter((u) => u.status === "ativo").length;
  const totalPendentes = listaUsuarios.filter((u) => u.status === "pendente").length;
  const totalBloqueados = listaUsuarios.filter((u) => u.status === "bloqueado").length;
  const totalEmpresas = listaEmpresas.length;

  // Filtragem de Usuários
  const usuariosFiltrados = listaUsuarios.filter((u) => {
    const atendeBusca =
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase());

    const atendeStatus = filtroStatus === "todos" ? true : u.status === filtroStatus;

    const atendeEmpresa =
      filtroEmpresa === "todas"
        ? true
        : u.empresaIds?.includes(filtroEmpresa);

    return atendeBusca && atendeStatus && atendeEmpresa;
  });

  // Abrir Modal para Criar/Editar Usuário
  const abrirModalNovoUsuario = () => {
    setUsuarioEditando(null);
    setFormUsuario({
      nome: "",
      email: "",
      senha: "123",
      status: "ativo",
      papel: "operador",
      empresaIds: [listaEmpresas[0]?.id ?? "emp_matriz"],
    });
    setModalUsuario(true);
  };

  const abrirModalEditarUsuario = (u: Usuario) => {
    setUsuarioEditando(u);
    setFormUsuario({
      id: u.id,
      nome: u.nome,
      email: u.email,
      senha: u.senha,
      status: u.status,
      papel: u.papel,
      empresaIds: u.empresaIds || [],
    });
    setModalUsuario(true);
  };

  const submitUsuario = async () => {
    if (!formUsuario.nome.trim() || !formUsuario.email.trim()) {
      toast.error("Por favor, preencha o nome e o e-mail do usuário.");
      return;
    }
    if (!formUsuario.empresaIds || formUsuario.empresaIds.length === 0) {
      toast.error("Selecione pelo menos 1 empresa para este usuário acessar.");
      return;
    }
    try {
      const targetUserId = formUsuario.id || `usr_${Date.now()}`;
      await salvarUsuario({
        id: targetUserId,
        nome: formUsuario.nome.trim(),
        email: formUsuario.email.trim(),
        senha: formUsuario.senha,
        status: formUsuario.status,
        papel: formUsuario.papel,
        empresaIds: formUsuario.empresaIds,
        empresaAtivaId: formUsuario.empresaIds[0] ?? "",
      });

      // Se for revendedor, garante que existe o ponto de revenda correspondente
      if (formUsuario.papel === "revendedor") {
        const existeRev = revendedoras.find(
          (r) =>
            (r.usuario_id && r.usuario_id === targetUserId) ||
            (r.email && r.email.toLowerCase() === formUsuario.email.trim().toLowerCase()) ||
            r.nome.toLowerCase() === formUsuario.nome.trim().toLowerCase()
        );
        if (!existeRev) {
          await salvarRevendedora.mutateAsync({
            id: `rev_${Date.now()}`,
            nome: formUsuario.nome.trim(),
            email: formUsuario.email.trim(),
            usuario_id: targetUserId,
            telefone: null,
            tipo_comissao: "porcentagem",
            comissao_percentual: 10,
            comissao_fixa: null,
            categoria_parceria: "revendedor",
            observacoes: "Ponto de revenda criado via controle de acesso",
          });
        }
      }

      toast.success(
        usuarioEditando
          ? "Usuário e permissões atualizados!"
          : "Novo usuário criado com acesso liberado!"
      );
      setModalUsuario(false);
    } catch {
      toast.error("Erro ao salvar usuário.");
    }
  };

  // Alterar Status com 1 clique (Aprovar / Bloquear)
  const alternarStatusRapido = async (u: Usuario) => {
    let novo: StatusUsuario = "ativo";
    if (u.status === "ativo") novo = "bloqueado";
    else if (u.status === "bloqueado" || u.status === "pendente") novo = "ativo";

    try {
      await toggleStatusUsuario({ usuarioId: u.id, novoStatus: novo });
      if (novo === "ativo") {
        toast.success(`Acesso liberado para ${u.nome}!`);
      } else {
        toast.warning(`Acesso bloqueado para ${u.nome}.`);
      }
    } catch {
      toast.error("Erro ao alterar permissão do usuário.");
    }
  };

  // Abrir Modal Empresa
  const abrirModalNovaEmpresa = () => {
    setEmpresaEditando(null);
    setFormEmpresa({
      nome: "",
      documento: "",
      plano: "Pro",
      status: "ativa",
    });
    setModalEmpresa(true);
  };

  const abrirModalEditarEmpresa = (e: Empresa) => {
    setEmpresaEditando(e);
    setFormEmpresa({
      id: e.id,
      nome: e.nome,
      documento: e.documento,
      plano: e.plano,
      status: e.status,
    });
    setModalEmpresa(true);
  };

  const submitEmpresa = async () => {
    if (!formEmpresa.nome.trim()) {
      toast.error("Preencha o nome da empresa.");
      return;
    }
    try {
      await salvarEmpresa({
        ...(formEmpresa.id ? { id: formEmpresa.id } : {}),
        nome: formEmpresa.nome,
        documento: formEmpresa.documento,
        plano: formEmpresa.plano,
        status: formEmpresa.status,
      });
      toast.success(
        empresaEditando ? "Empresa atualizada!" : "Nova empresa cadastrada!"
      );
      setModalEmpresa(false);
    } catch {
      toast.error("Erro ao salvar empresa.");
    }
  };

  const toggleEmpresaNoFormUsuario = (empId: string) => {
    const atuais = formUsuario.empresaIds || [];
    if (atuais.includes(empId)) {
      if (atuais.length === 1) {
        toast.info("O usuário deve manter ao menos uma empresa selecionada.");
        return;
      }
      setFormUsuario({
        ...formUsuario,
        empresaIds: atuais.filter((id) => id !== empId),
      });
    } else {
      setFormUsuario({
        ...formUsuario,
        empresaIds: [...atuais, empId],
      });
    }
  };

  const getBadgePapel = (papel: PapelUsuario) => {
    switch (papel) {
      case "super_admin":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">👑 Master Admin</span>;
      case "admin":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">🛡️ Admin Empresa</span>;
      case "revendedor":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">🏪 Revendedor (PDV)</span>;
      case "operador":
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">👤 Operador</span>;
    }
  };

  const getBadgeStatus = (status: StatusUsuario) => {
    switch (status) {
      case "ativo":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="size-3" /> Acesso Liberado
          </span>
        );
      case "pendente":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Clock className="size-3" /> Aguardando Liberação
          </span>
        );
      case "bloqueado":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <XCircle className="size-3" /> Acesso Bloqueado
          </span>
        );
    }
  };

  return (
    <Estrutura
      titulo="Controle de Acesso & Gestão Comercial (SaaS)"
      subtitulo="Cadastre usuários, libere acessos e atribua permissões por empresa contratante"
    >
      <div className="space-y-6">
        {/* CARDS DE RESUMO KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total de Usuários</p>
              <p className="font-display text-2xl font-bold mt-1">{totalUsuarios}</p>
            </div>
            <div className="size-11 rounded-2xl bg-brand/10 grid place-items-center text-brand">
              <Users className="size-5" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Acessos Liberados</p>
              <p className="font-display text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {totalAtivos}
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-emerald-500/10 grid place-items-center text-emerald-600 dark:text-emerald-400">
              <UserCheck className="size-5" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pendentes de Aprovação</p>
              <p className="font-display text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {totalPendentes}
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-amber-500/10 grid place-items-center text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Empresas Cadastradas</p>
              <p className="font-display text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                {totalEmpresas}
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-purple-500/10 grid place-items-center text-purple-600 dark:text-purple-400">
              <Building2 className="size-5" />
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO ENTRE ABAS + BOTÃO DE AÇÃO ENCAIXADO AO LADO */}
        <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as "usuarios" | "empresas")} className="w-full">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <TabsList className="glass-panel p-1 rounded-2xl h-11 w-full sm:w-auto inline-flex">
              <TabsTrigger value="usuarios" className="rounded-xl font-semibold text-xs sm:text-sm px-4 gap-2">
                <Users className="size-4" /> Usuários ({listaUsuarios.length})
              </TabsTrigger>
              <TabsTrigger value="empresas" className="rounded-xl font-semibold text-xs sm:text-sm px-4 gap-2">
                <Building2 className="size-4" /> Empresas ({listaEmpresas.length})
              </TabsTrigger>
            </TabsList>

            <Button
              onClick={abaAtiva === "usuarios" ? abrirModalNovoUsuario : abrirModalNovaEmpresa}
              className="rounded-2xl gap-2 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/20 px-5 h-11 shrink-0"
            >
              {abaAtiva === "usuarios" ? (
                <>
                  <UserPlus className="size-4" /> Novo Usuário
                </>
              ) : (
                <>
                  <Building2 className="size-4" /> Nova Empresa
                </>
              )}
            </Button>
          </div>

          {/* TAB 1: GESTÃO DE USUÁRIOS */}
          <TabsContent value="usuarios" className="space-y-4 mt-4">
            {/* FILTROS E BARRA DE BUSCA */}
            <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou e-mail..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 rounded-xl h-10 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="ativo">Liberados (Ativos)</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="bloqueado">Bloqueados</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                  <SelectTrigger className="w-full sm:w-52 h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="todas">Todas as Empresas</SelectItem>
                    {listaEmpresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* LISTA DE USUÁRIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {usuariosFiltrados.map((u) => {
                const empresasDoUsuario = listaEmpresas.filter((emp) =>
                  u.empresaIds?.includes(emp.id)
                );

                return (
                  <div
                    key={u.id}
                    className="glass-panel p-5 rounded-3xl space-y-4 flex flex-col justify-between hover:border-brand/40 transition-all shadow-sm"
                  >
                    <div className="space-y-3">
                      {/* HEADER DO CARD DO USUÁRIO */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="gradient-brand grid size-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold text-white shadow-md shadow-brand/20">
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate leading-tight">{u.nome}</h3>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground rounded-xl shrink-0"
                          onClick={() => abrirModalEditarUsuario(u)}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                      </div>

                      {/* BADGES E PERMISSÕES */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {getBadgePapel(u.papel)}
                        {getBadgeStatus(u.status)}
                      </div>

                      {/* VÍNCULO DE EMPRESAS PERMITIDAS */}
                      <div className="glass-inset p-3 rounded-2xl space-y-1.5 border border-border/40">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Building2 className="size-3 text-brand" /> Empresas Autorizadas ({empresasDoUsuario.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {empresasDoUsuario.length > 0 ? (
                            empresasDoUsuario.map((emp) => (
                              <span
                                key={emp.id}
                                className="text-[10px] font-medium bg-card border border-border/60 px-2 py-0.5 rounded-lg text-foreground/80 truncate max-w-[180px]"
                              >
                                {emp.nome}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] italic text-muted-foreground">Nenhuma empresa atribuída</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* RODAPÉ DO CARD: BOTÃO DE LIBERAÇÃO RÁPIDA DE ACESSO */}
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-muted-foreground">
                        Senha: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">{u.senha}</code>
                      </div>

                      <div className="flex items-center gap-1">
                        {u.id !== usuarioLogado?.id ? (
                          <>
                            <Button
                              variant={u.status === "ativo" ? "outline" : "default"}
                              size="sm"
                              className={cn(
                                "h-8 text-xs rounded-xl gap-1.5 font-medium transition-all",
                                u.status === "ativo"
                                  ? "text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:border-rose-900"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                              )}
                              onClick={() => alternarStatusRapido(u)}
                            >
                              {u.status === "ativo" ? (
                                <>
                                  <UserX className="size-3.5" /> Bloquear
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="size-3.5" /> Liberar Acesso
                                </>
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive rounded-xl"
                              onClick={() => {
                                apagarUsuario(u.id);
                                toast.success(`Usuário ${u.nome} removido.`);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-brand font-medium italic px-2 py-1 bg-brand/10 rounded-xl">
                            (Seu Usuário Ativo)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {usuariosFiltrados.length === 0 && (
                <div className="col-span-full glass-panel p-8 text-center rounded-3xl space-y-3">
                  <ShieldAlert className="size-10 text-muted-foreground mx-auto" />
                  <p className="font-semibold text-base">Nenhum usuário encontrado</p>
                  <p className="text-xs text-muted-foreground">
                    Tente ajustar o termo de busca ou os filtros de status/empresa.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: GESTÃO DE EMPRESAS / TENANTS */}
          <TabsContent value="empresas" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {listaEmpresas.map((emp) => {
                const usuariosComAcesso = listaUsuarios.filter((u) =>
                  u.empresaIds?.includes(emp.id)
                );

                return (
                  <div
                    key={emp.id}
                    className="glass-panel p-5 rounded-3xl space-y-4 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-12 rounded-2xl bg-purple-500/10 grid place-items-center text-purple-600 dark:text-purple-400 font-bold shrink-0">
                            <Building2 className="size-6" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate leading-tight">{emp.nome}</h3>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{emp.documento}</p>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground rounded-xl shrink-0"
                          onClick={() => abrirModalEditarEmpresa(emp)}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          Plano {emp.plano}
                        </span>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                            emp.status === "ativa"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                          )}
                        >
                          {emp.status === "ativa" ? "Conta Ativa" : "Suspensa"}
                        </span>
                      </div>

                      <div className="glass-inset p-3 rounded-2xl space-y-1.5 border border-border/40">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Usuários Com Acesso ({usuariosComAcesso.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {usuariosComAcesso.map((u) => (
                            <span
                              key={u.id}
                              className="text-[10px] bg-card border border-border/60 px-2 py-0.5 rounded-md font-medium text-foreground/80"
                            >
                              {u.nome.split(" ")[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Cadastrada em {new Date(emp.criadaEm).toLocaleDateString("pt-BR")}</span>
                      {listaEmpresas.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive rounded-xl"
                          onClick={() => {
                            apagarEmpresa(emp.id);
                            toast.success(`Empresa ${emp.nome} removida.`);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* MODAL CADASTRAR / EDITAR USUÁRIO & PERMISSÕES MULTI-EMPRESA */}
        <Dialog open={modalUsuario} onOpenChange={setModalUsuario}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {usuarioEditando ? "Editar Usuário & Permissões" : "Novo Usuário (Liberação de Acesso)"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Defina os dados de login, status de liberação e escolha exatamente a quais empresas o usuário terá acesso.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="usr-nome-form" className="text-xs font-semibold">Nome Completo</Label>
                <Input
                  id="usr-nome-form"
                  placeholder="Ex: Maria Clara Atendente"
                  value={formUsuario.nome}
                  onChange={(e) => setFormUsuario({ ...formUsuario, nome: e.target.value })}
                  className="rounded-xl text-xs h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="usr-email-form" className="text-xs font-semibold">E-mail de Login</Label>
                  <Input
                    id="usr-email-form"
                    type="email"
                    placeholder="maria@empresa.com"
                    value={formUsuario.email}
                    onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })}
                    className="rounded-xl text-xs h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="usr-senha-form" className="text-xs font-semibold">Senha de Acesso</Label>
                  <Input
                    id="usr-senha-form"
                    type="text"
                    placeholder="123"
                    value={formUsuario.senha}
                    onChange={(e) => setFormUsuario({ ...formUsuario, senha: e.target.value })}
                    className="rounded-xl text-xs h-10 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Status do Acesso</Label>
                  <Select
                    value={formUsuario.status}
                    onValueChange={(v) => setFormUsuario({ ...formUsuario, status: v as StatusUsuario })}
                  >
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="ativo">🟢 Ativo (Liberado)</SelectItem>
                      <SelectItem value="pendente">🟡 Pendente (Em análise)</SelectItem>
                      <SelectItem value="bloqueado">🔴 Bloqueado (Negado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nível de Permissão (Papel)</Label>
                  <Select
                    value={formUsuario.papel}
                    onValueChange={(v) => setFormUsuario({ ...formUsuario, papel: v as PapelUsuario })}
                  >
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="super_admin">👑 Master Admin (Dono SaaS)</SelectItem>
                      <SelectItem value="admin">🛡️ Admin Empresa</SelectItem>
                      <SelectItem value="operador">👤 Operador (Atendente)</SelectItem>
                      <SelectItem value="revendedor">🏪 Revendedor (Apenas Vendas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* SELEÇÃO MULTI-EMPRESA */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-brand" /> Empresas que este usuário pode acessar:
                </Label>
                <div className="glass-inset p-3 rounded-2xl space-y-2 border border-border/50 max-h-40 overflow-y-auto">
                  {listaEmpresas.map((emp) => {
                    const selecionada = formUsuario.empresaIds?.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        onClick={() => toggleEmpresaNoFormUsuario(emp.id)}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all",
                          selecionada
                            ? "bg-brand/10 border-brand/40 text-brand"
                            : "bg-card/50 border-border/40 text-muted-foreground hover:bg-card"
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-xs truncate">{emp.nome}</p>
                          <p className="text-[10px] opacity-75">{emp.documento}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={selecionada}
                          onChange={() => {}}
                          className="size-4 rounded accent-brand"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" className="rounded-2xl" onClick={() => setModalUsuario(false)}>
                Cancelar
              </Button>
              <Button className="rounded-2xl" onClick={submitUsuario}>
                Salvar Usuário & Liberações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL CADASTRAR / EDITAR EMPRESA */}
        <Dialog open={modalEmpresa} onOpenChange={setModalEmpresa}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {empresaEditando ? "Editar Empresa" : "Cadastrar Nova Empresa (Tenant)"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Cadastre novas contratantes do sistema, definindo documento e plano de assinatura.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-nome-form" className="text-xs font-semibold">Nome da Empresa / Filial</Label>
                <Input
                  id="emp-nome-form"
                  placeholder="Ex: Confeitaria Doce Mel"
                  value={formEmpresa.nome}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, nome: e.target.value })}
                  className="rounded-xl text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-doc-form" className="text-xs font-semibold">Documento (CNPJ / CPF)</Label>
                <Input
                  id="emp-doc-form"
                  placeholder="12.345.678/0001-90"
                  value={formEmpresa.documento}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, documento: e.target.value })}
                  className="rounded-xl text-xs h-10 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Plano de Assinatura</Label>
                  <Select
                    value={formEmpresa.plano}
                    onValueChange={(v) => setFormEmpresa({ ...formEmpresa, plano: v as "Starter" | "Pro" | "Enterprise" })}
                  >
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="Starter">Starter (Básico)</SelectItem>
                      <SelectItem value="Pro">Pro (Profissional)</SelectItem>
                      <SelectItem value="Enterprise">Enterprise (Completo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Status da Conta</Label>
                  <Select
                    value={formEmpresa.status}
                    onValueChange={(v) => setFormEmpresa({ ...formEmpresa, status: v as "ativa" | "suspensa" })}
                  >
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="ativa">🟢 Conta Ativa</SelectItem>
                      <SelectItem value="suspensa">🔴 Suspensa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" className="rounded-2xl" onClick={() => setModalEmpresa(false)}>
                Cancelar
              </Button>
              <Button className="rounded-2xl" onClick={submitEmpresa}>
                Salvar Empresa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Estrutura>
  );
}
