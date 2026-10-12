import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PapelUsuario = "super_admin" | "admin" | "operador" | "revendedor";
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

const CHAVE_USUARIOS = "meu-atelie-usuarios-v9";
const CHAVE_EMPRESAS = "meu-atelie-empresas-v8";
const CHAVE_SESSAO = "meu-atelie-sessao-v11";

const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const empresasIniciais: Empresa[] = [
  {
    id: "emp_matriz",
    nome: "Meu Ateliê",
    documento: "12.345.678/0001-90",
    plano: "Pro",
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
    papel: "super_admin",
    empresaIds: ["emp_matriz"],
    empresaAtivaId: "emp_matriz",
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
    const list = JSON.parse(salvo) as Usuario[];
    let precisaGravar = false;
    list.forEach((u) => {
      if (
        u.id === "usr_dono" ||
        u.id === "usr_master" ||
        u.email?.trim().toLowerCase() === "camila.c.lima08@gmail.com"
      ) {
        if (u.papel !== "super_admin") {
          u.papel = "super_admin";
          precisaGravar = true;
        }
      }
    });
    if (precisaGravar) {
      gravarUsuarios(list);
    }
    return list;
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
  if (typeof window === "undefined") return null;
  const salvo = localStorage.getItem(CHAVE_SESSAO);
  if (!salvo || salvo === "deslogado") {
    return null;
  }
  try {
    const sessao = (JSON.parse(salvo) as Usuario) ?? null;
    if (!sessao || !sessao.id) return null;
    if (
      sessao.email?.trim().toLowerCase() === "camila.c.lima08@gmail.com" ||
      sessao.id === "usr_dono" ||
      sessao.id === "usr_master"
    ) {
      if (sessao.papel !== "super_admin") {
        sessao.papel = "super_admin";
        localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      }
    } else if (!sessao.papel) {
      sessao.papel = "admin";
    }
    return sessao;
  } catch {
    return null;
  }
}

export function gravarSessao(u: Usuario | null) {
  if (typeof window !== "undefined") {
    if (u) {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(u));
    } else {
      localStorage.setItem(CHAVE_SESSAO, "deslogado");
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
    initialData: () => lerSessao(),
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
      if (
        achado.id === "usr_dono" ||
        achado.id === "usr_master" ||
        achado.email.trim().toLowerCase() === "camila.c.lima08@gmail.com"
      ) {
        achado.papel = "super_admin";
      }
      achado.ultimoAcesso = new Date().toISOString();
      gravarSessao(achado);
      return achado;
    },
    onSuccess: (dadosUser) => {
      qc.setQueryData(CHAVE_AUTH_QUERY, dadosUser);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      gravarSessao(null);
    },
    onSuccess: () => {
      qc.setQueryData(CHAVE_AUTH_QUERY, null);
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
      // REGRA DE SEGURANÇA: Dono do sistema (Camila Lima) NUNCA perde privilégio de admin
      if (item.id === "usr_dono" || item.email.trim().toLowerCase() === "camila.c.lima08@gmail.com") {
        item.papel = "admin";
      }

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
      if (novoPapel === "admin" || novoPapel === "revendedor") {
        sessaoAtual.empresaAtivaId = listaEmpresas[0]?.id ?? "emp_1";
        sessaoAtual.empresaIds = [listaEmpresas[0]?.id ?? "emp_1"];
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

  const ehDonoMaster =
    usuario?.id === "usr_dono" ||
    usuario?.id === "usr_master" ||
    usuario?.email?.trim().toLowerCase() === "camila.c.lima08@gmail.com";
  const ehSuperAdmin = usuario?.papel === "super_admin" || ehDonoMaster;
  const ehAdmin = ehSuperAdmin || usuario?.papel === "admin";

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

  // Revendedor: Acesso às telas de Vendas e Gestão de Clientes
  if (papel === "revendedor") {
    return rota === "/vendas" || rota === "/clientes";
  }

  // Super Admin ou Admin: Acesso total a todas as rotas operacionais e estratégicas
  if (papel === "super_admin" || papel === "admin") return true;

  // Operador só pode acessar Painel, Vendas, Produtos, Estoque, Clientes
  const rotasRestritasOperador = ["/receitas", "/relatorios", "/usuarios"];
  return !rotasRestritasOperador.includes(rota);
}

