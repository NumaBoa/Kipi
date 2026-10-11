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

const CHAVE_USUARIOS = "meu-atelie-usuarios-v7";
const CHAVE_EMPRESAS = "meu-atelie-empresas-v7";
const CHAVE_SESSAO = "meu-atelie-sessao-v7";

const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const empresasIniciais: Empresa[] = [
  {
    id: "emp_1",
    nome: "Ateliê Gourmet Bella",
    documento: "12.345.678/0001-90",
    plano: "Pro",
    status: "ativa",
    criadaEm: new Date().toISOString(),
  },
  {
    id: "emp_2",
    nome: "Confeitaria Doce Arte",
    documento: "98.765.432/0001-10",
    plano: "Enterprise",
    status: "ativa",
    criadaEm: new Date().toISOString(),
  },
  {
    id: "emp_3",
    nome: "Empório dos Bolos",
    documento: "45.678.901/0001-23",
    plano: "Starter",
    status: "ativa",
    criadaEm: new Date().toISOString(),
  },
];

export const usuariosIniciais: Usuario[] = [
  {
    id: "usr_dono",
    nome: "Camila Lima",
    email: "camila.c.lima08@gmail.com",
    senha: "P&ix1nh0!",
    status: "ativo",
    papel: "admin",
    empresaIds: ["emp_1", "emp_2", "emp_3"],
    empresaAtivaId: "emp_1",
    criadoEm: new Date().toISOString(),
    ultimoAcesso: new Date().toISOString(),
  },
  {
    id: "usr_super",
    nome: "Camila Lima (Master)",
    email: "master@kipi.com.br",
    senha: "P&ix1nh0!",
    status: "ativo",
    papel: "super_admin",
    empresaIds: [],
    empresaAtivaId: "",
    criadoEm: new Date().toISOString(),
    ultimoAcesso: new Date().toISOString(),
  },
];

export function lerEmpresas(): Empresa[] {
  if (typeof window === "undefined") return empresasIniciais;

  // Limpar chaves antigas se existirem
  ["meu-atelie-empresas-v1", "meu-atelie-empresas-v2", "meu-atelie-empresas-v3", "meu-atelie-empresas-v4", "meu-atelie-empresas-v5"].forEach((k) => {
    localStorage.removeItem(k);
  });

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
  const padrao: Usuario = usuariosIniciais[0]!;
  if (typeof window === "undefined") return padrao;
  const salvo = localStorage.getItem(CHAVE_SESSAO);
  if (!salvo) {
    gravarSessao(padrao);
    return padrao;
  }
  try {
    return (JSON.parse(salvo) as Usuario) ?? padrao;
  } catch {
    return padrao;
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

  const { data: usuario = null } = useQuery<Usuario | null>({
    queryKey: CHAVE_AUTH_QUERY,
    queryFn: async () => lerSessao(),
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
    onSuccess: (dadosUser) => {
      qc.setQueryData(CHAVE_AUTH_QUERY, dadosUser);
      qc.invalidateQueries({ queryKey: CHAVE_AUTH_QUERY });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      gravarSessao(null);
    },
    onSuccess: () => {
      qc.setQueryData(CHAVE_AUTH_QUERY, null);
      qc.invalidateQueries({ queryKey: CHAVE_AUTH_QUERY });
    },
  });

  const salvarUsuarioMutation = useMutation({
    mutationFn: async (novo: Partial<Usuario>) => {
      const todos = lerUsuarios();
      const pos = todos.findIndex((x) => x.id === novo.id);
      const defaultEmpresaId = listaEmpresas[0]?.id ?? "";
      const item: Usuario = {
        id: novo.id ?? id(),
        nome: novo.nome ?? "Usuário Sem Nome",
        email: novo.email ?? "",
        senha: novo.senha ?? "123",
        status: novo.status ?? "ativo",
        papel: novo.papel ?? "operador",
        empresaIds: novo.empresaIds && novo.empresaIds.length > 0 ? novo.empresaIds : (defaultEmpresaId ? [defaultEmpresaId] : []),
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

  const alternarModoVisaoMutation = useMutation({
    mutationFn: async (novoPapel: PapelUsuario) => {
      const padrao: Usuario = usuariosIniciais[0]!;
      const sessaoAtual: Usuario = lerSessao() ?? padrao;
      sessaoAtual.papel = novoPapel;
      if (novoPapel === "admin") {
        sessaoAtual.empresaAtivaId = listaEmpresas[0]?.id ?? "emp_1";
        sessaoAtual.empresaIds = ["emp_1", "emp_2", "emp_3"];
      } else {
        sessaoAtual.empresaAtivaId = "";
        sessaoAtual.empresaIds = [];
      }
      gravarSessao(sessaoAtual);
      return sessaoAtual;
    },
    onSuccess: (dadosUser) => {
      qc.setQueryData(CHAVE_AUTH_QUERY, dadosUser);
      qc.invalidateQueries({ queryKey: CHAVE_AUTH_QUERY });
    },
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
    alternarModoVisao: alternarModoVisaoMutation.mutateAsync,
    salvarEmpresa: salvarEmpresaMutation.mutateAsync,
    apagarEmpresa: apagarEmpresaMutation.mutateAsync,
    isPending: loginMutation.isPending || logoutMutation.isPending,
  };
}

export function temPermissaoRota(papel: PapelUsuario | undefined, rota: string): boolean {
  if (!papel) return true;

  // Super Admin (Master Admin do SaaS): apenas visões estratégicas e comerciais da plataforma
  if (papel === "super_admin") {
    const rotasMaster = ["/", "/usuarios", "/relatorios"];
    return rotasMaster.includes(rota);
  }

  // Admin da Empresa: Acessa todas as rotas operacionais do ateliê
  if (papel === "admin") return true;

  // Operador só pode acessar Painel, Vendas, Produtos, Estoque, Clientes
  const rotasRestritasOperador = ["/receitas", "/relatorios", "/usuarios"];
  return !rotasRestritasOperador.includes(rota);
}

