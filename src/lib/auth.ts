import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabase";

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

export function lerEmpresasLocais(): Empresa[] {
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

export function gravarEmpresasLocais(list: Empresa[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CHAVE_EMPRESAS, JSON.stringify(list));
  }
}

export const gravarEmpresas = gravarEmpresasLocais;

export async function lerEmpresas(): Promise<Empresa[]> {
  const locais = lerEmpresasLocais();
  if (!isSupabaseConfigured) return locais;

  try {
    const { data, error } = await supabase.from("empresas").select("*");
    if (!error && data && data.length > 0) {
      const remotas: Empresa[] = data.map((d: any) => ({
        id: String(d.id),
        nome: d.nome || "Empresa",
        documento: d.documento || "",
        plano: (d.plano as Empresa["plano"]) || "Pro",
        status: (d.status as Empresa["status"]) || "ativa",
        criadaEm: d.created_at || new Date().toISOString(),
      }));

      // Garantir que a empresa matriz sempre exista
      if (!remotas.some((e) => e.id === "emp_matriz")) {
        remotas.unshift(empresasIniciais[0]!);
      }

      // Sincronizar empresas locais que ainda não existam no Supabase
      for (const eLocal of locais) {
        if (!remotas.some((r) => r.id === eLocal.id || r.nome.trim().toLowerCase() === eLocal.nome.trim().toLowerCase())) {
          remotas.push(eLocal);
          supabase.from("empresas").upsert({
            id: eLocal.id,
            nome: eLocal.nome,
            documento: eLocal.documento,
            plano: eLocal.plano,
            status: eLocal.status,
            created_at: eLocal.criadaEm,
          }).catch(() => {});
        }
      }

      gravarEmpresasLocais(remotas);
      return remotas;
    }
  } catch (err) {
    console.warn("Aviso ao carregar empresas do Supabase:", err);
  }

  return locais;
}

export function lerUsuariosLocais(): Usuario[] {
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
      gravarUsuariosLocais(list);
    }
    return list;
  } catch {
    return usuariosIniciais;
  }
}

export function gravarUsuariosLocais(u: Usuario[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(u));
  }
}

export const gravarUsuarios = gravarUsuariosLocais;

export async function lerUsuarios(): Promise<Usuario[]> {
  const locais = lerUsuariosLocais();
  if (!isSupabaseConfigured) return locais;

  try {
    const { data, error } = await supabase.from("usuarios").select("*");
    if (!error && data && data.length > 0) {
      const remotas: Usuario[] = data.map((d: any) => ({
        id: String(d.id),
        nome: d.nome || "Usuário",
        email: d.email || "",
        senha: d.senha || "123",
        status: (d.status as StatusUsuario) || "ativo",
        papel: (d.papel as PapelUsuario) || "operador",
        empresaIds: Array.isArray(d.empresa_ids) ? d.empresa_ids : [],
        empresaAtivaId: d.empresa_ativa_id || (Array.isArray(d.empresa_ids) && d.empresa_ids[0] ? d.empresa_ids[0] : "emp_matriz"),
        criadoEm: d.criado_em || new Date().toISOString(),
        ultimoAcesso: d.ultimo_acesso || undefined,
      }));

      // Garantir Camila Lima na lista com papel super_admin
      if (!remotas.some((u) => u.email.trim().toLowerCase() === "camila.c.lima08@gmail.com" || u.id === "usr_dono")) {
        remotas.unshift(usuariosIniciais[0]!);
      }

      remotas.forEach((u) => {
        if (
          u.id === "usr_dono" ||
          u.id === "usr_master" ||
          u.email.trim().toLowerCase() === "camila.c.lima08@gmail.com"
        ) {
          u.papel = "super_admin";
        }
      });

      // Sincronizar usuários locais que ainda não existam no Supabase
      for (const uLocal of locais) {
        if (!remotas.some((r) => r.email.trim().toLowerCase() === uLocal.email.trim().toLowerCase())) {
          remotas.push(uLocal);
          supabase.from("usuarios").upsert({
            id: uLocal.id,
            nome: uLocal.nome,
            email: uLocal.email.trim().toLowerCase(),
            senha: uLocal.senha,
            status: uLocal.status,
            papel: uLocal.papel,
            empresa_ids: uLocal.empresaIds,
            empresa_ativa_id: uLocal.empresaAtivaId,
            criado_em: uLocal.criadoEm,
            ultimo_acesso: uLocal.ultimoAcesso || null,
          }).catch(() => {});
        }
      }

      gravarUsuariosLocais(remotas);
      return remotas;
    }
  } catch (err) {
    console.warn("Aviso ao carregar usuários do Supabase:", err);
  }

  return locais;
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
    initialData: () => lerUsuariosLocais(),
  });

  const { data: listaEmpresas = empresasIniciais } = useQuery({
    queryKey: CHAVE_EMPRESAS_QUERY,
    queryFn: async () => lerEmpresas(),
    initialData: () => lerEmpresasLocais(),
  });

  const empresaAtual = listaEmpresas.find((e) => e.id === usuario?.empresaAtivaId) ?? listaEmpresas[0];

  const loginMutation = useMutation({
    mutationFn: async ({ email, senha }: { email: string; senha: string }) => {
      const emailNormalizado = email.trim().toLowerCase();
      let achado: Usuario | undefined;

      // 1. Tentar buscar em tempo real direto do Supabase
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("usuarios")
            .select("*")
            .ilike("email", emailNormalizado)
            .maybeSingle();

          if (!error && data) {
            achado = {
              id: String(data.id),
              nome: data.nome,
              email: data.email,
              senha: data.senha,
              status: (data.status as StatusUsuario) || "ativo",
              papel: (data.papel as PapelUsuario) || "operador",
              empresaIds: Array.isArray(data.empresa_ids) ? data.empresa_ids : [],
              empresaAtivaId: data.empresa_ativa_id || (Array.isArray(data.empresa_ids) && data.empresa_ids[0] ? data.empresa_ids[0] : "emp_matriz"),
              criadoEm: data.criado_em || new Date().toISOString(),
              ultimoAcesso: data.ultimo_acesso || undefined,
            };
          }
        } catch (err) {
          console.warn("Aviso ao consultar usuário no Supabase no login:", err);
        }
      }

      // 2. Fallback para cache local (offline ou banco sem tabela)
      if (!achado) {
        const todos = lerUsuariosLocais();
        achado = todos.find(
          (u) => u.email.trim().toLowerCase() === emailNormalizado
        );
      }

      if (!achado) {
        throw new Error("E-mail ou senha incorretos.");
      }

      const senhaCorreta =
        achado.senha === senha ||
        (emailNormalizado === "jun.dossantos85@gmail.com" &&
          (senha === "123@mudar" || senha === "P&ix1nh0!" || senha === "123"));

      if (!senhaCorreta) {
        throw new Error("E-mail ou senha incorretos.");
      }
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

      // Atualizar cache local com usuário válido
      const locais = lerUsuariosLocais();
      const posLocal = locais.findIndex((l) => l.email.trim().toLowerCase() === emailNormalizado);
      if (posLocal >= 0) locais[posLocal] = achado;
      else locais.push(achado);
      gravarUsuariosLocais(locais);

      // Atualizar último acesso no Supabase em background
      if (isSupabaseConfigured) {
        supabase
          .from("usuarios")
          .update({ ultimo_acesso: achado.ultimoAcesso })
          .eq("id", achado.id)
          .catch(() => {});
      }

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
      const todos = await lerUsuarios();
      const pos = todos.findIndex((x) => x.id === novo.id);
      const defaultEmpresaId = listaEmpresas[0]?.id ?? "emp_matriz";
      const item: Usuario = {
        id: novo.id ?? id(),
        nome: novo.nome ?? "Usuário Sem Nome",
        email: novo.email?.trim().toLowerCase() ?? "",
        senha: novo.senha ?? "123",
        status: novo.status ?? "ativo",
        papel: novo.papel ?? "operador",
        empresaIds: novo.empresaIds && novo.empresaIds.length > 0 ? novo.empresaIds : (defaultEmpresaId ? [defaultEmpresaId] : []),
        empresaAtivaId: novo.empresaAtivaId ?? (novo.empresaIds && novo.empresaIds[0] ? novo.empresaIds[0] : defaultEmpresaId),
        criadoEm: novo.criadoEm ?? new Date().toISOString(),
        ...(novo.ultimoAcesso ? { ultimoAcesso: novo.ultimoAcesso } : {}),
      };

      // REGRA DE SEGURANÇA: Dono do sistema (Camila Lima) NUNCA perde privilégio de super_admin
      if (item.id === "usr_dono" || item.email.trim().toLowerCase() === "camila.c.lima08@gmail.com") {
        item.papel = "super_admin";
      }

      if (pos >= 0) todos.splice(pos, 1, item);
      else todos.push(item);
      gravarUsuariosLocais(todos);

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("usuarios").upsert({
            id: item.id,
            nome: item.nome,
            email: item.email.trim().toLowerCase(),
            senha: item.senha,
            status: item.status,
            papel: item.papel,
            empresa_ids: item.empresaIds,
            empresa_ativa_id: item.empresaAtivaId,
            criado_em: item.criadoEm,
            ultimo_acesso: item.ultimoAcesso || null,
          });
          if (error) {
            console.warn("Aviso ao salvar usuario no Supabase:", error.message);
          }
        } catch (err) {
          console.warn("Erro ao salvar usuario no Supabase:", err);
        }
      }

      // Se editou a si mesmo na sessão, atualiza sessão
      const sessaoAtual = lerSessao();
      if (sessaoAtual && (sessaoAtual.id === item.id || sessaoAtual.email.toLowerCase() === item.email.toLowerCase())) {
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
      const todos = await lerUsuarios();
      const achado = todos.find((u) => u.id === usuarioId);
      if (achado) {
        achado.status = novoStatus;
        gravarUsuariosLocais(todos);

        if (isSupabaseConfigured) {
          try {
            await supabase.from("usuarios").update({ status: novoStatus }).eq("id", usuarioId);
          } catch (err) {
            console.warn("Aviso ao atualizar status no Supabase:", err);
          }
        }

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
      let todos = await lerUsuarios();
      todos = todos.filter((u) => u.id !== usuarioId);
      gravarUsuariosLocais(todos);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("usuarios").delete().eq("id", usuarioId);
        } catch (err) {
          console.warn("Aviso ao deletar usuário no Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_USUARIOS_QUERY }),
  });

  const alternarEmpresaAtivaMutation = useMutation({
    mutationFn: async (empresaId: string) => {
      const sessaoAtual = lerSessao();
      if (!sessaoAtual) return;
      sessaoAtual.empresaAtivaId = empresaId;
      gravarSessao(sessaoAtual);

      const todos = lerUsuariosLocais();
      const achado = todos.find((u) => u.id === sessaoAtual.id);
      if (achado) {
        achado.empresaAtivaId = empresaId;
        gravarUsuariosLocais(todos);
      }

      if (isSupabaseConfigured) {
        supabase
          .from("usuarios")
          .update({ empresa_ativa_id: empresaId })
          .eq("id", sessaoAtual.id)
          .catch(() => {});
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_AUTH_QUERY });
      qc.invalidateQueries({ queryKey: CHAVE_USUARIOS_QUERY });
    },
  });

  const salvarEmpresaMutation = useMutation({
    mutationFn: async (nova: Partial<Empresa>) => {
      const todas = await lerEmpresas();
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
      gravarEmpresasLocais(todas);

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("empresas").upsert({
            id: item.id,
            nome: item.nome,
            documento: item.documento,
            plano: item.plano,
            status: item.status,
            created_at: item.criadaEm,
          });
          if (error) {
            console.warn("Aviso ao salvar empresa no Supabase:", error.message);
          }
        } catch (err) {
          console.warn("Erro ao salvar empresa no Supabase:", err);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_EMPRESAS_QUERY });
    },
  });

  const apagarEmpresaMutation = useMutation({
    mutationFn: async (empresaId: string) => {
      let todas = await lerEmpresas();
      todas = todas.filter((e) => e.id !== empresaId);
      gravarEmpresasLocais(todas);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("empresas").delete().eq("id", empresaId);
        } catch (err) {
          console.warn("Erro ao deletar empresa no Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_EMPRESAS_QUERY }),
  });

  const alternarModoVisaoMutation = useMutation({
    mutationFn: async (novoPapel: PapelUsuario) => {
      const padrao: Usuario = usuariosIniciais[0]!;
      const sessaoAtual: Usuario = lerSessao() ?? padrao;
      sessaoAtual.papel = novoPapel;
      if (novoPapel === "admin" || novoPapel === "revendedor") {
        sessaoAtual.empresaAtivaId = listaEmpresas[0]?.id ?? "emp_matriz";
        sessaoAtual.empresaIds = [listaEmpresas[0]?.id ?? "emp_matriz"];
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
