import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// ACESSOS E PERFIS
// - admin: dona do sistema Kipi. Vê só cadastro, plano e cobrança dos ateliês.
// - dona: dona do ateliê. Vê tudo do ateliê dela e nada de outros ateliês.
// - revendedora: vê só os clientes, as vendas e o acerto de contas dela.
// Fase de testes: usuários e ateliês são exemplos em memória, nada vai para o banco.
// No banco, a mesma separação precisa existir nas regras de acesso (RLS),
// porque esconder no app não protege os dados.
// ============================================================================
export type Perfil = 'admin' | 'dona' | 'revendedora';
export type PlanoKipi = 'Essencial' | 'Profissional' | 'Premium';
export type StatusEstabelecimento = 'ativo' | 'teste' | 'bloqueado';

export const PLANOS: { id: PlanoKipi; preco: number; descricao: string }[] = [
  { id: 'Essencial', preco: 49.9, descricao: 'Pedidos, clientes e estoque' },
  { id: 'Profissional', preco: 89.9, descricao: '+ produção, receitas e revendedoras' },
  { id: 'Premium', preco: 149.9, descricao: '+ vários usuários e relatórios' },
];

export interface PagamentoMensalidade {
  id: string;
  competencia: string; // AAAA-MM
  valor: number;
  data: string; // ISO
}

export interface Estabelecimento {
  id: string;
  nome: string;
  donaNome: string;
  donaEmail: string;
  telefone: string;
  cidade: string;
  plano: PlanoKipi;
  mensalidade: number;
  diaVencimento: number;
  status: StatusEstabelecimento;
  criadoEm: string; // ISO
  pagamentos: PagamentoMensalidade[];
}

// Uma área que o login pode abrir (ex.: Admin Kipi e Revendedora da Fatiô no mesmo login)
export interface AreaDeAcesso {
  perfil: Perfil;
  estabelecimentoId: string | null;
  revendedoraId?: string | null;
  rotulo: string;
}

export interface UsuarioAcesso {
  id: string;
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
  estabelecimentoId: string | null; // null = admin do Kipi
  revendedoraId?: string | null;
  outrasAreas?: AreaDeAcesso[]; // áreas extras do mesmo login
}

export interface Sessao {
  usuarioId: string;
  nome: string;
  email: string;
  perfil: Perfil;
  estabelecimentoId: string | null;
  revendedoraId: string | null;
  areas?: AreaDeAcesso[]; // todas as áreas do login (troca sem sair)
}

export const SENHA_PADRAO_REVENDEDORA = '123456';

// Ateliê dos dados de exemplo de todas as telas
export const ESTABELECIMENTO_EXEMPLO = 'est-1';

const competencia = (mesesAtras: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mesesAtras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const diasAtras = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();

// Mensalidades pagas de exemplo: uma por mês, de "desde" meses atrás até "ate" (0 = mês atual).
// "pula" deixa meses sem pagamento (inadimplência).
const pagos = (id: string, valor: number, desde: number, ate: number, pula: number[] = []): PagamentoMensalidade[] =>
  Array.from({ length: desde - ate + 1 }, (_, i) => desde - i)
    .filter((m) => !pula.includes(m))
    .map((m) => {
      const hoje = new Date();
      const data = m === 0 ? hoje : new Date(hoje.getFullYear(), hoje.getMonth() - m, 6, 10);
      return { id: `mens-${id}-${m}`, competencia: competencia(m), valor, data: data.toISOString() };
    });

const ateli = (
  id: string,
  nome: string,
  donaNome: string,
  donaEmail: string,
  cidade: string,
  plano: PlanoKipi,
  diaVencimento: number,
  status: StatusEstabelecimento,
  diasDeCasa: number,
  pagamentos: (valor: number) => PagamentoMensalidade[]
): Estabelecimento => {
  const mensalidade = PLANOS.find((p) => p.id === plano)!.preco;
  return { id, nome, donaNome, donaEmail, telefone: '', cidade, plano, mensalidade, diaVencimento, status, criadoEm: diasAtras(diasDeCasa), pagamentos: pagamentos(mensalidade) };
};

let estabelecimentos: Estabelecimento[] = [
  ateli('est-1', 'AtelierQ', 'Camila Lima', 'camila.c.lima08@gmail.com', 'São Paulo/SP', 'Profissional', 10, 'ativo', 300, (v) => pagos('1', v, 9, 0)),
  ateli('est-2', 'Doce Encanto', 'Patrícia Souza', 'patricia@doceencanto.com', 'Belo Horizonte/MG', 'Essencial', 5, 'ativo', 150, (v) => pagos('2', v, 4, 2)),
  ateli('est-3', 'Fornada da Vó', 'Marta Ribeiro', 'marta@fornadadavo.com', 'Curitiba/PR', 'Profissional', 15, 'teste', 6, () => []),
  ateli('est-4', 'Casa Brigadeiro', 'Luana Prado', 'luana@casabrigadeiro.com', 'São Paulo/SP', 'Premium', 1, 'ativo', 240, (v) => pagos('4', v, 7, 0)),
  ateli('est-5', 'Mimo Confeitaria', 'Bianca Torres', 'bianca@mimoconfeitaria.com', 'Campinas/SP', 'Profissional', 20, 'ativo', 180, (v) => pagos('5', v, 5, 1)),
  ateli('est-6', 'Açúcar de Vó', 'Rosa Menezes', 'rosa@acucardevo.com', 'Recife/PE', 'Essencial', 10, 'ativo', 120, (v) => pagos('6', v, 3, 1, [1])),
  ateli('est-7', 'Petit Gâteau Lab', 'Helena Duarte', 'helena@petitgateau.com', 'Rio de Janeiro/RJ', 'Profissional', 8, 'ativo', 75, (v) => pagos('7', v, 2, 1)),
  ateli('est-8', 'Cookie Lovers', 'Tainá Rocha', 'taina@cookielovers.com', 'Florianópolis/SC', 'Essencial', 12, 'bloqueado', 200, (v) => pagos('8', v, 6, 3)),
  ateli('est-9', 'Bendita Massa', 'Carla Nunes', 'carla@benditamassa.com', 'Porto Alegre/RS', 'Essencial', 25, 'teste', 11, () => []),
  ateli('est-10', 'Doçura Fina', 'Paula Reis', 'paula@docurafina.com', 'Salvador/BA', 'Premium', 15, 'ativo', 40, (v) => pagos('10', v, 1, 1)),
];

let usuarios: UsuarioAcesso[] = [
  { id: 'usr-admin', nome: 'Camila Lima', email: 'admin@kipi.app', senha: 'kipi123', perfil: 'admin', estabelecimentoId: null },
  { id: 'usr-1', nome: 'Camila Lima', email: 'camila.c.lima08@gmail.com', senha: 'P&ix1nh0!', perfil: 'dona', estabelecimentoId: 'est-1' },
  // Donas dos demais ateliês de exemplo (senha de teste 123456)
  ...estabelecimentos
    .filter((e) => e.id !== 'est-1')
    .map((e): UsuarioAcesso => ({ id: `usr-${e.id}`, nome: e.donaNome, email: e.donaEmail, senha: '123456', perfil: 'dona', estabelecimentoId: e.id })),
];

let sessao: Sessao | null = null;
let sessaoCarregada = false;
const ouvintes = new Set<() => void>();
// Foto do estado entregue às telas: objeto novo a cada mudança (seguro com o React Compiler)
let estadoSessao: { sessao: Sessao | null; carregada: boolean; estabelecimentos: Estabelecimento[] } = { sessao, carregada: sessaoCarregada, estabelecimentos };
const assinar = (fn: () => void) => {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
};
const notificar = () => {
  estadoSessao = { sessao, carregada: sessaoCarregada, estabelecimentos };
  ouvintes.forEach((fn) => fn());
};

const CHAVE_SESSAO = 'kipi:sessao';

// ============================================================================
// DADOS SEPARADOS POR ATELIÊ — cada lib (pedidos, estoque, revenda...) se registra
// aqui. Ao entrar em outro ateliê, os dados do anterior ficam guardados e os do
// novo são carregados; um ateliê novo começa vazio.
// ============================================================================
interface DadosDoEstabelecimento {
  exportar: () => unknown;
  importar: (estado: unknown | undefined) => void; // undefined = ateliê novo, começa vazio
}
const lojas = new Map<string, DadosDoEstabelecimento>();
const guardados: Record<string, Record<string, unknown>> = {};
let estabelecimentoCarregado = ESTABELECIMENTO_EXEMPLO;

export const registrarDadosDoEstabelecimento = (nome: string, dados: DadosDoEstabelecimento) => {
  lojas.set(nome, dados);
  // Lib carregada depois da troca de ateliê: guarda o exemplo e carrega o ateliê atual
  if (estabelecimentoCarregado !== ESTABELECIMENTO_EXEMPLO) {
    guardados[ESTABELECIMENTO_EXEMPLO] = { ...guardados[ESTABELECIMENTO_EXEMPLO], [nome]: dados.exportar() };
    dados.importar(guardados[estabelecimentoCarregado]?.[nome]);
  }
};

// Com o banco ligado (lib/sincronizacao), a troca de ateliê também busca os dados no banco
let aoTrocarEstabelecimento: ((id: string) => void) | null = null;
export const registrarCarregadorRemoto = (fn: (id: string) => void) => {
  aoTrocarEstabelecimento = fn;
};

const carregarEstabelecimento = (id: string | null) => {
  if (!id || id === estabelecimentoCarregado) return;
  aoTrocarEstabelecimento?.(id); // para de salvar o ateliê anterior antes de trocar os dados
  guardados[estabelecimentoCarregado] = Object.fromEntries([...lojas].map(([nome, d]) => [nome, d.exportar()]));
  estabelecimentoCarregado = id;
  lojas.forEach((d, nome) => d.importar(guardados[id]?.[nome]));
};

// Leitura e troca dos dados de uma lib do ateliê atual (usado pela sincronização com o banco)
export const exportarLoja = (nome: string) => lojas.get(nome)?.exportar();
export const importarLoja = (nome: string, estado: unknown) => lojas.get(nome)?.importar(estado);

export const estabelecimentoAtualId = () => estabelecimentoCarregado;
export const nomeDoEstabelecimento = (id: string) => estabelecimentos.find((e) => e.id === id)?.nome ?? '';

// ============================================================================
// SESSÃO
// ============================================================================
// Com o banco ligado, a sessão salva só é conferida depois que ateliês e usuários chegam do banco
let esperaAntesDaSessao: Promise<unknown> = Promise.resolve();
export const aguardarAntesDaSessao = (p: Promise<unknown>) => {
  esperaAntesDaSessao = p;
};

const carregarSessao = async () => {
  try {
    const salva = await AsyncStorage.getItem(CHAVE_SESSAO);
    await esperaAntesDaSessao.catch(() => undefined);
    const lida = salva ? (JSON.parse(salva) as Sessao) : null;
    // Sessão do login antigo (sem perfil) ou de usuário que não existe mais: pede login de novo
    if (lida?.perfil && usuarios.some((u) => u.id === lida.usuarioId)) {
      sessao = lida;
      carregarEstabelecimento(lida.estabelecimentoId);
    }
  } catch {
    // sem sessão salva
  }
  sessaoCarregada = true;
  notificar();
};
carregarSessao();

export const useSessao = () => {
  const { sessao: s, carregada } = useSyncExternalStore(assinar, () => estadoSessao, () => estadoSessao);
  return { sessao: s, carregada };
};

export const sessaoAtual = () => sessao;
// Quem registrou (pedido, produção, descarte...)
export const nomeUsuarioAtual = () => sessao?.nome ?? 'Camila Lima';

const salvarSessao = async () => {
  try {
    if (sessao) await AsyncStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    else await AsyncStorage.removeItem(CHAVE_SESSAO);
  } catch {
    // fica só em memória
  }
};

// Retorna a mensagem de erro, ou null quando entrou
export const entrar = async (email: string, senha: string): Promise<string | null> => {
  const u = usuarios.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u) return 'E-mail não encontrado no sistema';
  if (u.senha !== senha) return 'Senha incorreta';
  const est = u.estabelecimentoId ? estabelecimentos.find((e) => e.id === u.estabelecimentoId) : null;
  if (u.estabelecimentoId && !est) return 'Empresa não encontrada.';
  if (est?.status === 'bloqueado') return 'Acesso suspenso. Fale com o suporte do Kipi.';
  carregarEstabelecimento(u.estabelecimentoId);
  const principal: AreaDeAcesso = {
    perfil: u.perfil,
    estabelecimentoId: u.estabelecimentoId,
    revendedoraId: u.revendedoraId ?? null,
    rotulo: rotuloDaArea(u.perfil, u.estabelecimentoId),
  };
  sessao = {
    usuarioId: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    estabelecimentoId: u.estabelecimentoId,
    revendedoraId: u.revendedoraId ?? null,
    areas: [principal, ...(u.outrasAreas ?? [])],
  };
  await salvarSessao();
  notificar();
  return null;
};

export const rotuloDaArea = (perfil: Perfil, estabelecimentoId: string | null) => {
  const empresa = estabelecimentoId ? nomeDoEstabelecimento(estabelecimentoId) : '';
  if (perfil === 'admin') return 'Administração Kipi';
  return perfil === 'revendedora' ? `Revendedora · ${empresa}` : `Responsável · ${empresa}`;
};

// Troca de área sem sair do login (ex.: de Admin Kipi para Revendedora da Fatiô)
export const trocarArea = async (indice: number) => {
  const area = sessao?.areas?.[indice];
  if (!sessao || !area) return;
  carregarEstabelecimento(area.estabelecimentoId);
  sessao = { ...sessao, perfil: area.perfil, estabelecimentoId: area.estabelecimentoId, revendedoraId: area.revendedoraId ?? null };
  await salvarSessao();
  notificar();
};

export const sair = async () => {
  sessao = null;
  await salvarSessao();
  notificar();
};

export const atualizarDadosDoUsuario = async (nome: string, email: string): Promise<string | null> => {
  if (!sessao) return 'Entre novamente no sistema para alterar seus dados.';
  const emUso = usuarios.some((u) => u.id !== sessao!.usuarioId && u.email.toLowerCase() === email.toLowerCase());
  if (emUso) return 'Este e-mail já é usado por outro acesso.';
  if (gravadorDeUsuario) {
    const erro = await gravadorDeUsuario(sessao.usuarioId, { nome, email });
    if (erro) return erro;
  }
  usuarios = usuarios.map((u) => (u.id === sessao!.usuarioId ? { ...u, nome, email } : u));
  sessao = { ...sessao, nome, email };
  await salvarSessao();
  notificar();
  return null;
};

export const trocarSenhaDoUsuario = async (senhaAtual: string, novaSenha: string): Promise<string | null> => {
  const u = sessao ? usuarios.find((x) => x.id === sessao!.usuarioId) : undefined;
  if (!u) return 'Entre novamente no sistema para trocar sua senha.';
  if (u.senha !== senhaAtual) return 'Senha atual incorreta.';
  if (gravadorDeUsuario) {
    const erro = await gravadorDeUsuario(u.id, { senha: novaSenha });
    if (erro) return erro;
  }
  usuarios = usuarios.map((x) => (x.id === u.id ? { ...x, senha: novaSenha } : x));
  return null;
};

// Tela inicial e telas liberadas de cada perfil
export const ROTAS_DO_PERFIL: Record<Perfil, { inicio: string; rotas: string[] }> = {
  admin: { inicio: '/admin', rotas: ['/admin'] },
  // Revendedora usa as mesmas telas da dona, só com os dados dela
  revendedora: { inicio: '/visao-geral', rotas: ['/visao-geral', '/pedidos', '/clientes'] },
  dona: {
    inicio: '/visao-geral',
    rotas: [
      '/visao-geral',
      '/pedidos',
      '/clientes',
      '/producao',
      '/estoque',
      '/insumos-receitas',
      '/produtos-estoque',
      '/acessos',
      '/configuracoes',
      '/explore',
    ],
  },
};

// null = pode ficar; senão, a rota para onde mandar
export const destinoPermitido = (s: Sessao | null, rota: string): string | null => {
  if (!s) return rota === '/' ? null : '/';
  const { inicio, rotas } = ROTAS_DO_PERFIL[s.perfil];
  return rotas.includes(rota) ? null : inicio;
};

// ============================================================================
// ACESSO DAS REVENDEDORAS — criado quando a dona cadastra a revendedora com e-mail
// ============================================================================
export const acessoDaRevendedora = (revendedoraId: string) =>
  usuarios.find((u) => u.perfil === 'revendedora' && u.revendedoraId === revendedoraId) ?? null;

export const garantirAcessoRevendedora = (r: { id: string; nome: string; email?: string | null }, estabelecimentoId = estabelecimentoCarregado) => {
  const email = r.email?.trim().toLowerCase();
  const atual = acessoDaRevendedora(r.id);
  if (!email) return;
  if (usuarios.some((u) => u.email.toLowerCase() === email && u.id !== atual?.id)) return; // e-mail já usado
  usuarios = atual
    ? usuarios.map((u) => (u.id === atual.id ? { ...u, nome: r.nome, email } : u))
    : [...usuarios, { id: `usr-${r.id}`, nome: r.nome, email, senha: SENHA_PADRAO_REVENDEDORA, perfil: 'revendedora', estabelecimentoId, revendedoraId: r.id }];
  notificar();
};

// ============================================================================
// PAINEL KIPI (ADMIN): ateliês, planos e mensalidades
// ============================================================================
export const useEstabelecimentos = () => {
  return useSyncExternalStore(assinar, () => estadoSessao, () => estadoSessao).estabelecimentos;
};

export const competenciaAtual = () => competencia(0);

// Mensalidades vencidas e não pagas (competências AAAA-MM), desde a criação do ateliê
export const mensalidadesEmAberto = (e: Estabelecimento, hoje = new Date()) => {
  if (e.status === 'teste') return [];
  const pagas = new Set(e.pagamentos.map((p) => p.competencia));
  const criado = new Date(e.criadoEm);
  const abertas: string[] = [];
  for (let m = 12; m >= 0; m--) {
    const vencimento = new Date(hoje.getFullYear(), hoje.getMonth() - m, e.diaVencimento, 23, 59);
    if (vencimento < criado || vencimento > hoje) continue;
    if (!pagas.has(competencia(m))) abertas.push(competencia(m));
  }
  return abertas;
};

// Situação da mensalidade: em dia, a vencer (mês atual ainda não venceu), atrasada ou em teste
export const situacaoMensalidade = (e: Estabelecimento, hoje = new Date()) => {
  if (e.status === 'teste') return 'teste' as const;
  if (mensalidadesEmAberto(e, hoje).length > 0) return 'atrasada' as const;
  return e.pagamentos.some((p) => p.competencia === competenciaAtual()) ? ('em_dia' as const) : ('a_vencer' as const);
};

// Próximo vencimento (data) do mês atual ou do próximo
export const proximoVencimento = (e: Estabelecimento, hoje = new Date()) => {
  const pagoNoMes = e.pagamentos.some((p) => p.competencia === competenciaAtual());
  const mes = pagoNoMes || hoje.getDate() > e.diaVencimento ? 1 : 0;
  return new Date(hoje.getFullYear(), hoje.getMonth() + mes, e.diaVencimento);
};



export const criarEstabelecimento = (dados: {
  nome: string;
  donaNome: string;
  donaEmail: string;
  senha: string;
  telefone: string;
  cidade: string;
  plano: PlanoKipi;
  diaVencimento: number;
  emTeste: boolean;
}): string | null => {
  const email = dados.donaEmail.trim().toLowerCase();
  if (usuarios.some((u) => u.email.toLowerCase() === email)) return 'Este e-mail já tem acesso ao Kipi.';
  const id = `est-${Date.now()}`;
  const plano = PLANOS.find((p) => p.id === dados.plano)!;
  estabelecimentos = [
    {
      id,
      nome: dados.nome.trim(),
      donaNome: dados.donaNome.trim(),
      donaEmail: email,
      telefone: dados.telefone.trim(),
      cidade: dados.cidade.trim(),
      plano: dados.plano,
      mensalidade: plano.preco,
      diaVencimento: dados.diaVencimento,
      status: dados.emTeste ? 'teste' : 'ativo',
      criadoEm: new Date().toISOString(),
      pagamentos: [],
    },
    ...estabelecimentos,
  ];
  usuarios = [...usuarios, { id: `usr-${id}`, nome: dados.donaNome.trim(), email, senha: dados.senha, perfil: 'dona', estabelecimentoId: id }];
  notificar();
  return null;
};

export const atualizarEstabelecimento = (id: string, campos: Partial<Pick<Estabelecimento, 'plano' | 'mensalidade' | 'diaVencimento' | 'status' | 'telefone' | 'cidade'>>) => {
  estabelecimentos = estabelecimentos.map((e) => (e.id === id ? { ...e, ...campos } : e));
  notificar();
};

export const registrarMensalidade = (id: string, valor: number) => {
  estabelecimentos = estabelecimentos.map((e) =>
    e.id === id
      ? {
          ...e,
          status: e.status === 'teste' ? 'ativo' : e.status,
          // Quita a mensalidade em aberto mais antiga; sem atraso, a do mês
          pagamentos: [{ id: `mens-${Date.now()}`, competencia: mensalidadesEmAberto(e)[0] ?? competenciaAtual(), valor, data: new Date().toISOString() }, ...e.pagamentos],
        }
      : e
  );
  notificar();
};

export const usuariosDoEstabelecimento = (id: string) => usuarios.filter((u) => u.estabelecimentoId === id);

// Banco ligado: os ateliês e os acessos de teste vêm do banco (o admin do Kipi continua)
export const listarEstabelecimentos = () => estabelecimentos;
// Banco ligado: os logins são os do banco (tabela usuarios); os de exemplo deixam de valer
export const definirDadosDeAcessoRemotos = (ests: Estabelecimento[], acessos: UsuarioAcesso[]) => {
  estabelecimentos = ests;
  usuarios = acessos;
  notificar();
};

// Banco ligado: troca de senha e de dados vai para a tabela usuarios
let gravadorDeUsuario: ((id: string, campos: { nome?: string; email?: string; senha?: string }) => Promise<string | null>) | null = null;
export const registrarGravadorDeUsuario = (fn: typeof gravadorDeUsuario) => {
  gravadorDeUsuario = fn;
};
