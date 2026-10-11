import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabase";

export type Insumo = { id: string; nome: string; tipo: "ingrediente" | "material"; unidade: string; quantidade: number; minimo: number; custo_unitario: number };
export type Produto = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  ativo: boolean;
  tempo_preparo_minutos?: number;
  valor_hora_trabalho?: number;
  rendimento_unidades?: number;
};
export type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  observacoes: string | null;
};
export type Revendedora = {
  id: string;
  nome: string;
  telefone: string | null;
  tipo_comissao: "porcentagem" | "valor_fixo";
  comissao_percentual: number;
  comissao_fixa: number;
  observacoes: string | null;
  cliente_ids?: string[];
};
export type PagamentoComissao = {
  id: string;
  revendedora_id: string;
  valor: number;
  data: string;
  observacoes: string | null;
};
export type Categoria = {
  id: string;
  nome: string;
};
export type ReceitaItem = { id: string; produto_id: string; insumo_id: string; quantidade: number };
export type VendaItem = { id: string; venda_id: string; produto_id: string | null; nome_produto: string; quantidade: number; preco_unitario: number };
export type Venda = {
  id: string;
  cliente_id: string | null;
  canal: "propria" | "revendedora";
  revendedora_id: string | null;
  data: string;
  pagamento: "pix" | "dinheiro" | "cartao" | "transferencia";
  status: "pago" | "pendente" | "cancelado";
  total: number;
  custo_total: number;
  observacoes: string | null;
  venda_itens: VendaItem[];
  clientes: { nome: string } | null;
  revendedoras?: { nome: string } | null;
};
export type ItemCarrinho = { produto: Produto; quantidade: number };

type Dados = {
  insumos: Insumo[];
  produtos: Produto[];
  clientes: Cliente[];
  receitas: ReceitaItem[];
  vendas: Venda[];
  revendedoras: Revendedora[];
  pagamentos_comissao: PagamentoComissao[];
  categorias: Categoria[];
};

const CHAVE = "meu-atelie-dados-mocados-v2";
const haDias = (dias: number, hora = 14) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(hora, 0, 0, 0); return d.toISOString(); };

const iniciais: Dados = {
  insumos: [
    { id: "i1", nome: "Farinha de trigo", tipo: "ingrediente", unidade: "kg", quantidade: 8.5, minimo: 3, custo_unitario: 6.9 },
    { id: "i2", nome: "Chocolate 60%", tipo: "ingrediente", unidade: "kg", quantidade: 1.2, minimo: 2, custo_unitario: 48 },
    { id: "i3", nome: "Ovos", tipo: "ingrediente", unidade: "un", quantidade: 42, minimo: 18, custo_unitario: 0.92 },
    { id: "i4", nome: "Açúcar mascavo", tipo: "ingrediente", unidade: "kg", quantidade: 0, minimo: 2, custo_unitario: 10.5 },
    { id: "i5", nome: "Manteiga", tipo: "ingrediente", unidade: "kg", quantidade: 3.4, minimo: 1.5, custo_unitario: 39.9 },
    { id: "i6", nome: "Leite condensado", tipo: "ingrediente", unidade: "un", quantidade: 9, minimo: 6, custo_unitario: 7.8 },
    { id: "i7", nome: "Caixa para bolo", tipo: "material", unidade: "un", quantidade: 7, minimo: 10, custo_unitario: 4.2 },
    { id: "i8", nome: "Saquinho para cookie", tipo: "material", unidade: "un", quantidade: 64, minimo: 30, custo_unitario: 0.55 },
    { id: "i9", nome: "Fita de cetim", tipo: "material", unidade: "m", quantidade: 18, minimo: 10, custo_unitario: 1.4 }
  ],
  produtos: [
    { id: "p1", nome: "Bolo de cenoura", categoria: "bolo", preco: 65, estoque: 3, ativo: true, tempo_preparo_minutos: 45, valor_hora_trabalho: 25, rendimento_unidades: 1 },
    { id: "p2", nome: "Bolo Red Velvet", categoria: "bolo", preco: 120, estoque: 1, ativo: true, tempo_preparo_minutos: 60, valor_hora_trabalho: 30, rendimento_unidades: 1 },
    { id: "p3", nome: "Cookie clássico", categoria: "cookie", preco: 9, estoque: 24, ativo: true, tempo_preparo_minutos: 40, valor_hora_trabalho: 20, rendimento_unidades: 12 },
    { id: "p4", nome: "Cookie de chocolate", categoria: "cookie", preco: 11, estoque: 18, ativo: true, tempo_preparo_minutos: 45, valor_hora_trabalho: 20, rendimento_unidades: 12 },
    { id: "p5", nome: "Caixa com 6 cookies", categoria: "cookie", preco: 52, estoque: 8, ativo: true, tempo_preparo_minutos: 20, valor_hora_trabalho: 20, rendimento_unidades: 1 },
    { id: "p6", nome: "Kit presente artesanal", categoria: "artesanato", preco: 78, estoque: 5, ativo: true, tempo_preparo_minutos: 30, valor_hora_trabalho: 25, rendimento_unidades: 1 }
  ],
  categorias: [
    { id: "cat1", nome: "bolo" },
    { id: "cat2", nome: "cookie" },
    { id: "cat3", nome: "artesanato" },
    { id: "cat4", nome: "doces" },
    { id: "cat5", nome: "salgados" }
  ],
  clientes: [
    { id: "c1", nome: "Marina Lopes", telefone: "(11) 98888-4321", rua: "Rua Augusta", numero: "1200", bairro: "Consolação", complemento: "Apto 54", observacoes: "Prefere recheios menos doces." },
    { id: "c2", nome: "Ana Paula", telefone: "(11) 91234-8877", rua: "Av. Paulista", numero: "900", bairro: "Bela Vista", complemento: "Bloco A", observacoes: "Retira aos sábados." },
    { id: "c3", nome: "Carla Mendes", telefone: "(11) 99876-1122", rua: null, numero: null, bairro: null, complemento: null, observacoes: null },
    { id: "c4", nome: "Rafael Lima", telefone: "(11) 93456-7788", rua: "Rua Funchal", numero: "418", bairro: "Vila Olímpia", complemento: "Conj 82", observacoes: "Encomendas para o escritório." },
    { id: "c5", nome: "Juliana Reis", telefone: "(11) 97654-2233", rua: null, numero: null, bairro: null, complemento: null, observacoes: "Gosta de embalagens para presente." }
  ],
  revendedoras: [
    { id: "rv1", nome: "Camila Doces", telefone: "(11) 98888-7777", tipo_comissao: "porcentagem", comissao_percentual: 15, comissao_fixa: 0, observacoes: "Revendedora principal zona sul", cliente_ids: ["c1", "c3"] },
    { id: "rv2", nome: "Café da Praça", telefone: "(11) 97777-6666", tipo_comissao: "valor_fixo", comissao_percentual: 0, comissao_fixa: 5, observacoes: "Ponto comercial parceiro (R$ 5/item)", cliente_ids: ["c4"] }
  ],
  pagamentos_comissao: [
    { id: "pg1", revendedora_id: "rv1", valor: 100, data: haDias(10), observacoes: "Acerto de comissão parcial" }
  ],
  receitas: [
    { id: "r1", produto_id: "p1", insumo_id: "i1", quantidade: 0.35 }, { id: "r2", produto_id: "p1", insumo_id: "i3", quantidade: 4 },
    { id: "r3", produto_id: "p1", insumo_id: "i6", quantidade: 1 }, { id: "r4", produto_id: "p1", insumo_id: "i7", quantidade: 1 },
    { id: "r5", produto_id: "p2", insumo_id: "i1", quantidade: 0.5 }, { id: "r6", produto_id: "p2", insumo_id: "i3", quantidade: 5 },
    { id: "r7", produto_id: "p2", insumo_id: "i5", quantidade: 0.25 }, { id: "r8", produto_id: "p2", insumo_id: "i7", quantidade: 1 },
    { id: "r9", produto_id: "p3", insumo_id: "i1", quantidade: 0.06 }, { id: "r10", produto_id: "p3", insumo_id: "i4", quantidade: 0.025 },
    { id: "r11", produto_id: "p3", insumo_id: "i5", quantidade: 0.03 }, { id: "r12", produto_id: "p3", insumo_id: "i8", quantidade: 1 },
    { id: "r13", produto_id: "p4", insumo_id: "i2", quantidade: 0.04 }, { id: "r14", produto_id: "p4", insumo_id: "i1", quantidade: 0.055 },
    { id: "r15", produto_id: "p4", insumo_id: "i5", quantidade: 0.03 }, { id: "r16", produto_id: "p4", insumo_id: "i8", quantidade: 1 }
  ],
  vendas: []
};

const vendasBase = [
  [0,"c1","pix","p1",1,"propria",null],[0,"c3","cartao","p3",4,"revendedora","rv1"],[1,"c2","pix","p5",1,"propria",null],[2,"c4","transferencia","p4",8,"revendedora","rv2"],
  [3,"c5","dinheiro","p6",1,"propria",null],[4,"c1","pix","p2",1,"revendedora","rv1"],[5,"c3","cartao","p3",6,"propria",null],[6,"c2","pix","p1",1,"propria",null],
  [8,"c4","pix","p5",2,"revendedora","rv2"],[11,"c5","cartao","p4",5,"propria",null],[14,"c1","transferencia","p2",1,"revendedora","rv1"],[17,"c3","pix","p3",10,"propria",null],
  [21,"c2","dinheiro","p6",1,"revendedora","rv2"],[25,"c4","cartao","p1",2,"propria",null],[31,"c5","pix","p5",1,"revendedora","rv1"],[38,"c1","pix","p4",7,"propria",null],
  [45,"c2","cartao","p2",1,"propria",null],[53,"c3","dinheiro","p3",8,"revendedora","rv2"],[67,"c4","pix","p1",1,"propria",null],[82,"c5","transferencia","p6",2,"revendedora","rv1"]
] as const;

iniciais.vendas = vendasBase.map(([dias, clienteId, pagamento, produtoId, quantidade, canal, revId], index) => {
  const produto = iniciais.produtos.find((p) => p.id === produtoId);
  if (!produto) throw new Error("Produto fictício não encontrado");
  const cliente = iniciais.clientes.find((c) => c.id === clienteId);
  const revendedora = revId ? iniciais.revendedoras.find((r) => r.id === revId) : null;
  const total = produto.preco * quantidade;
  const custo = produtoId === "p2" ? 33 : produtoId === "p1" ? 17 : produtoId === "p6" ? 31 : 3.8;
  const id = `v${index + 1}`;
  return {
    id,
    cliente_id: clienteId,
    canal: (canal as "propria" | "revendedora") ?? "propria",
    revendedora_id: (revId as string) ?? null,
    data: haDias(dias, 10 + index % 8),
    pagamento,
    status: index === 2 || index === 9 ? "pendente" : "pago",
    total,
    custo_total: custo * quantidade,
    observacoes: index === 0 ? "Retirada às 17h" : null,
    clientes: cliente ? { nome: cliente.nome } : null,
    revendedoras: revendedora ? { nome: revendedora.nome } : null,
    venda_itens: [{ id: `vi${index + 1}`, venda_id: id, produto_id: produtoId, nome_produto: produto.nome, quantidade, preco_unitario: produto.preco }]
  } as Venda;
});

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function ler(): Dados {
  if (typeof window === "undefined") return clone(iniciais);
  const salvo = localStorage.getItem(CHAVE);
  if (!salvo) {
    localStorage.setItem(CHAVE, JSON.stringify(iniciais));
    return clone(iniciais);
  }
  try {
    const d = JSON.parse(salvo) as Dados;
    if (!d.revendedoras || d.revendedoras.length === 0) {
      d.revendedoras = clone(iniciais.revendedoras);
    }
    if (!d.pagamentos_comissao) d.pagamentos_comissao = clone(iniciais.pagamentos_comissao);
    if (!d.categorias || d.categorias.length === 0) d.categorias = clone(iniciais.categorias);
    return d;
  } catch {
    return clone(iniciais);
  }
}

function gravar(d: Dados) { if (typeof window !== "undefined") localStorage.setItem(CHAVE, JSON.stringify(d)); }
const id = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export const chaves = {
  insumos: ["insumos"] as const,
  produtos: ["produtos"] as const,
  clientes: ["clientes"] as const,
  receitas: ["receitas"] as const,
  vendas: ["vendas"] as const,
  revendedoras: ["revendedoras"] as const,
  pagamentos_comissao: ["pagamentos_comissao"] as const,
  categorias: ["categorias"] as const,
};

// HOOKS DE CONSULTA (SUPABASE + LOCALSTORAGE FALLBACK)
export const useInsumos = () => useQuery({
  queryKey: chaves.insumos,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("insumos").select("*");
      if (error) throw error;
      return (data || []) as Insumo[];
    }
    return ler().insumos;
  }
});

export const useProdutos = () => useQuery({
  queryKey: chaves.produtos,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("produtos").select("*");
      if (error) throw error;
      return (data || []) as Produto[];
    }
    return ler().produtos;
  }
});

export const useClientes = () => useQuery({
  queryKey: chaves.clientes,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("clientes").select("*");
      if (error) throw error;
      return (data || []) as Cliente[];
    }
    return ler().clientes;
  }
});

export const useReceitas = () => useQuery({
  queryKey: chaves.receitas,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("receitas").select("*");
      if (error) throw error;
      return (data || []) as ReceitaItem[];
    }
    return ler().receitas;
  }
});

export const useVendas = () => useQuery({
  queryKey: chaves.vendas,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from("vendas")
        .select("*, clientes(nome), revendedoras(nome), venda_itens(*)")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []) as Venda[];
    }
    return ler().vendas;
  }
});

export const useRevendedoras = () => useQuery({
  queryKey: chaves.revendedoras,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("revendedoras").select("*");
      if (error) throw error;
      return (data || []) as Revendedora[];
    }
    return ler().revendedoras;
  }
});

export const usePagamentosComissao = () => useQuery({
  queryKey: chaves.pagamentos_comissao,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("pagamentos_comissao").select("*").order("data", { ascending: false });
      if (error) throw error;
      return (data || []) as PagamentoComissao[];
    }
    return ler().pagamentos_comissao;
  }
});

export const useCategorias = () => useQuery({
  queryKey: chaves.categorias,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("categorias").select("*");
      if (error) throw error;
      return (data || []) as Categoria[];
    }
    return ler().categorias;
  }
});

const CHAVE_VALOR_HORA = "meu-atelie-valor-hora-padrao";

export function lerValorHoraPadrao(): number {
  if (typeof window === "undefined") return 25;
  const salvo = localStorage.getItem(CHAVE_VALOR_HORA);
  return salvo ? Number(salvo) : 25;
}

export function gravarValorHoraPadrao(valor: number) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CHAVE_VALOR_HORA, String(Math.max(0, valor)));
  }
}

export function custoMaoDeObraFornada(produto?: Partial<Produto>, valorHoraOverride?: number): number {
  if (!produto) return 0;
  const mins = Number(produto.tempo_preparo_minutos ?? 0);
  const valorHora = valorHoraOverride ?? Number(produto.valor_hora_trabalho ?? lerValorHoraPadrao());
  return (mins / 60) * valorHora;
}

export function custoInsumosFornada(produtoId: string, receitas: ReceitaItem[], insumos: Insumo[]): number {
  return receitas
    .filter((r) => r.produto_id === produtoId)
    .reduce((t, r) => t + (insumos.find((i) => i.id === r.insumo_id)?.custo_unitario ?? 0) * Number(r.quantidade), 0);
}

export function custoTotalFornada(produto: Partial<Produto>, receitas: ReceitaItem[], insumos: Insumo[]): number {
  if (!produto.id) return 0;
  const insumosCusto = custoInsumosFornada(produto.id, receitas, insumos);
  const maoDeObra = custoMaoDeObraFornada(produto);
  return insumosCusto + maoDeObra;
}

export function custoProduto(produtoId: string, receitas: ReceitaItem[], insumos: Insumo[], produto?: Partial<Produto>): number {
  const itensReceita = receitas.filter((r) => r.produto_id === produtoId);
  if (itensReceita.length === 0) return 0;

  const insumosCusto = custoInsumosFornada(produtoId, receitas, insumos);
  const maoDeObra = produto ? custoMaoDeObraFornada(produto) : 0;
  const rendimento = Math.max(Number(produto?.rendimento_unidades ?? 1), 1);

  return (insumosCusto + maoDeObra) / rendimento;
}

export function calcularProducaoPossivel(
  produtoId: string,
  receitas: ReceitaItem[],
  insumos: Insumo[],
  rendimentoUnidades = 1
): { possiveis: number; gargaloInsumo: Insumo | null } {
  const itens = receitas.filter((r) => r.produto_id === produtoId);
  if (itens.length === 0) return { possiveis: 0, gargaloInsumo: null };

  let minFornadas = Infinity;
  let gargaloInsumo: Insumo | null = null;

  for (const item of itens) {
    const insumo = insumos.find((i) => i.id === item.insumo_id);
    if (!insumo || item.quantidade <= 0) continue;

    const fornadas = Math.floor(Number(insumo.quantidade) / Number(item.quantidade));
    if (fornadas < minFornadas) {
      minFornadas = fornadas;
      gargaloInsumo = insumo;
    }
  }

  if (minFornadas === Infinity) return { possiveis: 0, gargaloInsumo: null };

  const rend = Math.max(Number(rendimentoUnidades), 1);
  return {
    possiveis: Math.max(0, minFornadas * rend),
    gargaloInsumo,
  };
}

export function statusInsumo(i: Insumo) {
  return i.quantidade <= 0 ? "acabou" as const : i.quantidade <= i.minimo ? "baixo" as const : "ok" as const;
}

export function calcularComissaoRevendedora(venda: Venda, revendedora?: Revendedora | null): number {
  if (venda.canal !== "revendedora" || !revendedora) return 0;
  if (venda.status === "cancelado") return 0;
  
  if (revendedora.tipo_comissao === "valor_fixo") {
    const qtdItens = venda.venda_itens.reduce((s, i) => s + i.quantidade, 0);
    return qtdItens * Number(revendedora.comissao_fixa ?? 0);
  }
  
  return Number(venda.total) * (Number(revendedora.comissao_percentual ?? 0) / 100);
}

export function calcularComissaoEstimadaCarrinho(
  carrinho: ItemCarrinho[],
  revendedora?: Revendedora | null
): number {
  if (!revendedora) return 0;
  const qtdTotal = carrinho.reduce((s, i) => s + i.quantidade, 0);
  const valorTotal = carrinho.reduce((s, i) => s + Number(i.produto.preco) * i.quantidade, 0);
  
  if (revendedora.tipo_comissao === "valor_fixo") {
    return qtdTotal * Number(revendedora.comissao_fixa ?? 0);
  }
  
  return valorTotal * (Number(revendedora.comissao_percentual ?? 0) / 100);
}

// MUTATIONS COM SUPABASE + FALLBACK
export const useSalvarInsumo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Insumo>) => {
      const item = { id: v.id ?? id(), nome: v.nome ?? "", tipo: v.tipo ?? "ingrediente", unidade: v.unidade ?? "kg", quantidade: Number(v.quantidade ?? 0), minimo: Number(v.minimo ?? 0), custo_unitario: Number(v.custo_unitario ?? 0) };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("insumos").upsert(item);
        if (error) throw error;
      } else {
        const d = ler();
        const pos = d.insumos.findIndex((x) => x.id === item.id);
        pos >= 0 ? d.insumos.splice(pos, 1, item) : d.insumos.push(item);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.insumos }),
  });
};

export const useApagarInsumo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("insumos").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.insumos = d.insumos.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.insumos }),
  });
};

export const useEntradaEstoque = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { insumo: Insumo; quantidade: number; motivo: string }) => {
      const novaQtd = Number(v.insumo.quantidade) + Number(v.quantidade);
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("insumos").update({ quantidade: novaQtd }).eq("id", v.insumo.id);
        if (error) throw error;
      } else {
        const d = ler();
        const x = d.insumos.find((i) => i.id === v.insumo.id);
        if (x) x.quantidade = novaQtd;
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.insumos }),
  });
};

export const useSalvarProduto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Produto>) => {
      const catNome = (v.categoria ?? "bolo").trim().toLowerCase();
      const novo = { id: v.id ?? id(), nome: v.nome ?? "", categoria: catNome, preco: Number(v.preco ?? 0), estoque: Number(v.estoque ?? 0), ativo: v.ativo ?? true };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("produtos").upsert(novo);
        if (error) throw error;
        if (catNome) {
          await supabase.from("categorias").upsert({ id: id(), nome: catNome }, { onConflict: "nome" }).select();
        }
      } else {
        const d = ler();
        const pos = d.produtos.findIndex((x) => x.id === novo.id);
        pos >= 0 ? d.produtos.splice(pos, 1, novo) : d.produtos.push(novo);
        if (catNome && !d.categorias.some((c) => c.nome.toLowerCase() === catNome)) {
          d.categorias.push({ id: id(), nome: catNome });
        }
        gravar(d);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.produtos });
      qc.invalidateQueries({ queryKey: chaves.categorias });
    },
  });
};

export const useApagarProduto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("produtos").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.produtos = d.produtos.filter((x) => x.id !== v);
        d.receitas = d.receitas.filter((x) => x.produto_id !== v);
        gravar(d);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.produtos });
      qc.invalidateQueries({ queryKey: chaves.receitas });
    },
  });
};

export const useSalvarCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nomeCat: string) => {
      const nomeLimpo = nomeCat.trim().toLowerCase();
      if (!nomeLimpo) return;
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("categorias").insert({ id: id(), nome: nomeLimpo });
        if (error) throw error;
      } else {
        const d = ler();
        if (!d.categorias.some((c) => c.nome.toLowerCase() === nomeLimpo)) {
          d.categorias.push({ id: id(), nome: nomeLimpo });
          gravar(d);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.categorias }),
  });
};

export const useApagarCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (catId: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("categorias").delete().eq("id", catId);
        if (error) throw error;
      } else {
        const d = ler();
        d.categorias = d.categorias.filter((c) => c.id !== catId);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.categorias }),
  });
};

export const useSalvarCliente = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Cliente>) => {
      const novo: Cliente = {
        id: v.id ?? id(),
        nome: v.nome ?? "",
        telefone: v.telefone ?? null,
        rua: v.rua ?? null,
        numero: v.numero ?? null,
        bairro: v.bairro ?? null,
        complemento: v.complemento ?? null,
        observacoes: v.observacoes ?? null,
      };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("clientes").upsert(novo);
        if (error) throw error;
      } else {
        const d = ler();
        const pos = d.clientes.findIndex((x) => x.id === novo.id);
        pos >= 0 ? d.clientes.splice(pos, 1, novo) : d.clientes.push(novo);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.clientes }),
  });
};

export const useApagarCliente = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("clientes").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.clientes = d.clientes.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.clientes }),
  });
};

export const useSalvarRevendedora = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Revendedora>) => {
      const novo: Revendedora = {
        id: v.id ?? id(),
        nome: v.nome ?? "",
        telefone: v.telefone ?? null,
        tipo_comissao: v.tipo_comissao ?? "porcentagem",
        comissao_percentual: Number(v.comissao_percentual ?? 0),
        comissao_fixa: Number(v.comissao_fixa ?? 0),
        observacoes: v.observacoes ?? null,
        cliente_ids: v.cliente_ids ?? [],
      };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("revendedoras").upsert(novo);
        if (error) throw error;
      } else {
        const d = ler();
        const pos = d.revendedoras.findIndex((x) => x.id === novo.id);
        pos >= 0 ? d.revendedoras.splice(pos, 1, novo) : d.revendedoras.push(novo);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.revendedoras }),
  });
};

export const useApagarRevendedora = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("revendedoras").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.revendedoras = d.revendedoras.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.revendedoras }),
  });
};

export const useSalvarPagamentoComissao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Omit<PagamentoComissao, "id">) => {
      const novo = { ...v, id: id() };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("pagamentos_comissao").insert(novo);
        if (error) throw error;
      } else {
        const d = ler();
        d.pagamentos_comissao.unshift(novo);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.pagamentos_comissao }),
  });
};

export const useApagarPagamentoComissao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idPag: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("pagamentos_comissao").delete().eq("id", idPag);
        if (error) throw error;
      } else {
        const d = ler();
        d.pagamentos_comissao = d.pagamentos_comissao.filter((p) => p.id !== idPag);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.pagamentos_comissao }),
  });
};

export const useSalvarReceitaItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Omit<ReceitaItem, "id">) => {
      const novo = { ...v, id: id() };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("receitas").insert(novo);
        if (error) throw error;
      } else {
        const d = ler();
        d.receitas.push(novo);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.receitas }),
  });
};

export const useApagarReceitaItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("receitas").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.receitas = d.receitas.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.receitas }),
  });
};

export const useAtualizarVenda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; status: Venda["status"] }) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("vendas").update({ status: v.status }).eq("id", v.id);
        if (error) throw error;
      } else {
        const d = ler();
        const x = d.vendas.find((i) => i.id === v.id);
        if (x) x.status = v.status;
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.vendas }),
  });
};

export const useApagarVenda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("vendas").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.vendas = d.vendas.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.vendas }),
  });
};

export const useRegistrarVenda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      itens: ItemCarrinho[];
      clienteId: string | null;
      canal?: "propria" | "revendedora";
      revendedoraId?: string | null;
      data?: string;
      pagamento: Venda["pagamento"];
      status: Venda["status"];
      observacoes: string;
      receitas: ReceitaItem[];
      insumos: Insumo[];
    }) => {
      const vendaId = id();
      const total = v.itens.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);
      const custo = v.itens.reduce((s, i) => s + custoProduto(i.produto.id, v.receitas, v.insumos) * i.quantidade, 0);
      const dataFinal = v.data ? new Date(`${v.data}T12:00:00`).toISOString() : new Date().toISOString();

      if (isSupabaseConfigured) {
        const novaVenda = {
          id: vendaId,
          cliente_id: v.clienteId ?? null,
          canal: v.canal ?? "propria",
          revendedora_id: v.canal === "revendedora" ? (v.revendedoraId ?? null) : null,
          data: dataFinal,
          pagamento: v.canal === "revendedora" ? "pix" : v.pagamento,
          status: v.canal === "revendedora" ? "pago" : v.status,
          total,
          custo_total: custo,
          observacoes: v.observacoes || null,
        };

        const { error: errVenda } = await supabase.from("vendas").insert(novaVenda);
        if (errVenda) throw errVenda;

        const itensParaInserir = v.itens.map((i) => ({
          id: id(),
          venda_id: vendaId,
          produto_id: i.produto.id,
          nome_produto: i.produto.nome,
          quantidade: i.quantidade,
          preco_unitario: i.produto.preco,
        }));
        const { error: errItens } = await supabase.from("venda_itens").insert(itensParaInserir);
        if (errItens) throw errItens;

        // Atualizar estoque no Supabase
        for (const item of v.itens) {
          const novoEstoque = Math.max(0, Number(item.produto.estoque) - item.quantidade);
          await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", item.produto.id);

          for (const r of v.receitas.filter((x) => x.produto_id === item.produto.id)) {
            const insumoAtual = v.insumos.find((x) => x.id === r.insumo_id);
            if (insumoAtual) {
              const novaQtdInsumo = Math.max(0, Number(insumoAtual.quantidade) - r.quantidade * item.quantidade);
              await supabase.from("insumos").update({ quantidade: novaQtdInsumo }).eq("id", insumoAtual.id);
            }
          }
        }
      } else {
        const d = ler();
        const cliente = d.clientes.find((c) => c.id === v.clienteId);
        const revendedora = v.canal === "revendedora" && v.revendedoraId ? d.revendedoras.find((r) => r.id === v.revendedoraId) : null;

        d.vendas.unshift({
          id: vendaId,
          cliente_id: v.clienteId ?? null,
          canal: v.canal ?? "propria",
          revendedora_id: v.canal === "revendedora" ? (v.revendedoraId ?? null) : null,
          data: dataFinal,
          pagamento: v.canal === "revendedora" ? "pix" : v.pagamento,
          status: v.canal === "revendedora" ? "pago" : v.status,
          total,
          custo_total: custo,
          observacoes: v.observacoes || null,
          clientes: cliente ? { nome: cliente.nome } : null,
          revendedoras: revendedora ? { nome: revendedora.nome } : null,
          venda_itens: v.itens.map((i) => ({
            id: id(),
            venda_id: vendaId,
            produto_id: i.produto.id,
            nome_produto: i.produto.nome,
            quantidade: i.quantidade,
            preco_unitario: i.produto.preco,
          })),
        });

        for (const item of v.itens) {
          const p = d.produtos.find((x) => x.id === item.produto.id);
          if (p) p.estoque = Math.max(0, p.estoque - item.quantidade);
          for (const r of d.receitas.filter((x) => x.produto_id === item.produto.id)) {
            const ins = d.insumos.find((x) => x.id === r.insumo_id);
            if (ins) ins.quantidade = Math.max(0, ins.quantidade - r.quantidade * item.quantidade);
          }
        }
        gravar(d);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.vendas });
      qc.invalidateQueries({ queryKey: chaves.produtos });
      qc.invalidateQueries({ queryKey: chaves.insumos });
    },
  });
};
