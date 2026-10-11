import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PapelUsuario = "super_admin" | "admin" | "operador";
export type StatusUsuario = "ativo" | "bloqueado" | "pendente";

export type Empresa = {
  id: string;
  nome: string;
  documento: string; // CNPJ ou CPF
  plano: "Starter" | "Pro" | "Enterprise";
  status: "ativa" | "suspensa";
  criadaEm: string;
};

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  senha: string;
  status: StatusUsuario;
  papel: PapelUsuario;
  empresaIds: string[]; // Empresas a que este usuário tem acesso
  empresaAtivaId: string; // Empresa selecionada atualmente
  criadoEm: string;
  ultimoAcesso?: string;
};

const CHAVE_USUARIOS = "meu-atelie-usuarios-v3";
const CHAVE_EMPRESAS = "meu-atelie-empresas-v3";
const CHAVE_SESSAO = "meu-atelie-sessao-v3";

const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const empresasIniciais: Empresa[] = [
  {
    id: "emp_matriz",
    nome: "Ateliê Gourmet (Matriz)",
    documento: "12.345.678/0001-90",
    plano: "Enterprise",
    status: "ativa",
    criadaEm: new Date("2024-01-15").toISOString(),
  },
  {
    id: "emp_filial_centro",
    nome: "Confeitaria Doce Arte (Filial Centro)",
    documento: "98.765.432/0001-10",
    plano: "Pro",
    status: "ativa",
    criadaEm: new Date("2024-05-20").toISOString(),
  },
  {
    id: "emp_gourmet",
    nome: "Padaria & Doces Premium",
    documento: "45.678.901/0001-23",
    plano: "Starter",
    status: "ativa",
    criadaEm: new Date("2024-08-10").toISOString(),
  },
];

export const usuariosIniciais: Usuario[] = [
  {
    id: "usr_super",
    nome: "Camila Lima",
    email: "camila.c.lima08@gmail.com",
    senha: "P&ix1nh0!",
    status: "ativo",
    papel: "super_admin",
    empresaIds: ["emp_matriz"],
    empresaAtivaId: "emp_matriz",
    criadoEm: new Date().toISOString(),
    ultimoAcesso: new Date().toISOString(),
  },
];

export function lerEmpresas(): Empresa[] {
  if (typeof window === "undefined") return empresasIniciais;
  const salvo = localStorage.getItem(CHAVE_EMPRESAS);
  if (!salvo) {
    localStorage.setItem(CHAVE_EMPRESAS, JSON.stringify(empresasIniciais));
    return empresasIniciais;
  }
  try {
    return JSON.parse(salvo) as Empresa[];
  } catch {
    return empresasIniciais;
  }
}

export function gravarEmpresas(list: Empresa[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CHAVE_EMPRESAS, JSON.stringify(list));
  }
}

export function lerUsuarios(): Usuario[] {
  if (typeof window === "undefined") return usuariosIniciais;
  const salvo = localStorage.getItem(CHAVE_USUARIOS);
  if (!salvo) {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuariosIniciais));
    return usuariosIniciais;
  }
  try {
    return JSON.parse(salvo) as Usuario[];
  } catch {
    return usuariosIniciais;
  }
}

export function gravarUsuarios(u: Usuario[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(u));
  }
}

export function lerSessao(): Usuario | null {
  if (typeof window === "undefined") return usuariosIniciais[0] ?? null;
  const salvo = localStorage.getItem(CHAVE_SESSAO);
  if (!salvo) {
    const padrao = usuariosIniciais[0] ?? null;
    if (padrao) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(padrao));
    return padrao;
  }
  try {
    return (JSON.parse(salvo) as Usuario) ?? usuariosIniciais[0] ?? null;
  } catch {
    return usuariosIniciais[0] ?? null;
  }
}

export function gravarSessao(u: Usuario | null) {
  if (typeof window !== "undefined") {
    if (u) {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(u));
    } else {
      localStorage.removeItem(CHAVE_SESSAO);
    }
  }
}

export const CHAVE_AUTH_QUERY = ["auth_sessao"] as const;
export const CHAVE_USUARIOS_QUERY = ["auth_usuarios"] as const;
export const CHAVE_EMPRESAS_QUERY = ["auth_empresas"] as const;

export function useAuth() {
  const qc = useQueryClient();

  const { data: usuario = usuariosIniciais[0] } = useQuery({
    queryKey: CHAVE_AUTH_QUERY,
    queryFn: async () => lerSessao(),
    initialData: usuariosIniciais[0],
  });

  const { data: listaUsuarios = usuariosIniciais } = useQuery({
    queryKey: CHAVE_USUARIOS_QUERY,
    queryFn: async () => lerUsuarios(),
    initialData: usuariosIniciais,
  });

  const { data: listaEmpresas = empresasIniciais } = useQuery({
    queryKey: CHAVE_EMPRESAS_QUERY,
    queryFn: async () => lerEmpresas(),
    initialData: empresasIniciais,
  });

  const empresaAtual = listaEmpresas.find((e) => e.id === usuario?.empresaAtivaId) ?? listaEmpresas[0];

  const loginMutation = useMutation({
    mutationFn: async ({ email, senha }: { email: string; senha: string }) => {
      const todos = lerUsuarios();
      const achado = todos.find(
        (u) => u.email.trim().toLowerCase() === email.trim().toLowerCase() && u.senha === senha
      );
      if (!achado) throw new Error("E-mail ou senha incorretos.");
      if (achado.status === "bloqueado") {
        throw new Error("Este usuário está bloqueado. Entre em contato com o administrador.");
      }
      if (achado.status === "pendente") {
        throw new Error("Aguardando liberação de acesso pelo administrador do sistema.");
      }
      achado.ultimoAcesso = new Date().toISOString();
      gravarSessao(achado);
      return achado;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_AUTH_QUERY }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      gravarSessao(null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_AUTH_QUERY }),
  });

  const salvarUsuarioMutation = useMutation({
    mutationFn: async (novo: Partial<Usuario>) => {
      const todos = lerUsuarios();
      const pos = todos.findIndex((x) => x.id === novo.id);
      const defaultEmpresaId = listaEmpresas[0]?.id ?? "emp_matriz";
      const item: Usuario = {
        id: novo.id ?? id(),
        nome: novo.nome ?? "Usuário Sem Nome",
        email: novo.email ?? "",
        senha: novo.senha ?? "123",
        status: novo.status ?? "ativo",
        papel: novo.papel ?? "operador",
        empresaIds: novo.empresaIds && novo.empresaIds.length > 0 ? novo.empresaIds : [defaultEmpresaId],
        empresaAtivaId: novo.empresaAtivaId ?? (novo.empresaIds && novo.empresaIds[0] ? novo.empresaIds[0] : defaultEmpresaId),
        criadoEm: novo.criadoEm ?? new Date().toISOString(),
        ...(novo.ultimoAcesso ? { ultimoAcesso: novo.ultimoAcesso } : {}),
      };
      if (pos >= 0) todos.splice(pos, 1, item);
      else todos.push(item);
      gravarUsuarios(todos);

      // Se editou a si mesmo na sessão, atualiza sessão
      const sessaoAtual = lerSessao();
      if (sessaoAtual && sessaoAtual.id === item.id) {
        gravarSessao(item);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_USUARIOS_QUERY });
      qc.invalidateQueries({ queryKey: CHAVE_AUTH_QUERY });
    },
  });

  const toggleStatusUsuarioMutation = useMutation({
    mutationFn: async ({ usuarioId, novoStatus }: { usuarioId: string; novoStatus: StatusUsuario }) => {
      const todos = lerUsuarios();
      const achado = todos.find((u) => u.id === usuarioId);
      if (achado) {
        achado.status = novoStatus;
        gravarUsuarios(todos);
        const sessaoAtual = lerSessao();
        if (sessaoAtual && sessaoAtual.id === achado.id) {
          gravarSessao(achado);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_USUARIOS_QUERY });
      qc.invalidateQueries({ queryKey: CHAVE_AUTH_QUERY });
    },
  });

  const apagarUsuarioMutation = useMutation({
    mutationFn: async (usuarioId: string) => {
      let todos = lerUsuarios();
      todos = todos.filter((u) => u.id !== usuarioId);
      gravarUsuarios(todos);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_USUARIOS_QUERY }),
  });

  const alternarEmpresaAtivaMutation = useMutation({
    mutationFn: async (empresaId: string) => {
      const sessaoAtual = lerSessao();
      if (!sessaoAtual) return;
      sessaoAtual.empresaAtivaId = empresaId;
      gravarSessao(sessaoAtual);

      const todos = lerUsuarios();
      const achado = todos.find((u) => u.id === sessaoAtual.id);
      if (achado) {
        achado.empresaAtivaId = empresaId;
        gravarUsuarios(todos);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_AUTH_QUERY });
      qc.invalidateQueries({ queryKey: CHAVE_USUARIOS_QUERY });
    },
  });

  const salvarEmpresaMutation = useMutation({
    mutationFn: async (nova: Partial<Empresa>) => {
      const todas = lerEmpresas();
      const pos = todas.findIndex((x) => x.id === nova.id);
      const item: Empresa = {
        id: nova.id ?? id(),
        nome: nova.nome ?? "Nova Empresa",
        documento: nova.documento ?? "00.000.000/0001-00",
        plano: nova.plano ?? "Pro",
        status: nova.status ?? "ativa",
        criadaEm: nova.criadaEm ?? new Date().toISOString(),
      };
      if (pos >= 0) todas.splice(pos, 1, item);
      else todas.push(item);
      gravarEmpresas(todas);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_EMPRESAS_QUERY });
    },
  });

  const apagarEmpresaMutation = useMutation({
    mutationFn: async (empresaId: string) => {
      let todas = lerEmpresas();
      todas = todas.filter((e) => e.id !== empresaId);
      gravarEmpresas(todas);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_EMPRESAS_QUERY }),
  });

  const ehSuperAdmin = usuario?.papel === "super_admin";
  const ehAdmin = usuario?.papel === "super_admin" || usuario?.papel === "admin";

  return {
    usuario,
    listaUsuarios,
    listaEmpresas,
    empresaAtual,
    ehSuperAdmin,
    ehAdmin,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    salvarUsuario: salvarUsuarioMutation.mutateAsync,
    toggleStatusUsuario: toggleStatusUsuarioMutation.mutateAsync,
    apagarUsuario: apagarUsuarioMutation.mutateAsync,
    alternarEmpresaAtiva: alternarEmpresaAtivaMutation.mutateAsync,
    salvarEmpresa: salvarEmpresaMutation.mutateAsync,
    apagarEmpresa: apagarEmpresaMutation.mutateAsync,
    isPending: loginMutation.isPending || logoutMutation.isPending,
  };
}

export function temPermissaoRota(papel: PapelUsuario | undefined, rota: string): boolean {
  if (!papel) return true;
  if (papel === "super_admin" || papel === "admin") return true;
  // Operador só pode acessar Painel, Vendas, Produtos, Estoque, Clientes
  const rotasRestritasOperador = ["/receitas", "/relatorios", "/usuarios"];
  return !rotasRestritasOperador.includes(rota);
}

